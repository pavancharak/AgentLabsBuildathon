# Chapter 15 — Audit and Evidence Trails

`packages/shared/src/domain/refusal-record.ts`, `packages/api/src/auth/CallerAuditSink.ts`,
`packages/approval/src/{ApprovalVerifier,ApprovalScopeEvaluator}.ts`.

## Refusal records: proof of what didn't happen

`RefusalRecord` (RFC-0021) exists for the same reason `ExecutionTrustRecord` exists for
approvals: an `APPROVED` decision produces a durable, signed, independently verifiable
artifact, so a `REJECTED` one should too — otherwise "what was refused, and why" only lives
in whatever the caller's own logs happened to capture. Its `decision` field is deliberately
"not summarized or reconstructed" — the exact same `Decision` object `RuntimeEngine` already
built before `ExecutionGate.enforce()` threw, byte for byte. `RuntimeEngine` (Chapter 5)
writes this best-effort, on a distinct principle worth restating: a refusal-record write
failure is logged and swallowed, never allowed to block or alter the enforcement outcome
itself, because "the refusal itself must never depend on its own evidence being writable" —
evidence depends on the refusal, never the reverse. `POST /refusal/verify` closes the same
gap for third-party verification that `POST /verify` closes for approvals: given a refusal
record and its signature, verify it without trusting Parmana's database at all.

## Caller-authentication audit: fail-closed, covered in Chapter 13

`CallerAuditSink` and its fail-closed write discipline (`recordCallerAuditEvent`,
`AuditUnavailableError`) are covered in full in Chapter 13, since they're inseparable from
the scoping mechanism they audit. `POST /audit/verify` is the third-party verification
counterpart here: it structurally checks (`type`/`occurredAt`/`route` present) and verifies
the signature of any signed audit event handed to it, generically — not restricted to one
named event-type union — so it keeps working as new `CallerAuditEvent` variants get added
(`caller.non_human_denied`, `caller.principal_denied`, and whatever comes next) without
needing its own update each time.

## Signed Approval Artifacts: an independent business authority, not Parmana's own key

An `Authorization` (Chapter 1) proves Parmana approved a `Decision`. It cannot truthfully
represent that some *other*, independent business authority approved an *exception* to
Parmana's own rules — a manager overriding a threshold, say. `SignedApproval`
(`packages/shared/src/domain/approval-artifact.ts`) exists for exactly that: a cryptographic
attestation, signed by an external issuer's own key (never Parmana's runtime key, never the
caller), that a specific numeric or exact-match fact about a specific capability and resource
has been approved. Trust chain: Business Approval → `ApprovalPayload` → canonical
serialization → the issuer's own signature → `ApprovalVerifier` → the verified fact overwrites
whatever the caller itself declared for that signal.

`ApprovalVerifier.verify()` runs nine checks, in this fixed order, deliberately mirroring
`EnvelopeVerifier`'s own side-effect-last discipline (Chapter 7):

```
versionSupported → issuerKnown → signatureVerified → notExpired → notRevoked
  → capabilityMatches → resourceMatches → scopeSatisfied → nonceUnseen
```

`scopeSatisfied` delegates to `ApprovalScopeEvaluator`, supporting `eq`/`lte`/`gte`/`lt`/`gt`/
`between` comparisons against the approved value. `nonceUnseen` is checked last, consumed
only if all eight prior checks passed — so a rejected artifact never burns its single use,
the identical reasoning `EnvelopeVerifier`'s nonce ordering uses. `valid = priorChecksPassed
&& nonceUnseen`.

The one wired production consumer is HubSpot's `HubSpotSignalStateVerifier`
(`verifyPreAuthorization`): it checks a caller's declared `preAuthorizedForAmountChange`
against a real `SignedApproval`, using the amount delta the verifier itself *independently
re-derives* — not the caller's declared value — as the value checked against the approval's
scope, specifically so a genuine small-amount approval can't be replayed to cover a larger
change it was never actually issued for. `createApprovalIssuerRegistry.ts` currently ships
`TRUSTED_APPROVAL_ISSUERS = []` — fail-closed by default; no real approver key is provisioned
in this codebase as of this writing, so every approval claim is structurally rejected until
one is.
