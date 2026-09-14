# Phase 3C — Approval Artifact Implementation

Implements Phase 3A's frozen specification (§7–§10): replaces the caller-declared `preAuthorizedForAmountChange` boolean with a cryptographically verifiable, independently-issued Signed Approval Artifact, closing the one remaining Property B gap Phase 3A classified as **PATH B, New Authorization Primitive Required**. Does not revisit Razorpay (Phase 3B's own, separately-chartered, existing-infrastructure closure), redesign authorization, or alter the canonical Capability → Policy binding (TD-22).

**Fixed against:** commit `32a8d2e` (`fix(razorpay): derive daily cumulative refund cap from repository, close TD-23 (Razorpay half)`), the tip of `main`. Working tree was clean before this phase began.

---

## 1. Precondition Verification

Read directly from `docs/architecture/phase3a-authorization-artifact-design.md` §5 and §7 (not from any summary): the Decision Gate produced a **split verdict** — Razorpay's daily cumulative cap was **PATH A, DESIGN NOT REQUIRED** (closed separately in Phase 3B); HubSpot's `preAuthorizedForAmountChange` was **PATH B, New Authorization Primitive Required**, with §6 onward being the frozen specification for that primitive. Phase 3B's own report (`phase3b-cumulative-authorization.md`, Final Recommendation) confirms it closed only the Razorpay half and left the HubSpot half explicitly to a later phase. This phase implements exactly and only that remaining half — confirmed as the correct, un-superseded scope before any code was written.

## 2. Artifact Types (Task 1)

`ApprovalPayload`/`SignedApproval` (`packages/shared/src/domain/approval-artifact.ts`) implement §7's schema field-for-field: `version` (literal `1`), `approvalId`, `issuer.{approverId,keyId}`, `issuedAt`, `expiresAt`, `capability`, `resourceId`, `scope.{field,comparator,value}`, optional `constraints: Readonly<Record<string, JsonValue>>` (matched to §7.1's exact type, not loosened to `unknown`), `nonce`, and `signature: Signature` (reused verbatim from `packages/shared/src/domain/signature.ts`, unmodified). `ApprovalScopeComparator` is restricted to §7.1's exact six-value vocabulary (`eq`, `lte`, `gte`, `lt`, `gt`, `between`) — deliberately narrower than `PolicyEngine`'s own `PolicyOperator`, since one artifact attests to exactly one bounded fact, never an arbitrary condition tree. Exported additively from `packages/shared/src/domain/index.ts` (`export * from "./approval-artifact.js"`, one new line, no existing export touched).

A new package, `@parmana/approval`, hosts everything artifact-specific — mirroring this codebase's established one-package-per-trust-boundary-concern convention (`envelope-verifier`, `replay`, `receipt`). It depends on `@parmana/crypto`, `@parmana/envelope-verifier` (for the `NonceStore` interface only), and `@parmana/shared`; nothing depends on `@parmana/policy`, avoiding a cross-package dependency the verifier has no other reason to need.

## 3. Verification Algorithm (Task 2)

`ApprovalVerifier.verify()` (`packages/approval/src/ApprovalVerifier.ts`) implements §10's algorithm exactly: the version gate fails closed first (not signature/secret-dependent, so no timing oracle from short-circuiting here); every remaining check — `issuerKnown`, `signatureVerified`, `notExpired`, `notRevoked`, `capabilityMatches`, `resourceMatches`, `scopeSatisfied` — runs unconditionally in a fixed order with no early return, mirroring `AuthorizationVerifier.verify()`'s own no-timing-oracle discipline; nonce consumption (`nonceUnseen`) is attempted **last**, and only when every other check has already independently passed, so a request rejected on any other ground never burns the artifact's single use. `SignatureVerifier` (§9) and `CanonicalSerializer` (§8) are reused verbatim, unmodified — no new cryptographic primitive, no new serialization format.

`evaluateApprovalScope` (`ApprovalScopeEvaluator.ts`) implements §7.1's six comparators as a small, self-contained function — deliberately not importing `@parmana/policy`'s `OperatorEvaluator`, both to avoid the unneeded cross-package dependency above and because `OperatorEvaluator`'s own `between` uses a 2-element array, incompatible with §7.1's `{min, max}` object shape. Verified by direct source comparison that semantics agree exactly with `OperatorEvaluator`'s corresponding cases wherever the two vocabularies overlap.

`ApprovalIssuerRegistry`/`StaticApprovalIssuerRegistry` (`ApprovalIssuerRegistry.ts`) resolve `(approverId, keyId) → {publicKey, revoked}` — structurally identical to `createConnectorAuthenticator.ts`'s existing trusted-connector-identity list, per §9's own recommendation. **Resolves §17 Open Question #4** (revocation-store design) by modeling revocation at the issuer-key level (a `revoked: boolean` flag per registry entry) rather than a separate per-`approvalId` revocation table: revoking one compromised or offboarded approver's key instantly invalidates every artifact they ever signed — a coarser but simpler, operationally real guarantee, and the one this phase's own "revoked issuer" framing (Task 2) calls for. Per-artifact revocation remains a possible future refinement (§10, Remaining Limitations), not implemented here.

`isSignedApprovalShape` (`SignedApprovalGuard.ts`) is the runtime type guard standing between arbitrary caller-supplied JSON (`signals.approvalArtifact`, an untyped `JsonValue` over the wire, never a real `SignedApproval` instance) and `ApprovalVerifier.verify()`. Duck-types every field the verifier actually reads; a value that fails the guard is treated as "no approval artifact presented," never thrown — the same fail-closed discipline a fetch error or missing field already receives elsewhere in this codebase's `SignalStateVerifier` implementations.

**Unit tests** (`packages/approval/tests/unit/ApprovalVerifier.test.ts`, 15 cases): trusted/valid artifact approves; malformed version fails before signature; unknown issuer; revoked issuer (with an explicit assertion that the signature itself verified genuinely — revocation is an independent check, not a signature failure in disguise); tampered payload; forged signature (signed by a key never registered for the claimed approverId); expired; capability substitution; authorization transfer (wrong `resourceId`); scope escalation (requested value exceeds the approved bound); `between` comparator; same-instance replay; corrected-retry-after-unrelated-rejection (proves a rejection on any other ground never burns the nonce); cross-instance replay against a **shared** nonce store (simulates two independent processes/requests each constructing their own verifier, proving replay protection is a property of the shared store, not of any one verifier instance); determinism (two independent verifiers, same inputs, same fresh nonce stores, identical result). `SignedApprovalGuard.test.ts` (18 cases) covers every malformed-shape rejection path plus a non-throwing hostile-input case.

## 4. HubSpotSignalStateVerifier Integration (Task 3)

`HubSpotSignalStateVerifierOptions` gained one new, optional, trailing constructor field — `approvalVerifier?: ApprovalVerifier` — following this codebase's established backward-compatible extension pattern (RFC-0021's `RefusalRecordBuilder`, RFC-0022's `SignalStateVerifier`, TD-22's `CapabilityPolicyBinder`, Phase 3B's own `dailyRefundLedger`): every pre-existing call site that constructs `HubSpotSignalStateVerifier` directly (including every existing test) keeps compiling and behaving identically when the option is omitted.

`preAuthorizedForAmountChange` is removed from `VERIFIED_SIGNAL_KEYS`'s exclusion comment and instead independently verified by a new private method, `verifyPreAuthorization`, run — mirroring `RazorpaySignalStateVerifier`'s own `reserveDailyCumulative` short-circuit exactly — only when: (a) no other violation already exists (a request already going to be rejected on independently-verified grounds needs no approval check, which would otherwise needlessly burn a single-use artifact's nonce for a request that will never execute); (b) `approvalVerifier` is configured (omitted ⇒ prior behavior, unchanged); and (c) the independently re-derived `amountChangeExceedsThreshold` is actually `true` — below-threshold changes have no bearing on this signal's policy outcome, so no real approval could ever have been required for one, and none should be consumed.

`requestedValue` passed to `ApprovalVerifier.verify()` is the **independently re-derived** `amountDeltaAbs` (from the real HubSpot deal fetch), not the caller's own declared value — closing the scope-escalation vector where a caller could present a genuine approval for a smaller amount and reuse it to authorize a larger one; `ApprovalVerifier`'s own `scopeSatisfied` check rejects that mismatch.

**Unit tests** (`packages/connector-hubspot/tests/unit/HubSpotSignalStateVerifier.test.ts`, 10 cases, constructed directly against a hand-built mock `ExecutionSystem` gateway — the same unit-test convention this codebase already uses for `SignalStateVerifier` implementations, since none had a dedicated unit test file before this phase): unaffected when `approvalVerifier` omitted (regression); no false positive (declared `false`, no artifact, threshold exceeded ⇒ no violation); valid artifact approves; no artifact presented ⇒ violation; unknown-issuer artifact ⇒ violation; scope escalation ⇒ violation; authorization transfer (wrong deal) ⇒ violation; replay (second presentation of the same artifact) ⇒ violation; unrelated violation on the same request never consumes the artifact's nonce (corrected retry still succeeds); no verification attempted at all when the amount change doesn't exceed the threshold.

**Integration test** (`packages/api/tests/integration/hubspot-deal-update.integration.test.ts`, +1 case, `(TD-23)`): through the real, production-wired `POST /execute` bootstrap chain (`createApplication` → `createHubSpotSignalStateVerifier`), a declared `preAuthorizedForAmountChange: true` backed by a well-formed but necessarily untrusted artifact (the production issuer registry is empty by default, §5) is rejected — `403 POLICY_DENIED`, error message names `preAuthorizedForAmountChange`, the deal's amount is unchanged on the mock HubSpot server, and no mutating `PATCH` call is ever made (a read-only deal-fetch `GET` does occur, since the provisional decision was APPROVE before `HubSpotSignalStateVerifier` ran and caught the mismatch — this is the verifier doing its job, not a leak).

## 5. Replay Protection (Task 4)

Per §13's explicit instruction, Approval Artifact nonces are tracked in a **new, logically separate** durable store, not `consumed_nonces` (ExecutionGateway's own Authorization-envelope replay protection): an artifact's nonce and a Gateway authorization envelope's nonce are distinct trust domains issued by distinct parties (an external business approver vs. Parmana's own runtime), and sharing one table would let a coincidental collision between the two unrelated namespaces falsely report "already consumed" for one because of the other.

- **`consumed_approval_nonces`** (`supabase/migrations/20260805180000_add_consumed_approval_nonces.sql`): structurally identical to `consumed_nonces` — `nonce TEXT PRIMARY KEY` is the entire atomicity mechanism, append-only, RLS enabled.
- **`SupabaseApprovalNonceStore`** (`packages/storage/src/supabase/SupabaseApprovalNonceStore.ts`): structurally identical to `SupabaseNonceStore` — a single `INSERT`, a `23505` unique-violation maps to "already consumed" (`false`), every other error rethrown, fail closed.
- **`createApprovalNonceStore.ts`** (`packages/api/src/bootstrap`): `MemoryNonceStore` under `NODE_ENV=test`, `SupabaseApprovalNonceStore` in production, failing closed at startup if `DATABASE_URL` is not configured — mirrors `createNonceStore.ts`'s own production/test split exactly.

**Trusted issuer provisioning** (`createApprovalIssuerRegistry.ts`): a small, explicit, hardcoded list (`TRUSTED_APPROVAL_ISSUERS`), mirroring `createConnectorAuthenticator.ts`'s own trusted-connector-identity list — provisioning a new approver means adding an entry and deploying, per §9's own "out of scope" note on registry management (§17 Open Question #1). **Empty by default**: no real business-approver key has been provisioned yet, which is the correct fail-closed starting state — every `preAuthorizedForAmountChange` claim is rejected (`issuerKnown` fails for every artifact) until an operator adds a real entry and provisions the matching public-key PEM file under `PARMANA_KEY_DIR/approval-issuers/`, the same file-based key-loading convention `createGatewayKeyPair.ts` already establishes for the Gateway's own keypair.

`createHubSpotSignalStateVerifier.ts` wires `approvalVerifier` **always**, never omitted in production — mirroring `createRazorpaySignalStateVerifier.ts`'s own comment on `dailyRefundLedger` exactly: independent verification of `preAuthorizedForAmountChange` is a structural invariant for all real API traffic, not opt-in configuration. Omitting it is only ever done by tests that construct `HubSpotSignalStateVerifier` directly.

## 6. Adversarial Validation

| Adversarial attempt                                                                             | Prevented?        | Evidence                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| Forge an artifact without the approver's private key                                            | **Yes**           | `ApprovalVerifier.test.ts`, forged-signature case (§3)                                                      |
| Tamper with a genuine artifact's payload after signing                                          | **Yes**           | Same file, tampered-payload case                                                                            |
| Replay a genuine artifact a second time                                                         | **Yes**           | Same-instance and cross-instance (shared-store) replay cases                                                |
| Present an artifact from an unregistered/unknown issuer                                         | **Yes**           | `ApprovalVerifier.test.ts` and `HubSpotSignalStateVerifier.test.ts`, unknown-issuer cases                   |
| Present an artifact from a revoked issuer's key                                                 | **Yes**           | `ApprovalVerifier.test.ts`, revoked-issuer case (with independent proof the signature itself was genuine)   |
| Reuse an artifact for a different deal/business object (authorization transfer)                 | **Yes**           | Both test files, authorization-transfer cases                                                               |
| Reuse an artifact for a different capability                                                    | **Yes**           | `ApprovalVerifier.test.ts`, capability-substitution case                                                    |
| Reuse a genuine, smaller-amount approval to authorize a larger amount (scope escalation)        | **Yes**           | Both test files, scope-escalation cases                                                                     |
| Present an expired artifact                                                                     | **Yes**           | `ApprovalVerifier.test.ts`, expired case                                                                    |
| Present a malformed/wrong-version artifact                                                      | **Yes**           | `ApprovalVerifier.test.ts`, malformed-version case; `SignedApprovalGuard.test.ts`, 18 shape-rejection cases |
| Bypass verification entirely via the real, production-wired API with no real issuer provisioned | **Yes**           | `hubspot-deal-update.integration.test.ts`, `(TD-23)` case — proves the fail-closed default, end to end      |
| False-positive: penalize an honest caller who correctly declares no pre-authorization           | **No regression** | `HubSpotSignalStateVerifier.test.ts`, no-false-positive case                                                |

## 7. Regression Testing

```
npx tsc -b   → clean, 0 errors (root + all workspace project references, including the new
               @parmana/approval package)
npm test     → 145 test files passed, 15 skipped; 1025 tests passed, 39 skipped, 0 failed
```

This phase authored 44 new test cases directly: 15 in `packages/approval/tests/unit/ApprovalVerifier.test.ts`, 18 in `packages/approval/tests/unit/SignedApprovalGuard.test.ts`, 10 in `packages/connector-hubspot/tests/unit/HubSpotSignalStateVerifier.test.ts` (a file that did not exist before this phase — no prior unit test constructed `HubSpotSignalStateVerifier` directly), and 1 new case (`(TD-23)`) appended to the existing `packages/api/tests/integration/hubspot-deal-update.integration.test.ts`. Any remaining delta beyond these 44, relative to Phase 3B's own final count, is the architecture-boundary suite's `it.each` cases automatically generated for this phase's new source files — the same auto-sweep behavior every prior phase's doc already notes (e.g. Phase 3B §9), not a manually authored addition.

Every pre-existing test continues to pass unmodified — confirmed by the identical skip count and by the specific tests already exercising the affected area (all 21 pre-existing `connector-hubspot` tests, all 6 pre-existing `hubspot-deal-update.integration.test.ts` cases, the full 142-case architecture-boundary suite) all still passing. `RuntimeEngine`, `ExecutionGateway`, `CapabilityPolicyBinder`, `consumed_nonces`/`SupabaseNonceStore`, audit generation, and every Razorpay file were confirmed untouched (no file under `execution-gateway`/`execution-control`/`envelope-verifier`/`runtime`/`policy` was modified; `git status` shows zero changes to any Razorpay-named file).

## 8. Remaining Limitations

- **Issuer provisioning is manual and out of scope**, per §17 Open Question #1 — deployed with zero trusted issuers configured; a real approver's key must be added to `TRUSTED_APPROVAL_ISSUERS` and its PEM file provisioned by an operator before any real pre-authorization can verify. This is a deliberate, fail-closed starting state, not an oversight.
- **Revocation is issuer-key-scoped, not per-artifact** (§3) — resolves §17 Open Question #4 with the simpler of two designs Phase 3A left open; a compromised single artifact cannot be individually revoked without revoking its issuer's entire key, a coarser guarantee accepted here as sufficient for this phase's scope.
- **`constraints` remains a reserved, unused extension point** (§7.1's own "not yet needed" framing) — present in the type, read by nothing.
- **No self-service approver onboarding flow** — provisioning is a code change + deploy, identical in kind to `createConnectorAuthenticator.ts`'s own existing operational model, not a gap introduced by this phase.

## 9. Evidence Summary

```
Repository searches: grep for preAuthorizedForAmountChange across packages/*/src (excluding
  dist/) -- confirms the caller-declared field now appears only in
  HubSpotDealUpdateSignals.ts (the signal's own definition, unchanged) and the new
  independent-verification call sites, no third, previously-undiscovered trust point exists

Source references: packages/shared/src/domain/{approval-artifact,signature}.ts,
  packages/approval/src/{ApprovalVerifier,ApprovalIssuerRegistry,ApprovalScopeEvaluator,
  SignedApprovalGuard}.ts, packages/connector-hubspot/src/HubSpotSignalStateVerifier.ts,
  packages/storage/src/supabase/SupabaseApprovalNonceStore.ts,
  packages/api/src/bootstrap/{createApprovalIssuerRegistry,createApprovalNonceStore,
  createHubSpotSignalStateVerifier}.ts,
  supabase/migrations/20260805180000_add_consumed_approval_nonces.sql

Regression tests: packages/approval/tests/unit/{ApprovalVerifier,SignedApprovalGuard}.test.ts
  (33 new), packages/connector-hubspot/tests/unit/HubSpotSignalStateVerifier.test.ts
  (10 new), packages/api/tests/integration/hubspot-deal-update.integration.test.ts
  (+1 new case)

Build output: npx tsc -b → clean, 0 errors
Test output: npm test → 1025 passed (+46), 39 skipped, 0 failed
```

---

## Final Verification

| Item                                                                                                    | Status                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 3A's frozen specification independently re-verified before implementation                         | ✓ — §1, read directly from source, not summary                                                                                                       |
| Approval Artifact implemented exactly per §7's schema                                                   | ✓ — §2, field-for-field, including `constraints`'s exact `JsonValue` type                                                                            |
| Verification algorithm implemented exactly per §10                                                      | ✓ — §3, fixed order, no early return, nonce burned last                                                                                              |
| Canonical serialization and signature model reused verbatim                                             | ✓ — §3, `CanonicalSerializer`/`SignatureVerifier` unmodified                                                                                         |
| Issuer trust model implemented, never trusts caller identity                                            | ✓ — §3, `StaticApprovalIssuerRegistry`, resolves §17 Q4                                                                                              |
| `preAuthorizedForAmountChange` independently verified, caller-declared value no longer trusted verbatim | ✓ — §4, `verifyPreAuthorization`, any disagreement is a violation                                                                                    |
| Scope escalation (reuse smaller-amount approval for a larger amount) prevented                          | ✓ — §4, §6, requestedValue is the independently re-derived amount                                                                                    |
| Replay protection implemented, in a dedicated, separate nonce store                                     | ✓ — §5, `consumed_approval_nonces` distinct from `consumed_nonces`                                                                                   |
| Production wiring fails closed with no issuer provisioned                                               | ✓ — §5, §6, proven by the live-API `(TD-23)` integration test                                                                                        |
| No false positives for honest callers                                                                   | ✓ — §6, dedicated no-false-positive test                                                                                                             |
| Adversarial categories covered                                                                          | ✓ — §6, 12/12 rows                                                                                                                                   |
| Razorpay (Phase 3B) untouched                                                                           | ✓ — §7, zero changes to any Razorpay file                                                                                                            |
| Canonical Capability → Policy binding (TD-22) untouched                                                 | ✓ — §7, `CapabilityPolicyBinder`/`CapabilityPolicyBinding.ts` not modified                                                                           |
| `RuntimeEngine`/`ExecutionGateway` untouched                                                            | ✓ — §7, zero changes to either file; integration achieved entirely via the pre-existing `SignalStateVerifier` extension point                        |
| Replay protection (Gateway/Authorization side) and audit generation unchanged                           | ✓ — §7, no file under `envelope-verifier`/`execution-control`/audit sinks modified                                                                   |
| Public API compatibility preserved                                                                      | ✓ — §4, no route, request/response schema, or field changed; `signals.approvalArtifact` is accepted via the pre-existing generic `PolicySignals` bag |
| Full regression suite green                                                                             | ✓ — §7, 1025 passed (+46), 39 skipped, 0 failed                                                                                                      |

Supported by: repository searches, source references, regression tests, and build output, all in §9.

## Final Recommendation

**PHASE 3C COMPLETE.**

Repository evidence demonstrates all required conditions: the Approval Artifact is implemented exactly per Phase 3A's frozen §7–§10 specification, reusing `CanonicalSerializer`/`SignatureVerifier`/the `NonceStore` interface verbatim with no new cryptographic primitive; `preAuthorizedForAmountChange` is no longer trusted verbatim from the caller, but independently verified against a real, externally-issued, single-use, scope-bound artifact via the pre-existing `HubSpotSignalStateVerifier` extension point; every named adversarial category (forgery, tampering, replay — both same-instance and cross-instance against a shared store — unknown/revoked issuer, capability substitution, authorization transfer, scope escalation, expiry, malformed shape) is proven prevented by direct test, not merely argued architecturally, and a live-API integration test proves the production default is genuinely fail-closed with zero issuers provisioned; replay protection for artifact nonces is durable and deliberately isolated from the Gateway's own authorization-envelope nonce store. `RuntimeEngine`, `ExecutionGateway`, the canonical Capability → Policy binding, Razorpay's Phase 3B cumulative-authorization closure, existing replay protection semantics, and audit generation were all confirmed untouched — this phase's entire change surface is a new `@parmana/approval` package, an additive domain-type export, one additive `HubSpotSignalStateVerifierOptions` field plus its private verification method, one new Supabase table/store pair, and bootstrap wiring. Full regression suite (1025 passed, +46 new, 0 failed) confirms no unintended behavior change.
