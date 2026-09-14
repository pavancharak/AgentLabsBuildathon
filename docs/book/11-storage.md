[← Book Index](README.md) · [← Previous: Chapter 10, Connectors](10-connectors.md)

# Chapter 11: Storage

`packages/storage/src/{StorageProvider,StorageFactory}.ts`, `memory/`, `supabase/`, `postgres/`.

## One facade, two real backends

```
src/
  StorageEngine.ts, StorageBuilder.ts, StorageProvider.ts, StorageFactory.ts, StorageConfiguration.ts
  memory/     MemoryStorageProvider.ts + Memory{BusinessTransaction,ChallengeRecord,ExecutionTrustRecord,PendingPolicyChange,PolicyChangeApprovalRecord,PolicyRepository,RefusalRecord}Repository.ts
  supabase/   SupabaseStorageProvider.ts, SupabaseClientFactory.ts, Supabase{...same set...}Repository.ts, Supabase{Nonce,ApprovalNonce,PolicyChangeStepUpNonce}Store.ts
  postgres/   PostgresPoolFactory.ts, PostgresChallengeRecordRepository.ts
```

`StorageProvider` is the facade every consumer actually depends on, `businessTransactions`,
`trustRecords`, `refusalRecords`, `pendingPolicyChanges`, `policyChangeApprovalRecords`, each
a repository interface defined in `@parmana/shared` and implemented twice, once per backend.
`StorageFactory.createFromEnvironment()` is the single dispatch point: `NODE_ENV === "test"`
always resolves to `MemoryStorageProvider`, regardless of any other configuration; otherwise
it switches on `PARMANA_STORAGE` (`memory` | `supabase`; `postgres`/`sqlite` are declared but
unimplemented).

That test-mode short-circuit is not incidental convenience; it closes a real gap. Before it
existed, `PARMANA_STORAGE`'s value was resolved as an _import-time side effect_ in
`packages/api/src/repositories.ts`, which meant test collection itself could crash with
supabase-js's generic `"supabaseUrl is required."` error on any machine that hadn't set
`SUPABASE_*`, with no connection to the actual test being run. Making the test-mode
short-circuit explicit and eager, rather than an accident of how `repositories.ts` happened
to construct things, is documented as closing exactly this (`docs/VERIFICATION-GAPS.md`
G-15).

## Fail fast, name the exact gap

`StorageFactory` validates configuration before constructing anything: choosing
`PARMANA_STORAGE=supabase` with `DATABASE_URL` unset fails immediately with an error naming
both facts, rather than letting `PostgresPoolFactory` throw its own generic message, or
building a pool that "only fails on first use." A misconfigured process should never bind a
port and pass a health check only to fail on its first real request. This is the same
fail-closed-at-startup discipline `assertStorageConfigured()`/`assertSigningKeyMaterialConfigured()`
apply in `server.ts` before the port is ever bound (Chapter 12).

## Why Supabase-backed repositories talk to Postgres directly now

`SupabaseExecutionTrustRecordRepository` and its siblings write through `PostgresPoolFactory`
(a direct `DATABASE_URL` connection) rather than `SupabaseClientFactory`/PostgREST. The
source comment explains the motivation was removing PostgREST from every Supabase-backed
table's failure mode, "not just the audit sinks that broke first," implying PostgREST-layer
failures were an observed, recurring problem before this change, not a hypothetical one.
`SupabaseExecutionTrustRecordRepository`'s own ordering logic is worth noting too:
`ORDER BY <timestamp> ASC, seq ASC`, where `seq` is a Postgres `BIGSERIAL` the class never
explicitly assigns, a tie-break the database itself guarantees monotonic, reproducing an
ordering correctness fix already independently proven by a dedicated integration test.
Tutorial 93 (`examples/tutorials/93-trust-record-ordering`) covers the same property from
the reader's side: a trust record's collections preserve insertion order through a full
round trip, with hash and signature both still valid on reload.

## What's never in-memory, even when `PARMANA_STORAGE=memory`

Independent of `PARMANA_STORAGE`, three things are **always** Supabase-backed in production:
the Execution Gateway's replay-nonce store (Chapter 7), the caller authentication audit
trail (Chapter 13), and, as of the policy-governance milestone, the step-up authorization
nonce store (Chapter 14). The reasoning is structural, not a preference: these are the
mechanisms that make a single-use guarantee or an audit trail actually durable across process
restarts and horizontal replicas. Letting them silently fall back to in-memory storage would
quietly convert "this can only happen once, ever" into "this can only happen once per process
lifetime," which is a materially weaker and differently-shaped guarantee that a deployment
operator might never notice changed. `NonceStore`'s own doc comment (Chapter 7) states this
directly as a production warning, not an implementation detail: in-memory storage means a
replay becomes possible again after any restart, within the original TTL window.

## Applying schema changes

Any Supabase-backed component needs its schema in `supabase/migrations/` actually applied to
the target project, a manual step, either via `supabase db push` (if the CLI is linked) or by
running `scripts/apply-all-migrations.sql` (a chronological concatenation of every migration
file, safe to re-run because every statement is already idempotent:
`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) through the Supabase Dashboard's SQL
Editor. An unapplied table surfaces as PostgREST's `PGRST205` ("Could not find the table... in
the schema cache") on every request touching it, even with otherwise-correct credentials,
worth knowing as the first thing to check if a Supabase-backed deployment behaves as though a
feature simply doesn't exist.

---

[← Book Index](README.md) · [← Previous: Chapter 10, Connectors](10-connectors.md) · [Next: Chapter 12, The API and HTTP Boundary →](12-api-http-boundary.md)
