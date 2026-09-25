# Deployment

How to run `@parmana/api` as a container, on any Docker-based platform.
Platform-agnostic by design — this was validated with a bare `docker build`
/ `docker run`, not against any specific PaaS's proprietary build system.

## Quick start

```sh
docker build -t parmana-api .

docker run -p 3000:3000 \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e PARMANA_API_KEYS='[{"callerId":"...","keyHash":"..."}]' \
  -v /path/to/keys:/app/keys:ro \
  parmana-api
```

The process fails closed on missing configuration — see below for exactly
what's required and why. `GET /health` (liveness) and `GET /ready`
(readiness — see [Health checks](#health-checks)) are both served once the
process is up.

## Self hosted with Docker Compose

For running Parmana on your own infrastructure, next to or instead of the
hosted API. One command starts the API and its own Postgres. Nothing is sent
to Parmana or anywhere else: decisions, signatures, the audit trail and the
Trust Records stay in this deployment.

**You need** Docker with Compose v2.24 or newer, and a clone of this
repository. Nothing else is needed on the host.

### Start it

```sh
docker compose up -d --build --wait
```

This runs, in order (`docker-compose.yml`):

| Service    | What it does                                                                                                                                                                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup`    | The first time, makes the two Ed25519 key pairs (`default` signs authorizations and Trust Records, `gateway` signs the Execution Gateway's attestations) and one API key, in `./parmana-local`. On every later start it keeps what exists (`docker/local/setup.mjs`). |
| `postgres` | The deployment's own database, in the Docker volume `parmana_postgres-data`. Not published to the host.                                                                                                                                                               |
| `migrate`  | Creates the roles the migrations expect, then applies each file in `supabase/migrations/` once, in its own transaction, recorded in `parmana_schema_migrations` (`docker/local/migrate.sh`). An upgrade applies only the new files.                                   |
| `seed`     | Copies the policies shipped in the image into the `policies` table, adding only versions that are not there yet. It never overwrites a policy changed through policy governance (`docker/local/seed-policies.mjs`).                                                   |
| `api`      | The same image as the hosted API, in production mode, with `PARMANA_STORAGE=postgres`. Published on `127.0.0.1:3000`.                                                                                                                                                 |

Then:

```sh
curl http://127.0.0.1:3000/ready
# {"status":"READY","authDisabled":false}
```

### Settings

Set these in the shell or in a `.env` file next to `docker-compose.yml`:

| Variable                             | Default          | Meaning                                                                                                                                                |
| ------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PARMANA_DB_PASSWORD`                | `parmana-local`  | Postgres password. Change it for anything but a trial, before the first start.                                                                         |
| `PARMANA_BIND`                       | `127.0.0.1`      | Host address the API is published on. Put a TLS proxy in front before publishing it beyond the host.                                                   |
| `PARMANA_PORT`                       | `3000`           | Host port.                                                                                                                                             |
| `PARMANA_LOCAL_ALLOWED_CAPABILITIES` | `paytm:refund`   | Capabilities the generated API key may use, comma separated. Read only when the key is made.                                                           |
| `PARMANA_LOCAL_CALLER_ID`            | `local-operator` | Caller ID of the generated API key. The key may only act for this principal ID (see [Caller authentication](#caller-authentication-parmana_api_keys)). |

Connectors are configured the same way as for the hosted API (see
[Everything else](#everything-else)), by adding their variables to the `api`
service, for example in a `docker-compose.override.yml`.

### What is in `./parmana-local`

| File                 | Holds                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keys/*.private.pem` | The two signing private keys, mode `0600`. Back them up: without them no new record can be signed with the same key, though old records still verify. |
| `keys/*.public.pem`  | The public keys. Give these to anyone who needs to verify a Trust Record.                                                                             |
| `api-keys.json`      | The `PARMANA_API_KEYS` value the API starts with. Holds only the API key's SHA-256 hash.                                                              |
| `api-key.txt`        | The API key itself, written once. Move it to a secret store, then delete this file.                                                                   |
| `offline-check/`     | Output of the offline check, below.                                                                                                                   |

The directory is in `.gitignore` and `.dockerignore`. On Linux its files
belong to uid 1000, the image's `node` user, which the API runs as. Read the
API key with:

```sh
docker compose run --rm --no-deps --entrypoint cat setup /app/parmana-local/api-key.txt
```

### Before the first authorized request: approve your policies

In production every policy must have completed policy governance before it
can authorize anything (`docs/CLAIMS.md` 2.35). `seed` puts the shipped
policies in the database, but it does not approve them, because an approval
is a decision your own people make and record. Until a policy is approved, a
request under it is refused with `403 POLICY_DENIED` and "has no
PolicyChangeApprovalRecord".

Approval takes two different verified humans: a proposer, and an approver
with a step up key. Issue their API keys with `scripts/generate-api-key.ts`
(`--caller-id <id> --credential-holder-type USER`, plus
`--generate-step-up-key` for the approver), add the printed entries to the
array in `parmana-local/api-keys.json`, run
`docker compose restart api`, then:

1. The proposer sends `POST /policies/{name}/{version}/pending-changes` with
   the policy content and a reason.
2. The approver signs a step up authorization with
   `scripts/sign-policy-change-step-up.ts` and sends
   `POST /policies/pending-changes/{id}/approve`. The proposer is refused.

`docker/local/offline-check/check.mjs` performs exactly these two steps and
can be read as a worked example.

### Upgrade

```sh
git pull
docker compose up -d --build --wait
```

`migrate` applies only the migrations the database does not have, and
`seed` adds only new policy versions. Keys and API keys are kept.

### Offline check: prove enforcement without the internet

```sh
bash docker/local/offline-check/run.sh
```

It builds the images while the internet is reachable, then starts a
separate copy of the stack (its own project, `parmana-offline-check`, and
its own database) on a Docker network created with `internal: true`, so no
container in it has a route to the internet or to Parmana. It uses the
deployment's own signing keys and its own throwaway API keys, and checks:

1. the network has no internet route;
2. the API reports READY;
3. policy governance works: a proposer proposes the `customer-refund`
   policy, is refused as its own approver, and a second human approves it
   with a signed step up authorization;
4. an authorized refund returns `200` and reaches the downstream system,
   which verifies the Execution Gateway's signature with only the public key;
5. a refund the policy's rules refuse returns `403 POLICY_DENIED` and never
   reaches the downstream system;
6. the Trust Record verifies with only the public keys, and a copy with one
   changed field does not.

The downstream system is a stand in for `parmana-paytm-agent`
(`docker/local/offline-check/paytm-agent-stand-in.mjs`). It never calls
Paytm. It serves HTTPS with a certificate made for the run, because the API
refuses a plain HTTP connector URL in production, and the API trusts that
one certificate for the run only.

It ends with `12 of 12 checks passed` and leaves the Trust Record and the
public keys in `parmana-local/offline-check/`. Anyone can verify that record
again, on any machine, with only the public keys:

```sh
npx tsx scripts/verify-trust-record.ts parmana-local/offline-check/trust-record.json \
  default=parmana-local/offline-check/default.public.pem \
  gateway=parmana-local/offline-check/gateway.public.pem
```

The check removes its own containers and database when it ends. The
deployment started with `docker compose up` is not touched.

### Stop, or remove everything

```sh
docker compose down        # stop; the database and ./parmana-local are kept
docker compose down -v     # also delete the database
```

Deleting `./parmana-local` deletes the signing keys. Only do that on
purpose.

### Limits

- One API instance with one Postgres. No high availability or replicas are
  set up.
- Signing keys are files on the host. For keys held in a key service, see
  AWS KMS signing (`docs/site/deployment/aws-kms-signing.mdx`).
- Tested on 2026-09-25 with Docker Desktop 29.8.0 on Windows 11. The CI job
  `self-hosted` in `.github/workflows/docker-image.yml` runs the same steps
  on Linux; it has not run yet.

## What's in the image

One image, one process, started by `docker/entrypoint.sh`: the API server
(`node packages/api/dist/server.js`). Its exit, for any reason, brings the
container down.

`docker/entrypoint.sh` forwards `SIGTERM`/`SIGINT` to the API server and
waits for it to exit before the container exits, so an orchestrator's
graceful-shutdown signal reaches the actual Node process rather than
killing it outright.

## Required configuration

Everything below is validated **eagerly, before the port is bound**
(`assertStorageConfigured`, `assertSigningKeyMaterialConfigured`,
`createCallerAuthenticator`, and friends, all called from `server.ts` before
`app.listen`). A misconfigured process never boots "successfully" and fails
later on the first real request — it exits immediately with a clear error
naming exactly what's missing.

### Signing key material (always required)

Every execution authorization, receipt, verification, and settlement
confirmation is signed. Two key pairs are required in `PARMANA_KEY_DIR`
(default `./keys`, already set in the image):

- `default.private.pem` / `default.public.pem` — the authorization-signing
  key.
- `gateway.private.pem` / `gateway.public.pem` — the Gateway's
  attestation-signing key, deliberately separate (`PARMANA_GATEWAY_KEY_ID`
  overrides the `gateway` id if you need a different one).

`KEY_PROVIDER` (optional, defaults to `local`/`FileKeyProvider`, the only
provider actually implemented) fails startup loudly if set to
`aws-kms`/`azure-key-vault`/`gcp-kms`/`hsm`. Those are reserved,
forward-compatible config values with no real implementation yet, not a
choice you can make today.

`PARMANA_GATEWAY_ID` (optional, defaults to `parmana-gateway`) is this
process's logical Gateway identity, distinct from `PARMANA_GATEWAY_KEY_ID`
above (that's a key file prefix). Set a distinct value per environment or
tenant if you run more than one logically distinct gateway against the
same audit trail.

Neither is generated automatically. Two ways to provide them:

1. **Mount a volume or platform secret file** at `/app/keys` containing all
   four `.pem` files — the image's `keys/` starts empty on purpose (see
   `.dockerignore`; key material must never be baked into the image).
2. **`PARMANA_KEY_MATERIAL_JSON`** — for platforms with no persistent-volume
   or secret-file primitive. A JSON object,
   `{ "<keyId>": { "privateKeyPem": string, "publicKeyPem": string } }`,
   written to `PARMANA_KEY_DIR` at boot for any file that doesn't already
   exist there (a pre-mounted file always wins, never overwritten). Needs
   entries for both `default` and `gateway` keyIds.

Generate a throwaway pair locally with:

```sh
openssl genrsa -out default.private.pem 2048
openssl rsa -in default.private.pem -pubout -out default.public.pem
```

(repeat for `gateway.{private,public}.pem`.)

### Storage (`PARMANA_STORAGE`)

- `memory` (default) — no external dependency; fine for a single-instance
  deployment with no durability guarantee across restarts.
- `postgres`: any Postgres, reached through `DATABASE_URL`. The name to
  use for a self hosted database.
- `supabase`: the same implementation as `postgres` (it also reads only
  `DATABASE_URL`, not `SUPABASE_URL`), kept so existing deployments are
  unchanged. Both are validated eagerly at boot, not lazily on first
  request.

Independent of `PARMANA_STORAGE`: the caller-authentication audit trail
(`CallerAuditSink`) and the envelope-verifier's replay-protection store
(`NonceStore`) are **always** Supabase-backed in production (`NODE_ENV !=
test`) — never falls back to in-memory, regardless of what `PARMANA_STORAGE`
is set to. Both fail closed at startup if `DATABASE_URL` is not configured.
In practice this means a real (non-test) deployment always needs
`DATABASE_URL` set, even if `PARMANA_STORAGE=memory` is chosen for the
business-transaction/execution-trust-record data.

### Applying the schema (Supabase)

`PARMANA_STORAGE=supabase` (or any non-test deployment, per the note above —
`DATABASE_URL`/Supabase is always required for the audit trail and nonce
store) needs the schema in `supabase/migrations/` actually applied to the
target Supabase project. This is a manual step this runbook previously
omitted — the gap surfaced as PostgREST returning `PGRST205` ("Could not
find the table ... in the schema cache") on every request touching an
unapplied table, even though the connection itself was fine and credentials
were valid.

Two ways to apply it:

1. Supabase CLI, if linked to the project: `supabase db push`.
2. No CLI link, or a Dashboard-only workflow: run
   `scripts/apply-all-migrations.sql` (a concatenation of every file in
   `supabase/migrations/`, in chronological order, unmodified) once, in
   full, via the Supabase Dashboard's SQL Editor, on an empty database.
   **Not safe to run again on a database that already holds data:** several
   migrations drop and add back the same CHECK constraint, and running it
   again adds an older constraint back over newer rows, which fails
   (`docs/VERIFICATION-GAPS.md` G-61). For an existing database apply only
   the new files, as shown below. The Docker Compose deployment does this
   for you (`docker/local/migrate.sh`).

After applying, PostgREST's schema cache can lag behind the newly created
tables until it reloads. If `GET /ready` (or any Supabase-backed route)
still returns `PGRST205` immediately after applying migrations, force a
reload rather than waiting: Dashboard → Database → API → "Reload schema
cache", or `NOTIFY pgrst, 'reload schema';` via the SQL Editor.

**Upgrading an existing deployment: apply the new migration BEFORE you deploy.**
Execution Intents (ADR-0012) are enforced by default and cannot be switched off
in production. A new version running without the `execution_intents` table
refuses every execution with `503 EXECUTION_INTENT_UNAVAILABLE`. Apply only the
new file first:

```
psql "$DATABASE_URL" -f supabase/migrations/20260921120000_add_execution_intents.sql
psql "$DATABASE_URL" -tA -c "select to_regclass('public.execution_intents')"
```

The second command must print `execution_intents`. The migration only adds a
table, is safe to run twice, and changes no existing table.

### Caller authentication (`PARMANA_API_KEYS`)

A JSON array of `{ "callerId": string, "keyHash": string }` entries.
Refuses to start with no caller authentication configured. For local
development only, `PARMANA_AUTH_DISABLED=true` bypasses this (logs a loud
warning on every boot) — never set this in a real deployment.

### Policy directory (`PARMANA_POLICY_DIR`)

Already set to `./policies` in the image (the committed `policies/`
directory is baked in). Override only if a platform needs to mount a
different policy set.

### HubSpot (optional)

Unset by default — the connector simply isn't registered, and the API boots
normally without it. To enable:

- `HUBSPOT_PRIVATE_APP_TOKEN` — enables the connector
  (`hubspot:deal-update`, etc.). A long-lived, static credential with no
  built-in expiry. Rotate it periodically (recommended: every 90 days,
  or immediately on suspected exposure) via HubSpot's app settings, and
  set `HUBSPOT_PRIVATE_APP_TOKEN_ROTATED_AT` (ISO 8601) every time you do.
  Without it, or once it's over 90 days old, startup logs a warning
  naming the actual age.

### Rate limiting (`RATE_LIMIT_EXECUTE_PER_MINUTE`, `RATE_LIMIT_HEALTH_PER_MINUTE`)

Both optional (defaults `30`/`300`). When `DATABASE_URL` is configured,
both limiters share counts fleet-wide via a durable Postgres-backed
store; without it, each machine counts independently, so a horizontally
scaled deployment's effective ceiling is `limitPerMinute * machineCount`,
not the configured value. Set `DATABASE_URL` before scaling past one
machine if you need the configured limit to actually be the limit.

### Everything else

`PORT` (default `3000`, read dynamically for platforms — Railway, Render,
Fly — that inject it at deploy time), `LOG_LEVEL`, `CRYPTO_MODE`,
`HASH_PROVIDER`, `PRIMARY_SIGNATURE_PROVIDER`, `TRUST_PROFILE`,
`RECEIPT_VERSION`, `EXECUTION_AUTHORIZATION_TTL_SECONDS`,
`SHUTDOWN_TIMEOUT_MS` (default `10000`, see below) all have working
defaults and rarely need to be set. See `packages/shared/src/config/Config.ts`
for the authoritative list — it's the only place `process.env` is read for
application config.

## Health checks

- **`GET /health`** — pure liveness, no external dependency touched.
- **`GET /ready`**: readiness. When storage is Postgres backed
  (`PARMANA_STORAGE=postgres` or `supabase`), runs one cheap `SELECT 1` to
  confirm the connection and credentials actually work, returning `503` if not — so an
  orchestrator can tell "up but backed by dead storage" apart from
  "genuinely ready" and route around it. When storage is `memory`, there's
  no external dependency to probe, so it reports ready unconditionally.
  When Execution Intents are enforced (the default in production), it also
  checks that the `execution_intents` table exists and returns `503` with
  `NOT_READY` and the migration file name when it does not, so a skipped
  migration is caught here and not on the first real request.
  Also carries `authDisabled` (plus a `warning` string when true) in every
  response. Set up a synthetic check on this field if `PARMANA_AUTH_DISABLED`
  is ever set in a real deployment; it should never be.

## Graceful shutdown

On `SIGTERM`/`SIGINT`: the API server stops accepting new connections, lets
in-flight requests finish, then exits — the "drain, don't drop" shape a
PaaS orchestrator expects before it force-kills the container.
`SHUTDOWN_TIMEOUT_MS` (default `10000`) bounds how long a hung in-flight
request (e.g. a stalled downstream call to Supabase or HubSpot) can delay
shutdown before the process force-exits on its own terms.

## Pre-deploy: verify policy changes are approved

`scripts/verify-policy-changes-approved.ts` is the preventive Policy
Governance gate (maker-checker): it confirms every
`policies/{name}/{version}/policy.json` matches a real, signed
`PolicyChangeApprovalRecord` for its exact content, closing the gap that
a direct file edit (or a `git push` straight to `main`, which nothing in
this repo's current GitHub plan technically prevents — see the CI
workflow's own comment) bypasses the maker-checker API entirely. CI runs
this automatically, scoped to whatever `policies/**/policy.json` changed
in a given push or PR. There is no automated deploy pipeline in this
repo to hook the same check into (deployment is the manual
`docker build`/`fly deploy` steps below), so this is the manual backstop:
run it, full-scan, immediately before every deploy.

```sh
SUPABASE_URL=... SUPABASE_ANON_KEY=... \
  npx tsx scripts/verify-policy-changes-approved.ts --full-scan
```

It exits non-zero — and fails closed the same way on a Supabase outage as
on a genuine finding, never silently passing — if any live policy file
doesn't match its most recent approval record.

**Enforcement is on by default (2026-09-20).** Execution time policy verification and the
Execution Gateway's fail closed policy binding are active everywhere except when `NODE_ENV` is
exactly `test` or `development`. In production, `POLICY_EXECUTION_VERIFICATION_ENFORCED` is
ignored and cannot turn enforcement off. Before promoting a deployment, every policy it
executes against must have a signed approval record in `policy_change_approval_records`, or
executions under that policy are refused. Authorizations that carry no `policyContentHash`
are also refused. After a deploy, confirm the startup log line `runtime_engine_constructed`
shows `policyExecutionVerifierConfigured: true`.

**Signing readiness is on by default (2026-09-20, ADR-0011).** Before each action is released to a
connector the runtime signs and verifies a probe artifact through the evidence signing key, at most once
a minute per instance, and returns `503 SIGNING_UNAVAILABLE` with nothing executed if that fails. Under
KMS the role needs `kms:Sign` and `kms:GetPublicKey` on the signing key, which a working deployment
already has. After a deploy, confirm the startup log line `runtime_engine_constructed` shows
`signingReadinessConfigured: true`. A failure after the action was released is `500
EXECUTION_RECORD_INCOMPLETE`, which must be reconciled, not retried as a new transaction.

**Execution Intents are on by default (2026-09-21, ADR-0012).** Before each action is released, the
runtime signs and stores an Execution Intent, and returns `503 EXECUTION_INTENT_UNAVAILABLE` with nothing
executed if it cannot. Under KMS this is one more `kms:Sign` per released action, with the same
permissions. After a deploy, confirm the startup log line `runtime_engine_constructed` shows
`executionIntentsConfigured: true`. A `500 EXECUTION_RECORD_INCOMPLETE` can now be repaired: a verified
human credential calls `POST /execution-intents/<businessTransactionId>/finalize`, which rebuilds the
signed record without calling the connector. Check `GET /execution-intents/unfinalized` regularly. The full
procedure is the docs site page `concepts/execution-intents`.

**The legacy-policy caveat, and what to actually do about it.** Every
policy version that existed before Policy Governance was built has no
approval record at all, because none of them were ever proposed or
approved through the API — they were simply committed. As of this
writing that's all 10 current policy versions (`access-control/1.0.0`,
`connector-capability/1.0.0`, `customer-refund/1.0.0`,
`database-change/3.0.0`, `github-pr-approval/1.0.0`,
`hubspot-deal-update/1.0.0`, `llm-tool-call/1.0.0`,
`production-deployment/1.0.0`, `rag-document-access/1.0.0`,
`vendor-payment/2.0.0`). **The first `--full-scan` run will flag every
one of them — this is correct behavior, not a false positive or a
bug to work around.**

Two legitimate ways to handle this, and only one of them is safe:

- **Treat the first run as informational only.** Run `--full-scan`, read
  the list, don't wire its exit code into anything blocking yet. This is
  the right choice if you're not ready to commit to backfilling coverage
  immediately — it tells you exactly what's currently ungoverned without
  pretending otherwise.
- **Backfill real coverage, one policy at a time.** For each legacy
  policy, propose its _current, unchanged_ content as a pending change
  through the real API (`POST /policies/{name}/{version}/pending-changes`)
  and have a genuinely distinct human checker approve it through the real
  step-up flow (`scripts/sign-policy-change-step-up.ts`) — establishing a
  real `PolicyChangeApprovalRecord`, with a real proposer and a real
  checker, for the content as it exists today. This is real, if
  repetitive, human work — a "no-op" proposal per policy, not a rubber
  stamp, since the checker is still expected to actually look at the
  content before approving it.

**Do not** hand-insert rows into `policy_change_approval_records` to make
the check pass, and do not have this script (or any script) synthesize
approval records for content nobody actually reviewed. This table exists
specifically to be trustworthy evidence of who approved what, when — a
backdated or fabricated row would defeat the entire purpose of the
feature it's meant to support, permanently, since there's no way to
later distinguish a real approval from a manufactured one once it's in
the table.

Once backfilled, `--full-scan`'s exit code becomes meaningful as a hard
pre-deploy gate; run it and stop the deploy on failure, the same
discipline CI already applies to PRs.

## Fly.io specifics

Validated this session against a real `parmana-api` Fly app.

- **Secrets**: `scripts/generate-fly-secrets.mjs` generates
  `PARMANA_KEY_MATERIAL_JSON` and `PARMANA_API_KEYS` (single `smoke-test`
  caller) locally (never printed), leaving `SUPABASE_URL` /
  `SUPABASE_SERVICE_ROLE_KEY` / `HUBSPOT_PRIVATE_APP_TOKEN` as placeholders
  to fill in, then `fly secrets import < .flysecrets/secrets.env` (or `fly
secrets set PARMANA_STORAGE=supabase` etc. individually) to apply.
  Rotating any secret restarts every machine to pick it up — `fly status`
  should show a recent "last updated" and passing health checks before
  treating the new value as live.
- **Region**: `fly.toml` declares `primary_region = 'bom'`, but machine
  placement is Fly's choice at create time — confirm actual placement with
  `fly status` rather than assuming the configured primary region; this
  deployment's machines run in `lhr`.
- **Smoke test**: `GET /health` and `GET /ready` should both return `200`
  post-deploy; an unauthenticated `POST /execute` should return `401` with
  a `WWW-Authenticate` header, confirming caller auth is actually wired
  rather than accidentally disabled.

## Local verification performed this session

- `docker build` succeeds from a clean checkout.
- No config at all → fails closed with a clear error, exit code `1`
  (signing key material missing).
- Full valid config → `/health` and `/ready` both return `200`; `SIGTERM`
  produces a clean shutdown with no hang and no force-exit.
- `npm test`, `npm run lint`, and `npx tsc -b` all clean on the code shipped
  in this image.
