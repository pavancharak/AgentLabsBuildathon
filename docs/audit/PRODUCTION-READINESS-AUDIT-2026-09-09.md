# Parmana-exp Production-Readiness Audit — 2026-09-09

**Method:** direct code reading of the actual repository at `D:\last\parmana-exp` (commit `6ca88c4` at the time of writing), not a fresh clone and not drawn from model memory. Run against a prompt template requesting verification of 5 critical claims, 4 "known findings," and a structural (dead-code/naming) audit. Several items in that template were checked against current code and found stale or mislabeled — corrected in place below rather than repeated uncritically.

---

## Executive Summary

**🟢 PRODUCTION-READY**, as of the same-day fixes below. All 5 critical claims hold structurally, with evidence. Of the template's 4 "known findings," 2 are already fixed (contrary to the template's "not yet fixed" framing), 1 is accurate, and 1 (PostgREST bypass) is real but **broader** than the template describes (documented, not a code change). Every actionable finding from this audit was fixed the same day: Claim 3's `boundSignals` coverage gap across all 10 real policies (G-33), and the dead-code findings — `SupabaseClientFactory`, `assertSupabaseConfigured.ts`, and `packages/audit.txt` (G-34). Only remaining open item is documentation-only (the PostgREST scope note, now itself corrected in `docs/CLAIMS.md` §3.11).

---

## Claim Verification (5 Critical Claims)

### Claim 1: Credential Isolation

**Statement:** AI agents never hold or directly exercise execution credentials; credentials exist transiently inside Parmana and are revoked immediately after use.

**Status:** ✅ VERIFIED

**Evidence:** `SessionCredentialSecureConnector.execute()` (`packages/execution-control/src/SessionCredentialSecureConnector.ts:70-117`) — issue → consume (once) → execute → `finally { revoke() }`. `SessionCredentialVault.issue()` explicitly discards the resolved secret (only confirms existence); `consume()` is the sole method that ever returns it, and only once (`SessionCredentialVault.ts:57-103`). The caller receives only `ExecutionTrustRecord`/`ExecutionResult` — grep for any response path returning a raw credential: zero hits. Test: `packages/api/tests/integration/credential-isolation.integration.test.ts` explicitly proves a credential is revoked in a `finally` block on every exit path, including when the executor itself throws.

**Gaps:** None found.

**Severity:** N/A (verified true)

### Claim 2: One-Time Use Enforcement

**Statement:** Each credential can only be used once; replay attacks are prevented by nonce tracking and revocation.

**Status:** ✅ VERIFIED

**Evidence:** `SessionCredentialVault.consume()` throws `"has already been used"` on a second call (`used` flag set before returning) and `"has been revoked"` after `revoke()` (`SessionCredentialVault.ts:86-111`). `GatewaySessionStore.consume()` independently enforces single-use at a layer above, checking `!record.used` plus content-hash/authorization-hash/session-field equality before setting `used = true` (`GatewaySessionStore.ts:92-135`) — read directly; it's a real check, not a decrementing counter. Replay test: `credential-isolation.integration.test.ts` asserts a second `consume()` call rejects with `/has been revoked/`.

**Severity:** N/A (verified true)

### Claim 3: Scope Drift Detection (boundSignals)

**Statement:** Parmana detects scope drift by binding execution authorization to specific transaction facts (boundSignals); a transaction modified after authorization is rejected.

**Status:** ✅ VERIFIED (originally 🟡 PARTIAL at audit time; the coverage gap found here was fixed same-day — see `docs/VERIFICATION-GAPS.md` G-33)

**Evidence:** `SignalIntentBinder` is a required, non-optional constructor dependency of `RuntimeEngine` (throws `"SignalIntentBinder is required"` if omitted — `RuntimeEngine.ts:170-171`), called before authorization is signed (`RuntimeEngine.ts:317`).

**Original finding, as discovered:** running the real `vendor-payment` policy through the runtime (via Tutorial 105) logged `policy_boundSignals_coverage_incomplete` with 5 uncovered facts (`vendorVerified`, `invoiceVerified`, `paymentApproved`, `sufficientFunds`, `riskScore`) — this was the framework's own built-in warning, advisory-only (`PolicyRouter.load()` logged it but never threw). Checking all 10 real policies in `policies/` at that point showed **every single one** had uncovered facts, none ever reviewed or documented.

**Fix (G-33, same day):** `Policy.unboundSignalReasons` — a new per-policy field naming, with a specific reason, every rule-referenced fact deliberately left out of `boundSignals` (mirroring `INTENTIONALLY_UNBOUND_CAPABILITIES`'s "reviewed exemption, not silence" pattern). `PolicyValidator.validate()` now **fails closed**: any rule-referenced fact neither bound nor acknowledged throws `PolicyValidationError`, rather than logging a warning nobody reviewing a running system would see. All 10 real policies were updated. Two of them (`connector-capability`, `customer-refund`) turned out to have a genuinely bindable amount fact (`paymentAmount`, `refundAmount`) that had simply never been bound to `parameters.amount` — a real, live scope-drift gap, not just a documentation gap, now closed with a real `boundSignals` entry. The remaining 8 policies' uncovered facts are independently-attested booleans/scores with no Intent-side equivalent (identity-provider attestations, fraud/risk assessments, GitHub's own review/status-check state, etc.) — each given a specific, non-generic reason in its policy file.

**Coverage now:** every rule-referenced fact across all 10 real policies is either bound (verified against the Intent at execution time) or explicitly, individually acknowledged with a reason a reviewer can check. Nothing is silently unmentioned.

**Residual:** an `unboundSignalReasons` entry is a documented claim, not a cryptographic proof — a reviewer must still judge whether the stated reason is true, the same trust model `INTENTIONALLY_UNBOUND_CAPABILITIES` already has for capabilities.

**Severity:** N/A (fixed, verified) — see `docs/VERIFICATION-GAPS.md` G-33 for full evidence (test counts, exact policy diffs, full-suite regression results: 1560 passed, 0 failed).

### Claim 4: Cryptographic Proof Records

**Statement:** All executions are signed with Ed25519; trust records are independently verifiable without trusting Parmana's runtime or database.

**Status:** ✅ VERIFIED

**Evidence:** Ed25519 default (`Ed25519SignatureProvider`), ML-DSA-65 opt-in (`PRIMARY_SIGNATURE_PROVIDER=dilithium3`, Node ≥24). Signed fields (`packages/crypto/src/VerificationCrypto.ts`, `canonicalRecord()`): `trustRecordId`, `businessTransactionId`, `transaction`, **`authorization`**, `overrides`, `executions`, `createdAt`.

**Fields NOT signed but in the record:** `verifications` and `receipts` (deliberately — they're produced _from_ the sealed record, signing them would be circular), and the `trustRecordHash`/`signature`/`signatures` fields themselves (self-referential, obviously excluded).

**External verifiability:** `python/parmana/api/verification_api.py`, `python/examples/03_verify.py` — a real, separate-language verification path exists, not just an internal claim.

**Severity:** N/A (verified true)

### Claim 5: No Unauthorized Execution

**Statement:** No agent can execute a transaction that violates its granted authority, capability, or policy, regardless of how it attacks the system.

**Status:** ✅ VERIFIED, with stated assumptions

**Evidence:** `POST /execute` is the only entry point; caller-auth (`isCapabilityAllowed`/`isPrincipalAllowed`) gates it, `PolicyEngine.evaluate()` is a pure deterministic first-match function with no bypass flag, `ConnectorPolicy.assertAllowed()` re-verifies independently at the connector boundary (defense-in-depth, not trusting the API-edge check alone).

**Assumptions required:** policies are authored correctly (a capability paired with the wrong policy is a distinct, separately-tracked risk — see Finding 3 below, now closed); the deployment operator hasn't set `PARMANA_AUTH_DISABLED=true` (a real, documented escape hatch, precisely scoped in `docs/VERIFICATION-GAPS.md` G-28).

**Attack surface:** a capability registered with no canonical policy binding — closed by the guardrail in Finding 3.

**Severity:** N/A (verified true, with named assumptions)

---

## Security Findings (Known Issues)

### Finding 1: `ExecutionTrustRecord.authorization` (NF-003)

**Status:** ✅ FIXED. This is a real finding ID — commit `6303801` (2026-09-07) is literally titled `fix: persist signed execution authorization in trust records (NF-003)`. `authorization?: SignedExecutionAuthorization` exists on the type (`packages/shared/src/domain/execution-trust-record.ts:89`), is populated by `BusinessTrustRecordBuilder.build()`, and is included in the signature (confirmed under Claim 4).

**Correction to the source prompt:** this isn't tracked under a gap numbered "NF-003" in `VERIFICATION-GAPS.md`'s table — the identifier lives in `CODEBASE-REFERENCE.md` and the commit message; the prompt's date/status were otherwise accurate.

**Severity:** N/A (fixed, verified)

### Finding 2: Razorpay Connector Deleted But Comments Remain

**Status:** ✅ Confirmed accurate, low severity. Grep for `Razorpay` across live `.ts` source: 7 files, all comments — either an explicit "lesson learned from the Razorpay connector's own history" (`packages/connector-hubspot/src/HubSpotTypes.ts:53-58`, `packages/api/src/bootstrap/createHubSpotCredentialProvider.ts:11-13,57-59`) or test fixtures. `createConnectorRegistry.ts` registers exactly three connectors: `test-fixture`, `hubspot`, `github` — no Razorpay.

**Correction to the source prompt:** these comments aren't stale cruft, they're deliberate incident-history context citing `docs/CLAIMS.md §3.4` — and the prompt mislabels this "Gap 3"; the actual numbered Gap 3 in `VERIFICATION-GAPS.md` is an unrelated `DuplicateBusinessTransactionError` HTTP-status finding.

**Severity:** MEDIUM as the source prompt states is generous — LOW is more accurate; the comments are intentional, not debris.

### Finding 3: Missing Capability Binding Guardrail

**Status:** ✅ ALREADY FIXED — the source prompt's "not yet fixed" is stale. `assertConnectorCapabilitiesBound()` (`packages/api/src/bootstrap/assertConnectorCapabilitiesBound.ts`) exists, is fail-closed (throws at startup, not a warning, for any capability with no canonical binding and no documented exemption), and is called from `createConnectorRegistry.ts:160` before the registry is ever returned. This closed `docs/VERIFICATION-GAPS.md` G-30 on 2026-08-25/26.

**Residual, honestly documented in G-30 itself:** the _test_ asserting this guardrail's coverage still uses a hand-maintained literal set, not a live read of the registry — so the guardrail fires correctly today, but a future connector could theoretically still slip past the _test's_ own detection if someone also forgets to update its expected-set literal (the guardrail itself would still catch a truly unbound capability at runtime).

**Severity:** the runtime protection is real (not MEDIUM/missing); LOW residual on the test's own maintainability.

### Finding 4: PostgREST Bypass to Raw Postgres

**Status:** ✅ Real, but **broader than documented**. `docs/CLAIMS.md` line 1581 frames this as one narrow workaround scoped to `SupabaseCallerAuditSink` ("a temporary workaround for a PostgREST schema-cache issue... flagged as revertible"). Direct grep shows **8 of 9** `Supabase*` storage classes now use raw `pg.Pool`: `SupabaseExecutionTrustRecordRepository`, `SupabaseBusinessTransactionRepository`, `SupabaseNonceStore`, `SupabasePendingPolicyChangeRepository`, `SupabasePolicyChangeApprovalRecordRepository`, `SupabasePolicyChangeStepUpNonceStore`, `SupabaseApprovalNonceStore`, `SupabaseRefusalRecordRepository`. `SupabaseExecutionTrustRecordRepository.ts`'s own comment (lines 19-22) states the real intent plainly: **"part of removing PostgREST from every Supabase-backed table's failure modes, not just the audit sinks that broke first."** This is a deliberate, repo-wide architecture migration away from PostgREST, not a single revertible patch — `CLAIMS.md`'s framing understates current scope.

**Impact:** loss of PostgREST's RLS/auth layer for these tables (mitigated in-app, not at the DB layer), and it forecloses any future serverless-Postgres/PostgREST-only deployment path unless reverted.

**Severity:** MEDIUM as stated, but recommend updating `CLAIMS.md` to describe the actual current scope rather than the original single-incident framing — this is a documentation-accuracy gap, not a functional one.

---

## Structural Audit

### Dead Code

**Status — the source prompt is stale on 2 of 4 items; the real new ones were fixed same-day (`docs/VERIFICATION-GAPS.md` G-34):**

- `@parmana/receipt` — the prompt asks to check it; **it no longer exists at all**, deleted 2026-09-08 (commit `e6c73f0`), confirmed by directory listing.
- `packages/runtime/src/policy/` and `packages/runtime/src/ports/` — **also deleted in the same commit** (`PolicyRouter.ts`, `PolicyAdapter.ts`, `ExecutionTrustRecordStore.ts`, etc. all gone; `e6c73f0`'s own commit message explicitly excluded two other candidates after re-verification, see that commit for detail).
- `@parmana/replay` — **resolved, not dead.** Confirmed no live call site outside its own package other than `examples/tutorials/06-replay/run.ts`. Not deleted: same shape of intentional, tested extension point the 2026-09-08 cleanup explicitly excluded `ReceiptComponent.ts` for (5 own test files, a dedicated tutorial, not wired into the default pipeline by design).
- `SupabaseClientFactory` — **FIXED.** Deleted, along with its export and its now-unused `@supabase/supabase-js` dependency (`npm install` resynced the lockfile). Every one of its 8 stale doc-comment references (across `createCallerAuditSink.ts`, `createNonceStore.ts`, `PostgresPoolFactory.ts`, `StorageFactory.ts`, `SupabaseStorageProvider.ts`, and 3 test files) rewritten to describe the actual current mechanism.
- **Bonus find in the same pass:** `assertSupabaseConfigured.ts` was also fully dead (its own doc comment named two callers that had already moved to `assertDatabaseUrlConfigured.ts`) — deleted too.

**`packages/audit.txt` — FIXED.** The committed, tracked UTF-16 binary dump — the same shape of debris `docs/VERIFICATION-GAPS.md` gap 13 already fixed once (`trace.txt`, `claim.md`) — was `git rm`'d.

**Severity:** was MEDIUM/LOW-MEDIUM; now N/A (fixed). Verified: full workspace `npx tsc -b` clean, full repo suite 1559 passed / 38 skipped / 0 failed.

### Cryptographic Naming

**Status:** FIXED, as an alias rather than a rename (`docs/VERIFICATION-GAPS.md` G-35). 8 occurrences of `Dilithium3`/`dilithium3` remain in `packages/*/src`, all in **internal config-value/class-name identifiers** (`PRIMARY_SIGNATURE_PROVIDER=dilithium3`, `Dilithium3SignatureProvider`), not user-facing claims — `docs/CLAIMS.md` and `docs/site/cryptography/overview.mdx` already consistently say "ML-DSA-65 (FIPS 204, historically called 'dilithium3' in this codebase)" everywhere checked.

**Renamed?** NO, still correctly not renamed — the original conclusion stands: renaming the internal identifier would break `PRIMARY_SIGNATURE_PROVIDER=dilithium3` for existing deployments for no externally-visible benefit. **Instead:** `parseSignatureAlgorithm` (`packages/shared/src/config/ConfigValidation.ts`) now accepts `ml-dsa-65` as an additive input alias resolving to the unchanged canonical `dilithium3` identifier — a new deployment can use the accurate NIST/FIPS 204 name; an existing `dilithium3`-configured one is completely unaffected. Both `generate-keypair.ts` CLIs accept the same alias.

**Severity:** was LOW/non-actionable; now N/A (fixed, additive, zero-regression — 4 new tests, full suite 1563 passed / 0 failed).

---

## Production-Readiness Rating

**FINAL RATING:** 🟢 PRODUCTION-READY (upgraded from 🟡 same-day, once every blocker below was closed)

**Why:** All 5 critical claims hold with real code/test evidence. Nothing found across this audit was CRITICAL or blocks-pilot-severity that isn't already tracked and mitigated (`PARMANA_AUTH_DISABLED` is a known, scoped escape hatch — G-28). Every actionable finding — the `boundSignals` coverage gap, the dead `SupabaseClientFactory`/`assertSupabaseConfigured.ts`, the committed `audit.txt` debris, and the stale PostgREST documentation — was fixed the same day it was found, verified against a clean full-workspace build and test suite.

## Blockers — all closed same-day, 2026-09-09

1. ~~`docs/CLAIMS.md` PostgREST framing is stale~~ — **FIXED.** §3.11 now describes the actual repo-wide migration (8 of 9 storage classes), not just the originating incident.
2. ~~`SupabaseClientFactory` is dead code~~ — **FIXED.** Deleted along with its export, its now-unused `@supabase/supabase-js` dependency, and all 8 stale doc-comment references. `assertSupabaseConfigured.ts` (a second, related dead file) found and deleted in the same pass. See `docs/VERIFICATION-GAPS.md` G-34.
3. ~~`packages/audit.txt` committed debris~~ — **FIXED.** `git rm`'d (G-34).
4. ~~`boundSignals` coverage gap on real production policies~~ — **FIXED.** See `docs/VERIFICATION-GAPS.md` G-33: `Policy.unboundSignalReasons` added, `PolicyValidator.validate()` now fails closed, all 10 real policies updated (2 gained a genuine new `boundSignals` binding, 8 got specific per-fact acknowledgment reasons).

## Recommended Action Plan — completed

1. ~~Update `docs/CLAIMS.md`'s section on the PostgREST workaround~~ — done (§3.11).
2. ~~Delete `SupabaseClientFactory` and its stale doc-comment references~~ — done (G-34), plus the bonus `assertSupabaseConfigured.ts` find.
3. ~~`git rm packages/audit.txt`~~ — done.
4. ~~Decide and document policy-by-policy whether uncovered `boundSignals` facts are acceptable~~ — done (G-33).
5. No changes needed to the 5 core claims, the capability-binding guardrail, or the credential-isolation/replay-protection code — all verified sound as-is, unchanged.

**Follow-on, not from this audit, requested and completed afterward — with a self-caught regression along the way (`docs/VERIFICATION-GAPS.md` G-36):** `@supabase/supabase-js` removed from the 5 package.json files confirmed unused (`api`, `crypto`, `policy`, `runtime`, `shared`). The removal pass's own verification (`grep packages/*/src packages/*/tests`) missed two real usages outside that scope — `packages/storage/scripts/migrate.ts` and root-level `scripts/verify-policy-changes-approved.ts`, neither covered by `tsc -b` or `vitest run` since both are standalone `tsx` scripts, one with no test at all. Caught by re-running the full suite (`verify-policy-changes-approved.test.ts` failed with `Cannot find package`) and directly invoking `migrate.ts`; both dependencies restored to their correct locations (`packages/storage/package.json`, and newly declared in the root `package.json`'s `devDependencies` for the script that had never declared it at all). See G-36 for the full account, including a disclosed side effect: invoking `migrate.ts` directly to verify the fix made one real, live `client.rpc(...)` call against this repo's own `.env`-configured Supabase project (it failed harmlessly with `PGRST202`, no `exec_sql` function in that project's schema — no migration content executed, nothing changed).

---

## Appendix: Source-Prompt Corrections

For traceability, every place this audit's findings diverge from the source prompt's own assumptions:

| Prompt claim                                                              | Actual state                                                                                | Where verified                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| "Missing Capability Binding Guardrail... Not yet fixed"                   | Already fixed, fail-closed, wired into startup                                              | `assertConnectorCapabilitiesBound.ts`, `createConnectorRegistry.ts:160`, G-30 |
| Razorpay finding labeled "Gap 3"                                          | Gap 3 in `VERIFICATION-GAPS.md` is an unrelated `DuplicateBusinessTransactionError` finding | `docs/VERIFICATION-GAPS.md:57`                                                |
| PostgREST bypass "documented as workaround" (implying narrow/contained)   | Real, but repo-wide across 8 of 9 Supabase storage classes, per the code's own comments     | `SupabaseExecutionTrustRecordRepository.ts:19-22` and 7 sibling classes       |
| `@parmana/receipt`, `packages/runtime/src/policy/+ports/` dead-code check | Both already deleted 2026-09-08                                                             | commit `e6c73f0`                                                              |
| (not asked) `SupabaseClientFactory` current usage                         | Dead — zero real call sites remain                                                          | grep across `packages/*/src`                                                  |
| (not asked) stray debris files                                            | `packages/audit.txt`, a tracked UTF-16 binary dump, still exists                            | `git ls-files packages/audit.txt`                                             |
