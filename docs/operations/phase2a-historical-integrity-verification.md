# Phase 2A.3 — Historical Audit Database Identity Verification

Resolves the single remaining follow-up from Phase 2A.2 (`DEPLOYMENT VERIFIED WITH FOLLOW-UP`): whether the "REDACTED-PROJECT-NAME" Supabase database inspected during Phases 2A.1 and 2A.2 is the same database currently configured for the deployed production `parmana-api` application. This is a verification-only phase; no code, configuration, or deployment was changed. All database interaction was read-only (`SELECT` and metadata inspection only — confirmed below).

---

## Preconditions Verified

```
git status              → clean
git log --oneline -5:
  0c19f78  docs(operations): verify Phase 2A production deployment   (Phase 2A.2)
  10c8064  docs(operations): independent readiness review...          (Phase 2A.1)
  6eff8ec  fix(production): remove MockConnector from production...   (Phase 2A)
  ...
```

Phase 2A, 2A.1, and 2A.2 all committed; working tree clean before this phase began.

## Method, and the Read-Only Constraint

Three approaches were attempted, in order of increasing directness, all read-only:

1. **Fly secret digest comparison.** `flyctl secrets list -a parmana-api` exposes a `DIGEST` per secret (16 hex characters) but not the value. Computed SHA-256, SHA-1, MD5, and SHA-512 (full digest, first-16, and last-16 hex) of the local `.env`'s `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and constructed candidate `SUPABASE_URL` values, comparing against Fly's displayed digests. **No match** — Fly's digest algorithm is not a plain hash of the secret value reproducible without Fly's internal implementation, so this avenue could not establish identity (a negative result, not evidence either way).
2. **Passive connection-pattern inspection.** Queried `pg_stat_activity` on the database reachable via the local `.env` credentials (project `REDACTED-PROJECT-REF`, "REDACTED-PROJECT-NAME") for connections correlating in time with observed production events (a Razorpay settlement-poller tick, captured from live Fly logs). Inconclusive — the application's Postgres pool (`pg.Pool`, default `idleTimeoutMillis: 10000`) closes idle connections faster than the poller's 15-second tick interval, so passive snapshots could plausibly miss a real connection even if one existed.
3. **Active, self-triggered correlation via the public `/ready` endpoint — conclusive.** `packages/api/src/routes/ready.ts` is explicitly exempt from caller authentication (`packages/api/src/app.ts:113`, the same exemption list as `/health`) and, when `PARMANA_STORAGE=supabase`, executes a literal `SELECT 1` against `PostgresPoolFactory.create()` — the exact same pool `DATABASE_URL` configures for the whole application, including the Razorpay webhook event store. This is public, unauthenticated, and reveals no secret — only a readiness boolean.

**No write operation was performed or required at any point.** Every query executed against the Supabase database was a `SELECT` (`pg_stat_activity`, `business_transactions`, `execution_trust_records`, `receipts`) or a metadata read. No `INSERT`/`UPDATE`/`DELETE`, no schema change, no secret modification. `curl .../ready` and `curl .../health` are both side-effect-free GET requests.

## 1. Production Database Identity

**Repository/infrastructure evidence:** `flyctl secrets list -a parmana-api` confirms `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PARMANA_STORAGE` are configured as deployed Fly secrets (names/digests only, unchanged from Phase 2A.1/2A.2).

**Direct production evidence, newly obtained this phase:**

- `curl https://parmana-api.fly.dev/ready` → `{"status":"READY"}` (not `{"status":"READY","storage":"not-supabase-backed"}`) — proves, from the route's own conditional logic (`ready.ts:30`), that production has `PARMANA_STORAGE === "supabase"` and that a real `SELECT 1` against the configured `DATABASE_URL` succeeded, at the moment of the call.
- Immediately after that call (two independent, back-to-back trials), `pg_stat_activity` on the "REDACTED-PROJECT-NAME" database (`REDACTED-PROJECT-REF`) showed a connection whose query text was the literal string `'SELECT 1'`, with a `backend_start` timestamp matching the `curl` call to the second. The same snapshot also captured connections executing a query beginning `SELECT event_id, event_type, payload, received_at FROM ...` — consistent with the Razorpay webhook event store the settlement poller reads every 15 seconds (`razorpay_settlement_poll_tick`, observed continuously in production logs across Phases 2A.2 and this phase).

**Recorded identity:** project ref `REDACTED-PROJECT-REF`, project name (from `supabase projects list`) **"REDACTED-PROJECT-NAME"**, host `db.REDACTED-PROJECT-REF.supabase.co`, region `ap-southeast-2`.

## 2. Historical Database Identity

**Repository evidence:** the database inspected in Phase 2A.1 and re-referenced in Phase 2A.2 was reached via the `DATABASE_URL` present in the local `.env` file, documented there as backing "Live integration tests... Live tests create persistent rows."

**Recorded identity:** project ref `REDACTED-PROJECT-REF`, project name **"REDACTED-PROJECT-NAME"**, host `db.REDACTED-PROJECT-REF.supabase.co` — identical fields to §1, because it is the same connection string used throughout Phases 2A.1–2A.3.

## 3. Identity Comparison

**Classification: IDENTICAL.**

Supporting operational evidence (not repository or deployment history — direct, live, infrastructure-level evidence):

- The literal `SELECT 1` query issued by production's own `/ready` route, at the exact moment it was triggered via the public production endpoint, was observed executing against the "REDACTED-PROJECT-NAME" database.
- The Razorpay webhook-event-store query pattern, matching the production settlement poller's own known 15-second cadence (independently confirmed live in Fly logs across two phases), was observed executing against the same database.

This satisfies Task 3.5's evidence bar without exposing any secret: no password, token, secret value, or credential-bearing connection string was read or disclosed at any point. Identity was established purely through observed, self-triggered operational behavior — the strongest form of evidence this phase's instructions describe ("infrastructure control-plane evidence," "equivalent operational metadata") — not through inference, naming similarity, or repository history.

## 4. Historical Trust Record Assessment

Re-queried (read-only) the now-confirmed production database for every `payments:execute` `business_transaction` and its associated `execution_trust_records`:

| Metric                                                                               | Count |
| ------------------------------------------------------------------------------------ | ----- |
| Total `payments:execute` business transactions                                       | 18    |
| Trust Records associated with them                                                   | 8     |
| Records with `authority.principalId` outside `{"ordering-test", "integration-test"}` | **0** |

Identical to Phase 2A.1's findings, byte-for-byte — no new record appeared (consistent with Phase 2A.2's monitoring finding of zero `payments:execute` traffic since deployment). Every Trust Record's `authority.principalId`/`authority.displayName` field — part of the record's own immutable, hashed content, not an external label applied after the fact — reads `"ordering-test"` (15 records, dated 2026-07-11) or `"integration-test"` (3 records, dated 2026-08-03, `authority.displayName: "Integration Test"`).

## 5. Historical Receipt Assessment

| Metric                                                          | Count                                                                                                                                                                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Receipts associated with the 18 `payments:execute` transactions | 10                                                                                                                                                                                                   |
| Receipts for the 3 `integration-test`-attributed transactions   | 0 (those three never progressed past `APPROVED`/Trust-Record stage — no `execution` sub-object, no receipt, consistent with a test that exercises authorization without driving a full pipeline run) |
| Receipts with any non-test caller/authority attribution         | **0**                                                                                                                                                                                                |

Every Receipt traces back to one of the 5 `ordering-test`-attributed, `EXECUTED`-status transactions (2 receipts each).

**Literal vs. substantive finding, stated precisely:** 8 Trust Records and 10 Receipts do exist in the confirmed production database, and they were generated via `MockConnector` (that was, at the time, the only registered handler for `payments:execute`). But every one of them is self-identified, within the record's own cryptographically-hashed content, as originating from this repository's own test tooling — not from any real caller, customer, or external party. No consumer of these records (human or system) would encounter `authority.principalId: "ordering-test"` or `"integration-test"` and read it as a genuine, real-world approval. This is the substantive question TD-1 and every phase since have been tracking — whether a _real_ party was ever given fabricated evidence of a _real_ execution — and the answer, now backed by confirmed production-database evidence, is no.

## 6. Remaining Uncertainty

None material to the identity question itself — it is resolved (§3). Residual, narrower points:

- This phase confirms the database identity _as of this phase's execution_ (2026-08-05). It does not retroactively prove the _same_ identity held at every point across the full historical window (2026-07-09 onward) — though nothing in repository or deployment history suggests `DATABASE_URL` was ever rotated to point at a different Supabase project, and the record timestamps (2026-07-11 through 2026-08-03) are fully accounted for within this one project.
- The Fly secret digest algorithm remains unidentified — not needed now that §3 was resolved by a stronger method, but noted for completeness since it was attempted and failed.

## 7. Operational Impact

Because §4–5 found **zero** non-test-attributed records, the operational-impact assessment Task 7 calls for is correspondingly minimal:

- **Affected period:** 2026-07-11 (single day, 15 records) and 2026-08-03 13:27–13:34 UTC (3 records) — both entirely attributable to this repository's own test-suite runs against its "live integration test" database, not a sustained or ongoing exposure window.
- **Approximate record count:** 18 business transactions, 8 Trust Records, 10 Receipts — all test-attributed, none requiring remediation.
- **Downstream usage:** none identified. No route, report, or export in `packages/api/src` treats these records differently from any other; they were simply never retrieved or acted upon by anything other than this investigation's own read-only queries.
- **Customer visibility:** none. No external caller, integration, or consumer-facing surface references these specific transaction IDs; they are not linked from any customer-facing artifact.
- **Reporting impact:** none — no compliance, audit, or financial report in this repository aggregates or relies on `vendor-payment`/`payments:execute` records (no such reporting surface exists in the codebase at all).

**Recommended remediation: none required** for the trust-integrity concern itself, since no real party was ever deceived. One minor, optional housekeeping observation, not a remediation for TD-1: using a project explicitly named "REDACTED-PROJECT-NAME" as the target for `ALLOW_LIVE_SUPABASE=1` integration-test runs means test-fixture rows (`test-txn-*`) accumulate in the same database production reads from. This carries no security or trust-integrity risk (every row is self-labeled, none are load-bearing for anything), but a future housekeeping pass could consider separating "live integration test" runs from whatever "audit" role this specific project otherwise serves. **Not performed in this phase** — out of scope (verification only, no remediation).

## 8. Final Classification

**HISTORICAL INTEGRITY CONFIRMED.**

| Requirement                                                                                                      | Status                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Production database identity proven                                                                              | ✓ — §1, via the production app's own `/ready` endpoint and observed `pg_stat_activity` correlation, not inference      |
| Historical database identity matches production                                                                  | ✓ — §3, IDENTICAL, same project (`REDACTED-PROJECT-REF` / "REDACTED-PROJECT-NAME") throughout                          |
| No historical production Trust Records or Receipts originated from MockConnector serving real, non-test activity | ✓ — §4–5, all 8 Trust Records / 10 Receipts are self-identified as test-attributed; zero records show any other origin |

**Every conclusion above is supported by operational evidence obtained this phase or in Phase 2A.1/2A.2, not by inference from repository or deployment history alone** — per this phase's own instruction that repository/deployment history is insufficient on its own. The identity proof specifically rests on live, self-triggered, timestamp-correlated database activity (§1, §3), the strongest evidence category this phase's instructions describe, obtained without exposing any secret value.

**TD-1 (Phase 1H's original finding) is now fully closed**: the implementation fix (Phase 2A), its deployment (Phase 2A.2), and the historical integrity of every record that existed before the fix (this phase) are all resolved, each with direct evidence at its own level — repository, deployment, and now production/historical.

**Addendum (2026-08-05, Phase 2A.4):** this report's Final Classification (§8) was the triggering evidence for TD-1's formal closure in `docs/architecture/repository-certification.md`'s Technical Debt Register. Canonical evidence chain, commit SHAs, and closure rationale: `docs/operations/td1-closure-summary.md`.
