# Phase 2D — Restore Execution Failure Integration Testing

Restores TD-15 (`docs/architecture/repository-certification.md` Technical Debt Register, added Phase 2B), the second implementation target Phase 2B's independent reassessment identified after TD-2 (repaired in Phase 2C). This is an implementation phase scoped to one test file — no production source was modified.

**Restored against:** commit `f953d6c` (`ci(architecture): repair terminology guard and close TD-2`), the tip of `main`. Working tree was clean before this phase began.

---

## 1. Original Skipped Rationale

`packages/api/tests/integration/execution-failure.integration.test.ts`'s own comment, verbatim before this phase:

> "This test is intentionally skipped. The current RuntimeFactory always creates a DefaultExecutionSystem internally, making it impossible to inject a failing implementation. This test should be enabled after RuntimeFactory supports dependency injection for ExecutionSystem."

## 2. Independent Verification

Phase 2B's claim ("`RuntimeFactory.create()` now appears to provide the required seam") was treated as an unverified hypothesis, not inherited. Read `packages/runtime/src/RuntimeFactory.ts` directly: `create()`'s signature takes `executionSystem: ExecutionSystem` as a required (non-optional, non-defaulted) constructor argument (`RuntimeFactory.ts:41`) and passes it straight through — it does not construct a `DefaultExecutionSystem`, or any `ExecutionSystem`, internally. **The stated blocker is confirmed gone.**

**A second, more consequential blocker was found that Phase 2B's narrower check did not surface.** The skipped test, as written, does not use `RuntimeFactory`'s DI seam at all — it imports `app` from `../test-app.js`, a module-level singleton that calls the real, production `createExecutionSystem()` (the actual `ExecutionGateway`, wired to real connector resolution). There was never a mechanism in the test's own code for making that shared app's execution system fail; the DI seam being available doesn't help a test that doesn't use it.

**A third issue, independent of both DI questions, was found and confirmed empirically, not by inspection alone.** The test's assertions describe a response shape that does not exist anywhere in the current API:

```ts
expect(response.body.execution.status).toBe("FAILED");
expect(response.body.error).toContain("Execution System");
```

A disposable probe (constructed with `createInspectableExecutionSystem`, run once, deleted immediately — never committed) that submitted a real transaction against a connector executor engineered to throw produced:

```
STATUS: 500
BODY: {"error": "Internal Server Error"}
```

`packages/api/src/middleware/error-handler.ts`'s generic fallback (`error-handler.ts:151-155`) maps any unrecognized thrown error to exactly this shape — by design, so no internal failure detail is ever leaked to a caller (the same "no stack-trace leakage" property `docs/investigations/GAP-AUDIT.md` independently confirmed a month earlier, §7 "What is genuinely solid"). There is no `execution` field in this response at all, and the message will never contain the real error text, "Execution System" or otherwise. The original test's specific assertions could never have passed against this codebase's actual, intentional error-handling design — they describe a response shape that doesn't exist, not one that used to exist and drifted.

## 3. Root Cause

Two independent, compounding problems, neither of which is "the DI seam is missing" (that part, Phase 2B correctly found, is fixed):

1. **The test's harness never exploited the injection capability it needed** — it used the shared, non-configurable `test-app.js` rather than the already-existing `createInspectableExecutionSystem` helper (`packages/api/tests/bootstrap/createInspectableExecutionSystem.ts`, which explicitly supports `options.executor` to "force a downstream failure" — already in use by `credential-isolation.integration.test.ts` for exactly this purpose).
2. **The test's assertions were written against a response contract that either never existed or predates the current centralized error handler**, and nobody revisited them when `error-handler.ts`'s no-leak design was established.

## 4. Restoration Work

`execution-failure.integration.test.ts` rewritten (the `.skip` removed, the harness and assertions replaced; nothing else in the repository touched):

- **Harness:** `createInspectableExecutionSystem({ executor: { async execute() { throw ...; } } })`, matching the pattern `credential-isolation.integration.test.ts` already established — a connector executor that deterministically throws, running through the real `ExecutionGateway` → `ExecutionControlService` → `SessionCredentialSecureConnector` chain, not a mock of the chain itself.
- **Assertions**, all verified against actual, current behavior (not assumed):
  - `response.status === 500`, `response.body` deep-equals `{ error: "Internal Server Error" }` (replacing the two assertions that could never have passed).
  - The real failure message never appears in the response body (a positive assertion of the no-leak property, not just an absence check).
  - The connector executor was called exactly once (proves the failure happened at the intended point, not earlier for an unrelated reason, and that nothing retried or partially executed).
  - `GET /trust-records/:id` → 404, exact body `{ error: "Execution Trust Record not found." }`.
  - `GET /receipt/latest/:id` → 404.
  - `GET /refusal/:id` → 404, exact body `{ error: "Refusal Record not found." }` — proving this failure is _not_ a policy rejection (a materially different, already-well-tested path — see §5), but a genuine post-authorization, downstream execution failure.
  - At least one `execution.rejected` audit event exists (the failure is evidenced, not silently swallowed) — a light cross-check, not a duplicate of `credential-isolation.integration.test.ts`'s own, deeper credential-lifecycle proof for this same failure shape.
- **A second test** added: the same failing setup run three times in a row, each asserting the identical `500` / exact-body result, demonstrating the failure is deterministic (a property of the connector always throwing) rather than something that happened to be observed once.

No assertion from the original test was weakened — the two that could never have passed were replaced with assertions that check the same underlying concern (the caller is told the execution failed) against the real, verified contract, and five additional properties Task 4 required (no partial execution, no Trust Record, no Receipt, not-a-policy-rejection, audit still fires) were added, none of which the original test attempted.

## 5. Failure Integrity Guarantees (Task 1 / Task 5 — coverage inventory)

| Failure path                                                           | Coverage before this phase                                                                                                                                                    | Coverage after this phase                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connector resolution failure (no connector registered — TD-1/Phase 2A) | Unit-tested (`create-connector-registry.test.ts`)                                                                                                                             | Unchanged — out of this phase's scope                                                                                                                                                                                                                                                    |
| **Connector execution failure (executor throws)**                      | Partially tested — `credential-isolation.integration.test.ts` proved the audit/credential-lifecycle angle only; response shape and evidentiary absence were untested anywhere | **Now fully tested** (this phase) — response contract, Trust Record/Receipt/Refusal-Record absence, determinism                                                                                                                                                                          |
| Runtime exception (non-connector, unexpected internal error)           | Untested as a distinct scenario                                                                                                                                               | Still untested as a distinct scenario — shares the same generic-500 handling path as connector execution failure (§2), so the incremental risk is low; not in this phase's scope (the skipped test was specifically about connector/execution-system failure, not internal runtime bugs) |
| Authorization denial (policy REJECT)                                   | Extensively tested (`refusal-record.integration.test.ts`, `execution-authorization-wiring.test.ts`, others)                                                                   | Unchanged                                                                                                                                                                                                                                                                                |
| Signal verification failure                                            | Tested (`hubspot-deal-update.integration.test.ts`, `hubspot-deal-update-policy.test.ts`, `hubspot-deal-update-signals.test.ts`)                                               | Unchanged                                                                                                                                                                                                                                                                                |
| Replay protection failure (nonce reuse)                                | Tested (`execution-gateway.test.ts`, 409 `NonceAlreadyConsumedError`)                                                                                                         | Unchanged                                                                                                                                                                                                                                                                                |

Every failure path this phase's instructions named is covered by at least one test, before and after this phase. The one gap this phase closes is specifically the connector-execution-failure path's HTTP-contract and evidentiary-absence properties — the credential-lifecycle half of that same path was already covered.

## Regression

Independently re-run against the restored tree:

```
npx tsc -b                        → clean, 0 errors
npm run lint                      → clean
npm run typecheck                 → clean
npm test -- --maxWorkers=2        → 138 test files passed (+1 vs. before), 15 skipped (-1);
                                     950 tests passed (+2), 39 skipped (-1), 0 failed
```

The restored file's own tests, run in isolation with verbose output, both pass: `marks execution as failed, with no fabricated success and no evidentiary artifacts, when the connector executor throws` and `fails deterministically across repeated attempts against the same failing connector (not flaky)`.

`git diff --stat -- packages/*/src/` is empty — no production source file was modified; the only change in the repository is to `packages/api/tests/integration/execution-failure.integration.test.ts` itself.

## 6. Remaining Limitations

- **"Runtime exception" (a non-connector, genuinely unexpected internal error) remains untested as its own scenario.** It shares the exact same generic-500 error-handling code path as the connector-failure case this phase now covers, so the marginal risk is low, but no test deliberately triggers an internal `RuntimeEngine`-level throw unrelated to a connector. Out of this phase's scope (the skipped test was never about this case); worth a future, separate, narrowly-scoped addition if judged valuable.
- **Two stray debug `console.log` statements were observed, incidentally, in production source** during this phase's empirical verification (`packages/api/src/routes/execute.ts`: `"[ROUTE] before execute"` / `"[ROUTE] after execute"`; `packages/runtime/src/ExecutionTrustApplication.ts`: `"[APP] ..."` at what appear to be the accept/runtime stages). Neither affects correctness or the properties this phase verifies, and per this phase's explicit no-production-changes mandate, **neither was touched**. Flagged here for visibility as an unrelated, minor cleanup opportunity, not addressed in this phase.
- **The credential-lifecycle proof for this failure shape lives in a separate file** (`credential-isolation.integration.test.ts`) from the response-contract/evidentiary-absence proof this phase added (`execution-failure.integration.test.ts`). This is a deliberate choice to avoid duplicating an already-thorough, already-passing test, not an oversight — but it does mean the full picture of "what happens on a connector execution failure" requires reading both files together.

---

## Final Verification

| Item                                                  | Status                                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skipped integration test restored                     | ✓ — `.skip` removed, both tests pass                                                                                                                                            |
| Original blocker independently disproven or confirmed | ✓ — disproven (DI seam confirmed present, §2); a second, more consequential blocker (stale assertions, unused DI capability) was found and independently fixed in the same pass |
| Failure integrity verified                            | ✓ — via assertions, not exception-presence alone (§4, §5)                                                                                                                       |
| Deterministic failures preserved                      | ✓ — dedicated repeated-attempt test added                                                                                                                                       |
| Runtime behavior unchanged                            | ✓ — zero files under `packages/*/src` modified                                                                                                                                  |
| Security behavior unchanged                           | ✓ — no-leak error-handling behavior independently confirmed, not altered                                                                                                        |
| No production behavior changed                        | ✓ — `git diff --stat -- packages/*/src/` empty                                                                                                                                  |

## Final Recommendation

**TD-15 CLOSED.**

The skipped test is restored, executes successfully, and now verifies more than its original scope: the exact HTTP response contract for a connector execution failure (empirically confirmed, not assumed), the complete absence of Trust Record/Receipt/Refusal Record evidence, exactly-once connector invocation (no partial execution), continued audit-trail evidence, and determinism across repeated attempts — all via real assertions against a real request/response cycle, not by checking that an exception was thrown. The original blocker (no DI seam) is confirmed resolved; the additional blocker this phase found (the test never used the seam, and its assertions never matched any real response shape) is fixed in the same change. No production source was modified, and the full regression suite (950 passed, 39 skipped, 0 failed) is clean.
