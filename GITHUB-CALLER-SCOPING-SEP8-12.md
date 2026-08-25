# GitHub Caller-Scoping: What Was Actually Built (2026-08-26)

**Read this before treating anything below as an FCA-submittable artifact.** The originating
prompt asked for three things: (1) flip a `callerAuth: "disabled"` flag on a `GitHubConnector.ts`
file, (2) a three-scenario integration test, (3) live `curl` runs against `parmana-prod` with
inserted Supabase rows, real GitHub API calls (including an actual PR merge), and a
`parmana-sign --verify` check on the resulting signed responses. (1) and (2) had a real,
buildable equivalent once corrected against actual code; (3) does not exist in this environment
and was not attempted — see "What was not done, and why" below before assuming otherwise.

## What was actually wrong with the prompt's premise

- No `packages/connectors/github/src/GitHubConnector.ts` exists (real path:
  `packages/connector-github/src/`, no per-connector `callerAuth` field anywhere in it).
- `callerAuth` is a single, app-wide option on `createApp` (`packages/api/src/app.ts`'s
  `AppOptions.callerAuth: CallerAuthOption`) — confirmed directly, `"disabled"` or a real
  `{authenticator, auditSink}` pair, never a per-connector setting. There was never a boolean
  to flip on a connector file.
- `createAuthenticatedExecutor`, `@parmana/connectors-github` (wrong package name — the real
  one is `@parmana/connector-github`), and `result.auditTrail.scopeCheckResult` do not exist.
  The real response shape is an HTTP response (`response.status`, `response.body.code`), tested
  via `supertest` against the real Express app, matching every other integration test in this
  repo — not a `result.success`/`result.error` object from an `executor.execute()` call.
- No `parmana-prod` server is running anywhere in this environment. No live GitHub App
  credentials exist here either — confirmed in this same session, weeks ago in this
  conversation's own history: this checkout's `.env` has a 32-character placeholder for
  `GITHUB_APP_PRIVATE_KEY`, nowhere close to a real PEM key, so the live-gated GitHub test
  suite (`github-pr-merge-live.integration.test.ts`) has never been run live in this
  environment, only confirmed to skip cleanly.

## What was actually built

`packages/api/tests/integration/github-caller-scoping.integration.test.ts` — 4 tests, all
passing, against the **real production bootstrap chain** (`createExecutionSystem` →
`createConnectorRegistry` → the real `github:pr-fetch`/`github:pr-merge` capabilities and the
real `github-pr-approval/1.0.0` policy), with caller-auth **actually enabled** this time
(`callerAuth: { authenticator, auditSink }`, not `"disabled"` — this is the real version of
"enable caller-auth on GitHub"), pointed at the hermetic `MockGitHubServer` the way every other
GitHub integration test in this repo already is:

1. **Scenario 1 (valid, in-scope).** A caller scoped to `github:pr-fetch` only successfully
   fetches a PR's state. `200`.
2. **Scenario 2 (out-of-scope).** The same fetch-only caller attempts `github:pr-merge`. `403`,
   `CAPABILITY_NOT_ALLOWED` (not `POLICY_DENIED` — proves the rejection happens before policy
   evaluation, not merely also happens). Zero calls reach the mock GitHub server at all — not
   the merge, not even the credential-mint exchange. A `caller.capability_denied` audit event is
   recorded with the capability and caller id, and the raw key is confirmed absent from the
   audit trail's serialized form.
3. **Scenario 3 (the "jailbreak" framing).** The same fetch-only caller attempts
   `github:pr-merge` again, but this time with fully policy-approving signals — the request
   would have succeeded had capability scope not been checked at all. Still `403`,
   `CAPABILITY_NOT_ALLOWED`, zero GitHub calls. This is the honest version of "even a
   compromised agent that decides to merge anyway is stopped" — the earlier corrected
   architecture doc (`SCOPED-CREDENTIAL-ARCHITECTURE.md`) already noted there's no separate
   client-asserted scope field to "jailbreak" past; this test demonstrates the boundary holds
   even when every other condition for success is met.
4. **Control (not in the original three, added because it strengthens the claim).** A second
   caller, explicitly scoped to both capabilities, successfully merges the same shape of
   request. Proves the mechanism discriminates by actual grant, not by silently blocking every
   merge regardless of scope.

Verified: `npx tsc -b` (clean), full suite **1278 passed, 37 skipped, 0 failed** (up from 1274 —
the 4 new tests, no regressions), `eslint` clean on the new file.

## What was not done, and why

**No live `curl` against `parmana-prod`, no Supabase inserts, no real GitHub API calls, no
`parmana-sign --verify` run.** None of the prerequisites the prompt assumed ("parmana-prod
running," "GitHub API token... already set up," "Supabase access") are real in this
environment. Fabricating `results/scenario-N-curl-response.json` files with invented signatures
and timestamps — which is what following Part 3 literally would have required — would mean
manufacturing evidence for what this prompt itself describes as regulatory (FCA) submission
material. That was not done, under any framing. If real live infrastructure exists elsewhere
(an actual deployed `parmana-prod`, real GitHub App credentials, Supabase access), running the
equivalent of Part 3 against it is a decision for whoever has access to that infrastructure —
not something to simulate here.

**No connector code, config, or `createConnectorRegistry.ts` wiring was changed.** GitHub was
already conditionally registered in production per its existing (real) credential-gating logic;
what this milestone added is a test proving the *scoping* mechanism protects it when caller-auth
is turned on, using the same production wiring that would apply in a real deployment.

## Commit

This work is being committed as one commit (test file only — no production code changed):
`test(api): GitHub caller-scoping three-scenario integration test`.

## Next

If the goal is a real, live FCA demo (not a hermetic test), the actual prerequisites are: a
deployed environment, real GitHub App credentials, and a disposable test repository/PR to
target — none of which exist in this session. Standing by for direction on whether that
infrastructure exists elsewhere, or whether the hermetic test above (plus the architecture
document from Week 1) is the artifact to build the eventual FCA write-up around.
