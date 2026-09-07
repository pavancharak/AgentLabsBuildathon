# NF-001: Upstream Authorization Verification

**Status:** FUTURE SCOPE (not currently implemented)
**Decision Date:** Sep 7, 2026
**Last Updated:** Sep 7, 2026
**Author:** Pavan (Parmana)

---

## Executive Summary

Parmana currently trusts the caller's own authority/authorization assertion. An authenticated caller can self-create `Authority`, `Authorization`, and `Intent` objects with no independent verification — confirmed against the actual code: `BusinessTransactionValidator.validate()` (`packages/runtime/src/validators/BusinessTransactionValidator.ts`) checks only ID-linkage between `authority`/`authorization`/`intent` and required-field presence. It never checks a signature, issuer, or expiry on `Authority`/`Authorization` themselves.

This design spec defines an optional **upstream authorization verification layer** that validates authorization from external sources (compliance systems, risk services, external providers) before Parmana policy evaluation.

**This is NOT a security bug in current Parmana.** It is a delegation pattern needed when:
- Multi-party approval is required (risk team, compliance officer must independently authorize)
- External authorization sources are integrated (OAuth, SAML, external risk service)
- Regulatory compliance requires proof of independent approval
- Cross-organization delegation is in scope

Parmana's actual current trust model does not have this gap by omission — it's a deliberate simplification for the caller-authenticated-directly threat model already in place: caller identity (API key → `callerId`) plus `isPrincipalAllowed`/`isCapabilityAllowed` scoping (`packages/api/src/auth/`) is the real authorization boundary today. `Authority`/`Authorization`/`Intent` are structured metadata describing what an already-authenticated caller is asking for, not an independent second credential. NF-001 is what you'd add on top of that if a request needs to prove someone *other than the authenticated caller* approved it.

---

## Problem Statement

### Current State

```typescript
// Caller submits:
POST /execute {
  authority: { authorityId: "auth-123", ... },
  authorization: { authorizationId: "z-456", ... },
  intent: { action: "transfer", parameters: { amount: 1000000 }, ... }
}

// BusinessTransactionValidator.validate() checks:
// - metadata.businessTransactionId matches businessTransactionId
// - authorization.authorityId matches authority.authorityId
// - intent.authorizationId matches authorization.authorizationId
// - policy.name / policy.version / intent.action are non-empty

// It does NOT check:
// - Did the named authority actually issue this authorization?
// - Is there any signature backing authority/authorization at all?
// - Is authorization still within any validity window?
// - Is it independently scoped to this exact action/target/params by
//   someone other than the caller?

// Result: policy evaluation proceeds on the caller's own unverified
// assertion of authority/authorization -- fine when the authenticated
// caller IS the authority; a real gap when it needs to be someone else.
```

### When This Matters

**Scenario 1: Multi-Party Approval**
- Payment amount $1M requires approval from risk team
- Risk team issues signed approval: "OK for $1M transfer to account-X"
- Caller includes risk team's signature in request
- Parmana must verify: risk team actually issued this, it's still valid, amount matches

**Scenario 2: External Authorization Source**
- User authenticates via OAuth provider
- Provider issues scoped authorization token (JWT, signed)
- Token says: "user can do action:transfer, amount <=$500k, valid until 2026-09-08"
- Parmana receives token in request
- Parmana must verify: token signature is valid, not expired, scope matches request

**Scenario 3: Regulated Finance Audit Trail**
- Compliance officer must independently sign off on payment
- Compliance signature must be persisted in trust record
- Audit shows: "compliance officer approved this specific payment on this date"
- Requires independent verification of compliance signature

### Why Not Today?

- No current customer asking for delegation
- Parmana is pre-production on most integrations
- Policy evaluation is the current enforcement gate
- No external authorization sources yet integrated
- Effort cost (roughly a day, see Roadmap) is high relative to current ROI

### A related, narrower mechanism that already exists

Parmana already has one real precedent for "an independently-signed external artifact backing a specific claim": `@parmana/approval`'s `ApprovalVerifier` + `TrustedApprovalIssuer` registry (`packages/api/src/bootstrap/createApprovalIssuerRegistry.ts`), consumed today by `HubSpotSignalStateVerifier` (`packages/connector-hubspot/src/HubSpotSignalStateVerifier.ts`) to verify a `preAuthorizedForAmountChange` claim against a real `SignedApproval` artifact. That mechanism is narrower than NF-001 by design — it verifies one specific signal against one specific approval artifact scoped to one policy, not a general-purpose authorization envelope covering the whole request. `TRUSTED_APPROVAL_ISSUERS` is currently an empty array (fail-closed by design; no real approver key has been provisioned) — provisioning a real issuer there is an operational decision, separate from whether NF-001's broader mechanism ever gets built. NF-001, if built, could plausibly reuse `@parmana/approval`'s issuer-registry pattern rather than inventing a second one — see Solution Design.

---

## Solution Design

### What Needs to Happen

```
Caller submits authorization request with optional upstream authorization:

POST /execute {
  authority: { ... },
  authorization: { ... },
  intent: { ... },
  upstreamAuthorization?: string  // JWT, signed envelope, etc.
}

Parmana verifies upstream authorization:
1. Extract issuer from token/envelope
2. Load issuer public key from trust registry
3. Verify signature against token
4. Check expiry (not past expiresAt)
5. Validate scope (action, target, amount match request)
6. Extract issuer/scope info and persist in runtime context

If verification fails -> reject before policy evaluation
If verification succeeds -> proceed to policy evaluation with verified upstream auth
```

### Architecture Components

Note on placement: `BusinessTransactionValidator` — the actual current linkage-check class this would extend — lives in `packages/runtime/src/validators/`, not `packages/api/src/services/` (`packages/api` has no `services/` directory). `packages/runtime` has no HTTP/JWT-parsing dependencies today; a real implementation should decide deliberately whether upstream-authorization *parsing* (JWT/envelope format, network calls to fetch issuer keys) belongs at the `packages/api` HTTP boundary (verify before ever constructing a `BusinessTransaction`) or inside `packages/runtime` alongside the linkage check it would extend. The sketch below assumes the HTTP-boundary placement, matching where caller-auth's own `isPrincipalAllowed`/`isCapabilityAllowed` already run (`packages/api/src/routes/execute.ts`).

#### 1. UpstreamAuthorizationVerifier

**File:** `packages/api/src/auth/UpstreamAuthorizationVerifier.ts` (proposed — matches where `isPrincipalAllowed.ts`/`isCapabilityAllowed.ts` already live, not a new `services/` directory)

```typescript
export interface UpstreamAuthorizationToken {
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  subject?: string; // Who the auth is for
  scope: {
    action: string;
    target?: string;
    amount?: number;
  };
  signature: string;
  payload: string;
}

export interface VerifiedUpstreamAuthorization {
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  scope: {
    action: string;
    target?: string;
    amount?: number;
  };
  verifiedAt: string;
}

export class UpstreamAuthorizationVerifier {
  constructor(private issuerRegistry: UpstreamAuthorizationIssuerRegistry) {}

  /**
   * Verify an upstream authorization token.
   * Returns verified authorization or throws if verification fails.
   */
  public async verify(
    token: string,
    requestedAction: string,
    requestedTarget?: string,
    requestedAmount?: number
  ): Promise<VerifiedUpstreamAuthorization> {
    const parsed = this.parseToken(token);

    const issuer = this.issuerRegistry.getIssuer(parsed.issuer);
    if (!issuer) {
      throw new Error(`Upstream issuer '${parsed.issuer}' not recognized`);
    }

    if (!this.verifySignature(parsed.payload, parsed.signature, issuer.publicKey)) {
      throw new Error("Upstream authorization signature verification failed");
    }

    if (new Date() > new Date(parsed.expiresAt)) {
      throw new Error(`Upstream authorization expired at ${parsed.expiresAt}`);
    }

    if (parsed.scope.action !== requestedAction) {
      throw new Error(
        `Upstream authorization action '${parsed.scope.action}' ` +
        `does not match requested action '${requestedAction}'`
      );
    }

    if (parsed.scope.target && parsed.scope.target !== requestedTarget) {
      throw new Error(`Upstream authorization target mismatch`);
    }

    if (parsed.scope.amount && parsed.scope.amount < (requestedAmount || 0)) {
      throw new Error(
        `Upstream authorization amount limit (${parsed.scope.amount}) ` +
        `below requested amount (${requestedAmount})`
      );
    }

    return {
      issuer: parsed.issuer,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      scope: parsed.scope,
      verifiedAt: new Date().toISOString(),
    };
  }

  private parseToken(token: string): UpstreamAuthorizationToken {
    // JWT or signed-envelope parsing, format TBD at Gate 2 (see below) --
    // depends on who the real issuers turn out to be.
    throw new Error("not implemented");
  }

  private verifySignature(payload: string, signature: string, publicKey: string): boolean {
    // Should reuse @parmana/crypto's SignatureVerifier / AuthorizationVerifier
    // primitives rather than a bespoke verify path, if the chosen token
    // format allows it.
    throw new Error("not implemented");
  }
}
```

#### 2. Issuer Registry

**File:** `packages/api/src/bootstrap/createUpstreamAuthorizationIssuerRegistry.ts` (proposed)

Whether this should actually be a new registry, or an extension of the existing `@parmana/approval` `ApprovalIssuerRegistry`/`TrustedApprovalIssuer` (`packages/approval/src/ApprovalIssuerRegistry.ts`, already consumed via `createApprovalIssuerRegistry.ts`), is an open question for Gate 2 — they serve adjacent but not identical purposes (approval issuers back one narrow signal claim; upstream-authorization issuers would back the whole request envelope). Provisioning, if a new registry, should follow the same established pattern as `createApprovalIssuerRegistry.ts` and `createConnectorAuthenticator.ts`: a hardcoded array of issuer entries plus PEM key files under `PARMANA_KEY_DIR`, generated out-of-band and never committed — not an env-var JSON blob, and never a private key checked into source, even for a test/dev issuer (see `vitest.setup.ts` for how this repo generates ephemeral test keys instead).

```typescript
export interface UpstreamAuthorizationIssuer {
  id: string;
  publicKey: string; // loaded from a PEM file, never inlined in source
  allowedActions: string[];
  description?: string; // e.g., "Risk service", "Compliance system", "OAuth provider"
}

export class UpstreamAuthorizationIssuerRegistry {
  private issuers: Map<string, UpstreamAuthorizationIssuer>;

  constructor(issuers: UpstreamAuthorizationIssuer[]) {
    this.issuers = new Map(issuers.map(i => [i.id, i]));
  }

  public getIssuer(id: string): UpstreamAuthorizationIssuer | undefined {
    return this.issuers.get(id);
  }
}

export function createUpstreamAuthorizationIssuerRegistry(): UpstreamAuthorizationIssuerRegistry {
  // Empty by default -- fail-closed starting state, same rationale as
  // createApprovalIssuerRegistry.ts's TRUSTED_APPROVAL_ISSUERS.
  const issuers: UpstreamAuthorizationIssuer[] = [];

  return new UpstreamAuthorizationIssuerRegistry(issuers);
}
```

#### 3. Wire into the caller-auth boundary

Extending `BusinessTransactionValidator` (`packages/runtime`) directly, as an earlier draft of this spec suggested, would pull HTTP/JWT concerns into a package that currently has none — `packages/runtime` depends only on `@parmana/policy`, `@parmana/crypto`, `@parmana/shared`, `@parmana/execution-system`. The more consistent placement is a new check in `packages/api/src/routes/execute.ts` (and `/transactions`, for parity — see NF-004), alongside the existing `isPrincipalAllowed`/`isCapabilityAllowed` checks, running before `application.execute()` is ever called:

```typescript
// In execute.ts, alongside the existing isPrincipalAllowed/isCapabilityAllowed checks:
if (req.body.upstreamAuthorization !== undefined) {
  try {
    const verified = await upstreamAuthorizationVerifier.verify(
      req.body.upstreamAuthorization,
      transaction.intent.action,
      transaction.intent.target,
      transaction.intent.parameters?.amount,
    );
    // attach `verified` to transaction.metadata or a new field for
    // BusinessTrustRecordBuilder to pick up -- see NF-003's precedent
    // for how `authorization` was added to ExecutionTrustRecord.
  } catch (error) {
    // audit + reject, mirroring caller.principal_denied /
    // caller.capability_denied's existing pattern
  }
}
```

#### 4. Persist in Trust Record

Following NF-003's precedent exactly (`ExecutionTrustRecord.authorization`, `packages/shared/src/domain/execution-trust-record.ts`): add an optional field, include it in `VerificationCrypto.canonicalRecord()` (`packages/crypto/src/VerificationCrypto.ts`) so it's covered by the hash/signature without breaking any existing record's verification (an absent field serializes identically to today, per `CanonicalSerializer`'s handling of `undefined`), and add the matching Supabase column via a new migration + `SupabaseExecutionTrustRecordRepository` update.

```typescript
export interface ExecutionTrustRecord {
  // ... existing fields ...
  readonly authorization?: SignedExecutionAuthorization;   // NF-003, implemented (commit 6303801)
  readonly upstreamAuthorization?: VerifiedUpstreamAuthorization; // NF-001, this spec
}
```

---

## Decision Gates

### Gate 1: Is a delegation scenario real?

**Triggers:** Customer request, regulatory requirement, or architectural decision

**Questions:**
- Are you doing multi-party approval (risk team, compliance, etc.)?
- Are you integrating with external authorization sources?
- Do you need independent proof of approval in audit trail?

**Decision:** If any "yes", proceed to Gate 2.

### Gate 2: Who are the upstream issuers?

**Triggers:** After Gate 1 is "yes"

**Scope:** Determine actual issuers and get their keys/certificates; decide token format (JWT vs. a Parmana-native signed envelope matching `SignedExecutionAuthorization`'s own shape, which would let this reuse `@parmana/crypto`'s existing verifier primitives instead of a new JWT-parsing dependency).

**Examples:**
- Risk service (internal or vendor)
- Compliance system
- OAuth/SAML provider
- Human approver with digital signature capability (`@parmana/approval`'s existing pattern, if the scope fits within "one signal claim" rather than "the whole request")

**Decision:** Once issuers are identified, design issuer provisioning and key management (see `createApprovalIssuerRegistry.ts` for the established pattern to follow).

### Gate 3: Mandatory or optional?

**Triggers:** After Gate 2

**Decision:**
- **Mandatory:** All requests require upstream authorization (fail if missing)
- **Optional:** Some requests have upstream auth, some don't (verification only if present)

---

## Implementation Roadmap (When Needed)

**Phase 1:**
- Create `UpstreamAuthorizationVerifier` (`packages/api/src/auth/`)
- Create issuer registry (new, or extend `@parmana/approval`'s — decide at Gate 2)
- Wire into `execute.ts` and `transactions.ts` at the caller-auth boundary
- Add `upstreamAuthorization` field to the request body / schema

**Phase 2:**
- Add `upstreamAuthorization` to `ExecutionTrustRecord`, following NF-003's exact precedent (canonical-record inclusion, Supabase migration + repository update)

**Phase 3:**
- Wire issuer provisioning and key management
- Add issuer rotation/revocation logic (mirroring `TrustedApprovalIssuer.revoked`)
- Integration tests for all failure modes

**Total effort:** Roughly a day once Gates 1-2 are resolved; the open design question (reuse `@parmana/approval`'s issuer registry vs. a new one) should be settled before estimating precisely.

---

## Test Plan (When Implemented)

```
Valid upstream authorization -> proceeds
POST /execute with valid risk-service signature -> accepted

Forged signature -> rejected
POST /execute with forged signature -> 403 before policy evaluation

Expired authorization -> rejected
POST /execute with expired upstream auth -> 403 before policy evaluation

Scope mismatch -> rejected
POST /execute with auth for amount $500k, but requesting $1M -> 403

Unknown issuer -> rejected
POST /execute with unknown issuer ID -> 403

Missing required upstream auth -> rejected (if mandatory)
POST /execute without upstream auth (when required) -> 403

Trust record includes verified upstream auth
Load trust record from storage -> includes verified issuer/scope/expiry
```

(403, not 401, matching this codebase's existing convention for caller-scoping denials -- e.g. `caller.principal_denied`/`caller.capability_denied` both respond 403, not 401; 401 is reserved for caller-auth itself failing, per `middleware/caller-auth.ts`.)

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Upstream issuer key compromise | Issuer rotation, revocation, key versioning |
| Clock skew (expiry validation) | Clock tolerance window (e.g., +/-5 min) |
| Authorization scope creep | Strict scope validation (action, target, amount boundaries) |
| Issuer proliferation | Documented issuer registry, audit trail |
| Integration complexity | Gradual rollout (optional first, then mandatory) |

---

## Backward Compatibility

- `upstreamAuthorization` is optional in the request body
- Trust records without upstream auth still load and verify (same additive-field pattern NF-003 already proved works, via `CanonicalSerializer`'s handling of absent/`undefined` fields)
- Policy evaluation path unchanged if upstream auth not present
- Can be toggled per-route or per-environment

---

## Future Enhancements

- **Issuer federation:** Support authorization chains (issuer A trusts issuer B)
- **Delegation scoping:** Issuer can say "only for targets matching pattern X"
- **Authorization refresh:** Long-lived authorizations with refresh tokens
- **Multi-issuer approval:** Require authorization from multiple issuers
- **Time-bound approvals:** Authorization valid only within specific time windows

---

## Decision Log

**Sep 7, 2026 — Decision: Table NF-001 (not implemented now)**
- Rationale: No current customer delegation scenario
- Next trigger: Real customer request, regulatory requirement, or architectural decision
- Reference: this file

**Sep 7, 2026 — Related work landed the same day, for context:**
- NF-003 (persist signed execution authorization in trust records) — implemented, commit `6303801`
- NF-004 (POST /transactions capability-grant parity with POST /execute) — implemented, commit `7da8f0d`
- NF-005 (HubSpot approval issuer provisioning) — **not implemented**; `TRUSTED_APPROVAL_ISSUERS` remains an empty array by design (`packages/api/src/bootstrap/createApprovalIssuerRegistry.ts`). A dev-only issuer was proposed and declined in this session because it would have required committing a private key into source, used by real verification logic — inconsistent with this repo's existing convention of generating ephemeral test keys at test-run time (see `vitest.setup.ts`). Provisioning a real issuer, or a safely-ephemeral dev one, remains an open decision.

---

## References

- NF-003, NF-004, NF-005 are recorded as git commits (see Decision Log above), not standalone documents — this repo tracks that work in commit history and PR description, not a separate per-finding markdown file.
- `packages/api/src/bootstrap/createApprovalIssuerRegistry.ts` — the narrower, already-implemented sibling mechanism (see "A related, narrower mechanism that already exists" above).
- `packages/runtime/src/validators/BusinessTransactionValidator.ts` — the current linkage-only check this spec would extend.
