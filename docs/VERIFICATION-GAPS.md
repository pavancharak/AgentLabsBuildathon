# Verification Gaps

Version: 1.0
Status: Public
Companion to `docs/CLAIMS.md`

---

## Purpose

`CLAIMS.md` documents what this repository proves. This document is its complement: every
place a claim, a code path, or a piece of production behavior is _not_ independently
verified today. The goal is to know exactly where the unproven edges are before an external
review finds them first.

Same discipline as `CLAIMS.md`: every entry cites a file, a line, or a specific test (or
names the absence of one). Severity is one of three tiers:

- **blocks-pilot**: a real correctness, security, or operational gap a pilot customer or
  their security team would reasonably block on.
- **pre-production**: real, worth closing before general availability, not urgent enough
  to block a scoped pilot.
- **cosmetic**: a documentation, naming, or observability gap with no behavioral
  consequence.

This audit was run against commit `651497a`, `npm test` reporting 345 passed, 1 skipped, 85
test files, coverage measured via `npm run coverage` (`@vitest/coverage-v8`).

---

## Environment note, load-bearing for everything below

Supabase-gated integration tests (see below) are gated on whether `SUPABASE_URL` plus
either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY` are present in `process.env` at
test-run time (`packages/api/tests/helpers/supabase-availability.ts`). Vite's built-in env
loading exposes whatever a local `.env` file sets to `process.env` inside every `vitest run`
invocation, so whether these tests exercise a real, live Supabase project or are skipped
entirely depends silently on the environment doing the run, with no signal in the test
output either way. During this audit pass, Supabase credentials were available in the
environment, so every Supabase-gated integration test ran against a live project rather
than being skipped, and all of them passed; those results are folded into the "verified"
counts throughout this document.

This is itself flagged as gap **G-3** below: nothing about the test output distinguishes
"ran against a real database" from "ran hermetically," and a fresh clone or a CI job without
Supabase credentials configured would silently get less coverage than an environment that
has them, without anyone noticing the difference.

---

## Gaps closed this pass

| #   | Gap                                                                                                                      | Closed by                                                                                                                                                                                                                                       | Verified                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Credential isolation (issue → consume → destroy) was proven only at the library level, never through a real HTTP request | `packages/api/tests/integration/credential-isolation.integration.test.ts` (new), using `packages/api/tests/bootstrap/createInspectableExecutionSystem.ts` (new, test-only re-composition of the real gateway/execution-control/connector chain) | 3 tests: success case (credential issued + destroyed, proven by a second `consume()` throwing `"has been revoked"`), executor-failure case (same proof, plus confirms the credential is still destroyed on a downstream failure), spoofed-attestation case (proves zero sessions/credentials are ever created when the gateway attestation doesn't verify) |
| 2   | `PolicyNotFoundError` never triggered through HTTP                                                                       | `packages/api/tests/unit/execute-api.test.ts`, "returns 404 when the referenced policy does not exist"                                                                                                                                          | `POST /execute` with an unregistered `policy.name`/`version` → 404                                                                                                                                                                                                                                                                                         |
| 3   | `DuplicateBusinessTransactionError` never triggered through HTTP (sequential case)                                       | Same file, "returns 409 when the same businessTransactionId is submitted twice"                                                                                                                                                                 | Two sequential `POST /execute` calls with the same ID → 200, then 409                                                                                                                                                                                                                                                                                      |
| 4   | `POST /policies/validate` had zero test coverage of any kind                                                             | `packages/api/tests/unit/policies-api.test.ts` (new file)                                                                                                                                                                                       | All 4 branches: missing `policyId` (400), missing `policyVersion` (400), loadable policy (200), unknown policy (404)                                                                                                                                                                                                                                       |
| 5   | `GET /receipt/latest/:id`'s 200 success path never exercised                                                             | `packages/api/tests/unit/receipt-get-api.test.ts`, new case                                                                                                                                                                                     | Executes a transaction, confirms the receipt route returns the same trust record hash the execution produced                                                                                                                                                                                                                                               |
| 6   | `GET /verification/:id`'s 200 success path never exercised                                                               | `packages/api/tests/unit/verification-api.test.ts`, new case                                                                                                                                                                                    | Same pattern                                                                                                                                                                                                                                                                                                                                               |
| 7   | Envelope expiry boundary (`now === expiresAt` exactly) never tested, only "clearly expired"/"clearly valid"              | `packages/envelope-verifier/tests/unit/envelope-verifier.test.ts`, "treats the exact expiresAt instant as expired"                                                                                                                              | Confirms the `<` comparison in `AuthorizationVerifier` is exclusive at the exact instant, and that one millisecond earlier is still valid                                                                                                                                                                                                                  |
| 8   | Session credential expiry boundary never tested at the exact instant                                                     | `packages/execution-control/tests/unit/session-credential-vault.test.ts`, two new cases                                                                                                                                                         | Confirms the `>=` comparison is inclusive at the exact instant, one millisecond earlier is still valid                                                                                                                                                                                                                                                     |
| 9   | `SessionCredentialVault.consume()`/`revoke()` with an unknown ID never tested                                            | Same file, two new cases                                                                                                                                                                                                                        | Both throw `"Unknown session credential: <id>."`                                                                                                                                                                                                                                                                                                           |
| 10  | Nonce store: no test simulated two concurrent `verify()` calls on the same nonce                                         | `envelope-verifier.test.ts`, "under two concurrent verify() calls with one nonce"                                                                                                                                                               | `Promise.all` of two calls, exactly one succeeds, deterministic given `MemoryNonceStore.checkAndRecord()` has no `await` between check and set, not a flaky/probabilistic test                                                                                                                                                                             |
| 11  | Session credential vault: no test simulated two concurrent `consume()` calls on the same session credential              | `session-credential-vault.test.ts`, "under two concurrent consume() calls"                                                                                                                                                                      | Same pattern, deterministic for the same reason                                                                                                                                                                                                                                                                                                            |

18 new tests, 2 new test files, 1 new test-only helper file. Full list of files touched is
in the phase report; nothing in `packages/*/src` was modified.

---

## Gaps closed in the Sep 7, 2026 session

Scope: a full-codebase deep read (six parallel agents covering every package, the two
client SDKs, schemas, and every policy file, grounded only in source — no docs trusted)
surfaced a batch of real, independently-verified defects across the API, execution-gateway,
crypto/policy, storage, connector, and SDK layers. This section records what was actually
fixed and committed that session; findings not acted on remain listed in "Remaining gaps, by
severity" or "Decision required" below, not silently dropped.

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Closed by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 24  | `ExecutionTrustRecord` carried no record of the `SignedExecutionAuthorization` the gateway actually accepted — a loaded trust record could not independently prove the nonce, expiry, `businessTransactionHash`, `policyContentHash`, or `signalsHash` the authorization was signed under, only that the trust record's own top-level fields hadn't been tampered with                                                                                                                                                                                                                                                                                               | New optional `authorization?: SignedExecutionAuthorization` field on `ExecutionTrustRecord` (`packages/shared/src/domain/execution-trust-record.ts`), captured from `RuntimeContext.authorization` in `BusinessTrustRecordBuilder.build()` (`packages/runtime/src/BusinessTrustRecordBuilder.ts`), included in `VerificationCrypto.canonicalRecord()` (`packages/crypto/src/VerificationCrypto.ts`) so it is covered by the same hash/signature as `transaction`/`overrides`/`executions` — no separate "if missing, skip" branch needed: `CanonicalSerializer` already drops `undefined`-valued keys via `JSON.stringify`, so a record with no authorization serializes byte-identically to before this field existed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `packages/crypto/tests/unit/verification-crypto-authorization.test.ts` (4 cases: verifies with no authorization present; verifies with one present and its hash differs from the same record without one; fails closed on a tampered authorization; a record built with the literal pre-fix draft shape — no `authorization` key at all, not merely `undefined` — hashes identically to one built via the helper with `authorization: undefined`), `packages/runtime/tests/unit/business-trust-record-builder.test.ts` (2 cases: captures a present authorization; leaves it entirely unset, not merely `undefined`, when absent from context). Commit `6303801`                                         |
| 25  | Hybrid-signature fields (`ExecutionTrustRecord.schemaVersion`/`.signatures`, added by an earlier "Hybrid Signature Support" milestone) had no Supabase column at all — a `CRYPTO_MODE=hybrid` trust record silently lost its second signature on every read from Supabase, degrading hybrid verification to single-signature for anything reloaded from durable storage. Found while verifying gap 24's storage round-trip, not previously known                                                                                                                                                                                                                     | New migration `supabase/migrations/20260907120000_add_authorization_and_hybrid_signatures_to_execution_trust_records.sql` adds `authorization_json`, `schema_version`, `signatures_json` columns; `SupabaseExecutionTrustRecordRepository.create()`/`findByTransactionId()` updated to write/read all three                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `packages/storage/tests/unit/supabase-execution-trust-record-repository.test.ts`, two new cases: full round-trip of all three fields against a fake `pg.Pool`, and confirming a legacy row with none of the three persisted returns them as genuinely absent (`undefined`), not `null`. Commit `6303801`                                                                                                                                                                                                                                                                                                                                                                                                 |
| 26  | Python SDK: `POST /transactions` (and the quickstart example) failed with a 500 when submitted via the Python client                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `python/parmana/serialization/encoder.py`'s `encode()` used `dataclasses.asdict()`, which eagerly flattens every nested dataclass into a plain dict before `encode()`'s own recursive call ever runs — so an unset `\| None = None` field on a dataclass _nested inside_ another dataclass (e.g. the newly-regenerated `BusinessTransactionMetadata.granted_capability`, see gap 24's Python-model regeneration) fell through to the plain-dict branch, which has no `None`-filtering at all, and was serialized as an explicit JSON `null`. Server-side, `DefaultConnectorPolicy.assertAllowed()` (`packages/execution-control/src/ConnectorPolicy.ts`) checks `grantedCapability !== undefined`, and a present-but-`null` value satisfies that check, then fails the subsequent equality check against the executed action. Fixed by recursing on real attribute values via `dataclasses.fields()`/`getattr()` instead of `asdict()`, so a nested dataclass stays a genuine dataclass instance — and therefore still `None`-filtered — at every depth                                                                                                                                                                                                                             | Reproduced against a live server (manual `curl` with `grantedCapability: null` in the body, isolating the bug from the Python SDK itself) before and after the fix. `python/tests/test_encoder.py`: added assertions that `tenantId`/`grantedCapability` (both `None` in the existing fixture's nested `metadata`) are omitted, not merely `null`. Full Python suite: 63 passing (the 4 failures seen mid-session were the same pre-existing timeout-under-load flakiness confirmed unrelated below, not a regression from this fix — verified by reverting to `main` and reproducing the same 3-4 failures there). No commit hash tag in this doc; part of commit `6303801`'s Python-model regeneration |
| 27  | TypeScript SDK: `PolicyApi.validate()` sent the entire `Policy` document as the `POST /policies/validate` request body; the real route (`packages/api/src/routes/policies.ts`) and `schemas/requests/policy-validate-request.schema.json` only accept `{policyId, policyVersion}` — any real caller of `ParmanaClient.validatePolicy()` would have received a 400                                                                                                                                                                                                                                                                                                    | `typescript/src/client/PolicyApi.ts`'s `validate()` now takes `(policyId: string, policyVersion: string)` and sends exactly that shape, matching the Python SDK's already-correct `policy_api.py`. `ParmanaClient.validatePolicy()` and the `05-policy-validation.ts` example updated to match                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Full `npx tsc -b` clean; no dedicated unit test existed or was added (no test previously covered this method's request body at all)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 28  | Python SDK: `parmana/api/__init__.py`'s imports and `__all__` omitted `AuditApi` and `RefusalApi`, despite both being real modules wired directly into `client.py` — a wildcard import missed two live API classes                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Added both to the import list and `__all__`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `python -c "from parmana.api import AuditApi, RefusalApi"` succeeds; full Python suite unaffected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 29  | `packages/execution-gateway/src/connector-execution/GatewayHttpAdapter.ts` had a dead, duplicated, badly-indented `throw error;` in its `catch` block — harmless (the first `throw` always fires) but a landmine for the next edit                                                                                                                                                                                                                                                                                                                                                                                                                                   | Removed the duplicate, fixed indentation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `npx eslint`/`npx tsc -b` clean, no behavior change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 30  | `ConnectorEvidence.ts`'s `buildConnectorEvidence()` redacted credential-shaped keys from `responseSummary.metadata` but not from `requestSummary.parameters` — a caller's own action parameters, if secret-shaped, were hashed and stored in evidence unredacted while the response side was protected                                                                                                                                                                                                                                                                                                                                                               | `requestSummary.parameters` now passes through the same `redactSensitiveKeys()` as `responseSummary.metadata`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `npx tsc -b` clean; no dedicated new test (no existing test asserted on `requestSummary` redaction either way)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 31  | `packages/api/src/bootstrap/createConnectorRoute.ts` still mapped `"payments:execute"` → connector id `"vendor-payment"`, a connector that has never been registered since G-27's removal — the mapping itself is unreachable in the current wiring (only consumed by `ExecutionGateway`'s deprecated `executionControl.channel` path, never the `executionControl.service` path this repository actually configures), but was still live, misleading dead code                                                                                                                                                                                                      | Removed the mapping; the function now always throws, with a comment explaining why (satisfies `ExecutionControlOptions.route`'s required shape for a path nothing currently exercises). Also deleted the empty, zero-byte, unreferenced `createVendorPaymentSecureConnector.ts` stub                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `npx tsc -b` clean; existing `packages/api/tests/unit/bootstrap/create-connector-registry.test.ts` (`"payments:execute has no connector to resolve to in any environment"`) unaffected, since that test exercises `ConnectorRegistry.resolveCapability()`, a different code path from the one this change touched                                                                                                                                                                                                                                                                                                                                                                                        |
| 32  | `packages/replay/package.json` declared `@parmana/runtime`, `@supabase/supabase-js`, `express` as dependencies — none used anywhere in `src/` or `tests/` — while `@parmana/policy`/`@parmana/shared`, genuinely imported throughout, were undeclared; the package only built by accident, via npm workspace hoisting                                                                                                                                                                                                                                                                                                                                                | Corrected the dependency list; moved `vitest` to `devDependencies` where it belongs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `npx tsc -b` and full `packages/replay` test suite clean after the change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 33  | `POST /transactions` performed caller-capability admission (`isCapabilityAllowed()`) but, unlike `POST /execute`, never carried the confirmed capability into `transaction.metadata.grantedCapability`, and only audited denials, never grants — a transaction submitted via `/transactions` signed an authorization missing `ExecutionAuthorizationPayload.grantedCapability` that the equivalent `/execute` submission would have carried (a consistency gap in the protection §2.31 of `docs/CLAIMS.md` describes, not a new one)                                                                                                                                 | `packages/api/src/routes/transactions.ts` now records `caller.capability_granted` and sets `metadata.grantedCapability` identically to `execute.ts`, by direct duplication of the existing logic rather than a new shared abstraction — the surrounding capability-check/audit block was already duplicated between the two routes before this change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | New integration test in `packages/api/tests/integration/caller-auth.integration.test.ts` ("`POST /transactions parity with POST /execute (NF-004)`"): both routes, given the same caller, produce a response whose `authorization.payload.grantedCapability` equals the executed action, and both emit exactly one `caller.capability_granted` event. Commit `7da8f0d`                                                                                                                                                                                                                                                                                                                                   |
| 34  | `CapabilityPolicyBinder` (see G-30 below) silently does nothing for any capability absent from `CANONICAL_CAPABILITY_POLICY_BINDINGS` — by design for genuinely out-of-scope actions, but nothing previously stopped a _newly-registered_ production capability from shipping unbound the same way G-30 itself happened (GitHub wired in 2026-08-19, gap not caught until 2026-08-25). Today's three live capabilities (`hubspot:deal-fetch`, `hubspot:deal-update`, `github:pr-fetch`, `github:pr-merge`) are all already bound, so this gap has no current live exploitable surface — it is a structural guardrail against recurrence, not a fix for a present gap | New fail-closed startup assertion, `assertConnectorCapabilitiesBound()` (`packages/api/src/bootstrap/assertConnectorCapabilitiesBound.ts`), called from `createConnectorRegistry()` after every connector registration is built, before the registry is returned: every registered capability must be in `CANONICAL_CAPABILITY_POLICY_BINDINGS` (imported from `@parmana/policy`, which re-exports it from `@parmana/capability-registry` — the package G-30's own "Root-cause architecture decision" addendum below already documents moving it to, 2026-08-26) or listed, with a reason, in a new allowlist (`packages/api/src/bootstrap/intentionallyUnboundCapabilities.ts`, currently just the test-only `test:fixture-execute`). An unbound, unlisted capability now fails startup with a message naming both remediation paths, instead of shipping silently protected only by omission. This is complementary to, not a replacement for, G-30's still-open follow-on work below (deriving `CapabilityPolicyBinder.test.ts`'s hand-maintained coverage-test literal from `createConnectorRegistry.ts` itself) — this guardrail catches an unbound capability at process startup regardless of whether that unit test's literal was updated, but does not itself fix the test | `packages/api/tests/unit/bootstrap/assert-connector-capabilities-bound.test.ts` (4 cases: bound capabilities pass silently; an allowlisted-but-unbound capability passes with a `console.warn`; an unbound, non-allowlisted capability throws; every allowlist entry has a non-empty reason). Full `packages/api` suite (272 tests) and full repo suite (1514 tests) pass with the assertion wired into real startup. Commit `672aee6`                                                                                                                                                                                                                                                                   |
| 35  | `PolicyChangeCrypto.verify()` was unit-tested but never called anywhere in production code — `verifyPolicyGovernanceIntegrityAtStartup()` re-derived and compared a content hash but never re-verified the stored `PolicyChangeApprovalRecord`'s own signature, so a tampered field on an already-persisted record (e.g. a rewritten `approvedBy`) went undetected. Found via an independent audit (artifact published 2026-09-07), not a full-codebase pass                                                                                                                                                                                                         | `verifyPolicyGovernanceIntegrityAtStartup()` now calls `policyChangeCrypto.verify(mostRecent)` before trusting `contentHashAfter` (new `"signature-invalid"` mismatch reason). `PolicyChangeApprovalRecord` also gained `previousRecordHash` (`packages/shared/src/domain/policy-change-approval-record.ts`), computed by `PolicyChangeApprovalService.approve()` from the record that preceded it for the same `(policyName, policyVersion)` and included inside the record's own signed payload (`PolicyChangeCrypto.canonicalRecord()`), independently re-derived and checked (new `"chain-broken"` mismatch reason) — detects a deleted/reordered/substituted record in the approval-record store itself, not only a tampered live file. Requires `supabase/migrations/20260907130000_add_previous_record_hash_to_policy_change_approval_records.sql` and a `SupabasePolicyChangeApprovalRecordRepository` column-mapping update                                                                                                                                                                                                                                                                                                                                                | `packages/api/tests/unit/verifyPolicyGovernanceIntegrityAtStartup.test.ts`, rewritten to sign fixtures for real (the prior fixtures used a hand-written placeholder signature string, correct only for a check that never verified it) plus two new cases for `"signature-invalid"`/`"chain-broken"` — 9 cases total. Commit `437f5ec`                                                                                                                                                                                                                                                                                                                                                                   |
| 36  | The integrity check ran at process startup only — an out-of-band edit to a live `policy.json` made while a long-lived process kept running was invisible until the next restart/deploy                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | New `schedulePolicyGovernanceIntegrityCheck()` (`packages/api/src/bootstrap/schedulePolicyGovernanceIntegrityCheck.ts`) re-runs the same check every 5 minutes for the life of the process (`POLICY_GOVERNANCE_INTEGRITY_CHECK_INTERVAL_MS` to override, `0` disables), sharing construction/fail-open error handling with the startup call via new `runPolicyGovernanceIntegrityCheckOnce()` (`packages/api/src/bootstrap/policyGovernanceIntegrityCheckRunner.ts`); its interval timer is `.unref()`'d so it can never itself keep the process alive past shutdown                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Wired into `server.ts` alongside the existing startup call; no dedicated timer test (matches this codebase's existing convention of not unit-testing `setInterval` wiring itself, e.g. `createGracefulShutdown`'s own force-exit timer). Commit `437f5ec`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 37  | `PolicyValidator`'s `matches` operator accepted any syntactically-valid regex with no complexity bound — a policy author could commit a catastrophically-backtracking pattern later evaluated against live, attacker-influenced signal values. Separately, `findUncoveredFacts()` coverage warnings were computed but never surfaced anywhere a checker would see them — only a load-time `console.warn`                                                                                                                                                                                                                                                             | `validateRegex()` now rejects patterns over 200 characters and single-level nested quantifiers (e.g. `(a+)+`) — documented in-source as a heuristic improvement, not a ReDoS-proof guarantee. Coverage warnings now returned as `coverageWarnings` on both the `POST .../pending-changes` response and the `GET .../pending-changes` diff listing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | No dedicated new unit test for the regex heuristic itself (existing `PolicyValidator` test suite unaffected — no prior test constructed a nested-quantifier pattern); `npx tsc -b`/`npx vitest run` clean. Commit `437f5ec`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 38  | `packages/policy/src/types/LedgerEntry.ts` and its `hashLedger()` helper were unexported, unimported dead code inside `@parmana/policy` — easy to mistake for the real audit trail. Separately, `@parmana/storage`'s `AppendOnlyLedger`/`StorageEngine` are genuinely tested and exported, but in-memory only (no persistence) and never imported by `packages/api`, `execution-gateway`, or `runtime` — also not part of the live request path, with nothing saying so                                                                                                                                                                                              | Deleted the unused `LedgerEntry.ts`/`hash.ts`. `StorageEngine`'s own doc comment now states explicitly that it is not part of the live request path and points at `PolicyChangeApprovalRecord`/`ExecutionTrustRecord` as the real audit trail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `npx tsc -b` clean (nothing referenced either file outside itself); full repo test suite unaffected. Commit `437f5ec`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 39  | Any `(policyName, policyVersion)` predating Policy Governance (no approval record at all) is permanently invisible to the integrity check — `scripts/verify-policy-changes-approved.ts`'s own doc comment already named this as expected, not a false positive, but nothing closed it                                                                                                                                                                                                                                                                                                                                                                                | New `scripts/backfill-legacy-policy-approvals.ts`: creates a synthetic, system-actor `PendingPolicyChange` + signed `PolicyChangeApprovalRecord` (content unchanged) for any pair with neither an approval record nor an open proposal. Dry-run by default (`--apply` to write); deliberately not wired into server startup — mutating the durable audit trail is a reviewed, one-time action. Its first version did not check for an existing open `PendingPolicyChange` before planning a backfill, and would have misclassified this codebase's own real, human-proposed, still-`PENDING_APPROVAL` policies (§2.26's "Legacy-policy backfill" entry, ten policies proposed 2026-08-19) as "legacy" — fixed the same day after cross-referencing that entry: the script now calls `pendingPolicyChanges.findPending()` and excludes any pair with an open proposal, reporting it separately (`awaitingRealApproval`) instead of fabricating a system approval over a real, unresolved human decision                                                                                                                                                                                                                                                                              | Type-checked directly (`npx tsc --noEmit` with the same strict flags as the main build); no live run performed against any environment — `--apply` has not been executed. Commits `437f5ec`, `4e1a8e3`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 40  | Every governance check up to this point was detection-only: a bypass took effect immediately and was only ever discovered afterward, on the next integrity check (every 5 minutes, gap 36) or startup scan. Nothing stopped a policy from actually executing while illegitimate                                                                                                                                                                                                                                                                                                                                                                                      | New `PolicyExecutionVerifier` (`packages/policy/src/types/PolicyExecutionVerifier.ts`, concrete `PolicyGovernanceExecutionVerifier` in `packages/api/src/governance/`), wired into `RuntimeEngine.execute()` (the real single choke point for every policy evaluation — a prior implementation runbook assumed a nonexistent `packages/api/src/execution-gateway/ExecutionGateway.ts` instead) as a new optional trailing constructor param, same idiom as `signalStateVerifier`/`capabilityPolicyBinder`. A violation (no approval record / bad signature / content mismatch) becomes an ordinary `PolicyDecision` REJECT before any rule is evaluated, flowing through the existing refusal-recording and fail-closed enforcement path unmodified. Feature-flagged (`POLICY_EXECUTION_VERIFICATION_ENFORCED=true`), default OFF — confirmed with the user before implementing, since every real production policy is currently `PENDING_APPROVAL` (gap 39/§2.26) and an unconditional gate would refuse all of them today                                                                                                                                                                                                                                                         | `packages/api/tests/unit/PolicyGovernanceExecutionVerifier.test.ts` (4 cases), `packages/api/tests/unit/bootstrap/create-policy-execution-verifier.test.ts` (3 cases, the env-var gate), `packages/runtime/tests/e2e/runtime.e2e.test.ts` (2 new cases), `packages/runtime/tests/unit/optional-protections-logging.test.ts` (1 new case). Full repo suite: 1544 passed, 38 pre-existing skips, 0 failed. Commit `7a1aa37`                                                                                                                                                                                                                                                                                |

Full repo `npx tsc -b`, `npx eslint . --ext .ts`, and `npx vitest run` all clean after every
item above: 1544 passed, 38 pre-existing skips, 0 failed (up from 1513/1513 passed at the
session's start — net +31 is misleading in isolation; many new tests were added alongside a
small number of pre-existing tests that already covered adjacent behavior).
Python: 63 passing, 4 pre-existing timeout-under-load failures confirmed unrelated (see gap
26's entry).

**Gaps 35–39 were found and closed later the same day**, via an independently-published audit
artifact (https://claude.ai/code/artifact/0a454f3f-055c-47c1-a4ff-5401ad582dd0) rather than the
full-codebase pass that produced gaps 24–34. **Gap 40** is not a "found" gap at all but a
requested capability (execution-time prevention on top of the detection gaps 35–39 closed) —
recorded in this same table because it landed in the same session and the numbering is
otherwise continuous, not because it shares that
pass's methodology.

**Explicitly not fixed this session, tracked separately:** NF-001 (upstream authorization
verification, a delegation-layer design question, not a bug — see
`NF-001-UPSTREAM-AUTHORIZATION-VERIFICATION.md`) and NF-005 (HubSpot approval issuer
provisioning) — see "Decision required" below for both.

---

## Gaps closed in the 2026-07-17 audit closeout session

Scope: nine tasks closing findings from the July 16 external audit. Full closing report is
this session's final message to the user; summarized here for the trust-artifact record.

| #   | Gap                                                                                                                                                                                                                                                                                                                   | Closed by                                                                                                                                                                                                                                                                                                                   | Verified                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 12  | `.gitignore` was mixed UTF-16LE/ASCII; git could not parse part of it, which is how `trace.txt` got committed                                                                                                                                                                                                         | Rewrote `.gitignore` as clean deduplicated UTF-8/ASCII, recovering every rule from both encoded segments and adding the missing `trace.txt`/`*.trace` rules                                                                                                                                                                 | `file .gitignore` reports ASCII text; `git check-ignore -v` passes for every representative path including a nested `trace.txt`                                                                                    |
| 13  | Committed debris: 1.6MB `trace.txt`, a pasted-transcript `claim.md`, stray root `resume.md`/`pending.md`, and a misplaced root `vendor-payment.json`                                                                                                                                                                  | Deleted `trace.txt` and `claim.md`; archived `resume.md`/`pending.md` content to `docs/sessions/2026-07-11-remaining-enterprise-productization.md` and `docs/sessions/2026-07-07-milestone-1b-note.md`; moved `vendor-payment.json` to `examples/vendor-payment.json`                                                       | `git status` shows the deletions/move; no remaining references to the old paths found by repo-wide grep                                                                                                            |
| 14  | `PARMANA_POLICY_DIR` was read via a non-null assertion; unset, it surfaced as `ERR_INVALID_ARG_TYPE` inside `FilePolicyRepository.load` at request time, not at startup                                                                                                                                               | `packages/shared/src/config/Config.ts`'s `loadConfig()` now validates it at startup, same fail-closed discipline as caller-auth keys                                                                                                                                                                                        | `packages/shared/tests/unit/config.test.ts` (new, 3 tests): refuses to start when unset, refuses when blank, loads the configured value                                                                            |
| 15  | No canonical list of environment variables the system reads; several were undocumented anywhere (see G-11)                                                                                                                                                                                                            | Added `.env.example` at repo root, one entry per `process.env.*` read confirmed by grep across `packages/*/src`, safe placeholders only                                                                                                                                                                                     | Manually cross-checked against every `process.env.` call site in `packages/*/src`                                                                                                                                  |
| 16  | `engines.node` declared `>=22` while the ML-DSA-65 (dilithium3) signature provider requires Node >=24 (native `node:crypto` support); on Node 22/23 the affected tests failed rather than skipping with an explanation                                                                                                | `engines.node` raised to `>=24` in the root `package.json` and the three packages that touch ml-dsa-65 (`crypto`, `execution-gateway`, `envelope-verifier`); added `isMlDsa65Supported()`/`ML_DSA_65_SKIP_REASON` (`@parmana/crypto`) and wired `describe.skipIf`/`it.skipIf` into all 5 affected test files                | All 5 files pass on Node 24 (24 tests); on an unsupported Node build the same tests report skipped with the reason in the test name instead of failing                                                             |
| 17  | No CI ran the main test suite on push or pull request (`.github/workflows/` had only `python-sdk.yml`), which was gap **G-2** below                                                                                                                                                                                   | Added `.github/workflows/ci.yml`: Node 24, `npm ci`, `npm run build`, a terminology-regression grep guard, then `npm test`; explicit env vars only, no dependency on any `.env` file                                                                                                                                        | YAML validated by parsing with the repo's own `yaml` dependency; the terminology-guard grep and each step verified locally against the actual repo tree                                                            |
| 18  | `createApp`'s `callerAuth` option was optional; omitting it silently mounted the API with no caller authentication, and every pre-existing test relied on that omission                                                                                                                                               | `callerAuth` is now a required option: either `{ authenticator, auditSink }` or the literal string `"disabled"`. `server.ts` and all 21 dependent test files (via the shared `tests/test-app.ts` singleton, plus the two direct call sites in `credential-isolation.integration.test.ts`) now state their choice explicitly | Full `packages/api` suite: 85 passed, 1 skipped (Supabase-gated), 0 failed other than the pre-existing live-Supabase-network gap (G-3, unrelated)                                                                  |
| 19  | The retired term "execution governance" remained in 14 files (`GOVERNANCE.md`, `typescript/docs/06-09`, `docs/architecture/EXECUTION-FLOW-AUDIT.md`, `docs/architecture/KEY-MANAGEMENT.md`, `docs/rfcs/RFC-0012`, `docs/00-introduction/PROBLEM.md`, `docs/specifications/reference-policies.md`, plus this document) | Replaced with "execution authorization" / "AI Execution Authorization" in 12 of the 14 (see exclusions below); added a CI grep guard so it cannot silently reappear                                                                                                                                                         | Repo-wide case-insensitive grep for the phrase now returns only the four intentionally-excluded files (see note below)                                                                                             |
| 20  | `FileKeyProvider` built key file paths from `keyId` with no input validation                                                                                                                                                                                                                                          | Rejects any `keyId` not matching `^[A-Za-z0-9._-]+$` before path construction, in `getPrivateKey`, `getPublicKey`, `hasKey`, and `getMetadata` (all route through the same two path-building methods)                                                                                                                       | `packages/crypto/tests/unit/file-key-provider.test.ts` (new, 5 tests): rejects a `../../../../etc/passwd`-style keyId in all four methods; accepts the well-formed `"default"` keyId used by the rest of the suite |
| 21  | Root `package.json` and `typescript/package.json` both declared `"name": "parmana"`, making plain `npm run <script>` cascade across every workspace and `npx <bin>` resolve relative to an arbitrary workspace instead of the repo root (documented in `docs/audit/CORE-API-FINDINGS-SDK-AUDITS.md` §4)               | Renamed `typescript/package.json` to `"@parmana/legacy-reference"`; ran `npm install` to resync `node_modules`/lockfile; removed the `./node_modules/.bin/tsx` workaround from `.github/workflows/python-sdk.yml`, restored to `npm run check:python-models`                                                                | `npm run typecheck` and `npm run check:python-models` at repo root now each run only the intended root script, verified directly                                                                                   |
| 22  | No LICENSE; repository intent (proprietary, evaluation-only) was undeclared                                                                                                                                                                                                                                           | Wrote `LICENSE` (source-available for evaluation, all rights reserved, contact `founder@parmanasystems.com`); updated both `# License` sections in `README.md` to match                                                                                                                                                     | None                                                                                                                                                                                                               |
| 23  | This document's "Environment note" asserted that the `.env` in a specific checkout contains live Supabase credentials, a disclosure of where live credentials exist, not just a description of the gating mechanism                                                                                                   | Rephrased to describe the `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` gating mechanism and gap without asserting where live credentials are currently present                                                                                                                                            | None                                                                                                                                                                                                               |

**Note on item 19's two exclusions:** `docs/site/how-parmana-thinks.mdx` and
`docs/site/concepts/execution-authorization.mdx` both cite an unrelated third-party academic
work actually named "Execution Governance" (Ku, 2026, EG Reference Specification v0.9.7.3)
in a "Related work" callout. Renaming that citation would misrepresent the cited work's
real name, so it was left untouched. `docs/ROADMAP-v1.md` narrates the terminology sweep
itself (quoting the retired term to describe gap G-18 there, which this session's edit to
`docs/specifications/reference-policies.md` happens to resolve as a side effect; that
roadmap document's own G-18/R6 entries were not updated, out of scope for this session). This
document (`docs/VERIFICATION-GAPS.md`) is exempted from the CI grep guard for the same
reason this section needs to name the retired term.

**No shipped npm package name or public API identifier uses "execution governance"** in any
casing (`ExecutionGovernance`, `execution-governance`, `EXECUTION_GOVERNANCE`), confirmed by
repo-wide grep. Nothing requires a decision on that front.

**Explicitly out of scope for this session, remains open:** the in-memory `NonceStore`
(`MemoryNonceStore`) and `InMemoryCallerAuditSink` both lose all state on process restart,
taking with them the replay-nonce window and the caller-authentication audit trail alike. See new gap **G-13**
below. This was not touched this session and must not be read as closed by anything above.
_(Update from a later hardening session: G-13 has since been resolved. See its entry below
for what changed and how it's verified. This paragraph is left as written at the time for an
accurate record of what this specific session did and did not do.)_

---

## Gaps closed in the Phase 3D certification session

An independent, from-scratch re-certification of the public claim _"Even if AI has valid
credentials, it still cannot execute anything your business hasn't authorized. No
exceptions"_ was performed against current repository state (treating every prior phase's
conclusion, including this document's own, as a claim to re-verify, not inherit) and is
recorded in full in `docs/architecture/phase3d-independent-authorization-certification.md`.
**Result: CLAIM FULLY CERTIFIED** for `razorpay:refund-create` and `hubspot:deal-update`,
the two capabilities actually reachable in production.

That certification disclosed eight limitations. Two were genuine, safely closable gaps and
were fixed in the same follow-up session, recorded here as new closed entries:

**G-25. Truncated credential fragments reached the caller-visible `POST /execute` response.**
`GatewayRazorpayAdapter`/`GatewayHubSpotAdapter` returned `keyIdRedacted`/`bearerRedacted`
metadata built by truncating the literal credential to its first 8 (Razorpay `key_id`) or 12
(HubSpot bearer token — the entire credential) characters. `ConnectorEvidence.ts`'s generic
metadata redaction filter (`SENSITIVE_KEY_PATTERN`, matched against key _names_) did not
match either key name, so this literal fragment passed unfiltered through
`ExecutionEvidence.attributes` into the signed Trust Record and the HTTP response body an
AI-facing caller receives. Not a bypass of any authorization decision (the fragment cannot
be used to reconstruct the full secret or skip any check on a subsequent request), but a
genuine exception to a "zero credential bytes ever reach the caller" reading of credential
isolation. **RESOLVED.** `redactRazorpayKeyId`/`redactHubSpotToken`
(`packages/connector-sdk/src/connectors/razorpay/RazorpayTypes.ts`,
`packages/connector-hubspot/src/HubSpotTypes.ts`) now return a one-way, truncated SHA-256
fingerprint (`fp_` + 12 hex chars of the digest) instead of a literal substring — the
operational "which credential executed this" signal an operator needs (same credential ⇒
same fingerprint; a rotated credential ⇒ a different one) is preserved, with zero bytes of
the actual secret reaching any caller-visible surface. `razorpay-connector.test.ts` and
`hubspot-connector.test.ts` were strengthened from asserting a specific redacted string to
asserting the full serialized response contains no substring of the real credential at all —
closing the regression-coverage gap, not merely the immediate instance. Verified:
`npx tsc -b` clean; both suites re-run, 22/22 passing; full monorepo suite re-run,
1039 passed (unchanged count), 43 skipped (+4, the next entry's new file), 0 failed.

**Extends G-24's residual closure (TD-23/Phase 3B): Razorpay daily-cumulative-cap ledger
atomicity was proven live only for the in-memory test implementation.**
`InMemoryRazorpayDailyRefundLedger.test.ts`'s 50-way concurrent-`reserve()` proof exercises
the implementation `NODE_ENV=test` wiring actually uses; the production
`SupabaseRazorpayDailyRefundLedger`'s `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`
atomicity — sound by construction, the same idiom already proven live for `consumed_nonces`
(G-13) — had no dedicated integration test issuing genuinely concurrent connections against
a real Postgres database. **RESOLVED.**
`packages/storage/tests/integration/supabase-razorpay-daily-refund-ledger.integration.test.ts`
(new), gated the same way every other live-database suite in this repository is
(`resolveDatabaseGate`, requiring `ALLOW_LIVE_SUPABASE=1` to run against a real project — not
opted into during this session, so not executed live; confirmed to compile and to skip
cleanly, `1 file skipped, 4 tests skipped`, exactly like its siblings), adds: a two-way race
asserting exact, non-lost-update totals; a 20-way concurrent-reservation proof matching the
in-memory implementation's own proof in kind; and a `release()`-floors-at-zero case (the
schema's `chk_reserved_paise_non_negative` constraint).

**Explicitly not closed by this session, carried forward with reasons (full detail in
`phase3d-independent-authorization-certification.md` §12, items numbered to match that
section exactly):**

- **(§12.1) `payments:execute`/vendor-payment would not satisfy this claim if it were ever
  enabled in production.** Already tracked in this document's own "Investigation
  (2026-08-04): `vendor-payment` remains genuinely blocked" entry above (`vendorVerified`,
  `invoiceVerified`, `paymentApproved`, `sufficientFunds`, `riskScore` remain pure
  caller-declared attestations with no independent verifier and no real system to fetch them
  from) — the certification independently re-confirmed that finding from current source
  rather than merely citing it, and it remains out of scope for this session for the same
  reason: it is not currently a production capability (§2 of the certification), so it
  cannot presently violate the claim, but enabling it as currently written would.
- **(§12.3) HubSpot's `TRUSTED_APPROVAL_ISSUERS`** (`createApprovalIssuerRegistry.ts`)
  remains empty by design; the Signed Approval Artifact mechanism has never been exercised
  against a real, operator-provisioned issuer key in production. Fail-closed, not a
  weakness — and provisioning a real approver key is inherently an operational action, not
  something a code change can substitute for.
- **(§12.5) `GatewayAttestation`** still has no independent expiry/TTL of its own, relying
  on the durable execution-authorization nonce upstream (§6.4 of the certification).
  Deliberately not touched — a shared, foundational crypto primitive; adding a new
  replay-defense mechanism to it is exactly the kind of change this codebase's own
  established practice (Phase 2L's STOP conditions) treats as needing its own chartered
  phase, not a same-session edit, especially with no currently exploitable path found
  through it.
- **(§12.6) The internal gateway-session/session-credential-vault layers** remain
  in-memory, single-process only. Deliberately not touched — persistent/shared storage for
  this layer is infrastructure work of the same shape `02-REMAINING.md` already tracks as a
  dedicated "big rock" (nonce-store persistence), and this layer is downstream of the
  already-durable, load-bearing nonce check.
- **(§12.7) `OverrideService`/`OverrideVerifier`** (G-5, below) remain unreachable dead
  code. **Deliberately, explicitly not wired up** — `02-REMAINING.md`'s own Tier 0 entry
  for this component is a standing security guard reading "do NOT wire overrides" until its
  documented deficiencies are fixed with a design partner's input. Wiring it to "close" G-5
  would directly contradict that guard.
- **(§12.8) Hybrid/PQ signing's scope** (G-4) still stops short of
  execution-authorization/Gateway/connector signing — already tracked there as a
  separately-chartered expansion project, unrelated in kind to this session's scope.

None of these six carried-forward items provide a currently exploitable path for an AI
holding valid credentials to execute an action the business has not authorized, per the
certification's adversarial review (§10 of that document).

---

## Gaps checked and found not applicable

- **Gateway session store concurrency**: `InMemoryGatewaySessionStore.consume()` is fully
  synchronous (not even `async`), so two "concurrent" calls cannot interleave in any sense:
  Node calls them one after another, unconditionally. The existing sequential
  "rejects a reused session" test already covers everything the synchronous case can prove;
  a `Promise.all` wrapper around a synchronous method would not test anything additional.

- **Direct database-write bypass of `RuntimeEngine`.** Raised as `NOT VALIDATED (to full
exhaustiveness)` by the Strategic Positioning source-code validation audit (2026-08-09),
  which had traced every HTTP route and both SDKs but not every method of every repository
  implementation. Closed by tracing every write method on `ExecutionTrustRecordRepository`
  (`create`, `appendExecution`, `replaceExecution`, `appendOverride`, `appendVerification`,
  `appendReceipt`, `appendSettlementConfirmation`) and `BusinessTransactionRepository`
  (`accept`/`create`) to its callers, repo-wide: every one has exactly one caller, always
  inside `packages/runtime/src/services/*` or `ExecutionTrustApplication`
  (`appendSettlementConfirmation`'s sole caller, `RazorpaySettlementProcessor.ts:203`, is
  itself gated by an independent re-fetch of real Razorpay state before writing, not
  caller-triggered directly). Zero routes in `packages/api/src/routes`, zero SDK methods in
  `typescript/src`/`python/parmana`, write to either repository directly. **Now DIRECTLY
  VALIDATED**, not merely unvalidated-but-presumed-clean: `docs/CLAIMS.md` 2.22's "no code
  path that does not pass through `RuntimeEngine`" scope is confirmed to extend to the
  storage layer as well, not only the HTTP/connector-dispatch layer that document's own
  bypass search (Phase 3D §5.2) already covered.

- **`SessionCredentialVault`/`InMemoryGatewaySessionStore` not surviving a restart or
  scaling past one instance** (2026-09-10 production-readiness session). An external audit
  framed this as a gap alongside the `/execute` rate limiter (see G-41 below, which _is_
  real). Traced both objects' actual lifecycle before accepting that framing:
  `InMemorySessionCredentialVault.issue()`/`.consume()`/`.revoke()` all run inside one
  `try`/`finally` in `SessionCredentialSecureConnector.execute()`
  (`packages/execution-control/src/SessionCredentialSecureConnector.ts`), and
  `InMemoryGatewaySessionStore.create()`/`.consume()` both run inside one synchronous call
  chain in `ExecutionControlService.execute()` and `DefaultConnectorPolicy.assertAllowed()`.
  Confirmed directly: `sessionCredentialId` and `GatewaySession.sessionId` are never
  returned in any `POST /execute` response body (`packages/api/src/routes/execute.ts` has
  no reference to either), and there is no second HTTP endpoint that could later present one
  back to this process -- `POST /execute` is the only route that ever touches either store.
  A process restart mid-request fails that one in-flight request the same way any in-flight
  computation would, database-backed or not; there is no scenario where a session/credential
  created by one instance is ever consumed by a different request, process, or instance.
  Persisting either to Postgres would add a database round trip inside the hot `/execute`
  path for no correctness benefit, and would introduce a new failure mode (a database
  hiccup now blocks every execution that previously succeeded purely in-memory). This
  independently confirms -- via direct code tracing, not by citing it -- the Phase 3D
  certification's own §12.6 conclusion above ("this layer is downstream of the already-
  durable, load-bearing nonce check"): correctly in-memory by design, not an unaddressed
  gap. Not fixed; nothing to fix. See G-41 for the one genuinely real durability gap this
  same external audit correctly identified (the rate limiter).

- **Paytm connector should fail startup if unconfigured at all, not only if partially
  configured** (`GAPS.md`, GAP-2, 2026-09-14). The proposed fix was a new `EXECUTION_MODE`
  environment variable (`payment` vs `auth-only`) that would make full absence of
  `PAYTM_CONNECTOR_URL`/`PAYTM_CONNECTOR_SHARED_SECRET` a startup error under payment mode,
  rather than the current warn-and-omit. Checked against `assertPaytmConnectorConfigured.ts`
  (`packages/api/src/bootstrap/`, called from `server.ts` before the port ever binds) before
  building anything: that file already fails closed, hard, at startup, on the one
  configuration state that is actually dangerous — _partial_ configuration (`PAYTM_CONNECTOR_URL`
  set without `PAYTM_CONNECTOR_SHARED_SECRET`, or vice versa; also plaintext HTTP in
  production). Its own doc comment states, deliberately, that full absence is intentional and
  acceptable: "The Paytm connector is optional in any given deployment ... exactly like
  HubSpot/GitHub." That is a considered design decision already present in the codebase, not
  an oversight the audit found — the audit's proposed fix would have reversed it for every
  deployment, on the unstated assumption that this specific deployment requires payment
  capability to always be present, which nothing in this codebase or the audit establishes.
  **Not fixed; nothing to fix**, per the same "found real, but framed differently than
  proposed" pattern as the entry above. If a specific deployment ever does need "boots without
  Paytm capability" to be a hard startup error, that is a one-line, opt-in flag to add at that
  point (e.g. `REQUIRE_PAYTM_CONNECTOR=true`) — deliberately not built speculatively here,
  since no deployment has stated that requirement.

---

## Gaps closed in the 2026-09-10 production-readiness session

Scope: an external code-derived production-readiness audit (`PARMANA-EXP-GAPS-FOR-
PRODUCTION.md`, gitignored per this repo's `PARMANA-*.md`/`GAP-*.md` convention for scratch
audit deliverables) named 13 items, none critical, across HIGH/MEDIUM/LOW priority. Every
item was independently re-verified against current source before being acted on (not taken
on the audit's word) -- see the "found not applicable" entry directly above for the one
item this re-verification overturned.

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Closed by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 40  | `KEY_PROVIDER` accepted `aws-kms`/`azure-key-vault`/`gcp-kms`/`hsm` as valid config values (`packages/shared/src/config/KeyProviders.ts`), but `KeyBootstrap.create()` (`packages/crypto/src/KeyBootstrap.ts`) always constructed `FileKeyProvider` regardless -- an operator setting `KEY_PROVIDER=aws-kms` expecting real KMS custody got private-key-on-disk instead, with no error                                                                   | `KeyBootstrap.create()` now throws for any value other than `"local"`, naming the value and stating that only `FileKeyProvider` is implemented. Commit `624adf7`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `packages/crypto/tests/unit/key-bootstrap.test.ts` (7 cases: defaults to local when unset; local explicit; each of the 4 unimplemented values throws naming both the value and "not implemented"; an unrecognized value is rejected earlier, at config-parse time, before `KeyBootstrap` is even reached)                                                                                                                                                                                                                                       |
| 41  | `POST /execute` and `GET /health`/`GET /ready`'s rate limiters used `express-rate-limit`'s default in-process `MemoryStore` -- each machine in a horizontally-scaled deployment counts independently, so the effective ceiling for a caller is `limitPerMinute * machineCount`, not the fleet-wide limit `docs/CLAIMS.md` 3.14 already documented as the scope caveat. Safe only because `fly.toml` pins `min_machines_running = 1` today                | New `PostgresRateLimitStore` (`packages/storage/src/postgres/PostgresRateLimitStore.ts`), a real `express-rate-limit` `Store` backed by an atomic `INSERT ... ON CONFLICT` upsert (new migration `supabase/migrations/20260910120000_add_rate_limit_counters.sql`). Wired via `createRateLimitStore.ts`: used when `DATABASE_URL` is configured; falls back to the in-process default with a loud startup warning otherwise (deliberately not fail-closed like the NonceStore -- a missing shared rate-limit store loosens a capacity control, it does not remove a security check, so refusing to start over it would break every single-instance/local deployment that works correctly today). Commit `2d643ca`                                                                                                                                                                                                                                                          | `packages/storage/tests/unit/postgres-rate-limit-store.test.ts` (7 cases, including window-rollover and independent-keys behavior against a fake `pg.Pool` that implements the real upsert semantics in JS), `packages/api/tests/unit/bootstrap/create-rate-limit-store.test.ts` (3 cases: test/production-without-DATABASE_URL/production-with-DATABASE_URL branches), existing `packages/api/tests/integration/rate-limit.integration.test.ts` (8 cases) unaffected                                                                           |
| 42  | No load testing existed anywhere in the repo -- the system had never been proven to hold up under concurrent `/execute` load, and `.env.example`'s own rate-limit defaults are labeled "sized for a design-partner evaluation deployment, not high-volume production traffic"                                                                                                                                                                            | New `npm run loadtest` (`scripts/load-test.ts`, `autocannon`-based): boots the real server (`NODE_ENV=test`, in-memory storage, caller-auth disabled) and benchmarks `GET /health`, `GET /ready`, and `POST /execute` (real policy evaluation against `policies/vendor-payment`, real Ed25519 signing, real connector execution) at configurable concurrency/duration. Commit `c32a861`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Actually run (10 connections, 5s): `POST /execute` sustained ~51 req/s, p50 188ms / p99 444ms, zero errors, zero non-2xx. Scope stated in the script's own header comment: measures policy/signing/connector overhead under concurrency, not the caller-auth or rate-limiter middleware layers (both disabled for this run) or a durable-storage-backed deployment -- this does not change `README.md`'s existing "sustained volume, load-bearing traffic... not claimed" scope statement, one run is not a volume proof                        |
| 43  | `.env.example` shipped `PARMANA_AUTH_DISABLED=true` uncommented -- a first-time operator who copies it to `.env` without reading every line deploys with caller authentication off. The existing startup `console.warn` (`createCallerAuthenticator.ts`) is easy to miss in a log-aggregation tool after the fact                                                                                                                                        | `.env.example`'s `PARMANA_AUTH_DISABLED` line commented out (defaults to the safe `"false"` the code already falls back to). `GET /ready`'s JSON response now carries `authDisabled` (plus a `warning` string when true) -- a field an operator's own monitoring/synthetic checks (already polling this endpoint every 30s per `fly.toml`) can assert and alert on, not just a log line. Commit `263387b`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `packages/api/tests/unit/routes/ready.test.ts`, 2 new cases (`authDisabled: true` with a warning string when caller-auth is disabled; `authDisabled: false` with no `warning` key when enabled)                                                                                                                                                                                                                                                                                                                                                 |
| 44  | `createGatewayIdentity.ts` hardcoded `gatewayId`/`publicIdentity` to the literal `"parmana-gateway"` with a `TODO: Replace these placeholder values`, blocking more than one logically distinct gateway identity against the same audit trail. `createSessionStore.ts`'s same-process `gatewaySessionIssuanceAuthentication` capability token was a bare `Object.freeze({})` with a `TODO: Replace with the production authentication mechanism` comment | `gatewayId`/`publicIdentity` now configurable via `PARMANA_GATEWAY_ID` (mirrors the existing `PARMANA_GATEWAY_KEY_ID` pattern), validated against the same safe character set `FileKeyProvider`'s `keyId` guard uses, defaulting to the same literal. `gatewaySessionIssuanceAuthentication` is now `Object.freeze({ token: randomUUID() })`; reference identity (not the value's contents) was always the actual mechanism, so this closes the "unaddressed TODO" appearance rather than a real gap -- the comment now says so plainly instead of carrying a stale TODO. Commit `2761548`                                                                                                                                                                                                                                                                                                                                                                                 | `packages/api/tests/unit/bootstrap/create-gateway-identity.test.ts` (3 cases: default value, `PARMANA_GATEWAY_ID` override, rejects an unsafe value)                                                                                                                                                                                                                                                                                                                                                                                            |
| 45  | HubSpot's Private App token (`HUBSPOT_PRIVATE_APP_TOKEN`) is a long-lived static credential with no built-in expiry, unlike GitHub's ephemeral per-execution token -- an architectural property, not a bug, but nothing enforced or reminded anyone to rotate it                                                                                                                                                                                         | New `warnIfHubSpotTokenStale()` (`packages/api/src/bootstrap/warnIfHubSpotTokenStale.ts`), called once at startup from `createConnectorRegistry.ts`: warns if the token is configured but `HUBSPOT_PRIVATE_APP_TOKEN_ROTATED_AT` is unset (age untrackable), and separately if the recorded rotation date is more than 90 days old. Reminder, not enforcement -- this process cannot itself revoke or replace a HubSpot-side token; only a human with HubSpot admin access can. Commit `33d96b3`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `packages/api/tests/unit/bootstrap/warn-if-hubspot-token-stale.test.ts` (5 cases: not configured, unset rotation date, unparseable rotation date, recent rotation silent, stale rotation warns with the actual age)                                                                                                                                                                                                                                                                                                                             |
| 46  | No dedicated compliance/bulk-audit-export endpoint existed. `GET /trust-records/:id` (single-record) and `GET /transactions` (raw `BusinessTransaction`, no execution/verification/receipt history) were the closest things, neither sufficient for periodic external audit review                                                                                                                                                                       | New `GET /trust-records`: returns the complete signed Execution Trust Record (transaction, executions, verifications, receipts, authorization) for every transaction on the requested page. Scoping/pagination deliberately mirror `GET /transactions` exactly (same `page`/`pageSize` params, same post-fetch `submittedBy` ownership filter, same bare-array response shape); adds `since`/`until` (ISO 8601) to filter by `transaction.createdAt`. `ExecutionTrustApplication.listTrustRecords()` implements this by paginating the existing `BusinessTransactionService.list()` and resolving each entry via the existing `findByTransactionId()` -- deliberately not a new repository-level `list()` method, since every transaction has exactly one Trust Record and this avoids requiring every `ExecutionTrustRecordRepository` implementation to grow new query surface. Documented in `openapi/openapi.yaml` (`operationId: listTrustRecords`). Commit `2aa585f` | `packages/api/tests/unit/trust-record-api.test.ts`, 3 new cases (empty before any execution; returns the full record after one, matching the `/execute` response's own `trustRecordId`; `since`/`until` filtering). `npm run lint:openapi` clean                                                                                                                                                                                                                                                                                                |
| 47  | `packages/governance-ui`'s `POST /login` -- this codebase's only unauthenticated route that validates a submitted credential against the real API -- had no rate limiting at all, a credential-stuffing/brute-force vector the real API itself doesn't have (no "try a key and see" endpoint exists there)                                                                                                                                               | Added `express-rate-limit` (10 attempts/minute, IP-keyed -- no caller identity exists yet at this point), constructed per-router rather than at module scope so each app instance gets its own counter. Reviewed the rest of `governance-ui`'s security posture in the same pass and found it already solid: session-fixation hardening (regenerate on login), `httpOnly`/`secure`/`sameSite` cookies, and XSS-safe rendering of attacker-controlled `reason`/`proposedBy` fields were all already correct (this package was not in scope for the original Phase 3D/2026-07 audits, which focused on `packages/api`). Commit `373a020`                                                                                                                                                                                                                                                                                                                                     | `packages/governance-ui/tests/integration/app.integration.test.ts`, 1 new case: 11 sequential `POST /login` attempts, the 11th returns 429                                                                                                                                                                                                                                                                                                                                                                                                      |
| 48  | `LOG_LEVEL` was read into config (`Config.ts`) but nothing in the codebase gated any output on it -- every `console.*` call site (17 source files) fired unconditionally regardless of its value, with ad hoc log shape (a bare string here, a structured object there)                                                                                                                                                                                  | New `createLogger(level)`/`getLogger()` (`packages/shared/src/logging/Logger.ts`): debug/info/warn/error methods, each a no-op below the configured minimum level, emitting one JSON line per call. `getLogger()` is a lazy, process-wide singleton built from `loadConfig().logging.level`, the same shape `KeyBootstrap.create()`/`CryptoBootstrap.create()` already use. Commit `147a366`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `packages/shared/tests/unit/logger.test.ts` (5 cases: level gating, stdout/stderr routing, unrecognized-level fallback, structured-field round-trip, singleton identity)                                                                                                                                                                                                                                                                                                                                                                        |
| 49  | `npm audit` found 12 vulnerabilities (3 high, 9 moderate) across the dependency tree, none previously reviewed as a batch                                                                                                                                                                                                                                                                                                                                | `qs` (moderate, array-limit bypass + DoS): `express@4.22.2` pinned it to `~6.15.1` (still vulnerable at 6.15.3), unresolvable by `npm audit fix` alone -- added a root `"overrides"` entry forcing `qs@^6.16.0` everywhere, then `npm dedupe`. `vitest`/`@vitest/coverage-v8` (moderate, path traversal via `@vitest/mocker`): bumped `^4.1.9` -> `^4.1.11` across the root and all 17 workspace `package.json` files (non-breaking patch). `express`, `body-parser`, `js-yaml`, `nanoid`, `brace-expansion` resolved as a side effect via `npm audit fix`. Commit `669b198`                                                                                                                                                                                                                                                                                                                                                                                               | `npm audit` after: 3 moderate remain (`autocannon` -> `hyperid` -> `uuid`), entirely from this same session's new `loadtest` devDependency (gap 42) -- no non-breaking fix exists upstream, and confirmed dev-only, never installed in the production image (`Dockerfile`'s `prod-deps` stage runs `npm ci --omit=dev`). Full workspace `npx tsc -b --force`, `npm run typecheck`, `npm run lint`, `npm run format:check` (for every file this session touched) all clean; `npx vitest run`: 1613 passed, 38 pre-existing gated skips, 0 failed |

Full session verification: every commit above was individually rebuilt (`npx tsc -b`) and
tested before the next change began; a final full-workspace `npx tsc -b --force` plus
`npx vitest run` after all nine commits landed reports 1613 passed, 38 skipped, 0 failed
(two isolated re-runs of the three tests that failed under full-suite parallel resource
contention -- `execution-pipeline-latency.test.ts`'s p99 bound and two `typescript/test/
integration/*` server-startup hooks -- both passed cleanly standalone, confirmed
pre-existing environmental flakiness unrelated to this session's changes, not a
regression).

**Explicitly not closed this session, tracked separately:**

- **CI's `verify-policy-approvals` maker-checker gate remains advisory only**, not a
  required GitHub branch-protection status check. Attempted directly, not assumed: `gh api
repos/{owner}/{repo}/branches/main/protection` returned a live 403 -- "Upgrade to GitHub
  Pro or make this repository public to enable this feature." This is a real external
  platform/billing constraint, not a configuration oversight this session could resolve --
  see D-6 below.
- Key-rotation tooling automation and splitting the settlement poll loop into its own
  container (the original external audit's own LOW-priority items 10 and 13) were left
  deferred, matching that audit's own framing of both as "nice to have"/"not urgent."

---

## Gaps closed in the 2026-09-11 real-deployment verification session

Scope: adding and exercising a new authorization-only policy (`agent-vendor-payment`)
end-to-end against a real, live environment -- a new Vercel deployment of the real API
(`parmana-api-real`, not the standalone buildathon demo), the real `parmana-sandbox`
Supabase project, and real caller authentication -- rather than the in-memory/mocked
paths the existing test suite exercises by default. This is the first time this specific
combination (real Postgres-backed `CallerAuditSink`, `PARMANA_AUTH_DISABLED=false`, a
public deployment) has been exercised, which is what surfaced gap 50 below.

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Closed by                                                                                                                                                                                                                                                                                                                 | Verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 50  | `caller_audit_events.type` CHECK constraint (last widened by `20260824090000_add_structural_rejected_to_caller_audit_events.sql`, gap 21's own predecessor chain: 20260812120000, 20260816120000, 20260818130000) never included `'caller.capability_granted'`, even though `packages/api/src/routes/execute.ts` and `transactions.ts` (gap 33 / `docs/CLAIMS.md` NF-004) both write that exact event type unconditionally on every successful, authenticated capability check. Combined with `docs/CLAIMS.md` 2.19's fail-closed audit-write guarantee, this meant every successful, authenticated `POST /execute` or `POST /transactions` call, against a real Postgres-backed audit sink, failed closed with `503 AUDIT_UNAVAILABLE` before Policy Engine evaluation ever ran -- the entire capability-granted happy path was unreachable in that configuration. Invisible in the existing test suite because Supabase-backed integration tests are opt-in (`ALLOW_LIVE_SUPABASE=1`); `InMemoryCallerAuditSink` has no such constraint | New migration `supabase/migrations/20260911090000_add_capability_granted_to_caller_audit_events.sql`, widening the constraint the same way each of its four prior widenings did, adding `'caller.capability_granted'` to the allowed list. Applied directly to `parmana-sandbox` via `supabase db push`. Commit `1eb8881` | Reproduced live: an authenticated `POST /execute` against the real deployed API (`https://parmana-api-real.vercel.app`, real `parmana-sandbox` project, `PARMANA_AUTH_DISABLED=false`) returned `503 AUDIT_UNAVAILABLE` with `error: 'new row for relation "caller_audit_events" violates check constraint "caller_audit_events_type_check"'` before the fix. After applying the migration, the identical request reached Policy Engine and produced a real signed decision -- confirmed both for an approved-amount request (reaches the connector-dispatch stage, see below) and a denied one (clean `403 POLICY_DENIED`, persisted, retrievable via `GET /transactions`) |

**New policy, deliberately authorization-only (G-27 parity).** `policies/agent-vendor-payment/1.0.0/policy.json` was added and exercised end-to-end (real `PolicyEngine`, real Ed25519 signing, real Supabase-backed `ExecutionTrustRecordRepository`/`BusinessTransactionRepository`, both locally and against the live deployment above) as part of this same pass. Its signals (`vendorAllowed`, `withinCredentialLimit`, `withinVelocityLimit`) are unbound, caller-declared attestations with no independent verifier -- structurally the same shape G-27 (below) found in `vendor-payment` and closed by removing its connector from production entirely. This policy was deliberately left the same way: `GatewayConnectorRegistry` has no registration for `agent-vendor-payment`, so a request that reaches Policy Engine APPROVAL still correctly fails at the execution/dispatch stage (`No connector registered for capability 'agent-vendor-payment'`) rather than completing, both locally and on the live deployment. Confirmed no partial Execution Trust Record is left behind when this happens: `GET /trust-records/:businessTransactionId` on the live deployment returned `404` for the approved-but-undispatched transaction. This is authorization-only by design, not an oversight -- see G-27's own "What would need to be true before this capability could be enabled" section for what independent signal verification would require before any real connector could be wired for a payment-shaped capability.

**Also found and fixed in this same session, local-environment/deployment configuration only (not codebase gaps):** the checkout's `.env` had `PARMANA_POLICY_DIR` pointing at a sibling checkout (`D:/last/parmana-exp/policies`) rather than this repository's own `policies/` directory -- corrected to `./policies`. Separately, Supabase's direct-connection host (`db.<ref>.supabase.co:5432`) is IPv6-only and unreachable from Vercel's serverless network (`ENOTFOUND`); the new deployment's `DATABASE_URL` uses the Supavisor connection pooler host (`aws-0-<region>.pooler.supabase.com:6543`, `postgres.<ref>` as the username) instead. Neither is a defect in `parmana-exp` itself.

---

## Gaps closed in the 2026-09-11 PQC production-readiness audit remediation

Scope: closing all four RED findings from that same day's earlier post-quantum cryptographic production-readiness audit (independent third-party verification, public-key discovery, durable-evidence key rotation, hybrid-signature downgrade resistance). Every fix was verified by an executed test, not by code review alone; every new capability was exercised against real signed artifacts, not mocked ones.

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Closed by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 51  | **RED-1 (offline verifier).** Every verification capability in this codebase -- the unauthenticated `POST /verify`/`/audit/verify`/`/refusal/verify` routes, and both the TypeScript and Python SDKs' `VerificationApi` wrappers -- was a remote call into Parmana's own server. No standalone function anywhere took a signed artifact plus a public key and checked it with zero network access. (Correction to this audit's own first pass: an external, independently maintained, already-published package, `@parmana/sign` (`github.com/pavancharak/parmana-sign`, real and verified via `gh api`), already provides genuinely offline verification of the classical signature -- but it does not know Parmana's specific Execution-Trust-Record canonical field mapping, and does not recognize the `signatures`/`schemaVersion` hybrid envelope, so it cannot fully verify a real, hybrid-signed Parmana artifact on its own.)       | New `packages/crypto/src/OfflineVerifier.ts` (`verifyExecutionTrustRecordOffline`), exported from `@parmana/crypto`: zero disk/network/env-var access, takes public keys directly, verifies the legacy signature and (when present) every entry in a hybrid `signatures` array. Shares its canonical field mapping with the online `VerificationCrypto` via new `ExecutionTrustRecordCanonicalView.ts` (extracted, not reimplemented, so the two can never silently drift apart). CLI: `scripts/verify-trust-record.ts`. Python counterpart: `python/parmana/crypto/offline_verifier.py` (Ed25519 only -- the installed `cryptography` version has no `ml_dsa` module; stated plainly in its own docstring rather than silently omitted)                                                                                                                     | `packages/crypto/tests/unit/offline-verifier.test.ts` (7 cases: valid record, tampered payload, wrong key, missing key material, unsupported algorithm, valid hybrid, stripped-hybrid). CLI proven against a real record signed by the real online `VerificationCrypto` (valid, then correctly rejects a hand-tampered copy). Cross-language determinism proven for real, not assumed: `python/tests/test_offline_verifier.py` spawns the real TypeScript signer as a subprocess and verifies its output using only the independent Python reimplementation -- 2 cases, including a payload containing a non-ASCII character specifically to stress-test canonical-serialization parity                                                                                                                                               |
| 52  | **RED-2 (public-key discovery).** No `/keys`, `/.well-known/*`, or JWKS-shaped route existed anywhere in `packages/api/src/routes/` -- a third party had no self-service way to obtain Parmana's public key at all, even with an offline verifier in hand. Found and fixed alongside it: `FileKeyProvider.getMetadata()` returned `config.crypto.primarySignatureProvider` (a single global config value) as "the" algorithm for _any_ keyId requested -- wrong for every key other than whichever one happens to match today's config (the `gateway` key, or any rotated `verification-*` keyId from gap 53 below)                                                                                                                                                                                                                                                                                                                          | New `GET /keys/:keyId` and `GET /.well-known/jwks.json` (`packages/api/src/routes/keys.ts`), mounted unauthenticated like `/refusal/verify` and `/audit/verify` -- a credential-gated route cannot be how a third party gets the credential-free key it needs. Returns the key as PEM (RFC 7468, what both offline verifiers above consume) plus, where Node's own `KeyObject.export({format:"jwk"})` supports the algorithm, a `jwk` field (Ed25519 as kty `OKP`, ML-DSA-65 as kty `AKP` -- the real IETF JOSE/COSE-track key type, not invented here). `getMetadata()` fixed to derive algorithm from the key material's own `asymmetricKeyType`, not global config. New `FileKeyProvider.listKeys()` (optional on the `KeyProvider` interface, so no existing test fake breaks) enumerates every `*.public.pem` in the key directory for the JWKS listing | `packages/crypto/tests/unit/file-key-provider.test.ts` (2 new cases: `getMetadata` reports a key's real algorithm even when `PRIMARY_SIGNATURE_PROVIDER` is configured to something else; `listKeys` lists exactly the provisioned keys). `packages/api/tests/integration/keys.integration.test.ts` (5 cases, including one proving the full RED-1+RED-2 combination: a key fetched over real HTTP verifies a real signed record with the offline verifier, zero further server calls). Manually reproduced end to end against a running local server too: `GET /keys/default`, `GET /.well-known/jwks.json`, and a record fetched from `GET /trust-records/:id` verified with `scripts/verify-trust-record.ts` using only the fetched key -- all correct. `openapi/openapi.yaml` documents both routes; `npm run lint:openapi` clean |
| 53  | **RED-3 (durable-evidence key rotation).** `VerificationCrypto`, `RefusalCrypto`, and `AuditEventCrypto` -- the signers for Trust Records, Refusal Records, and Audit Events, the durable evidence an auditor actually queries later -- all hardcoded the literal keyId `"default"` for every new signature, with no way to point new signing at a different key without overwriting `default.private.pem`/`default.public.pem` in place. Reproduced empirically before any fix existed: sign a record, regenerate the "default" keypair (the only rotation the code as it stood actually supported), re-verify the original record -- fails. `docs/architecture/KEY-MANAGEMENT.md` separately documented a `generate/load/save/export/import/rotate/list/delete` `KeyProvider` API that has never existed in code -- `FileKeyProvider` implements only four of those eight methods, and `rotate()` does not exist anywhere in this codebase | New `currentVerificationKeyId()`/`currentVerificationSecondaryKeyId()` (`packages/crypto/src/KeyProvider.ts`), read fresh on every signing call from `PARMANA_VERIFICATION_KEY_ID`/`PARMANA_VERIFICATION_SECONDARY_KEY_ID` (unset falls back to the unchanged literal `"default"`/`"default-secondary"`), mirroring `createGatewayKeyPair.ts`'s existing `PARMANA_GATEWAY_KEY_ID` precedent exactly. All three signers now call these instead of the hardcoded constants for NEW signatures; verification is unaffected (it already resolved the public key by the record's own stored keyId, not a hardcoded "current" one). New `scripts/rotate-verification-key.ts`: generates a new keyId's key pair, never touches or deletes any existing key file, prints the env var to set                                                                          | `packages/crypto/tests/unit/verification-crypto-rotation.test.ts`: signs a record under the default keyId, "rotates" by generating a fresh keyId's key pair and pointing `PARMANA_VERIFICATION_KEY_ID` at it, signs a second record, and confirms -- with a freshly constructed `VerificationCrypto`, simulating a new process after redeploy -- that BOTH the pre-rotation and post-rotation records verify correctly under their own distinct keys. This is the automated version of the empirical reproduction above; the reproduction failed before the fix and this test passes after it                                                                                                                                                                                                                                         |
| 54  | **RED-4 (hybrid-signature downgrade).** `VerificationCrypto.canonicalRecord()` excludes `schemaVersion`/`signatures` from the hashed content, and `verifySignature()` silently falls back to legacy-only verification whenever `signatures` is absent -- proven exploitable by the codebase's own pre-existing test, `verification-service-hybrid.test.ts`'s `"still verifies a legacy-shaped record ... additive, not breaking"`, which strips both fields from a genuinely hybrid-signed record and asserts it still verifies. Baking `schemaVersion` into the hash (the naive fix) was considered and rejected: it would change the canonical bytes -- and therefore invalidate the signature -- of every record ever issued, hybrid or not, directly violating this remediation's own no-breaking-changes constraint                                                                                                                     | New `requireHybridSignature` config flag (`HYBRID_SIGNATURE_REQUIRED`, `packages/shared/src/config/Config.ts`), off by default. When enabled, `VerificationCrypto.verifySignature()` rejects outright (no legacy-only fallback) if `signatures` is absent or empty -- closing the downgrade for any deployment that opts in, with zero effect on any already-issued signature, since it is a verify-time policy decision, not a change to what is signed. Deliberately policy-gated rather than hash-based, per this remediation's own explicit before-starting decision                                                                                                                                                                                                                                                                                     | `packages/runtime/tests/unit/verification-service-hybrid.test.ts`, two new cases added alongside the original (kept, unmodified, still describing the correct default-off behavior): with `HYBRID_SIGNATURE_REQUIRED=true`, the identical stripping the original test performs now correctly fails; a genuinely complete hybrid record still verifies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Full verification: `npx tsc -b` clean; `npx eslint . --ext .ts` clean (repo-wide); `npx vitest run` (full workspace): 1653 passed, 38 pre-existing gated skips, 0 failed; `python -m pytest` (full `python/` suite): 69 passed, 0 failed. Commit `1f4b292`.

**Not fixed, by design, per this remediation's own explicit scope:** a Go reference verifier (the original remediation plan's TASK 1 as drafted) was not built -- this repository has no Go anywhere, and introducing an entire second language toolchain for one CLI was judged a real scope increase beyond "fix gaps, no redesign," confirmed with the user before starting. Python was used instead, since it already exists as a first-class SDK language here. Whether to also update the external `@parmana/sign` package (a separate, real, published, admin-accessible repository) was raised but deliberately left as a distinct decision, not folded into this remediation.

---

## Gaps closed in the 2026-09-14 execution-audit-trail hardening session

Scope: an independent audit (`GAPS.md`, written against the "Authorization Without Execution Is Just a Promise" Substack post's claims about this repository's execution gateway) found three candidate gaps in the authorization -> proof-verification -> Paytm-execution -> audit-log chain. Two were real and are closed here; the third was examined and found to already be handled by existing code, differently than the audit proposed -- see "Gaps checked and found not applicable" below.

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Closed by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 55  | **GAP-1: `ExecutionAuditSink` was in-memory only** (`MemoryExecutionAuditSink`), in production, not only in tests. `session.created`/`execution.completed`/`execution.rejected` events -- the durable record of what the Execution Gateway actually did -- were lost on every process restart and not queryable outside the running process, unlike the analogous `CallerAuditSink` fix already closed (§2.16, `docs/CLAIMS.md`)                                                                                                                                                   | New `SupabaseExecutionAuditSink` (`packages/storage/src/supabase/SupabaseExecutionAuditSink.ts`), wired via `packages/api/src/bootstrap/createExecutionAuditSink.ts`: `NODE_ENV=test` still gets `MemoryExecutionAuditSink` unchanged; every other environment fails closed at startup (`assertDatabaseUrlConfigured`) if `DATABASE_URL` is unset, else writes through `PostgresPoolFactory`, signed at write time (`AuditEventCrypto`) and chained per `authorizationId` (Postgres advisory-lock-serialized, same discipline as `SupabaseCallerAuditSink`). New migration `supabase/migrations/20260914120000_add_execution_audit_events.sql`. Also exposes `query(filter)` for regulator/operator lookups by `authorizationId`, `businessTransactionId`, `connectorId`, `type`, or date range                                                                                                                                                                                                           | `packages/storage/tests/unit/supabase-execution-audit-sink.test.ts` (12 cases: mapping, chaining, tamper-detection via `AuditEventCrypto.verify()`, query filters); `packages/api/tests/unit/bootstrap/create-execution-audit-sink.test.ts` (4 cases, mirroring `create-caller-audit-sink.test.ts`'s own fail-closed assertions); `packages/api/tests/integration/supabase-execution-audit-sink.integration.test.ts` (live-DB, `ALLOW_LIVE_SUPABASE=1`-gated, including the literal "execute -> query audit -> retrieve complete chain" the audit asked for) |
| 56  | **GAP-3: `parmana-paytm-agent` (a separate repository, `PAYTM_CONNECTOR_URL`) recorded nothing at all** for either a successful or rejected refund on its side of the trust boundary -- not even a console log -- despite already correctly verifying the Ed25519 authorization signature (ADR-0009 Phase 2B) before ever calling Paytm. `docs/CLAIMS.md` §3.22 had (accurately, at the time) described that repository's own implementation as out of this codebase's scope to build or verify; this session did both, directly in that repository, with the user's authorization | New `src/parmana/audit.ts` in `parmana-paytm-agent` (that repository's first-ever runtime dependency, `pg`): records `authorization.verified` immediately after signature verification succeeds, then `execution.completed`/`execution.rejected` after the Paytm call resolves -- two rows, not one, so a crash between verification and execution stays visible. Writes into the _same_ `execution_audit_events` table as gap 55 above, correlated by `businessTransactionId` (the only identifier both services actually share -- Parmana's own `authorizationId` is never forwarded across this wire boundary), not `authorizationId`. Deliberately unsigned/unchained (`signature_json`/`chain_hash`/`chain_position` NULL): that service holds Parmana's public key only, never a private signing key -- see two new migrations relaxing those columns to nullable and adding the `business_transaction_id` correlation column (`20260914130000_...`, `20260914140000_...`, both in this repository) | `parmana-paytm-agent`'s own `tests/unit/execute-authorized-connector-request.test.ts`: 3 new cases asserting the exact event-type sequence and recorded reason for the success path, the signature-verification-failure path (never reaches `authorization.verified`), and the Paytm-decline path. Full suite there: 40/40 passing. This repository's own `ExecutionAuditEvent`/`ExecutionControlService` changes (adding `businessTransactionId`, widening the `type` union) verified by the full monorepo suite: 592/592 passing from repo root            |

Full verification: `npx tsc -b` clean (both repositories); `npx eslint`/`npm run lint` clean (both repositories); `npx vitest run` from this repository's root: 592 passed, 42 gated skips, 0 failed; `parmana-paytm-agent`'s own `npm test`: 40 passed, 0 failed.

**Environment-caused false alarm, worth recording so it isn't repeated:** an earlier pass of this same session ran `packages/api`'s test suite via `cd packages/api && npx vitest run`, not from the repository root, and got 10 failing tests including the entire `paytm-refund.integration.test.ts` suite (`404` on `/execute`, actually a swallowed `PolicyNotFoundError` -- `.env`'s `PARMANA_POLICY_DIR=./policies` resolves relative to `process.cwd()`, which is `packages/api` from that invocation, not the repository root where `policies/` actually lives). Root package.json's own `test` script (`vitest run`, no `cd`) and CI's `npm test` both already run from the root; the failures were an artifact of an unusual invocation, not a real regression. Confirmed by rerunning identically from the root: 0 failures.

---

## Remaining gaps, by severity

**Status note, updated in the adversarial-testing hardening session that added G-24:**
every `blocks-pilot` entry (G-1, G-2, G-3, G-24) is now resolved. **This note's own prior
claim, "none describes a live, exploitable security defect," was wrong at the time it
was written**, not because anything regressed, but because G-24 was a real, live,
exploitable bypass of the core execution-authorization invariant that this document's own
internal audit process had not found; an external adversarial exercise found it. Left here
deliberately, struck through in spirit rather than silently rewritten, as the concrete
reason this document's own "re-verify before relying on it" caveat exists. Every gap still
open below (`pre-production`: G-4, G-5, G-6, G-7, G-8, G-9; `cosmetic`: G-10, G-11) is, by
its own text, either explicitly not a security defect (G-9), unreachable from any HTTP path
(G-8), disconnected from the live request path (G-6), a permanent-skip test-coverage gap
rather than a vulnerability (G-7), or a documentation/citation gap (G-10, G-11). This is
again an assessment of those entries as written, not a fresh audit pass against them, and
carries the same re-verify caveat G-24 just demonstrated the cost of skipping.

**Addendum (2026-08-24):** this status note's own gap list (G-4 through G-11) predates
several gaps added in later sessions and is not being retroactively expanded to enumerate
all of them here — see each gap's own entry for its current status. One addition from this
date is directly relevant to this note's own claim structure: **G-29** (new, `pre-production`,
below) is, like G-9, explicitly not a security defect — no request that should be rejected
executes — but unlike every other `pre-production` entry in this note's list, it is a gap
in this system's own audit/evidentiary trail, the same category of property RFC-0021
(Refusal Records) and the caller-audit-sink work exist specifically to provide. It is
open precisely because those two mechanisms both fire downstream of the point where G-29's
rejections occur, not because either mechanism has a defect. **G-29 itself was resolved
later the same day** — see its own entry below for the fix.

**Addendum (2026-09-14):** same pattern as G-29 above, twice over. **G-42** and **G-43**
(new, `pre-production`, below) are, like G-9 and G-29, explicitly not security defects — no
unauthorized execution occurs in either — but gaps in this system's own audit/evidentiary
trail: G-42 for the Execution Gateway's own events (the `ExecutionAuditSink` analogue of
G-13's already-closed `NonceStore`/`CallerAuditSink` gap), G-43 for the equivalent, and
previously total, absence of any audit trail at all in `parmana-paytm-agent`, a separate
repository this codebase forwards Paytm refund requests to. **Both were resolved the same
session they were found** — see their own entries below.

### blocks-pilot

**Stale-narrative notice, added 2026-08-24, read before relying on anything below.** The
Razorpay connector — `RazorpayConnector`, `RazorpayRefundService`,
`RazorpaySignalStateVerifier`, `RazorpayDailyRefundLedger`,
`RazorpayCumulativeRefundLedger`, `RazorpaySettlementProcessor`, and every
`packages/connector-sdk/src/connectors/razorpay/*`/`packages/api/src/bootstrap/*Razorpay*`
file this G-24 entry and its updates below cite by path — **was deliberately removed from
this codebase in its entirety on 2026-08-12** (commit `d8a6ded`, "Add HubSpot integration
evidence and update TRL assessment"; confirmed directly: `git log --all -- <any of the
paths above>` shows no file at `HEAD`). `docs/CLAIMS.md` §3.16 and §3.8/§3.9 (both now
marked "Historical: Razorpay connector removed 2026-08-12") already carry this correction;
this document did not, until now — nothing here had been touched since commit `586ea3a`,
which predates the removal, RFC-0021 (Refusal Records), caller-to-capability scoping
(`allowedCapabilities`), the principal-denied audit trail (`docs/CLAIMS.md` §3.19), and
the structural-validation audit trail (G-29 below) alike. The
narrative below is preserved as-written, unedited, as an accurate historical record of
what closed G-24 and its TD-23/RFC-0022 residuals for Razorpay _while the connector still
existed_ — but every present-tense claim in it about `RazorpaySignalStateVerifier` etc.
being "wired into production `POST /execute`" is no longer true of current `main`.
`hubspot:deal-update`/`hubspot:deal-fetch` and, since 2026-08-19,
`github:pr-fetch`/`github:pr-merge` (`docs/CLAIMS.md` §3.17) are the capabilities actually
reachable in production today; `HubSpotSignalStateVerifier` (the hubspot-deal-update
closure, further below in this same entry) remains live and current, unaffected by the
Razorpay removal. See G-30 below: the GitHub pair was never added to
`CANONICAL_CAPABILITY_POLICY_BINDINGS`, unlike HubSpot's.

---

**G-24. Policy-evaluation signals were never bound to the executed Intent: the most
severe gap found in this document, a live, reproducible bypass of the core "no
unauthorized execution" invariant, not merely an operational or data-consistency gap
like the rest of this tier. RESOLVED in the adversarial-testing hardening session that
found it.** Found via an external adversarial security exercise (not this codebase's own
internal audit process) run against a disposable local clone: `BusinessTransactionMapper.
fromRequest` (`packages/api/src/mappers/BusinessTransactionMapper.ts:34,36`) takes
`policy` and `signals` verbatim from the client request body. `SignalValidator`
(`packages/policy/src/SignalValidator.ts`) only checks that `signals` is a well-shaped
object, never that its _values_ are true. `RuntimeEngine.execute`
(`packages/runtime/src/RuntimeEngine.ts`) evaluated `PolicyEngine.evaluate(policy,
signals)` against exactly those caller-declared signals, with no server-side enrichment
or derivation anywhere in the codebase (confirmed by a repo-wide grep for
enrichment/derivation patterns at the time: zero hits). Separately, `ExecutableContent`
(`packages/shared/src/domain/executable-content.ts`), the thing `ExecutionGateway`
actually signs and executes, is built from `intent.action`/`intent.target`/
`intent.parameters`, a completely disjoint set of fields from `signals`. Nothing
cross-validated that the two described the same real-world action. `docs/CLAIMS.md`
§3.4 already documented half of this precisely, neutrally, without flagging it as a
risk: "policy is evaluated against caller-supplied signals, the same generic mechanism
vendor-payment already uses"; the authors knew signals were caller-supplied; nothing in
the document connected that fact to the missing binding.

Live proof-of-concept, reproduced against an isolated disposable clone (no production
system, no real credentials, no live traffic; see that session's own isolation
confirmation) and again against this repository directly after the fix, both via `POST
/execute` with a real, valid API key and no other privilege: `signals` declared a fully
verified, policy-approved $5,000 payment to a known vendor
(`vendorVerified/invoiceVerified/paymentApproved/sufficientFunds: true, paymentAmount:
5000, riskScore: 10, vendorId: "VENDOR-1001"`), while `intent`, the part that actually
executes, targeted `"ATTACKER-CONTROLLED-ACCOUNT-9999"` for `999999999`. Before the fix:
`200`, policy decision `APPROVED`, execution `COMPLETED`, a real Ed25519-signed Execution
Trust Record and receipt issued for it: the exact artifacts this project's "independently
verifiable execution" claim rests on, attesting to something that never happened as
described. A related, compounding finding from the same session: `authority.principalId`
(who the trust record says approved the action) was likewise caller-declared with no
binding to the identity `callerId` actually proves. Any caller holding any valid API key
could claim to be any human or role, including an "impersonate the CEO" PoC that also
succeeded before this fix.

Fix, two parts, deliberately scoped to _bind the signals a policy actually evaluates to
the intent it actually executes_ rather than the larger, separate problem of
independently re-verifying every signal's truth (most signals, `vendorVerified`,
`riskScore`, and similar, have no Intent-side equivalent at all; deriving _those_ from an
independently verified source, the way `RazorpaySettlementProcessor` already correctly
does for webhook-derived settlement facts ("the webhook is a doorbell, not a delivery"),
is real, valuable, future work, not done this session):

- **`Policy.boundSignals`** (`packages/policy/src/types/Policy.ts`), an opt-in map from
  signal key to an intent dot-path (`{ "paymentAmount": "parameters.amount", "vendorId":
"target" }`), validated structurally by `PolicyValidator`. **`SignalIntentBinder`**
  (`packages/policy/src/SignalIntentBinder.ts`) checks every declared binding (strict
  equality; a missing signal counts as a violation, not a pass), and `RuntimeEngine.
execute` runs this check immediately before `PolicyEngine.evaluate`, over the exact
  signals about to be evaluated and the exact intent that will be signed and executed if
  approved. A violation is built into an ordinary `PolicyDecision` with outcome `REJECT`
  and a reason naming every mismatched field. It flows through the same `ExecutionGate.
enforce` rejection path as any other policy rejection, so **no authorization is ever
  generated** for a mismatched request, the same fail-closed shape as every other gate in
  this document. `policies/vendor-payment/2.0.0/policy.json` and
  `policies/razorpay-refund/1.0.0/policy.json` were patched in place (not new versions:
  this is a security fix to existing behavior, the same precedent G-1's in-place atomicity
  fix set, not a new business capability) to declare `boundSignals` for their
  amount/target-shaped signals.
- **`isPrincipalAllowed`** (`packages/api/src/auth/isPrincipalAllowed.ts`): an
  authenticated caller may only submit a transaction whose `authority.principalId` is in
  its `ApiKeyEntry.allowedPrincipalIds` grant (`packages/shared/src/config/
ApiKeyEntry.ts`), defaulting, when unset, to requiring `principalId === callerId`
  exactly, never "anything." Enforced in `routes/execute.ts` and `routes/transactions.ts`
  before `application.execute` is ever called; a mismatch is `403`, no transaction
  constructed. Composed with a second, independent fix for the compounding IDOR finding
  from the same session (any authenticated caller could read any other caller's complete
  transaction/trust-record/receipt history via `/transactions`, `/trust-records`,
  `/verify`, `/verification`, `/replay`, `/receipt*`, none of them scoped by caller at
  all): `metadata.submittedBy` is now stamped server-side from the authenticated
  `callerId` (any client-supplied value is overwritten, never trusted), and
  `isOwnedByCaller` (`packages/api/src/auth/isOwnedByCaller.ts`) gates all six read routes
  plus `GET /transactions`'s list (filtered post-fetch) and `GET /transactions/:id`.
  Cross-caller access now reads as a clean `404`, not a `403` that would confirm the
  target id exists. Both principal-binding and ownership checks are skipped only when
  caller-auth itself is disabled (`req.callerId === undefined`), matching that mode's
  existing no-caller-identity posture.

A third, unrelated finding from the same session was fixed alongside these because it was
already well-scoped: `FilePolicyRepository.load` (`packages/policy/src/
FilePolicyRepository.ts`) built its file path from `name`/`version` with no input
validation, the same bug class G-20 (this table's item 20, FileKeyProvider) had already
been hardened against, just not applied here. Live PoC: `policy: { name:
"../examples/tutorials/01-hello-world", version: "." }` produced a _different, content-
dependent_ error (`400 "policyId is required."`) than the clean `404 "not found"` a
genuinely absent path returns, proof the file was read and parsed from outside
`PARMANA_POLICY_DIR`. Now rejected by the same `^[A-Za-z0-9._-]+$` allowlist
`FileKeyProvider` already uses, before any filesystem access, collapsing both cases to an
identical `404` with no differential signal. A fourth, lower-severity finding (malformed
JSON and oversized request bodies on `/execute` surfaced as a generic `500`, indistinguish-
able from a crash, even though the identical `entity.too.large` error type already had
dedicated `413` handling on the webhook route) was fixed the same way, in
`middleware/error-handler.ts`.

Verified: 28 new tests across `packages/policy` and `packages/api` (`SignalIntentBinder.
test.ts`, `file-policy-repository.test.ts`, `isPrincipalAllowed.test.ts`,
`caller-scoping.integration.test.ts`, `error-handler-body-parsing.test.ts`, plus new cases
in `runtime.e2e.test.ts` and `caller-auth.integration.test.ts`), each reproducing the
specific live exploit shape found and asserting it is now rejected, alongside positive
controls proving legitimate matching requests still succeed and cross-caller access to a
caller's _own_ data is unaffected. Full suite: 597 tests (558 passed, 35 skipped, the
same pre-existing Supabase-gated skip count as before this session, nothing newly
skipped), `npm run lint` and `npm run typecheck` both clean. The exact live exploit
sequence (signal/intent mismatch, principal spoofing, path traversal, cross-caller read)
was re-run via real HTTP against a freshly built, isolated clone with the fix applied,
not only the automated suite, and confirmed blocked in every case, with a positive
control confirming a legitimate, correctly-bound request still executes successfully.

**Residual, explicitly not addressed by this session, flagged for a future pass:**
`boundSignals` only closes the _decoupling_ between what a policy evaluates and what
executes for the specific fields a policy author declares bound. It does not verify that
an unbound signal (`vendorVerified`, `paymentApproved`, `sufficientFunds`, `riskScore`,
and similar) is actually _true_. Those remain caller-declared attestations with no
independent verification, same as before this session; closing that gap for real would
mean extending the `RazorpaySettlementProcessor` fetch-verify pattern to policy signals
generally, a materially larger project than this session's scope. `razorpay-refund/1.0.0`
was bound only on `requestedRefundAmountPaise`; a `paymentId`-shaped binding (so a
declared `paymentStatus: "captured"` claim cannot be about a different payment than the
one `intent` actually refunds) was considered and deliberately not added, since the
policy's `signalsSchema` has no existing field cleanly mappable to `intent.parameters.
paymentId` without inventing new policy-author-facing surface beyond this session's
scope. Flagged here rather than silently left unmentioned.

**Update (2026-08-04), RFC-0022: the razorpay-refund slice of this residual is now closed.**
`SignalStateVerifier` (`packages/policy/src/types/SignalStateVerifier.ts`) is a new, optional,
additive port. `RuntimeEngine.execute` computes a _provisional_ decision exactly as before
(`SignalIntentBinder` check, then `PolicyEngine.evaluate` if binding passed), and only when that
provisional decision is `APPROVE` does it run the configured `SignalStateVerifier`, over the
exact signals just evaluated; a violation overrides the decision to an ordinary REJECT
(`matchedRuleId: "signal-state-verification-violation"`), the same fail-closed shape
`SignalIntentBinder` violations already use. Gating on "provisional decision is APPROVE" rather
than running unconditionally is deliberate: a request already going to be REJECTed (by binding or
by an ordinary policy rule) needs no independent re-fetch, which preserves the existing "a policy
denial makes zero calls to the external vendor system" property those tests already asserted
(see `hubspot-deal-update.integration.test.ts`'s `fetchSpy` assertions, updated below). `SignalIntentBinder`
itself is unmodified. `RazorpaySignalStateVerifier`
(`packages/connector-sdk/src/connectors/razorpay/RazorpaySignalStateVerifier.ts`) is the
concrete implementation wired into production `POST /execute`
(`packages/api/src/bootstrap/createRazorpaySignalStateVerifier.ts`, composed in
`packages/api/src/application.ts`): for `razorpay:refund-create` requests only, it independently
re-fetches the real payment from Razorpay -- reusing the exact fetch `RazorpayRefundService`
already performed (`executeRazorpayCapability`, extracted from `RazorpayRefundService` into
`RazorpayCapabilityExecution.ts` so both share one implementation) -- and compares `paymentStatus`,
`paymentCurrency`, `refundableRemainingPaise`, and `requestedExceedsRemainder` against the
caller-declared signals. A fetch failure (network error, payment not found) is itself treated as
a violation: fail-closed, never a silent pass-through. `requestedRefundAmountPaise` is read from
the caller's declared signals rather than re-derived, because `SignalIntentBinder` has already
proven it equals `intent.parameters.amountPaise` by the time this verifier runs.

**Verified:** a new regression test,
`packages/api/tests/integration/razorpay-refund.integration.test.ts` ("rejects by policy through
POST /execute when caller-declared signals misrepresent the real Razorpay payment state"), was
written first and confirmed failing (`200 APPROVED`, a real refund landing on the mock server)
against the code as it stood before this fix, then confirmed passing (`403 POLICY_DENIED`, no
refund reaches the mock server) after it. Full repo `tsc -b`, `eslint . --ext .ts`, and `vitest
run` (762 passed, 40 pre-existing skips, no new skips) all clean, no regressions.

**Explicitly still open, not addressed by this update:**

- ~~`dailyCumulativeAfterThisRefundPaise` is _not_ independently verified~~ **-- CLOSED, TD-23
  Phase 3B, see `docs/CLAIMS.md` 3.4's RFC-0022/TD-23 update.** `RazorpayDailyRefundLedger`
  (`packages/connector-sdk/src/connectors/razorpay/RazorpayDailyRefundLedger.ts`, a new,
  differently-shaped `reserve()`/`release()` atomicity primitive -- not the same interface
  as the 2026-08-04 `RazorpayCumulativeRefundLedger.recordApprovedRefundIfWithinCap()` fix
  below, which lived inside `RazorpayRefundService`, since deleted entirely in the
  execution-ownership refactor that moved `RazorpayConnector` to `execution-gateway`; see
  the connector-path corrections elsewhere in this document) is now unconditionally
  supplied to `RazorpaySignalStateVerifier` in production
  (`createRazorpaySignalStateVerifier.ts`), backed by `SupabaseRazorpayDailyRefundLedger`.
  This residual note originally tracked whether _any_ ledger was reachable from production
  at all -- it is now, via this new primitive, superseding the deleted class's fix rather
  than continuing it.
- **`vendor-payment`** (`policies/vendor-payment/2.0.0/policy.json`) has the identical shape of
  gap and no verifier: `vendorVerified`, `invoiceVerified`, `paymentApproved`, `sufficientFunds`,
  and `riskScore` remain pure caller-declared attestations. There is no single external system in
  this codebase these facts could be fetched from the way Razorpay's payment API supplies
  `razorpay-refund`'s facts, so closing this one is a materially different, larger problem than
  either closure below, not a trivial extension of them.

**Update (2026-08-04), RFC-0022: the hubspot-deal-update slice of this residual is now also
closed**, following the razorpay-refund closure above exactly, as its flagged "natural next
candidate" (a real, fetchable external source -- HubSpot's own deal API -- already existed).
`HubSpotSignalStateVerifier`
(`packages/connector-hubspot/src/HubSpotSignalStateVerifier.ts`) is the concrete implementation,
wired into production `POST /execute` the same way
(`packages/api/src/bootstrap/createHubSpotSignalStateVerifier.ts`, composed alongside the Razorpay
verifier in `packages/api/src/application.ts` via a new `CompositeSignalStateVerifier`
(`packages/policy/src/CompositeSignalStateVerifier.ts`), since `RuntimeEngine` accepts exactly one
`SignalStateVerifier` and each capability-scoped verifier only recognizes its own action, returning
no violations for anything else): for `hubspot:deal-update` requests only, it independently
re-fetches the real deal from HubSpot -- reusing the exact fetch `HubSpotDealUpdateService`
already performed (`executeHubSpotCapability`, extracted from `HubSpotDealUpdateService` into
`HubSpotCapabilityExecution.ts`, mirroring `RazorpayCapabilityExecution.ts` exactly) -- and
compares `currentDealStage`, `dealStageChangeRequested`, `dealStageTransitionAllowed`,
`amountChangeRequested`, `amountDeltaAbs`, and `amountChangeExceedsThreshold` against the
caller-declared signals. A fetch failure is itself treated as a violation: fail-closed, never a
silent pass-through. `proposedDealStage`/`proposedAmount` are read from the caller's declared
signals rather than re-derived, because `SignalIntentBinder` has already proven they equal
`intent.parameters.dealstage`/`intent.parameters.amount` by the time this verifier runs.
`preAuthorizedForAmountChange` is deliberately excluded from _this_ verifier's fetch-based
mechanism: it is an explicitly out-of-band claim with no HubSpot-side fact to fetch and compare
against (see `HubSpotDealUpdateSignals.ts`'s own comment on that field), the same category of
exclusion as `dailyCumulativeAfterThisRefundPaise` above was, at the time this paragraph was
written. **Update (TD-23, Phase 3C, now closed):** exclusion from fetch-based verification did
not mean unverified forever -- `preAuthorizedForAmountChange` now has its own, differently-shaped
verification path (a real, independently-issued, signed Approval Artifact, not a HubSpot API
fetch), added directly to `HubSpotSignalStateVerifier` itself. See `docs/CLAIMS.md` 3.10's
TD-23 update for the full mechanism (`ApprovalVerifier`, `packages/approval/src/ApprovalVerifier.ts`).

**Verified:** a new regression test,
`packages/api/tests/integration/hubspot-deal-update.integration.test.ts` ("rejects by policy
through POST /execute when caller-declared signals misrepresent the real HubSpot deal state"),
was written and confirmed failing (`200 APPROVED`, no deal-state check) with the HubSpot verifier
deliberately left out of the composite while the Razorpay verifier stayed wired, then confirmed
passing (`403 POLICY_DENIED`, the mock deal stage stays unchanged) once wired in. This also
implicitly re-verified the ordering fix above: the two pre-existing `hubspot-deal-update`
policy-denial tests, each asserting _zero_ HTTP calls reached the mock HubSpot server on a
denial, kept passing with the verifier now in the request path, because it only ever runs when
the provisional decision is `APPROVE`. `HubSpotDealUpdateService`'s own 42 pre-existing unit
tests pass unmodified -- this was a pure additive change to production wiring, not a change to
that service's behavior. (`HubSpotDealUpdateService` was itself later deleted in the Phase 1C
execution-ownership refactor, replaced by `HubSpotCapabilityExecution.ts`; this was a true,
accurate statement about the code as it stood at the time this paragraph was written.) Full repo `tsc -b`, `eslint . --ext .ts`, `tsc --noEmit`, and `vitest
run` (763 passed, 40 pre-existing skips, no new skips) all clean, no regressions.

**Explicitly still open, not addressed by this update:** `vendor-payment` (above) remains the
only capability of the three using this generic signals mechanism with no independent state
verification at all, for the reason already stated: no single fetchable external source exists
for its signals in this codebase.

**Investigation (2026-08-04): `vendor-payment` remains genuinely blocked, not merely
unattempted.** Per-fact breakdown of every unbound signal in
`policies/vendor-payment/2.0.0/policy.json`'s `signalsSchema` (only `paymentAmount` and
`vendorId` are bound, via `boundSignals`):

- `vendorVerified` -- would need a vendor-verification/KYB (know-your-business) service. No
  connector anywhere in this codebase represents one, not even as a write-only placeholder.
- `invoiceVerified` -- would need an accounts-payable/invoicing system exposing invoice
  match/approval status. `SapConnector` (`packages/connector-sdk/src/connectors/sap/
SapConnector.ts`) is the plausible real-world candidate (SAP is a common AP system), but it is
  a bare `MockConnector` with exactly one capability, `sap:post-invoice` (write-only, scripted,
  in-memory), explicitly documented as "temporary... until the real connector is implemented."
  No fetch/read capability exists.
- `paymentApproved` -- would need an approval-workflow system. `WorkdayConnector`
  (`.../workday/WorkdayConnector.ts`) is the plausible candidate, same situation exactly:
  `MockConnector`, one write-only capability (`workday:submit-expense-report`), no fetch
  capability, same "temporary" doc comment.
- `sufficientFunds` -- would need an account-balance/treasury API. `OracleConnector`
  (`.../oracle/OracleConnector.ts`) is the plausible candidate, same situation: `MockConnector`,
  one write-only capability (`oracle:create-purchase-order`), no fetch capability.
- `riskScore` -- would need a risk/fraud-scoring service. No connector of any kind represents
  one in this codebase, not even a write-only placeholder like the four above.

`VendorPaymentConnector` itself (`.../vendor-payment/VendorPaymentConnector.ts`) is likewise a
bare `MockConnector`, one write-only capability (`vendor-payment`), no fetch capability, same
"temporary... until the real connector is implemented" doc comment.

Unlike Razorpay and HubSpot, where `MockRazorpayServer`/`MockHubSpotServer` stand in for a real,
already-production-capable HTTP integration (`RazorpayConnector`/`HubSpotConnector` speak to the
real vendor API today whenever no test-only `*_BASE_URL` override is set), `MockConnector` here
is not a test substitute for anything real: in production it would simply return
`{ success: true, metadata: {} }` for whatever it's asked to execute. There is no real system,
mocked in tests, that a verifier's fetch could be faithfully checked against for any of the five
facts -- building one now would mean either fetching from a write-only capability that has
nothing to fetch, or fabricating a new read capability backed by nothing but a hardcoded test
double, which would not be independent verification, only the appearance of it. Per this
investigation's own instructions: this is "genuinely blocked," not "could close this but
haven't" -- **no code was changed for vendor-payment.** All five facts remain exactly as
documented above: pure caller-declared attestations.

**Update (2026-08-04): the daily-cumulative-cap ledger race (flagged above and in the
state-freshness investigation that preceded the razorpay-refund closure) is now fixed.** The
race: `RazorpayRefundService.requestRefund()` read `RazorpayCumulativeRefundLedger
.cumulativeAmountToday(scopeId)` once, early (before that call's own payment fetch and policy
evaluation), then -- across two further `await` points (the payment fetch, and later the actual
refund-create capability call) -- unconditionally appended to the ledger only after a successful
refund, with nothing re-checking the total in between. Two concurrent `requestRefund()` calls for
the same `scopeId` could both read the same pre-write total, both independently pass the
`reject-exceeds-daily-cumulative-cap` rule, and both execute, pushing the real combined total
over the configured cap.

Fix: `RazorpayCumulativeRefundLedger.recordApprovedRefundIfWithinCap(scopeId, amountPaise,
businessTransactionId, capPaise, now?)`
(`packages/connector-sdk/src/connectors/razorpay/RazorpayCumulativeRefundLedger.ts`) re-reads the
current total and appends in a single synchronous call -- no `await` anywhere inside it, so
JavaScript's run-to-completion semantics make the read-then-append atomic with no explicit lock
needed. Returns the new total when the append is accepted, or `null` when appending would exceed
`capPaise` (nothing appended). `RazorpayRefundService.requestRefund()` now calls this immediately
before the actual refund-create capability call (not at the point signals are first built, and no
longer unconditionally after success): a `null` result is treated as an ordinary REJECT
(`matchedRuleId: "reject-exceeds-daily-cumulative-cap-race-guard"`) and Razorpay is never
contacted for it, the same "zero external calls on a denial" shape every other REJECT path here
already has. `capPaise` comes from a new `RazorpayRefundServiceOptions.dailyCumulativeCapPaise`
field, defaulting to a new exported constant,
`RAZORPAY_DEFAULT_DAILY_CUMULATIVE_CAP_PAISE = 2_000_000`
(`packages/connector-sdk/src/connectors/razorpay/RazorpayRefundSignals.ts`) -- this must match
`policies/razorpay-refund/1.0.0/policy.json`'s own cap literal exactly; the two are not
mechanically linked (nothing reads a rule's literal value back out of hand-authored policy JSON),
the same accepted coupling risk `HUBSPOT_DEFAULT_AMOUNT_CHANGE_THRESHOLD` already carries against
`hubspot-deal-update`'s policy.

Known, accepted trade-off of reserving before executing rather than only recording after success:
if the reservation succeeds but the subsequent Razorpay-side refund-create call itself then fails
(network error, Razorpay rejects it), the ledger entry is not rolled back --
`AppendOnlyLedger` is deliberately append-only, by design, with no delete. The day's recorded
cumulative total can therefore end up slightly higher than the sum of refunds that actually
landed on Razorpay, conservatively reducing remaining headroom for the rest of that scope's day.
This is the opposite failure direction from the race being fixed (under-permits rather than
over-permits) and is flagged here rather than left implicit.

**Verified:** a new regression test,
`packages/connector-sdk/tests/unit/razorpay-refund-service.test.ts` ("two concurrent requests
against the same daily cumulative cap cannot both succeed when only one should"), fires two
concurrent `requestRefund()` calls via `Promise.all` against a ledger seeded to 1,700,000 of a
2,000,000 cap, each individually requesting 200,000 (within the per-refund cap and, read
naively, within headroom) but 2,100,000 combined -- over the cap. Proven failing empirically, not
just reasoned about: `git stash`-ed the fix's own source changes (keeping the earlier
razorpay-refund closure's extraction intact) and ran the test against the resulting pre-fix code,
observing both concurrent requests approved and executed (`approvedCount` `2`, failing the `<= 1`
assertion) before restoring the fix. Re-ran the now-passing test five consecutive times with no
flake. Full repo `tsc -b`, `eslint . --ext .ts`, `tsc --noEmit`, and `vitest run` (764 passed, 40
pre-existing skips, no new skips) all clean, no regressions.

**Independently re-confirmed, Phase 3D (fresh re-verification, not a citation of this entry's
own history).** Every update above documents this codebase's own account of closing G-24 and
its TD-23 residuals across several sessions. The Phase 3D certification
(`docs/architecture/phase3d-independent-authorization-certification.md`) treated all of it as a
claim to re-verify, not inherit: it re-traced `SignalIntentBinder`, `CapabilityPolicyBinder`,
`RazorpaySignalStateVerifier`, `HubSpotSignalStateVerifier`, and `RazorpayDailyRefundLedger`
directly from current source (not from this document's narrative) and confirmed, as of commit
`cb467fc`, that all five are still unconditionally wired into production bootstrap (§4, §5 of
that document) and that no alternate execution path bypasses them (§5.2 — the two open
questions an evidence pass raised there, the exact Razorpay dispatch site and
`SdkConnectorExecutor`'s internals, were independently closed by direct reading, not left as
citations). This re-confirmation is current as of that commit, not merely a restatement of the
closures already documented above.

**G-1. Duplicate Business Transaction ID: real, deterministic data-loss race in
`MemoryBusinessTransactionRepository`. RESOLVED (Option A, as written in D-1 below,
implemented as written) in the audit-sink/G-1 hardening session that followed the G-13
session.** The original bug
(`packages/runtime/src/services/business-transaction-service.ts:36-49`): `accept()` does
`await this.repository.exists(id)` then, only if false, `await this.repository.create(...)`,
a classic check-then-act race, not atomic. Two concurrent `accept()` calls with the same
`businessTransactionId` and _different_ content both used to succeed, no
`DuplicateBusinessTransactionError` was ever thrown by either, and the second write silently
overwrote the first (100% reproducible via `Promise.all`, not probabilistic).

The fix, exactly as D-1's Option A specified:

- **`MemoryBusinessTransactionRepository.create()`** now does the `Map.has` check and the
  `Map.set` in the same synchronous tick, no `await` between them, so two concurrent calls
  cannot interleave (the same technique `MemoryNonceStore.checkAndRecord()` and
  `SupabaseNonceStore.checkAndRecord()` already use for G-13), and throws
  `DuplicateBusinessTransactionError` itself on a collision, rather than relying on the
  service layer's separate (and racy) `exists()` check. `business-transaction-service.ts`'s
  own `exists()`-then-`create()` sequence is untouched; it remains a cheap fast-path for the
  non-racing common case, but the storage layer is now the actual source of truth.
- **`BusinessTransactionRepository`'s `create()` contract** (`packages/shared/src/
repositories/business-transaction-repository.ts`) now documents the insert-if-absent
  requirement explicitly: every implementation must throw `DuplicateBusinessTransactionError`
  atomically for a duplicate, not overwrite it.
- **`SupabaseBusinessTransactionRepository.create()`** now maps a `23505` unique-violation
  (from the `business_transaction_id TEXT PRIMARY KEY` constraint that was already there,
  in `supabase/migrations/20260629013035_initial_schema.sql` since the original schema, no
  new migration needed) to `DuplicateBusinessTransactionError` via the same
  `isUniqueViolation` helper G-13 built (`packages/storage/src/errors/
PostgresErrorCodes.ts`), instead of rethrowing the raw Postgres error.
- **Architectural note, not anticipated by D-1's text**: `DuplicateBusinessTransactionError`
  previously lived in `@parmana/runtime`, which `@parmana/storage` cannot depend on without a
  circular reference (`packages/runtime/tsconfig.json` already references `../storage` for
  its own test fixtures). The class was moved to `@parmana/shared`
  (`packages/shared/src/errors/duplicate-business-transaction-error.ts`, alongside the
  existing sibling `BusinessTransactionNotFoundError`/`ConflictError`/`ParmanaError`
  hierarchy that `execution-service.ts` already used) so both repositories can throw the
  identical class. `packages/runtime/src/errors/DuplicateBusinessTransactionError.ts` now
  re-exports it, so every existing import path
  (`business-transaction-service.ts`, `error-handler.ts`, `execute-api.test.ts`) is
  unchanged and `instanceof` identity is preserved end to end, verified directly by
  `execute-api.test.ts`'s existing "returns 409 when the same businessTransactionId is
  submitted twice" test, which still passes unmodified.
- **API-layer HTTP mapping required no change.** `packages/api/src/middleware/
error-handler.ts`'s existing `instanceof DuplicateBusinessTransactionError` branch
  (409, no `code` field, matching `schemas/common/error.schema.json`'s documented contract)
  already matches the relocated class via the re-export, confirmed by the same
  `execute-api.test.ts` test above.

Verified: 8 unit tests with mocked/in-memory storage:
`packages/storage/tests/unit/memory-business-transaction-repository.test.ts` (including the
concurrency proof: two simultaneous `create()` calls with the same id and different content,
exactly one succeeds and the other rejects with `DuplicateBusinessTransactionError`, and the
stored record is exactly the winner's, never a merge or the loser's),
`packages/storage/tests/unit/supabase-business-transaction-repository.test.ts` (mocked
`23505` mapping, and fail-closed propagation of any other storage error), and
`packages/storage/tests/unit/business-transaction-repository-duplicate-consistency.test.ts`
(`describe.each` over both implementations, asserting the identical error class and message
for a duplicate), plus 2 Supabase-gated integration tests against a real project, routed
through `resolveSupabaseGate`:
`packages/storage/tests/integration/supabase-business-transaction-duplicate.integration.test.ts`
(sequential duplicate, and the same concurrent-race proof against real Postgres).

**G-2. No CI runs the main test suite. CLOSED in the 2026-07-17 session.** See "Gaps closed
in the 2026-07-17 audit closeout session" above. `.github/workflows/ci.yml` now runs
`npm ci`, `npm run build`, a terminology-regression guard, and `npm test` on every push and
pull request, Node 24, with explicit env vars and no dependency on any `.env` file.
Supabase-gated integration tests are not run in CI (no `SUPABASE_*` secrets are configured
there); they skip cleanly rather than failing, which is itself a decision worth revisiting
if fleet-wide Supabase coverage in CI is wanted later; not done this session.

**G-3. Live external credentials are used by default, unlabeled, on every local test run.
RESOLVED in this session (hardening pass following 2026-07-17 audit closeout).** All 10
Supabase-gated suites (9 in `packages/api`, 1 in `packages/storage`) now route through a
shared `resolveSupabaseGate(suiteLabel)` helper
(`packages/api/tests/helpers/supabase-availability.ts`,
`packages/storage/tests/helpers/supabase-availability.ts`, kept as two independent copies
by design; see that file's own comment). Behavior:

- No `SUPABASE_*` configured: unchanged, skips cleanly, exactly as before.
- `SUPABASE_*` configured but `ALLOW_LIVE_SUPABASE=1` is not set: **hard failure**, not a
  silent run and not a silent skip. The suite throws during test collection, naming the
  missing flag explicitly, so a contributor whose `.env` happens to carry live credentials
  can no longer write real rows to a real project without knowing it.
- `SUPABASE_*` configured and `ALLOW_LIVE_SUPABASE=1` set: runs exactly as it did before
  this change.

Verified directly: with this checkout's own live-credential `.env` present and
`ALLOW_LIVE_SUPABASE` unset, `receipt-negative.integration.test.ts` now fails in ~3s with
`"Receipt Negative Integration: SUPABASE_URL and a Supabase key are configured, but
ALLOW_LIVE_SUPABASE=1 is not set..."` instead of silently running. The guard itself (all
three branches) is covered by unit tests with no live network dependency:
`packages/api/tests/unit/supabase-availability.test.ts` and
`packages/storage/tests/unit/supabase-availability.test.ts` (4 and 3 tests respectively).

**Residual, not addressed by this fix:** once a contributor does opt in with
`ALLOW_LIVE_SUPABASE=1`, no test cleans up after itself:
`workflow-supabase.integration.test.ts` and its siblings still write real
`business_transactions` and `execution_trust_records` rows that are never deleted. That
cleanup gap is a smaller, separate concern from the "silent by default" problem this fix
closes, and was out of this session's scope.

**G-30. `github:pr-fetch`/`github:pr-merge` were wired into production
(`createConnectorRegistry.ts`, commit `38658c0`, 2026-08-19) without a matching entry in
`CANONICAL_CAPABILITY_POLICY_BINDINGS`. Found 2026-08-25, independent of a CLAIMS.md
audit-fix pass that was looking for something else entirely. RESOLVED same-day
(2026-08-25).** `CapabilityPolicyBinder.
findViolation(action, declared)` (`packages/policy/src/CapabilityPolicyBinding.ts`) returns
`undefined` — no violation, by design — for any `action` with no canonical entry in the map;
this is documented, intentional behavior for genuinely out-of-scope actions (test/tutorial
fixtures), but `github:pr-fetch`/`github:pr-merge` are not out of scope — they are real,
production-wired, tested capabilities (`docs/CLAIMS.md` §3.17), reachable through the same
`POST /execute` route as `hubspot:deal-update`. A caller invoking `github:pr-merge` today can
declare _any_ loadable policy reference — `CapabilityPolicyBinder` will not reject the
pairing — exactly the "real capability paired with an unrelated, unprotected policy" attack
shape `docs/CLAIMS.md` §2.22 describes as closed. `github-pr-approval/1.0.0` is the intended
policy (§3.17), but nothing structurally prevents a different, loadable policy from being
declared instead and evaluated in its place.

**Why this was missed twice.** `packages/policy/tests/unit/CapabilityPolicyBinder.test.ts`'s
own `"binds every capability the production connector registry actually registers"` test
does not actually read `createConnectorRegistry.ts`; it asserts a hardcoded
`Set(["hubspot:deal-fetch", "hubspot:deal-update"])`, so it passed both before and after
GitHub was wired in without ever checking the claim its own name makes. The original
`CLAIMS-MD-AUDIT.md` (audited against commit `822d65f`, 2026-08-24 — five days after GitHub
was wired in) and the `docs: fix CLAIMS.md stale references and broken citations` pass that
closed out its findings the same day both re-counted `createConnectorRegistry.ts`'s
connectors and both still reported two (`test-fixture`, `hubspot`), missing the `github`
registration entirely — confirmed independently by re-reading the file directly rather than
trusting either report (it registers three: `test-fixture`, `hubspot`, `github`).

**Severity: blocks-pilot.** This is the same shape of finding as G-24, not G-29: a live,
reproducible gap in the specific structural protection §2.22 claims covers "every capability
the production connector registry actually registers." It requires GitHub App credentials to
be configured to matter in practice (the connector fails closed to unregistered otherwise,
per §3.17), so it is not exploitable against an unconfigured deployment, but it is real for
any deployment that has configured GitHub.

**Fixed same-day: Option A, as originally scoped.** `github:pr-fetch`/`github:pr-merge` added
to `CANONICAL_CAPABILITY_POLICY_BINDINGS`, both pointing at `github-pr-approval/1.0.0` —
exactly the policy `packages/api/tests/integration/github-pr-merge.integration.test.ts`
already declares (line 115-117), so no behavior change for the passing case, only a new
rejection for a caller declaring anything else. `CapabilityPolicyBinder.test.ts`'s "binds
every capability the production connector registry actually registers" test now includes
both in its expected set. **Not fully closed, only reduced:** the coverage test's expected
set is still a hand-maintained literal, not a live read of `createConnectorRegistry.ts` — the
exact mechanism that let this gap stand undetected for six days is unchanged, only the
current snapshot is now correct. A fourth connector added without updating this test's
literal (and without updating `CANONICAL_CAPABILITY_POLICY_BINDINGS` to match) would recur
silently, precisely as this entry recurred once already. Deriving the expected set from
`createConnectorRegistry.ts` or an equivalent single source of truth, rather than a
hand-maintained list, remains open follow-on work — not done in this pass, since it would
require `packages/policy` to depend on `packages/api` (or a new shared capability-registry
package), a dependency-graph decision bigger than this fix's scope.

**Root-cause architecture decision, documented separately (2026-08-26):**
`G-30-RESOLUTION-ARCHITECTURE.md` and `G-30-ARCHITECTURE-OPTIONS.md` (repo root) lay out the
follow-on decision — accept the hand-maintained-list debt (Option A), make the coverage test
read live from `createConnectorRegistry.ts` (Option B, requires the `packages/policy` →
`packages/api` edge above), or extract a shared `@parmana/capability-registry` package
(Option C) — with corrected effort estimates and code samples (the options document flags and
fixes a fabricated `registry.getCapabilityBindings()` API in the prompt it was drafted from;
no such method exists on `ConnectorRegistry`). Recommendation there: Option A now, revisit B/C
later. Awaiting Pavan's decision; nothing beyond this entry's own fix has been implemented.

**Verified:** `packages/policy/tests/unit/CapabilityPolicyBinder.test.ts` (11/11, this file),
`packages/api/tests/integration/github-pr-merge.integration.test.ts` (4/4, confirms the
already-correct policy pairing still passes unchanged). Full repo `npm run build` (rebuilt
`@parmana/policy`'s stale `dist/`) and `npm test`: 1274 passed, 37 skipped, 0 failed —
identical counts to before this fix, since no new `it()` blocks were added, only an existing
assertion's expected set was extended.

**Option C implemented (2026-08-26), per Pavan's decision.**
`CANONICAL_CAPABILITY_POLICY_BINDINGS`/`CapabilityPolicyBinder` moved from
`packages/policy/src/CapabilityPolicyBinding.ts` into a new leaf package,
`packages/capability-registry/src/CapabilityPolicyBinding.ts`, depending only on
`@parmana/shared`. `packages/policy/src/index.ts` re-exports both symbols from the new package
unchanged, so all ~10 existing consumers that import via `@parmana/policy` needed zero changes
(confirmed by grep before and after). The regression test moved with it, to
`packages/capability-registry/tests/unit/CapabilityPolicyBinder.test.ts`.

**Deviation from the original Option C sketch, found and corrected before implementing, not
after:** `G-30-ARCHITECTURE-OPTIONS.md`'s Option C proposed the new package also importing
capability-identifier constants from `@parmana/connector-github`/`@parmana/connector-hubspot`
to remove identifier-string duplication. Checked first: `@parmana/connector-hubspot` already
depends on `@parmana/policy` directly, and `@parmana/connector-github` depends on
`@parmana/connector-sdk`, which also depends on `@parmana/policy` — either import direction
would have created a dependency cycle back through the exact package this extraction exists to
be depended on by. Not done. The four capability-identifier strings remain hand-typed in
`CapabilityPolicyBinding.ts`, exactly as before the move, still separately duplicated in
`GitHubCapabilities.ts`/`HubSpotCapabilities.ts`. **What this move actually closes:** the
`packages/policy` → `packages/api` backwards-dependency edge Option B would have required, and
gives a future consumer (`createConnectorRegistry.ts` itself, if ever restructured to read
canonical bindings) a leaf package to depend on instead of pulling in all of `@parmana/policy`.
**What it does not close:** the coverage test's expected set is still a hand-maintained
literal (see that test's own updated comment) — the exact failure mode that let G-30 itself go
undetected for six days is structurally unchanged, only relocated to a smaller, more clearly
purpose-scoped package.

**Verified (Option C):** `npm install` (linked the new workspace package), `npx tsc -b` (clean,
full workspace including the new project reference in root `tsconfig.json`), `npx eslint
packages/capability-registry packages/policy --ext .ts` (clean), full `npm test`: 1274 passed,
37 skipped, 0 failed — identical counts, since the moved test file's assertions are unchanged.

**G-47. `PolicyGovernanceExecutionVerifier` treats a signature-tamper signal
(`SIGNATURE_INVALID`) identically to an honest process gap (`NO_APPROVAL_RECORD` /
`CONTENT_MISMATCH`) — all three block execution the same way, with no graduated response.**
Found 2026-09-15, the same day as G-45/G-46, while discussing whether execution should stop
on a governance-anchor mismatch at all (`docs/investigations/2026-09-15-evidence-anchor-gap-audit.md`,
GAP-5 addendum). Not a defect in G-45's `PolicyGovernanceAnchorResolver`, which correctly
reports which of the three occurred — the enforcement path,
`PolicyGovernanceExecutionVerifier.verify()`
(`packages/api/src/governance/PolicyGovernanceExecutionVerifier.ts:31-63`), collapses the
distinction: `RuntimeEngine` treats any of the three as an ordinary policy REJECT, no
authorization ever generated (`packages/runtime/src/RuntimeEngine.ts:284-291`).

**Why blocks-pilot, not pre-production:** `POLICY_EXECUTION_VERIFICATION_ENFORCED` is off
today and cannot safely be turned on until the G-1 legacy-policy backfill completes — but the
moment it is turned on, this all-or-nothing behavior becomes live, production-affecting
policy for every execution in the system, decided implicitly by default rather than a
deliberate choice. A security team reviewing this before a pilot would reasonably ask: does a
missing approval record (an honest process gap, possibly mid-rollout) deserve the same hard
stop as a forged signature (active tampering)? Today the codebase has no answer other than
"yes, always," chosen by omission.

**Not fixed. Options, not a fix:**

1. Keep uniform blocking for all three (simplest, most conservative, matches this codebase's
   fail-closed discipline everywhere else — defensible, but should be a stated choice).
2. Graduate the response: hard-block on `SIGNATURE_INVALID` only, while
   `NO_APPROVAL_RECORD`/`CONTENT_MISMATCH` alert (structured log, metric, or a dedicated
   audit event) and continue — useful during a transition period where governance coverage
   is still incomplete, at the cost of a real window where ungoverned policy content
   executes.
3. Make the response configurable per severity, deferring the choice to whoever operates a
   given deployment instead of picking one default for everyone.

No fix attempted this session — this is a decision for whoever turns
`POLICY_EXECUTION_VERIFICATION_ENFORCED` on for the first time, not a code change to make
unilaterally. See `02-REMAINING.md` Tier 0.

### pre-production

**G-4. Hybrid/post-quantum signing was dead configuration in production. PARTIALLY
CLOSED, for two of the several signing surfaces, by the Hybrid Signature Support
milestone (Phase A).** Originally: `CRYPTO_MODE`, `PRIMARY_SIGNATURE_PROVIDER`, and
`SECONDARY_SIGNATURE_PROVIDER` were all read into `config.crypto`
(`packages/shared/src/config/Config.ts`), and `crypto.mode` was parsed but never read
anywhere else in the codebase; every production signing call site hardcoded
`CryptoBootstrap.create()` (single-provider), never `createHybrid()`. A deployer who set
`CRYPTO_MODE=hybrid` expecting defense-in-depth PQ signing got silently ignored config;
the server signed Ed25519 only, regardless. That description is now accurate for most,
but no longer all, of this codebase's signing surfaces.

**What's actually wired now:** `packages/crypto/src/VerificationCrypto.ts` (Execution
Trust Records) and `ReceiptCrypto.ts` (Receipts) both read `crypto.mode` (via
`parseCryptoMode`, `packages/shared/src/config/ConfigValidation.ts` — the previously-unvalidated
raw cast is also fixed) and, when it is `"hybrid"`, additionally sign with
`HybridSignatureProvider` (`packages/crypto/src/HybridSignatureProvider.ts`) using both
`PRIMARY_SIGNATURE_PROVIDER` and `SECONDARY_SIGNATURE_PROVIDER`, via
`CryptoBootstrap.createHybrid()` — the same factory this entry originally found unused.
The result is additive, not a schema replacement: the existing single `signature` field
is signed exactly as before (so old records and `@parmana/sign`'s third-party verifier
stay compatible), and a new `signatures` array plus `schemaVersion` are populated only
when hybrid mode produced them. `VerificationCrypto.verify()`/`verifySignature()` require
every entry in `signatures` to independently verify when present — a missing or malformed
entry rejects the whole record, never a silent downgrade to the legacy field alone.
Verified: `packages/crypto/tests/unit/hybrid-signature-provider.test.ts`,
`packages/runtime/tests/unit/verification-service-hybrid.test.ts`,
`packages/runtime/tests/integration/receipt-hybrid.integration.test.ts`.

**What's still exactly as this entry originally found it:** `RuntimeAuthorizationSigner`
(execution authorization signing), gateway attestation signing
(`createGatewayKeyPair`/`GatewayAuthenticationSigner`), and every connector's own signing
path (`createConnectorRegistry.ts` and its call sites) all still call
`CryptoBootstrap.create()` only — single-provider, `PRIMARY_SIGNATURE_PROVIDER` alone,
completely unaffected by `CRYPTO_MODE`. This was a deliberate scope decision (see the
milestone's own "Explicitly out of scope" list: Refusal Records and audit-event signing
are an explicit fast-follow, not this pass), not an oversight, but it means `CRYPTO_MODE=hybrid`
still does **not** mean "everything this process signs is hybrid-signed" — only Trust
Records and Receipts are. A deployer reading `CRYPTO_MODE=hybrid` as covering the whole
process would still be wrong, just differently wrong than before.

**Now promoted to `docs/CLAIMS.md` (3.13), scoped to exactly what's built.** Hybrid
signing is real, tested, and wired for the two surfaces above; `CRYPTO_MODE=hybrid`
remains opt-in, not the production default (`parmana-api-live.fly.dev` still runs
`PRIMARY_SIGNATURE_PROVIDER=ed25519` alone — 3.13 states this explicitly), and
`@parmana/sign`'s public verifier does not yet recognize the `signatures` envelope shape
(3.13's own "Required caveat" paragraph). The claim is capability-only, not a deployment
claim: it does not say hybrid signing runs in staging or production anywhere, because it
doesn't yet.

**Decision still required for the remaining surfaces, see below** (D-2's Option A/B choice
was written before this partial closure and should be re-read as applying only to the
signing paths listed as unwired above).

**G-5. `OverrideService` has zero test coverage and no HTTP route.**
`packages/runtime/src/services/override-service.ts` (business rules: transaction must
exist, trust record must exist, one override per transaction) is never imported by any test
anywhere in the repo, and `packages/api/src/app.ts` mounts no `/overrides` route at all. The
only proof that an override can land on a trust record and still verify
(`packages/api/tests/integration/workflow-supabase.integration.test.ts:122-200`) bypasses
`OverrideService` entirely, calling `storage.trustRecords.appendOverride()` directly on the
repository and manually pre-computing the hash/signature to match: a storage-layer proof,
not a proof that the actual application-layer service (with its business rules) works, or
is even reachable by anything. **Decision required, see below.**

**G-6. `packages/receipt` has zero test files. STALE CLASS NAMES CORRECTED (Phase 3D
follow-up, in response to an external audit report of `docs/CLAIMS.md` 2.5/2.6 that this
entry's own inaccuracy helped mislead — see G-26 for the full account).** `"test": "vitest
run --passWithNoTests"` still means this silently succeeds with nothing asserted — that
part of this entry remains true. But the class names this entry previously cited,
`ExecutionReceiptBuilder`, `ExecutionReceiptVerifier`, and the `ExecutionPermit` model in
`packages/execution-control`, **no longer exist anywhere in this repository** — confirmed
by repo-wide search, zero hits. They were confirmed to have zero live callers and zero test
coverage, and were deliberately deleted during the Hybrid Signature Support milestone
(Phase A); `examples/tutorials/54-execution-receipt/run.ts` and
`55-execution-receipt-verification/run.ts` each carry their own "historical note" explaining
the deletion and what each tutorial demonstrates instead today (the real, live
`ReceiptService`/`application.verify()` path, not the deleted cluster).

**What `packages/receipt` actually contains today:** `ReceiptEngine`
(`packages/receipt/src/ReceiptEngine.ts`) and `ReceiptBuilder`
(`ReceiptBuilder.ts`, a thin factory for it) — a _different, smaller_ pair of classes than
this entry originally named, not a renaming of them. `ReceiptEngine.generate()` hashes its
payload with `crypto.createHash("sha256").update(JSON.stringify(payload))` — a
stringified-JSON hash, not this codebase's `CanonicalSerializer` discipline every other
signed artifact uses (Trust Records, Receipts on the live path, Approval Artifacts,
execution authorizations) — and there is no verifier class in this package at all. Still
confirmed disconnected: zero references to `ReceiptEngine`/`@parmana/receipt` anywhere
outside `packages/receipt/src` itself, matching this entry's original "disconnected from
`packages/runtime` and `packages/api`" finding, still accurate. It remains real, shipped
code with a public export surface and zero automated proof of correctness — that
conclusion holds, just for the correct class names.

**Update (2026-09-08): deleted.** `packages/receipt` has been removed from this
repository entirely (`ReceiptEngine.ts`, `ReceiptBuilder.ts`, its own `package.json`,
and its project references from the root `tsconfig.json` and `packages/api/tsconfig.json`)
as part of a dead-code cleanup pass, re-confirming immediately before deletion that
nothing outside its own directory (and `package-lock.json`, which self-corrects on the
next `npm install`) referenced it. Real receipt generation was, and remains, entirely
unaffected — it is `@parmana/crypto`'s `ReceiptCrypto.createReceipt()`, wired into
`packages/runtime/src/services/receipt-service.ts`, a different class this entry never
described. This gap is now closed by removal rather than by adding tests to dead code.
Full repo `npx tsc -b` and `npx vitest run` clean after the deletion: 1,539 passed, 38
pre-existing skips, 0 failed (down from 1,551 — four now-meaningless test files for
other dead code removed in the same pass, see the runtime/storage/crypto/shared entries
in this same cleanup).

**Not to be confused with the real, live receipt mechanism**, which is fully implemented,
wired, and tested: `ReceiptService.generate()` (`packages/runtime/src/services/
receipt-service.ts`) — called directly by `ExecutionTrustApplication.execute()` on every
successful execution, after verification — loads the Trust Record, requires the latest
Verification to have actually succeeded (fail-closed otherwise, `ReceiptGenerationError`),
computes a hash and signature via `ReceiptCrypto` (`@parmana/crypto`, canonical
serialization, real Ed25519/hybrid signing), and persists the result via
`appendReceipt`. Tested by `packages/runtime/tests/integration/receipt.integration.test.ts`
and `receipt-hybrid.integration.test.ts`. This is what `docs/CLAIMS.md` 2.5's "Signed
Receipts"/`ReceiptCrypto` citation refers to.

**G-26. External audit of `docs/CLAIMS.md` 2.5/2.6 ("Execution Evidence / Receipt") reported
"Execution Evidence: Not yet implemented," citing a `TODO` stub. Independently investigated
and found to be a false positive caused by two genuine, since-fixed sources of confusion in
this repository itself, not by the underlying claim being false. RESOLVED.**

**What the audit found, verified accurate:** `ExecutionEvidenceComponent`
(`packages/runtime/src/components/ExecutionEvidenceComponent.ts`, as it existed before this
entry) contained exactly the `// TODO: Build ExecutionEvidence from enterprise execution
result.` stub the audit quoted, followed by `return context;` with no evidence built,
attached, signed, or verified. That description of that specific file was correct.

**What the audit got wrong, and why:** `ExecutionEvidenceComponent` was never wired into
the runtime pipeline at all — confirmed by repo-wide search: zero references anywhere
outside its own file, not even in `packages/runtime/src/components/index.ts`'s barrel
export. `RuntimeFactory.create()` (`packages/runtime/src/RuntimeFactory.ts`) only ever adds
`TrustChainValidationComponent` and `ExecutionComponent`
(`packages/runtime/src/components/ExecutionComponent.ts`) as pipeline stages. The real,
live execution-evidence path is `ExecutionComponent.execute()`, which builds the approved
request, forwards it to the `ExecutionSystem`, and then calls
`ExecutionEvidenceBuilder.build(response)` (`packages/runtime/src/
ExecutionEvidenceBuilder.ts`) — a complete, non-stub implementation that maps a real
`ExecutionResult` into a real `ExecutionEvidence` (`action`, `target`, `parameters`,
`success`, `executedAt`, `attributes`) — then persists it via
`ExecutionService.attachEvidence()` (`packages/runtime/src/services/
execution-service.ts:86-100`, a real `trustRecords.replaceExecution(...)` write, not a
no-op). This is the same evidence the Phase 3D certification independently confirmed is
embedded, hashed, and signed inside the Execution Trust Record
(`docs/architecture/phase3d-independent-authorization-certification.md` §8), and is
exercised by `razorpay-live.integration.test.ts`, `hubspot-live.integration.test.ts`, and
`hubspot-deal-update.integration.test.ts`. A separate, similarly-named class,
`ReceiptComponent`, has the identical "correctly implemented but not actually wired as a
pipeline stage" shape (live receipt generation happens via
`ExecutionTrustApplication.execute()`'s own direct `this.receipts.generate(...)` call, not
via this component) — not a stub like `ExecutionEvidenceComponent` was, so it did not
itself mislead this particular audit, but the same class of confusion.

Separately, the same audit's receipt-package findings ("no `ExecutionReceiptBuilder`
implementation, no `ReceiptEngine` implementation, no verifier implementation, no tests")
were traced to this document's own **G-6** entry, whose cited class names had gone stale
after those exact classes were deleted in an earlier session (see G-6's corrected text,
above) — an external reader citing this document in good faith would reach the same
mistaken conclusion the audit did.

**Fix, three parts:**

1. `ExecutionEvidenceComponent.ts` — confirmed dead, not exported from the package's public
   surface, zero references anywhere — **deleted outright**, removing the exact stub an
   auditor or a future contributor could otherwise find and mistake for the live path.
2. `ReceiptComponent.ts` — kept (it remains part of `@parmana/runtime`'s public export
   surface, `packages/runtime/src/index.ts`, so removing it is a larger compatibility
   decision than this fix's scope), but given an explicit doc comment stating it is not
   currently wired as a pipeline stage and naming the actual live invocation path.
3. G-6 (above) corrected to name this package's actual current classes
   (`ReceiptEngine`/`ReceiptBuilder`) instead of the deleted ones, and to explicitly
   distinguish it from the real, tested, live receipt mechanism.

**Verified:** `npx tsc -b` clean after the deletion (confirming no hidden caller existed);
full regression suite re-run, unchanged pass/fail/skip counts aside from the removed file
itself.

**G-27. `payments:execute` (vendor-payment) was a gap-in-waiting against the public
positioning claim "only what you authorize should become real" — real, committed code that
would have violated that claim had it ever been made a production capability as it then
existed. RESOLVED by outright removal (below), and the positioning claim itself
subsequently upgraded to YES by an independent fourth validation pass — see this entry's
own "Positioning-claim status" paragraph, below, for the full account. Originally
documented here per the Strategic Positioning source-code validation audit (2026-08-09,
read-only by its own rules, so this entry was originally that audit's required
documentation follow-up, not a restatement of new findings).**

**Not a live defect.** `createVendorPaymentConnector.ts:30-32` gates registration to
`process.env.NODE_ENV === "test"` only; `createConnectorRegistry.ts` skips registering it
otherwise. This is a real, structural exclusion (independently confirmed by reading the
gating condition directly, both in the Phase 3D certification and again in the Strategic
Positioning audit) — `payments:execute` cannot currently be reached through any production
`POST /execute` or `POST /transactions` request. The reason this still belongs in this
document: the mechanism excluding it is an environment variable, not a proof that its
authorization-relevant facts are true — a different, weaker kind of guarantee than every
other in-scope capability has.

**What exists, and why it's blocked, in full**: already investigated exhaustively in this
document's own "Investigation (2026-08-04): `vendor-payment` remains genuinely blocked, not
merely unattempted" entry (above, this same G-24 block) — re-read directly, not
transcribed, for this entry. Summary: `policies/vendor-payment/2.0.0/policy.json`'s
`signalsSchema` has five signals (`vendorVerified`, `invoiceVerified`, `paymentApproved`,
`sufficientFunds`, `riskScore`); only two (`paymentAmount`, `vendorId`) are bound to Intent
via `boundSignals`. The other five remain pure caller-declared attestations, with **no
independent verifier anywhere in this codebase** — confirmed again, fresh, by the Strategic
Positioning audit's own grep sweep. The plausible real-world sources for these facts
(`SapConnector`, `WorkdayConnector`, `OracleConnector`) are each a bare, write-only
`MockConnector` with no fetch capability to verify against; `riskScore` has no candidate
connector at all.

**What would need to be true before this capability could be enabled without contradicting
the positioning claim**: the same closure work Razorpay (TD-23, Phase 3B) and HubSpot
(TD-23, Phase 3C) already received — a `SignalStateVerifier` implementation that
independently re-derives each of the five facts from a real external system and rejects on
any disagreement with the caller's declared value, wired unconditionally into production
the way `RazorpaySignalStateVerifier`/`HubSpotSignalStateVerifier` are. This is **not**
attempted here — it requires building genuine external integrations (a KYB/vendor-
verification service, an AP/invoice-matching system, an approval-workflow system, a
treasury/balance API, a risk-scoring service) that do not exist in this repository in any
form today, a real feature-scoping decision for a future phase, not a documentation task.
**No code was changed for vendor-payment by this entry or the audit that prompted it.**

**Cross-reference audit, confirmed clean:** checked `docs/CLAIMS.md` for any claim that
`payments:execute`/vendor-payment would contradict. None found — 2.23's own text already
scopes the "CLAIM FULLY CERTIFIED" result to `razorpay:refund-create`/`hubspot:deal-update`
explicitly and names vendor-payment as out of scope "for that reason, not because it was
overlooked"; 3.3's scope clause already disclaims "any enterprise-specific connector"; no
claim anywhere states or implies repository-wide signal-verification coverage. No narrowing
edit to `CLAIMS.md` was needed as a result of this entry.

**RESOLVED by removal, not by independent verification.** Decision: `payments:execute`/
vendor-payment was never on the roadmap as a real capability, so building the independent
`SignalStateVerifier` work described above (a real feature-scoping project) was rejected in
favor of removing the capability outright — the gap can't exist if the capability doesn't.
Removed: `packages/connector-sdk/src/connectors/vendor-payment/` (the `VendorPaymentConnector`
class and its metadata — confirmed orphaned, zero live callers, predating even this fix),
`packages/api/src/bootstrap/createVendorPaymentConnector.ts` (the `NODE_ENV === "test"`-gated
factory this entry's own opening paragraph cited), `packages/api/src/bootstrap/
createCredentialProvider.ts` (its dedicated, single-purpose credential provider — confirmed
to have had exactly one caller, the registration block below), the vendor-payment
registration block inside `createConnectorRegistry.ts`, and the now-meaningless
`"vendor-payment"` entry from `createConnectorAuthenticator.ts`'s trusted Gateway-attestation
identity list. `payments:execute` now has no connector to resolve to **in any environment**,
not only outside `NODE_ENV=test` — confirmed by a new regression test asserting exactly
this (`create-connector-registry.test.ts`, "payments:execute has no connector to resolve to
in any environment").

**Deliberately not removed**: `policies/vendor-payment/2.0.0/policy.json` and the shared
test fixtures (`packages/api/tests/fixtures/{business-transaction,policies}.ts`) that use it
as their generic default example — investigation found these are load-bearing shared
infrastructure for 19+ unrelated test files (caller-auth, credential-isolation, receipts,
replay, trust records, verification, and others that have nothing to do with vendor-payment
as a business capability), not vendor-payment-specific testing. The policy file's continued
existence carries no execution risk with zero connector able to back it — a caller
presenting `intent.action: "payments:execute"` still cannot cause any real-world effect,
regardless of policy outcome, because `ConnectorSdkRegistry.resolveCapability` fails closed
with "No connector registered for capability" before any connector dispatch is possible.
Migrating the shared fixtures away from the vendor-payment name entirely was considered and
explicitly declined as disproportionate to the actual risk (none) for this pass — flagged
here, not silently decided.

**Positioning-claim status, confirmed by the fourth validation pass.** "Only authorized
actions become execution" no longer has a capability-shaped exception. This entry
documented the removal but deliberately did not itself re-certify the positioning claim —
that re-certification has since happened: a fourth, independent Strategic Positioning
validation pass, run fresh with no reliance on this entry's own conclusions, re-traced the
production connector registry from source, re-confirmed `payments:execute` has no connector
to resolve to in any environment, independently scrutinized the replacement test-only
connector for new bypass risk (found none), and upgraded the executive verdict from
PARTIALLY SUPPORTED to **SUPPORTED BY IMPLEMENTATION — YES**. Full record, including the
precise honesty constraint on what was and wasn't re-verified in that pass (2 of 10 negative
tests re-run fresh; multi-tenant isolation and the direct-database-write bypass finding left
as "unchanged, not re-traced"): `docs/architecture/strategic-positioning-validation.md` §6
("Final Answer") and "Verdict History"; also cited in `docs/CLAIMS.md` §2.25.

**Verified**: `npx tsc -b --force` clean; full regression suite re-run (see this session's
own record for exact pass/skip counts, unchanged aside from the tests removed/updated for
this capability specifically).

**Update (code-only ground-truth capture pass, follow-up closure): one more miss from this
entry's own removal list, found and fixed.** `packages/policy/src/CapabilityPolicyBinding.ts`'s
`CANONICAL_CAPABILITY_POLICY_BINDINGS` still carried a `"payments:execute" →
{name: "vendor-payment", version: "2.0.0", ...}` entry — not in this entry's "Removed:" list
above, and confirmed genuinely orphaned relative to the current connector registry
(`createConnectorRegistry.ts` registers exactly `test-fixture`, `razorpay`, `hubspot`; no
`payments:execute`-capable connector exists in any environment, as this entry itself already
established). Inert, not dangerous — `CapabilityPolicyBinder.findViolation()` can only ever
reject a request for a bound action, and `payments:execute` has no connector to reach
`RuntimeEngine` for in the first place — but stale relative to `CANONICAL_CAPABILITY_POLICY_BINDINGS`'s
own doc comment, which claims the table covers "every capability actually registered in
production bootstrap." Removed the entry; `packages/policy/tests/unit/CapabilityPolicyBinder.test.ts`'s
`"binds every production-registered capability..."` test (which had been asserting the stale
set, including `payments:execute`, as expected output — itself a second symptom of the same
miss) updated to match the corrected table. Full regression suite re-run clean, unchanged
pass/skip counts aside from this one test's edited assertion. No other reference to this
binder entry found in `CLAIMS.md` or elsewhere in this file that depended on `payments:execute`
being present in the table.

**G-28. `PARMANA_AUTH_DISABLED=true`'s exact scope, precisely documented (previously
undocumented in either `CLAIMS.md` or this file, despite `CLAIMS.md` 2.16/2.17 already
citing the flag by name).** Flagged by the Strategic Positioning source-code validation
audit (2026-08-09) as a real, disclosed bypass path that needed its precise scope stated
somewhere, rather than left implicit — "don't let this get flattened into either
overstating or understating the risk" was that audit's own framing, and it is the right bar
to document against.

**What the flag does, confirmed directly:** `createCallerAuthenticator.ts:31-39`
(`packages/api/src/bootstrap/`) returns `{ disabled: true }` when `config.auth.disabled` is
set, after printing a loud, unmissable startup warning ("WARNING: PARMANA_AUTH_DISABLED=true.
The API is accepting requests with no caller authentication. This must never be set in a
real deployment."). Default behavior remains fail-closed: with no keys configured and this
flag unset, the process refuses to start at all (same file, lines 41-48) — the flag is the
only way around that refusal, and it is opt-in, never a silent fallback.

**What the flag does NOT do, confirmed directly:** `RuntimeEngine`, `PolicyEngine`,
`CapabilityPolicyBinder`, `SignalIntentBinder`, and every `SignalStateVerifier` operate on
the constructed `BusinessTransaction` object only — none of them ever reads the Express
`Request` object, `req.callerId`, or anything caller-auth-middleware-derived (confirmed by
direct grep of `RuntimeEngine.ts`/`PolicyEngine.ts`/`SignalIntentBinder.ts`/
`CapabilityPolicyBinding.ts` for any reference to caller identity: zero hits). The
caller-auth middleware and the action-level authorization pipeline are two structurally
separate mechanisms with no dependency between them. Setting `PARMANA_AUTH_DISABLED=true`
therefore removes **caller identity and accountability** (who submitted this request,
whether they're allowed to assert the `authority.principalId` they declared, per
`isPrincipalAllowed.ts`) — it does **not** remove **action-level authorization**
(`CapabilityPolicyBinder`, `SignalIntentBinder`, `PolicyEngine.evaluate`,
`SignalStateVerifier`, `ExecutionGate.enforce`), which remain fully active and would still
reject an unauthorized `razorpay:refund-create`/`hubspot:deal-update` request exactly as
they do with caller-auth enabled.

**Precise statement for any future doc referencing this flag:** "`PARMANA_AUTH_DISABLED`
disables caller identity/accountability only; it does not disable action-level
authorization." Neither "auth can be fully disabled" nor silent omission of the flag
correctly describes current behavior — both were considered and rejected for this entry.

**G-7. `execution-failure.integration.test.ts` is permanently `describe.skip`ped**, not
env-gated. `RuntimeFactory` always constructs its own `DefaultExecutionSystem` internally,
with no dependency-injection seam for a test to supply a failing `ExecutionSystem`. The
claim it would prove (that an execution-system failure is surfaced as
`execution.status === "FAILED"` with a 500, not silently swallowed) remains unverified.
Unlike every other gap in this document, closing this one requires a `RuntimeFactory`
constructor signature change, which is out of scope for a test-only pass.

**G-8. Several error branches remain untested, all reachable only via direct library use,
not via any HTTP path this server currently exposes:**

- `ExecutionGateway.ts:246-249`: the "executionControl is incomplete" guard. Only reachable
  by direct library misuse; production's bootstrap always supplies a complete options object.
- `SignedTokenConnectorAuthenticator`'s two distinct identity-mismatch branches
  (`gatewayId` mismatch at line 65-67, `publicIdentity` mismatch, separately from the
  signature-verification branch that every existing test actually exercises first);
  every existing test uses one consistent identity, so these specific branches, distinct
  from "signature doesn't verify," are unexercised.
- `SdkConnectorExecutor.ts:47-60`: `expectedVersion` mismatch and `health.status ===
"unavailable"` rejections. Neither is used by `packages/api`'s bootstrap today
  (`createConnectorRegistry.ts` never passes `expectedVersion`), so also unreachable from
  HTTP currently, only from direct library use.
- `SdkConnectorExecutor.ts:62-67`'s own capability check is structurally dead in every
  configuration this repo wires up: `DefaultConnectorPolicy.assertAllowed()` runs the
  identical check earlier in the same call chain and always wins first.

**G-9. `ExecutionControlService` and `SessionCredentialSecureConnector` each independently
audit-log the same execution** (confirmed directly this pass while writing the new
credential-isolation test; see "Gaps closed" #1 above). Not a security defect: both
records are consistent, and only the connector-level one carries `credentialId`. It is a
duplicate-logging quirk worth a one-line fix (skip the outer log, or document why both
exist) but was out of scope for this pass since it isn't test-only.

**G-32. Signing key for Execution Authorizations was shared across every tenant in a
single deployment process — no per-tenant isolation of the signing key itself, even
though per-key _verification_ (resolving a public key by the authorization's own `keyId`,
with expiry/revocation) was already wired into production. Found 2026-09-09 during an
architecture audit comparing Parmana's authorization-proof model against a reference
"boundary-scoped proof generation" checklist. RESOLVED same-day.** `RuntimeAuthorizationSigner`
(`packages/runtime/src/RuntimeAuthorizationSigner.ts`) previously hardcoded every signature to
`DEFAULT_KEY_ID` ("default") regardless of the transaction's `metadata.tenantId` — every
tenant's Execution Authorization was signed with the same private key, in the same process.
This was only half the picture: `ExecutionGateway`/`EnvelopeVerifier`
(`packages/execution-gateway/src/ExecutionGateway.ts`, wired via `createExecutionGateway.ts`'s
own "Gap 2A" comment) already resolve the public key to verify an authorization against by that
authorization's own `keyId` field, through the same `FileKeyProvider` (which already supports
arbitrary keyIds) and a `FileKeyExpiryStore` for revocation — but nothing ever produced an
authorization carrying any `keyId` other than `"default"`, so that verification-side machinery
had no per-tenant keys to actually exercise.

**Fix:** new `TenantKeyResolver` interface and `FileTenantKeyResolver` implementation
(`packages/runtime/src/TenantKeyResolver.ts`). Given a `tenantId`, it looks for a dedicated key
named `tenant.<tenantId>` via the existing `KeyProvider.hasKey()` — no new key storage, the same
`FileKeyProvider` / `keys/<keyId>.private.pem` layout, provisioned exactly like any other key via
`scripts/generate-keypair.ts --key-id tenant.<tenantId>` — falling back to `DEFAULT_KEY_ID` when
no tenantId is present, no dedicated key has been provisioned yet, or the tenantId doesn't form a
valid keyId (`FileKeyProvider`'s `^[A-Za-z0-9._-]+$` check, G-20, throws rather than returning
false for a malformed one; caught here and treated as "no dedicated key"). `RuntimeAuthorizationSigner.sign()`
now resolves the keyId this way instead of a hardcoded static constant, and `RuntimeEngine.execute()`
(`packages/runtime/src/RuntimeEngine.ts`) passes `transaction.metadata?.tenantId` through to it.

**Verified:** `packages/runtime/tests/unit/tenant-key-resolver.test.ts` (new, 5 tests, stub
`KeyProvider`): resolves the default key when no tenantId is supplied; resolves the tenant
keyId when a dedicated key is provisioned; falls back to default when it is not; falls back
to default on an invalid keyId instead of throwing; two tenants with distinct provisioned
keys never resolve to the same keyId. `packages/runtime/tests/unit/execution-authorization-wiring.test.ts`
(2 new tests, real Ed25519 keypairs written into the hermetic per-file `PARMANA_KEY_DIR`): a
transaction with `metadata.tenantId: "acme-corp"` and a provisioned `tenant.acme-corp` key
produces an authorization whose `keyId` is `"tenant.acme-corp"`, verifies successfully under
that tenant's own public key, and — the isolation property itself — fails signature
verification under the shared default deployment's public key; a transaction with no
`tenantId` still signs under `"default"`, unchanged. Full `packages/runtime`, `packages/crypto`,
`packages/execution-gateway` suites: 265 passed, 0 failed (no regressions).

**Not addressed by this fix, left open:** (1) per-tenant keys must still be provisioned
manually, one `generate-keypair` invocation per tenant — there is no automated onboarding,
rotation, or KMS/HSM-backed provider; `FileKeyProvider`'s own doc comment already flags it as
intended for development/self-hosted use, with production expected to swap in a KMS/HSM
implementation of the same `KeyProvider` interface. (2) `PolicyEngine` itself
(`packages/policy/src/PolicyEngine.ts`) remains one shared, stateless, in-process instance
across every tenant in a deployment — unchanged by this fix, and not a gap in the same sense,
since it holds no key material or secrets to isolate; it is a pure rule-evaluation function
over caller-supplied `Policy`/`PolicySignals` values. (3) A tenant whose dedicated key is never
provisioned degrades silently to the shared default key rather than failing closed — deliberate,
so adoption can be incremental per tenant, but it means a misspelled or unprovisioned `tenantId`
produces a valid, unlabeled authorization under the default key with no warning.

**G-33. `boundSignals` coverage on rule-referenced facts was advisory (a `console.warn` at
`PolicyRouter.load()` nobody reviewing a running system would see), not enforced — a fact
with no genuine Intent-side equivalent (the common, legitimate case: independently-attested
booleans/scores like `vendorVerified`, `riskScore`) and a fact that was simply forgotten
were indistinguishable, both silent. Found 2026-09-09 during a production-readiness audit
that ran the real `vendor-payment` policy through `RuntimeEngine` and surfaced the warning
live (Tutorial 105). Checking all 10 real policies in `policies/` at that point showed every
single one had uncovered facts — none had ever been reviewed or documented. RESOLVED
same-day.** `Policy.unboundSignalReasons` (`packages/policy/src/types/Policy.ts`) is a new
optional per-policy field naming, with a reason, every rule-referenced fact deliberately left
out of `boundSignals` — the same "reviewed exemption, not a silent gap" idea as
`@parmana/capability-registry`'s `INTENTIONALLY_UNBOUND_CAPABILITIES` (G-30 above), but
scoped per-policy rather than centralized, since a fact only ever means something in the
context of the one policy that references it.

`PolicyValidator.validate()` now fails closed: any rule-referenced fact neither in
`boundSignals` nor `unboundSignalReasons` throws `PolicyValidationError` naming it, instead
of the old advisory warning. `unboundSignalReasons` is structurally validated the same way
`boundSignals` already was (must be an object, non-empty string keys, non-empty string
reasons), plus a new contradiction check: a fact present in both `boundSignals` and
`unboundSignalReasons` is rejected outright ("a bound fact needs no reason for being
unbound"). `findUncoveredFacts()` now excludes acknowledged facts from its result, so both
existing callers benefit without their own code changing: `PolicyRouter.load()` (removed its
now-redundant `console.warn` block entirely — `validate()` above it already throws for
anything that would have triggered it) and `packages/api/src/routes/pending-policy-changes.ts`'s
`coverageWarnings` (kept, now genuinely empty for any newly-created proposal since `validate()`
already rejects it first, but still meaningful for proposals created before this fix shipped).

**Two real, additional bindings found and fixed in the same pass, not just documented away:**
`connector-capability/1.0.0` and `customer-refund/1.0.0` each had an amount fact
(`paymentAmount`, `refundAmount`) with a genuine Intent-side equivalent
(`parameters.amount`, exactly `vendor-payment`'s own existing pattern) that had simply never
been bound — a real, live scope-drift gap for those two reference policies, not merely an
advisory-vs-enforced framing issue. Both now have a real `boundSignals` entry; `connector-capability`'s
`capability` fact remains acknowledged via `unboundSignalReasons`, not bound, because
`SignalIntentBinder`'s `IntentSnapshot` (`packages/policy/src/SignalIntentBinder.ts`) only
exposes `{ target, parameters }`, never `action` — there is no dot-path for a capability/action
selector to bind to today.

**Every one of the 10 real policies in `policies/` was updated** with either a new
`boundSignals` entry (the two above) or specific, per-fact `unboundSignalReasons` explaining
why that fact has no Intent-side equivalent (independently-attested booleans, computed risk
scores, or — for `hubspot-deal-update`'s four unbound facts — decision facts derived from
already-bound raw facts, not raw Intent fields themselves). None were generic copy-paste:
each reason names the actual mechanism (identity provider attestation, fraud/risk assessment,
maintenance-window clock check, GitHub's own review/status-check state, etc.) that produces
that specific fact.

**Verified:** `packages/policy/tests/unit/PolicyValidator.test.ts` (7 new cases: acknowledged
fact excluded from `findUncoveredFacts`, `validate()` passes when acknowledged, fails closed
naming the fact when neither bound nor acknowledged, passes when bound instead, rejects a
non-object `unboundSignalReasons`, rejects an empty reason string, rejects a
bound-and-acknowledged contradiction). `packages/policy/tests/unit/PolicyRouter-boundSignals-coverage.test.ts`
rewritten from a warn-spy test to a throw/no-throw test (3 cases: loads cleanly when bound,
loads cleanly when acknowledged, fails closed naming the policy and fact when neither).
Every real policy in `policies/` independently confirmed to pass `PolicyValidator.validate()`
directly (all 10, script-verified). Tutorial 105 re-run: the `policy_boundSignals_coverage_incomplete`
warning that originally surfaced this gap no longer appears; `vendor-payment` loads and
executes unchanged. Full repo suite: 1560 passed, 38 skipped, 0 failed — no regressions from
touching all 10 production policy files and the fail-closed validator change.

**Not addressed by this fix, left open:** an `unboundSignalReasons` entry is a documented
claim, not a proof — nothing verifies that a fact really has no Intent-side equivalent beyond
a human (or an AI acting as one) asserting it in the reason text, the same trust model
`INTENTIONALLY_UNBOUND_CAPABILITIES` already has for capabilities. A future new policy with a
genuinely-bindable fact left unbound would now be caught immediately at load/proposal time
(fail-closed, not silent) — but a reviewer must still judge whether the _reason given_ for an
acknowledged fact is actually true.

**Correction, found the same day:** "all 10 real policies were updated" above was scoped to
`policies/` only — it missed two example policies under `examples/` that this fix's own
fail-closed `validate()` also applies to, which broke `npm run examples`. See G-37.

**G-34. `SupabaseClientFactory` (the supabase-js/PostgREST client class) had zero remaining
production call sites, and its stale doc-comment references across 8 other files still
described it as the current path. Found 2026-09-09 during the same production-readiness
audit that produced G-33, cross-checked against Finding 4 of that audit
(`docs/audit/PRODUCTION-READINESS-AUDIT-2026-09-09.md`): 8 of 9 `Supabase*` storage classes
had already migrated to `PostgresPoolFactory` (direct Postgres, bypassing PostgREST), leaving
`SupabaseClientFactory.create()` referenced only in comments describing the _old_ path.
RESOLVED same-day.** Grep-confirmed (the same discipline as the 2026-09-08 dead-code cleanup,
commit `e6c73f0`) before deleting: zero call sites of `SupabaseClientFactory.create()` outside
its own file, no dedicated test file, `SupabaseClient` type unused elsewhere. Deleted, along
with its export from `packages/storage/src/index.ts` and its now-unused `@supabase/supabase-js`
dependency from `packages/storage/package.json` (`npm install` resynced the lockfile).

**A second, related dead file found in the same pass:** `assertSupabaseConfigured.ts`
(`packages/api/src/bootstrap/`) — its own doc comment claimed it was "shared by every
bootstrap factory that requires a durable, Supabase-backed store (createNonceStore.ts,
createCallerAuditSink.ts)," but both of those factories had already moved to
`assertDatabaseUrlConfigured.ts` instead (part of the same PostgREST-removal migration).
Grep-confirmed zero call sites and no test file; deleted.

**Eight stale doc-comment references to `SupabaseClientFactory`** across
`createCallerAuditSink.ts`, `createNonceStore.ts`, `PostgresPoolFactory.ts`,
`StorageFactory.ts`, `SupabaseStorageProvider.ts`, and three integration test files were
rewritten to describe the actual current mechanism (a supabase-js/PostgREST client, generically
— since the class naming it no longer exists) rather than naming a deleted class.
`createCallerAuditSink.ts`'s comment specifically also dropped a stale "TEMPORARY... revert
once SU-437429 is resolved" framing that `docs/CLAIMS.md` §3.11's own update (same date) found
to be inaccurate — see that update for why this is no longer a single revertible workaround.

**Third, unrelated finding from the same audit, also closed here:** `packages/audit.txt`, a
committed, tracked UTF-16 binary dump (a garbled Windows `tree`-style folder listing) — the
same shape of debris `docs/VERIFICATION-GAPS.md`'s own 2026-07-17 audit closeout removed
once already (`trace.txt`, `claim.md`), just not caught by that pass. `git rm`'d.

**Fourth item from the same audit's dead-code section, resolved by investigation rather than
deletion:** `@parmana/replay` (`ReplayEngine.ts`/`ReplayBuilder.ts`/`ReplayExecutor.ts`) was
flagged as needing a follow-up check for a live call site outside its own package. Confirmed:
none exists in any production package (`api`, `runtime`, `execution-gateway`, etc.) — its only
consumer outside its own package is `examples/tutorials/06-replay/run.ts`. Not deleted: this
is the same shape of intentional, tested, documented extension point the 2026-09-08 cleanup
(`e6c73f0`) explicitly excluded `ReceiptComponent.ts` for — 5 test files in
`packages/replay/tests`, a dedicated tutorial demonstrating it, not wired into the default
pipeline by design rather than by oversight.

**Verified:** full workspace `npx tsc -b` clean (confirms zero remaining references anywhere
a type-checker would catch them). Full repo suite: 1559 passed, 38 skipped, 0 failed — the
one-test difference from G-33's own count is environment/collection variance (re-run
confirmed 0 failures both times), not a regression; neither deleted file had a test to lose.

**G-35. `dilithium3` (the internal signature-algorithm identifier) had no way for a new
deployment to configure post-quantum signing using its accurate NIST/FIPS 204 name
("ml-dsa-65") — only the historical internal name was ever an accepted config value. Found
2026-09-09 as the Cryptographic Naming item in the same production-readiness audit as G-33/
G-34. RESOLVED same-day, as an alias rather than a rename.** The audit's own first-pass
conclusion (`docs/audit/PRODUCTION-READINESS-AUDIT-2026-09-09.md`) was that renaming
`dilithium3` itself would be a regression: it would break `PRIMARY_SIGNATURE_PROVIDER=dilithium3`
for every existing deployment, for zero externally-visible benefit, since `docs/CLAIMS.md` and
`docs/site/cryptography/overview.mdx` already disclose the naming history to readers. Asked to
fix the finding anyway, the corrected, non-breaking version is an **alias**, not a rename:
`parseSignatureAlgorithm` (`packages/shared/src/config/ConfigValidation.ts`) now resolves
`"ml-dsa-65"` to the canonical `SignatureAlgorithms.DILITHIUM3` ("dilithium3") value before
validation, so `PRIMARY_SIGNATURE_PROVIDER`/`SECONDARY_SIGNATURE_PROVIDER=ml-dsa-65` and
`=dilithium3` are now fully equivalent — an existing `dilithium3`-configured deployment is
completely unaffected, since the canonical identifier itself was never touched. Both
`generate-keypair.ts` CLIs (`scripts/generate-keypair.ts --algorithm`,
`packages/crypto/scripts/generate-keypair.ts --algorithm`) accept the same alias, normalizing
to `dilithium3` before generating a key, for the identical reason and by the same mechanism.

**Verified:** `packages/shared/tests/unit/config-validation.test.ts` (4 new cases: defaults to
`ed25519` when unset, accepts the canonical `dilithium3` unchanged, accepts `ml-dsa-65` resolving
to `dilithium3`, throws naming the value for an unrecognized algorithm). Both CLI scripts
smoke-tested directly with `--algorithm ml-dsa-65` against a scratch key directory: both
generate a real ML-DSA-65 keypair and log it under the canonical `dilithium3` name. Full
workspace `npx tsc -b` clean; full repo suite: 1563 passed, 38 skipped, 0 failed.

**Not addressed by this fix, and not needed:** the internal identifier `dilithium3` is
unchanged everywhere downstream (`SignatureRegistry`, `Ed25519SignatureProvider`'s sibling
`Dilithium3SignatureProvider`, key-file naming, log output) — this was a config-input
alias only, exactly the scope the audit's own non-breaking-improvement framing called for.

**G-36. `@supabase/supabase-js` follow-on dependency-hygiene pass (flagged, not required, by
the same 2026-09-09 audit that produced G-33/G-34/G-35) removed the dependency from 5
package.json files that had no real usage (`api`, `crypto`, `policy`, `runtime`, `shared`) --
but the pass's own verification method (grep across `packages/*/src` and `packages/*/tests`
only) missed two real, legitimate usages outside that scope. RESOLVED same-day, by the same
session that introduced the regression, before either was committed.** Full workspace `npx
tsc -b` and the full `vitest run` suite both stayed green throughout, because neither covers
a standalone script invoked only via its own `npm run <script>` entry
(`tsx path/to/script.ts`) with no dedicated test file — exactly the blind spot this entry
documents. `packages/storage/scripts/migrate.ts` (the `npm run migrate` script,
`createClient(url, key)` for `client.rpc("exec_sql", ...)`) and `scripts/verify-policy-changes-approved.ts`
(a fail-closed CI/deploy gate, `createClient` again) both import `@supabase/supabase-js`
directly. The first broke because `packages/storage/package.json`'s `@supabase/supabase-js` line was
already removed in G-34 (deleting `SupabaseClientFactory` there looked, at the time, like it
made the dependency fully unused in that package -- `migrate.ts` lives in `packages/storage/scripts/`,
outside the `src`/`tests` grep G-34's own verification covered, so it was missed). The second
broke because it was never declared anywhere at all -- a phantom dependency that only ever
worked because some workspace package's declaration hoisted a copy into the shared root
`node_modules`, with nothing in `scripts/verify-policy-changes-approved.ts`'s own package.json
(there is none; it is a root-level script) recording that it needed one.

**Caught by:** running the full test suite one more time after `npm install` resynced the
lockfile -- `scripts/tests/verify-policy-changes-approved.test.ts` failed immediately with
`Cannot find package '@supabase/supabase-js'`, not a subtler runtime error. `migrate.ts` has
no test at all; caught only by directly invoking it (`npx tsx packages/storage/scripts/migrate.ts`)
to confirm the import itself resolves.

**A genuine, disclosed side effect of that direct invocation:** this repository's own `.env`
carries live Supabase credentials (see this document's own "Environment note," above), and
`migrate.ts` reads them unconditionally with no dry-run flag. Running it attempted a real
`client.rpc("exec_sql", ...)` call against a live project. It failed immediately with
`PGRST202` ("Could not find the function public.exec_sql(sql) in the schema cache") --
that live project has no `exec_sql` Postgres function defined, so no SQL from any of the 8
found migration files ever executed and nothing was changed. Disclosed here for the same
reason `INC-1`/`INC-2`-style entries exist in this document's history: a script that touches
live infrastructure was run without first checking what it would do, and the honest
resolution is "here is exactly what happened and why it was safe," not silence.

**Fix:** `@supabase/supabase-js` restored to `packages/storage/package.json` (`dependencies`,
matching its pre-existing category) and newly added to the root `package.json`
(`devDependencies`, matching `dotenv`'s own category there for the same class of
root-level tooling script) -- not re-added to any of the 5 packages actually confirmed unused.

**Verified:** `npm install` (net delta: -4 packages across the 6 package.json files touched by
this whole pass, not -6, since 2 were restored). Full workspace `npx tsc -b` clean; full repo
suite: 1564 passed, 38 skipped, 0 failed, `verify-policy-changes-approved.test.ts` included and
passing. `migrate.ts` re-invoked once more (see disclosure above) to confirm the import
resolves; not re-run beyond that.

**Lesson for the next such pass, not yet built:** "grep `packages/*/src` and
`packages/*/tests`" is not "grep the repo" -- `scripts/`, `packages/*/scripts/`, and any other
standalone-tool location need the same check, and neither `tsc -b` nor `vitest run` cover a
script with no dedicated test that isn't part of any package's compiled `tsconfig` sources.

**G-37. G-33's fail-closed `boundSignals` change (`PolicyValidator.validate()` now throws for
an uncovered, unacknowledged fact) broke `npm run examples` at Tutorial 14 -- a second,
distinct instance of the exact blind spot G-36 just documented: `npm test` does not run
`npm run examples`, so a real, user-facing entry point went unverified by the full-suite runs
that accompanied G-33's own commit. RESOLVED same-day, before either regression was
committed.** `examples/tutorials/14-custom-policy/policies/high-value-payment/1.0.0/policy.json`
(a standalone example policy, not one of the 10 real ones under `policies/`, that G-33's own
audit never enumerated) referenced 7 facts with neither a `boundSignals` nor an
`unboundSignalReasons` entry. `examples/shared/policies/default-policy.json` (the minimal
demo policy shared across many tutorials) had the same shape of gap for its one fact,
`approved` -- not yet hit by `npm run examples` at the time this was found, but latent and
certain to surface. Both fixed the same way as G-33's own fix: `high-value-payment` gained a
real `boundSignals` entry for its genuinely bindable `paymentAmount` fact (mirroring
`vendor-payment`'s own pattern) and `unboundSignalReasons` for the rest;
`default-policy.json` gained a single `unboundSignalReasons` entry for `approved`, explicitly
noting it is deliberately the simplest possible demo signal, not meant to demonstrate
`boundSignals` coverage.

**A separate, smaller gap found and fixed in the same pass, unrelated to G-33:**
`scripts/run-examples.ts`'s hardcoded list never included `examples/tutorials/105-tenant-key-isolation/run.ts`
(added the same day this Tutorial itself was, in the same broader audit session) -- the
tutorial existed and worked standalone, but `npm run examples` silently never exercised it.
Added to the list, immediately after Tutorial 104.

**Verified:** full repo-wide search for every `policy.json` (and any other `.json` file
containing a `"rules"` array) under `examples/` confirmed only these two needed a fix — the
others either reference no facts at all (`always`-only conditions, or route to an
already-covered policy) or are exercised only via direct `PolicyEngine.evaluate()` calls that
never pass through `PolicyRouter.load()`/`validate()` at all
(`examples/tutorials/02-policy-evaluation/policy.json`), and `examples/audit/AS-001-approved-vendor-payment/policy.json`
is not executed by `npm run examples` or any test at all (no `run.ts` references it). `npm
run examples` re-run twice after the fix: 98/98 tutorials completed, exit code 0, zero
`PolicyValidationError`s or any other error, both times. (One earlier re-run hit an unrelated,
non-reproducible `Cannot find module '@parmana/policy'` transient failure at Tutorial 03,
isolated and confirmed to be Windows filesystem-race flakiness from spawning 90+ sequential
`tsx` child processes, not a real regression — the same tutorial ran cleanly standalone and on
every other full run.) Full `vitest run` suite re-confirmed unaffected: 1564 passed, 38
skipped, 0 failed.

**G-38. `PolicyOutcome`/`PolicyAction` carried a third value, `REQUIRE_OVERRIDE`, that no real
policy in this repository ever used, and that `DecisionBuilder.toDecisionOutcome()`
(`packages/runtime/src/DecisionBuilder.ts`) collapsed straight to `DecisionOutcome.REJECTED`
in any case — functionally indistinguishable from an ordinary `REJECT` at the point execution
is actually gated. Found 2026-09-09 in a policy approval/rejection audit. RESOLVED same-day,
after an explicit trade-off decision — see the correction below.** Removed from both enums
(`packages/policy/src/types/PolicyAction.ts`, `packages/policy/src/types/PolicyOutcome.ts`)
and their one real switch-statement branch each (`PolicyEngine.ts`'s `toOutcome()`,
`DecisionBuilder.ts`'s `toDecisionOutcome()`); both already had an unconditional `default:
REJECT`/`REJECTED` branch, so removing the explicit case is a no-op for behavior.

**Correction, found during this same investigation, before deleting anything:** the initial
characterization of `REQUIRE_OVERRIDE` as simple forgotten dead code was itself incomplete.
Two real tests — `packages/connector-sdk/tests/unit/reference-policy.test.ts` and
`packages/connector-hubspot/tests/unit/hubspot-deal-update-policy.test.ts` — explicitly
asserted "never produces a `require_override` outcome," and the former's own comment read
_"Phase 1's PolicyAction enum (locked) has no approval-workflow outcome, and this policy does
not use require_override"_ — language that reads as a deliberately reserved extension point
for a future per-transaction approval-workflow feature, not an oversight, with these two tests
existing specifically to catch a policy author using it before that mechanism is built. Three
other docs (`POLICY-DATASTRUCTURE.md`, `PARMANA-EXP-ACTUAL-EXECUTION-FLOW.md`,
`docs/site/reference/policy.mdx`) all listed it as ordinary current state, none flagging it as
deprecated. This was surfaced and the trade-off made explicit before proceeding: keep it
(document the reservation) vs. delete it (lose the reserved extension point and force
reinventing it later if that feature is ever built) — **delete was the explicit choice made**,
accepting that trade-off. The two guard tests' `require_override`-specific assertions were
removed (rather than reworked to reference a value that no longer type-checks); their
surrounding test files' leading comments were updated to match. If a real per-transaction
approval-workflow state is ever built, it starts from zero design memory of this decision —
that is the concrete cost of the choice made here, not a residual bug.

**Verified:** repo-wide grep for `REQUIRE_OVERRIDE`/`require_override` confirmed exactly 3 real
code sites (the two enums, the two switch statements) before deleting, plus the two guard
tests and 6 documentation files (2 historical audit-log snapshots left untouched, matching
this document's own "don't silently rewrite history" discipline; 4 current-state docs updated:
`docs/site/reference/policy.mdx`, `POLICY-DATASTRUCTURE.md`,
`PARMANA-EXP-ACTUAL-EXECUTION-FLOW.md`, `docs/CONNECTOR-BUILD-GUIDE.md`). Full workspace `npx
tsc -b` clean. Full repo suite: 1562 passed (2 fewer than before, exactly the two removed
guard-test assertions — not a coverage loss, since the invariant they checked is now enforced
by the type system itself for any code respecting `PolicyAction`'s type), 0 failed.

**G-39. No detection existed for two policy rules whose conditions could both be true for the
same input — first-match-wins means the earlier one always decides silently, with nothing
surfacing that the later rule is partly or wholly unreachable. Found 2026-09-09 in the same
audit as G-38. RESOLVED same-day.** New `PolicyValidator.findRuleConflicts(policy)`
(`packages/policy/src/PolicyValidator.ts`), returning a `RuleConflictWarning[]` — deliberately
**advisory, never wired into `validate()`'s fail-closed throw** (see the method's own doc
comment): unlike a missing `boundSignals` entry, which has one unambiguous fix, a flagged
overlap is a heuristic judgment that might be a real bug or might be an intentional priority
ordering, and this method does not claim to be bug-free for every condition shape it's asked
to compare. Wired as advisory `console.warn`s from `PolicyRouter.load()` (event
`policy_rule_conflict_detected`) and surfaced alongside the existing `coverageWarnings` in
`packages/api/src/routes/pending-policy-changes.ts`'s proposal-creation and listing endpoints,
as a new `ruleConflicts` field.

**A materially different, corrected implementation, not the naive version originally
proposed:** an initial design (checking only exact-equal-threshold pairs like `lte 20` vs
`gt 20`, and treating any `always: true` condition as unconditionally overlapping with
everything else) had two real bugs, caught before shipping by running it against every real
policy in this repo:

1. **It would have flagged the ordinary trailing `always: true` catch-all as "conflicting"
   with every other rule in every single policy** — that pattern exists in all 10 real
   policies by design (the idiomatic fail-closed default), so this would have produced 100%
   false-positive noise, defeating the feature. Fixed: an `always: true` condition is only
   ever flagged if it is NOT the last rule (which does mean something real — every rule after
   it is unreachable); the expected trailing catch-all is never compared against anything.
2. **It got asymmetric numeric thresholds wrong** — `lte 10` vs `gt 20` (genuinely disjoint:
   nothing is both ≤10 and >20) would have been incorrectly flagged as `DEFINITE_OVERLAP` by a
   heuristic that only checked whether two range operators' values were exactly equal. Fixed
   with real ray-interval overlap math (`raysOverlap`): two same-direction rays (`lt`/`lte` vs
   `lt`/`lte`, or `gt`/`gte` vs `gt`/`gte`) always overlap; opposite-direction rays overlap
   only when the upper bound exceeds the lower bound (or is equal with both sides inclusive).
3. **A third gap, found (not in the original proposal) while verifying against real
   policies:** every real policy's `approve` rule is a nested `all` conjunction, while its
   `reject-*` rules are simple single-fact leaves — the naive design would return
   `NEEDS_REVIEW` for literally every approve/reject pair in every real policy (not a false
   positive, but still 100% noise). Fixed with a sound generalization: a nested `all` is
   provably `NO_OVERLAP` with a leaf (or with another `all`) if any one of its conjuncts is
   itself provably disjoint from the other side — one false conjunct makes the whole
   conjunction false regardless of the rest, so this never claims `DEFINITE_OVERLAP` for a
   composite condition (only `NO_OVERLAP`, proven, or `NEEDS_REVIEW`, honestly undetermined).

**Verified against every real and example policy in the repository** (a scratch script, not
committed): **zero `WARNING`-level results** across all 10 policies in `policies/` and every
policy under `examples/`. Exactly one `INFO`-level "needs review" result remains
(`hubspot-deal-update`, between `reject-stage-transition-not-allowed` and
`reject-amount-exceeds-threshold-without-preauth`) — confirmed to be a genuine, deliberate
first-match-wins priority ordering between two independent violation reasons that really can
co-occur, not a bug. `packages/policy/tests/unit/PolicyValidator.test.ts` (11 new cases:
single-rule no-op, trailing catch-all not flagged, non-trailing `always` flagged as `WARNING`,
different facts not flagged, exact-threshold disjoint ranges not flagged, asymmetric-threshold
disjoint ranges not flagged, same-direction overlapping ranges flagged `WARNING`, nested `all`
vs leaf resolved via a disjoint conjunct, nested `all` vs `all` resolved via a cross-pair
disjoint conjunct, independent facts correctly reported `INFO` rather than guessed, and
confirmed `validate()` never throws on a detected conflict). Full workspace `npx tsc -b`
clean. Full repo suite: 1573 passed, 38 skipped, 0 failed. `npm run examples`: 98/98, exit 0.

**Not addressed by this fix, left open:** this is not a general rule-subsumption or
boolean-satisfiability solver — it reasons soundly about single-fact leaves, `always`
placement, and `all` conjunctions where at least one conjunct is comparable, and honestly
reports `NEEDS_REVIEW` for everything else (any `any` condition, an `all` vs `all` pair with
no disjoint conjunct across them, or an operator pairing it doesn't model — `between`, `in`,
`not_in`, `contains*`, `matches`, `exists`, `is_null`, `length_*`, `type_is`). A genuinely
overlapping pair using only those operators would go unflagged, not misreported — but also not
caught.

**G-42. `ExecutionAuditSink` was in-memory only (`MemoryExecutionAuditSink`) in production,
not only in tests — the same class of gap G-13 closed for `NonceStore`/`CallerAuditSink`,
left open for the Execution Gateway's own `session.created`/`execution.completed`/
`execution.rejected` events. Found by an independent audit (`GAPS.md`, GAP-1, 2026-09-14).
RESOLVED same session.** New `SupabaseExecutionAuditSink`
(`packages/storage/src/supabase/SupabaseExecutionAuditSink.ts`), same discipline as
`SupabaseCallerAuditSink` (§2.16, `docs/CLAIMS.md`): signed at write time (`AuditEventCrypto`),
chained per `authorizationId` via a Postgres advisory-transaction lock, written through
`PostgresPoolFactory` (not supabase-js/PostgREST). Wired via
`packages/api/src/bootstrap/createExecutionAuditSink.ts`, mirroring
`createCallerAuditSink.ts`'s own production/test split exactly:
`NODE_ENV=test` still gets `MemoryExecutionAuditSink`; every other environment fails closed
at startup if `DATABASE_URL` is unset. New migration
`supabase/migrations/20260914120000_add_execution_audit_events.sql` (table, indexes on
`occurred_at`/`authorization_id`/`connector_id`, RLS enabled with zero policies — readable
only by the app's own privileged connection, same posture as `caller_audit_events`).

Also adds a capability `CallerAuditSink` never had: `query(filter)`
(`ExecutionAuditQueryFilter` — by `authorizationId`, `businessTransactionId`, `connectorId`,
`type`, or date range), because this gap's own motivating question — "can a regulator ask
'show me everything that happened for this authorization/refund'" — needs a read path, not
only a durable write path. `CallerAuditSink`'s own durability fix (G-13) never added one; this
one does, from the start.

Verified: `packages/storage/tests/unit/supabase-execution-audit-sink.test.ts` (12 cases —
mapping every field including `null`-ing absent optionals, chaining and independent-chain
isolation, tamper detection via `AuditEventCrypto.verify()` on a hand-modified field,
`query()`'s five filter dimensions); `packages/api/tests/unit/bootstrap/
create-execution-audit-sink.test.ts` (4 cases, the same fail-closed assertions
`create-caller-audit-sink.test.ts` already makes for its own sink); `packages/api/tests/
integration/supabase-execution-audit-sink.integration.test.ts` (live-DB, `ALLOW_LIVE_SUPABASE=1`
gated, proving a fresh pool/process reads back what a different instance wrote, and that
`query({ authorizationId })` retrieves one authorization's complete, correctly-ordered chain —
the literal "Execute -> Query audit -> Retrieve complete chain" the originating audit asked
for). Full monorepo suite from repository root: 592 passed, 42 gated skips, 0 failed.

**G-43. `parmana-paytm-agent` (a separate repository this codebase forwards Paytm refund
requests to, `PAYTM_CONNECTOR_URL`) recorded nothing at all for either a successful or
rejected refund on its side of the trust boundary — not even a console log — despite
already correctly verifying the Ed25519 authorization signature (ADR-0009 Phase 2B,
`docs/CLAIMS.md` §3.22) before ever calling Paytm. A rejection there (invalid signature,
expired authorization, tampered amount, Paytm decline) left literally no trace anywhere.
Found by the same independent audit as G-42 (`GAPS.md`, GAP-3). RESOLVED same session,
directly in that repository, with the user's explicit authorization — `docs/CLAIMS.md`
§3.22 previously, and accurately at the time, described that repository as out of this
codebase's scope to build or verify; see that section's own 2026-09-14 correction.**

New `src/parmana/audit.ts` in `parmana-paytm-agent` — that repository's first-ever runtime
dependency (`pg`), since it was previously, deliberately, dependency-free. Records
`authorization.verified` immediately after `verifyPaytmAuthorizationSignature` succeeds
(never on failure — a rejected signature is recorded as `execution.rejected` with the
verification error as `reason`, and `authorization.verified` is skipped, so the two event
types alone tell you which branch a rejection took), then `execution.completed` or
`execution.rejected` after the Paytm call resolves. Two rows, not one, so a crash between
verification and execution — the exact failure mode an audit trail exists to catch — remains
visible instead of silently unrecorded by a single combined write.

Writes into the _same_ `execution_audit_events` table G-42 introduced, not a second table:
a new migration (`supabase/migrations/20260914130000_add_business_transaction_correlation_to_
execution_audit_events.sql`) added a nullable `business_transaction_id` column — the
correlation key this repository's own `ExecutionControlService` now also stamps on every
event it writes — because `authorizationId`, this table's original chaining key, is Parmana's
own internal authorization identity and is never forwarded across the wire to
`parmana-paytm-agent` (see `GatewayPaytmAdapter`'s wire contract, `docs/CLAIMS.md` §3.22):
that service only ever sees `businessTransactionId`, `orderId`, `txnId`, and its own re-signed
authorization envelope. `query({ businessTransactionId })` retrieves one refund's complete
story across both services; `query({ authorizationId })` retrieves only this repository's own
signed, chained half. A second new migration
(`20260914140000_add_authorization_verified_to_execution_audit_events.sql`) widened the
table's `type` CHECK constraint to allow `authorization.verified`, the one event type only
`parmana-paytm-agent` ever writes.

Deliberately unsigned and unchained: `parmana-paytm-agent`'s rows carry `NULL`
`signature_json`/`chain_hash`/`chain_position` (both columns relaxed to nullable in the same
migration that added `business_transaction_id`) — that service holds Parmana's public key
only, to verify, never a private key to sign with, and has no Ed25519 keypair of its own.
Judged an acceptable, deliberate trust-boundary asymmetry rather than a residual gap: a
compromised instance of that service could already forge real Paytm calls using the
merchant credentials it legitimately holds, so cryptographic non-repudiation of its own log
entries would not raise the actual trust bar — durability and cross-service correlation are
what this fix adds, not proof of authorship.

Verified: `parmana-paytm-agent`'s own `tests/unit/execute-authorized-connector-request.test.ts`,
3 new cases — the success path (`authorization.verified` then `execution.completed`, in
order, with `businessTransactionId`/`action` on the recorded event), the signature-verification-
failure path (only `execution.rejected` fires, with the verification error as `reason`;
`authorization.verified` never fires), and the Paytm-decline path (`authorization.verified`
then `execution.rejected`, with Paytm's `resultStatus`/`resultCode` folded into `reason`). The
audit writer is dependency-injected into `executeAuthorizedConnectorRequest` (a third,
optional parameter defaulting to the real writer, mirroring how the Paytm connector itself was
already injected) specifically so these unit tests never open a real Postgres connection.
Full suite there: 40 passed, 0 failed, after adding `DATABASE_URL` to the test file's
existing `REQUIRED_ENV` fixture (loadConfig() now fails closed on it at module load, matching
every other required setting that file already sets before importing the module under test).

**G-13. `MemoryNonceStore` and `InMemoryCallerAuditSink` both lose all state on process
restart. RESOLVED in the durable-replay-protection hardening session that followed the
2026-07-17 audit closeout and its own G-3 fix.** Both now have durable, Supabase-backed
replacements, wired in as the production default:

- `packages/storage/src/supabase/SupabaseNonceStore.ts`: implements `NonceStore`
  (`@parmana/envelope-verifier`) with the exact same interface and call-site semantics as
  `MemoryNonceStore`: a nonce is still consumed as the last step of verification, strictly
  before execution (`packages/execution-gateway/src/ExecutionGateway.ts`, unchanged by this
  session; only the storage backing changed). Backed by a new `consumed_nonces` table
  (`supabase/migrations/20260718090000_add_nonce_and_caller_audit_tables.sql`) whose
  `PRIMARY KEY` on `nonce` is the entire atomicity mechanism: two concurrent `INSERT`s of
  the same nonce race at the database, not in application code; exactly one succeeds, the
  other fails with a `23505` unique_violation, mapped to "already consumed" by a new
  `isUniqueViolation` helper (`packages/storage/src/errors/PostgresErrorCodes.ts`; no such
  Postgres-error-code mapping existed anywhere in this codebase before this session; see
  D-1 below, which needs the same kind of mapping for G-1, still open and unrelated).
- `packages/api/src/auth/SupabaseCallerAuditSink.ts`: implements `CallerAuditSink`
  unchanged, backed by a new `caller_audit_events` table in the same migration.

Production wiring (`packages/api/src/bootstrap/createNonceStore.ts`,
`createCallerAuditSink.ts`) fails closed: test wiring (`NODE_ENV=test`) still gets
`MemoryNonceStore`/`InMemoryCallerAuditSink`, mirroring the production/test split
`createCredentialProvider.ts` already established for the vendor-payment connector
credential, but outside test wiring, an unconfigured Supabase backing throws a named,
actionable error at startup (`assertSupabaseConfigured`) rather than silently falling back
to an in-memory store. `SupabaseNonceStore.checkAndRecord` also fails closed on any error
other than a unique-violation: the error propagates rather than being swallowed, so a
request whose nonce check hit an unreachable database is rejected, never silently treated
as accepted.

Verified: 22 unit tests against mocked storage (atomic-consumption mapping, the fail-closed
storage-error path, and the fail-closed production-wiring checks):
`packages/storage/tests/unit/supabase-nonce-store.test.ts`,
`packages/storage/tests/unit/postgres-error-codes.test.ts`,
`packages/api/tests/unit/supabase-caller-audit-sink.test.ts`,
`packages/api/tests/unit/bootstrap/create-nonce-store.test.ts`,
`packages/api/tests/unit/bootstrap/create-caller-audit-sink.test.ts`, plus 5 Supabase-gated
integration tests against a real project, routed through the same `resolveSupabaseGate` the
G-3 fix established (skip cleanly with no credentials, hard-fail without
`ALLOW_LIVE_SUPABASE=1`): `packages/storage/tests/integration/
supabase-nonce-store.integration.test.ts` (atomic consumption, a real concurrent-`INSERT`
race with exactly one winner, and, the test that actually proves this gap closed, a nonce
consumed through one store instance is still consumed by a second, independently
constructed instance against the same backing, which `MemoryNonceStore` cannot pass at all)
and `packages/api/tests/integration/supabase-caller-audit-sink.integration.test.ts` (a
written event is read back through a second, independent client).

**Residual, explicitly not addressed by this session:**

- **Unbounded growth.** `consumed_nonces` is append-only by design (no application code
  updates or deletes a row), and nothing purges expired rows yet. The table carries
  `expires_at` for exactly this purpose; a future session should add a retention job (e.g. a
  scheduled delete of rows well past their `expires_at`), sized past the maximum TTL rather
  than tied to it. `caller_audit_events` has the same open shape and the same unmade
  retention decision.
- **`CallerAuditSink.record()`'s failure semantics are unchanged, not hardened.**
  `middleware/caller-auth.ts` still `await`s `record()` with no `try`/`catch`, exactly as
  before this session (re-confirmed by re-reading the call site). This session was
  instructed to preserve that behavior, change only durability, and does. Whether a failed
  audit write should be allowed to fail the caller-auth request path at all remains an open
  design question, not decided here. _(Update from a later session: this question has since
  been decided and implemented: fail-closed. See "Decision record: audit-sink fail-closed"
  immediately below.)_

**G-14. The test that proves G-13 closed could silently not run at all, with a green
summary line. RESOLVED in the session that followed G-13.** `resolveSupabaseGate`
(`packages/api/tests/helpers/supabase-availability.ts`,
`packages/storage/tests/helpers/supabase-availability.ts`) decides whether a Supabase-gated
suite runs by reading `process.env.SUPABASE_URL` at module-collection time. That variable
only reached a given test file's `process.env` if something in _that file's own import
graph_ happened to transitively import `packages/shared/src/config/Config.ts`, whose
module-scope `dotenv.config()` call was, until this session, the only place `.env` ever got
loaded. Vitest runs each test file's collection in a worker thread, and worker threads each
get an independent snapshot of `process.env`, so whether a file "saw" `SUPABASE_URL` came
down to which worker it landed in and which sibling files shared that worker, not a real gate
decision. `packages/storage/tests/integration/supabase-nonce-store.integration.test.ts`
(no import path to `Config.ts`; it only imports `SupabaseClientFactory` and
`SupabaseNonceStore`, both dependency-free of `@parmana/shared`'s config module) lost that
coin flip in every run observed across two separate sessions, including the one that first
wrote G-13's "RESOLVED, verified" claim above: the restart-simulation test that is the
_specific_ proof `MemoryNonceStore` could not pass ("a nonce consumed through one store
instance is still consumed by a fresh instance against the same backing") was silently
`describe.skipIf`-skipped, not run, every time, with nothing in the `npm test` summary
distinguishing it from a clean pass.

Fix, three parts:

1. **Deterministic env loading.** `vitest.setup.ts` (already registered as the sole
   `setupFiles` entry in `vitest.config.ts`, so every worker always runs it first) now calls
   `dotenv.config({ path: <repo-root>/.env, override: false })` directly, before any test
   file's own imports execute. Every worker now gets an identical, complete env snapshot
   regardless of which test files happen to share it. `Config.ts`'s own `dotenv.config()` call
   is untouched: `override: false` on both sides means neither load can clobber the other or
   an already-set shell variable; it is now simply a no-op the first time a file imports it.
2. **Ambient-env coupling in unit tests: investigated, none found requiring a code change.**
   The working hypothesis going into this fix was that several unit tests (`verification-api`,
   `execute-api`, `receipt-get-api`, `transactions-api`, and peers) implicitly depend on
   `SUPABASE_*` being _absent_ to stay on their in-memory storage path, and would need
   `vi.stubEnv`/explicit deletion in `beforeEach`/`afterEach` to stay green once env loading
   became deterministic. Reproducing this directly (full suite runs with `SUPABASE_URL` and
   a key present under the corrected deterministic loading, both with `ALLOW_LIVE_SUPABASE`
   unset (fail-closed gate throws for the 13 gated suites, everything else green) and set (all
   13 gated suites plus every unit test green)) found no such coupling. Reading
   `packages/api/src/bootstrap/createNonceStore.ts` and `createCallerAuditSink.ts` confirms
   why: both branch on `NODE_ENV === "test"` first, unconditionally returning the in-memory
   implementation in test wiring regardless of `SUPABASE_URL`'s presence; the coupling the
   hypothesis assumed does not exist in the production bootstrap code. (A prior, separate
   session had reproduced 13 unit-test failures resembling this hypothesis, but by shelling
   out `set -a; . ./.env; set +a` before `npm test` rather than letting `dotenv` load it;
   that method's real effect was exporting `ALLOW_LIVE_SUPABASE=1`, which happened to still
   be present in `.env` at that point in that session, globally as well, driving every gated
   suite live and concurrent alongside the unit tests, not "`SUPABASE_URL` merely present."
   That confound does not reproduce under `dotenv`-based loading; see verification below.)
3. **Closed the fail-open hole in the gate itself.** `resolveSupabaseGate` previously had only
   three branches: opt-in + configured → run; configured without opt-in → throw; unconfigured
   → skip cleanly. A fourth case was unhandled: opt-in **set** but `SUPABASE_URL`/a key **not
   visible**, which fell through to the "unconfigured" branch and skipped cleanly: exactly
   the silent-skip failure mode this gap describes, just with an explicit opt-in present.
   Both helper copies now throw a dedicated error naming this exact condition ("a live run was
   explicitly requested... but Supabase env is not visible to this worker; env loading is
   broken") instead of degrading to a skip. Explicit intent must never quietly become a green
   skip.

Verified: unit coverage for all four `resolveSupabaseGate` branches in both packages
(`packages/api/tests/unit/supabase-availability.test.ts`,
`packages/storage/tests/unit/supabase-availability.test.ts`, 5 and 4 tests respectively; the
new case in each is "(case d, G-14) throws naming broken env loading when
ALLOW_LIVE_SUPABASE=1 is set but SUPABASE_* is not visible"). With `ALLOW_LIVE_SUPABASE=1`
temporarily appended to this checkout's live-credential `.env`, `npm test` was run three
consecutive times specifically because the original bug was scheduling-dependent and one
green run proves nothing: all three reported an identical `107 passed | 1 skipped (108)`
test files and `478 passed | 1 skipped (479)` tests, zero failures, with the
restart-simulation test confirmed executing and passing (not skipped) via a verbose-reporter
run interleaved between them. (The one remaining skip in every run is the pre-existing,
unrelated `describe.skip` in `execution-failure.integration.test.ts`, not Supabase-gated.)
Before this fix, the same live-opt-in configuration produced `475 passed | 4 skipped (479)`,
the nonce-store suite's 3 tests silently missing, non-deterministically, from run to run.
`ALLOW_LIVE_SUPABASE=1` was removed from `.env` again immediately after verification; `npm
run lint` and `npm run build` both pass clean on the resulting tree.

**Residual, not addressed by this fix:** the two `resolveSupabaseGate` copies remain
independent, hand-maintained duplicates (by design, per each file's own comment; see G-3);
a future divergence between them would not be caught by anything short of manually diffing
the two files or the shared unit-test coverage happening to be kept in lockstep, as it was
this session.

**G-15. A default `npm test` on a machine with live Supabase credentials configured either
threw (pre-G-14 fix) or, independently, could crash test collection outright with a generic
supabase-js error. RESOLVED in the session that followed G-14, in two parts.**

_Part 1: `resolveSupabaseGate` branch 2 semantics changed, deliberately, from G-3's
original design._ The "configured, no opt-in" branch used to throw (G-3's own fix, made
consistent by G-14). It now skips cleanly instead, logging one line naming why
(`"<suiteLabel>: Supabase credentials configured but ALLOW_LIVE_SUPABASE=1 not set —
skipping live suite. Set ALLOW_LIVE_SUPABASE=1 to run it."`). **Trade-off, accepted
deliberately:** the previous throw existed specifically so a contributor with live
credentials in `.env` could not accidentally run live suites without realizing it. Turning
that into a skip means a default `npm test` on such a machine (the common daily-development
case) now stays green and side-effect-free without anyone touching `.env`, at the cost of
reintroducing exactly the silent-by-default posture G-3 was written to close. The other
three branches are unchanged: opted-in + configured still runs live; unconfigured still
skips cleanly; opted-in + **not** visible still throws (G-14's fix stays a hard failure;
explicit intent must never quietly degrade). Both helper copies
(`packages/api/tests/helpers/supabase-availability.ts`,
`packages/storage/tests/helpers/supabase-availability.ts`) and both packages' 4-branch unit
tests were updated in lockstep.

_Part 2: the storage bootstrap crashed test collection independent of the gate._
`StorageFactory.createFromEnvironment()` (`packages/storage/src/StorageFactory.ts`) built
whatever `PARMANA_STORAGE` named (including a live `SupabaseClient` via
`SupabaseClientFactory.create()`), with no test-mode awareness at all, unlike
`createNonceStore.ts`/`createCallerAuditSink.ts`'s NODE_ENV-gated split (G-13). Worse,
`packages/api/src/repositories.ts` called it as a **module-scope side effect**, so merely
_importing_ `repositories.ts` (which every `packages/api` test file does transitively via
`../src/application.js`) constructed live storage, crashing the entire suite with
supabase-js's generic `"supabaseUrl is required."` the moment `SUPABASE_URL` was absent
while `PARMANA_STORAGE=supabase` was still set (as it is in this checkout's `.env`),
confirmed directly: 22 files failed this way when `.env`'s Supabase lines were commented out
without also changing `PARMANA_STORAGE`. Fixed two ways:

- `createFromEnvironment()` now returns `MemoryStorageProvider` unconditionally when
  `NODE_ENV === "test"`, **regardless of `PARMANA_STORAGE`**, mirroring
  `createNonceStore`/`createCallerAuditSink` exactly. Outside test mode, behavior is
  unchanged except that `PARMANA_STORAGE=supabase` with no visible credentials now throws a
  Parmana-worded error naming both knobs (`PARMANA_STORAGE=supabase requires SUPABASE_URL
and a Supabase key...`) before `SupabaseClientFactory.create()` would otherwise fail with
  its generic message.
- `repositories.ts` no longer constructs storage at module scope. The exported
  `businessTransactionRepository`/`executionTrustRecordRepository` bindings are now Proxies
  that defer the real `StorageFactory.createFromEnvironment()` call to first property
  access. The interface at every call site (`application.ts`, both integration tests that
  import these directly) is unchanged; only the timing of construction moved.

**Trade-off, accepted deliberately (same shape as Part 1's):** because the in-memory
override is unconditional under `NODE_ENV=test`, tests that set `PARMANA_STORAGE=supabase`
in their own `beforeAll` specifically to exercise real persistence through the shared
`packages/api/tests/test-app.ts` app singleton can no longer reach a live backend through
that singleton, full stop. `ALLOW_LIVE_SUPABASE=1` does not change this, since it is a
`resolveSupabaseGate` concern, not a `StorageFactory` one. Two concrete casualties,
confirmed directly:

- `packages/api/tests/unit/transactions-api.test.ts`'s three `it.skipIf(!supabaseConfigured)`
  persistence-shape cases still pass under a live opt-in run, but now silently exercise the
  in-memory path rather than real Supabase persistence; their gating on live credentials is,
  after this fix, no longer meaningful. Not changed this session; flagged here since nothing
  in the test output signals the silent downgrade.
- `packages/api/tests/integration/workflow-supabase.integration.test.ts`'s "round-trips an
  override through the Supabase repository and still verifies" case failed outright (not
  silently) under a live opt-in run, because it writes an override through its own
  directly-constructed `SupabaseStorageProvider` and then verified by calling
  `request(app).post("/verify")`, and `app`'s repositories, unlike the directly-constructed
  one, are now always in-memory under test, so the record it just wrote to real Supabase was
  never visible to that HTTP call → 404. Fixed in this session by verifying against the same
  directly-constructed `storage.trustRecords` instead, via a directly-instantiated
  `VerificationService` (`@parmana/runtime`), the exact class the real `/verify` route
  delegates to (`ExecutionTrustApplication.verify`), so this still exercises real production
  verification logic against the real repository; it no longer additionally proves the HTTP
  endpoint wires to it, which the file's first test ("executes a Business Transaction",
  unaffected, still routes end-to-end through `app`) already covers.

Verified:

- Unit: `packages/storage/tests/unit/storage-factory.test.ts` (5 tests: NODE_ENV=test forces
  in-memory regardless of `PARMANA_STORAGE`, with and without credentials present; the named
  misconfiguration error outside test mode; unaffected `supabase`/`memory` behavior outside
  test mode) and `packages/api/tests/unit/repositories.test.ts` (2 tests, using
  `vi.doMock`/`vi.resetModules`: importing the module performs zero calls to
  `StorageFactory.createFromEnvironment`; the first repository property access constructs
  exactly once, memoized across both exported repositories).
- (a) `npm test` with this checkout's live-credential `.env` as-is, no opt-in: 0 failed
  files, all 13 previously-gate-throwing suites now skip cleanly logging the new branch-2
  message (confirmed by grep: 13 occurrences, 0 remaining `"Refusing to run"` throws), plus
  the 1 pre-existing unrelated `execution-failure.integration.test.ts` skip, everything else
  green (`97 passed | 13 skipped (110)` files, `455 passed | 33 skipped (488)` tests).
- (b) `ALLOW_LIVE_SUPABASE=1` set for a single process invocation only (never written to
  `.env`), run twice consecutively: both runs identical, `109 passed | 1 skipped (110)`
  files, `487 passed | 1 skipped (488)` tests, 0 failures, restart-simulation test confirmed
  passing (not skipped) via an interleaved verbose run.
- (c) A single invocation with `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`
  set to empty strings for the process only (unsetting them outright doesn't work: `.env`'s
  real values would just backfill via `dotenv`'s `override:false`; an explicit empty string
  is what `override:false` actually respects), simulating a fresh clone without editing
  `.env`: all 13 gated suites skip via the unconfigured branch (verified via grep: their
  `[SKIP] ... not set` messages, not the branch-2 message), 0 failed files, nothing crashes
  at collection despite `.env`'s `PARMANA_STORAGE=supabase` still being set underneath;
  this is the direct proof Part 2 closes the collection-crash bug.
- `npm run lint` and `npm run build` both clean throughout.

**G-19. `POST /execute` returns HTTP 500 for an expected policy rejection, and neither the
rejection nor the approval response surfaces the policy's plain-language `reason`.** Found
2026-07-21 while building a parmanasystems.com live-proof widget route
(`packages/api/src/routes/public-demo.ts`, since removed 2026-07-21 along with the widget
it backed; see the frontend's own history for why) that worked around both issues by
calling `PolicyEngine.evaluate()` directly rather than relying on `/execute`'s response.
That workaround route is gone; this gap is not: it is a property of `/execute` and the
shared `runtime`/`shared` packages, entirely independent of the now-deleted route, and was
never fixed. Two distinct issues on the real, existing `/execute` route:

1. **Status code.** `ExecutionGate.enforce()` (`packages/runtime/src/ExecutionGate.ts:31-44`)
   throws a bare `RuntimeError` for a rejected `Decision`, which defaults to `status: 500`
   (`packages/runtime/src/errors/RuntimeError.ts:6-20`); every policy rejection currently
   reaches the caller looking identical to a server crash, even though
   `DecisionOutcome.REJECTED` is an ordinary, expected outcome of policy evaluation, not a
   fault.
2. **Missing reason field.** `Decision.reason` (`packages/shared/src/domain/decision.ts:52`)
   already carries the exact plain-language string from the matched policy rule
   (`policies/<name>/<version>/policy.json`'s `outcome.reason`) all the way through
   `DecisionBuilder.build()` (`packages/runtime/src/DecisionBuilder.ts:57-67`), and
   `ExecutionGate.enforce` does interpolate it into its thrown message
   (`packages/runtime/src/ExecutionGate.ts:38-42`), but `ExecutionTrustRecord`
   (`packages/shared/src/domain/execution-trust-record.ts`) has no `decision` field at all,
   so on the APPROVED path the reason is dropped entirely, and on the REJECTED path a caller
   only gets it as an unstructured substring of `error` inside the generic `RuntimeError`
   message (`"Execution rejected: <reason>"`), never a dedicated field.

Neither issue touches this codebase's core CLAIMS.md claims: fail-closed still holds,
nothing here weakens the signature or verification chain. But any real API consumer today
has no clean way to distinguish "policy said no" from "the server broke," and no structured
access to why. **Not fixed this pass**, flagged only, per explicit instruction to keep the
live-proof-widget work scoped and avoid touching the shared runtime/API packages.

---

### Decision record: audit-sink fail-closed

**Decided and implemented** in the audit-sink/G-1 hardening session that followed G-13
(directly resolves the open question G-13 left above): if a `CallerAuditSink.record()` write
fails, the request now fails closed. An action that executes without an audit record
contradicts Parmana's core claim of independently verifiable execution, so the availability
cost of rejecting the request is accepted, consistent with the `NonceStore`'s own
fail-closed wiring (G-13). This was a deliberate design decision, not a bug fix; it is
recorded here so the decision itself is discoverable in the gap tracker, not only in session
history.

Implementation: `packages/api/src/middleware/caller-auth.ts`'s `recordOrFailClosed` helper
wraps both `auditSink.record()` call sites (the `caller.rejected` path and the
`caller.authenticated` path). On failure, it logs a structured entry
(`{ event: "caller_audit_write_failed", route, error }`, distinguishable from other
failures) and passes a new `AuditUnavailableError`
(`packages/api/src/auth/AuditUnavailableError.ts`, extends `RuntimeError`: 503,
`AUDIT_UNAVAILABLE`) to `next()`, which `error-handler.ts`'s existing generic
`instanceof RuntimeError` branch maps with no changes to that file. The success path is
byte-for-byte unchanged. Deliberately no retry, buffering, or queueing: that would convert
fail-closed into eventually-audited, a materially different (and rejected) design; see
"Decisions left for the owner" in this session's closing report if a retry layer is ever
reconsidered.

Verified: 6 unit tests directly against the middleware
(`packages/api/tests/unit/middleware/caller-auth.test.ts`): both success paths unchanged
(valid credential reaches `next()` with no error, missing credential still gets its 401),
both failure paths reject with `AuditUnavailableError` (status 503, code
`AUDIT_UNAVAILABLE`) rather than a 401 or a silent pass-through, the structured log entry's
exact shape, and that the sink is called exactly once (no retry). Plus the pre-existing
`packages/api/tests/unit/supabase-caller-audit-sink.test.ts` (G-13 session), which already
proves `SupabaseCallerAuditSink` propagates storage errors rather than swallowing them,
required for this guard to be reachable at all in production wiring.

**G-29. Structural/admission-time rejections — malformed input, missing required fields,
and duplicate `businessTransactionId` — produce no audit record of any kind. RESOLVED
same-day (2026-08-24).** Found during a 2026-08-24 review of this repository's five
architectural trust-record gaps
(scoped alongside RFC-0021 Refusal Records, RFC-0022 signal-state verification, caller-to-
capability scoping, and the principal-denied audit trail — G-29 is the one of the five
that was genuinely still open). Two signed, durable audit mechanisms exist in this
codebase today: `RefusalRecord` (RFC-0021, `docs/CLAIMS.md` §3.11) for a policy `REJECT`,
and `CallerAuditSink` (`docs/CLAIMS.md` §2.16/§2.19/new §3.19) for a caller-identity
denial. Both fire only _after_ a request has already passed structural validation and
reached `RuntimeEngine`/policy evaluation. A request that fails before that point is
invisible to both:

- **Duplicate `businessTransactionId`.** `BusinessTransactionService.accept()`
  (`packages/runtime/src/services/business-transaction-service.ts:36-44`) throws
  `DuplicateBusinessTransactionError`, mapped to `409` by
  `packages/api/src/middleware/error-handler.ts:106-114` (2.20's own atomicity guarantee).
  No `.record()` call, no `CallerAuditSink`, no `RefusalRecordRepository` write happens
  anywhere between the `throw` and the `409` response.
- **Field-level validation.** `BusinessTransactionValidator.validate()`
  (`packages/runtime/src/validators/BusinessTransactionValidator.ts:5-63`) throws
  `BusinessTransactionValidationError` for the trust-chain-consistency and
  required-field checks it performs (cross-field mismatches; missing `policy.name`,
  `policy.version`, `intent.action`), mapped to `400`
  (`error-handler.ts:80-90`). Same absence of any write.
- **Malformed / oversized request body.** Caught generically by `error-handler.ts:29-49`
  (`entity.parse.failed` → `400`, `entity.too.large` → `413`), before any route handler —
  and therefore before any audit sink — is ever reached.
- **`businessTransactionId` format check.** The UUID-shape regex in `execute.ts:20-29` /
  `transactions.ts:24-33` runs first of all, directly in the route handler, before the
  request body is even mapped into a `BusinessTransaction`; a `400` is returned
  (`execute.ts:57-62`) with no audit call.

No pre-`RuntimeEngine` audit layer exists to catch any of these: a repo-wide grep for a
generic structural/admission-time audit pattern returns zero hits, and
`packages/api/tests/unit/concurrent-duplicate-id-investigation.test.ts` — an existing test
that empirically proves the _correctness_ of the 409-under-concurrency behavior 2.20/G-1
already established — asserts only on HTTP status codes and stored transaction content,
because there is no audit trail to assert on.

**Severity: pre-production, not blocks-pilot.** Unlike G-24, this is not an authorization
bypass — every one of these paths correctly rejects the request with the right HTTP
status, before any policy evaluation or execution occurs. What is missing is purely
forensic: an operator investigating a wave of malformed requests, ID-collision attempts,
or probing traffic against `/execute`/`/transactions` has no durable, queryable record of
them today, only whatever a caller's own logs or a reverse proxy's access log happened to
capture.

**RESOLVED, same-day (2026-08-24).** Closed exactly the way this entry's own original
"not yet fixed" note anticipated: a new `caller.structural_rejected` `CallerAuditEvent`
variant (`packages/api/src/auth/CallerAuditSink.ts`), reusing `CallerAuditSink` at all
four points, split into two disciplines matching where each rejection actually happens in
the pipeline (full detail and evidence in `docs/CLAIMS.md` §3.20, the promoted claim this
resolution backs):

- The UUID-format check and the two `application.execute()` errors
  (`BusinessTransactionValidationError`, `DuplicateBusinessTransactionError`) all run
  inside a route handler mounted _after_ caller-auth middleware, so a caller identity is
  already known there (when caller-auth is enabled) — these reuse
  `recordCallerAuditEvent`'s existing **fail-closed** discipline (2.19) exactly, the same
  one `caller.capability_denied`/`caller.principal_denied` already use.
- Malformed/oversized body is rejected by `express.json()` itself, _before_ caller-auth
  middleware — or any route handler — ever runs; there is no caller identity to protect
  the accountability of at that point. This one path is deliberately **fail-open**
  instead, mirroring `RefusalRecord`'s own reasoning (§3.11's first scope caveat) rather
  than 2.19's — the request is already correctly rejected either way, and a storage hiccup
  should not turn a correct `400`/`413` into an opaque `500` for a case with no caller
  identity to protect in the first place. `createErrorHandler(auditSink?)` (replacing the
  former plain `errorHandler` export) threads the sink into `error-handler.ts` for this
  one branch only.

**Verified:** `packages/api/tests/integration/structural-validation-audit.integration.test.ts`
(new, 9 tests, real HTTP requests against the production `createApp` composition): all
four rejection points audited with the correct `reason`/`businessTransactionId`/`callerId`
shape (absent fields verified absent, not merely unchecked); the valid path records
nothing; caller-auth disabled still returns the correct status with no audit sink to write
to. `packages/api/tests/unit/supabase-caller-audit-sink.test.ts` extended (2 new cases) for
the new `business_transaction_id` column. Full repo `npx tsc -b`, `npx eslint . --ext .ts`,
and `npm test` all clean: 1243 passed (was 1234 before this session), 37 pre-existing
skips (unchanged), 0 failed — the pre-existing 8 failing tests observed at the start of
this session (`PARMANA_POLICY_DIR` in this checkout's local `.env` pointing at a
non-existent directory, an environment misconfiguration unrelated to this fix) were also
corrected as a prerequisite to getting a clean baseline, not silently left failing.

**G-31. Runtime signals were verified once, before authorization, but never re-checked at
the execution boundary. CLOSED same session it was designed (2026-09-05).**
`SignedExecutionAuthorization` (`packages/shared/src/domain/execution-authorization.ts`)
already carried a `policyContentHash`, and `ExecutionGateway.verify()`
(`packages/execution-gateway/src/ExecutionGateway.ts`) already recomputed the _current_
policy content hash at the execution boundary and rejected execution if the policy that
produced the decision had since changed (`policyStillCurrent`, Gap 1B). Nothing analogous
existed for the runtime _signals_ a decision actually rested on (vendor KYC status, risk
exposure, market conditions — whatever a policy's `boundSignals`/`SignalStateVerifier`
cares about): `SignalIntentBinder` and the optional `SignalStateVerifier` port
(`@parmana/policy`) both run once, inside `RuntimeEngine.execute()`, strictly before
`RuntimeAuthorizationSigner.sign()` — and `SignedExecutionAuthorization` is explicitly
documented as a portable artifact ("Enterprise systems should execute only requests
carrying a valid, verified SignedExecutionAuthorization"), independently verifiable by a
receiving system up to `authorizationTtlSeconds`/`maxTtlSeconds` later. Nothing prevented
an authorization whose declared vendor status, risk exposure, etc. had since drifted from
still executing, as long as its signature, expiry, TTL, content hash, and policy content
all still checked out.

**Found and closed proactively, not from an incident.** An external prompt (addressed
directly in the session transcript, not reproduced here) asked for a large parallel
"condition-bound execution proof" system — a new `ProofSigner`/`ProofVerifier`,
`ExecutionAuthorityProof` type, Razorpay connector, and voice-AI gateway — built against
files and classes (`packages/api/src/policy/PolicyEngine.ts`, `RazorpayConnector.ts`, a
`PolicyEngine.authorize()` returning a bare boolean) that do not exist in this codebase.
Investigation instead found this repo already had the mature, disciplined version of the
same idea (`policyStillCurrent` above) with exactly one real, precisely-scoped hole: signal
freshness. Razorpay was deliberately removed from this codebase previously (commits
`b228772`, `cca3231`, `e5e0b1c`) and was not reintroduced; the closure below is generic and
demonstrated against the one live connector, HubSpot.

**Closed by adding a `signalsStillCurrent` check to `ExecutionGateway`, the direct sibling
of `policyStillCurrent`.** `ExecutionAuthorizationPayload` gained an optional
`signalsHash` (canonical hash of the `PolicySignals` `RuntimeEngine.execute()` evaluated,
computed by the same `TrustRecordHasher` idiom as `policyContentHash`, and included in the
signed payload exactly like it). `ExecutionRequest` gained an optional `signals` field, and
`ExecutionRequestBuilder` now forwards `transaction.signals` onto it — both purely
additive. `ExecutionGateway` gained an optional `signalStateVerifier`
(`@parmana/policy`'s existing port, reused not reinvented): when configured and both
`signalsHash`/`request.signals` are present, it recomputes the signals hash
(tamper/mismatch check, `signalsHashMismatch`, mirrors `businessTransactionHash`) and, on a
match, independently re-verifies the declared signals against real-world state via the
same `SignalStateVerifier.findViolations` call `RuntimeEngine` already makes
pre-authorization — surfacing any drift as `signalDivergence` and rejecting execution
exactly like a `policyContentMismatch` does. Every new field/dependency is optional and
additive; no pre-existing call site required changes. In production, the circular
dependency between the Gateway (needs a `SignalStateVerifier` at construction) and
`createHubSpotSignalStateVerifier(executionSystem)` (needs the already-constructed Gateway)
is broken by a small late-binding singleton,
`packages/api/src/bootstrap/executionGatewaySignalStateVerifier.ts` — the Gateway is wired
against it at construction, and `application.ts`'s `createApplication()` binds the real
composite verifier into it once built, mirroring the existing
`mintGatewayAuthentication` late-binding pattern already used in `createExecutionGateway.ts`.

**What this does not close.** The check only runs when a capability has a
`SignalStateVerifier` configured (today, only `hubspot-deal-update`, via
`createHubSpotSignalStateVerifier`) — same scoping caveat `SignalStateVerifier` itself
already documents for pre-authorization verification. It also only has effect when a real
decision-to-execution time gap exists: this codebase's own `RuntimeEngine`/`ExecutionGateway`
wiring runs decision and execution synchronously in one call stack today (`ExecutionGateway`'s
own class doc: "Stateless and deterministic: there is no pause/resume state"), so in the
current default deployment shape the signals a `SignalStateVerifier` would re-check are, in
practice, the same instant already checked moments earlier by `RuntimeEngine`. The real
exposure this closes is a `SignedExecutionAuthorization` handed to a decoupled downstream
receiver (e.g. an `HttpExecutionSystem`-based deployment) that verifies and executes it
independently, potentially much later, up to `maxTtlSeconds` — exactly the scenario the
authorization's own "receiving systems" doc comment describes as supported.

**Claimed:** `docs/CLAIMS.md` §2.29 ("Signal-Freshness Enforcement at Execution Time
(G-31)"), filed alongside the existing §2.27 ("Policy-Freshness Enforcement at Execution
Time") this closure directly parallels.

**Verified:** new `packages/execution-gateway/tests/unit/signal-freshness.test.ts` (8
tests, mirrors `policy-freshness.test.ts`'s structure exactly): signals unchanged and
verifier reports no drift → `true`; verifier reports drift → `false` +
`signalDivergence`, and `execute()` throws naming it; request signals no longer hash-match
the authorization → `false` + `signalsHashMismatch`; no `signalStateVerifier` wired, no
`signalsHash` on the authorization, or no `signals` on the request → skipped
(`undefined`, not failed) in each case; nonce-replay-only failures still correctly
classified when this check was skipped. `packages/crypto/tests/unit/authorization-envelope.test.ts`
extended (3 new cases) for `signalsHash` passthrough/omission/tamper-detection.
`packages/runtime/tests/unit/execution-authorization-wiring.test.ts` extended (1 new case,
through the real `RuntimeBuilder`/`RuntimeEngine`/`ExecutionComponent` wiring, no test
doubles for the crypto or hashing) confirming the produced authorization's `signalsHash`
matches an independently recomputed hash of the transaction's signals, and the
`ExecutionRequest` reaching the execution system carries those same signals. Full repo
`npx tsc -b` (clean) and `npm test`: 1291 passed, 37 skipped, 0 failed — 1279 passed
immediately before this change (execution-gateway 93→101, crypto 68→71, runtime 60→61, api
unchanged at 264 passed/31 skipped), so all 12 new tests pass and nothing regressed.

**Tutorial added:** `examples/tutorials/98-signal-freshness-enforcement`, run directly
(`npx tsx examples/tutorials/98-signal-freshness-enforcement/run.ts`) and added to
`scripts/run-examples.ts`/`examples/README.md`'s authoritative list. Authorizes one real
payment through `RuntimeBuilder`, then plays two independent receiving systems against the
identical authorization and declared signals: one whose live re-check finds nothing
changed (executes normally), one that finds the vendor has since been blocked (rejected,
`signalsStillCurrent: false`, `signalDivergence` naming the mismatch, connector never
invoked) — confirmed by an actual run of the script, not merely read for plausibility.

**G-44. `PolicyEngine.evaluate()`'s structured rule-match trace was computed, then discarded
before anything durable was written. Found by an independent read-only audit
(`docs/investigations/2026-09-15-evidence-anchor-gap-audit.md`, GAP-2, 2026-09-15). RESOLVED
same day.** `packages/policy/src/PolicyEngine.ts:35-55` returns `matchedRuleId`,
`evaluatedRules` (a count), and `matchedPath` (the full ordered rule-id trace) as part of its
`PolicyDecision` — but `DecisionBuilder.build()`
(`packages/runtime/src/DecisionBuilder.ts:32-51`), the very next step, built the `Decision`
that actually gets persisted and signed from only `outcome` and `reason` (a free-text
string); all three structured trace fields were dropped in that one call. Every signed
`ExecutionTrustRecord` and `RefusalRecord` therefore carried prose explaining a decision, not
the structured, independently re-checkable rule citation that already existed one function
call earlier.

**Fix:** `Decision` (`packages/shared/src/domain/decision.ts`) gained three new optional
fields — `matchedRuleId`, `evaluatedRules`, `matchedPath` — same optionality pattern as
`PolicyReference.contentHash` (G-24): caller-unsettable, absent only on a `Decision` built
before this field existed, never a breaking change to anything constructing one without them.
`DecisionBuilder.build()` now copies all three verbatim from `PolicyDecision`. Mirrored into
the hand-authored TypeScript SDK model (`typescript/src/models/execution.ts`), the JSON
schema (`schemas/common/decision.schema.json`, including an updated example), and the
generated Python SDK model (`python/parmana/models/execution.py`, regenerated via `npm run
generate:python-models`, not hand-edited).

**Verified:** `packages/runtime/tests/unit/DecisionBuilder.test.ts` (3 new cases: trace
carried through on APPROVE, trace carried through on REJECT — not only the approved path,
existing fields unchanged). Full workspace `npx tsc -b` clean. Full repo suite: 1809 passed
(3 more than before, exactly the three new cases), 42 skipped, 0 failed. Python suite: 79
passed. Also confirmed live: a real transaction submitted to a locally-running instance
(`test:fixture-execute` against `vendor-payment@2.0.0`, the same real policy and connector
`docs/site/quickstart.mdx` uses) returned a real `ExecutionTrustRecord` whose
`executions[0].decision` carried `matchedRuleId: "approve-payment"`, `evaluatedRules: 1`,
`matchedPath: ["approve-payment"]` — not merely unit-tested in isolation.

**G-45. The policy-governance evidence-anchor chain (G-24 / §2.27 /
`PolicyGovernanceExecutionVerifier`) is real and tested, but a passing check left no
artifact of its own, and none of it references connector-execution evidence.** Found by an
independent audit (`docs/investigations/2026-09-15-evidence-anchor-gap-audit.md`, GAP-4,
2026-09-15) — and the audit's own first pass got this wrong before finding
G-24/§2.27/§2.26 in `docs/CLAIMS.md` and correcting itself; see that document's §4 for the
full account, kept rather than silently rewritten. The positive-pass-artifact half of this
gap was **RESOLVED the same day**; the connector-evidence half remains open.

**Fix (positive-pass artifact):** new `PolicyGovernanceAnchorResolver`
(`packages/api/src/governance/PolicyGovernanceAnchorResolver.ts`) performs the identical three
checks `PolicyGovernanceExecutionVerifier` does — approval record exists, its signature
verifies, its `contentHashAfter` matches the live content — but always returns a status
(`VERIFIED` | `NO_APPROVAL_RECORD` | `SIGNATURE_INVALID` | `CONTENT_MISMATCH`) instead of
throw-shaped pass/fail, and never blocks execution: a resolver error is caught and logged,
never allowed to affect the real authorization outcome (see
`RuntimeEngine.execute()`'s try/catch around the resolve call). Unlike
`PolicyGovernanceExecutionVerifier`, wired **unconditionally**
(`createPolicyGovernanceAnchorResolver.ts`, no `POLICY_EXECUTION_VERIFICATION_ENFORCED`
gate) — there is no outage risk, since a resolution never rejects anything. `PolicyReference`
(`packages/shared/src/domain/policy-reference.ts`) gained a `governanceAnchor` field, merged
onto the trust-record-bound copy of `transaction.policy` alongside `contentHash` (G-24), so an
`ExecutionTrustRecord` now honestly records `NO_APPROVAL_RECORD` for every one of this
deployment's current policies rather than being silent about the question.

**Verified:** `packages/api/tests/unit/PolicyGovernanceAnchorResolver.test.ts` (5 cases,
mirrors `PolicyGovernanceExecutionVerifier.test.ts`'s own fixtures exactly: all four status
outcomes, plus a case confirming it never throws). `packages/runtime/tests/e2e/runtime.e2e.test.ts`
(2 new cases: the resolver's result is stamped onto the real trust record with the real
policy name/version/content-hash it was called with, and a resolver that throws never blocks
or alters a real APPROVED outcome). Full workspace `npx tsc -b` clean. Full repo suite: 1819
passed (10 more than G-44's post-fix baseline of 1809 — the 5 above, 2 more from
G-46 below, and 2 more from a schema/SDK gap found and fixed in the same pass, see below), 42
skipped, 0 failed. Python suite: 79 passed. Verified live against a locally-running instance:
`policyGovernanceAnchorResolverConfigured: true` at startup (vs.
`policyExecutionVerifierConfigured: false`, confirming the two are independently gated as
designed), and a real executed transaction's `transaction.policy.governanceAnchor` came back
`{"status": "NO_APPROVAL_RECORD"}` — the honest, expected answer given G-1's still-open
backfill.

**Also found and fixed in the same pass, unrelated to G-45 itself:** `PolicyReference.contentHash`
(G-24, shipped 2026-08-19) had never actually been added to `schemas/common/policy.schema.json`
or the TypeScript SDK's hand-authored `PolicyReference` model
(`typescript/src/models/policy.ts`) — `additionalProperties: true` meant the schema never
rejected it, but SDK consumers had no typed way to read a field the server had been sending
for weeks. Fixed alongside `governanceAnchor` in both places, since leaving one documented and
the other not would have been more confusing than either state alone. Separately,
`python/scripts/generate_models.ts` had no support for a plain `export type X = "A" | "B"`
string-literal union type alias (only real TS `enum` declarations) — needed for
`PolicyGovernanceAnchorStatus`, since a real cross-package `enum` would have required an
explicit boundary-mapping function like `DecisionBuilder.toDecisionOutcome()` for no benefit
here. Added `tryParseStringUnionTypeAlias()`, a small, generically reusable addition to the
generator (not special-cased to this one field), verified via `npm run check:python-models`
producing a correct Python `Enum` and the regenerated `python/parmana/models/policy.py`
passing the full Python suite.

**Remaining, not attempted this session:** the connector-evidence half of the original
finding. Nothing links `ConnectorEvidence`/`connectorEvidenceHash`
(`packages/execution-gateway/src/connector-execution/ConnectorEvidence.ts`) to the
policy-governance chain above — policy content is bound to the decision, the decision now
carries an honest governance anchor, but neither references what a connector subsequently
did, beyond both sitting inside the same overall signed `ExecutionTrustRecord` envelope. This
would need a real design (what does "this connector call was authorized under a governed
policy" even mean structurally), not a small addition like the one above — genuinely new
scope. Also still true: `POLICY_EXECUTION_VERIFICATION_ENFORCED` (the enforcement gate,
distinct from the anchor resolver above) remains off by default and cannot safely be turned
on until G-1's legacy-policy backfill completes — see `docs/CLAIMS.md` §2.26's "Legacy-policy
backfill" entry.

**G-46. No evidence recorded whether a connector's response included an independent,
vendor-originated cryptographic confirmation, as opposed to only what Parmana's own HTTP call
observed.** Found by the same audit (GAP-3, 2026-09-15). RESOLVED same day.
`ConnectorEvidence` (`packages/execution-gateway/src/connector-execution/ConnectorEvidence.ts`)
gained `vendorConfirmationVerified: boolean`, defaulting to `false` and folded into
`connectorEvidenceHash` like every other field. Confirmed by grep before adding this field:
zero of the four connectors in this codebase (`GatewayHubSpotAdapter`, `GatewayGitHubAdapter`,
`GatewaySlackAdapter`, `GatewayPaytmAdapter`) verify a vendor-response signature — for Paytm
specifically, that verification lives entirely in a separate out-of-process repository
(`parmana-paytm-agent`), already documented in `docs/CLAIMS.md` §3.22. This field makes that
architectural limitation visible in the evidence itself, in every trust record, rather than
only in prose documentation an auditor would need to already know to go read — and gives a
future connector that does add real vendor-signature verification somewhere to record it
(`BuildConnectorEvidenceOptions.vendorConfirmationVerified`, an explicit opt-in, not inferred).

**Verified:** `packages/execution-gateway/tests/unit/evidence-hashing.test.ts` (2 new cases:
defaults to `false` when not passed, and an explicit `true` changes `connectorEvidenceHash`).
Confirmed live against the same local run as G-45 above: a real executed
`test:fixture-execute` transaction's `executions[0].evidence.attributes.connector.vendorConfirmationVerified`
came back `false`.

### cosmetic

**G-10. CLAIMS.md citations that are vague or indirect** rather than pointing at a specific
test:

- **2.7 Replay Support** cites only "Replay package" and "G-08", no test file named, even
  though `packages/replay/tests/unit/replay-engine.test.ts` and
  `packages/replay/tests/replay.integration.test.ts` (6 files, 9 tests total) are real and
  always-run.
- **2.9 Independent Envelope Verification** cites `packages/envelope-verifier/README.md`
  ("Claims" section), a documentation file, not a test.
- **3.2 Fleet-Wide Single-Use** cites the same README pattern.
- **2.1, 2.2, 2.3, 2.4** cite class names only (`BusinessTransactionValidator`,
  `PolicyRouter`, `PolicyValidator`) with no test file named, and, checked directly this
  pass, **`BusinessTransactionValidator` and `PolicyRouter` have no dedicated test file
  anywhere in the repo**, only indirect coverage through other tests
  (`ReferencePolicies.test.ts`, `ReferencePoliciesEvaluation.test.ts` for
  `PolicyValidator`; nothing dedicated for the other two).

None of these claims are false; the underlying capability is real, verified by tests
elsewhere in the suite. But a reader following CLAIMS.md's own citation cannot find the
proof without independently searching for it, which is the exact failure mode CLAIMS.md's
discipline exists to prevent.

**G-11. PARTIALLY CLOSED in the 2026-07-17 session.** `EXECUTION_AUTHORIZATION_TTL_SECONDS`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `CRYPTO_MODE`,
`RECEIPT_VERSION`, and `DATABASE_URL` are read by `packages/shared/src/config/Config.ts`.
The new root `.env.example` now documents every environment variable confirmed (by grep)
to be read anywhere in `packages/*/src`, including all of these, with `CRYPTO_MODE`
annotated as dead per G-4. What remains open: the public docs site
(`guides/deploy-patterns.mdx`, `deployment/local.mdx`, `cryptography/overview.mdx`) still
does not mention them. `.env.example` is a better source of truth than doc prose (it
can't drift as invisibly), but the site itself was not updated this session.

---

## Decision required (options, not fixes)

### D-1. Duplicate Business Transaction race (G-1)

**Option A: fix the race.** Add a real uniqueness guard to
`MemoryBusinessTransactionRepository.create()` (e.g. `Map.has` check inside the same
synchronous tick as `Map.set`, throwing `DuplicateBusinessTransactionError` itself instead
of relying on the service-layer check) and add an explicit "insert if absent" contract to
the `BusinessTransactionRepository` interface so `SupabaseBusinessTransactionRepository`
can be reviewed against the same contract (its own version is protected today only by the
Postgres `PRIMARY KEY` constraint, which would currently surface as a raw, unstructured
Postgres error rather than the clean 409 the sequential path gives, a related but distinct
inconsistency worth fixing in the same pass). _Estimated size: small, a few hours,
`MemoryBusinessTransactionRepository.create()` is nine lines; the Supabase-side error
mapping needs a `catch` for the Postgres unique-violation error code and a rethrow as
`DuplicateBusinessTransactionError`. Test: the exact `Promise.all` scenario already used
to confirm the bug, now asserting one success and one clean rejection._

**Option B: document the limitation.** State plainly on `reference/storage.mdx` and
`guides/deploy-patterns.mdx` that `memory` storage is not safe under concurrent duplicate
submissions of the same `businessTransactionId` and is not intended for anything beyond
local development, matching its existing framing everywhere else on the site. _Estimated
size: trivial, a docs paragraph, no code change. Leaves the underlying bug in place for
anyone who does run `memory` storage under real concurrent load, including any pilot that
starts on `memory` before migrating to Supabase._

I lean toward Option A being cheap enough that Option B alone under-serves anyone actually
running a pilot on `memory` storage under load, but this is a real design/priority call.

**Status: RESOLVED. Option A implemented as written above**, in the audit-sink/G-1
hardening session that followed the G-13 session. See G-1's own entry above for what
changed and how it's verified. One point the estimate above didn't anticipate:
`DuplicateBusinessTransactionError` had to move from `@parmana/runtime` to `@parmana/shared`
to avoid a circular package dependency; also documented in G-1's entry.

### D-2. Hybrid/PQ dead configuration (G-4)

**Status: PARTIALLY RESOLVED, Option A implemented for two of the three originally-listed
call sites.** See G-4's own entry above for what changed. `VerificationCrypto` (Trust
Records) and `ReceiptCrypto` (Receipts) now branch on `config.crypto.mode` and call
`CryptoBootstrap.createHybrid()`; the additive `signatures`/`schemaVersion` schema change
D-2 originally flagged as "the real complexity, not the `CryptoBootstrap` call itself" is
built (`SignatureEntry`, `packages/shared/src/domain/signature-entry.ts`), with the
existing single `Signature` field left untouched rather than replaced, closing exactly the
schema-design question this entry called out as unresolved. The Supabase schema question
this entry raised does not apply to these two surfaces: neither `execution_trust_records`
nor `receipts` needed a new column, since `signatures`/`schemaVersion` ride inside the
existing JSON-shaped record/receipt columns.

**What Option A has not touched, and D-1's original estimate did not have to consider
piecemeal:** `RuntimeAuthorizationSigner`, gateway attestation signing, and
`createConnectorRegistry.ts`'s connector-signing call sites remain exactly as this entry
originally found them — single-provider, `CryptoBootstrap.create()` only. Extending Option
A to these is a separate decision, deliberately deferred (see the Hybrid Signature Support
milestone's own scope: "Refusal Records and audit-event signing get hybrid signing in a
fast-follow milestone, not this one"), not a rejection of Option A for them. **Option B
(remove `CRYPTO_MODE` entirely, document as single-provider by design) is no longer live**
for the codebase as a whole — the config is not dead anymore, just narrower in scope than
"everything this process signs" — though it would still be a coherent choice to describe
the _remaining_ unwired surfaces as single-provider-by-design rather than extend Option A
to them.

**CLAIMS.md status:** now updated (3.13), capability-scoped only — it does not claim
hybrid-in-production, since it isn't (opt-in, not default; `@parmana/sign` doesn't cover
the new envelope shape yet, both stated explicitly in 3.13's own text). D-2's original note
that Option A "needs its own design decision" and touches CLAIMS.md is now fully resolved:
the design decision was made and implemented, and the claim was written scoped to exactly
that.

### D-3. `OverrideService` unreachable and untested (G-5)

**Option A: wire it in.** Add a `POST /overrides` (or similar) route calling
`OverrideService`, and a test suite proving its actual business rules (duplicate-override
rejection, missing-transaction/missing-trust-record errors), replacing the storage-layer
bypass test with a real one. _Estimated size: small-to-medium, the service already exists
and is presumably complete; this is mostly route wiring plus tests, roughly a day._

**Option B: remove it, or explicitly mark it `[FUTURE]`.** If overrides aren't meant to be
externally triggerable yet, delete the unused service (it's dead code by the same
definition applied elsewhere in this audit) or add a CLAIMS.md `[FUTURE]` entry and a
`reference/runtime.mdx` note that override application is a domain concept modeled in code
but not yet exposed. _Estimated size: trivial either way._

---

### D-4. HubSpot approval issuer provisioning (NF-005, Sep 7, 2026)

`TRUSTED_APPROVAL_ISSUERS` (`packages/api/src/bootstrap/createApprovalIssuerRegistry.ts`) is
an empty array by design — the file's own comment already documents this as "the correct
fail-closed starting state," not a bug: every `preAuthorizedForAmountChange` claim
`HubSpotSignalStateVerifier` checks currently fails closed since no real approver key has
been provisioned.

**Option A: provision a real issuer.** Generate a real approver keypair out-of-band, add an
entry to `TRUSTED_APPROVAL_ISSUERS`, provision the matching public key file under
`PARMANA_KEY_DIR/approval-issuers/`, following the exact pattern already established for
trusted connector identities (`createConnectorAuthenticator.ts`). _Requires an actual
business approver (risk team, compliance) to hold the private key; not something to
provision speculatively._

**Option B: a `NODE_ENV`-gated ephemeral dev/test issuer.** Generate a keypair fresh at
test-run time (the same way `vitest.setup.ts` already does for the gateway/default signing
keys — ephemeral, per-run, never committed) and register it only under `NODE_ENV=test`, so
demos and integration tests can exercise the `preAuthorizedForAmountChange` path without
waiting on Option A.

**Option C: leave empty, do nothing.** The current state is intentional and fail-closed;
nothing is broken by leaving it as-is until a real business need for high-value HubSpot
preauthorization exists.

**A prior version of this session's plan proposed a fourth option — a hardcoded dev private
key committed to source, used by the real `ApprovalVerifier` path — and it was rejected
during review**, not implemented: even `NODE_ENV`-gated, a committed private key trusted by
real verification logic is inconsistent with this repo's own established convention
(ephemeral, never-committed test keys) and is the kind of thing this document exists to
flag, not introduce. **Status: undecided.** No option above has been implemented; this is an
open decision, not a closed one.

### D-5. Upstream authorization verification (NF-001, Sep 7, 2026)

Not a bug: `BusinessTransactionValidator.validate()`
(`packages/runtime/src/validators/BusinessTransactionValidator.ts`) checks only ID-linkage
between `authority`/`authorization`/`intent`, never an independent signature/issuer/expiry
on `Authority`/`Authorization` themselves — by design, since the real authorization boundary
today is caller identity (API key → `callerId`) plus `isPrincipalAllowed`/
`isCapabilityAllowed` scoping, not a second credential on the domain objects. This becomes a
real gap only for a delegation scenario: multi-party approval, an external authorization
source (OAuth/SAML/risk service), or a regulatory requirement for independent proof of
approval.

**Full design spec, decision gates, and a reference implementation sketch:**
`NF-001-UPSTREAM-AUTHORIZATION-VERIFICATION.md` (repo root). **Status: future scope, not
implemented, no work started.** Triggered by a real customer request or architectural
decision, not before — see that document's "Decision Gates" section for what would need to
be true first.

---

### D-6. CI's `verify-policy-approvals` gate is advisory only, not a required branch-protection check (2026-09-10)

Not a code gap: `.github/workflows/ci.yml` already runs the maker-checker verification job
on every push/PR, and its own inline comment already states plainly that it is advisory
only today. The fail-closed guarantee this job provides only holds if a human notices a red
X on the PR. Nothing in this repository's committed configuration currently forces GitHub
to block a merge when it fails.

**Attempted directly, not assumed to be a simple checkbox:** `gh api
repos/{owner}/{repo}/branches/main/protection` against this actual repository (a private
repo on GitHub's free plan) returned a live 403: _"Upgrade to GitHub Pro or make this
repository public to enable this feature."_ Required-status-check branch protection is a
real, external platform/billing constraint on this account today, not a configuration
change a code session can make.

**Status: blocked, not resolved.** Two options, both requiring the repository owner's
decision (billing or visibility, neither a call this document or a code change can make):

- **Option A: upgrade to GitHub Pro** (or an org plan that includes branch protection on
  private repos), then enable a required status check for `verify-policy-approvals` on
  `main` in GitHub's own branch-protection settings, a five-minute action once the plan
  supports it.
- **Option B: make the repository public.** Branch protection is available on public repos
  regardless of plan. Has implications well beyond this one CI gate (source visibility,
  the exposed-key incident already documented above); not a decision to make solely to
  unblock this gate.
- **Option C: leave advisory-only.** The gate still runs and still reports on every PR;
  the residual risk is a human merging past a red X, not a gate that fails silently or
  doesn't run at all.

---

## Top 5 to close first, if a bank's security team were reviewing next week

1. **G-1, duplicate-transaction race: RESOLVED.** Option A implemented as written: atomic
   `Map.has`/`Map.set` in the same tick for the in-memory repository, `23505` mapping for
   the Supabase repository, both throwing the same `DuplicateBusinessTransactionError`
   (relocated to `@parmana/shared` to avoid a circular dependency; see G-1's own entry).
2. **G-3, live credentials used silently by default: RESOLVED.** The "silently" half is
   fixed: an `ALLOW_LIVE_SUPABASE=1` opt-in is now required, hard-failing with a named
   error otherwise. The cleanup half remains: no test deletes the real rows it writes once
   opted in. _Remaining work: a cleanup step (or a dedicated, disposable test project) so
   an opted-in `npm test` stops leaving permanent rows in a real database, a day, mostly
   cleanup-hook work across 10 test files._
3. **G-2, no CI: CLOSED 2026-07-17.** `.github/workflows/ci.yml` now runs the full suite
   on every push and PR. Supabase-gated tests are excluded there (no project secrets
   configured in CI) and rely on local runs; the decision this note flagged as worth
   making explicitly was made explicitly: local-only for now, revisit if fleet-wide
   Supabase coverage in CI becomes a priority.
4. **G-4, hybrid/PQ dead config: PARTIALLY RESOLVED.** Option A is now implemented for
   Trust Records and Receipts (Hybrid Signature Support, Phase A) — the config is no
   longer dead, just narrower in scope than every signing surface. Remaining: execution
   authorization signing, gateway attestation, and connector signing are still
   single-provider-only, unaffected by `CRYPTO_MODE`. _Extending Option A to those, if
   wanted, is the remaining project; not urgent, since nothing currently misleads a
   deployer into thinking they're covered by hybrid mode when they aren't (G-4's own
   "still exactly as originally found" paragraph names them explicitly)._
5. **G-5, OverrideService unreachable** (Option A or B, either closes the ambiguity): right
   now it's neither a documented `[FUTURE]` capability nor a tested, reachable one, which is
   the actual gap, not the specific choice between exposing or removing it. _A day for either
   option._

---

## How to reproduce this audit

```bash
npm test                    # baseline: 345 passed, 1 skipped
npm run coverage             # per-file coverage, v8
grep -rn "\.skip(\|\.skipIf(\|\.todo(" packages/*/tests packages/*/test --include="*.test.ts"
```

Every finding above traces to a specific `file:line` cited inline; none are inferred from
summaries or file names alone.

---

## Legacy documentation tree terminology sweep, closed 2026-07-17

Previously deferred (see prior revision of this document): `docs/00-introduction`,
`docs/rfcs`, `GOVERNANCE.md`, `docs/01-concepts` through `docs/03-api`, `docs/adr`, and
`typescript/docs/06_autonomous_vehicle.md` through `typescript/docs/09_multi_agent.md`
predate the Mintlify site (`docs/site`) and were left untouched during an earlier
terminology sweep that updated `docs/site`, `README.md`, `packages/connector-sdk/
package.json`, and the affected tutorial READMEs.

The 2026-07-17 audit closeout session swept the remainder: `GOVERNANCE.md`,
`docs/00-introduction/PROBLEM.md`, `docs/rfcs/RFC-0012-Phase-1-Architecture-Completion.md`,
`typescript/docs/06_autonomous_vehicle.md` through `09_multi_agent.md`,
`docs/architecture/EXECUTION-FLOW-AUDIT.md`, `docs/architecture/KEY-MANAGEMENT.md`, and
`docs/specifications/reference-policies.md`. A fresh repo-wide grep confirms
`docs/01-concepts` through `docs/03-api` and `docs/adr` never actually contained the
retired term (zero matches); nothing to sweep there. See "Gaps closed in the 2026-07-17
audit closeout session" above (item 19) for the two files intentionally left unswept (an
external citation that is itself correctly named "Execution Governance") and the CI guard
now in place against regression.
