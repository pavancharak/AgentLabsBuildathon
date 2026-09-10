/**
 * Layer 1 — Policy (real, vendored from packages/policy).
 *
 * Builds a real Policy document (amount limit, vendor allowlist, velocity)
 * and evaluates it with the actual production PolicyEngine.
 */
import { PolicyEngine } from '../vendor/policy/PolicyEngine';
import { PolicyAction, PolicyOutcome, type Policy, type PolicySignals } from '../vendor/policy/types';

const engine = new PolicyEngine();

export const PAYMENT_POLICY: Policy = {
  policyId: 'demo-payment-policy',
  policyVersion: '1.0.0',
  schemaVersion: '1.0.0',
  description: 'Buildathon demo: bounds an agent payment by amount, vendor, and velocity.',
  rules: [
    {
      id: 'amountRule',
      condition: { fact: 'amountExceedsLimit', operator: 'is_true' },
      outcome: { action: PolicyAction.REJECT, reason: 'amount exceeds credential limit' },
    },
    {
      id: 'vendorRule',
      condition: { fact: 'vendorBlocked', operator: 'is_true' },
      outcome: { action: PolicyAction.REJECT, reason: 'vendor is not on the approved list' },
    },
    {
      id: 'velocityRule',
      condition: { fact: 'velocityExceeded', operator: 'is_true' },
      outcome: { action: PolicyAction.REJECT, reason: 'too many payment attempts in the last window' },
    },
    {
      id: 'defaultApprove',
      condition: { always: true },
      outcome: { action: PolicyAction.APPROVE, reason: 'all policy rules passed' },
    },
  ],
};

export interface PolicyLayerInput {
  amount: number;
  limit: number;
  vendorId: string;
  blockedVendors: readonly string[];
  recentAttempts: number;
  velocityLimit: number;
}

export interface PolicyLayerResult {
  approved: boolean;
  policyId: string;
  policyVersion: string;
  matchedRuleId: string;
  reason: string;
  evaluatedRules: number;
  matchedPath: string[];
}

export function evaluatePaymentPolicy(input: PolicyLayerInput): PolicyLayerResult {
  const signals: PolicySignals = {
    amountExceedsLimit: input.amount > input.limit,
    vendorBlocked: input.blockedVendors.includes(input.vendorId),
    velocityExceeded: input.recentAttempts > input.velocityLimit,
  };

  const decision = engine.evaluate(PAYMENT_POLICY, signals);

  return {
    approved: decision.outcome === PolicyOutcome.APPROVE,
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    matchedRuleId: decision.matchedRuleId,
    reason: decision.reason,
    evaluatedRules: decision.evaluatedRules,
    matchedPath: decision.matchedPath,
  };
}
