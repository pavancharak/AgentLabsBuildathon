# Phase 2I — Remove Dead Composition Root (TD-20)

Closes TD-20 (`docs/architecture/repository-certification.md`, Technical Debt Register), a Phase 2E finding. This is an implementation phase scoped to removing an unreachable, abandoned composition root — no architectural, runtime, or dependency-injection redesign, no production behavior change.

**Fixed against:** commit `4d45385` (`fix(runtime): remove residual debug instrumentation and close TD-19`), the tip of `main`. Working tree was not clean at the start of this phase — Phase 2H's changes were still uncommitted; per user confirmation, they were committed first (`4d45385`) before this phase's own gate check was re-run and passed.

---

## 1. Original TD-20 Finding

From `docs/architecture/repository-certification.md`:

> A second, entirely unused "composition root" for Execution Control exists alongside the real one: `ExecutionControlComposition.ts` and `ConnectorFactory.ts` (100 lines combined) have zero references from any other file in the repository. Matches `docs/investigations/GAP-AUDIT.md`'s G-13 finding (2026-07-07) precisely, still unaddressed a month later and never previously added to this register. Confusion risk for a new contributor or auditor who reads the wrong file as source of truth (the real chain is `createExecutionControl.ts`/`createConnectorRegistry.ts`) — zero functional risk since nothing constructs or imports either dead class. **Any future cleanup pass: delete both (already confirmed zero references; low-risk removal).**

Rated **Low**, classified **Open**.

## 2. Independent Verification Methodology

Read source and history directly rather than trusting Phase 2E's summary:

- Both target files: `packages/api/src/bootstrap/ExecutionControlComposition.ts`, `packages/api/src/bootstrap/ConnectorFactory.ts`
- Every other file in `packages/api/src/bootstrap/` (30 files total), to place the two targets in context against the real composition chain
- The real chain, read end to end: `packages/api/src/server.ts` → `createExecutionSystem.ts` → `createExecutionGateway.ts` → `createExecutionControl.ts` → `createConnectorRegistry.ts`/`createSessionStore.ts`/`createExecutionAuditSink.ts`/`createGatewayIdentity.ts`
- `packages/api/src/application.ts`, `packages/api/src/app.ts`, `packages/api/tests/test-app.ts`, `packages/api/tests/bootstrap/createInspectableExecutionSystem.ts`
- `packages/connector-sdk/src/ConnectorFactory.ts` and `packages/connector-sdk/src/index.ts` — the same-named but unrelated interface, to confirm it is never conflated with the dead class
- Repo-wide grep for `ExecutionControlComposition`, `ConnectorFactory`, `new ExecutionControlComposition`, `new ConnectorFactory(`, `composition root`, `factory`, across all `.ts`, `.md`, `.mdx`, `.json` files (excluding `node_modules`, `dist`, `coverage`)
- `git log -S`/`git log --follow`/`git show` on both target files, `createExecutionControl.ts`, `docs/ROADMAP-v1.md`, and `docs/investigations/GAP-AUDIT.md`, to establish actual introduction order and rule out an assumed "pre-refactor path" narrative not supported by the commit history
- `packages/api/package.json` (exports/files fields), `packages/api/src` for any `index.ts` barrel, and every other package's `package.json` for a dependency on `@parmana/api`
- `docs/CLAIMS.md`, `docs/GUARANTEES.md`, `docs/site/reference/api.mdx`, `docs/site/integrations/overview.mdx`, `docs/site/reference/connector-sdk.mdx`
- `tests/architecture/execution-boundary.test.ts` (the Phase 1E/1F architecture-enforcement suite), read in full and re-run before and after removal

**TD-20's factual premise was confirmed exactly as described**: both files exist, both are entirely unreferenced by anything else in the repository, and the real chain is `createExecutionControl.ts`/`createConnectorRegistry.ts`. No part of that finding was overturned. This phase's independent verification found one citation-provenance error worth correcting (below), confirmed the "zero references" claim through git history (not just current-tree grep), and confirmed no STOP condition applies.

**Citation-provenance correction, found independently:** TD-20's register entry and Phase 2E's own assessment both attribute this finding to _"`docs/investigations/GAP-AUDIT.md`'s G-13 finding (2026-07-07)."_ Direct inspection of `docs/investigations/GAP-AUDIT.md` (both its current content and its original commit, `82b4db8`, dated 2026-07-07) shows it **never mentions `ExecutionControlComposition`, `ConnectorFactory`, "composition root," "G-13," or anything resembling this finding**, at any point in its history. The actual source of "G-13" is `docs/ROADMAP-v1.md` §4 ("Technical debt, cross-referenced against VERIFICATION-GAPS.md and CLAIMS.md"), which explicitly numbers its own new findings "continuing from G-11" and lists **G-13** there: _"Two composition roots for Execution Control exist (`ExecutionControlComposition`/`ConnectorFactory`, dead, vs. `createExecutionControl.ts`, real)."_ `docs/ROADMAP-v1.md` was itself introduced in commit `503d48f`, dated **2026-07-13** — six days after the date TD-20 attributes the finding to. This is a citation-trail error (Phase 2E's assessment appears to have inherited an incorrect attribution rather than checking `GAP-AUDIT.md` directly), not a factual error about the composition root itself: the underlying finding (two composition roots, one dead) is independently confirmed true regardless of which document first raised it. Noted here per this phase's instruction not to rely on Phase 2E's own citations without fresh verification.

## 3. Historical Audit

**When introduced:** `git log -S "class ExecutionControlComposition"`/`--follow` on both target files resolves to a single commit, `ddf4bc5` ("Stabilize runtime, verification, storage, and replay pipeline", **2026-07-09**). The same commit's diff (`git show ddf4bc5 --stat`) shows it introduced **both** competing approaches side by side in one changeset: `ExecutionControlComposition.ts`, `ConnectorFactory.ts`, and `ConnectorCatalog.ts` (the class-based approach) alongside `createConnectorAuthenticator.ts`, `createConnectorRegistry.ts`, `createConnectorRoute.ts`, `createCredentialProvider.ts`, `createExecutionAuditSink.ts`, `createExecutionControl.ts` (an early version), `createGatewayIdentity.ts`, `createSessionStore.ts`, and others (the functional `create*.ts` approach that became canonical).

**This is a more precise finding than "a pre-refactor path later replaced by a refactor."** The two approaches were not sequential — they were committed together, in the same changeset, as apparent parallel exploration of the same responsibility. What happened next, confirmed independently:

- **Two days later**, commit `806e9e6` ("feat: implement credential isolation and secure enterprise connectors", **2026-07-11**) extended `createExecutionControl.ts` specifically — adding `GatewayAttestationSigner`, `createGatewayKeyPair()`, registration-time attestation, and wrapping the result in `SessionCredentialExecutionControl` (confirmed by reading the current file, `packages/api/src/bootstrap/createExecutionControl.ts:1-88`). This is materially more sophisticated than `ExecutionControlComposition.build()`, which constructs a bare `ExecutionControlService` with no session-credential wrapping, no attestation signer, and no gateway key pair.
- **`ExecutionControlComposition.ts` and `ConnectorFactory.ts` were never touched again in any subsequent commit** (`git log --follow` on both returns exactly one commit each — the introducing one).
- **`new ExecutionControlComposition` and `new ConnectorFactory(` have never appeared anywhere in the entire git history of the repository** (`git log --all -S` for both strings, across all files, all commits — zero results). This is stronger evidence than a current-tree grep: it confirms these classes were never instantiated even transiently, in any commit that was later reverted or refactored away. They were dead on arrival.

**Whether a later phase intentionally superseded them:** no. "Supersession" implies the dead path was once live and was deliberately replaced. That did not happen here — the functional path was chosen and developed within the same week the class-based one was introduced, and the class-based one simply stopped receiving commits. The correct characterization is **abandoned-at-introduction**, not **superseded-after-use**.

**Relationship to Phases 1A–1E — direct answer to this task's cross-reference question:** `ExecutionControlComposition.ts`/`ConnectorFactory.ts` do **not** represent "the pre-refactor connector construction path" in the sense of a path that once ran in production and was later replaced by a refactor (that would require evidence of live use followed by supersession, which the history above shows never happened). What they do represent is a **parallel, never-activated construction path for the same responsibility** that the canonical `ExecutionGateway`-based architecture (`createExecutionControl.ts` → `createExecutionGateway.ts` → `ExecutionGateway`) fulfills instead. **Their removal is independent evidence supporting the Phase 1E single-execution-pipeline invariant, not merely dead-code reduction**: `tests/architecture/execution-boundary.test.ts`'s own stated purpose is to verify "there is exactly one production execution pipeline... and nothing outside execution-gateway owns production execution" (file header, lines 7-10). That two composition roots for the same responsibility have coexisted in this repository since 2026-07-09 without the invariant ever being violated — because the second one was never wired to anything, confirmed across the _entire_ commit history, not just today's tree — is direct, historical, non-trivial confirmation that the single-pipeline architecture has held continuously, not just as of the current snapshot. Removing the dead root converts "the invariant held because the alternative was never activated" into "the invariant holds because the alternative no longer exists to be activated" — a strictly stronger guarantee.

## 4. Composition Root Inventory

| File(s)                                                                                                                                                                                                                                                                  | Package                         | Responsibility                                                                                                                                     | Runtime entry                                                                                                         | Classification                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `server.ts` → `createExecutionSystem.ts` → `createExecutionGateway.ts` → `createExecutionControl.ts` → `createConnectorRegistry.ts`/`createSessionStore.ts`/`createExecutionAuditSink.ts`/`createGatewayIdentity.ts`/`createGatewayKeyPair.ts`/`createConnectorRoute.ts` | `@parmana/api`                  | Production wiring of the entire `ExecutionSystem`/`ExecutionControl`/`ExecutionGateway` subsystem                                                  | `node dist/server.js` / `npm run dev` (`tsx src/server.ts`)                                                           | **Canonical composition root**                                             |
| `packages/runtime/src/RuntimeFactory.ts`                                                                                                                                                                                                                                 | `@parmana/runtime`              | Constructs `ExecutionTrustApplication` from repositories, policy repository, and an already-built `ExecutionSystem`                                | called by `packages/api/src/application.ts`'s `createApplication()`                                                   | **Canonical composition root**                                             |
| `packages/api/tests/test-app.ts`                                                                                                                                                                                                                                         | `@parmana/api` (test)           | Mirrors the production chain above (`createExecutionSystem()` → `createApplication()` → `createApp()`) for supertest-driven integration tests      | `packages/api/tests/integration/*.test.ts`                                                                            | **Test composition root**                                                  |
| `packages/api/tests/bootstrap/createInspectableExecutionSystem.ts`                                                                                                                                                                                                       | `@parmana/api` (test)           | A DI-seam variant of `createExecutionSystem()` for white-box test assertions (restored/used in Phase 2D's `execution-failure.integration.test.ts`) | `packages/api/tests/integration/execution-failure.integration.test.ts`                                                | **Test composition root**                                                  |
| `packages/runtime/src/RuntimeBuilder.ts` + each `examples/tutorials/*/run.ts`                                                                                                                                                                                            | `@parmana/runtime` + `examples` | Standalone, no-HTTP-layer wiring for tutorial scripts                                                                                              | `npx tsx examples/tutorials/*/run.ts`                                                                                 | **Demo composition root**                                                  |
| `packages/api/src/bootstrap/ExecutionControlComposition.ts` + `ConnectorFactory.ts`                                                                                                                                                                                      | `@parmana/api`                  | An alternate, class-based composition for the identical `ExecutionControl` responsibility `createExecutionControl.ts` fulfills                     | none — zero callers in the current tree and zero callers anywhere in git history                                      | **Dead composition root — removed this phase**                             |
| `packages/api/src/bootstrap/ConnectorCatalog.ts`                                                                                                                                                                                                                         | `@parmana/api`                  | A standalone connector-enablement list, self-contained, no dependency on either the dead or canonical root                                         | none — zero callers anywhere (confirmed by grep), already flagged by `docs/site/reference/api.mdx`'s existing Warning | **Dead, but out of TD-20's named scope — not removed this phase** (see §9) |

## 5. Reachability Analysis

Every check this phase's Task 2 required, run directly against current source and history:

- **Imported:** no — repo-wide grep for `ExecutionControlComposition` and `ConnectorFactory` (the `packages/api/src/bootstrap/` one specifically, distinguished from `packages/connector-sdk/src/ConnectorFactory.ts`'s same-named interface) found the two target files importing only each other, and nothing else in the repository importing either.
- **Instantiated:** no — `git log --all -S "new ExecutionControlComposition"` and `-S "new ConnectorFactory("` both return zero commits across the entire repository history.
- **Referenced:** only by each other, and by prose in `docs/architecture/phase2e-engineering-debt-assessment.md`, `docs/architecture/repository-certification.md`, and `docs/ROADMAP-v1.md` — all describing them as dead, none presenting them as live.
- **Exported:** no. `packages/api/package.json` has no `"exports"` field, no `"main"`, and `"private": true` — this package is never published to npm regardless of its contents. No `index.ts` barrel exists anywhere in `packages/api/src` or `packages/api/src/bootstrap`. No other package's `package.json` lists `@parmana/api` as a dependency (confirmed by grep across every `packages/*/package.json`).
- **Dynamically resolved:** no reflection, no dynamic `import()`, no configuration-driven class lookup found anywhere referencing either class name.
- **Reachable through runtime:** no — traced end to end from `server.ts` through every `create*.ts` call in the real chain; neither dead file appears.
- **Reachable through tests:** no — `packages/api/tests/test-app.ts` and `packages/api/tests/bootstrap/createInspectableExecutionSystem.ts` both use `createExecutionSystem()`, not either dead file. Repo-wide grep for both class names restricted to `*.test.ts` files returned zero matches.
- **Reachable through examples:** no — `examples/tutorials/**/run.ts` construct `Runtime` via `RuntimeBuilder`, never the API package's bootstrap files at all.
- **Reachable through documentation:** referenced only as a documented dead-code finding (see below), never as supported architecture.
- **Reachable through CI:** `.github/workflows/ci.yml` runs `tsc -b`/`npm test`, neither of which references either file by name; both ran clean after removal (§8).
- **Generated declarations:** `packages/api/dist/bootstrap/{ExecutionControlComposition,ConnectorFactory}.d.ts` existed as stale, gitignored build output (confirmed `packages/api/dist/` is listed in `.gitignore:11`, never tracked by git) and have been removed as part of this phase's cleanup (§8); nothing referenced them.

**Public package surface — explicitly checked, no STOP triggered.** Neither file appears in `package.json` `exports`, any `index.ts` barrel, or any published npm surface. `@parmana/api` is `"private": true` with no `main`/`exports` field, and no other workspace package depends on it. This is categorically different from `packages/connector-sdk/src/ConnectorFactory.ts` (the unrelated same-named interface), which **is** re-exported through `packages/connector-sdk/src/index.ts`'s public barrel — confirmed untouched by this phase, and confirmed structurally distinct by import path, file location, and kind (`export interface ConnectorFactory<TConfig>` vs. `export class ConnectorFactory`).

**Phase 1E/1F architecture enforcement tests — checked for negative-fixture reliance.** `tests/architecture/execution-boundary.test.ts`'s `"bootstrap composes but never executes business actions"` block (lines 230-240) scans **every** file under `packages/api/src/bootstrap/` generically via `it.each(bootstrapFiles)`, not a fixed file list — both dead files were incidentally swept into this scan before removal (and passed trivially, since neither calls `.execute(`). This is not a negative fixture the test relies on; it is a directory walk that happens to include whatever files exist. Confirmed by re-running the suite after removal (§8): the test still passes, with two fewer generated cases, and the invariant it enforces ("no bootstrap file calls `.execute(`") remains fully checked against every file that actually exists. No test needed strengthening — the scan-based design is inherently robust to files disappearing.

**Documentation presenting these as supported architecture — none found.** `docs/site/reference/api.mdx`'s "Structure" table (the page's canonical file-by-file description of `@parmana/api`) already lists only the real chain (`createExecutionSystem`, `createExecutionGateway`, `createExecutionControl`, `createConnectorRegistry`, etc.) — neither dead file ever appeared there. The same page's existing `<Warning>` block already called `ConnectorFactory.ts` "dead code, not wired into anything" (`ConnectorCatalog.ts` alongside it) — accurate, pre-existing, unprompted by this phase. It did not previously mention `ExecutionControlComposition.ts` at all. Since the warning described real, still-existing dead files, not "supported architecture," Task 2's update-or-justify branch did not strictly require a change — but leaving a public docs page describing a file that number longer exists as "dead code... lists connectors" would itself become stale and inaccurate the moment this phase's removal lands. **Updated** (§9) to remove the now-deleted `ConnectorFactory.ts` from that warning and added a short note pointing to this phase's documentation, while leaving `ConnectorCatalog.ts`'s entry (still true, still out of scope) untouched.

## 6. Dependency Graph

```
ExecutionControlComposition.ts
  ├─ createGatewayIdentity()              → also used by createExecutionControl.ts, createExecutionGateway.ts (Independently reachable)
  ├─ createConnectorAuthenticator()       → also used by createExecutionControl.ts (Independently reachable)
  ├─ InMemoryGatewaySessionStore          → @parmana/execution-control; also constructed by createSessionStore.ts's own path (Independently reachable)
  ├─ MemoryExecutionAuditSink             → @parmana/execution-control; also constructed by createExecutionAuditSink.ts (Independently reachable)
  ├─ InMemoryConnectorRegistry            → @parmana/execution-control; also used by createConnectorRegistry.ts and execution-control/execution-gateway's own test suites (Independently reachable)
  └─ ExecutionControlService              → @parmana/execution-control; also constructed by createExecutionControl.ts, with a different (session-credential-wrapped) configuration (Independently reachable)

ConnectorFactory.ts
  └─ ExecutionControlComposition          → the sibling dead file above; no other consumer
  (createAll() returns [] — constructs nothing itself)
```

Every class and function these two files reference is **Still reachable** through the canonical `createExecutionControl.ts`/`createConnectorRegistry.ts`/`createSessionStore.ts`/`createExecutionAuditSink.ts`/`createGatewayIdentity.ts` chain, confirmed by grep showing each imported and used by files other than the two being removed (`packages/api/src/bootstrap/createConnectorRegistry.ts`, `createConnectorAuthenticator.ts`, `createSessionStore.ts`, `createGatewayIdentity.ts`, `createExecutionAuditSink.ts`, plus `execution-control`'s and `execution-gateway`'s own unit tests). **Zero files become Newly orphaned.** `ConnectorCatalog.ts` is **Independently reachable-or-not** on its own terms — it was already unreferenced before this phase and does not depend on, or get depended on by, either removed file, so its dead status is not a consequence of this removal and its removability was not "independently demonstrated" as required before touching it (Task 3) — left untouched, flagged in §9.

## 7. Relationship to Phases 1A–1E

Covered in full in §3. Summary: the dead composition root was never a Phase 1A–1E-era production path later replaced by refactor — it was an abandoned parallel approach from the moment of its introduction (`ddf4bc5`, 2026-07-09), alongside the functional approach that Phase 1A–1E's architecture-enforcement tests (`tests/architecture/execution-boundary.test.ts`) verify as the sole production pipeline today. Its removal is additional, historically-grounded evidence that the single-execution-pipeline invariant has held continuously since that commit, not merely dead-code reduction.

## 8. Files Removed

- `packages/api/src/bootstrap/ExecutionControlComposition.ts` (65 lines)
- `packages/api/src/bootstrap/ConnectorFactory.ts` (37 lines)
- Stale, gitignored build output for both (`packages/api/dist/bootstrap/{ExecutionControlComposition,ConnectorFactory}.{js,js.map,d.ts,d.ts.map}`) — never git-tracked, removed for local cleanliness only; `tsc -b --clean` followed by a fresh `tsc -b` did not automatically prune these (a known TypeScript composite-build limitation for deleted inputs), so they were deleted directly. No git-tracked file was affected by this step.

No other file was removed. `ConnectorCatalog.ts` — independently dead but not a dependency of either removed file, and not named in TD-20 — was left in place (§9).

## 9. Public API Verification

- `packages/api/package.json`: no `exports` field, no `main` field, `"private": true`. Re-confirmed after removal: unchanged, still no exports of any kind.
- No `index.ts` barrel exists in `packages/api/src` or `packages/api/src/bootstrap`, before or after this phase.
- No other workspace package's `package.json` depends on `@parmana/api` (grep across every `packages/*/package.json`, before and after removal: only self-matches).
- `packages/connector-sdk`'s public barrel (`packages/connector-sdk/src/index.ts:16`, `export * from "./ConnectorFactory.js"`) is **unchanged** — confirmed by `git diff --stat`, this phase touched nothing under `packages/connector-sdk/`.
- **Conclusion: no public API or package export was affected by this removal**, consistent with `docs/ROADMAP-v1.md`'s own prior assessment of the same recommendation ("Impact: internal only, not exported from the package's public surface. Breaking: no.").

## 10. Documentation Verification

- `docs/site/reference/api.mdx`: updated. The existing `<Warning>` block, which already correctly named `ConnectorFactory.ts` as dead code (pre-existing, accurate, unprompted by this phase), now reflects that both `ExecutionControlComposition.ts` and `ConnectorFactory.ts` have been removed as of this phase, with an explicit note that this `ConnectorFactory` is not the same thing as `@parmana/connector-sdk`'s `ConnectorFactory` interface described on the connector-sdk reference page — preserving the disambiguation `docs/ROADMAP-v1.md` had already established. `ConnectorCatalog.ts`'s entry in the same warning (still dead, out of scope) was left exactly as it was.
- `docs/CLAIMS.md`, `docs/site/integrations/overview.mdx`, `docs/site/reference/connector-sdk.mdx`: all three mention "`ConnectorFactory`" but every occurrence is `@parmana/connector-sdk`'s unrelated interface, not the removed class — confirmed by reading each occurrence in context. None required a change.
- `docs/architecture/repository-certification.md`, `docs/architecture/phase2e-engineering-debt-assessment.md`, `docs/ROADMAP-v1.md`: describe the now-removed files only as a historical finding (TD-20/G-13), consistent with the project's existing pattern of not editing a prior phase's or audit's own report after the fact (matching how TD-9's register row remained "Open" after Phase 2F closed it in its own doc — that update is left to a future reassessment phase, not this one).
- No architecture diagram, sequence diagram, or repository map was found referencing either removed file anywhere in the repository.

## 11. Generated Artifact Verification

- `npx tsc -b` (incremental) and `npx tsc -b --clean` followed by a fresh `npx tsc -b`: both clean, 0 errors, both before and after removal.
- `openapi/openapi.yaml`, `openapi/openapi.bundled.yaml`, `docs/site/openapi.bundled.yaml`: `git status`/`git diff --stat` after the full regression run (§ below) shows none of these changed — expected, since neither removed file was a route, schema, or OpenAPI-relevant construct.
- No other codegen output (`python/parmana/models/*` generated models, `typescript/src/models/*`) changed — expected, since neither removed file fed any generator.
- `packages/api/dist/bootstrap/`'s stale `.d.ts`/`.js` output for the two removed files (gitignored, never tracked) was manually deleted for local cleanliness; this is expected, harmless, and does not affect any tracked artifact.

## 12. Regression Validation

```
npx tsc -b                        → clean, 0 errors (both before and after removal)
npm run typecheck                 → clean, 0 errors
npx vitest run tests/architecture/execution-boundary.test.ts
                                   → 137 passed (was 139 before removal — the 2 fewer are exactly
                                     the "ConnectorFactory.ts never calls .execute(" / "ExecutionControlComposition.ts
                                     never calls .execute(" cases that no longer exist because the
                                     files no longer exist; every remaining bootstrap file is still
                                     checked)
npm test -- --maxWorkers=2        → 140 test files passed, 15 skipped (unchanged);
                                     959 tests passed (-2, exactly matching the architecture-test
                                     reduction above), 39 skipped, 0 failed
```

`git status`/`git diff --stat` against the starting commit confirms exactly two files deleted (`ExecutionControlComposition.ts`, `ConnectorFactory.ts`) and one file modified (`docs/site/reference/api.mdx`) — no other production source, test, schema, or generated artifact was touched.

**No test depended on either removed file.** The only count change (961 → 959) is fully accounted for by the architecture-enforcement suite's generic directory scan losing exactly the two files that no longer exist — not a loss of coverage for the invariant itself (§5), and not a hidden dependency elsewhere.

## 13. Remaining Limitations

- **`ConnectorCatalog.ts` remains dead**, independently of this phase's removal (it does not depend on, or get depended on by, either removed file) and is not named in TD-20. Already flagged by `docs/site/reference/api.mdx`'s pre-existing Warning. Left untouched per this phase's scope — a candidate for a future, separately-scoped cleanup pass, consistent with how prior phases (2F, 2H) have flagged adjacent-but-out-of-scope findings rather than folding them in.
- **Two other files `docs/site/reference/api.mdx` already flags as empty, 0-byte stubs** — `scripts/generate-keys.ts` (repo root) and `packages/api/src/bootstrap/createVendorPaymentSecureConnector.ts` — are not named in TD-20 and were not touched.
- **The `docs/investigations/GAP-AUDIT.md`/`docs/ROADMAP-v1.md` citation-provenance error (§2)** was documented here but not corrected in either of those two documents themselves — consistent with this phase's and prior phases' pattern of not rewriting earlier audit reports after the fact; a future documentation-accuracy pass could correct `docs/architecture/repository-certification.md`'s TD-20 row and Phase 2E's own doc to cite `docs/ROADMAP-v1.md` G-13 rather than `GAP-AUDIT.md`, but that register-row edit is left to a future reassessment phase, matching how TD-9's "Open" status in the register was left for Phase 2E (not Phase 2F itself) to update.

---

## Final Verification

| Item                                                           | Status                                                                                                                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-20 independently verified                                   | ✓ — factual premise (two files, zero references) confirmed exactly accurate; a citation-provenance error in its "GAP-AUDIT.md G-13" attribution found and documented (actual source: `docs/ROADMAP-v1.md`)            |
| Historical rationale verified                                  | ✓ — both files introduced in the same commit as the functional path that became canonical (`ddf4bc5`, 2026-07-09), never touched again, never instantiated anywhere in git history (`git log --all -S`, zero results) |
| Dead composition root removed                                  | ✓ — `ExecutionControlComposition.ts`, `ConnectorFactory.ts` deleted                                                                                                                                                   |
| Canonical composition root unchanged                           | ✓ — `createExecutionSystem.ts`, `createExecutionGateway.ts`, `createExecutionControl.ts`, `RuntimeFactory.ts` all untouched, confirmed by `git diff --stat`                                                           |
| Runtime behavior unchanged                                     | ✓ — nothing imported or instantiated the removed files; `tsc -b` and full test suite clean                                                                                                                            |
| Security behavior unchanged                                    | ✓ — no authorization, signal-verification, replay-protection, audit, or credential-handling code touched                                                                                                              |
| Public APIs unchanged                                          | ✓ — `@parmana/api` has no exports/barrel regardless; `@parmana/connector-sdk`'s unrelated `ConnectorFactory` interface and its public barrel confirmed untouched                                                      |
| Package exports unchanged                                      | ✓ — confirmed via every workspace `package.json`, before and after                                                                                                                                                    |
| Documentation updated where necessary                          | ✓ — `docs/site/reference/api.mdx`'s warning updated to reflect the removal; documents that only describe this as a historical finding (register/assessment docs) left as-is, per established project pattern          |
| Generated artifacts unchanged (or expected changes documented) | ✓ — OpenAPI bundles and codegen outputs unchanged; stale gitignored `dist/` output for the two removed files deleted, expected and harmless                                                                           |
| Phase 1 architecture invariants remain valid                   | ✓ — `tests/architecture/execution-boundary.test.ts` re-run before and after, 137/137 passing after removal, invariant scope unreduced                                                                                 |

Supported by: repository searches (§2, §5), source references and full git history search (§3, §6), dependency graph (§6), build output (§11, §12: `tsc -b` clean, `npm run typecheck` clean), and test output (§12: 959/959 non-skipped tests passing, 39 correctly skipped, 0 failed).

## Final Recommendation

**TD-20 CLOSED.**

Both files were independently confirmed dead through the strongest available evidence: not just a current-tree grep (which TD-20's original finding already had) but a full git-history search (`git log --all -S`) proving `new ExecutionControlComposition` and `new ConnectorFactory(` have never appeared in any commit, ever — these classes were dead on arrival, introduced alongside the functional composition approach that was chosen and developed instead within the same week. No STOP condition applied: neither file is dynamically loaded, configuration-referenced, generated-code-referenced, documented as supported architecture, externally tooled, retained for compatibility, or exported as part of any published package surface — `@parmana/api` has no public exports at all, and the unrelated, same-named `@parmana/connector-sdk` interface was confirmed structurally distinct and left untouched. Removal was scoped exactly as required: the two dead files and nothing else — `ConnectorCatalog.ts`'s separate, pre-existing dead status was correctly identified as not a consequence of this removal and left out of scope. The removal is additional evidence for, not just a consequence of, the Phase 1E single-execution-pipeline invariant: two composition roots for the same responsibility coexisted since 2026-07-09 without the invariant ever being violated, because the second one was never activated even once. Full regression suite confirms zero behavioral change (959/959 passing, the only count delta fully explained by two fewer generated architecture-test cases for files that no longer exist), `tsc -b`/`typecheck` clean, and no public API, package export, or generated artifact affected.
