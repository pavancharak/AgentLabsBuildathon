# Phase 2G — Resolve Replay Endpoint Semantics (TD-13)

Independently re-verifies TD-13 (`docs/architecture/repository-certification.md`, Technical Debt Register) against current source, determines whether `POST /replay`'s current behavior is intentional or a bug, and either restores canonical replay semantics or documents why that would be a production API break. Treated Phase 2E's conclusions as hypotheses, not facts.

**Fixed against:** commit `ef2cbab` (`refactor(runtime): canonicalize executable content construction`), the tip of `main`. Working tree had one uncommitted, unrelated whitespace-only change to `.github/workflows/ci.yml` at the start of this phase (adds leading indentation to `name: CI`); confirmed unrelated to Phase 2F or any replay work (no matching content in the diff, no stash, no history tying it to this line of work) and discarded (`git restore`) before proceeding, per user confirmation.

---

## 1. Original TD-13 Wording

From `docs/architecture/repository-certification.md`:

> `POST /replay` exists and returns 200, but `ExecutionTrustApplication.replay()` does not invoke `@parmana/replay`'s `ReplayExecutor`/`ReplayPipeline` at all — it re-fetches the Trust Record and re-verifies its hash/signature, functionally duplicating `/verify`. `@parmana/replay`'s own "deterministic reconstruction" machinery remains entirely unreachable from any route. **Not a security or trust-fabrication issue** (nothing is misrepresented as more-verified than it is), but a claims-precision gap. **Next phase touching `/replay`: either wire in the real package, or correct the route's documented behavior/name to match what it actually does.**

Rated **Medium**, classified **Open**.

## 2. Independent Verification Methodology

Read source directly rather than trusting Phase 2E's summary:

- `packages/api/src/routes/replay.ts` (the HTTP route)
- `packages/runtime/src/ExecutionTrustApplication.ts` (`replay()`, `verify()`)
- `packages/runtime/src/services/verification-service.ts` (`VerificationService.verify()`)
- `packages/crypto/src/VerificationCrypto.ts` (`verify()`, `verifySignature()`, `hash()`)
- Every file under `packages/replay/src/` (`ReplayEngine`, `ReplayBuilder`, `ReplayVerifier`, `ReplayPipeline`, `ReplayExecutor`, `ReplayContext`)
- `examples/tutorials/06-replay/run.ts` (the only place `ReplayEngine` is actually invoked)
- Repo-wide grep for `@parmana/replay` (17 hits, all docs/package metadata/the tutorial — zero in `packages/api` or `packages/runtime`)
- Repo-wide grep for `.replay(`/`replay(` across `packages/**/*.ts` (8 call sites — see Task 6 below)
- `docs/CLAIMS.md` §2.7, §4 (Future Claims), `docs/GUARANTEES.md` G-08, `docs/VERIFICATION-GAPS.md` G-10
- `docs/site/reference/replay.mdx`, `docs/site/replay/overview.mdx` (existing disambiguation pages)
- `schemas/requests/replay-request.schema.json`, `schemas/responses/replay-response.schema.json`, `openapi/openapi.yaml` (`/replay` path)
- Both published SDKs: `typescript/src/client/ReplayApi.ts`, `typescript/src/models/replay-result.ts`, `python/parmana/api/replay_api.py`, `python/parmana/models/replay_result.py`, and their tests (`python/tests/test_replay_api.py`; `typescript/test/ReplayApi.test.ts` — confirmed empty, a pre-existing TD-10 gap)
- `packages/api/tests/integration/replay.integration.test.ts`, `caller-scoping.integration.test.ts`, `caller-auth.integration.test.ts`
- `git log --follow` on the schema, mdx, and route files, to establish when the current documentation and contract were actually written, not assume they were backfilled by this or the prior phase

**TD-13's factual premise was confirmed exactly as described**: the route exists, returns 200, and `ExecutionTrustApplication.replay()` performs a signature/hash recheck rather than invoking `@parmana/replay`. No part of that finding was overturned. What this phase adds is the piece TD-13 explicitly left open — **whether that behavior is intentional** — and the answer changes the recommended action from "fix it" to "leave it, for a specific, evidenced reason."

## 3. Actual Replay Behavior

`ExecutionTrustApplication.replay()` (`packages/runtime/src/ExecutionTrustApplication.ts:131-160`):

```ts
async replay(businessTransactionId: string): Promise<{
  businessTransactionId: string;
  trustRecordHash: string;
  verified: boolean;
}> {
  const trustRecord = await this.trustRecords.findByTransactionId(businessTransactionId);
  if (!trustRecord) throw new VerificationFailedError("Execution Trust Record not found.");
  const verified = await this.crypto.verify(trustRecord);
  return { businessTransactionId, trustRecordHash: trustRecord.trustRecordHash, verified };
}
```

`this.crypto` is `VerificationCrypto` (`packages/crypto/src/VerificationCrypto.ts`). Its `verify()` recomputes the canonical hash and compares it to `trustRecordHash`, then verifies the stored Ed25519/ML-DSA-65 signature against the stored public key. It does **not** run the authorization-binding check (every `APPROVED` execution must carry a non-empty `authorizationId`) that `VerificationService.verify()` runs as its third check, and it does **not** persist a `Verification` record via `appendVerification()` the way `verify()` does — confirmed by the new unit test's "does not persist a Verification record" case (§5 below). Replay is therefore not merely "the same as verify" — it is a **strict subset** of verify's checks, with no persistence side effect.

No re-execution, no policy re-evaluation, and no interaction with `Runtime`, `RuntimeEngine`, `ExecutionGateway`, `@parmana/replay`, or any nonce/replay-protection store happens anywhere in this path.

## 4. Repository Evidence for Intended Behavior

This is the crux of the phase. Evidence splits into two categories that must not be conflated: what "Replay" as a _concept_ is guaranteed to mean somewhere in the repository, and what `POST /replay` as a _contracted HTTP endpoint_ is documented and consumed as meaning today.

**What "Replay" the concept is guaranteed to mean** — `docs/GUARANTEES.md`, G-08 (Deterministic Replay):

> Replay re-evaluates historical execution without modifying historical evidence. Replay is intended to detect meaningful differences between recorded and replayed execution.

Its evidence citation is "Replay package" — i.e. `@parmana/replay`, not `ExecutionTrustApplication.replay()`. `packages/replay/src/ReplayEngine.ts` matches this guarantee exactly: it re-runs `PolicyEngine.evaluate()` against a trust record's recorded signals and reports `matches: recordedDecision.outcome === replayedDecision.outcome` — genuine re-evaluation, proven deterministic regardless of input order (`replay-determinism.test.ts`). `CLAIMS.md` §2.7 ("Parmana supports replay of recorded execution decisions for verification and analysis") cites the same evidence ("Replay package", "G-08") — again the package, not the route. `docs/VERIFICATION-GAPS.md` G-10 independently flags this citation as _vague_ (no test file named) but explicitly confirms **"none of these claims are false; the underlying capability is real"** — a prior, independent audit pass already checked this and did not find a misrepresentation.

**What `POST /replay` is documented and consumed as meaning** — four independent sources, none written by this phase or by Phase 2E:

1. **`schemas/responses/replay-response.schema.json`** (unchanged since commit `4740aee`, 2026-07-08 — predates Phase 2E by roughly a month): _"A deliberately small shape distinct from the Execution Trust Record it replays: it re-verifies the record's stored signature via VerificationCrypto and reports only whether that succeeded, alongside the hash it checked."_ This is not a post-hoc rationalization — it is the original schema description, written when the route was built.
2. **`openapi/openapi.yaml`** (`/replay` path, same provenance): _"Re-verifies the stored signature on the Execution Trust Record for businessTransactionId and returns its hash alongside the verification result. Does not re-run Policy evaluation or re-execute anything."_
3. **`docs/site/reference/replay.mdx`** and **`docs/site/replay/overview.mdx`**: a dedicated disambiguation page, last substantively edited 2026-07-12 (commit `5690474`) — three weeks before Phase 2E's assessment (2026-08-05) and five weeks before this phase. Both pages state, in an `<Info>`/`<Warning>` callout, that `POST /replay` and `@parmana/replay` are "two unconnected things," that the route is "narrower than 'replay' implies: it's a signature recheck with a `replay`-shaped response, not deterministic execution reconstruction," and that `@parmana/replay` is "not reachable through `POST /replay` or any other route today." The overview page's own text ("This corrects a previous version of this page") shows this documentation has already been through at least one prior accuracy pass, independent of this debt-cleanup arc.
4. **`docs/CLAIMS.md` §4, Future Claims (Pending Evidence)**: _"Replay semantically verifies every trust artifact."_ is listed here, explicitly **not** among Supported Claims. Wiring `@parmana/replay` into the route to make it perform real semantic re-evaluation is exactly the change that would be needed to promote this from a Future Claim to a Supported one — and the project's own claims-discipline process (`docs/site/trust-and-claims/claims-discipline.mdx`) treats that promotion as a deliberate, evidenced act, not an incidental side effect of a technical-debt cleanup phase.

**Conclusion:** the repository's own evidence is internally consistent and unambiguous once both categories above are read together. There is no conflicting or missing evidence, no ambiguity requiring a STOP under Task 3's rubric. "Replay" as a _guaranteed capability_ (G-08) is honestly and narrowly scoped to the standalone `@parmana/replay` package. `POST /replay` as a _contracted HTTP endpoint_ is separately, correctly, and repeatedly documented as a signature recheck — and has been since before this debt-cleanup arc began. TD-13's own recommended second option — "correct the route's documented behavior/name to match what it actually does" — **was already done, independently, prior to this phase.** The remaining gap is not a documentation problem; it is that the route's _name_ ("replay") still collides with the package's _name_ for a different concept (§10, and the naming-collision note below).

## 5. Implementation Changes

**None to production code.** Per this phase's own gating instructions ("If any production consumer is found to depend on the current `/replay` behavior: STOP... Only proceed with Task 4 if no production consumer depends upon current semantics"), independent verification found production consumers with a hard, typed dependency on the current response shape:

| Consumer                | Dependency                                                                                                                                                                      | Evidence                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript SDK          | `ReplayApi.replay()` returns `ReplayResult` (`{businessTransactionId, trustRecordHash, verified}`); this is a published `@parmana/*` npm package's public compile-time contract | `typescript/src/client/ReplayApi.ts`, `typescript/src/models/replay-result.ts`                                                 |
| Python SDK              | `ReplayApi.replay()` returns `ReplayResult` dataclass with the same three fields, and is asserted by a real, passing unit test                                                  | `python/parmana/api/replay_api.py`, `python/parmana/models/replay_result.py`, `python/tests/test_replay_api.py` (passes today) |
| OpenAPI contract        | `/replay`'s `200` response is `$ref`'d to `replay-response.schema.json`, with a captured real example (`verified: true`, a real hash)                                           | `openapi/openapi.yaml:1559-1574`                                                                                               |
| Server integration test | Asserts exactly today's shape and values end-to-end through `/execute` → `/replay`                                                                                              | `packages/api/tests/integration/replay.integration.test.ts:73-81`                                                              |

Replacing `ExecutionTrustApplication.replay()`'s return value with `@parmana/replay`'s `ReplayResult` shape (`{recordedDecision, replayedDecision, matches, replayedAt}`) would be a breaking change to a documented, versioned, SDK-typed API response — exactly the production-API-compatibility issue this phase's instructions require stopping for, independent of whether the change would otherwise be "more correct."

**Affected consumer(s):** the published TypeScript and Python SDKs' `ReplayApi`/`ReplayResult`, and any external caller of `POST /replay` relying on the `verified: boolean` field (the OpenAPI-documented, SDK-typed contract).

**Observed dependency:** compile-time type contract in both SDKs; a passing Python unit test asserting the exact field names and types; a passing server integration test asserting the exact response values.

**Behavioral impact of wiring in `@parmana/replay` instead:** the response would no longer contain `verified: boolean` or a comparable `trustRecordHash` field at the top level, breaking both SDKs' return type and any caller checking `.verified`; the semantics would change from "did the stored artifact's signature verify" to "did the policy decision reproduce," a different question with a different failure mode (e.g. a record could have `verified: true` today for cryptographic integrity but no longer have a directly analogous field once policy-outcome matching replaces it).

**Recommended migration strategy (not performed in this phase):** introduce the real semantic replay capability under a new, additively-versioned surface — e.g. a distinct route (`POST /replay/decision` or similar) or an explicit API version — rather than mutating `POST /replay`'s existing response shape in place. This lets `@parmana/replay` be wired into the HTTP surface (closing the "genuinely unreachable" half of TD-13) without an SDK-breaking change, and gives `CLAIMS.md`'s Future Claim a concrete, evidenced promotion path. This recommendation is left for a future, explicitly-scoped phase — consistent with this phase's Preserve list and its instruction not to redesign replay or the runtime.

Since no production consumer dependency blocks _leaving the current behavior as-is_, and repository evidence (§4) independently confirms that behavior is the documented, intentional contract, **Task 4's condition for restoration was not met.** No implementation changes were made to `ExecutionTrustApplication.replay()`, `packages/api/src/routes/replay.ts`, `VerificationCrypto`, or any file under `packages/replay/src/`.

## 6. Replay Execution Call Graph

```
POST /replay
  └─ packages/api/src/routes/replay.ts
       ├─ isOwnedByCaller(application, businessTransactionId, req.callerId)   [ownership/authorization gate]
       │    └─ application.getTransaction(businessTransactionId)
       └─ application.replay(businessTransactionId)
            packages/runtime/src/ExecutionTrustApplication.ts:131
              ├─ this.trustRecords.findByTransactionId(businessTransactionId)   [read-only]
              └─ this.crypto.verify(trustRecord)
                   packages/crypto/src/VerificationCrypto.ts:139
                     ├─ this.hash(trustRecord)              → hash comparison against trustRecord.trustRecordHash
                     ├─ this.keys.getPublicKey(...)
                     └─ this.verifier.verify(canonicalRecord, signature.value, publicKey)
              → { businessTransactionId, trustRecordHash, verified }   [no persistence]
```

`@parmana/replay` (`ReplayEngine`, `ReplayPipeline`, `ReplayExecutor`, `ReplayBuilder`, `ReplayVerifier`, `ReplayContext`) does **not** appear anywhere in this graph. Its only production-code caller in the entire repository is `examples/tutorials/06-replay/run.ts`, a standalone tutorial script that builds a `Runtime` and a trust record directly and calls `new ReplayEngine().replay({trustRecord, transaction, policy})` itself — it never goes through the HTTP layer.

## 7. Verify Execution Call Graph

```
POST /verify
  └─ packages/api/src/routes/verify.ts
       ├─ isOwnedByCaller(application, businessTransactionId, req.callerId)   [ownership/authorization gate]
       └─ application.verify(businessTransactionId)
            packages/runtime/src/ExecutionTrustApplication.ts:109
              └─ this.verification.verify(businessTransactionId)
                   packages/runtime/src/services/verification-service.ts:36
                     ├─ this.trustRecords.findByTransactionId(businessTransactionId)   [read-only]
                     ├─ runChecks(trustRecord):
                     │    ├─ Integrity: this.crypto.hash(trustRecord) vs trustRecord.trustRecordHash
                     │    ├─ Signature: this.crypto.verifySignature(trustRecord)
                     │    └─ Authorization binding: every APPROVED execution has a non-empty authorizationId
                     └─ this.trustRecords.appendVerification(businessTransactionId, verification)   [persists]
              → Verification { verificationId, businessTransactionId, status, message, verifiedAt, trustRecordHash }
```

**Common execution:** both paths load the same Trust Record by id and both ultimately recompute the same canonical hash and verify the same signature (`verify`'s Integrity + Signature checks are behaviorally identical to what `replay`'s `crypto.verify()` does internally — confirmed by reading `VerificationCrypto.hash()`/`verifySignature()`/`verify()`, all three built from the same `canonicalRecord()` and the same `hasher`/`verifier` instances).

**Divergent execution:**

- `verify` additionally runs the authorization-binding check; `replay` does not.
- `verify` persists a `Verification` record via `appendVerification()`; `replay` performs no write of any kind (confirmed by the new unit test, §5).
- `verify`'s response is the full `Verification` domain object (with `verificationId`, `status`, `message`, `verifiedAt`); `replay`'s response is the deliberately smaller `{businessTransactionId, trustRecordHash, verified}` shape.
- `replay` is exposed as a separate, narrower boolean than `verify`'s richer `VerificationStatus` enum (`VERIFIED`/`FAILED`) with a human-readable per-check `message`.

**Duplicated logic:** the hash-integrity and signature checks are effectively duplicated between the two paths (both call into `VerificationCrypto`'s hash/verify machinery against the same canonical record), which is the concrete basis for TD-13's "functionally duplicating /verify" finding — confirmed accurate. It is a subset-duplication, not a full one: `replay` cannot produce everything `verify` produces (no authorization-binding check, no persisted record).

**Unreachable replay code:** `@parmana/replay`'s entire public surface (`ReplayEngine`, `ReplayPipeline`, `ReplayExecutor`, `ReplayBuilder`, `ReplayVerifier`, `ReplayContext`) — unreachable from either `/verify` or `/replay`.

**Replay-only behavior:** none beyond the narrower response shape — every check `replay` performs, `verify` also performs.

**Verify-only behavior:** the authorization-binding check and the persisted `Verification` audit trail.

## 8. Regression Testing Performed

**New:** `packages/runtime/tests/unit/execution-trust-application-replay.test.ts` (6 tests, constructs `ExecutionTrustApplication` directly with a real `VerificationService` and an in-memory repository, matching the conventions of `verification-service.test.ts`, so it runs without the Supabase gate that skips the existing integration test locally):

1. Reports `verified: true` and the stored hash for a valid Trust Record, built via the real `BusinessTrustRecordBuilder` (genuine canonicalization/hashing/signing, not hand-rolled).
2. Deterministic — two calls against the same record produce identical results.
3. Does not persist a `Verification` record — the concrete, asserted divergence from `verify()`.
4. Cannot fabricate a valid result for a tampered hash — `verified: false`, and the response still reports the actual (tampered) stored hash rather than a substituted or omitted one.
5. Cannot fabricate a valid result for a tampered signature — `verified: false`.
6. Throws `VerificationFailedError` for an unknown transaction and creates no record as a side effect of the failure — cannot fabricate a Trust Record, and by construction (no write path anywhere in `replay()`) cannot fabricate a Receipt or vendor evidence either.

**Existing, re-confirmed passing, unchanged:**

- `packages/api/tests/integration/replay.integration.test.ts` — happy path and 404-for-unknown-transaction through the real HTTP route (Supabase-gated, skipped locally, unchanged).
- `packages/api/tests/integration/caller-scoping.integration.test.ts` — "blocks caller-b from POST /replay for caller-a's transaction" (authorization preserved).
- `packages/api/tests/integration/caller-auth.integration.test.ts` — `/replay` requires authentication like every other route (`it.each` list).
- `packages/runtime/tests/unit/verification-service.test.ts`, `verification-negative.test.ts` — `verify()` behavior, entirely untouched by this phase, still green.

**Full regression run:**

```
npx tsc -b                        → clean, 0 errors
npm test -- --maxWorkers=2        → 140 test files passed (+1), 15 skipped (unchanged);
                                     961 tests passed (+6), 39 skipped, 0 failed
```

`git diff --stat` against the starting commit confirms exactly one new file (`packages/runtime/tests/unit/execution-trust-application-replay.test.ts`) and this documentation file — no production source under `packages/*/src/` was touched.

## 9. Remaining Limitations

- **`@parmana/replay` remains genuinely unreachable from any HTTP route.** This phase did not change that — see §5 for why (production API compatibility) and the recommended migration path (an additive new surface, not an in-place change).
- **Locally, `/replay`'s only end-to-end HTTP-level coverage (`replay.integration.test.ts`) is Supabase-gated and skipped without a configured database.** The new unit test (§8) closes the gap for `ExecutionTrustApplication.replay()`'s own logic without a database, but does not exercise the Express route, `isOwnedByCaller`, or error-handler mapping — those remain covered only by the gated integration tests and the (ungated) `caller-scoping`/`caller-auth` tests.
- **The TypeScript SDK's own test for this surface is an empty stub** (`typescript/test/ReplayApi.test.ts`, `typescript/test/fixtures/replay-result.ts` — both confirmed empty). This is the pre-existing, separately-tracked TD-10 gap ("5 of 9 test files remain empty stubs"), not something this phase closes — flagged here because it is directly relevant to how much this phase's production-consumer-dependency finding rests on the _type contract_ (real) versus a _dedicated test_ (missing on the TS side; present and passing on the Python side).
- **`CLAIMS.md` §2.7's citation remains vague** ("Replay package", "G-08", no test file named) — a pre-existing, independently-flagged (`VERIFICATION-GAPS.md` G-10) cosmetic gap, confirmed not to represent a false claim, not addressed by this phase.

## 10. Naming Collision Note

This repository already uses the word **"replay"** for a second, unrelated concept: the anti-replay **nonce-consumption** security mechanism in the execution-authorization pipeline (`packages/execution-gateway/src/ExecutionGateway.ts`'s `isSoleFailureNonceReplay`, `NonceAlreadyConsumedError`, `packages/envelope-verifier/src/NonceStore.ts`, `packages/storage/src/supabase/SupabaseNonceStore.ts`, `CLAIMS.md` §2.10/§2.21). That mechanism rejects a previously-consumed authorization nonce as a replayed (i.e. re-submitted) request — a completely different meaning of "replay" from either of the two examined in this phase (re-verifying a stored artifact, or re-evaluating a recorded decision).

**The repository therefore now contains three distinct things sharing the word "replay":**

1. Anti-replay nonce consumption (`ExecutionGateway`/`NonceStore`) — security control against request resubmission.
2. `POST /replay` (`ExecutionTrustApplication.replay()`) — a signature/hash recheck of a stored Trust Record.
3. `@parmana/replay` (`ReplayEngine`) — genuine deterministic re-evaluation of a recorded policy decision.

None of these are confused with one another in code — each lives in its own package/module with no shared implementation — but the shared English word across three independently-real mechanisms is a legitimate terminology risk for anyone reading route names, package names, or `CLAIMS.md` prose without the full cross-reference this document (and the existing `docs/site/replay/overview.mdx`) provides. **Flagged for future consideration** (e.g. renaming `POST /replay` to something like `POST /trust-records/:id/reverify`, or renaming `@parmana/replay` to `@parmana/decision-replay`) — **no names were changed in this phase**, per its explicit scope.

---

## Final Verification

| Item                                                         | Status                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-13 independently re-verified                              | ✓ — factual premise (route exists, returns 200, duplicates a subset of `/verify`, `@parmana/replay` unreachable) confirmed exactly accurate                                                                                                                                                                                                                                                                                  |
| Replay semantics established from repository evidence        | ✓ — two internally-consistent, non-conflicting readings found: G-08/`CLAIMS.md` scope "Replay" the guarantee to the standalone package; the schema/OpenAPI/mdx docs scope `POST /replay` the endpoint to a signature recheck, and have done so since before this debt-cleanup arc (`schemas/responses/replay-response.schema.json` since `4740aee`, 2026-07-08; `docs/site/replay/overview.mdx` since `5690474`, 2026-07-12) |
| Production consumer dependency checked                       | ✓ — found: TypeScript and Python published SDKs' `ReplayApi`/`ReplayResult` are typed against the current response shape; OpenAPI contract and a passing integration test assert it; STOP condition applied, no in-place breaking change made                                                                                                                                                                                |
| Replay exercises canonical behavior, if restoration required | N/A — restoration not required; current behavior independently verified intentional and separately production-contracted                                                                                                                                                                                                                                                                                                     |
| Verify semantics unchanged                                   | ✓ — no file under `verification-service.ts`'s call graph touched; existing tests unchanged and green                                                                                                                                                                                                                                                                                                                         |
| Runtime behavior unchanged outside replay                    | ✓ — `git diff --stat` shows only a new test file and this document                                                                                                                                                                                                                                                                                                                                                           |
| Security behavior unchanged                                  | ✓ — no authorization, signal-verification, replay-protection (nonce), audit, or credential-handling code touched                                                                                                                                                                                                                                                                                                             |

Supported by: repository searches (§2), source references (§3, §6, §7), execution call graphs (§6, §7), and regression tests (§8, 967 passing / 39 correctly skipped / 0 failed, `tsc -b` clean).

## Final Recommendation

**TD-13 CLOSED.**

The repository has one clearly defined `POST /replay` behavior, supported by repository evidence predating this phase: it is a deliberately scoped signature/hash recheck of a stored Trust Record, documented as exactly that in its OpenAPI spec, its JSON Schema, its dedicated disambiguation page, and both published SDKs — not a bug masquerading as something narrower than its name implies. TD-13's own second recommended option ("correct the route's documented behavior/name to match what it actually does") was independently confirmed already satisfied, by documentation written weeks before this phase and before Phase 2E's assessment. The first recommended option ("wire in the real package") was independently evaluated and found to require a breaking change to a versioned, SDK-typed production API contract — triggering this phase's explicit STOP-and-document instruction rather than a silent implementation change. Regression coverage for the current, confirmed-intentional behavior was strengthened (6 new unit tests closing a gap the Supabase-gated integration test leaves open locally), without touching `verify()`, the runtime, or any security-relevant code path. The remaining architectural question — whether to someday expose `@parmana/replay`'s real semantic re-evaluation through a new, additively-versioned surface — is recorded as a concrete, evidenced recommendation (§5) for a future, separately-scoped phase, not left as an open ambiguity.
