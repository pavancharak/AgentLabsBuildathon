# Parmana: Current State

> Not a roadmap. No dates, no version targets, no performance numbers that
> don't exist in this repo. Every line below was verified directly against
> source or a command actually run, on 2026-09-08, except the test counts
> and the self hosted deployment section, verified on 2026-09-25. Where something is
> mentioned elsewhere in this repo's docs/comments but doesn't exist in
> code, that is stated explicitly, not implied.

## What's real and working

**Core pipeline** (`RuntimeEngine.execute()`, `packages/runtime`): load a
policy → check it against a capability→policy binding map → check its
`boundSignals` against the actual execution intent → evaluate deterministic
rules (`PolicyEngine.evaluate()`, pure function, no I/O) → on approval, sign
an authorization (Ed25519 by default; ML-DSA-65 — Node's native
`ml-dsa-65` key type, referred to in code as "Dilithium3" — under
`CRYPTO_MODE=hybrid`) → `ExecutionGateway` independently re-verifies that
signed authorization before any connector runs → connector executes with a
single-use, credential-isolated session, destroyed after use → a signed
`ExecutionTrustRecord` is produced.

**Reachable today** (`packages/api/src/bootstrap/createConnectorRegistry.ts`,
read directly): exactly two real external systems, each gated on real
credentials being configured — HubSpot (`HUBSPOT_PRIVATE_APP_TOKEN`) and
GitHub (`GITHUB_APP_ID`/`GITHUB_INSTALLATION_ID`/`GITHUB_APP_PRIVATE_KEY`) —
plus a `test-fixture` connector gated to `NODE_ENV=test`. Four real
capabilities exist: `hubspot:deal-fetch`, `hubspot:deal-update`,
`github:pr-fetch`, `github:pr-merge`.

**Storage**: `@parmana/storage`'s `StorageFactory` selects `memory` or
Postgres. `postgres` and `supabase` select the same Postgres storage
(since 2026-09-25, G-57). `sqlite` is not a valid `PARMANA_STORAGE` value,
and the factory still throws "not implemented" for it. The Postgres backend goes through a
raw `pg.Pool`, not `supabase-js`/PostgREST. Tests always force `memory`
regardless of configuration.

**Package version**: `0.1.0` (`package.json`). There is no tagged release
history in this repository.

**Tests**: 2,069 passing, 42 skipped, 0 failing across 246 test files
(231 passed, 15 skipped). Run directly with `npx vitest run` on
2026-09-25, after the self hosted deployment build, branch
`feat/self-hosted-deployment`. The skips are suites gated on live
credentials that skip cleanly when none are configured. (Earlier the same
day, before the build: 2,056 passing. On 2026-09-08: 1,551 passing, 38
skipped.)

## Self hosted deployment (built 2026-09-25)

Audited and then built on 2026-09-25, on the uncommitted branch
`feat/self-hosted-deployment`. Progress against the plan is tracked in
`docs/progress/2026-09-25-SELF-HOSTED-AND-ORIENTATION.md`. The operator guide
is `DEPLOYMENT.md`, section "Self hosted with Docker Compose". The claim is
`docs/CLAIMS.md` 2.40, and the gaps are G-56 to G-62 in
`docs/VERIFICATION-GAPS.md`.

**What works, verified by running it (Docker Desktop 29.8.0, Windows 11):**

- **One command start.** `docker compose up -d --build --wait` starts
  `setup` (keys and an API key in `./parmana-local`, made inside the image),
  `postgres`, `migrate` (roles, then each migration once, recorded in
  `parmana_schema_migrations`), `seed` (shipped policies into the
  `policies` table, never overwriting) and `api` (the unchanged production
  image, `PARMANA_STORAGE=postgres`). A second start keeps keys, API keys,
  data and policies.
- **`PARMANA_STORAGE=postgres`** selects the same Postgres storage as
  `supabase`, which is unchanged (G-57).
- **Enforcement with no internet route.** `bash
docker/local/offline-check/run.sh` runs a copy of the stack on a Docker
  network with `internal: true` and passed 12 of 12 checks on each clean
  run: policy approval by a second human with a step up signature, an
  authorized refund executed, a refused refund never released, and the
  Trust Record verified with only the public keys (G-60).
- **Nothing to extract for "console sync".** Audit events were already
  written to the deployment's own Postgres in the same request. The item
  was dropped (G-59).

**Found while building it:**

- `scripts/apply-all-migrations.sql` is not safe to run again on a database
  with data, although its header said so. Corrected, and the Compose
  deployment applies each migration once instead (G-61).
- A new deployment authorizes nothing until its own people approve its
  policies through governance. That is kept on purpose, but the approval
  tools are TypeScript scripts that need the repository and Node.js on the
  approver's machine (G-62, open).

**Unchanged:**

- The hosted API on Vercel. `vercel.json`, `api/index.ts` and the two
  `@vercel/*` packages (loaded only when `AWS_ROLE_ARN` or
  `PARMANA_GITHUB_VERCEL_CONNECT_CONNECTOR_ID` is set) are not used by the
  container.
- The container still does not migrate by itself. Only the Compose
  deployment does.
- There is still no SQLite storage, and none is needed.

**Not yet verified:** the CI job `self-hosted` on Linux (added, not run,
nothing pushed), a real downstream system instead of the stand in, and any
customer running it.

## Policy governance (built this session)

A maker-checker approval flow for changes to policy content: real
endpoints (`POST /policies/:name/:version/pending-changes`, `.../approve`,
`.../reject`), a real step-up signature layer independent of the caller's
bearer token, and real signed, hash-chained approval records
(`PolicyChangeApprovalRecord`).

An execution-time enforcement gate (`PolicyGovernanceExecutionVerifier`,
wired into `RuntimeEngine`) exists in code and can refuse execution against
a policy with no approval record, an invalid approval-record signature, or
tampered content. Since 2026-09-20 it is
enforced by default in production (relaxed only when `NODE_ENV` is `test` or `development`), and
`ExecutionGateway` fails closed on policy binding as well (`docs/CLAIMS.md` §2.36).

Signing under AWS KMS handles messages over the 4096 byte KMS raw limit by signing a fixed size
commitment (ADR-0010, `docs/CLAIMS.md` 2.37), verified live against the real KMS service on
2026-09-20. Before release the runtime proves signing works and refuses with 503 if not, and a failure
after release is reported as EXECUTION_RECORD_INCOMPLETE (ADR-0011, `docs/CLAIMS.md` 2.38). On 2026-09-21
the ordering gap G-52 was closed by Execution Intents (ADR-0012, `docs/CLAIMS.md` 2.39): a signed intent is
stored before release, release is refused with 503 EXECUTION_INTENT_UNAVAILABLE if that fails, and a missing
Trust Record (G-53) can be rebuilt with `POST /execution-intents/{id}/finalize` without calling the
connector. Verified live with a real KMS key and a real Postgres. The migration
`20260921120000_add_execution_intents.sql` must be applied before deploying. Still open: finalize cannot
rebuild a record when the execution context was not saved (409), and the SDK methods for intents shipped in SDK 1.2.0 on 2026-09-21 (G-55). An
intent reconciled by hand is closed with `POST /execution-intents/{id}/resolve` (G-54, an unsigned operator
statement).

**Current real database state** (queried directly this session, not
assumed): all 10 policies that have ever been proposed through this
system's own API are `PENDING_APPROVAL`, proposed by the same account. None
have been approved by a distinct human reviewer. Because enforcement is now on in production, executions under a policy with no
approval record are refused until that changes.

## On disk, but not reachable

10 policy files exist under `policies/`. Only 2 (`github-pr-approval`,
`hubspot-deal-update`) correspond to a capability any registered connector
can actually invoke. The other 8 — `access-control`, `connector-capability`,
`customer-refund`, `database-change`, `llm-tool-call`,
`production-deployment`, `rag-document-access`, `vendor-payment` — have no
connector that can invoke them today. They are reference/example content,
not live surface.

## Dead code: deleted (2026-09-08)

Everything below was confirmed to have zero non-self references (rechecked
fresh immediately before deletion, not assumed from this document's own
first draft) and has been removed:

- `@parmana/receipt` — the entire package
- `packages/runtime/src/policy/*` — a second, structurally incompatible
  `PolicyRouter`/`PolicyEngine`/`PolicyValidator` implementation, distinct
  from the real one in `@parmana/policy`; had a live bug
  (`PolicyRegistry.getPolicy()` ignored its own lookup and always
  constructed a fresh `PolicyEngine`), harmless only because nothing called
  it — plus its own dedicated test, `tests/unit/policy-router.test.ts`
- `packages/runtime/src/ports/*`, `services/DecisionService.ts`,
  `services/override-service.ts`, `RuntimeGatewayAuthenticator.ts` (0 bytes)
- `packages/storage`'s `StorageEngine`/`StorageBuilder`/`AppendOnlyLedger`/
  `LedgerEntry`/`LedgerSerializer` subsystem and its three toy in-memory
  repositories — a second, incompatible, in-memory-only "ledger," unrelated
  to the real audit trail — plus its three dedicated tests, and
  `@parmana/replay`'s `ReplayContext.ts` (its only real consumer)
- Eight orphaned files in `@parmana/crypto` (`LocalFileKeyManager.ts`, the
  four `GatewayAuthentication*.ts` files, `modules/CryptoModule.ts` +
  `BuiltinCryptoModule.ts`, a duplicate `KeyProvider` interface)
- Five dead types in `@parmana/shared` (`types/Verification.ts`,
  `ExecutionStatus.ts`, `ExecutionProof.ts`, `ExecutionTransaction.ts`,
  `Metadata.ts` — the last three were exported from the package root despite
  zero consumers anywhere in this monorepo; their export lines were removed
  too)

**Two things this document originally flagged turned out not to be dead on
closer inspection, and were kept:** `packages/runtime/src/components/
ReceiptComponent.ts` is a deliberately-kept, documented, exported extension
point (not wired into the default pipeline, but genuinely used/tested), and
`packages/crypto/scripts/generate-keypair.ts` is actually invoked by
`examples/04-verified-execution/run.ts` — a real caller this document missed
the first time. Full repo `npx tsc -b` and `npx vitest run` clean after the
cleanup: 1,539 passed, 38 pre-existing skips, 0 failed.

## Explicitly does not exist in this codebase

Stated plainly because each of these has been asserted as real in prompts
handed to this session, and none of them are:

- **No Stripe connector code anywhere.** The only Stripe references in this
  repo are inside one architecture doc's own test allowlist, explicitly
  marked as a hypothetical "how you'd add a new vendor" walkthrough — never
  real code.
- **No Razorpay connector.** One existed previously and was deliberately
  deleted; only a few dangling code comments referencing it remain.
- **No multi-tenant isolation of any kind.** A single optional
  `tenantId?: string` field exists on transaction metadata
  (`packages/shared/src/domain/metadata.ts`) with zero enforcement, zero
  row-level scoping by it, and zero isolation logic anywhere in the
  request path.
- **No performance/load-testing harness or benchmark results exist in this
  repo.** No throughput or latency number attributed to this system has any
  basis in code here.
- **No `packages/cli`.** Every operational task (key generation, step-up
  signing, policy approval) is a plain `npx tsx scripts/*.ts` invocation or
  a direct HTTP call — there is no compiled CLI binary.

## Known structural limitations, read directly from the implementation

- Rate limiting (`express-rate-limit`) is per-process, in-memory by
  default: a fleet of N machines has N independent limits, not one
  shared limit, **unless `DATABASE_URL` is configured**, in which case
  both the `/execute` and `/health`,`/ready` limiters share a durable
  Postgres-backed count fleet-wide (`PostgresRateLimitStore`, added
  2026-09-10, `docs/VERIFICATION-GAPS.md` G-41).
- Session/credential state (`InMemoryGatewaySessionStore`,
  `InMemorySessionCredentialVault`) is in-memory, single-process. Not a
  limitation in practice: both are strictly intra-request objects,
  created and consumed within one synchronous `POST /execute` call, with
  no HTTP response or second endpoint that could ever hand one back to
  this process later. Investigated directly 2026-09-10 (traced every
  caller) after an external audit framed this as needing persistence;
  confirmed it does not. See `docs/VERIFICATION-GAPS.md`'s "Gaps checked
  and found not applicable" section.
- `HttpExecutionSystem`'s `timeout` option is declared
  (`ExecutionSystemClientOptions.ts`) but never referenced anywhere in the
  implementation — confirmed by grep: not enforced.
- `DefaultExecutionSystem.execute()` unconditionally returns `success: true`
  for any request — a no-op stub. Not used by any real connector path
  today, but would silently "succeed" everything if ever wired in by
  mistake.
- Capability→policy binding coverage is 4 of 12 policies/capabilities. A
  fail-closed startup check (`assertConnectorCapabilitiesBound`) stops a
  _newly registered_ capability from shipping unbound, but does not
  retroactively bind the 8 currently-unreachable policies.
- Signing keys are read from disk files (`FileKeyProvider`) at a fixed
  default key ID; there is no key-rotation mechanism in code.
