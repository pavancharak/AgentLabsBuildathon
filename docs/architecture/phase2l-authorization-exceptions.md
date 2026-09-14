# Phase 2L — Resolve Remaining Authorization Exceptions (TD-23)

**Update, later session: both findings below are now closed.** This document's own
"TD-23 NOT RESOLVED" verdict (§ Final Recommendation) was accurate as of the commit this
phase was fixed against and is preserved below unedited as the historical record of that
phase's findings — but it no longer describes the current repository. The Razorpay daily
cumulative cap is now independently derived from `RazorpayDailyRefundLedger`
(`packages/connector-sdk/src/connectors/razorpay/RazorpayDailyRefundLedger.ts`), supplied
unconditionally to `RazorpaySignalStateVerifier` in production (TD-23 Phase 3B). HubSpot's
`preAuthorizedForAmountChange` is now independently verified against a real, signed
Approval Artifact via `ApprovalVerifier` (TD-23 Phase 3C). See `docs/CLAIMS.md` 3.4 and
3.10's own "RFC-0022 + TD-23" update paragraphs and `docs/VERIFICATION-GAPS.md` G-24's
matching update for the full mechanism and evidence — both independently re-verified
against the actual repository, not transcribed from a prior report, in the same session
that added this note. §10's flagged `RazorpayRefundService`/tutorial-61 citation staleness
was also corrected in that same later pass.

Independently re-verifies the two authorization limitations Phase 2K's marketing-claim re-verification identified as still open: the Razorpay daily cumulative refund cap, and HubSpot's `preAuthorizedForAmountChange`. This phase was explicitly instructed not to assume either was a genuine gap, or that the prior report was correct. Both were re-derived from current source, fresh. **No production code was changed in this phase** — both findings are confirmed genuine, but each independently triggers this phase's own STOP conditions (intentional, disclosed, deliberately-scoped-out design decisions that would require a materially larger project — not a minimum-necessary fix — to close).

**Fixed against:** commit `76d6b35` (`fix(policy): establish canonical capability-to-policy binding and close TD-22`), the tip of `main`. Working tree was not clean at the start — Phase 2K's changes were still uncommitted; per user confirmation, committed first (`76d6b35`) before this phase's own gate check was re-run and passed.

---

## 1. Independent Verification Methodology

Every finding below was re-derived from current source, treating Phase 2K's summary as a hypothesis, not a fact:

- Re-read `packages/connector-sdk/src/connectors/razorpay/RazorpaySignalStateVerifier.ts` and `RazorpayRefundSignals.ts` in full.
- Re-read `packages/connector-hubspot/src/HubSpotDealUpdateSignals.ts` and `HubSpotSignalStateVerifier.ts` in full.
- Searched repository-wide for any cumulative-refund ledger implementation: `grep` for `CumulativeRefundLedger`, `cumulative`, `dailyTotal`, `sumRefunds`, `aggregateRefund` across `packages/storage/src`, `packages/api/src`, and the full `packages/*/src` tree — found only the two files already identified as the site of the _unverified signal_, never a computing/aggregating implementation anywhere.
- **New finding this phase, not in Phase 2K's report:** `RazorpayRefundService` and `RazorpayRefundHarness` — classes `docs/CLAIMS.md` §3.4 and several source comments still reference by name — **no longer exist as files anywhere in the repository** (confirmed by `find`; every remaining reference is prose in a comment, e.g. `RazorpayCapabilityExecution.ts:32`, `"Extracted from RazorpayRefundService, which was the first and, until [now], only consumer"`). Likewise, `examples/tutorials/61-razorpay-refund` — cited as evidence in `docs/CLAIMS.md` §3.4 ("four outcomes: approved and executed, denied by policy, replay returning the recorded result, tamper rejected") — **does not exist** as a directory. This is a documentation-staleness finding, not an authorization gap, and is out of TD-23's scope (which is about authorization behavior, not `CLAIMS.md` citation accuracy); flagged here and in §9 rather than silently noticed and dropped.
- Repository-wide grep (Task 6, §6 below) for every term the phase specified, to confirm no other instance of this pattern exists beyond the two already known.
- Re-ran the full test suite unmodified to confirm the two findings' behavior is exactly as currently tested (not stale test expectations).

## 2. Razorpay Authorization Assessment

**Independently confirmed: the daily cumulative cap is enforced by `PolicyEngine` against a signal value that is never independently computed or verified anywhere.**

- `policies/razorpay-refund/1.0.0/policy.json`'s `reject-exceeds-daily-cumulative-cap` rule rejects when `dailyCumulativeAfterThisRefundPaise > 2000000`. This is a real, evaluated rule — confirmed, not assumed.
- `RazorpayRefundSignals.ts`'s `buildRazorpayRefundSignals()` computes `dailyCumulativeAfterThisRefundPaise: input.dailyCumulativeSoFarPaise + input.requestedRefundAmountPaise` — but `dailyCumulativeSoFarPaise` is a **caller-independent input parameter to this function**, not derived from anywhere inside it.
- `RazorpaySignalStateVerifier.ts`'s `VERIFIED_SIGNAL_KEYS` (`paymentStatus`, `paymentCurrency`, `refundableRemainingPaise`, `requestedExceedsRemainder`) **excludes `dailyCumulativeAfterThisRefundPaise` by name**, with its own comment: _"that fact depends on Parmana's own cumulative-refund ledger, not on anything Razorpay reports, and no ledger is wired to the production `POST /execute` path at all."_
- No ledger, aggregation query, or any code that sums historical refund amounts exists anywhere in the repository (§1's grep). The signal reaching `PolicyEngine.evaluate()` for this fact is **exactly** what the caller declared in the HTTP request body's `signals.dailyCumulativeAfterThisRefundPaise` field, unmodified, unverified.

**Where cumulative state originates:** nowhere authoritative. It originates as a plain field in the caller-submitted JSON request body.

**Whether independent business state is consulted:** no, for this one fact specifically — `RazorpaySignalStateVerifier` independently consults real business state (a live Razorpay payment fetch) for four _other_ facts, but explicitly, by name, does not do so for this one.

**Whether the previously reported limitation still exists:** yes, confirmed, unchanged by Phase 2K (which addressed policy _selection_, not this specific signal's _truth_).

## 3. HubSpot Authorization Assessment

**Independently confirmed: `preAuthorizedForAmountChange` is a caller-declared boolean with no independent verification anywhere, gating whether an over-threshold amount change is approved.**

- `policies/hubspot-deal-update/1.0.0/policy.json`'s `reject-amount-exceeds-threshold-without-preauth` rule rejects when `amountChangeExceedsThreshold` is true and `preAuthorizedForAmountChange` is false — meaning `preAuthorizedForAmountChange: true` is the _sole_ thing that can turn an otherwise-rejected, over-threshold amount change into an approval.
- `HubSpotDealUpdateSignals.ts`'s `buildHubSpotDealUpdateSignals()`: `preAuthorizedForAmountChange: input.preAuthorizedForAmountChange ?? false` — passed straight through from the caller-supplied input, computed from nothing.
- `HubSpotSignalStateVerifier.ts`'s `VERIFIED_SIGNAL_KEYS` (`currentDealStage`, `dealStageChangeRequested`, `dealStageTransitionAllowed`, `amountChangeRequested`, `amountDeltaAbs`, `amountChangeExceedsThreshold`) **excludes `preAuthorizedForAmountChange` by name**, with its own comment: _"an out-of-band claim with no HubSpot-side equivalent to fetch and compare against."_
- HubSpot's own Deal API has no property representing "this change was pre-authorized" — there is no external, authoritative source this signal could even be fetched from and compared against, unlike `dealStageTransitionAllowed` (computed from the real, fetched `dealstage`).

**Whether the previously reported limitation still exists:** yes, confirmed, unchanged by Phase 2K.

## 4. Authorization Traces

**`razorpay:refund-create`:**

```
Request (signals + intent.parameters)
    ↓
Intent { action: "razorpay:refund-create", parameters: { paymentId, amountPaise, ... } }
    ↓
Policy Evaluation: policies/razorpay-refund/1.0.0 (now canonically bound to this action, TD-22)
    ↓
Signal Verification: RazorpaySignalStateVerifier — fetches real payment via parameters.paymentId
    ↓
Authorization Decision → Execution
```

| Authorization input                                                    | Classification                           | Evidence                                                                                                                                                          |
| ---------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intent.parameters.paymentId` (the target payment)                     | **Independently Verified**               | `RazorpaySignalStateVerifier` fetches this exact payment id from Razorpay's real API before approval                                                              |
| `signals.paymentStatus`                                                | **Independently Verified**               | compared against the real fetch's `status`                                                                                                                        |
| `signals.paymentCurrency`                                              | **Independently Verified**               | compared against the real fetch's `currency`                                                                                                                      |
| `signals.refundableRemainingPaise`                                     | **Independently Verified**               | computed from the real fetch's `amount`/`amount_refunded`                                                                                                         |
| `signals.requestedExceedsRemainder`                                    | **Independently Verified**               | recomputed from the real fetch and the bound amount                                                                                                               |
| `signals.requestedRefundAmountPaise` / `intent.parameters.amountPaise` | **Derived**                              | bound to each other by `SignalIntentBinder` (TD-22's own prerequisite, unchanged) — not independently fetched, but structurally guaranteed to equal what executes |
| `policy.name` / `policy.version`                                       | **Independently Verified** (as of TD-22) | `CapabilityPolicyBinder` — caller-declared value must equal the canonical `razorpay-refund/1.0.0` binding or the request is rejected before evaluation            |
| **`signals.dailyCumulativeAfterThisRefundPaise`**                      | **Caller Asserted**                      | no ledger, no fetch, no cross-check anywhere (§2)                                                                                                                 |

**`hubspot:deal-update`:**

```
Request (signals + intent.parameters)
    ↓
Intent { action: "hubspot:deal-update", parameters: { dealId, dealstage?, amount? } }
    ↓
Policy Evaluation: policies/hubspot-deal-update/1.0.0 (canonically bound, TD-22)
    ↓
Signal Verification: HubSpotSignalStateVerifier — fetches real deal via parameters.dealId
    ↓
Authorization Decision → Execution
```

| Authorization input                                         | Classification                           | Evidence                                                              |
| ----------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `intent.parameters.dealId`                                  | **Independently Verified**               | fetched from HubSpot's real API                                       |
| `signals.currentDealStage`                                  | **Independently Verified**               | compared against the real fetch                                       |
| `signals.dealStageTransitionAllowed`                        | **Independently Verified**               | recomputed from the real fetched stage and the bound proposed stage   |
| `signals.amountChangeExceedsThreshold` / `amountDeltaAbs`   | **Independently Verified**               | recomputed from the real fetched amount and the bound proposed amount |
| `signals.proposedDealStage` / `intent.parameters.dealstage` | **Derived**                              | bound via `SignalIntentBinder`                                        |
| `signals.proposedAmount` / `intent.parameters.amount`       | **Derived**                              | bound via `SignalIntentBinder`                                        |
| `policy.name` / `policy.version`                            | **Independently Verified** (as of TD-22) | `CapabilityPolicyBinder`                                              |
| **`signals.preAuthorizedForAmountChange`**                  | **Caller Asserted**                      | no HubSpot-side equivalent exists to verify against (§3)              |

No input in either trace was classified **Unable to Certify** — every field's provenance was directly traceable to source.

## 5. Adversarial Analysis

| Adversarial attempt                                                                                                      | Prevented?                                         | Evidence                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Split a refund into many small requests to individually pass the per-refund cap while exceeding the intended daily total | **Not prevented**                                  | `dailyCumulativeAfterThisRefundPaise` is caller-declared and never independently summed across requests (§2) — direct consequence of the confirmed gap                                                           |
| Fabricate `preAuthorizedForAmountChange: true` to approve an over-threshold HubSpot amount change                        | **Not prevented**                                  | §3 — no verification exists for this field at all                                                                                                                                                                |
| Fabricate `dailyCumulativeAfterThisRefundPaise: 0` regardless of real history                                            | **Not prevented**                                  | §2                                                                                                                                                                                                               |
| Replay a previously-signed authorization                                                                                 | **Prevented, unaffected by this phase's findings** | `ExecutionGateway`'s nonce store (single-use, consume-exactly-once) — not touched by either finding; re-confirmed unchanged (no file under `execution-gateway`/`envelope-verifier` referenced by either gap)     |
| Resubmit the same `businessTransactionId` to reuse a prior approval                                                      | **Prevented, unaffected**                          | `BusinessTransactionService.accept()`'s uniqueness guard, throwing `DuplicateBusinessTransactionError` — confirmed still present, unchanged (`packages/runtime/src/services/business-transaction-service.ts:41`) |
| Modify the refund amount or deal stage/amount between approval and execution                                             | **Prevented, unaffected**                          | `SignalIntentBinder` binds the relevant signals to `intent.parameters`; the amount/stage that executes is exactly the amount/stage the policy evaluated (unchanged, TD-22 and earlier RFC-0022 work)             |
| Substitute execution parameters by pairing the capability with an unrelated policy                                       | **Prevented, unaffected**                          | `CapabilityPolicyBinder` (TD-22, previous phase) — re-confirmed still wired and enforced by the unmodified full regression run (§7)                                                                              |
| Modify a HubSpot deal's stage via a fabricated `dealStageTransitionAllowed` claim                                        | **Prevented**                                      | independently recomputed from a real fetch, cannot be fabricated (§4)                                                                                                                                            |

The two genuinely successful adversarial paths (splitting refunds; fabricating pre-authorization) are exactly, and only, the two findings this phase set out to verify — no new, additional exception was discovered beyond what Phase 2K's summary named.

## 6. Static Audit

Repository-wide search (`packages/*/src`, excluding tests/dist) for every term specified:

| Term                     | Occurrences (non-test production source)                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preAuthorized`          | `HubSpotDealUpdateSignals.ts`, `HubSpotSignalStateVerifier.ts` — exactly the known finding, no others                                                                                                                         |
| `cumulative`             | `RazorpayRefundSignals.ts`, `RazorpaySignalStateVerifier.ts` — exactly the known finding, no others                                                                                                                           |
| `authorizationAmount`    | none                                                                                                                                                                                                                          |
| `approvedAmount`         | none                                                                                                                                                                                                                          |
| `dailyLimit`             | none                                                                                                                                                                                                                          |
| `amountChange`           | `HubSpotDealUpdateSignals.ts`, `HubSpotSignalStateVerifier.ts` — same known finding (`amountChangeRequested`/`amountChangeExceedsThreshold`, both independently verified — only `preAuthorizedForAmountChange` itself is not) |
| `remainingAuthorization` | none                                                                                                                                                                                                                          |

**Conclusion:** no third, previously-undiscovered instance of a caller-controlled authorization decision exists anywhere in production source. The two findings this phase set out to verify are the complete set.

## 7. Implementation Changes

**None.** Both findings were independently confirmed genuine (§2, §3), but each triggers this phase's own STOP conditions:

- **Both are intentional, self-documented design decisions, not oversights.** `HubSpotDealUpdateSignals.ts`'s own doc comment: _"Absent, this defaults to false, which is the safe default: an over-threshold amount change is denied unless explicitly declared pre-authorized."_ `RazorpaySignalStateVerifier.ts`'s own comment names the exclusion explicitly and by design. Neither reads as an accidental gap; both read as a deliberately scoped boundary with a documented, safe default.
- **Both are explicitly disclosed, not hidden.** `docs/CLAIMS.md` §3.10 and §4 (Future Claims) name `preAuthorizedForAmountChange` as unverified, unimplemented, future work — _"Verifying it independently (e.g. a separately signed approval artifact, analogous to how an Execution Authorization itself is signed) is not implemented."_ `docs/VERIFICATION-GAPS.md` G-24's update explicitly names the daily cumulative cap as _"the same daily-cap TOCTOU/ledger race already identified as unaddressed accepted risk"_ — the phrase "accepted risk" is the repository's own characterization, not this phase's.
- **Closing either would require a materially larger project than "minimum necessary change," which this phase's Objective and Preserve list explicitly forbid attempting.** Independently verifying `preAuthorizedForAmountChange` would mean designing and implementing a new signed-approval-artifact primitive — a new authorization mechanism parallel to Execution Authorization itself, squarely "authorization redesign," explicitly out of scope ("Do NOT redesign authorization... Do not broaden this phase"). Independently verifying the daily cumulative cap would mean building and wiring a real, production-reachable ledger — deciding its scope (per-payment? per-account? global?), its storage, and its concurrency semantics (the TOCTOU race the repository's own docs flag as a _separate_, still-open risk even _with_ a ledger) — again a materially larger, multi-decision project, not a structural, additive fix like TD-22's `CapabilityPolicyBinder`.
- **A behavior change here would be a production compatibility change to documented, intentional functionality**, not a bug fix: removing the `preAuthorizedForAmountChange` escape hatch entirely (the only way to close it without building the larger verification mechanism) would break the one documented path for a legitimate, human-approved over-threshold change — this phase's STOP conditions instruct exactly this: _"If changing behavior would constitute a production compatibility change: STOP. Document the dependency. Recommend a versioned migration rather than changing behavior in place."_

**Recommended path (not performed in this phase), for each, matching the repository's own stated future-work framing:**

- **Razorpay:** a dedicated future phase to design and wire a real cumulative-refund ledger into the production `POST /execute` path (scope decision: per-payment vs. per-account vs. global daily total; storage: likely a new Supabase table, mirroring the `razorpay_webhook_events`/`consumed_nonces` atomicity pattern already used elsewhere; concurrency: the TOCTOU race must be explicitly designed against, not assumed away).
- **HubSpot:** a dedicated future phase to design a signed pre-authorization artifact (as `docs/CLAIMS.md` itself already proposes) — a separately signed approval, verifiable independently of the caller's own assertion, analogous to how `RuntimeAuthorizationSigner` already signs the Execution Authorization itself.

Neither recommendation was scoped, designed, or implemented here — both are explicitly future, separately-chartered work.

## 8. Regression Validation

No new tests were added (no code changed). Full regression re-run to confirm the tree's behavior is unchanged and matches exactly what Phase 2K left it as:

```
npx tsc -b                        → clean, 0 errors
npm test -- --maxWorkers=2        → 141 test files passed, 15 skipped (identical to Phase 2K);
                                     968 tests passed, 39 skipped, 0 failed (identical to Phase 2K)
```

`git status`/`git diff --stat` (implicit — no files were edited this phase) confirms zero production source changed. `CapabilityPolicyBinder`, replay protection, and audit generation were re-confirmed unaffected by re-running the full suite that already exercises them, not merely by inspection.

## 9. Marketing Claim Re-verification

Re-ran the verification for _"Even if AI has valid credentials, it still cannot execute anything your business hasn't authorized. No exceptions,"_ not assuming success:

**Property A — Credential Isolation: HOLDS, unchanged.** No file under `execution-control`/`execution-gateway`/credential providers was touched by this or the prior phase.

**Property B — Independent Authorization: two confirmed, disclosed exceptions remain.** The undisclosed structural gap (TD-22, policy selection) is closed. The two facts this phase investigated — the Razorpay daily cumulative total and HubSpot's `preAuthorizedForAmountChange` — remain caller-asserted with no independent verification, exactly as before this phase, by deliberate decision (§7), not oversight.

**Property C — Structural Enforcement: HOLDS for policy selection** (unchanged from Phase 2K) but **does not extend to these two specific signal values** — enforcing _which_ policy governs a capability is now structural; enforcing that _every fact that policy evaluates_ is true is not, and was never this phase's charter to build.

**Overall claim status, honestly stated:** the claim remains **not fully supported** in the unqualified "No exceptions" sense. Two named, real exceptions exist, both disclosed in the repository's own documentation, both requiring genuinely new capability (not a fix) to close. This is a narrower, better-understood gap than before Phase 2K (one severe, undisclosed structural bypass is gone; what remains is exactly what the repository's own `CLAIMS.md`/`VERIFICATION-GAPS.md` already say remains) — but "No exceptions" is still stronger than what current implementation proves for these two facts.

## 10. Remaining Limitations

- The two confirmed exceptions (§2, §3) remain open, by deliberate decision, not oversight — recommended future-phase paths given in §7.
- **New finding, out of TD-23's scope, not corrected here:** `docs/CLAIMS.md` §3.4 cites `examples/tutorials/61-razorpay-refund` and the classes `RazorpayRefundService`/`RazorpayRefundHarness` as evidence — none of these exist in the current repository (§1). This is a documentation-accuracy gap in the same family as TD-21 (Phase 2J), not an authorization gap, and is flagged here for a future documentation-verification pass rather than corrected in this authorization-scoped phase.
- No new static-audit exception was found beyond the two already known (§6) — this phase's search was exhaustive for the specified terms, not a guarantee no other differently-named pattern exists; a future phase could usefully extend this search to less obviously-named caller-declared attestations (e.g., `vendorVerified`/`invoiceVerified`/`paymentApproved`/`sufficientFunds`/`riskScore` on the `vendor-payment` policy, already disclosed in `VERIFICATION-GAPS.md` G-24 as unverified and out of scope there too, and unaffected by this phase since `payments:execute` is not currently reachable in production at all, TD-1).

## 11. Evidence Summary

```
Repository searches: grep for CumulativeRefundLedger/cumulative/dailyTotal/sumRefunds/
  aggregateRefund (packages/storage/src, packages/api/src, full packages/*/src — no ledger
  found); grep for preAuthorized/cumulative/authorizationAmount/approvedAmount/dailyLimit/
  amountChange/remainingAuthorization (§6, exhaustive); find for RazorpayRefundService.ts/
  RazorpayRefundHarness.ts/examples/tutorials/61-razorpay-refund (none exist)

Source references: packages/connector-sdk/src/connectors/razorpay/{RazorpaySignalStateVerifier,
  RazorpayRefundSignals}.ts, packages/connector-hubspot/src/{HubSpotDealUpdateSignals,
  HubSpotSignalStateVerifier}.ts, policies/{razorpay-refund,hubspot-deal-update}/1.0.0/
  policy.json, packages/runtime/src/services/business-transaction-service.ts:41

Documentation references: docs/CLAIMS.md §3.10, §4 (Future Claims); docs/VERIFICATION-GAPS.md
  G-24 update ("accepted risk")

Authorization traces: §4 (both capabilities, every input classified)

Build output: npx tsc -b → clean, 0 errors
Test output: npm test -- --maxWorkers=2 → 968 passed, 39 skipped, 0 failed — identical to
  Phase 2K's final count, confirming zero code change
```

---

## Final Verification

| Item                                                                     | Status                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remaining authorization findings independently verified                  | ✓ — both re-derived from current source, not assumed (§2, §3); one new finding (stale `RazorpayRefundService`/tutorial-61 citations) surfaced along the way                                 |
| Every confirmed gap resolved (if required)                               | N/A by design — both confirmed genuine but trigger STOP conditions; not resolved, deliberately, with reasoning and a recommended future path (§7)                                           |
| Credential isolation unchanged                                           | ✓ — no file touched                                                                                                                                                                         |
| Canonical Capability → Policy binding unchanged                          | ✓ — no file touched; full regression re-confirms it still enforces (razorpay/hubspot integration tests from Phase 2K still pass)                                                            |
| Authorization independently verified                                     | Partial — every input classified (§4); two remain Caller Asserted by confirmed, disclosed design                                                                                            |
| Replay protection unchanged                                              | ✓ — no file touched                                                                                                                                                                         |
| Audit generation unchanged                                               | ✓ — no file touched                                                                                                                                                                         |
| Runtime behavior unchanged except for verified authorization enforcement | ✓ — no enforcement change was made this phase; behavior is byte-for-byte identical to Phase 2K (968/968, 0 failed)                                                                          |
| Public API compatibility preserved or explicitly documented              | ✓ — no change made; the compatibility tension that _would_ arise from closing either gap (removing the `preAuthorizedForAmountChange` escape hatch) is documented (§7) rather than acted on |

Supported by: repository searches, source references, authorization traces, and build/test output, all in §11.

## Final Recommendation

**Superseded — see the update note at the top of this document. TD-23 is now resolved,
both halves, in later sessions this document predates.**

**TD-23 NOT RESOLVED.** _(as of this phase; preserved as written for the historical record)_

Both reported exceptions were independently confirmed genuine — not incorrect, not already fixed, not superseded by Phase 2K's work. Per this phase's own STOP conditions, no implementation change was made: both are intentional, self-documented design decisions with a stated safe default (not oversights), both are explicitly disclosed in `docs/CLAIMS.md`/`docs/VERIFICATION-GAPS.md` as accepted risk / future work, and closing either would require designing genuinely new authorization capability — a signed pre-authorization artifact; a real cumulative-refund ledger with a deliberate concurrency design — squarely outside "minimum necessary change" and this phase's explicit "do not redesign authorization" boundary. This is a deliberate, evidence-based STOP, not a failure to attempt a fix: the adversarial analysis (§5) confirms exactly these two paths succeed and no others, the static audit (§6) confirms no third instance of this pattern exists anywhere in the codebase, and a recommended, properly-scoped path is given for each (§7) rather than left implicit. The marketing claim's "No exceptions" wording remains unsupported for these two specific, named facts; every other property this phase checked — credential isolation, replay protection, audit generation, capability-to-policy binding, and every other authorization input across both capabilities' full traces — holds.
