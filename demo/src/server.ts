import express, { Request, Response, NextFunction } from 'express';

import { evaluatePaymentPolicy, PAYMENT_POLICY } from './layers/policyLayer';
import { scoreTransaction } from './layers/fraudLayer';
import { issuePaymentCredential, checkScope } from './layers/credentialLayer';
import { recordAttempt, recentAttemptCount } from './layers/activityTracker';
import {
  signDecision,
  verifyProof,
  PROOF_KEY_ID,
  PROOF_PUBLIC_KEY_PEM,
  type Proof,
} from './layers/proofLayer';

/**
 * Parmana Exp Demo Server — Agent Labs Buildathon
 *
 * Shows four validation layers converging at the execution boundary for
 * an agent payment:
 *
 *   1. Policy       — real, vendored from packages/policy (PolicyEngine)
 *   2. Fraud        — demo-tier heuristic (no such module exists in-repo)
 *   3. Credential   — demo-tier scoped credential (maxAmount + vendors)
 *   4. Proof        — real, vendored from packages/crypto (Ed25519)
 *
 * See /architecture for a summary judges can read directly, and README
 * comments on each ./layers/*.ts file for what's vendored vs. purpose-built.
 */

const VELOCITY_LIMIT = 5; // attempts per 60s window, see activityTracker
const BLOCKED_VENDORS = ['vendor-sanctioned', 'vendor-blocked'];

interface AuditEntry {
  proofId: string;
  timestamp: string;
  type: 'execute' | 'payment';
  agentId: string;
  action: string;
  decision: 'approved' | 'denied';
  reason: string;
  algorithm: string;
  keyId: string;
  signature: string;
  details: Record<string, unknown>;
}

const auditTrail: AuditEntry[] = [];

function isActionInScope(scope: string[], action: string): boolean {
  return scope.includes(action) || scope.includes('*');
}

export function createApp() {
  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Kubernetes/infra convention alias for the same check.
  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  /**
   * GET /architecture
   * Plain summary of the four validation layers for judges.
   */
  app.get('/architecture', (_req: Request, res: Response) => {
    res.json({
      name: 'Parmana execution-authority validation stack (demo)',
      layers: [
        {
          id: 'M6',
          name: 'Policy Engine',
          provenance: 'real — vendored unmodified from packages/policy/src/PolicyEngine.ts',
          does: 'Deterministic first-match-wins rule evaluation over amount, vendor, and velocity signals.',
          policyId: PAYMENT_POLICY.policyId,
          policyVersion: PAYMENT_POLICY.policyVersion,
        },
        {
          id: 'M5',
          name: 'Fraud Detection',
          provenance: 'demo-tier — purpose-built for this demo; no fraud-detection module exists elsewhere in this repo',
          does: 'Scores amount-vs-limit ratio, request velocity, and deviation from the agent\'s own history.',
        },
        {
          id: 'M4',
          name: 'Credential Scope',
          provenance:
            'demo-tier — purpose-built for the payment scenario; the repo\'s real credential vault (packages/execution-control) scopes opaque connector secrets, not payment amount/vendor bounds',
          does: 'Issues a time-bounded credential scoped to maxAmount + authorizedVendors and checks the request against it.',
        },
        {
          id: 'M7',
          name: 'Cryptographic Proof',
          provenance: 'real — vendored unmodified from packages/crypto (CanonicalSerializer + Ed25519SignatureProvider)',
          does: 'Ed25519-signs every decision over its canonical byte serialization; independently verifiable.',
          keyId: PROOF_KEY_ID,
          publicKey: PROOF_PUBLIC_KEY_PEM,
        },
      ],
    });
  });

  /**
   * POST /execute
   * Generic scoped-action execution check (not payment-specific). Kept for
   * agents that want to pre-flight an arbitrary action against a scope.
   *
   * Body: { agentId, action, amount?, scope: string[], maxAmount? }
   */
  app.post('/execute', async (req: Request, res: Response) => {
    const { agentId, action, amount, scope, maxAmount } = req.body ?? {};

    if (!agentId || !action || !Array.isArray(scope)) {
      return res.status(400).json({
        error: 'agentId, action, and scope[] are required',
      });
    }

    const inScope = isActionInScope(scope, action);
    const withinAmount = maxAmount == null || amount == null || Number(amount) <= maxAmount;

    const decision: 'approved' | 'denied' = inScope && withinAmount ? 'approved' : 'denied';

    let reason = 'action within declared scope and amount bound';
    if (!inScope) reason = `action "${action}" is outside declared scope`;
    else if (!withinAmount) reason = `amount ${amount} exceeds declared maxAmount ${maxAmount}`;

    const proof = await signDecision({
      type: 'execute',
      agentId,
      action,
      decision,
      reason,
      amount: amount ?? null,
      scope,
      maxAmount: maxAmount ?? null,
    });

    auditTrail.push({
      proofId: proof.proofId,
      timestamp: proof.timestamp,
      type: 'execute',
      agentId,
      action,
      decision,
      reason,
      algorithm: proof.algorithm,
      keyId: proof.keyId,
      signature: proof.signature,
      details: { amount: amount ?? null, scope, maxAmount: maxAmount ?? null },
    });

    res.status(decision === 'approved' ? 200 : 403).json({ decision, proof });
  });

  /**
   * POST /verify-scope
   * Checks whether an action is within scope, without executing or signing
   * anything. Useful for agents to pre-flight a call.
   *
   * Body: { credential: { scope: string[], maxAmount? }, action, amount? }
   */
  app.post('/verify-scope', (req: Request, res: Response) => {
    const { credential, action, amount } = req.body ?? {};

    if (!credential || !Array.isArray(credential.scope) || !action) {
      return res.status(400).json({
        error: 'credential.scope[] and action are required',
      });
    }

    const inScope = isActionInScope(credential.scope, action);
    const withinAmount =
      credential.maxAmount == null || amount == null || Number(amount) <= credential.maxAmount;

    res.json({
      inScope: inScope && withinAmount,
      details: {
        scopeMatch: inScope,
        amountMatch: withinAmount,
        maxAmount: credential.maxAmount ?? null,
        requestedAmount: amount ?? null,
      },
    });
  });

  /**
   * POST /demo/payment
   * The headline demo: an agent tries to pay a vendor. Four layers gate the
   * decision — Policy, Fraud, Credential Scope, then a signed Proof either
   * way.
   *
   * Body: { agentId, vendorId, amount, limit }
   */
  app.post('/demo/payment', async (req: Request, res: Response) => {
    const { agentId, vendorId, amount, limit } = req.body ?? {};

    if (!agentId || !vendorId || amount == null || limit == null) {
      return res.status(400).json({
        error: 'agentId, vendorId, amount, and limit are required',
      });
    }

    const numericAmount = Number(amount);
    const numericLimit = Number(limit);

    // Layer 3: Credential Scope
    const credential = issuePaymentCredential(agentId, numericLimit, [vendorId]);
    const credentialResult = checkScope(credential, vendorId, numericAmount);

    // Layer 1: Policy
    const recentAttempts = recentAttemptCount(agentId);
    const policyResult = evaluatePaymentPolicy({
      amount: numericAmount,
      limit: numericLimit,
      vendorId,
      blockedVendors: BLOCKED_VENDORS,
      recentAttempts,
      velocityLimit: VELOCITY_LIMIT,
    });

    // Layer 2: Fraud
    const fraudResult = scoreTransaction({ agentId, amount: numericAmount, limit: numericLimit });

    recordAttempt(agentId, numericAmount);

    const approved =
      credentialResult.inScope && policyResult.approved && fraudResult.riskLevel !== 'high';

    let denialReason: string | undefined;
    if (!approved) {
      if (!credentialResult.inScope) denialReason = credentialResult.reason;
      else if (!policyResult.approved) denialReason = policyResult.reason;
      else denialReason = `fraud risk level is "${fraudResult.riskLevel}"`;
    }

    // Layer 4: Proof — signs the full decision, approved or not.
    const proof: Proof = await signDecision({
      agentId,
      vendorId,
      amount: numericAmount,
      limit: numericLimit,
      approved,
      policyApproved: policyResult.approved,
      policyMatchedRuleId: policyResult.matchedRuleId,
      fraudRisk: fraudResult.riskLevel,
      fraudScore: fraudResult.score,
      credentialInScope: credentialResult.inScope,
    });

    auditTrail.push({
      proofId: proof.proofId,
      timestamp: proof.timestamp,
      type: 'payment',
      agentId,
      action: `payment:${vendorId}`,
      decision: approved ? 'approved' : 'denied',
      reason: denialReason ?? 'passed all validation layers',
      algorithm: proof.algorithm,
      keyId: proof.keyId,
      signature: proof.signature,
      details: { vendorId, amount: numericAmount, limit: numericLimit },
    });

    const message = approved
      ? `Agent ${agentId} paid vendor ${vendorId} $${numericAmount} — passed policy, fraud, and credential-scope checks.`
      : `Agent ${agentId} was BLOCKED from paying vendor ${vendorId} $${numericAmount} — ${denialReason}.`;

    res.status(approved ? 200 : 403).json({
      approved,
      decision: { approved },
      validation: {
        policy: policyResult,
        fraud: fraudResult,
        credential: {
          agentId,
          credentialId: credential.credentialId,
          scope: { maxAmount: credential.maxAmount, authorizedVendors: credential.authorizedVendors },
          inScope: credentialResult.inScope,
          reason: credentialResult.reason,
        },
      },
      credential,
      proof,
      message,
    });
  });

  /**
   * GET /proofs?limit=100
   * Returns the audit trail, newest first.
   */
  app.get('/proofs', (req: Request, res: Response) => {
    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 100;

    const trail = [...auditTrail].reverse().slice(0, limit);

    res.json({
      count: trail.length,
      total: auditTrail.length,
      proofs: trail,
    });
  });

  /**
   * POST /verify-proof
   * Independently re-verifies a proof's Ed25519 signature over its own
   * canonical payload. Body: { proof: <a proof object as returned by
   * /demo/payment, /execute, or /proofs> }.
   */
  app.post('/verify-proof', async (req: Request, res: Response) => {
    const { proof } = req.body ?? {};

    if (
      !proof ||
      typeof proof.signature !== 'string' ||
      typeof proof.payload !== 'object' ||
      proof.payload === null
    ) {
      return res.status(400).json({
        error: 'proof.signature and proof.payload are required',
      });
    }

    try {
      const valid = await verifyProof(proof as Proof);
      res.json({ valid, keyId: proof.keyId ?? null, algorithm: proof.algorithm ?? null });
    } catch (err) {
      res.status(400).json({ valid: false, error: (err as Error).message });
    }
  });

  return app;
}
