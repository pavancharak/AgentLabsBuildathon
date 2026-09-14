# Phase 2E — Independent Medium-Priority Engineering Debt Assessment

An independent re-assessment of the repository's remaining engineering-quality technical debt, performed as though by a reviewer with no memory of Phases 2A–2D's own conclusions. Every item Phase 2B previously catalogued is treated as a hypothesis re-checked against current source; historical reports (`repository-certification.md`, `phase2b-technical-debt-assessment.md`, `docs/investigations/GAP-AUDIT.md`) are advisory, not authoritative. This is an assessment only — no production source code was modified; `git status` at the end of this phase is confirmed clean except for the documentation deliverables this phase produces.

**Assessed against:** commit `752be4c` (`test(integration): restore execution failure testing and close TD-15`), the tip of `main`. Working tree was clean before this assessment began.

---

## Precondition Verification

```
git status              → clean
git log --oneline -10:
  752be4c  test(integration): restore execution failure testing and close TD-15   (Phase 2D)
  f953d6c  ci(architecture): repair terminology guard and close TD-2               (Phase 2C)
  17c4b2f  docs(architecture): independently reassess technical debt after Phase 2A (Phase 2B)
  482c474  docs(certification): close TD-1 after operational verification          (Phase 2A.4)
  ...
```

## 1. Repository Health Summary

| Area                 | Status              | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testing              | **Healthy**         | Full suite re-run this phase: 138 test files passed, 15 skipped (all confirmed legitimately environment-gated — Supabase config, live-vendor credentials, ML-DSA-65 runtime support; zero unconditional/stale skips remain, TD-15 was the last one), 950 tests passed, 0 failed                                                                                                                                                                                 |
| Documentation        | **Needs Attention** | Core architecture docs remain accurate; but this phase found the canonical Technical Debt Register (`repository-certification.md`) had silently drifted from reality — TD-2 and TD-15 were both closed in prior phases but the register still showed TD-2 "Open" and never listed TD-15 at all; ten more items (TD-9–TD-14, TD-16–TD-18) existed only in a separate report, never merged. Corrected this phase (§9)                                             |
| Developer Experience | **Needs Attention** | `check-dist-fresh.ts`, fail-closed config errors, and now a repaired CI guard are strong positives; but 9 unconditional debug `console.log` statements sit in the system's single most central method (`ExecutionTrustApplication.execute()`) and its HTTP entry point, newly found this phase (TD-19)                                                                                                                                                          |
| Build                | **Healthy**         | `tsc -b` clean, re-run this phase                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CI                   | **Healthy**         | terminology guard now passes (TD-2 closed, Phase 2C); lint, typecheck, build all clean; TD-3 (no coverage enforcement) remains the one open CI-quality gap                                                                                                                                                                                                                                                                                                      |
| Bootstrap            | **Needs Attention** | The real composition chain (`createExecutionControl.ts`/`createConnectorRegistry.ts`/`createExecutionGateway.ts`) is correct and already extensively verified (Phases 1H, 2A–2D); but a second, entirely dead composition root (`ExecutionControlComposition.ts`, `ConnectorFactory.ts`) still sits alongside it with zero references from anywhere, confirmed still present a month after `GAP-AUDIT.md` first flagged it (TD-20, newly registered this phase) |
| SDK quality          | **Needs Attention** | Python SDK generation confirmed in sync in `GAP-AUDIT.md` and not re-broken; TypeScript client SDK still has 5 of 9 test files as empty stubs (TD-10), unchanged since Phase 2B                                                                                                                                                                                                                                                                                 |

No area is classified **High Risk**.

## 2. Engineering Debt Inventory (Task 1)

Repository-wide sweep, independent of any prior report's own list:

```
TODO|FIXME|XXX|HACK in packages/*/src      → 3 files (all previously known: TD-11, TD-17 x2)
describe.skip|it.skip|test.skip repo-wide  → 24 files, every one individually verified
                                              legitimately conditional (skipIf on Supabase
                                              config / live-vendor credentials / ML-DSA-65
                                              runtime support) — zero unconditional skips
it.todo|test.todo                          → 0 matches anywhere
console.log( in packages/*/src             → 10 matches; 1 legitimate (server.ts startup
                                              banner), 9 debug instrumentation (TD-19, new)
Dead/unreferenced composition roots        → ExecutionControlComposition.ts / ConnectorFactory.ts,
                                              zero references (TD-20, new — matches GAP-AUDIT G-13)
Stale documentation claims                 → docs/CLAIMS.md:835 (TD-21, new registration —
                                              previously verbally flagged in Phase 2A/2A.1
                                              work but never corrected or tracked)
```

## 3. Independent Verification Results (Task 2)

Every item Phase 2B previously catalogued (TD-9–TD-14, TD-16–TD-18) was re-checked against current source, not copied:

| Item                                                 | Verification method                                                                                                | Result                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TD-9 (ExecutionRequestBuilder duplication)           | Read the file directly                                                                                             | **Still Exists**, unchanged                                                                                                                                                                                                                                                                |
| TD-10 (typescript SDK stubs)                         | `wc -l` on all 9 files                                                                                             | **Still Exists**, unchanged (5/9 still 0 lines)                                                                                                                                                                                                                                            |
| TD-11 (ExecutionEvidenceComponent dead no-op)        | `grep -rln` for the class name                                                                                     | **Still Exists**, unchanged                                                                                                                                                                                                                                                                |
| TD-12 (OverrideService/OverrideVerifier unreachable) | `grep -rln` from `packages/api/src`                                                                                | **Still Exists**, unchanged                                                                                                                                                                                                                                                                |
| TD-13 (Replay unreachable from `/replay`)            | Read `routes/replay.ts` **and** `ExecutionTrustApplication.replay()` directly                                      | **Still Exists, but Misclassified in its prior framing** — the route is not missing/orphaned (it returns 200), it implements something materially different (re-verification) than what `@parmana/replay`'s actual machinery or the route's own name imply. Corrected in the register (§9) |
| TD-14 (LedgerSerializer bug)                         | Read the file directly                                                                                             | **Still Exists**, unchanged, confirmed still dead code                                                                                                                                                                                                                                     |
| TD-16 (ReceiptCrypto composition-root bypass)        | Read `ReceiptCrypto.ts`/`SettlementConfirmationCrypto.ts`, confirmed `ReceiptService` still constructs it directly | **Still Exists**, unchanged                                                                                                                                                                                                                                                                |
| TD-17 (misleading bootstrap TODOs)                   | Read both files' TODO comments                                                                                     | **Still Exists**, unchanged                                                                                                                                                                                                                                                                |
| TD-18 (transactions.ts pagination)                   | Read the route's own comment                                                                                       | **Still Exists**, unchanged                                                                                                                                                                                                                                                                |

No item was found **Already Resolved**, **Duplicate**, or **Obsolete** among Phase 2B's list — every one of its still-open items independently re-verified as still present. Two items Phase 2B itself closed (TD-2, TD-15) were confirmed genuinely closed (§ Precondition Verification and Task 9), but had not been reflected in the canonical register — a documentation-currency gap, not a technical one.

## 4. Test Coverage Assessment (Task 3)

Every skipped or placeholder test in the repository, individually classified (no restoration or deletion performed):

| Test file(s)                                                                                                                                                                                                                      | Skip condition                                                            | Classification                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*-live.integration.test.ts` (Razorpay, HubSpot)                                                                                                                                                                                  | `skipIf` on real vendor credentials                                       | **Justified** — correctly excluded from CI (no secrets in CI), by design                                                                                                                                                                                                         |
| `supabase-*.integration.test.ts`, `receipt-negative`, `receipt-signature`, `trust-record-get`, `trust-record-lifecycle`, `verification-negative`, `workflow-negative`, `workflow-supabase`, `transactions-api.test.ts` (13 files) | `skipIf(!databaseConfigured)`                                             | **Justified** — correctly excluded when no real Postgres/Supabase is configured                                                                                                                                                                                                  |
| `dilithium3-*.test.ts` (4 files)                                                                                                                                                                                                  | `skipIf(!isMlDsa65Supported())`                                           | **Justified** — correctly excluded on runtimes without ML-DSA-65 support                                                                                                                                                                                                         |
| `execution-failure.integration.test.ts`                                                                                                                                                                                           | Was unconditional `describe.skip`, stale justification                    | **Already restored** (Phase 2D, TD-15) — no longer skipped, both tests pass                                                                                                                                                                                                      |
| `typescript/test/{HealthApi,ParmanaClient,PolicyApi,ReplayApi,VerificationApi}.test.ts`                                                                                                                                           | Not skipped — empty file bodies (0 lines), collected as "0 tests, passed" | **Should be redesigned** (written) — these aren't placeholders with a skip marker, they're literally empty files; `vitest run` reports them as trivially passing, which is a different and arguably more concealed gap than a `.skip` (no red flag anywhere signals the absence) |

**No unconditional/stale test skip remains anywhere in the repository** — the one that existed was TD-15, closed in the immediately preceding phase. The empty TypeScript SDK stub files (TD-10) are the only remaining placeholder-test-shaped gap, and they were already correctly identified as such by Phase 2B; this phase adds no new instance.

## 5. Bootstrap Assessment (Task 4)

- **The real, live composition chain** (`createExecutionSystem.ts` → `createExecutionGateway.ts` → `createExecutionControl.ts` → `createConnectorRegistry.ts`) was extensively re-verified across Phases 1H and 2A–2D and is not re-litigated here.
- **A second, dead composition root exists and was confirmed still present**: `ExecutionControlComposition.ts` (64 lines) and `ConnectorFactory.ts` (36 lines), zero references from any other file in the repository (`grep -rn` for both class/file names, filtered to exclude self-matches, returns nothing). This exactly matches `docs/investigations/GAP-AUDIT.md`'s G-13 finding from 2026-07-07 ("Two composition roots for Execution Control exist... Reading the wrong one as source of truth risks real confusion for new contributors or auditors") — confirmed still true, unaddressed, and never previously added to the TD-numbered register. Registered this phase as **TD-20**.
- **The one previously-known empty bootstrap file** (`createVendorPaymentSecureConnector.ts`, TD-7) was the only other bootstrap-directory anomaly found; no new empty or broken bootstrap file exists among the 35 files in `packages/api/src/bootstrap/`.

## 6. Documentation Assessment (Task 4)

- **`docs/CLAIMS.md:835`** still describes `create-connector-registry.test.ts` as asserting "vendor-payment remains resolvable when razorpay is not" — accurate before Phase 2A, false since (that exact test was changed by Phase 2A to assert the opposite, fail-closed behavior, outside `NODE_ENV=test`). This was verbally noted during Phase 2A/2A.1's own investigation but never corrected or formally tracked. Registered this phase as **TD-21**.
- **The canonical Technical Debt Register itself was found stale** — the most significant documentation finding of this phase (§9): TD-2 showed "Open" despite being closed in Phase 2C; TD-15 didn't exist in it at all despite being closed in Phase 2D; ten further items (TD-9–TD-14, TD-16–TD-18) existed only in `phase2b-technical-debt-assessment.md`, a separate report, never merged into the one document meant to be authoritative. This is not new _engineering_ debt, but it is exactly the kind of "documentation inconsistency" Task 1 asked this phase to search for, and arguably the highest-value finding in this pass precisely because it undermines confidence in every other status claim in the register until corrected.
- No other stale comment, misleading TODO, outdated example, or obsolete guidance was found beyond what's already catalogued in TD-4 through TD-21.

## 7. Risk Matrix (Task 5)

| ID                                                        | Dev Productivity                              | Maintainability                                                  | Architectural Risk                             | Operational Risk                                       | Regression Risk                                                    | Implementation Complexity                                                      | Business Impact                                                                         | **Overall**    |
| --------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------- |
| TD-13 (`/replay` doesn't replay)                          | Low                                           | Medium (misleading naming)                                       | Low                                            | Low                                                    | Low                                                                | Medium (needs a design decision: wire in real machinery, or rename/redocument) | Medium (a documented capability, `CLAIMS.md` 2.7, functions differently than described) | **Medium**     |
| TD-16 (ReceiptCrypto bypass)                              | Low                                           | Medium                                                           | Medium (silent future divergence)              | Low today, would become Medium-High post-KMS-migration | Low today                                                          | Medium (real seam design work)                                                 | Low today, time-bombed                                                                  | **Medium**     |
| TD-3 (no CI coverage gate)                                | Medium                                        | Medium                                                           | None                                           | Medium (silent regressions)                            | N/A                                                                | Low                                                                            | Low-Medium                                                                              | **Medium**     |
| TD-19 (debug console.log)                                 | Medium (log noise complicates real debugging) | Low                                                              | None                                           | Low (no secrets logged, just noise)                    | None                                                               | Trivial                                                                        | Low                                                                                     | **Low**        |
| TD-20 (dead composition root)                             | Medium (confusion risk for new contributors)  | Medium                                                           | None (confirmed zero references, no live risk) | None                                                   | None (dead code, nothing to break)                                 | Trivial (delete 2 files, already confirmed safe)                               | Low                                                                                     | **Low**        |
| TD-9 (ExecutionRequestBuilder duplication)                | Low                                           | Medium (drift-guard absent on a trust-boundary-feeding function) | Low                                            | Low                                                    | Low (prevents a _future_ regression class, doesn't fix a live one) | Trivial (one-line change)                                                      | Low                                                                                     | **Low**        |
| TD-10 (SDK empty stubs)                                   | Medium (published SDK, no safety net)         | Medium                                                           | None                                           | Low                                                    | N/A                                                                | Medium (session-sized)                                                         | Medium (external consumers)                                                             | **Low-Medium** |
| TD-21 (CLAIMS.md stale claim)                             | Low                                           | Low                                                              | None                                           | None                                                   | None                                                               | Trivial                                                                        | Low                                                                                     | **Low**        |
| TD-4, TD-5, TD-6, TD-8, TD-11, TD-12, TD-14, TD-17, TD-18 | Low                                           | Low                                                              | None                                           | None                                                   | None                                                               | Trivial–Low                                                                    | Low                                                                                     | **Low**        |

No item reaches **Critical** or **High** — consistent with Phase 2B's own finding that the highest-severity items (TD-1, TD-2) are both now closed.

## 8. Dependency Graph (Task 6)

```
Independent, parallelizable (no shared files, no ordering constraint):
  TD-3   (ci.yml coverage step)
  TD-4, TD-5, TD-6, TD-21   (documentation-only edits, different files each)
  TD-7, TD-20               (delete dead files, already confirmed zero references)
  TD-9                       (ExecutionRequestBuilder.ts, one line)
  TD-19                      (execute.ts + ExecutionTrustApplication.ts, delete-only)

Needs a decision before implementation (not blocked, just not yet scoped):
  TD-13  → wire in @parmana/replay for real, or rename/redocument the route —
           a product/design choice, not an engineering one
  TD-16  → premature before roadmap Move 1 (KMS/HSM) is scheduled; sequencing
           dependency on unscheduled future work, not on anything in this repo today
  TD-11  → finish ExecutionEvidenceComponent or delete it — same "decide intent
           first" shape as TD-13
  TD-12  → wire in Override machinery or leave parked — product decision

Session-sized, independent of everything else:
  TD-10  (typescript SDK test coverage)
  TD-8   (before any future standalone package extraction, not urgent now)

No item in this list blocks any other. Nothing here has a prerequisite among
Phase 2A–2D's own closed work.
```

## 9. Technical Debt Register Update

Applied directly to `docs/architecture/repository-certification.md` §10 this phase (not merely recommended):

- **TD-2**: Status corrected from "Open" to **Closed** (2026-08-05, Phase 2C), with a dated closure-note addendum. The original finding/description/rationale text is preserved unedited, per this repository's established convention (TD-1's own closure precedent).
- **TD-15**: **Added** to the canonical register for the first time (it previously existed only in `phase2b-technical-debt-assessment.md`), already marked **Closed** (2026-08-05, Phase 2D).
- **TD-9 through TD-14 and TD-16 through TD-18**: merged into the canonical register for the first time, each independently re-verified this phase (§3) rather than copied verbatim. **TD-13's description was corrected** (not just copied) to reflect the more precise finding this phase made: the route exists and returns 200, it does not silently fail — a materially different, more accurate characterization than the prior "unreachable from `/replay`" framing.
- **TD-19, TD-20, TD-21**: newly registered this phase, each with direct repository evidence (§2, §5, §6).
- **No item's severity was changed without evidence.** TD-4 through TD-8's original Low/Medium ratings, and TD-9 through TD-18's ratings as scored in Phase 2B, were independently re-derived this phase (§7) and found to still hold, except TD-13's overall risk read stayed **Medium** but its rationale was sharpened.

## 10. Evidence Summary

- Direct source reads: `ExecutionRequestBuilder.ts`, `ExecutionEvidenceComponent.ts`, `ExecutionTrustApplication.ts` (both the `replay()` method and the 7 debug `console.log` call sites), `routes/replay.ts`, `routes/execute.ts`, `LedgerSerializer.ts`, `ReceiptCrypto.ts`, `SettlementConfirmationCrypto.ts`, `createGatewayIdentity.ts`, `createSessionStore.ts`, `ExecutionControlComposition.ts`, `ConnectorFactory.ts`, `docs/CLAIMS.md`.
- Repository-wide greps re-run fresh this phase: `TODO|FIXME|XXX|HACK`, `describe.skip|it.skip|test.skip`, `it.todo|test.todo`, `console.log(`, class/file-name reachability for `OverrideService`/`OverrideVerifier`/`ReplayExecutor`/`ReplayPipeline`/`ExecutionControlComposition`/`ConnectorFactory`, and the exact terminology-guard command (confirming TD-2's continued closure).
- `git log`/`git blame`: confirmed TD-19's debug statements were introduced 2026-07-18 (`a6b9d8b`), independent of any Phase 1–2 work, and predate every prior audit that could have caught them.
- Build/test evidence: `npx tsc -b`, `npm run lint`, `npm test -- --maxWorkers=2` all independently re-run this phase against commit `752be4c` — clean (138 files / 950 tests passed, 15 files / 39 tests correctly skipped, 0 failed).
- Register-consistency evidence: `tests/architecture/documentation-references.test.ts` and `tests/architecture/terminology-guard.test.ts` both re-run after this phase's register edits — 54 tests, all passing, confirming the edits introduced no broken reference and no terminology-guard regression.

---

## Final Recommendation

**BEGIN NEXT IMPLEMENTATION PHASE.**

**Target: TD-9 — `ExecutionRequestBuilder.build()` should call the shared `toExecutableContent()` helper instead of manually re-deriving the same four fields.**

**Why this outranks every other remaining item:**

- **Highest value-to-cost ratio among everything scored in §7.** The fix is a one-line change (call the existing, already-shared helper `RuntimeEngine.ts` already uses for the identical four-field extraction) with zero behavior change today (both derivations already produce identical values — confirmed, not assumed) and zero design surface: no product decision, no sequencing dependency, no investigation required.
- **It closes a drift-guard gap on a trust-boundary-feeding function**, not merely a cosmetic one. `ExecutionRequestBuilder`'s output feeds directly into what `ExecutionGateway` verifies and executes — two independent code paths deriving the same four fields with nothing to prevent future divergence is precisely the class of latent risk this entire multi-phase program (TD-1 onward) has been about: not "is it broken today" but "is there a structural reason it can't quietly become wrong later." TD-9 is the cheapest, most directly analogous instance of that pattern still open.
- **Every comparably-scored alternative requires either a decision this phase correctly declines to make unilaterally, or has an unscheduled prerequisite:** TD-13 and TD-11/TD-12 (all Medium-or-decision-gated) need a product call on intent (wire something in vs. rename/delete) before any code should be written; TD-16 is explicitly premature until roadmap Move 1 is scheduled; TD-10 is session-sized (writing real SDK tests), a reasonable but _larger_ undertaking than a single next-phase item should be; TD-3 (coverage gate) needs a threshold-policy decision, not just a YAML edit.
- **TD-19 and TD-20 are close seconds**, both trivial and low-risk (delete debug logs; delete dead files), but neither closes a guard against _future_ incorrectness the way TD-9 does — they clean up existing noise/confusion rather than removing a structural opportunity for drift. TD-9 is marginally the higher-value pick because its absence is a mechanism that could actively cause a future bug, not just present-tense untidiness.

No higher-severity alternative exists: TD-13 and TD-16, the only two open items scored Medium, are both correctly identified as needing a scoping decision or an external prerequisite before implementation is appropriate, not as items this assessment is deprioritizing without cause.
