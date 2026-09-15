# Database Schema Reference

**Status:** Verified against the live production database (2026-09-16) and all 28
`supabase/migrations/*.sql` files, read in chronological order — several tables were altered
by 4-5 later migrations each (most notably `caller_audit_events` and `execution_audit_events`,
whose `type` CHECK constraints were each widened repeatedly), so the shape below is the
**final, cumulative** schema, not just what the original `CREATE TABLE` said.

**Companion documents:** `docs/02-architecture/STORAGE.md` (the abstract Storage Layer
architecture spec — read that first for the conceptual model); `docs/operations/aws-kms-vercel-oidc-setup-guide.md`
and `docs/operations/2026-09-15-kms-migration-troubleshooting-guide.md` (operational
history that touches several of these tables). This document is the concrete "what table,
what column, why, and how do I query it" reference neither of those is.

## How to use this document

Each table's section states: what it's for, its final column list, which migrations built
it (in order), what application code owns it, and RLS status. Part 2 is a library of
real, copy-pasteable SQL for troubleshooting, auditing, and verifying schema state — the
kind of queries actually used tonight to diagnose a real production incident (see the
troubleshooting guide referenced above).

**Connecting:** every query below assumes a direct Postgres connection via `DATABASE_URL`
(the same one the application itself uses — Parmana connects directly via `pg`, not through
PostgREST, which is why RLS being enabled on most tables doesn't block the application: a
direct Postgres connection with the database's own credentials bypasses RLS entirely, the
same way a Postgres superuser or the table owner does. RLS matters here for what a
different credential — e.g. Supabase's `anon`/`authenticated` roles via PostgREST — could
see, not what this codebase's own `DATABASE_URL` connection can).

```bash
psql "$DATABASE_URL"
# or, from Node, using this repo's own convention:
node -e 'require("dotenv").config(); const {Pool}=require("pg"); const pool=new Pool({connectionString:process.env.DATABASE_URL,min:1}); /* ... */'
```

---

## Part 1 — Table-by-table reference

### Quick index

| Table                                   | One-line purpose                                                                        | Owning code                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `business_transactions`                 | The initial received request, as submitted                                              | `SupabaseBusinessTransactionRepository`        |
| `executions`                            | Append-only log of execution attempts for a transaction                                 | `SupabaseExecutionTrustRecordRepository`       |
| `execution_trust_records`               | The signed, final trust record for a transaction (one per transaction that reached one) | `SupabaseExecutionTrustRecordRepository`       |
| `verifications`                         | Log of independent verification calls                                                   | `SupabaseExecutionTrustRecordRepository`       |
| `receipts`                              | Signed receipts issued for a transaction                                                | `SupabaseExecutionTrustRecordRepository`       |
| `settlement_confirmations`              | Signed settlement confirmations                                                         | `SupabaseExecutionTrustRecordRepository`       |
| `overrides`                             | Backing table for `OverrideService` — **deliberately unreachable**, expect empty        | `SupabaseExecutionTrustRecordRepository`       |
| `refusal_records`                       | Signed record of a policy/binding REJECT                                                | `SupabaseRefusalRecordRepository`              |
| `caller_audit_events`                   | Every caller-auth decision (auth success/failure, capability/principal checks)          | `SupabaseCallerAuditSink`                      |
| `execution_audit_events`                | Execution-control lifecycle events — **shared cross-repo with `parmana-paytm-agent`**   | `SupabaseExecutionAuditSink`                   |
| `pending_policy_changes`                | Maker-checker: a proposed policy change awaiting approval                               | `SupabasePendingPolicyChangeRepository`        |
| `policy_change_approval_records`        | Maker-checker: the signed approval/rejection of a pending change                        | `SupabasePolicyChangeApprovalRecordRepository` |
| `consumed_nonces`                       | Replay protection for Gateway Authorization envelopes                                   | `SupabaseNonceStore`                           |
| `consumed_approval_nonces`              | Replay protection for Approval Artifacts (separate namespace)                           | `SupabaseApprovalNonceStore`                   |
| `consumed_policy_change_step_up_nonces` | Replay protection for a human checker's step-up key (separate namespace)                | `SupabasePolicyChangeStepUpNonceStore`         |
| `challenge_records`                     | Investigation records for disputed claims — the only mutable table here                 | `PostgresChallengeRecordRepository`            |
| `rate_limit_counters`                   | Fleet-wide rate-limit counters — the only table without RLS                             | `PostgresRateLimitStore`                       |

**Not covered here:** `supabase_migrations.schema_migrations` (Supabase CLI's own tracking
table, a different schema — see Part 2's migration-sync queries). Three Razorpay tables
(`razorpay_webhook_events`, `razorpay_webhook_audit_events`, `razorpay_daily_refund_reservations`)
were dropped 2026-09-16 (`20260916120000_drop_razorpay_tables.sql`) — orphaned schema from
the Razorpay connector, removed from this codebase entirely on 2026-08-12.

---

### `business_transactions`

**Why it exists:** the durable record of a request exactly as submitted to `POST /execute`
— authority, authorization, intent, policy reference, and signals, all as originally
received, before any decision is made.

**Created:** `20260629013035_initial_schema.sql`. Never altered since.

**Columns:**

| Column                    | Type                   | Notes       |
| ------------------------- | ---------------------- | ----------- |
| `business_transaction_id` | `TEXT`                 | Primary key |
| `status`                  | `TEXT NOT NULL`        |             |
| `authority_json`          | `JSONB NOT NULL`       |             |
| `authorization_json`      | `JSONB NOT NULL`       |             |
| `intent_json`             | `JSONB NOT NULL`       |             |
| `metadata_json`           | `JSONB NOT NULL`       |             |
| `policy_json`             | `JSONB NOT NULL`       |             |
| `signals_json`            | `JSONB NOT NULL`       |             |
| `created_at`              | `TIMESTAMPTZ NOT NULL` | Indexed     |

RLS: enabled, no policies (service-role/direct-connection only).

---

### `executions`

**Why it exists:** append-only log of execution attempts for a transaction — the full
`execution_json` blob (decision, evidence, chain hash/signature — this is where the
_actual current outcome_ of a transaction lives, not `business_transactions.status`, which
is never updated after initial receipt).

**Created:** `20260629013035_initial_schema.sql` (`execution_id` PK, `business_transaction_id`
FK `ON DELETE RESTRICT`, `execution_json JSONB`, `created_at`). Altered by `20260711120000`:
added `seq BIGSERIAL` — an exact insertion-order tiebreak, since millisecond timestamps can
tie under fast/concurrent appends and UUIDs carry no ordering.

Indexed on `business_transaction_id` and `created_at`. RLS enabled.

**A transaction can have multiple `executions` rows** — this is the append-only sequence,
not a single mutable status field.

---

### `execution_trust_records`

**Why it exists:** the final, signed Execution Trust Record — the artifact an independent
verifier checks. **Not every `business_transactions` row gets one** — a policy rejection
never reaches this table (it gets a `refusal_records` row instead).

**Created:** `20260629013035_initial_schema.sql` (`trust_record_id` PK,
`business_transaction_id TEXT NOT NULL UNIQUE` + FK RESTRICT, `transaction_json`,
`trust_record_hash`, `created_at`, `updated_at`). Altered twice:

- `20260702183000` — added `signature_json JSONB` (nullable, GIN-indexed) — persisting the
  Trust Record's own signature, previously computed but not stored.
- `20260907120000` — added `authorization_json JSONB` (GIN-indexed, the
  `SignedExecutionAuthorization` itself), `schema_version INTEGER`, `signatures_json JSONB`
  (hybrid/post-quantum signature support — without this, a pre-hybrid record round-tripping
  through this table would silently lose its second signature).

RLS enabled.

---

### `verifications`

**Why it exists:** log of independent verification calls made against a transaction.

**Created:** `20260629013035_initial_schema.sql` (`verification_id` PK, FK RESTRICT,
`verification_json`, `verified_at`). `seq BIGSERIAL` added `20260711120000` (same ordering
reason as `executions`). Indexed on `business_transaction_id` and `verified_at`. RLS enabled.

---

### `receipts`

**Why it exists:** signed receipts issued for a transaction.

**Created:** `20260629013035_initial_schema.sql` (`receipt_id` PK, FK RESTRICT,
`receipt_json`, `issued_at`). `seq BIGSERIAL` added `20260711120000`. Indexed on
`business_transaction_id` and `issued_at`. RLS enabled.

---

### `settlement_confirmations`

**Why it exists:** signed confirmations that a transaction actually settled.

**Created:** `20260718190412_add_settlement_confirmations_and_audit_severity.sql` (M4b),
"mirrors `receipts`' shape exactly." Columns: `confirmation_id TEXT` PK,
`business_transaction_id TEXT NOT NULL`, `confirmation_json JSONB NOT NULL`,
`issued_at TIMESTAMPTZ NOT NULL`, `seq BIGSERIAL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
Indexed on `business_transaction_id`. RLS enabled. Append-only, never mutated/deleted.

**Worth knowing:** unlike every other `business_transaction_id`-bearing table created in
the initial schema, this one has **no foreign key constraint** back to `business_transactions`
— added later (M4b) rather than in the original schema. Not confirmed whether this is
deliberate or an inconsistency; worth asking before relying on referential integrity here
the way you safely can for `executions`/`verifications`/`receipts`/`execution_trust_records`.

---

### `overrides`

**Why it exists:** backing table for `OverrideService`. **Expect this table to stay empty
by design** — `OverrideService` is deliberately unreachable in this codebase (a standing
security guard documented in `02-REMAINING.md` says not to wire it up). An empty table here
is not a gap or a bug; it's the intended state.

**Created:** `20260629013035_initial_schema.sql`, identical shape to `executions`
(`override_id` PK, FK RESTRICT, `override_json`, `created_at`; `seq BIGSERIAL` added
`20260711120000`). RLS enabled. Never altered further.

---

### `refusal_records`

**Why it exists:** the signed record of a policy or signal-binding REJECT. **Scope is
narrow**: only `PolicyEngine.evaluate` rejections and `SignalIntentBinder` binding-violation
rejections land here — caller-auth failures go to `caller_audit_events` instead, and
webhook failures go elsewhere again. Don't assume this table is "every rejection in the
system."

**Created:** `20260802120000_add_refusal_records.sql` (RFC-0021). Columns:
`refusal_record_id` PK, `business_transaction_id TEXT NOT NULL UNIQUE` + FK RESTRICT,
`decision_json NOT NULL`, `evaluated_intent_json NOT NULL`, `binding_violations_json`
(nullable), `submitted_by` (nullable), `refusal_record_hash TEXT NOT NULL`,
`signature_json JSONB NOT NULL` — **signed from creation**, unlike `execution_trust_records`
which had an unsigned period before `20260702183000` retrofitted it. Indexed on
`created_at`. RLS enabled.

---

### `caller_audit_events`

**Why it exists:** every caller-authentication and authorization-scoping decision — the
highest-write-volume table in the system (fires on every authenticated request). This is
what tonight's whole Pfinite-onboarding debugging session was ultimately traced through.

**Created:** `20260718090000_add_nonce_and_caller_audit_tables.sql` (G-13). **The most
altered table in the schema — 8 migrations total.** Final cumulative shape:

| Column                                                | Type                                 | Added by            | Notes                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                  | `BIGSERIAL PRIMARY KEY`              | initial             |                                                                                                                                                                                                                                                                  |
| `type`                                                | `TEXT NOT NULL CHECK (...)`          | initial, widened 5x | see below                                                                                                                                                                                                                                                        |
| `occurred_at`                                         | `TIMESTAMPTZ NOT NULL`               | initial             | Indexed                                                                                                                                                                                                                                                          |
| `route`                                               | `TEXT NOT NULL`                      | initial             |                                                                                                                                                                                                                                                                  |
| `caller_id`                                           | `TEXT`                               | initial             | nullable — present only for `caller.authenticated`. Indexed                                                                                                                                                                                                      |
| `reason`                                              | `TEXT`                               | initial             | nullable — present only for `caller.rejected`, never a credential value                                                                                                                                                                                          |
| `inserted_at`                                         | `TIMESTAMPTZ NOT NULL DEFAULT now()` | initial             |                                                                                                                                                                                                                                                                  |
| `signature_json`                                      | `JSONB`                              | `20260802130000`    | nullable — signed from this point forward; earlier rows stay honestly unsigned                                                                                                                                                                                   |
| `capability`                                          | `TEXT`                               | `20260812120000`    | nullable, indexed WHERE NOT NULL                                                                                                                                                                                                                                 |
| `principal_id`                                        | `TEXT`                               | `20260816120000`    | nullable, indexed WHERE NOT NULL                                                                                                                                                                                                                                 |
| `severity`                                            | `TEXT`                               | `20260818130000`    | nullable                                                                                                                                                                                                                                                         |
| `business_transaction_id`                             | `TEXT`                               | `20260824090000`    | nullable, indexed WHERE NOT NULL                                                                                                                                                                                                                                 |
| `chain_hash`, `previous_chain_hash`, `chain_position` | `TEXT`, `TEXT`, `BIGINT`             | `20260906120000`    | all nullable — chained **per `caller_id`** via a Postgres advisory lock on `hashtext(caller_id)`, not one global lock (avoids serializing the whole API through a single lock). Rows with no `caller_id` (malformed-body rejections) stay unchained by necessity |

**`type`'s final allowed values** (widened 5 times — `20260812120000`, `20260816120000`,
`20260818130000`, `20260824090000`, `20260911090000`):
`'caller.authenticated'`, `'caller.rejected'`, `'caller.capability_denied'`,
`'caller.principal_denied'`, `'caller.non_human_denied'`, `'caller.structural_rejected'`,
`'caller.capability_granted'`.

**A real bug lives in this history, worth knowing about if you ever add a new event type
here:** `20260911090000` was a _bug-fix_ migration — application code had already been
writing `'caller.capability_granted'` for a while before any migration allowed that value
in the CHECK constraint, which meant **every successful, authenticated request was failing
closed with `503 AUDIT_UNAVAILABLE`** until the constraint was widened. Adding a new
`CallerAuditEvent` type in application code and forgetting the matching migration
reproduces this exact outage.

RLS enabled.

---

### `execution_audit_events`

**Why it exists:** durable execution-control lifecycle events (`session.created`,
`execution.completed`, `execution.rejected`). **This table is shared cross-repo**:
`parmana-paytm-agent` (a separate repository) writes to it directly via its own
`src/parmana/audit.ts`, correlated by `business_transaction_id` — this is the _only_ table
in this schema written to by code outside this repo. See `docs/connectors/PAYTM_CONNECTOR.md`.

**Created:** `20260914120000_add_execution_audit_events.sql` (GAP-1). Altered twice:

- `20260914130000` — added `business_transaction_id TEXT` (nullable, indexed) as **the
  cross-service correlation key** (`authorization_id` is Parmana-internal and never
  forwarded to `parmana-paytm-agent`); also relaxed `signature_json`/`chain_hash`/
  `chain_position` from `NOT NULL` to nullable, specifically so `parmana-paytm-agent`'s rows
  — it holds no Parmana private key, only the public key, so it cannot sign or chain — can
  coexist with this repo's own signed, chained rows.
- `20260914140000` — widened the `type` CHECK to add `'authorization.verified'`, the event
  `parmana-paytm-agent` records right after verifying Parmana's signature.

**Final `type` values:** `'session.created'`, `'execution.completed'`,
`'execution.rejected'`, `'authorization.verified'`.

Full column list: `id BIGSERIAL PK`, `type`, `occurred_at TIMESTAMPTZ NOT NULL`,
`connector_id TEXT NOT NULL`, `authorization_id TEXT NOT NULL`, `session_id TEXT NOT NULL`,
`action TEXT`, `reason TEXT` (rejected-only, the connector's own thrown error message,
never a credential), `credential_id TEXT`, `gateway_id TEXT`, `signature_json JSONB`,
`chain_hash TEXT`, `previous_chain_hash TEXT`, `chain_position INTEGER`,
`inserted_at TIMESTAMPTZ DEFAULT now()`, `business_transaction_id TEXT`.

**Chained per `authorization_id`**, not per-caller (unlike `caller_audit_events`) — "one
authorization's full execution lifecycle is the unit a regulator asks about." Indexed on
`occurred_at`, `authorization_id`, `connector_id`, `business_transaction_id`. RLS enabled.

This is exactly the table queried tonight (by `business_transaction_id`) to find the real
reason a cross-service Paytm refund failed when Parmana's own logs only showed an opaque
`500` — see Part 2's "trace one transaction across every table" query.

---

### `pending_policy_changes`

**Why it exists:** maker-checker — a proposed policy content change awaiting a distinct
human's approval or rejection.

**Created:** `20260818120000_add_policy_governance_tables.sql`. Columns:
`pending_policy_change_id` PK, `policy_name`/`policy_version TEXT NOT NULL`,
`proposed_content_json JSONB NOT NULL`, `proposed_by TEXT NOT NULL`,
`proposed_at TIMESTAMPTZ NOT NULL`, `status TEXT NOT NULL CHECK (status IN
('PENDING_APPROVAL','APPROVED','REJECTED'))`, `reason TEXT NOT NULL`, `resolved_by TEXT`,
`resolved_at TIMESTAMPTZ`, `rejection_reason TEXT`.

**A real database-level invariant, not just an application check:** a partial unique index,
`ux_pending_policy_changes_open` on `(policy_name, policy_version) WHERE status='PENDING_APPROVAL'`
— enforces "at most one open change per policy" at the database level, not just in
application code. Indexed on `status`. RLS enabled. Never altered further.

---

### `policy_change_approval_records`

**Why it exists:** the signed record of a human checker's approval or rejection of a
pending policy change.

**Created:** `20260818120000_add_policy_governance_tables.sql` alongside
`pending_policy_changes`. Columns: `policy_change_approval_record_id` PK,
`pending_policy_change_id TEXT NOT NULL REFERENCES pending_policy_changes(...) ON DELETE RESTRICT`,
`policy_name`/`policy_version`/`proposed_by`/`approved_by TEXT NOT NULL`,
`proposed_at`/`approved_at TIMESTAMPTZ NOT NULL`, `content_hash_before TEXT` (nullable),
`content_hash_after TEXT NOT NULL`, `signature_json JSONB NOT NULL`. `20260907130000` added
`previous_record_hash TEXT` (nullable) — chains the approval-record history itself,
distinct from `content_hash_after` (which only proves the live policy file matches what was
approved, not that the approval history itself is tamper-evident).

Indexed on `(policy_name, policy_version, approved_at DESC)`.

**RLS is not just "enabled, no policies" here** — `20260818150000` grants the `anon` role
**read-only** `SELECT` on this table specifically, for CI (`SUPABASE_ANON_KEY`), deliberately
scoped to this one table rather than reusing the application's own RLS-bypassing
`DATABASE_URL`. This is the only table in the schema with a real RLS policy attached.

As of 2026-09-15 (`docs/operations/policy-approval-runbook.md`), this table has **zero
rows** — none of the 10 real production policies have actually been approved by a distinct
human checker yet. An empty table here is an accurate, expected state, not a bug.

---

### `consumed_nonces`, `consumed_approval_nonces`, `consumed_policy_change_step_up_nonces`

**Why three separate tables, not one:** each backs a distinct trust domain's own nonce
namespace — a Gateway Authorization envelope's nonce, an Approval Artifact's nonce, and a
human checker's step-up-key nonce, respectively — issued by different parties for different
purposes. Sharing one table would let a coincidental collision between two unrelated
namespaces falsely report "already consumed." This is a deliberate design choice, not
duplication to clean up.

**All three share the identical shape:**

| Column         | Type                        | Notes                                                                                                                                                                                                                                                              |
| -------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (nonce column) | `TEXT PRIMARY KEY`          | **The primary key IS the atomicity mechanism** — concurrent inserts for the same nonce race at the database level; one wins, the loser gets Postgres error `23505 unique_violation`, mapped by application code to "already consumed." No separate locking needed. |
| `expires_at`   | `TIMESTAMPTZ NOT NULL`      | Indexed; not currently read back by application code — reserved for a future cleanup job that doesn't exist yet                                                                                                                                                    |
| `consumed_at`  | `TIMESTAMPTZ DEFAULT now()` |                                                                                                                                                                                                                                                                    |

**Created:** `consumed_nonces` by `20260718090000_add_nonce_and_caller_audit_tables.sql`;
`consumed_approval_nonces` by `20260805180000_add_consumed_approval_nonces.sql`;
`consumed_policy_change_step_up_nonces` by `20260818140000_add_consumed_policy_change_step_up_nonces.sql`.
None altered since creation. RLS enabled on all three.

---

### `challenge_records`

**Why it exists:** investigation records for a disputed claim (RFC-0022) — the **only
mutable table in this entire schema**. Every other table here is append-only by convention
(some enforced at the application layer, none by a DB trigger); this one is explicitly
updated as an investigation proceeds (`status`, `investigation_steps_json`, `finding_json`,
`outcome_json`, `disclosure_json` all get updated in place).

**Created:** `20260803150000_add_challenge_records.sql`. Columns: `challenge_record_id` PK,
`status TEXT NOT NULL CHECK (status IN ('open','investigating','resolved'))`,
`claim_challenged TEXT NOT NULL`, `source_json JSONB NOT NULL`,
`investigation_steps_json JSONB NOT NULL DEFAULT '[]'`, `finding_json`/`outcome_json`/
`disclosure_json` (nullable JSONB), `supersedes TEXT` (deliberately **no** foreign key —
tolerant of independent pruning of the record it supersedes), `created_at`/`updated_at
TIMESTAMPTZ NOT NULL`. Indexed on `status` and `created_at`. RLS enabled.

**Deliberately unsigned**, unlike `refusal_records`/`execution_trust_records`: "the party
who could misrepresent it is the same party who writes it; a signature would prove
tamper-evidence of bytes while leaving the actual trust question unaddressed." Append-only
history within a record is enforced at the application layer
(`PostgresChallengeRecordRepository.append`), not a database constraint.

---

### `rate_limit_counters`

**Why it exists:** fleet-wide rate-limit counters, shared across every process pointed at
the same database — the durable counterpart to `express-rate-limit`'s default in-process
`MemoryStore`.

**Created:** `20260910120000_add_rate_limit_counters.sql`. Columns: `key TEXT PRIMARY KEY`
(a caller ID for `/execute`'s limiter, a client IP for `/health`,`/ready`'s limiter — as of
tonight's fix, **prefixed per limiter**, `"execute:"`/`"health:"`, so the two limiters'
keys can never collide even if the same raw value appeared in both), `count INTEGER NOT NULL`,
`reset_time TIMESTAMPTZ NOT NULL`. Indexed on `reset_time` (for a housekeeping job that
doesn't exist yet — the table self-corrects without one, since the upsert resets an expired
row's count on its next hit).

**The only table in this schema without RLS enabled** — deliberately: "rows here carry no
business or trust-record data, only ephemeral counters... no end-user or dashboard access
path exists," so a restrictive policy would add operational surface without a
corresponding threat.

See `docs/VERIFICATION-GAPS.md` G-49 for why this table's key-prefixing matters — sharing
one `Store` instance across two limiters (both ultimately backed by this same table)
violates `express-rate-limit`'s own documented contract.

---

## Part 2 — Common SQL for troubleshooting, audit, and verification

All examples assume a `pool`/`psql` session against `DATABASE_URL`. Replace
`$BUSINESS_TRANSACTION_ID` / `$CALLER_ID` / etc. with real values.

### Trace one transaction across every table (the most useful cross-table query)

The single most useful troubleshooting query — everything that ever happened for one
`business_transaction_id`, across every table that could reference it:

```sql
SELECT 'business_transactions' AS source, created_at AS at, status::text AS detail
  FROM business_transactions WHERE business_transaction_id = $1
UNION ALL
SELECT 'executions', created_at, (execution_json->>'status')
  FROM executions WHERE business_transaction_id = $1
UNION ALL
SELECT 'execution_trust_records', created_at, trust_record_hash
  FROM execution_trust_records WHERE business_transaction_id = $1
UNION ALL
SELECT 'refusal_records', created_at, refusal_record_hash
  FROM refusal_records WHERE business_transaction_id = $1
UNION ALL
SELECT 'execution_audit_events', occurred_at, type || COALESCE(': ' || reason, '')
  FROM execution_audit_events WHERE business_transaction_id = $1
UNION ALL
SELECT 'caller_audit_events', occurred_at, type
  FROM caller_audit_events WHERE business_transaction_id = $1
ORDER BY at;
```

This is exactly the pattern used tonight to find that `parmana-paytm-agent` had recorded
`authorization.verified` for a transaction Parmana's own logs only showed a generic `500`
for — the `execution_audit_events` rows (written by _both_ repos) told the real story.

### Trace one caller's full audit history

```sql
SELECT type, route, occurred_at, capability, principal_id, reason
FROM caller_audit_events
WHERE caller_id = $1
ORDER BY occurred_at DESC
LIMIT 50;
```

### Verify a caller's audit chain hasn't been tampered with

```sql
-- Walk chain_hash -> previous_chain_hash per caller_id; a break means either
-- a gap in the chain or a mismatch between consecutive rows.
SELECT id, occurred_at, chain_hash, previous_chain_hash
FROM caller_audit_events
WHERE caller_id = $1
ORDER BY chain_position;
```

### Check whether a specific capability grant/denial pattern is happening

```sql
SELECT capability, type, COUNT(*)
FROM caller_audit_events
WHERE occurred_at > now() - interval '1 hour'
GROUP BY capability, type
ORDER BY COUNT(*) DESC;
```

### Find every rejection reason for a policy, recently

```sql
SELECT decision_json->>'reason' AS reason, COUNT(*)
FROM refusal_records
WHERE created_at > now() - interval '24 hours'
GROUP BY reason
ORDER BY COUNT(*) DESC;
```

### Check a rate limiter's current state for a caller

```sql
SELECT key, count, reset_time,
       (reset_time > now()) AS window_still_active
FROM rate_limit_counters
WHERE key = 'execute:' || $1;  -- or 'health:' || <ip> for the health/ready limiter
```

### Confirm a nonce was actually consumed (replay-protection check)

```sql
SELECT nonce, consumed_at, expires_at FROM consumed_nonces WHERE nonce = $1;
-- No row = never consumed (or already expired and cleaned up, if a cleanup job exists).
```

### Audit the maker-checker approval queue

```sql
-- Everything still awaiting a human checker
SELECT policy_name, policy_version, proposed_by, proposed_at, reason
FROM pending_policy_changes
WHERE status = 'PENDING_APPROVAL'
ORDER BY proposed_at;

-- Full approval history for one policy
SELECT approved_by, approved_at, content_hash_before, content_hash_after
FROM policy_change_approval_records
WHERE policy_name = $1 AND policy_version = $2
ORDER BY approved_at;
```

### Check table row counts (quick health snapshot)

```sql
SELECT 'business_transactions', COUNT(*) FROM business_transactions
UNION ALL SELECT 'executions', COUNT(*) FROM executions
UNION ALL SELECT 'execution_trust_records', COUNT(*) FROM execution_trust_records
UNION ALL SELECT 'caller_audit_events', COUNT(*) FROM caller_audit_events
UNION ALL SELECT 'execution_audit_events', COUNT(*) FROM execution_audit_events
UNION ALL SELECT 'refusal_records', COUNT(*) FROM refusal_records
UNION ALL SELECT 'pending_policy_changes', COUNT(*) FROM pending_policy_changes
UNION ALL SELECT 'policy_change_approval_records', COUNT(*) FROM policy_change_approval_records;
```

### Migration-sync verification (files vs. tracking table)

Run this whenever migrations feel out of sync — see tonight's own real finding of 3
untracked-but-applied migrations for why this matters:

```bash
node -e '
require("dotenv").config();
const fs = require("fs");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, min: 1 });
const fileVersions = fs.readdirSync("supabase/migrations")
  .filter(f => f.endsWith(".sql"))
  .map(f => f.split("_")[0]).sort();
(async () => {
  const { rows } = await pool.query("SELECT version FROM supabase_migrations.schema_migrations ORDER BY version");
  const dbVersions = rows.map(r => r.version).sort();
  console.log("Files:", fileVersions.length, "Tracked:", dbVersions.length);
  console.log("In files, not tracked:", fileVersions.filter(v => !dbVersions.includes(v)));
  console.log("Tracked, no file:", dbVersions.filter(v => !fileVersions.includes(v)));
  await pool.end();
})();
'
```

### List all live tables and their RLS status

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
```

### Check a table's actual CHECK constraints (don't trust the migration file alone — several have been widened repeatedly)

```sql
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'caller_audit_events'::regclass AND contype = 'c';
```

### Find foreign keys pointing at a table (before ever dropping one)

```sql
SELECT tc.table_name AS referencing_table, tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = $1;
```
