# Progress: self hosted deployment and repository orientation

Started: 2026-09-25. Last updated: 2026-09-25.

This page tracks the two initiatives set on 2026-09-25. It records what is done and verified, not the plan's targets. Gap numbers refer to `docs/VERIFICATION-GAPS.md`. Claims stay governed by `docs/CLAIMS.md`: nothing here is a claim until it is promoted there.

## Initiative 1: self hosted deployment next to the hosted API

Goal as set: a deployment the customer runs, with enforcement that does not depend on the hosted service on Vercel, and one regulated customer running it. Soft launch target in the plan: 2026-10-10, with a decision gate on 2026-10-09 and a fallback of 2026-10-20.

| Phase                                            | State              | Evidence or next step                                                                                                                                                |
| ------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Audit Supabase coupling, console sync, Vercel | Done 2026-09-25    | Gaps G-56 to G-60 opened.                                                                                                                                            |
| 2a. Storage selectable by name                   | Done 2026-09-25    | G-57 closed. `PARMANA_STORAGE=postgres` works, with tests. SQLite not built, see below.                                                                              |
| 2b. Console sync extraction                      | Dropped 2026-09-25 | G-59 closed as not needed. Nothing to extract: audit events already stay in the deployment's own Postgres.                                                           |
| 3. Docker packaging                              | Done 2026-09-25    | G-56 and G-58 closed. `docker-compose.yml` starts everything with one command; keys, API key, roles, migrations and policies are handled; a second start keeps them. |
| Offline enforcement run                          | Done 2026-09-25    | G-60 closed. `bash docker/local/offline-check/run.sh`: 12 of 12 on each clean run, with no internet route. Found G-61 (fixed for this path) and G-62 (open).         |
| `DEPLOYMENT.md` and website docs                 | Done 2026-09-25    | `DEPLOYMENT.md` "Self hosted with Docker Compose"; `docs/site/deployment/local.mdx` and `environment-variables.mdx`; `docs/CLAIMS.md` 2.40.                          |
| CI on Linux                                      | Added, not run     | Job `self-hosted` in `.github/workflows/docker-image.yml`. Runs on the first push.                                                                                   |
| Commit and merge                                 | Needs the operator | Nothing committed, at the operator's request.                                                                                                                        |
| Customer deployment                              | Needs the operator | No customer is named in the repository. Their own people must approve their policies before anything is authorized (G-62 describes the tooling this needs today).    |
| Series A slides                                  | Needs the operator | Not in this repository.                                                                                                                                              |

### Where the plan and the code differ

Recorded so the plan can be corrected before work depends on it.

1. **SQLite.** The plan asks for SQLite and Postgres storage. Every non test deployment already needs Postgres, because `createCallerAuditSink.ts` and `createNonceStore.ts` require `DATABASE_URL`. A self hosted Postgres already works under the name `supabase`. Renaming is small; SQLite would be a new storage layer for every repository, audit sink and nonce store.
2. **Console sync and `/audit-metadata`.** Neither exists (G-59).
3. **Port.** The plan's checklist uses `http://localhost:9000/health`. The server listens on `PORT`, default `3000`, and the image exposes `3000`.
4. **Test count.** The plan's bar is 1,200 or more passing tests. `npx vitest run` on 2026-09-25: 2,056 passed, 42 skipped, 0 failed, 246 files.
5. **Source documents.** `PARMANA-SAAS-LOCAL-EXECUTION-PLAN.md`, `PARMANA-SAAS-LOCAL-SERIES-A-PITCH.md`, `CLAUDE-API-PACKAGE.md` and `PARMANA-CLAUDE-STUDY-REPO-END-STATE.md` are not in this repository.

### Verification checklist status (2026-09-25, after the build)

| Check                                                          | State                                                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Full test suite passes                                         | Yes, see "Test runs" below                                                                                                             |
| `docker compose up` works                                      | Yes, on Docker Desktop 29.8.0, Windows 11. `GET /ready` READY, `401` without a key, `400` with the key and an empty body (port `3000`) |
| A restart keeps keys, data and policies                        | Yes, SHA-256 of the key files unchanged, `0 applied`, `0 added`, audit rows kept                                                       |
| Enforcement works with no outbound network                     | Yes, 12 of 12 checks on a Docker network with `internal: true`                                                                         |
| Signatures verify with only the public key                     | Yes, inside the check and again on the host with `scripts/verify-trust-record.ts`                                                      |
| The same on Linux                                              | Not yet, the CI job has not run                                                                                                        |
| A customer runs it, with audit decisions recorded and verified | No                                                                                                                                     |

### Test runs (2026-09-25)

| Run                                          | Result                                                  |
| -------------------------------------------- | ------------------------------------------------------- |
| `npx vitest run`, before the build           | 2,056 passed, 42 skipped, 0 failed                      |
| `npx vitest run`, after the build            | 2,069 passed, 42 skipped, 0 failed, 246 files           |
| `npm run lint`, `npx tsc -b packages/api`    | Clean                                                   |
| `bash docker/local/offline-check/run.sh`     | 12 of 12, on four clean runs                            |
| `scripts/verify-trust-record.ts` on the host | `valid: true` for the record saved by the offline check |

## Initiative 2: repository orientation for AI assisted work

Goal as set: an orientation document at the repository root and one in `packages/api/`, so an assistant can learn the codebase quickly.

| Item                                       | State                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `CLAUDE.md` as a codebase orientation | Not done. The root `CLAUDE.md` holds AWS toolkit rules. The orientation document the plan describes was written outside the repository and has not been added. |
| `packages/api/CLAUDE-API-PACKAGE.md`       | Not in the repository.                                                                                                                                         |
| `PARMANA-CLAUDE-STUDY-REPO-END-STATE.md`   | Not in the repository.                                                                                                                                         |

When these are added, check every entry point and command they name against the code, and correct the document where they differ.
