# Policy Approval Runbook: Moving the 10 Pending Policies to APPROVED

> **Update 2026-09-16: completed.** A distinct reviewer, `policy-reviewer-1`, approved
> all 10 policies below plus 4 additional pre-existing policies that had never been
> proposed at all (`agent-vendor-payment`, `api-key-issuance`, `expense-reimbursement`,
> `slack-post-message`), 14 total. Real approvals now exist in
> `policy_change_approval_records`; `docs/CLAIMS.md` §2.26/§2.35 and
> `docs/VERIFICATION-GAPS.md` gap 40 have been updated accordingly. Part 6's tracking
> table below is filled in with the real result. This runbook's steps remain accurate
> for any future policy needing the same maker-checker flow — kept as a how-to, not
> archived.
>
> Original status note, for the record: as of 2026-09-07, none of the 10 policies
> below had been reviewed or approved by anyone. This runbook described the real
> commands and endpoints that exist in this codebase, verified against source, so
> that when a genuinely distinct human checker was ready to act, the steps would be
> correct.

## Why this exists

Execution time policy verification (see `docs/CLAIMS.md` §2.35 and §2.36) is built,
tested, and, since 2026-09-20, enforced by default everywhere except `NODE_ENV`
`test` and `development`. It refuses every execution under a policy that has no
signed approval record, so a policy must be approved through this runbook before
the deployment that runs it is promoted. (This section was written when the flag
defaulted to `false` and none of the 10 real production policies had an approval
record yet.) This runbook is the path to closing that, once a real
reviewer is available.

## Part 1: The 10 policies (verified live, 2026-09-07)

Queried directly against `pending_policy_changes` via `@parmana/storage`'s real
`PendingPolicyChangeRepository` (the same repository `GET /policies/pending-changes`
uses) — not read from a prior draft of this document.

| #   | Policy                  | Version | Proposed by | Proposed at (UTC)   |
| --- | ----------------------- | ------- | ----------- | ------------------- |
| 1   | `access-control`        | 1.0.0   | charak1987  | 2026-08-19 01:47:43 |
| 2   | `connector-capability`  | 1.0.0   | charak1987  | 2026-08-19 01:47:44 |
| 3   | `customer-refund`       | 1.0.0   | charak1987  | 2026-08-19 01:47:44 |
| 4   | `database-change`       | 3.0.0   | charak1987  | 2026-08-19 01:47:45 |
| 5   | `github-pr-approval`    | 1.0.0   | charak1987  | 2026-08-19 01:47:45 |
| 6   | `hubspot-deal-update`   | 1.0.0   | charak1987  | 2026-08-19 01:47:46 |
| 7   | `llm-tool-call`         | 1.0.0   | charak1987  | 2026-08-19 01:47:46 |
| 8   | `production-deployment` | 1.0.0   | charak1987  | 2026-08-19 01:47:47 |
| 9   | `rag-document-access`   | 1.0.0   | charak1987  | 2026-08-19 01:47:47 |
| 10  | `vendor-payment`        | 2.0.0   | charak1987  | 2026-08-19 01:47:47 |

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

## Part 5: Enforcement (on by default since 2026-09-20)

Enforcement is now the default in production, so there is nothing to enable here. Set
`POLICY_EXECUTION_VERIFICATION_ENFORCED=true` only to turn it on in a `NODE_ENV=test` or
`development` environment. In production the variable is ignored and cannot switch enforcement
off. The consequence is an ordering rule: complete Part 4 for every policy the deployment
executes against BEFORE promoting that deployment, or executions under an unapproved policy
are refused.

Restart the API process after a change. From that point, `RuntimeEngine` refuses execution
against any policy with no approval record, an invalid approval-record
signature, or content that no longer matches its approval record — see
`docs/CLAIMS.md` §2.35.

**Do this only once every policy this deployment actually executes against has
been resolved** (approved, or rejected and replaced by an approved proposal).
A policy left `PENDING_APPROVAL` or rejected with no approved replacement will
be refused at execution time the moment this flag is on.

## Part 6: Tracking (filled in as each was actually resolved)

Every row below reflects the _final_ resolution. Each of the original 10 was
approved twice: once against the stale 2026-08-19 proposal content (missing
`unboundSignalReasons`, and for `connector-capability`/`customer-refund`,
missing `boundSignals`), then re-proposed with current file content and
re-approved once the drift was caught — see `docs/CLAIMS.md` §2.26's
"Legacy-policy backfill" entry for the full account. `pendingPolicyChangeId`
below is the ID of the _final_ (correct-content) proposal, not the first one.
Four additional policies that predated Policy Governance entirely and had
never been proposed at all are included too, since they went through the
same session and the same reviewer.

| Policy                | Version | Reviewer          | Decision | Resolved at (UTC)        | pendingPolicyChangeId                |
| --------------------- | ------- | ----------------- | -------- | ------------------------ | ------------------------------------ |
| access-control        | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:44:34.429Z | d9a5b8eb-1615-4273-b8a1-58b9371a8d46 |
| connector-capability  | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:44:39.232Z | d8fa1807-c822-4cc0-ac51-a85669217436 |
| customer-refund       | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:44:43.985Z | 2dd9b62a-938e-4d1f-bc6e-e1d60cbbebad |
| database-change       | 3.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:44:48.721Z | d57291e9-ab7c-4f23-9aa7-776354ab2064 |
| github-pr-approval    | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:44:53.493Z | d8373b49-1ff7-49c5-804f-c7096d3199fd |
| hubspot-deal-update   | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:44:57.990Z | 917aef58-0d01-4071-b108-abe29df83904 |
| llm-tool-call         | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:45:02.475Z | a9fd546c-9ba1-4527-b152-7807c838a974 |
| production-deployment | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:45:07.006Z | 40cca789-2bfe-42dc-a0b7-087baa7e1aad |
| rag-document-access   | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:45:11.476Z | f64d924d-cacb-4d7a-b96c-8ab2074028cc |
| vendor-payment        | 2.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:45:15.988Z | c6dae1d5-f326-4e01-967a-3b4d003297ff |
| agent-vendor-payment  | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:48:10.092Z | 3b27cd11-d816-45ec-b8ad-ecfd5ec2fa8a |
| api-key-issuance      | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:48:16.925Z | 4e0b4a10-e4c2-4647-a319-5a848f1f788d |
| expense-reimbursement | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:48:23.820Z | 63f9903b-c125-4248-ab7c-526cd312f62e |
| slack-post-message    | 1.0.0   | policy-reviewer-1 | APPROVED | 2026-09-16T08:48:30.864Z | a99a9216-a1b0-4e7e-971c-65520ec2015d |

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
the _canonicalized_ JSON (`CanonicalSerializer`, key-sorted), not the raw
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
Part 1's table above was built from a real query rather than assumed. Enforcement
no longer needs to be switched on separately, it is the production default since
2026-09-20, so confirm every executed policy has its record first.
