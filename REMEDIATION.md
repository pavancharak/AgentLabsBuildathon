# REMEDIATION.md: AgentLabsBuildathon Execution Gateway — GAPS.md Closure

**Remediation Date:** 2026-09-14
**Status:** GAP-1 and GAP-3 closed and verified. GAP-2 examined and found not applicable (existing code already covers the real risk, differently than proposed).
**Source:** `GAPS.md` (2026-09-14 audit), itself following up on the "Authorization Without Execution Is Just a Promise" execution-gateway audit.

---

## Summary

| Gap                                                          | Original status   | Outcome                                                                                                                          |
| ------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| GAP-1: Persistent Audit Storage                              | ⚠️ IN-MEMORY ONLY | ✅ **CLOSED** — `SupabaseExecutionAuditSink`, signed, chained, queryable                                                         |
| GAP-2: Paytm Connector Fail-Safe Posture                     | ⚠️ WARN-AND-OMIT  | ➖ **NOT APPLICABLE** — existing `assertPaytmConnectorConfigured.ts` already fail-closes on the actual dangerous case; see below |
| GAP-3: Downstream Proof Verification (`parmana-paytm-agent`) | ❓ NOT AUDITED    | ✅ **CLOSED** — audited, gap confirmed real, fixed directly in that repository                                                   |

Full verification: this repository's monorepo suite (`npx vitest run` from repo root) — 592 passed, 42 gated skips, 0 failed; `npx tsc -b` clean. `parmana-paytm-agent`'s own suite — 40 passed, 0 failed; `tsc --noEmit` clean; `eslint .` clean.

---

## GAP-1: Persistent Audit Storage — CLOSED

### What was built

**`packages/storage/src/supabase/SupabaseExecutionAuditSink.ts`** (new) implements `ExecutionAuditSink` (`@parmana/execution-control`):

- Writes via `PostgresPoolFactory` (direct Postgres connection, `DATABASE_URL`), not supabase-js/PostgREST — matching this codebase's established pattern (`SupabaseCallerAuditSink` and others share the same PostgREST-schema-cache-workaround rationale).
- Signs every event at write time with `AuditEventCrypto` (same Ed25519 signing stack as every other signed artifact in this codebase).
- Chains events per `authorizationId` via a Postgres advisory transaction lock (`pg_advisory_xact_lock(hashtext($1))`) — an authorization's full lifecycle (`session.created` → `execution.completed`/`execution.rejected`) chains together, tamper-evident via `previous_chain_hash`/`chain_position`.
- Exposes `query(filter)` — by `authorizationId`, `businessTransactionId`, `connectorId`, `type`, or date range — the read path `ExecutionAuditSink`/`CallerAuditSink` never had.

**`packages/api/src/bootstrap/createExecutionAuditSink.ts`** now mirrors `createCallerAuditSink.ts` exactly: `NODE_ENV=test` → `MemoryExecutionAuditSink` (unchanged, still correct for tests); every other environment fails closed at startup if `DATABASE_URL` is unset, else returns the Supabase sink.

**New migration:** `supabase/migrations/20260914120000_add_execution_audit_events.sql` — the `execution_audit_events` table, append-only, RLS enabled (zero policies — readable only by the app's own privileged connection, same posture as `caller_audit_events`), indexed on `occurred_at`, `authorization_id`, `connector_id`.

### Acceptance criteria (from GAPS.md)

- ✅ `SupabaseExecutionAuditSink` class exists with `record()` and `query()` methods
- ✅ Connects to PostgreSQL via connection pool (`PostgresPoolFactory`)
- ✅ Creates `execution_audit_events` table with schema (authId → `authorization_id`, eventType → `type`, reason, timestamp, indexes on `authorization_id`+date)
- ✅ Records `session.created` and `execution.completed`/`execution.rejected` events
- ✅ `query()` supports filtering by `authorizationId`, `businessTransactionId`, `connectorId`, `type`, date range
- ✅ Integration test: Execute → Query audit → Retrieve complete chain (`packages/api/tests/integration/supabase-execution-audit-sink.integration.test.ts`, literal test name: "Execute -> Query audit -> Retrieve complete chain")
- ✅ Bootstrap sets sink based on environment (`NODE_ENV=test` vs. everything else, matching the existing `createCallerAuditSink.ts`/`createNonceStore.ts` convention rather than introducing a new `AUDIT_STORAGE` variable — one fewer knob, same effective behavior)
- ✅ `.env.example` documents the configuration (extended the existing `DATABASE_URL` comment block to name `createExecutionAuditSink.ts` alongside `createCallerAuditSink.ts`/`createNonceStore.ts`)

### Deviation from the original proposal

GAPS.md proposed an `AUDIT_STORAGE` env var with a `postgres`/`memory` choice. Implemented instead: the same fail-closed `NODE_ENV=test`-vs-everything-else split every other durable store in this codebase already uses (`CallerAuditSink`, `NonceStore`). No new environment variable — one less thing to misconfigure, and consistent with the rest of the bootstrap layer rather than a one-off pattern for this sink alone.

### Evidence

- `packages/storage/tests/unit/supabase-execution-audit-sink.test.ts` — 12 unit tests (mapping, chaining, tamper detection, query filters)
- `packages/api/tests/unit/bootstrap/create-execution-audit-sink.test.ts` — 4 tests (fail-closed assertions)
- `packages/api/tests/integration/supabase-execution-audit-sink.integration.test.ts` — live-DB tests, gated behind `ALLOW_LIVE_SUPABASE=1` (same opt-in as every other live-Supabase suite in this repo)
- `docs/VERIFICATION-GAPS.md` G-42
- `docs/CLAIMS.md` §3.22 (2026-09-14 correction, evidence list)

---

## GAP-2: Paytm Connector Fail-Safe Posture — NOT APPLICABLE

### What GAPS.md proposed

Fail startup if `PAYTM_CONNECTOR_URL`/`PAYTM_CONNECTOR_SHARED_SECRET` are both absent, via a new `EXECUTION_MODE=payment|auth-only` flag — full absence would fail closed under payment mode.

### What was found instead

`packages/api/src/bootstrap/assertPaytmConnectorConfigured.ts` already runs at startup (`server.ts`, before the port binds) and already fails closed — but on a _different_, and more precisely targeted, condition: **partial** configuration (`PAYTM_CONNECTOR_URL` set without `PAYTM_CONNECTOR_SHARED_SECRET`, or vice versa) and non-HTTPS `PAYTM_CONNECTOR_URL` in production. Its own doc comment states the design intent explicitly: full absence of Paytm configuration is deliberate and acceptable — "The Paytm connector is optional in any given deployment ... exactly like HubSpot/GitHub."

This is a considered, already-implemented design decision, not an oversight. Reversing it (failing on full absence too) would assume every deployment of this codebase requires payment capability to always be present — an assumption nothing in this codebase or in GAPS.md itself established.

### Decision

**No code change.** The actual dangerous failure mode — a misconfigured connector silently failing at runtime instead of loudly at startup — is already closed. If a specific deployment later needs "boots without Paytm capability" to be a hard error, that's a one-line, opt-in flag to add at that point (e.g. `REQUIRE_PAYTM_CONNECTOR=true`), not something to build speculatively now.

### Evidence

- `packages/api/src/bootstrap/assertPaytmConnectorConfigured.ts` (existing, pre-dates this remediation)
- `packages/api/src/server.ts:48` (call site, confirmed wired before port bind)
- `docs/VERIFICATION-GAPS.md`, "Gaps checked and found not applicable" section (new entry)

---

## GAP-3: Downstream Proof Verification (`parmana-paytm-agent`) — CLOSED

### What the audit found

`parmana-paytm-agent`'s `executeAuthorizedConnectorRequest` (`src/server/handler.ts`) already correctly verified the Ed25519 authorization signature (ADR-0009 Phase 2B) before calling Paytm, and already rejected tampered/expired/missing signatures with the right error — the proof-verification half of GAP-3's checklist was solid and well-tested (`tests/unit/execute-authorized-connector-request.test.ts` already covered the exact exploit this checklist worried about: shared-secret-alone bypass).

The actual gap was narrower than GAPS.md's checklist implied: **this service recorded nothing at all** — not even a console log — for either a successful or a rejected refund. A `grep` for `audit|log` across `src/` returned nothing.

### What was built

**`src/parmana/audit.ts`** (new, in `parmana-paytm-agent` — that repository's first-ever runtime dependency, `pg`, since it was previously deliberately dependency-free):

- Records `authorization.verified` immediately after signature verification succeeds.
- Records `execution.completed`/`execution.rejected` after the Paytm call resolves.
- Two rows, not one: a crash between verification and execution — exactly the failure mode an audit trail exists to catch — stays visible instead of silently unrecorded by a single combined write.
- Writes into the **same** `execution_audit_events` table GAP-1 introduced in AgentLabsBuildathon, not a separate table.

### The correlation problem, and how it was solved

`ExecutionAuditEvent.authorizationId` (Parmana's own internal authorization identity) is never forwarded across the wire to `parmana-paytm-agent` — that service only ever sees `businessTransactionId`, `orderId`, `txnId`, and its own re-signed authorization envelope (see `GatewayPaytmAdapter`'s wire contract, `docs/CLAIMS.md` §3.22). Two schema changes made `businessTransactionId` the shared correlation key instead:

- `ExecutionAuditEvent` gained an optional `businessTransactionId` field; `ExecutionControlService` now stamps it on every event it writes.
- New migration added a nullable `business_transaction_id` column (indexed) to `execution_audit_events`.

`query({ businessTransactionId })` now retrieves one refund's complete story across both services. `query({ authorizationId })` retrieves only Parmana's own signed, chained half.

### Trust-boundary asymmetry (deliberate, documented)

`parmana-paytm-agent`'s rows are unsigned and unchained (`signature_json`/`chain_hash`/`chain_position` NULL — columns relaxed to nullable in a second new migration). That service holds Parmana's public key only, to verify, never a private key to sign with. This is judged acceptable: a compromised instance of that service could already forge real Paytm calls using the merchant credentials it legitimately holds, so signing its own log entries would not raise the actual trust bar. Durability and cross-service correlation are what this fix adds, not proof of authorship.

### Acceptance criteria (from GAPS.md)

- ✅ `parmana-paytm-agent` has webhook at `POST /connector/paytm-refund` (pre-existing, confirmed during audit)
- ✅ Webhook verifies Ed25519 proof before any Paytm call (pre-existing, confirmed)
- ✅ Proof verification fetches public key from Parmana, not hardcoded (pre-existing, confirmed — `fetchParmanaPublicKey`, no local caching)
- ✅ Proof expiry + TTL checked (pre-existing, confirmed)
- ✅ Payload reconstructed and signature verified (pre-existing, confirmed — `canonicalPaytmAuthorizationString`, byte-identical to the signer's copy)
- ✅ Multiple rejection paths tested (pre-existing, confirmed — missing signature, expired, tampered amount, shared-secret-alone exploit)
- ✅ **Audit trail records both "proof verified" and "Paytm outcome"** (this remediation — the actual gap)
- ✅ Integration test: full flow, valid and invalid paths (3 new unit tests added; see below)

### Evidence

- `parmana-paytm-agent`: `src/parmana/audit.ts` (new), `src/server/handler.ts` (updated — `loadConfig()` now requires `DATABASE_URL`; `executeAuthorizedConnectorRequest` takes a dependency-injected audit recorder, defaulting to the real writer), `.env.example` (documents `DATABASE_URL`), `package.json` (`pg` added as first runtime dependency)
- `parmana-paytm-agent`: `tests/unit/execute-authorized-connector-request.test.ts` — 3 new cases (success sequence, verification-failure sequence, Paytm-decline sequence), 40/40 passing overall
- AgentLabsBuildathon: `packages/execution-control/src/types.ts`/`ExecutionControlService.ts` (`businessTransactionId` field, `authorization.verified` type added), two new migrations (`20260914130000_...`, `20260914140000_...`)
- `docs/VERIFICATION-GAPS.md` G-43
- `docs/CLAIMS.md` §3.22 (2026-09-14 correction — the "that repository is out of this codebase's scope entirely" claim was accurate architecturally but is now qualified: this remediation was made directly in that repository, with the user's explicit authorization)
- `docs/connectors/PAYTM_CONNECTOR.md` — new "Audit trail" section

---

## A note on process, for anyone re-verifying this later

Mid-remediation, a `packages/api` test run (invoked as `cd packages/api && npx vitest run ...` rather than from the repository root) showed 10 failing tests, including the entire `paytm-refund.integration.test.ts` suite returning 404 on `POST /execute`. This was investigated as a possible regression before being traced to its real cause: `.env`'s `PARMANA_POLICY_DIR=./policies` resolves relative to `process.cwd()`, which was `packages/api` under that invocation, not the repository root where `policies/` actually lives — so every policy lookup threw `PolicyNotFoundError`, mapped to HTTP 404 by the error handler. Root `package.json`'s own `test` script and CI's `npm test` both already run from the repository root; rerunning identically from the root showed 0 failures. Recorded here, and in `docs/VERIFICATION-GAPS.md`'s 2026-09-14 session entry, so the same false alarm isn't repeated: **always run this monorepo's tests from the repository root**, not from an individual package directory.

---

## Files changed, by repository

**AgentLabsBuildathon:**

- `packages/storage/src/supabase/SupabaseExecutionAuditSink.ts` (new)
- `packages/storage/src/index.ts`, `packages/storage/package.json` (export + dependency)
- `packages/api/src/bootstrap/createExecutionAuditSink.ts`
- `packages/execution-control/src/types.ts`, `ExecutionControlService.ts`
- `supabase/migrations/20260914120000_add_execution_audit_events.sql` (new)
- `supabase/migrations/20260914130000_add_business_transaction_correlation_to_execution_audit_events.sql` (new)
- `supabase/migrations/20260914140000_add_authorization_verified_to_execution_audit_events.sql` (new)
- `packages/storage/tests/unit/supabase-execution-audit-sink.test.ts` (new)
- `packages/api/tests/unit/bootstrap/create-execution-audit-sink.test.ts` (new)
- `packages/api/tests/integration/supabase-execution-audit-sink.integration.test.ts` (new)
- `.env.example`
- `docs/VERIFICATION-GAPS.md` (G-42, G-43, GAP-2 not-applicable note, 2026-09-14 session section)
- `docs/CLAIMS.md` (§3.22 correction)
- `docs/connectors/PAYTM_CONNECTOR.md` (new "Audit trail" section)
- `docs/site/reference/execution-control.mdx`, `docs/site/reference/storage.mdx`
- `REMEDIATION.md` (this file)

**parmana-paytm-agent:**

- `src/parmana/audit.ts` (new)
- `src/server/handler.ts`
- `package.json` (`pg` dependency added)
- `.env.example` (`DATABASE_URL` documented)
- `tests/unit/execute-authorized-connector-request.test.ts`
