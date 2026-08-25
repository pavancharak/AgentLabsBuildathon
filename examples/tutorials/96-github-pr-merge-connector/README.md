# Tutorial 96 — GitHub PR Merge Connector

## Objective

Execute a real GitHub pull-request merge through the same production composition (`createExecutionSystem` + `createApplication`) `server.ts` itself calls, pointed at a hermetic `MockGitHubServer` instead of GitHub's live API.

## What You'll Learn

* The full path from a `BusinessTransaction` with `intent.action = "github:pr-merge"` through policy evaluation to an actual merge call against the connector
* That an approved merge results in a real (mocked) side effect: the pull request's `mergedAt` actually changes on the GitHub server, and `mockServer.mergeCalls` proves exactly one network call was made
* How GitHub's credential differs from HubSpot's: it's ephemeral (a JWT-signed exchange for a short-lived installation token on every `resolve()` call, not a single static token), and under `NODE_ENV=test` with no `TEST_GITHUB_*` triple set, `createGitHubCredentialProvider.ts` generates a fresh, never-real RSA keypair automatically — no `.env` empty-string override needed the way Tutorial 69 needs for HubSpot

## Running the Tutorial

```bash
npx tsx examples/tutorials/96-github-pr-merge-connector/run.ts
```

## Why This Matters

This mirrors `packages/api/tests/integration/github-pr-merge.integration.test.ts`'s approved case: a pull request meeting every policy signal (repository authorized, required reviews completed, status checks passed, branch protected, risk within threshold) is approved and actually executed, with the mock server's own state — not just the returned decision — as proof. It's the third production connector proven through this exact composition, after Razorpay (historical, see `docs/CLAIMS.md` §3.8–§3.9) and HubSpot (Tutorial 69) — concrete evidence the authorization core is connector-agnostic rather than built around any one integration.

## Next Tutorial

Continue with **Tutorial 97 – Execution Chain Integrity**.
