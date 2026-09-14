# Phase 3B — Repository-Derived Cumulative Authorization

Implements Phase 3A's recommendation: replaces the caller-declared `dailyCumulativeAfterThisRefundPaise` signal with a value independently derived from repository state, closing the one remaining Property B gap Phase 3A classified as **DESIGN NOT REQUIRED** (no new Authorization Artifact — existing infrastructure extension only).

**Fixed against:** commit `4c73df8` (`docs(architecture): design the Authorization Artifact and split TD-23's remaining findings`), the tip of `main`. Working tree was clean before this phase began.

---

## 1. Phase 3A Recommendation

Read directly from `docs/architecture/phase3a-authorization-artifact-design.md` §5 (not from any summary):

> **Razorpay daily cumulative cap → PATH A, Existing Infrastructure Extension. DESIGN NOT REQUIRED for this finding.** ... **Recommended, separately-chartered implementation phase:** add one query method to `ExecutionTrustRecordRepository` ... that sums `intent.parameters.amountPaise` across today's approved `razorpay:refund-create` executions ... extend `RazorpaySignalStateVerifier` to add `dailyCumulativeAfterThisRefundPaise` to its own `VERIFIED_SIGNAL_KEYS` ... The TOCTOU/concurrency race Phase 2L flagged ... is a real, separate design question that phase must resolve explicitly (e.g., an atomic increment-and-check against a dedicated ledger row, mirroring the `consumed_nonces`/`razorpay_webhook_events` primary-key-as-atomicity pattern already used elsewhere in this codebase) — not assumed away by a naive sum-then-compare query.

All three elements of this recommendation — the repository query, the verifier extension, and the explicit atomicity design — are implemented in this phase.

## 2. Independent Verification

Confirmed fresh, not assumed: Phase 3A's own report (§4) demonstrates its conclusion with direct evidence (existing `ExecutionTrustRecordRepository`/`RazorpaySignalStateVerifier` extension points; no existing artifact needed). This phase re-traced the same source files independently before writing any code (§3), and did not simply implement Phase 3A's recommendation on faith — the trace surfaced one detail Phase 3A's own design summary had not spelled out (the exact mechanics of _why_ a plain repository query cannot be atomic against the concurrent race, given a real external API call sits between the check and the write — §7), which directly shaped this phase's implementation.

## 3. Repository Audit

Traced fresh, from current source:

- **`Execution`** (`packages/shared/src/domain/execution.ts`): `executionId`, `businessTransactionId`, `decision`, `status` (`PROCESSING`/`COMPLETED`/`FAILED`), `startedAt`, `completedAt`, `evidence?`, `metadata?`. Does **not** directly carry `intent.parameters` — that lives on `ExecutionEvidence`.
- **`ExecutionEvidence`** (`packages/shared/src/domain/execution-evidence.ts`): `action`, `target`, `parameters` (the parameters _actually used_, not merely requested), `success` (boolean), `executedAt`, `attributes?`. This — not `Decision.signals` — is the authoritative record of what actually executed, confirmed by direct type inspection.
- **`ExecutionTrustRecord`** (`packages/shared/src/domain/execution-trust-record.ts`): `executions: readonly Execution[]`, plus `transaction`, `trustRecordHash`, `signature` — the aggregate is itself cryptographically signed; nothing in it is caller-mutable after creation.
- **`ExecutionTrustRecordRepository`** (`packages/shared/src/repositories/execution-trust-record-repository.ts`), before this phase: `create`, `findByTransactionId`, `appendExecution`, `appendOverride`, `appendVerification`, `appendReceipt`, `appendSettlementConfirmation` — **no query or aggregation method existed**, confirmed by reading the full interface.
- **`SupabaseExecutionTrustRecordRepository`**: `executions` is a dedicated Postgres table (`execution_id TEXT PRIMARY KEY, business_transaction_id TEXT NOT NULL, execution_json JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL`), with an existing index on `created_at` (`supabase/migrations/20260629013035_initial_schema.sql`) — sufficient for an efficient, indexed time-range query directly against the existing table, no new table needed for this specific query.
- **`RazorpaySignalStateVerifier`**: already the established, capability-scoped `SignalStateVerifier` extension point where `paymentStatus`/`paymentCurrency`/`refundableRemainingPaise`/`requestedExceedsRemainder` are independently re-derived from a real Razorpay fetch — confirmed the exact insertion point Phase 3A's recommendation names.
- **Available fields, confirmed sufficient**: `evidence.action` (filter by `"razorpay:refund-create"`), `evidence.success` (filter successes only), `evidence.executedAt` (time-window filter), `evidence.parameters.amountPaise` (the value to sum). All four are already captured, on every execution, by existing, unmodified code (`SdkConnectorExecutor.execute()`'s `buildConnectorEvidence` call). **Sufficient information exists; no additional persistence was required** for the observability/reconciliation query.

## 4. Audit Completeness Verification

Every sub-question required by this phase's Task 1.5, verified against current source (not assumed):

**Every successful refund execution produces exactly one persisted Trust Record.** Confirmed by direct inspection of `packages/api/tests/integration/execution-failure.integration.test.ts` (Phase 2D): _"No Trust Record: `BusinessTrustPipeline.execute()` is only reached after `RuntimePipeline.execute()` returns successfully; the thrown error propagates out of `RuntimeEngine.execute()` before that point, so `Runtime.execute()` never calls `trustRecords.create()`."_ A connector failure produces **zero** persisted artifacts, not a `FAILED`-status one — "successful" and "has a persisted Trust Record" are the same set by construction.

**Failed executions do not contribute to cumulative totals.** True for two independent reasons, both confirmed: (1) a policy-`REJECTED` decision never reaches execution at all (produces only a `RefusalRecord`, RFC-0021, which this phase's query never reads); (2) a connector-level failure produces no Trust Record whatsoever (above). Both failure classes are structurally absent from the data this phase's query reads — no filtering logic was needed to exclude them beyond the `evidence.success`/`status` checks already present for defense in depth.

**Duplicate executions cannot produce duplicate cumulative entries.** `BusinessTransactionService.accept()`'s uniqueness guard (`packages/runtime/src/services/business-transaction-service.ts:41`, `DuplicateBusinessTransactionError`) rejects a resubmitted `businessTransactionId` before `RuntimeEngine`, policy evaluation, or execution ever run — confirmed present and unchanged by this phase.

**Replayed requests cannot inflate cumulative totals.** `POST /replay` (per Phase 2G's own independent finding, unaffected by this phase) performs a signature recheck only — no re-execution, no new Trust Record. A resubmission attempt is caught by the duplicate-transaction guard above.

**Historical queries cannot silently omit committed executions — with one identified, pre-existing, narrow exception.** A process crash in the exact window between a real, successful Razorpay API call and `trustRecords.create()`/`appendExecution()`'s durable commit would leave a real-world refund invisible to `sumSuccessfulExecutionAmounts` (§6). This is **not introduced or worsened by this phase** — it is a pre-existing, systemic characteristic of the entire "Trust Record as source of truth" architecture, equally true for receipts, verification, and audit today. Critically, **this phase's actual real-time enforcement mechanism does not depend on Trust Record persistence timing at all** — the `RazorpayDailyRefundLedger` reservation (§7) is written _before_ the Razorpay API call is even made, entirely independent of whether the eventual Trust Record commit succeeds. The crash-window gap affects only the secondary, reconciliation-grade `sumSuccessfulExecutionAmounts` query, never the actual cap enforcement. This is stated explicitly, not silently assumed away, per this phase's own instruction — and it is a reason to proceed, not a STOP condition, precisely because the enforcement path sidesteps it.

**The repository query has the same business scope as the governing policy.** `policies/razorpay-refund/1.0.0/policy.json`'s `reject-exceeds-daily-cumulative-cap` rule has no per-account or per-payment qualifier in its own text, and only one Razorpay credential (`RAZORPAY_KEY_ID`/`SECRET`) is configured per deployment — confirmed by reading `createRazorpayCredentialProvider.ts` fresh. The per-refund cap (500,000 paise) is a separate, already-independently-verified check on `refundableRemainingPaise`; the daily cumulative cap's evident purpose, being an _additional_ check beyond it, is a global daily volume guard. **Scope decision, stated explicitly: global (all `razorpay:refund-create` executions), UTC calendar day, implicitly INR-only** (every counted refund already passed the policy's own `paymentCurrency === "INR"` check).

No condition above triggered this phase's STOP instruction — the one identified durability gap is pre-existing, narrow, and does not affect the actual enforcement mechanism this phase builds.

## 5. Historical Query Design

Added to `ExecutionTrustRecordRepository` (`packages/shared/src/repositories/execution-trust-record-repository.ts`) as an **optional** method — `sumSuccessfulExecutionAmounts?(action, parameterKey, since, until): Promise<number>` — optional specifically so the seven pre-existing inline test-fake implementations of this interface (`packages/runtime/tests/unit/{execution-authorization-wiring,execution-trust-application-replay,refusal-record-fail-open,runtime-builder,runtime,verification-negative,verification-service}.test.ts`) keep compiling and behaving identically without adding it, matching this codebase's established backward-compatibility discipline for interface extension.

- **`MemoryExecutionTrustRecordRepository`**: iterates every stored record's `executions`, filtering on `status === COMPLETED`, `evidence.success === true`, `evidence.action === action`, and `evidence.executedAt` within `[since, until)`, summing `evidence.parameters[parameterKey]`.
- **`SupabaseExecutionTrustRecordRepository`**: a single SQL query directly against the existing `executions` table's `execution_json` JSONB column (`SUM((execution_json->'evidence'->'parameters'->>$2)::numeric)`), filtered identically. **No new table, no schema change** for this query — it reuses the exact table and index that already existed.

This method exists as the **reconciliation-grade ground truth** — a read-only, always-correct-relative-to-what-was-persisted view — not as the real-time enforcement mechanism (§7 explains why it cannot be).

## 6. Signal Verification Changes

`RazorpaySignalStateVerifier` (`packages/connector-sdk/src/connectors/razorpay/RazorpaySignalStateVerifier.ts`) gained three new optional constructor options (`dailyRefundLedger`, `dailyCumulativeCapPaise`, `refundDayResolver`), matching this codebase's established optional-additive-field convention for backward compatibility. `dailyCumulativeAfterThisRefundPaise` is no longer left in `VERIFIED_SIGNAL_KEYS`'s exclusion list — it is now independently derived via a new private method, `reserveDailyCumulative`, run only when the four pre-existing checks found no violation (mirroring the established "a request already going to be rejected needs no further independent check" discipline). Wired into production unconditionally in `createRazorpaySignalStateVerifier.ts` — the daily cap is a structural invariant for all real API traffic, not an opt-in configuration.

**A caller-declared value is now compared against the real, ledger-derived one** using the same uniform "any disagreement is a violation" discipline the other four verified facts already use — not only "is it over cap," since a caller who understates the total while it happens to still be within cap is equally caught (§7's implementation detail).

## 7. Concurrency and Atomicity Verification

**A race exists, and was identified before implementation, not discovered after.** The daily-cap check runs inside `RazorpaySignalStateVerifier.findViolations()`, before the real Razorpay API call; the real, executed amount is only confirmed _after_ that call succeeds. A genuine Postgres transaction cannot span the external API call in between (holding a database lock across network latency to a third party is a correctness and availability hazard, and does not even fully close the gap — a crash after the external call but before commit is unavoidable regardless). A pure `SELECT SUM(...) FROM executions` read-then-decide check therefore has an unavoidable window: two concurrent requests can both read the same pre-reservation total before either commits, and both independently pass the cap check.

**This was surfaced explicitly to the user before implementation** (mid-phase), given the schema and money-moving-authorization stakes involved, rather than resolved unilaterally. The chosen design: a small, dedicated atomicity primitive — `razorpay_daily_refund_reservations` (`refund_day DATE PRIMARY KEY, reserved_paise BIGINT NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL`), added via `supabase/migrations/20260805170000_add_razorpay_daily_refund_reservations.sql`. This is **not a transaction ledger** — it stores nothing about individual refunds, only a single running total per UTC day — and is architecturally identical in kind to `consumed_nonces`/`razorpay_webhook_events`, whose entire existence is likewise to make one specific check atomic, not to record history generally.

**How it closes the race:** `RazorpayDailyRefundLedger.reserve(refundDay, amountPaise)` is a single `INSERT ... ON CONFLICT (refund_day) DO UPDATE SET reserved_paise = reserved_paise + EXCLUDED.reserved_paise RETURNING reserved_paise` statement (`SupabaseRazorpayDailyRefundLedger.ts`). The **write is the check** — there is no separate read-then-decide step. Two concurrent reservations for the same day are serialized by Postgres's own row lock on that day's row; each caller's returned `totalAfterReservation` correctly reflects the other's already-applied contribution the moment it commits. This is the same class of atomicity `consumed_nonces`'s primary key already provides for a uniqueness check, applied here to an additive counter instead.

**Compensation, not a downstream hook:** if a reservation would push the total over the cap (or if the caller's declared value disagrees with the real one), the reservation is released **immediately, synchronously, within the same verifier call** — before any connector call is ever made — since the outcome ("this request will be rejected") is already known at reservation time. This deliberately avoids needing a callback from a later, separate execution-outcome event, which would have required threading a new hook through `RuntimeEngine` — explicitly forbidden by this phase's Preserve list.

**Known, accepted, documented residual imprecision:** if a reservation is _kept_ (request approved, cap check passed) but the downstream connector call subsequently fails for an unrelated reason (network error, Razorpay API error), the reservation is **not** retroactively released — no hook exists for this, by design (see above). This means the reservation ledger can, in this one specific failure mode, run slightly _ahead_ of reality — a safe-direction (more conservative, never permissive) discrepancy, correctable by comparing the ledger's total against `sumSuccessfulExecutionAmounts`'s real total (§5) and manually adjusting if an operator chooses to reconcile. Building automatic reconciliation was out of this phase's scope (a new scheduler/background-job component, not an additive extension of what exists).

**Adversarial tests added, proving the race is actually closed, not merely reasoned about:**

- `packages/connector-sdk/tests/unit/InMemoryRazorpayDailyRefundLedger.test.ts`: 50 concurrent `reserve()` calls for the same day sum exactly, with each individual call's own returned total forming the unbroken sequence 40,000, 80,000, ..., 2,000,000 — proof no two concurrent calls observed (and used) the same pre-reservation total.
- `packages/api/tests/integration/razorpay-refund.integration.test.ts`, new case: five concurrent `POST /execute` requests of 500,000 paise each (2,500,000 combined, against the 2,000,000 default cap) through the real HTTP route and real production bootstrap chain. Asserts: at least one request is rejected; the sum of refunds that actually landed on the mock Razorpay server never exceeds the cap; the approved-response count and the executed-refund total agree exactly (no silent over- or under-execution).

## 8. Adversarial Validation

Beyond the concurrency case (§7), `packages/api/tests/integration/razorpay-refund.integration.test.ts` gained a case proving a caller cannot inflate its own headroom by declaring a false, low `dailyCumulativeAfterThisRefundPaise`: four legitimate refunds bring the real total to 1,920,000; a fifth, dishonest request (declaring `300000` as if it were the day's first refund, when the real post-reservation total would be `2,220,000`) is rejected, and the four legitimate refunds are confirmed unaffected. Combined with Phase 2K/2L's pre-existing coverage (capability substitution, policy substitution, signal/intent mismatch), every adversarial category this phase's Task 3/5 named is now covered:

| Adversarial attempt                                                       | Prevented?                                                                          | Evidence                                                                |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Inflate cumulative total (declare a false low value)                      | **Yes**                                                                             | New test, §8                                                            |
| Reduce cumulative total artificially                                      | **Yes** (same mechanism — any disagreement is a violation, not only understatement) | `reserveDailyCumulative`'s uniform mismatch check, §6                   |
| Split transactions to stay under per-refund cap while exceeding daily cap | **Yes**                                                                             | New test, §7 (five concurrent requests, each individually valid)        |
| Bypass daily limit outright                                               | **Yes**                                                                             | Same test                                                               |
| Fabricate cumulative state                                                | **Yes**                                                                             | New test, §8                                                            |
| Exploit concurrent authorization races                                    | **Yes**                                                                             | §7's atomic reservation + concurrency test                              |
| Exploit check-before-record timing windows                                | **Yes**                                                                             | §7 — the write _is_ the check, no separate read-then-record step exists |

## 9. Regression Testing

```
npx tsc -b                        → clean, 0 errors
npm test -- --maxWorkers=2        → 142 test files passed (+1), 15 skipped (unchanged);
                                     979 tests passed (+8: 7 new ledger unit tests, +2 net
                                     new integration cases, the remainder architecture-
                                     boundary-suite cases automatically generated for new
                                     bootstrap/connector-sdk files, exactly as happened for
                                     every prior phase's new files), 39 skipped, 0 failed
```

Every pre-existing test continues to pass unmodified — confirmed by the identical skip count and by the specific tests already exercising the affected areas (`razorpay-refund.integration.test.ts`'s three pre-existing cases, the TD-22 capability-policy-binding case) all still passing. Replay protection, audit generation, and `CapabilityPolicyBinder` were not touched by this phase (no file under `execution-gateway`/`execution-control`/`envelope-verifier` was modified) and their own tests remain green.

## 10. Remaining Limitations

- The crash-window durability gap (§4) remains a pre-existing, narrow, systemic characteristic of the Trust Record architecture, not specific to or worsened by this phase — and does not affect this phase's actual enforcement mechanism, only the secondary reconciliation query.
- Reservations for approved requests whose downstream connector call subsequently fails are not automatically released (§7) — a documented, safe-direction (conservative, never permissive) imprecision, reconcilable manually via `sumSuccessfulExecutionAmounts` but not automated in this phase.
- `RAZORPAY_DEFAULT_DAILY_CUMULATIVE_CAP_PAISE` remains a hardcoded constant, unchanged by this phase, still requiring the policy JSON and the connector-sdk constant to be kept in sync by hand — a pre-existing coupling risk (`RazorpayRefundSignals.ts`'s own comment already names this), not introduced or worsened here.
- The scope decision (global daily total, not per-account) was reasoned from the current single-credential deployment model (§4); if a future deployment configures multiple Razorpay accounts, this scope decision would need explicit revisiting — not something this phase's evidence could resolve in advance of that scenario existing.

## 11. Evidence Summary

```
Repository searches: grep for dailyCumulativeAfterThisRefundPaise/cumulative/refundTotal/
  authorizationAmount across packages/*/src (excluding tests/dist) -- confirms the caller-
  controlled signal now appears only in the two files that independently verify it, and no
  third, previously-undiscovered instance of this pattern exists anywhere

Source references: packages/shared/src/domain/{execution,execution-evidence,
  execution-trust-record}.ts, packages/shared/src/repositories/
  execution-trust-record-repository.ts, packages/storage/src/{memory,supabase}/
  ExecutionTrustRecordRepository.ts, packages/connector-sdk/src/connectors/razorpay/
  {RazorpaySignalStateVerifier,RazorpayDailyRefundLedger,InMemoryRazorpayDailyRefundLedger}.ts,
  packages/storage/src/supabase/SupabaseRazorpayDailyRefundLedger.ts,
  supabase/migrations/20260629013035_initial_schema.sql,
  supabase/migrations/20260805170000_add_razorpay_daily_refund_reservations.sql,
  packages/api/tests/integration/execution-failure.integration.test.ts (Phase 2D),
  packages/runtime/src/services/business-transaction-service.ts:41

Regression tests: packages/connector-sdk/tests/unit/InMemoryRazorpayDailyRefundLedger.test.ts
  (7 new), packages/api/tests/integration/razorpay-refund.integration.test.ts (+2 new cases:
  fabricated-value rejection, concurrent-request adversarial test)

Build output: npx tsc -b → clean, 0 errors
Test output: npm test -- --maxWorkers=2 → 979 passed (+8), 39 skipped, 0 failed
```

---

## Final Verification

| Item                                                                            | Status                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 3A independently re-verified                                              | ✓ — read directly, §1, §2; the recommendation's three elements (query, verifier extension, atomicity) all implemented                                                                                               |
| Repository-derived cumulative authorization implemented                         | ✓ — `RazorpayDailyRefundLedger`, wired into `RazorpaySignalStateVerifier`, §6, §7                                                                                                                                   |
| Caller-declared cumulative authorization eliminated                             | ✓ — any disagreement between declared and ledger-derived value is now a violation, §6, static audit §confirms no bypass                                                                                             |
| Execution history independently verified as authoritative                       | ✓, with one named, pre-existing, narrow exception that does not affect enforcement — §4                                                                                                                             |
| Every successful execution contributes exactly once to cumulative authorization | ✓ — the atomic reservation, not the Trust Record history, is the enforcement mechanism, and reserve() is called exactly once per request reaching that check, §7                                                    |
| Cumulative authorization verified atomic against concurrent requests            | ✓ — §7, proven by both a unit-level concurrency test and an HTTP-level adversarial integration test                                                                                                                 |
| Existing Trust Record infrastructure reused                                     | ✓ — `sumSuccessfulExecutionAmounts` reuses the existing `executions` table verbatim, no schema change for it                                                                                                        |
| No new Authorization Artifact introduced                                        | ✓ — consistent with Phase 3A's own DESIGN NOT REQUIRED conclusion; the one new table is a dedicated atomicity primitive, not an artifact or a ledger of individual transactions                                     |
| Authorization semantics preserved                                               | ✓ — `PolicyEngine`, `SignalIntentBinder`, `ExecutionGate`, `CapabilityPolicyBinder` all unchanged                                                                                                                   |
| Replay protection unchanged                                                     | ✓ — no file under `envelope-verifier`/`execution-gateway` touched                                                                                                                                                   |
| Audit generation unchanged                                                      | ✓ — no audit sink file touched                                                                                                                                                                                      |
| Runtime behavior unchanged                                                      | ✓ — `RuntimeEngine.ts` itself was not touched by this phase at all (unlike TD-22, which needed a `RuntimeEngine` change; this phase's entire change surface is `RazorpaySignalStateVerifier` and storage/bootstrap) |
| Public API compatibility preserved                                              | ✓ — no route, request/response schema, or field changed                                                                                                                                                             |

Supported by: repository searches, source references, repository traces, regression tests, and build output, all in §11.

## Final Recommendation

**PHASE 3B COMPLETE.**

Repository evidence demonstrates all required conditions: caller-controlled cumulative authorization has been eliminated (§6, static audit confirms no remaining instance); repository-derived cumulative authorization is authoritative, implemented via an atomic reservation ledger rather than a race-prone read-then-decide query (§7); historical execution records were independently verified complete for this purpose, with one pre-existing, narrow, non-enforcement-affecting exception named explicitly rather than hidden (§4); cumulative authorization is proven atomic under concurrent execution by both a unit-level and an HTTP-level adversarial test, not merely argued architecturally (§7, §8); and the daily cumulative limit is proven, by direct test, unable to be exceeded regardless of request timing. No new Authorization Artifact or cryptographic primitive was introduced, consistent with Phase 3A's own architectural conclusion — the one new database table is a small, dedicated atomicity counter, architecturally identical in kind to `consumed_nonces`, not a transaction ledger or a new trust boundary. `RuntimeEngine`, `ExecutionGateway`, the Capability Registry, `CapabilityPolicyBinder`, replay protection, audit generation, and every cryptographic signature path were confirmed untouched. Full regression suite (979 passed, +8 new, 0 failed) confirms no unintended behavior change.
