# Phase 2A — Eliminate MockConnector from Production

Removes the highest-priority finding from Phase 1H's independent certification (`docs/architecture/repository-certification.md` §4.9, technical debt item TD-1): production bootstrap unconditionally registered `MockConnector` for the `vendor-payment` connector's `payments:execute` capability, letting production execution fabricate a genuinely signed, successful Trust Record and Receipt without ever contacting a real business system.

**Certified against:** commit `c3a29b5` (`docs(architecture): certify repository architecture (Phase 1H)`), the tip of `main` at the start of this phase. Working tree was clean before this phase began (verified: `git status`, `git diff --stat`, `git log --oneline -10`).

---

## Live Exposure Assessment

Performed before any code change, per this phase's charter.

**Deployment access was available and used, read-only, non-destructively:**

- `flyctl auth whoami` → authenticated as `charak1987@gmail.com`.
- `flyctl status -a parmana-api` → app `parmana-api` is live, 2 machines `started`, health checks passing, running deployment version `39`.
- `flyctl releases -a parmana-api` → the latest release (`v39`) was deployed **2026-08-03 14:14 UTC**.
- `curl https://parmana-api.fly.dev/health` → `{"status":"UP"}`.
- `curl https://parmana-api.fly.dev/version` → `{"error":"authentication required"}` (expected — caller authentication is enforced on every route except health checks; this session does not hold a caller credential and did not attempt to obtain or fabricate one).
- `flyctl logs -a parmana-api` → confirmed the app is actively serving traffic (live `razorpay_settlement_poll_tick` worker events streaming).
- `flyctl ssh console -a parmana-api -C "cat ...createVendorPaymentConnector.js"` → **failed**: `websocket: failed to WebSocket dial ... connection attempt failed`. This is a network/tunnel limitation of the current sandboxed environment (Fly's SSH requires a WireGuard tunnel this environment could not establish), not a permissions denial. Not retried beyond this one attempt, per guidance against rabbit-holing on failing tool calls.

**Repository evidence:** `git log --follow` shows `packages/api/src/bootstrap/createVendorPaymentConnector.ts` was introduced in commit `ddf4bc5` (2026-07-09) and never modified again until this phase. Every Phase 1 commit examined during Phase 1H certification (`f399ff5` through `c3a29b5`) is dated 2026-08-04 or 2026-08-05 — all after the `v39` deploy timestamp.

**Conclusion, stated precisely per this phase's instructions:** the release timeline is strong circumstantial evidence that whatever commit is live as `v39` predates the entire Phase 1C–1H architectural refactor, and that `createVendorPaymentConnector.ts` (unchanged since 2026-07-09) was almost certainly already present and already unconditionally MockConnector-backed in that build. However, direct source- or registry-level confirmation of the exact deployed commit could not be obtained (the SSH tunnel failed). Per this phase's own instruction: **"The repository indicates this would be present if this revision were deployed, but the currently deployed environment cannot be independently verified from available evidence."** This is not classified as a confirmed active production incident, because deployment evidence did not confirm it at the source level — only the release-timeline inference did. See §9 for what redeploying this fix requires.

---

## 1. Previous Production Registration Path

```
server.ts:35 createExecutionSystem()
  → createExecutionGateway()
    → createExecutionControl()
      → createConnectorRegistry(authenticator, sessions, audit, gatewayAuthentication)
        → createVendorPaymentConnector()          // packages/api/src/bootstrap/createVendorPaymentConnector.ts
            return new MockConnector({
              connectorId: "vendor-payment",
              capabilities: connectorCapabilities(["payments:execute"]),
            });                                     // UNCONDITIONAL — every environment, including production
        → registrations.push({ connector, ...})      // UNCONDITIONAL — no credential/config gate, unlike Razorpay/HubSpot
      → createGatewayConnectorRegistry(registrations)
```

A `POST /execute` transaction with `action: "payments:execute"` reached `ExecutionControlService.execute()` → `registry.resolveCapability("payments:execute")` → the `vendor-payment` entry → `SessionCredentialSecureConnector` → `SdkConnectorExecutor.execute()` → `MockConnector.execute()`, which (with no `script` configured, exactly how it was constructed) unconditionally returned `{ success: true, metadata: {} }`. This flowed back through the full pipeline into a genuinely signed `ExecutionTrustRecord` and `Receipt` — cryptographically indistinguishable, from the caller's side, from a real execution.

## 2. Updated Production Registration Path

```
server.ts:35 createExecutionSystem()
  → createExecutionGateway()
    → createExecutionControl()
      → createConnectorRegistry(authenticator, sessions, audit, gatewayAuthentication)
        → createVendorPaymentConnector()          // packages/api/src/bootstrap/createVendorPaymentConnector.ts
            if (process.env.NODE_ENV !== "test") return undefined;
            return new MockConnector({ ... });      // only reached when NODE_ENV=test
        → if (connector === undefined) {
            console.warn({ event: "vendor_payment_connector_unavailable", ... });
          } else {
            registrations.push({ connector, ... });
          }
      → createGatewayConnectorRegistry(registrations)  // "vendor-payment" entry absent outside test mode
```

In production (`NODE_ENV=production`, per `Dockerfile:99`), `payments:execute` has no connector to resolve to. `GatewayConnectorRegistry.resolveCapability("payments:execute")` throws `"No connector registered for capability 'payments:execute'."` — the exact same fail-closed error Razorpay/HubSpot already produce when their credentials are unconfigured (`createRazorpayCredentialProvider.ts` / `createHubSpotCredentialProvider.ts`, both pre-existing). The pattern is now uniform across all three connectors: return `undefined` when no real implementation/credential exists, let the registry's existing fail-closed lookup do the rest.

## 3. Complete MockConnector Inventory

Every location where MockConnector is constructed, registered, imported, or reachable, found via repeated repository-wide `grep` for `MockConnector`, `new MockConnector(`, and `createVendorPaymentConnector` (both before and after the fix, to confirm the fix's effect):

| Location                                                                                                                                                                                           | Classification                                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/connector-sdk/src/MockConnector.ts`                                                                                                                                                      | **Test infrastructure**                          | The class itself. Self-documented: _"Scripted, in-memory Connector for hermetic tests."_                                                                                                                                                                                                                                                                                                                                                                                            |
| `packages/connector-sdk/src/index.ts`                                                                                                                                                              | **Test infrastructure (public SDK export)**      | Exports the class so tests/tutorials outside `connector-sdk` can use it.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `packages/connector-sdk/tests/unit/mock-connector.test.ts`                                                                                                                                         | **Test**                                         | Unit tests for the class itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `packages/execution-gateway/tests/unit/connector-registry.test.ts`                                                                                                                                 | **Test**                                         | Uses `MockConnector` as a registry test fixture.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `packages/connector-sdk/src/connectors/{sap,oracle,workday,salesforce}/*.ts` (4 files)                                                                                                             | **Test/reference infrastructure**                | Each a thin `MockConnector` wrapper, self-documented as _"deterministic, in-memory, used until the real enterprise connector is implemented."_ Confirmed (grep, both before and after this fix) **not imported anywhere under `packages/api/src`** — unreachable from production bootstrap. No change needed.                                                                                                                                                                       |
| `packages/connector-sdk/src/connectors/vendor-payment/VendorPaymentConnector.ts`                                                                                                                   | **Test/dev infrastructure**                      | A _different_, SDK-level `createVendorPaymentConnector()` (capability `"vendor-payment"`, not `"payments:execute"`) — self-documented _"temporary in-memory connector used by the integration tests."_ Confirmed not imported by `packages/api/src/bootstrap/createConnectorRegistry.ts` (which imports its own, differently-implemented, same-named function from `./createVendorPaymentConnector.js`). Coincidental name collision between two unrelated files; no change needed. |
| `packages/api/src/bootstrap/createVendorPaymentConnector.ts`                                                                                                                                       | **Was Production — now Test/explicit-demo only** | **The fix.** Now returns `undefined` outside `NODE_ENV=test`.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `packages/api/src/bootstrap/createConnectorRegistry.ts`                                                                                                                                            | **Was Production — now correctly fail-closed**   | **The fix.** Registration guarded on `connector !== undefined`, mirroring the pre-existing Razorpay/HubSpot pattern exactly.                                                                                                                                                                                                                                                                                                                                                        |
| `packages/api/tests/unit/bootstrap/create-connector-registry.test.ts`                                                                                                                              | **Test**                                         | Updated: the two tests that asserted `vendor-payment` remained resolvable in production now assert it fails closed; one new test explicitly proves NODE_ENV=test still works.                                                                                                                                                                                                                                                                                                       |
| `packages/api/tests/unit/bootstrap/create-vendor-payment-connector.test.ts`                                                                                                                        | **Test**                                         | New, dedicated to `createVendorPaymentConnector()` in isolation (§6).                                                                                                                                                                                                                                                                                                                                                                                                               |
| `tests/architecture/execution-boundary.test.ts`                                                                                                                                                    | **Architecture test (comment only)**             | Allowlist comment updated to describe the new, fixed behavior (no assertion logic changed — `MockConnector.ts` remains the one allowlisted non-gateway `Connector` implementor, which is still true).                                                                                                                                                                                                                                                                               |
| `examples/tutorials/60-end-to-end-enterprise-execution/run.ts`                                                                                                                                     | **Example/tutorial**                             | Constructs its own standalone `MockConnector`; confirmed no import from `packages/api/src`. Unaffected, unchanged.                                                                                                                                                                                                                                                                                                                                                                  |
| `examples/tutorials/60-end-to-end-enterprise-execution/README.md`                                                                                                                                  | **Example doc**                                  | Describes the tutorial's own self-contained mock. Unaffected, unchanged.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `docs/architecture/{repository-certification,execution-pipeline-report,repository-invariants,system-architecture}.md`                                                                              | **Documentation**                                | Prose references to the finding/fix. `execution-pipeline-report.md` updated with a "Resolved (Phase 2A)" note (§8, below); `repository-certification.md` intentionally left as a point-in-time snapshot (§8).                                                                                                                                                                                                                                                                       |
| `docs/CLAIMS.md`, `docs/VERIFICATION-GAPS.md`, `04-INCIDENTS-LOG.md`                                                                                                                               | **Documentation (historical)**                   | Pre-existing discussion of `vendor-payment` as a demo/testing connector. Not edited — out of this phase's scope, and factually consistent with (not contradicted by) the fix.                                                                                                                                                                                                                                                                                                       |
| `docs/site/concepts/the-gateway.mdx`, `docs/site/integrations/connector-development-guide.mdx`                                                                                                     | **Public documentation — updated**               | Both contained a `<Warning>` callout with a literal code snippet showing the _old_, unconditional registration. Left unfixed, these would have become actively misleading the moment this fix merged (they explicitly told readers "the default server registers exactly one connector: vendor-payment, a MockConnector"). Updated in place — see §8.                                                                                                                               |
| `docs/site/{roadmap,glossary,architecture/execution-pipeline,guides/add-a-connector,integrations/overview,concepts/content-binding-toctou,reference/connector-sdk}.mdx`, `docs/site/llms-full.txt` | **Public documentation (unaffected)**            | Passing mentions of `MockConnector`/`vendor-payment` in narrative or reference context, not describing production registration behavior specifically. Not edited — reviewed, no false claims found in these files.                                                                                                                                                                                                                                                                  |
| `.gitleaks.toml`                                                                                                                                                                                   | **Config comment**                               | One line explaining why example/tutorial paths are secret-scan-exempt ("connectors here are MockConnector... never live credentials"). Not a code path; unaffected.                                                                                                                                                                                                                                                                                                                 |

## 4. Classification of Every Remaining Occurrence

After the fix, `MockConnector` is constructed by exactly one production-adjacent file (`createVendorPaymentConnector.ts`), and only when `NODE_ENV=test`. Every other occurrence is one of:

- **Test** (unit test files, exercising the class or its factories directly) — expected and necessary; unchanged.
- **Test/reference infrastructure inside `connector-sdk`** (the four enterprise mocks, the SDK-level `vendor-payment` factory) — confirmed unreachable from `packages/api/src` both before and after this fix; no change was necessary or made.
- **Example/tutorial** (`examples/tutorials/60-.../run.ts`) — self-contained, never touches production bootstrap; unchanged.
- **Documentation** — prose describing the (now-fixed) history, or describing the fixed current behavior.

No occurrence remains classified as **Production** or **Dead code**.

## 5. Why Each Remaining Occurrence Is Acceptable

- **Test files** exist specifically to exercise `MockConnector`'s scripted behavior deterministically — this is its designed purpose, stated in its own docstring, and the task's own charter explicitly preserves this use.
- **The four enterprise mocks and the SDK-level `vendor-payment` factory** live in `connector-sdk`, a package `system-architecture.md` documents as a "passive SDK" whose contents are metadata/reference code, not execution. They are unit-tested in place and were independently confirmed (repeated `grep`, not assumption) to have zero import path into `packages/api/src`. Removing or relocating them was not requested by this phase's charter ("Do NOT remove: tests, examples, demo infrastructure, local development tooling") and would be unrelated scope.
- **The tutorial** is explicitly named in this phase's Preserve list ("examples") and does not construct anything through the production bootstrap chain.
- **`createVendorPaymentConnector.ts` still returning `MockConnector` under `NODE_ENV=test`** is the deliberate mechanism by which this phase satisfies "Mock connectors remain valid for: unit tests, integration tests, local development, explicit demo environments" — setting `NODE_ENV=test` is itself the explicit, intentional act that distinguishes a demo/test run from production, mirroring the identical, pre-existing convention used by roughly a dozen other bootstrap factories in the same directory (`createCredentialProvider.ts`, `createNonceStore.ts`, `createCallerAuditSink.ts`, `assertStorageConfigured.ts`, and both vendor credential providers).

## 6. Regression Tests Added

**`packages/api/tests/unit/bootstrap/create-vendor-payment-connector.test.ts`** (new, 4 tests):

1. Returns `undefined` when `NODE_ENV=production`.
2. Returns `undefined` when `NODE_ENV` is unset entirely (not just "not production" — confirms the gate is an explicit `=== "test"` allowlist, not a `!== "production"` denylist, matching the codebase's existing convention).
3. Returns a `MockConnector` (`connectorId: "vendor-payment"`, capability `payments:execute`) when `NODE_ENV=test`.
4. Confirms the test-mode connector is still the scripted `{success:true}` shape (guards against a future edit accidentally wiring in something else under the test branch).

**`packages/api/tests/unit/bootstrap/create-connector-registry.test.ts`** (updated + 2 new):

- Updated the existing "does not fail startup... vendor-payment remains resolvable" test (previously asserted success in production) to instead assert `resolveCapability("payments:execute")` throws `"No connector registered for capability 'payments:execute'"` under `NODE_ENV=production`.
- Added: explicit fail-closed test — production, no env vars manipulated beyond `NODE_ENV`, `payments:execute` throws.
- Added: explicit test-mode-still-works test — `NODE_ENV=test`, `payments:execute` still resolves to `vendor-payment`.

**Mutation-testing validation performed, per this phase's instructions:**

1. `git stash push` on the two changed production files, reverting them to their exact pre-Phase-2A (vulnerable) state.
2. Ran the new/updated tests against the reverted code: **4 tests failed**, each with the expected assertion mismatch (`expected MockConnector instance to be undefined` / `expected registry to throw but it resolved to "vendor-payment"`), proving the tests do detect the regression they're meant to catch.
3. `git stash pop`, restoring the fix.
4. Re-ran the same tests: **all pass** (11/11 across both files, run together with `--maxWorkers=1` to rule out any cross-file environment-variable interaction, since `process.env` is shared global state across test files in the same worker).

**Existing coverage relied upon, not duplicated:** rather than adding a new end-to-end HTTP-level integration test, this phase traced the failure propagation directly in source (§7) and confirmed the exact same `GatewayConnectorRegistry.resolveCapability` throw — and the exact same "no catch, straight re-throw" behavior in `RuntimeEngine.execute()` — is already the mechanism Razorpay/HubSpot rely on and that mechanism has no special-casing per connector. Adding a duplicate, heavier integration test for the identical generic code path was judged unnecessary scope; the registry-level test proves the `payments:execute`-specific case directly.

## 7. Repository Searches Performed

- `grep -rn "MockConnector" .` (repo-wide, all extensions) — full inventory, run both before and after the fix.
- `grep -rn "new MockConnector(" packages/ examples/ tests/ --include="*.ts"` excluding test files — confirms exactly which non-test files construct it.
- `grep -rln "MockConnector" packages/api/src packages/execution-gateway/src` — final, narrow confirmation scoped to the two packages capable of reaching production bootstrap; returns exactly the two fixed files.
- `grep -rn "createVendorPaymentConnector"` (repo-wide) — disambiguated the two same-named, differently-implemented factories (`connector-sdk`'s vs. `api/src/bootstrap`'s) and confirmed only the latter is wired into `createConnectorRegistry.ts`.
- `grep -n "SalesforceConnector|WorkdayConnector|OracleConnector|SapConnector|create{Salesforce,Workday,Oracle,Sap}Connector" packages/api/src` — confirms zero matches; the four enterprise mocks are unreachable from production bootstrap.
- `grep -n "NODE_ENV" packages/api/src packages/shared/src` — established the existing, repo-wide test/production bootstrap convention this fix mirrors, and confirmed `Dockerfile:99` sets `NODE_ENV=production` for the actual deployed image.
- `grep -n "payments:execute"` (repo-wide) — enumerated every file referencing the capability, to check for any other test implicitly depending on it always resolving; none found beyond the files already accounted for above (confirmed by the full suite passing, §Build & Verification).

## 8. Documentation Updates Made This Phase

Beyond the code and tests:

- `docs/architecture/execution-pipeline-report.md` — appended a "Resolved (Phase 2A)" sentence to the existing Phase 1H correction note (§8 of that document). The original correction is left intact as the historical record of what was found and when; the resolution is appended, not substituted.
- `tests/architecture/execution-boundary.test.ts` — updated the allowlist comment to describe the current, fixed behavior (comment only; the assertion it documents was already correct and unchanged).
- `docs/site/concepts/the-gateway.mdx` and `docs/site/integrations/connector-development-guide.mdx` — both contained a public-facing `<Warning>` with prose and a literal code snippet asserting "the default server registers exactly one connector: vendor-payment, a MockConnector." Left unfixed, this would have been actively wrong the moment this fix merged. Updated in place to describe the new fail-closed behavior and the `NODE_ENV=test` gate, with a pointer to this report.
- `docs/architecture/repository-certification.md` (Phase 1H's report) was **intentionally not modified** — it is a dated, point-in-time certification snapshot, and its findings were accurate as of the date it was written. This report supersedes its TD-1 recommendation rather than rewriting the historical record.

## Task 4 Verification — Fail-Closed Behavior, Traced End to End

Read directly from source (not inferred), tracing what happens to a `payments:execute` transaction in production after this fix:

1. `GatewayConnectorRegistry.resolveCapability("payments:execute")` (`packages/execution-gateway/src/connector-execution/GatewayConnectorRegistry.ts:152-168`) iterates registered connectors, finds none declaring `payments:execute` (it was never registered), and throws `Error("No connector registered for capability 'payments:execute'.")`.
2. `ExecutionControlService.execute()` (`packages/execution-control/src/ExecutionControlService.ts:68-71`) calls `resolveCapability` synchronously, with no `try`/`catch` around it — the throw propagates immediately, **before** session creation (line 77), **before** any credential is issued, **before** any audit "session.created" event is recorded.
3. `RuntimeEngine.execute()`'s only `catch` block around the pipeline (`packages/runtime/src/RuntimeEngine.ts:399-445`) fires the `onRuntimeError` hook and **re-throws** — it does not swallow the error into a `success: false` result.
4. Because `RuntimeEngine.execute()` throws rather than returning, `Runtime.execute()` never reaches `await this.trustRecords.create(trustRecord)` — **no Trust Record is ever persisted**.
5. `ExecutionTrustApplication.execute()` never reaches `VerificationService.verify()` or `ReceiptService.generate()` — **no Receipt is ever generated**.
6. The HTTP route (`packages/api/src/routes/execute.ts`) receives the thrown error and returns it as a failed request — the caller gets an explicit, named failure, not a 200 with fabricated evidence.

**Verified, not fabricated:** ✓ no successful receipt, ✓ no successful Trust Record, ✓ no successful vendor evidence, ✓ no fabricated execution result. The failure is explicit and deterministic — a named error (`"No connector registered for capability 'payments:execute'."`), the same mechanism already relied upon and tested for Razorpay/HubSpot's fail-closed path.

## Build & Verification

Independently re-run against the fixed tree:

```
npx tsc -b                        → clean, 0 errors
npm test -- --maxWorkers=2        → 136 test files passed (+1 new file), 16 skipped;
                                     940 tests passed (+6 from this phase's new/split tests),
                                     40 skipped, 0 failed
```

Live vendor suites (`*-live.integration.test.ts`) were **not** run, per this phase's explicit instruction not to run them without approval.

## Preserve List — Confirmed Unchanged

`git diff --stat -- packages/*/src/` shows exactly two modified files, both in `packages/api/src/bootstrap/`: `createConnectorRegistry.ts` and `createVendorPaymentConnector.ts`. Neither `RuntimeEngine`, `ExecutionGateway`, `ExecutionControlService`, `SessionCredentialSecureConnector`, `SdkConnectorExecutor`, any vendor adapter, `envelope-verifier`, nor any credential-handling or audit-generation file was touched. Authorization, signal verification, replay protection, and the execution pipeline's call order are exactly as certified in Phase 1H — this phase only changed _which capabilities get registered_, never _how a registered capability executes_.

## 9. Redeploy Requirement — Repository State vs. Deployed State

**Repository state (this session):** the fix is committed to the working tree of `main` (not yet pushed or committed as of this report's writing — see final summary). `tsc -b` and the full test suite both pass against it.

**Deployed state:** the live Fly.io app (`parmana-api`, `v39`, deployed 2026-08-03) was **not** redeployed during this session. No `fly deploy` or equivalent was run — this phase's charter was a repository-level fix plus a read-only exposure assessment, not a deployment action, and deploying to a shared production environment is exactly the kind of action this assistant's operating guidelines require explicit user confirmation for before taking.

**This fix requires a redeploy to take effect in the live environment.** Until `parmana-api` is redeployed from a commit at or after this phase's fix:

- If the release-timeline inference in the Live Exposure Assessment is correct, the currently-running `v39` build still unconditionally registers `MockConnector` for `payments:execute` in production.
- The repository (source of truth for what _will_ ship) is fixed; the deployed binary (what's _currently running_) is unchanged by anything done in this session.

**Recommended follow-up, not performed in this session:** commit this phase's changes, then run `fly deploy` (or the project's normal deployment process) against `parmana-api`, and confirm post-deploy — ideally via a real `POST /execute` against `payments:execute` with a valid caller credential — that it now fails closed rather than succeeding.

---

## Final Verification

| Item                                                      | Status                                                                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MockConnector removed from production                     | ✓ — `createVendorPaymentConnector()` returns `undefined` outside `NODE_ENV=test`; `createConnectorRegistry.ts` no longer registers it unconditionally               |
| Production cannot fabricate successful execution          | ✓ — traced end to end (Task 4 section above); the request throws before any execution artifact is produced                                                          |
| Production cannot fabricate successful receipts           | ✓ — `ReceiptService.generate()` is never reached                                                                                                                    |
| Production cannot fabricate vendor evidence               | ✓ — no connector is ever invoked; `ConnectorEvidence` is never constructed for this path                                                                            |
| Production fails closed when no real connector exists     | ✓ — `"No connector registered for capability 'payments:execute'"`, identical mechanism to Razorpay/HubSpot                                                          |
| Tests remain functional                                   | ✓ — full suite green (940 passed, 40 correctly-skipped, 0 failed)                                                                                                   |
| Demo environments remain functional                       | ✓ — `NODE_ENV=test` still yields `MockConnector`, unchanged behavior, proven by regression test                                                                     |
| Local development remains functional                      | ✓ — same `NODE_ENV=test` mechanism; local runs without it now correctly fail closed like production, consistent with every other bootstrap factory in this codebase |
| No production security property weakened                  | ✓ — Preserve list confirmed untouched (§ above); authorization, signal verification, replay protection, credential handling, audit generation all unchanged         |
| Any production capability still depends on MockConnector? | **No** — final static audit (§3, §7) confirms zero production-reachable `MockConnector` construction outside the `NODE_ENV=test` branch                             |

**Repository state:** fixed, tested, and documented. **Deployed state:** unchanged — the live `v39` deployment (2026-08-03) predates this fix and was not redeployed this session. **Deployment action required:** yes, a redeploy of `parmana-api` from a commit including this phase's changes, not performed here — deployment to shared production infrastructure requires explicit user confirmation before this assistant would take that action.

The production trust gap identified during Phase 1H (TD-1) is eliminated **in the repository**. It remains present **in the currently deployed environment** until that environment is redeployed.

---

**Addendum (2026-08-05, Phase 2A.4):** the paragraph above reflects this report's status at the time it was written. The repository state has since changed: `parmana-api` was redeployed from this exact commit and independently verified (Phase 2A.2, `docs/operations/phase2a-deployment-verification.md`), and the pre-existing historical-record question was separately resolved against production evidence with a finding of zero non-test-attributed records (Phase 2A.3, `docs/operations/phase2a-historical-integrity-verification.md`). TD-1 is now closed; canonical evidence chain in `docs/operations/td1-closure-summary.md`. This report's original findings and static-audit evidence above remain accurate and unedited.
