# Windows Setup for a Policy Reviewer

> Companion to `docs/operations/policy-approval-runbook.md` (the full mechanics,
> real policy list, and current status) — this file only covers the
> Windows-specific machine setup for a reviewer, using the real tooling that
> actually exists in this codebase. It replaces an earlier draft (`app.md`,
> repo root) that named a nonexistent `packages/cli`, a password/MFA login
> flow this system doesn't have, and the wrong policy list — none of which
> would have worked if followed.
>
> **Status: not yet executed.** No policy has been approved. Do not treat
> anything below as having happened.

## Step 1: Install prerequisites (one-time)

```cmd
REM Git for Windows: https://git-scm.com/download/win
REM Node.js LTS: https://nodejs.org/

git --version
node --version
npm --version
```

## Step 2: Clone and build

```cmd
mkdir D:\work
cd D:\work
git clone https://github.com/pavancharak/parmana-exp.git
cd parmana-exp
npm install
npm run build
```

`npm run build` runs the real project build (`tsc -b` across all packages) —
there is no separate "CLI build" step, because there is no `packages/cli` in
this codebase. The tools the reviewer actually needs are plain TypeScript
scripts run via `npx tsx`, already present after cloning.

## Step 3: Receive your credential (from the operator, not self-generated)

Unlike the earlier draft, the reviewer does **not** run a `login` command or
generate their own credential against a live server — there is no
username/password/MFA flow in this system. Instead, the person who controls
this deployment's configuration (`charak1987`) runs, once, on **their own**
machine:

```bash
npx tsx scripts/generate-api-key.ts \
  --caller-id "mohinder-singh-charak" \
  --credential-holder-type USER \
  --generate-step-up-key
```

and sends the reviewer two secrets, ideally over two different channels:

1. a bearer API key (used to authenticate every request below)
2. a step-up private key, PEM-encoded (used only to sign an approve/reject
   decision — never sent to the server directly)

Save the step-up private key locally, e.g. `mohinder.step-up.private.pem`.
Note the `--key-id` value the operator used when generating it — you'll need
it in Step 5.

## Step 4: List what's pending

```cmd
curl -X GET "<api-base-url>/policies/pending-changes?status=PENDING_APPROVAL" -H "Authorization: Bearer <your-bearer-key>"
```

Real route, mounted at `/policies` (`packages/api/src/app.ts`) — not
`/api/pending-changes`. See `docs/operations/policy-approval-runbook.md` Part 1
for the actual 10 policies currently pending (as of 2026-09-07, all proposed
2026-08-19): `access-control`, `connector-capability`, `customer-refund`,
`database-change`, `github-pr-approval`, `hubspot-deal-update`,
`llm-tool-call`, `production-deployment`, `rag-document-access`,
`vendor-payment`. Each response entry's real id field is
`pendingPolicyChangeId`, and includes a `diff` (`current` vs. `proposed`
content) — read it before deciding.

## Step 5: Sign and submit a decision, per policy

```cmd
npx tsx scripts/sign-policy-change-step-up.ts --private-key-file mohinder.step-up.private.pem --key-id <key-id-from-step-3> --pending-policy-change-id <pendingPolicyChangeId-from-step-4> --action approve
```

This prints a `stepUpAuthorization` JSON envelope (valid 120 seconds) — never
sent anywhere by this script itself. Paste it into the actual request:

```cmd
curl -X POST "<api-base-url>/policies/pending-changes/<pendingPolicyChangeId>/approve" -H "Authorization: Bearer <your-bearer-key>" -H "Content-Type: application/json" -d "{ \"stepUpAuthorization\": <paste-envelope-here> }"
```

Repeat for each of the 10 policies (`--action reject` with a `rejectionReason`
field instead, for any you decide not to approve). There is no single
command that does all 10 at once — each is meant to be a distinct decision,
not a batch rubber-stamp.

## Step 6: Verify

```cmd
curl -X GET "<api-base-url>/policies/pending-changes?status=PENDING_APPROVAL" -H "Authorization: Bearer <your-bearer-key>"
```

Should return an empty `changes` array once all 10 are resolved.

## After this is genuinely done

Tell the operator. They'll confirm the real state against the database (see
`docs/operations/policy-approval-runbook.md` Part 6.5) before updating
`docs/CLAIMS.md` §2.35 / `docs/VERIFICATION-GAPS.md` gap 40, and before
considering `POLICY_EXECUTION_VERIFICATION_ENFORCED=true`.
