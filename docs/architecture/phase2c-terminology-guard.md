# Phase 2C — Repair the CI Terminology Guard

Repairs TD-2 (`docs/architecture/repository-certification.md`, Technical Debt Register), the single item Phase 2B's independent reassessment (`docs/architecture/phase2b-technical-debt-assessment.md`) recommended as the next implementation target. This is an implementation phase scoped narrowly to CI configuration and its own test coverage — no production source code, runtime behavior, or execution architecture was touched.

**Repaired against:** commit `17c4b2f` (`docs(architecture): independently reassess technical debt after Phase 2A`), the tip of `main`. Working tree was clean before this phase began.

---

## Independent Verification (before touching anything)

Reproduced the exact CI guard command from `.github/workflows/ci.yml` against the current tree, rather than trusting Phase 2B's report text:

```
grep -rIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  --exclude-dir=coverage --exclude='ROADMAP-v1.md' --exclude='VERIFICATION-GAPS.md' \
  --exclude='how-parmana-thinks.mdx' --exclude='execution-authorization.mdx' \
  --exclude='ci.yml' -i "execution governance" .
```

**Confirmed TD-2 still exists, and its blast radius had grown to three files** (not the one originally documented in Phase 1H):

| File                                                     | Line | Status before this phase                       |
| -------------------------------------------------------- | ---- | ---------------------------------------------- |
| `docs/site/changelog.mdx`                                | 93   | Original finding (Phase 1H)                    |
| `docs/architecture/repository-certification.md`          | 172  | New — quotes the phrase describing TD-2 itself |
| `docs/architecture/phase2b-technical-debt-assessment.md` | 49   | New — quotes the phrase describing TD-2 itself |

A full, unfiltered repo-wide search (no `--exclude` at all) for the exact phrase, case-insensitive, found **exactly 8 files total** — the 3 above, plus the 5 already correctly excluded (`ci.yml` itself, `ROADMAP-v1.md`, `VERIFICATION-GAPS.md`, `how-parmana-thinks.mdx`, `execution-authorization.mdx`). No file containing the phrase was unaccounted for; no silent false negative existed alongside the known false positives.

## 1. Original Failure

The guard's `if grep ...; then ... exit 1; fi` step, run against commit `17c4b2f`, exits non-zero and would fail CI, because it detects the retired phrase "execution governance" in `docs/site/changelog.mdx` (and, as of this phase's independent re-verification, two additional files) that are not in its `--exclude` list.

## 2. Root Cause

The guard's only exemption mechanism is a fixed, per-file `--exclude=basename` list. This has two compounding weaknesses:

1. **Incompleteness at the time it was written** — `changelog.mdx` legitimately narrates the same terminology history `ROADMAP-v1.md`/`VERIFICATION-GAPS.md` already do, in the same past-tense, self-referential way, but was never added to the list.
2. **Structural tendency to keep growing** — any document whose job is to _describe_ this exact guard, its history, or the retired term it protects against (an audit report, a certification, a technical-debt register entry) must quote the phrase to do so accurately, and immediately becomes a new false positive the moment it's committed. This happened twice, independently, in one day (Phase 1H's certification report and Phase 2B's assessment report each rediscovered and described the same underlying bug, and each commit that added that description silently became a new violation).

The root cause is not that the exclusion mechanism is _wrong_ — file-based exclusion is a legitimate, low-risk approach (and this phase's preferred-fix guidance names it explicitly) — but that it was maintained reactively, one omission at a time, rather than documented as a pattern maintainers should recognize and extend proactively.

## 3. Guard Architecture

**Entry point:** `.github/workflows/ci.yml`, step `Guard against retired terminology`, runs after `Typecheck` and before `Test` in the `build-and-test` job, on every push to `main` and every pull request.

**Matching algorithm:** a single `grep -rIn -i "execution governance" .` over the whole repository tree (`-r` recursive, `-I` skip binary files, `-n` line numbers, `-i` case-insensitive), narrowed by `--exclude-dir` (directories skipped entirely) and `--exclude` (basenames skipped, matched anywhere in the tree). Any match causes the step to print a `::error::` annotation and exit 1, failing the build.

**Directory exclusions (unchanged by this phase):** `node_modules`, `.git`, `dist`, `coverage` — build output and dependency trees, never hand-authored content.

**File exclusions, after repair** (basename-matched, same mechanism as before, now complete):

| File                                                     | Category                      | Reason                                                                                                    |
| -------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `ci.yml`                                                 | Self-reference                | Its own comment and grep pattern must name the phrase to check for it                                     |
| `tests/architecture/terminology-guard.test.ts`           | Self-reference                | New this phase (§6) — its own matching pattern and test fixtures must name the phrase for the same reason |
| `docs/ROADMAP-v1.md`                                     | (1) Historical self-narration | Narrates the terminology sweep itself                                                                     |
| `docs/VERIFICATION-GAPS.md`                              | (1) Historical self-narration | Documents this repo's own terminology history                                                             |
| `docs/architecture/repository-certification.md`          | (1) Historical self-narration | Phase 1H's certification report, discovered and described this exact gap                                  |
| `docs/architecture/phase2b-technical-debt-assessment.md` | (1) Historical self-narration | Phase 2B's reassessment, independently rediscovered and described this exact gap                          |
| `docs/architecture/phase2c-terminology-guard.md`         | (1) Historical self-narration | This document — necessarily quotes the phrase throughout to document the fix                              |
| `docs/site/changelog.mdx`                                | (1) Historical self-narration | The original false positive — this repo's public changelog, narrating the same history in past tense      |
| `docs/site/how-parmana-thinks.mdx`                       | (2) Third-party citation      | Cites an unrelated academic framework actually named "Execution Governance" (Ku, 2026)                    |
| `docs/site/concepts/execution-authorization.mdx`         | (2) Third-party citation      | Same third-party citation                                                                                 |

## 4. Matching Algorithm (detail)

Unchanged from before this phase: literal substring match (via `grep`'s basic regex mode) for the case-insensitive phrase `execution governance`, with word-boundary-free matching (so `Execution Governance`, `execution governance`, `EXECUTION GOVERNANCE`, and any embedded occurrence within a longer sentence all match identically). No stemming, no context-awareness, no distinction between quoted/unquoted usage — deliberately simple, matching this repository's own stated preference for "the cheap, high-value check" over heavyweight prose analysis (the same design philosophy `tests/architecture/documentation-references.test.ts` states explicitly for its own, unrelated check).

## 5. Allowed Exceptions

See the table in §3. Two, and only two, legitimate categories exist — the guard does not exempt anything for any other reason (e.g., "this file is old" or "this file is unimportant" are not exemption criteria; every exemption traces to one of the two categories above).

## 6. Forbidden Terminology

Exactly one phrase, case-insensitive: **"execution governance"**. The locked, correct vocabulary is **"execution authorization"** / **"AI Execution Authorization"**, per the guard's own error message. Independently confirmed this phase that neither "Execution Trust" (e.g. `ExecutionTrustRecord`, used throughout `README.md`) nor "Policy Engine" (e.g. the `PolicyEngine` class, `docs/architecture/system-architecture.md`) are retired or checked-for terms — both are current, correct architecture vocabulary, unaffected by this guard.

## 7. CI Integration

No change to when or how the guard runs: same step, same position in the job (`Typecheck` → **`Guard against retired terminology`** → `Test`), same trigger (`push` to `main`, every `pull_request`). The only change is the completeness of the `--exclude` list and the clarity of the comment explaining it (§3). `npm test` (run both locally and in CI) now also runs `tests/architecture/terminology-guard.test.ts` (§6), so the guard's logic is verified on every test run, not only when the CI workflow step itself executes.

## Task 4 — False Negative Audit

Searched, independently of the guard's own exclusion list, for the exact phrase across every category this phase's instructions name:

```
README.md                                          → 0 matches
docs/architecture/system-architecture.md            → 0 matches
docs/architecture/execution-walkthrough.md          → 0 matches
docs/developer/extending-parmana.md                 → 0 matches
docs/architecture/repository-invariants.md          → 0 matches
docs/architecture/execution-pipeline-report.md      → 0 matches
packages/*/package.json, packages/*/README.md       → 0 matches
package.json (root)                                 → 0 matches
typescript/, python/, examples/                     → 0 matches
docs/site/ (public docs site)                        → exactly the 2 known, classified,
                                                        legitimate third-party citations;
                                                        no other matches
```

**No active documentation contains the retired phrase.** README.md specifically was checked and found clean — there is no README finding to report as a separate tracked item.

## Task 5 — Disposable Probe Validation

Two throwaway files were created under `docs/`, checked against the repaired guard command, and deleted immediately after (never committed; `git status` before and after this step was compared to confirm no trace remained):

1. `docs/_terminology_guard_probe.md`, containing `"This document describes our Execution Governance layer."` — the repaired guard **detected it** (`grep` exit code 0, meaning the CI step's `if` branch would trigger and fail the build), proving new, unlisted legacy terminology still fails as required.
2. `docs/_terminology_guard_probe2.md`, containing only "Execution Trust" and "Policy Engine" — the repaired guard **did not** detect it (`grep` exit code 1, no match), confirming the guard remains precisely scoped to the one forbidden phrase and was not accidentally broadened.

Both probes were deleted with `rm` immediately after use; `git status --porcelain=v1 -uall` confirmed a clean tree with no residual files before proceeding.

## Task 6 — Regression Tests

`tests/architecture/terminology-guard.test.ts` (new), 6 tests, reimplementing the guard's exact matching logic in TypeScript so it runs on every `npm test`, not only when the CI workflow step executes:

1. The repository, scanned by the reimplemented guard, currently has zero violations.
2. Active documentation (`README.md`, `system-architecture.md`, `execution-walkthrough.md`, `repository-invariants.md`, `extending-parmana.md`) contains no instance of the phrase.
3. Historical self-narration files are both (a) present in the exclusion list and (b) confirmed to actually contain the phrase (proving the exclusion is exercised, not vacuous).
4. Third-party-citation files are both (a) present in the exclusion list and (b) confirmed to actually contain the phrase.
5. A synthetic probe string (not written to disk) proves the matcher still fires on unlisted content.
6. A synthetic benign string ("Execution Trust", "Policy Engine") proves the matcher does not over-match.

The exclusion list is duplicated (not shared) between `ci.yml` and this test file, by the same convention `documentation-references.test.ts` already uses for its own document list — the file's own comment states this explicitly and flags it as something to update in both places together.

## Task 7 — Build & Verification

Independently re-run against the repaired tree:

```
npx tsc -b                        → clean, 0 errors
npm run lint                      → clean (caught and fixed one unused import
                                     in the new test file during this process)
npm run typecheck                 → clean
npm test -- --maxWorkers=2        → 137 test files passed (+1 new), 16 skipped;
                                     948 tests passed (+6 new), 40 skipped, 0 failed
grep ... (the guard, run directly, full updated exclude list) → clean, 0 violations
```

## Task 7.5 — Before/After Behavior Comparison

| Metric                                                     | Before this phase                                                                          | After this phase                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total files containing the phrase (unfiltered)             | 8                                                                                          | 10 (the 8 original, plus this document and the new regression test, both of which necessarily quote the phrase to document/check for it)                                                                            |
| Files in the exclude list                                  | 5                                                                                          | 10                                                                                                                                                                                                                  |
| **Violations (guard would fail)**                          | **3**                                                                                      | **0**                                                                                                                                                                                                               |
| Valid violations (genuine regressions requiring a doc fix) | 0                                                                                          | 0                                                                                                                                                                                                                   |
| False positives                                            | 3 (`changelog.mdx`, `repository-certification.md`, `phase2b-technical-debt-assessment.md`) | 0                                                                                                                                                                                                                   |
| Files newly excluded this phase                            | —                                                                                          | `repository-certification.md`, `phase2b-technical-debt-assessment.md`, `phase2c-terminology-guard.md`, `changelog.mdx`, `terminology-guard.test.ts` (5)                                                             |
| Files newly checked (scope narrowed)                       | —                                                                                          | **None.** `--exclude-dir` set unchanged (`node_modules`, `.git`, `dist`, `coverage`); every file outside the exclude list, before and after, is still scanned. Nothing that was protected before is unprotected now |
| New legacy terminology (disposable probe)                  | —                                                                                          | Still detected (Task 5, probe 1)                                                                                                                                                                                    |
| Legitimate current terms (Execution Trust / Policy Engine) | —                                                                                          | Still never flagged (Task 5, probe 2)                                                                                                                                                                               |

**✓ False positives eliminated (3 → 0). ✓ No legitimate violation became silently accepted (0 valid violations existed before or after — every one of the 3 originally-failing files was independently classified False Positive / Historical Documentation, never Valid Failure). ✓ No new false negative introduced (disposable probe still fails; Task 4's active-documentation sweep found nothing newly missed).**

## 8. Validation Performed

Summarized from Tasks 4–7.5 above: independent re-verification of the original failure before any change; a full, unfiltered repo-wide search establishing there were exactly 8 (now 10) files in the entire tree containing the phrase, with none unaccounted for; a false-negative audit across every category this phase's instructions named, all clean; two disposable, uncommitted probes proving both directions (still catches new violations, still ignores unrelated terms); a new, permanent regression test suite; and a full independent re-run of `tsc -b`, lint, typecheck, the full test suite, and the guard command itself.

## 9. Remaining Limitations

- **The exclusion mechanism is still a maintained list, not a self-describing rule.** This phase made the list complete and clearly documented (§3's two-category framework, plus an explicit instruction in `ci.yml`'s comment for future maintainers), but it is not structurally immune to the same omission that caused the original bug — a future document that legitimately needs to quote the retired phrase must still be manually added. The comment added this phase exists specifically to make that addition obvious and low-friction rather than to eliminate the need for it.
- **`grep --exclude` matches by basename only, repository-wide**, not by full path. If two files anywhere in the tree ever shared one of the excluded basenames (e.g., a second, unrelated `changelog.mdx`), both would be exempted together. No such collision exists today (verified: each excluded basename is unique in the tree), so this is a documented, currently-inert design property, not an active gap — not changed this phase, to avoid introducing an untested change to the matching mechanism itself for a risk that isn't currently realized.
- **The regression test's exclusion list is hand-duplicated from `ci.yml`'s**, not derived from a single shared source. This mirrors an existing, accepted precedent in this codebase (`documentation-references.test.ts`'s own document list), not a new pattern — flagged for the same reason that precedent presumably was: worth a future consolidation if either list grows unwieldy, not urgent today.

---

## Final Verification

| Item                                | Status                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI terminology guard repaired       | ✓                                                                                                                                                                |
| Original false positives eliminated | ✓ — all 3 confirmed gone (Task 7.5)                                                                                                                              |
| No false negatives introduced       | ✓ — disposable probe still fails; false-negative audit clean (Task 4, 5)                                                                                         |
| Historical documentation preserved  | ✓ — zero documentation files edited; only `.github/workflows/ci.yml` and the new test file were touched                                                          |
| Active documentation protected      | ✓ — still fully in scope of the guard; explicitly re-verified clean (Task 4)                                                                                     |
| CI enforcement remains effective    | ✓ — same scan scope, same trigger, same failure behavior; only the exclude list's completeness changed                                                           |
| No production code changed          | ✓ — `git diff --stat` confirms only `.github/workflows/ci.yml` and `tests/architecture/terminology-guard.test.ts` changed; zero files under any `packages/*/src` |

## Final Recommendation

**TD-2 CLOSED.**

All five required conditions are demonstrated with repository evidence, not asserted:

- The original false positives (`changelog.mdx`, plus the two newly-discovered ones) no longer occur — confirmed by re-running the exact guard command (§ Independent Verification, Task 7.5).
- Disposable probes still fail as expected — confirmed directly (Task 5), not inferred.
- Active documentation remains protected — confirmed by an explicit sweep finding zero instances anywhere outside the classified exclusion list (Task 4).
- Archived/historical documentation remains allowed — confirmed each excluded file both belongs to a named, justified category and actually contains the phrase (Task 6's regression tests assert this continuously).
- CI behavior improved (3 false positives → 0) without weakening enforcement — scan scope, directories excluded, and trigger conditions are all unchanged; only five specific, individually-justified files were added to what was already an established, precedented exclusion mechanism.
