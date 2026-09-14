# Phase 2F — Eliminate ExecutionRequestBuilder Content Duplication (TD-9)

Closes TD-9 (`docs/architecture/repository-certification.md`, Technical Debt Register), the item Phase 2E's independent reassessment recommended as the next implementation target. This is an implementation phase scoped to one class and its test coverage — no architectural or runtime redesign, no production behavior change.

**Fixed against:** commit `7a309b3` (`docs(architecture): reassess engineering technical debt after Phase 2D`), the tip of `main`. Working tree was clean before this phase began.

---

## 1. Original Duplication

`packages/runtime/src/ExecutionRequestBuilder.ts`, before this phase, manually re-listed the same four fields `toExecutableContent()` (`packages/shared/src/domain/executable-content.ts`) already derives:

```ts
return {
  businessTransactionId: transaction.businessTransactionId,
  action: transaction.intent.action,
  target: transaction.intent.target,
  parameters: transaction.intent.parameters,
  authorization,
};
```

## 2. Independent Verification

Treated Phase 2E's finding as a hypothesis, not a fact. Read both files directly rather than trusting the prior report's summary ("no drift today, both derive identical values").

**The duplication was confirmed still present** — exactly as described. But independent verification also found the prior framing incomplete: **the two paths had already diverged in behavior, not just in code shape.** `toExecutableContent()` does two things beyond field selection that the manual code did not:

1. **Validates** `target` is a non-empty string, throwing `"ExecutableContent.target must be a non-empty string."` if not.
2. **Freezes** the returned object and produces a **fresh copy** of `parameters` (`Object.freeze({ ...input.parameters })`) rather than passing the original object through by reference.

Per this phase's own instruction ("If any difference exists: STOP. Document it before changing code"), both differences were traced to their actual runtime consequence before any code was touched:

- **Validation:** `RuntimeEngine.execute()` already calls `toExecutableContent()` with the exact same `businessTransactionId`/`action`/`target`/`parameters` values (`RuntimeEngine.ts:326-332`, sourced from `transaction.businessTransactionId`/`transaction.intent.*`) _before_ `ExecutionComponent`/`ExecutionRequestBuilder` ever run — and `context.transaction` (what reaches `ExecutionRequestBuilder.build()`) is a shallow copy that never reassigns `intent` (confirmed: `RuntimeEngine.ts:380-385` only overrides `status`; `TrustChainValidationComponent` and `RuntimePipeline` were both confirmed, via direct grep, to never reassign `context.transaction`). **Any transaction that reaches `ExecutionRequestBuilder` has therefore already passed this exact validation, on these exact values, moments earlier in the same request.** Adding the same check a second time cannot newly reject anything that previously succeeded.
- **Freezing/copying:** confirmed no downstream code mutates `.parameters` on an `ExecutionRequest` (`grep` for `.parameters =` / `.parameters[` across `runtime`, `execution-gateway`, `execution-control`, `connector-sdk`, `connector-hubspot` — zero matches) and confirmed `ExecutionComponent.execute()` passes the built `request` straight to `this.executionSystem.execute(request)` with nothing in between that could depend on mutating it. Freezing earlier is also consistent with, not a new constraint against, the existing architecture — `ExecutionGateway` already `deepFreeze`s the verified content downstream regardless.

**No consumer was found that intentionally relies on the unfrozen, reference-sharing behavior of the old manual construction.**

## 3. Canonical Helper

`toExecutableContent()` (`packages/shared/src/domain/executable-content.ts`) is the single, pre-existing canonical implementation — unchanged by this phase. It was already the sole implementation `RuntimeEngine.execute()` (`RuntimeEngine.ts:326`) and `ExecutionGateway.verify()` (`ExecutionGateway.ts:149`) used; `ExecutionRequestBuilder` was the one production consumer in `packages/runtime` still bypassing it.

**Task 1 duplication audit — every executable-content-shaped construction site in the repository, classified:**

| Location                                                                                                                                                                                                    | Classification                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/domain/executable-content.ts` (`toExecutableContent`)                                                                                                                                  | **Canonical**                                                                                                                                                                                                                                                               |
| `packages/runtime/src/RuntimeEngine.ts:326`                                                                                                                                                                 | Canonical call site                                                                                                                                                                                                                                                         |
| `packages/execution-gateway/src/ExecutionGateway.ts:149`                                                                                                                                                    | Canonical call site                                                                                                                                                                                                                                                         |
| `packages/runtime/src/ExecutionRequestBuilder.ts`                                                                                                                                                           | **Was Duplicate — fixed this phase**                                                                                                                                                                                                                                        |
| `packages/execution-gateway/src/connector-execution/SdkConnectorExecutor.ts`                                                                                                                                | Legacy/pass-through — forwards already-frozen, already-validated fields into a differently-shaped `ConnectorRequest`/`ExecutionResult`; does not re-derive or re-validate anything, not a duplicate of the same logic                                                       |
| `packages/connector-sdk/src/connectors/razorpay/RazorpaySignalStateVerifier.ts`, `packages/connector-hubspot/src/HubSpotSignalStateVerifier.ts`, `packages/api/src/webhooks/RazorpaySettlementProcessor.ts` | Not applicable — construct _derived_, differently-scoped request content (synthesized `businessTransactionId` suffixes, different `action`/`target` for a state-fetch or settlement-fetch capability), not a re-derivation of the original transaction's executable content |
| **`packages/connector-sdk/src/connectors/razorpay/RazorpayCapabilityExecution.ts` (`executeRazorpayCapability`)**                                                                                           | **Duplicate — same anti-pattern, out of this phase's scope**                                                                                                                                                                                                                |
| **`packages/connector-hubspot/src/HubSpotCapabilityExecution.ts` (`executeHubSpotCapability`)**                                                                                                             | **Duplicate — same anti-pattern, out of this phase's scope**                                                                                                                                                                                                                |

**New finding, not fixed in this phase:** `executeRazorpayCapability`/`executeHubSpotCapability` each reimplement the _same_ freeze-and-copy logic inline (`Object.freeze({ ...content, parameters: Object.freeze({ ...content.parameters }) })`) rather than calling `toExecutableContent()` — and each has an internal inconsistency of its own: the frozen, copied `executableContent` is used only for authorization signing (line ~45-48 in both files), while the actual `gateway.execute(...)` call a few lines later (line ~63-69) uses the raw, unfrozen `content.*` fields directly. This is the identical class of bug TD-9 fixed, in two different files, in a different package boundary (`connector-sdk`/`connector-hubspot`, not `runtime`). **Out of scope for this phase** — Task 3 scoped the fix specifically to `ExecutionRequestBuilder`, and touching these two files would cross into signal-state-verification and Razorpay/HubSpot-refund authorization code this phase's Preserve list and narrow Objective do not cover. Flagged here for a future, separately-scoped phase.

## 4. Migration Performed

`ExecutionRequestBuilder.build()` now delegates entirely:

```ts
return {
  ...toExecutableContent({
    businessTransactionId: transaction.businessTransactionId,
    action: transaction.intent.action,
    target: transaction.intent.target,
    parameters: transaction.intent.parameters,
  }),

  authorization,
};
```

No logic was copied out of `toExecutableContent()` into `ExecutionRequestBuilder`, and no logic was duplicated elsewhere — the helper remains the sole implementation. `ExecutionRequest`'s four shared fields (`businessTransactionId`, `action`, `target`, `parameters`, all `readonly`) are structurally identical to `ExecutableContent`'s (confirmed by reading `packages/execution-system/src/ExecutionRequest.ts` directly), so spreading the helper's return value plus `authorization` produces a valid `ExecutionRequest` with no type-level friction — confirmed by a clean `tsc -b`.

## 5. Regression Protection

`packages/runtime/tests/unit/execution-request-builder.test.ts` (new, 5 tests):

1. **Source-level delegation proof** — asserts the class's own source text contains `toExecutableContent(`, so a future revert to manual field-listing fails this test even if it happened to still produce matching values.
2. **Byte-for-byte equivalence** — builds a request and independently calls `toExecutableContent()` with the same inputs; asserts every shared field matches.
3. **Immutability inheritance** — asserts `request.parameters` is frozen and is a _different object reference_ than `transaction.intent.parameters`. Only genuine delegation produces this; the old manual pass-through could not.
4. **Validation inheritance** — asserts building a request from a transaction with an empty `target` throws the exact `toExecutableContent()` validation error, not silent acceptance.
5. **Lockstep with `RuntimeEngine`'s own derivation** — asserts the builder's output matches what `toExecutableContent()` produces for the same transaction `RuntimeEngine.execute()` would have used to build the signed `ExecutableContent` — directly encoding the property TD-9 existed to protect (what was authorized is exactly what gets executed).

**Mutation-testing validation performed:** reverted `ExecutionRequestBuilder.ts` to its exact pre-Phase-2F content (`git stash`), re-ran the new test file — **3 of 5 tests failed** (delegation-proof, immutability-inheritance, validation-inheritance), exactly the three that depend on genuine delegation rather than coincidental value matching. Restored the fix (`git stash pop`), re-ran — all 5 pass again. This directly satisfies "duplicate mapping cannot silently reappear": if it did, these tests would catch it.

## Static Search Confirmation (Task 5)

Re-searched `packages/runtime/src` for every `businessTransactionId:` occurrence after the fix: `ExecutionRequestBuilder.ts` is now the only one that also constructs `action`/`target`/`parameters` together and delegates to `toExecutableContent()`. Every other match is either a function parameter type declaration or a genuinely different object (`BusinessTrustRecordBuilder`, `ExecutionBuilder`, `ExecutionEvidenceBuilder`, `RefusalRecordBuilder` build differently-shaped records; `RuntimeEngine.ts`'s other three matches build a signal-verification context, an authorization-signing payload referencing the already-built `executableContent`, and an error-log object respectively — none re-derive `ExecutableContent`). **Exactly one production implementation of executable-content construction remains reachable from the runtime package's request-building path.**

## Regression

Independently re-run against the fixed tree:

```
npx tsc -b                        → clean, 0 errors
npm run lint                      → clean
npm run typecheck                 → clean
npm test -- --maxWorkers=2        → 139 test files passed (+1), 15 skipped (unchanged);
                                     955 tests passed (+5), 39 skipped, 0 failed
```

Broader regression scope also independently re-run: the full `packages/runtime` suite (13 files, 37 tests) and the full `packages/api` + `packages/execution-gateway` suites (56 files, 289 tests, 33 correctly skipped) — the latter specifically because `ExecutionGateway.verify()` recomputes and compares a content hash against what was signed, which would be the first place a genuine value divergence (as opposed to a mutability/reference change) would surface as a failure. All clean.

`git diff --stat` confirms exactly two files changed: `packages/runtime/src/ExecutionRequestBuilder.ts` (the fix) and the new test file. No other production source was touched.

## 6. Remaining Limitations

- **Two duplicate sites of the identical anti-pattern remain**, in a different package boundary: `executeRazorpayCapability` (`packages/connector-sdk`) and `executeHubSpotCapability` (`packages/connector-hubspot`) — see §3. Both reimplement `toExecutableContent()`'s freeze-and-copy logic inline instead of calling it, and both have an internal inconsistency where the frozen copy is used for signing but the raw, unfrozen fields are used for the actual gateway call. Not fixed here — out of this phase's explicitly scoped Objective (`ExecutionRequestBuilder` specifically) and touches a different package boundary and authorization-signing code path than this phase's Preserve list covers. Recommended as the natural next candidate for a dedicated, narrowly-scoped follow-up phase.
- **The `ExecutionRequest` object itself remains unfrozen** (only its nested `.parameters` is now frozen, inherited from `toExecutableContent()`) — spreading a frozen object into a new object literal to add the `authorization` field necessarily produces an unfrozen outer object. This is unchanged from before this phase (the old manual construction never froze the outer object either), so it is not a regression, but it means the immutability guarantee this fix adds is partial, not total, for this specific type. Not addressed here, as fully freezing `ExecutionRequest` would be a small scope expansion beyond "delegate to the existing helper" and wasn't reported as a problem by any downstream consumer.

---

## Final Verification

| Item                                                  | Status                                                                                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-9 independently verified                           | ✓ — duplication confirmed present; two additional behavioral differences (validation, freezing) found and traced beyond Phase 2E's original "values match" framing                |
| Duplicate implementation removed                      | ✓ — `ExecutionRequestBuilder.build()` now delegates entirely                                                                                                                      |
| Exactly one executable-content implementation remains | ✓ — confirmed by static search (Task 5); two similar, out-of-scope duplicates in a different package documented, not silently ignored                                             |
| Runtime behavior unchanged                            | ✓ — traced why validation can never newly reject a request that reaches this point, and why freezing/copying `.parameters` has no downstream consumer that depends on mutating it |
| Security behavior unchanged                           | ✓ — no authorization, signal-verification, replay-protection, audit, or credential-handling code touched; `git diff --stat` confirms                                              |
| No production semantics changed                       | ✓ — full regression suite green, including the content-hash comparison in `ExecutionGateway.verify()` that would be the first place a real value divergence would surface         |

## Final Recommendation

**TD-9 CLOSED.**

The duplication is removed, not papered over: `ExecutionRequestBuilder` now has zero independent field-derivation logic and delegates completely to the same helper `RuntimeEngine.execute()` already uses to build the `ExecutableContent` an authorization is signed over — the two paths that were structurally free to diverge can no longer diverge, because there is only one path. Behavioral equivalence was demonstrated, not assumed: two real differences (validation, freeze/copy semantics) were found during independent verification, each traced to its actual runtime consequence and confirmed safe before any code changed, exactly as this phase's instructions required. Regression protection is demonstrated, not just asserted — the new tests were confirmed to actually fail against the prior implementation via mutation testing, not merely written to pass against the new one. Full regression suite (955 passed, 39 correctly skipped, 0 failed) and static search both confirm exactly one production implementation remains in scope for this phase's Objective.
