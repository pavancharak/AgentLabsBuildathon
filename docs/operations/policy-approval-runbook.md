# Policy Approval Runbook: Moving the 10 Pending Policies to APPROVED

> **Status of this document: a how-to, not a record of completed work.**
> As of 2026-09-07, none of the 10 policies below have been reviewed or approved by
> anyone. This runbook describes the real commands and endpoints that exist in this
> codebase today, verified against source, so that when a genuinely distinct human
> checker is ready to act, the steps are correct. It does not claim, and must not be
> edited to claim, that any approval has happened until it actually has.
>
> `docs/CLAIMS.md` §2.26/§2.35 and `docs/VERIFICATION-GAPS.md` gap 40 will only be
> updated once real approvals exist in `policy_change_approval_records` — that update
> is a separate, later task, not part of running this runbook.

## Why this exists

`POLICY_EXECUTION_VERIFICATION_ENFORCED` (see `docs/CLAIMS.md` §2.35) is built,
tested, and wired in, but defaults to `false` because turning it on today would
refuse every execution in the system — none of the 10 real production policies has
an approval record yet. This runbook is the path to closing that, once a real
reviewer is available.

## Part 1: The 10 policies (verified live, 2026-09-07)

Queried directly against `pending_policy_changes` via `@parmana/storage`'s real
`PendingPolicyChangeRepository` (the same repository `GET /policies/pending-changes`
uses) — not read from a prior draft of this document.

| # | Policy | Version | Proposed by | Proposed at (UTC) |
|---|---|---|---|---|
| 1 | `access-control` | 1.0.0 | charak1987 | 2026-08-19 01:47:43 |
| 2 | `connector-capability` | 1.0.0 | charak1987 | 2026-08-19 01:47:44 |
| 3 | `customer-refund` | 1.0.0 | charak1987 | 2026-08-19 01:47:44 |
| 4 | `database-change` | 3.0.0 | charak1987 | 2026-08-19 01:47:45 |
| 5 | `github-pr-approval` | 1.0.0 | charak1987 | 2026-08-19 01:47:45 |
| 6 | `hubspot-deal-update` | 1.0.0 | charak1987 | 2026-08-19 01:47:46 |
| 7 | `llm-tool-call` | 1.0.0 | charak1987 | 2026-08-19 01:47:46 |
| 8 | `production-deployment` | 1.0.0 | charak1987 | 2026-08-19 01:47:47 |
| 9 | `rag-document-access` | 1.0.0 | charak1987 | 2026-08-19 01:47:47 |
| 10 | `vendor-payment` | 2.0.0 | charak1987 | 2026-08-19 01:47:47 |

All ten are proposed by the same account. By `SameActorCannotApproveOwnChangeError`,
none of them can be approved or rejected by `charak1987` — a genuinely distinct
human, with their own credential, must act on all ten.

## Part 2: Prerequisite — identify the reviewer

**Reviewer:** _______________ (not filled in by this runbook; confirm this
yourself before proceeding)

The reviewer must be a real, distinct person who will actually read each policy's
rules and decide approve/reject on their own judgment — not a rubber stamp, and
not anyone who can be confused with `charak1987` by the server's own caller
identity (a different `callerId`/API key, at minimum).

## Part 3: Provisioning the reviewer's credential (you, the operator, do this once)

The reviewer needs two separate secrets: an ordinary bearer API key (for reading
pending changes and submitting the approve/reject request) and a step-up signing
keypair (Layer 4 — a second, independent proof of intent for the approve/reject
action itself, on top of the bearer token). `scripts/generate-api-key.ts` produces
both in one run and talks to nothing — you copy its output into config yourself.

```bash
npx tsx scripts/generate-api-key.ts \
  --caller-id "<reviewer-name-or-id>" \
  --credential-holder-type USER \
  --generate-step-up-key
```

This prints, once, to your terminal only (nothing is written to disk):
- the reviewer's bearer API key
- the reviewer's step-up **private** key (PEM)
- a JSON `entry` (containing only the key **hash** and the step-up **public** key)
  to append to the `PARMANA_API_KEYS` environment variable (a JSON array) —
  server-side config, not something the reviewer holds

After adding the entry to `PARMANA_API_KEYS` and restarting the API, hand the
bearer key and the step-up private key to the reviewer over a secure channel —
ideally two different channels, since either alone is enough to forge a signed
approval if both are exposed together.

## Part 4: What the reviewer does, per policy

### Step A — list what's pending

```bash
curl -X GET "<api-base-url>/policies/pending-changes?status=PENDING_APPROVAL" \
  -H "Authorization: Bearer <reviewer-bearer-key>"
```

Real route: `packages/api/src/routes/pending-policy-changes.ts`, mounted at
`/policies` in `packages/api/src/app.ts` — not `/api/pending-changes`. The
response includes each change's `pendingPolicyChangeId` (the real id field —
not `id`) plus a `diff` (`current` vs. `proposed` content) for review.

### Step B — review the policy content

Read `proposedContent.rules` and the proposal's own `reason` field in the
response above. Decide approve or reject on the actual rules, not on trusting
that they match some external expectation — the diff view exists specifically
so the reviewer isn't asked to trust the proposer.

### Step C — sign a step-up authorization (on the reviewer's own machine)

```bash
npx tsx scripts/sign-policy-change-step-up.ts \
  --private-key-file ./reviewer.step-up.private.pem \
  --key-id <the key-id used when provisioning> \
  --pending-policy-change-id <pendingPolicyChangeId from Step A> \
  --action approve
```

This never contacts the API. It prints a `stepUpAuthorization` JSON envelope
(valid for 120 seconds by default) for the reviewer to paste into the next
request's body.

### Step D — submit the decision

```bash
curl -X POST "<api-base-url>/policies/pending-changes/<pendingPolicyChangeId>/approve" \
  -H "Authorization: Bearer <reviewer-bearer-key>" \
  -H "Content-Type: application/json" \
  -d '{ "stepUpAuthorization": <paste the envelope from Step C> }'
```

(For a rejection instead: `.../reject` with `{ "rejectionReason": "...", "stepUpAuthorization": ... }`.)

A successful approve resolves the change to `APPROVED` **and** creates a signed
`PolicyChangeApprovalRecord` (`PolicyChangeApprovalService`) — the record
`PolicyGovernanceExecutionVerifier` will check once enforcement is enabled.

Repeat Steps A–D for each of the 10 policies. There is no single command that
does all 10 at once — each is a distinct decision.

### Step E — verify

```bash
curl -X GET "<api-base-url>/policies/pending-changes?status=PENDING_APPROVAL" \
  -H "Authorization: Bearer <reviewer-bearer-key>"
```

Should return an empty `changes` array once all 10 are resolved (approved or
rejected).

## Part 5: Enabling enforcement (only after Part 4 is genuinely complete for all 10)

```bash
POLICY_EXECUTION_VERIFICATION_ENFORCED=true
```

Restart the API process. From that point, `RuntimeEngine` refuses execution
against any policy with no approval record, an invalid approval-record
signature, or content that no longer matches its approval record — see
`docs/CLAIMS.md` §2.35.

**Do this only once every policy this deployment actually executes against has
been resolved** (approved, or rejected and replaced by an approved proposal).
A policy left `PENDING_APPROVAL` or rejected with no approved replacement will
be refused at execution time the moment this flag is on.

## Part 6: Tracking (fill in as each is actually resolved — do not pre-fill)

| Policy | Version | Reviewer | Decision | Resolved at | pendingPolicyChangeId |
|---|---|---|---|---|---|
| access-control | 1.0.0 | | | | |
| connector-capability | 1.0.0 | | | | |
| customer-refund | 1.0.0 | | | | |
| database-change | 3.0.0 | | | | |
| github-pr-approval | 1.0.0 | | | | |
| hubspot-deal-update | 1.0.0 | | | | |
| llm-tool-call | 1.0.0 | | | | |
| production-deployment | 1.0.0 | | | | |
| rag-document-access | 1.0.0 | | | | |
| vendor-payment | 2.0.0 | | | | |

## Part 6.5: Before/after state verification queries

These check the real database state directly, against the real schema
(`supabase/migrations/20260818120000_add_policy_governance_tables.sql`) — not a
guessed one. Every result below is a placeholder for you to fill in by actually
running the query; none of these have been run against real data as part of
this runbook, and no value should be copied into `CLAIMS.md`/
`VERIFICATION-GAPS.md` until it has been.

There is no `psql` client in this sandbox; run these from an environment that
has one, or adapt them to a one-off script using `@parmana/storage`'s
`StorageFactory` the way this runbook's own Part 1 table was produced (a
plain `pool.query(...)` against the same tables works too, but the repository
layer already does the mapping correctly).

**Query 1 — pending-change status, before:**

```sql
SELECT policy_name, policy_version, status, proposed_by, proposed_at,
       resolved_by, resolved_at
FROM pending_policy_changes
ORDER BY proposed_at ASC;
```

Result: _______________ (expect 10 rows, all `PENDING_APPROVAL`, `resolved_by`/`resolved_at` null — confirmed live in this session on 2026-09-07)

**Query 2 — approval records, before:**

```sql
SELECT policy_change_approval_record_id, pending_policy_change_id, policy_name,
       policy_version, approved_by, approved_at, content_hash_before,
       content_hash_after
FROM policy_change_approval_records
ORDER BY approved_at ASC;
```

Result: _______________ (expect 0 rows — no policy in this system has ever completed the approval flow, per `docs/CLAIMS.md` §2.26)

**Query 3 — pending-change status, after each approve/reject:**

Same as Query 1. After all 10 are resolved, expect 0 rows with
`status = 'PENDING_APPROVAL'` and 10 rows with `resolved_at` set (split
between `APPROVED` and `REJECTED` depending on what the reviewer actually
decided — not necessarily all 10 approved).

**Query 4 — approval records, after:**

Same as Query 2. Expect one new row per **approved** policy only (a rejection
creates no `PolicyChangeApprovalRecord` — see that type's own doc comment: a
rejected change's `rejectionReason` is itself the durable evidence a
rejection leaves behind). There is no `step_up_signature_valid` column to
check here — the step-up signature is verified once, at the moment of the
`POST .../approve` call, and is never stored as a boolean afterward. What
persists and can be independently re-checked later is the approval record's
own `signature_json`, via `PolicyChangeCrypto.verify()`.

**Query 5 — content still matches what was approved:**

Don't hand-roll a `sha256sum` comparison — `content_hash_after` is a hash of
the *canonicalized* JSON (`CanonicalSerializer`, key-sorted), not the raw
file bytes, so a naive file hash will not reliably match. Use the tool this
codebase already has for exactly this:

```bash
npx tsx scripts/verify-policy-changes-approved.ts --full-scan
```

Result: _______________ (this already runs in CI on every push/PR against
changed policy files — see `.github/workflows/ci.yml`'s
`verify-policy-approvals` job; `--full-scan` here checks every policy on
disk, not only ones changed in a diff)

## Part 7: After all 10 are genuinely resolved

Come back and ask for `docs/CLAIMS.md` §2.35 and `docs/VERIFICATION-GAPS.md`
gap 40 to be updated — with the real reviewer name, real timestamps, and real
`policyChangeApprovalRecordId` values queried from the database, the same way
Part 1's table above was built from a real query rather than assumed. Setting
`POLICY_EXECUTION_VERIFICATION_ENFORCED=true` is also a separate, deliberate
step at that point, not something to do preemptively.
