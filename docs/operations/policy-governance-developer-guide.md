# Policy Governance: Complete Developer Guide

**Audience:** anyone new to this codebase who needs to create, propose, review, or
approve a policy — or debug why one of those steps isn't working. Self-contained;
you shouldn't need any other document to get from "I have a policy idea" to "it's
live and approved."

**Companion documents:** `docs/operations/policy-approval-runbook.md` is the
narrower, copy-pasteable checklist for approving a specific batch of pending
policies (this guide explains the _system_; that one is a _task list_).
`docs/CLAIMS.md` §2.26/§2.35 is the audited, evidence-cited claim about what this
system guarantees and how it's tested — read this guide first, that one if you need
to cite proof for a specific claim.

---

## 1. What this system is, in one paragraph

Every policy that decides whether a request gets approved or rejected lives as a
`policy.json` file under `policies/{name}/{version}/policy.json`, and also (in any
environment with a real database configured) as a row in the `policies` table. A
policy's content can only change through a **maker-checker** flow: one person
_proposes_ a change, a genuinely different person _reviews and approves_ it,
cryptographically, before it takes effect. No one can approve their own proposal —
the system enforces this at the API layer, not just by convention. This exists
because policy content controls real decisions (who gets paid, what gets deployed,
what an AI agent is allowed to do), so a single person being able to silently
change that content, with no second party and no durable record, was treated as
an unacceptable gap.

## 2. The five roles/concepts you need to know

| Term                      | What it means                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Policy**                | A `policy.json` file: rules that evaluate signals (booleans/numbers/strings) into `approve` or `reject`.                                                                                                                                                                             |
| **Maker / proposer**      | The person (or automation) who proposes a policy change. Identified by `callerId` in `PARMANA_API_KEYS`.                                                                                                                                                                             |
| **Checker / reviewer**    | A genuinely distinct person who reviews the proposal and approves or rejects it. Must have `credentialHolderType: "USER"` and, for approve/reject, a **step-up keypair**.                                                                                                            |
| **Bearer key**            | An ordinary API key (`Authorization: Bearer ...`) that proves _who_ is calling. Every request needs one.                                                                                                                                                                             |
| **Step-up authorization** | A second, independent, short-lived (120s) cryptographic signature proving the checker specifically intends _this_ approve/reject action on _this_ pending change, on top of their bearer key. Signed locally, on the checker's own machine, with a private key that never leaves it. |

## 3. Writing a new policy

A `policy.json` has this shape (see `packages/policy/src/types/Policy.ts` for the
authoritative type):

```json
{
  "policyId": "my-new-policy",
  "policyVersion": "1.0.0",
  "schemaVersion": "1.0.0",
  "description": "One sentence: what this policy authorizes and on what basis.",
  "signalsSchema": {
    "someBooleanSignal": "boolean",
    "someAmount": "number"
  },
  "boundSignals": {
    "someAmount": "parameters.amount"
  },
  "unboundSignalReasons": {
    "someBooleanSignal": "Why this can't be derived from the request itself — e.g. it's an independent verification result."
  },
  "rules": [
    {
      "id": "approve-default",
      "condition": {
        "all": [
          { "fact": "someBooleanSignal", "operator": "eq", "value": true },
          { "fact": "someAmount", "operator": "lte", "value": 5000 }
        ]
      },
      "outcome": {
        "action": "approve",
        "reason": "Human-readable reason shown in decisions/audit."
      }
    },
    {
      "id": "reject-default",
      "condition": { "always": true },
      "outcome": {
        "action": "reject",
        "reason": "Catch-all: anything not explicitly approved is rejected."
      }
    }
  ]
}
```

Key rules to follow:

- **Every fact referenced by a rule must appear in either `boundSignals` (if it can
  be derived from the request's own `target`/`parameters`) or
  `unboundSignalReasons` (if it must come from independent verification).**
  `PolicyValidator.validate()` fails closed on this — a proposal with an uncovered
  fact is rejected at propose time with a 400, not silently accepted.
- **Always end with a catch-all reject rule** (`"condition": { "always": true }`).
  Default-deny, not default-allow.
- **`policyVersion` inside the file must match the version in the URL path** when
  you propose it (see below) — this is what `PolicyChangeApprovalService` uses as
  the actual write target, not the URL's version param.
- A worked example, written specifically to be copy-pasted from: `expense-reimbursement`
  (`policies/expense-reimbursement/1.0.0/policy.json`) — see `LIVE-API-GUIDE.md`'s
  "How to Write a New Policy" section for the full walkthrough.

## 4. The full lifecycle, step by step

```
  write policy.json  →  propose  →  review  →  sign (step-up)  →  submit approve/reject  →  verify
       (maker)          (maker)     (checker)     (checker)          (checker)              (anyone)
```

### Step 0 — Get a reviewer credential (one-time, per checker)

The checker needs a bearer key **and** a step-up keypair, genuinely independent of
whoever is proposing. Generated together, once:

```powershell
npx tsx scripts/generate-api-key.ts --caller-id "<checker-name>" --credential-holder-type USER --generate-step-up-key
```

This prints three things: a bearer key, a step-up **private** key (PEM), and an
`entry` JSON block (hash + public key only — safe to store/share, unlike the other
two). The operator appends the `entry` to the `PARMANA_API_KEYS` environment
variable (a JSON array) and redeploys; the checker keeps the bearer key and the
private key file (`checker.step-up.private.pem`) on their own machine, never in
this repo, never committed. See §7 "Rotating a credential" if you need to replace
one later.

### Step A — Propose

```bash
curl -X POST "<api-base>/policies/<name>/<version>/pending-changes" \
  -H "Authorization: Bearer <maker's bearer key>" \
  -H "Content-Type: application/json" \
  -d '{"proposedContent": <the full policy.json object>, "reason": "why this change"}'
```

Returns `201` with the created `pendingPolicyChangeId`, or `400` if
`proposedContent`/`reason` are missing/malformed, or if `PolicyValidator` finds an
uncovered fact or a `matches` regex it rejects as too complex.

### Step B — Review

```bash
curl "<api-base>/policies/pending-changes?status=PENDING_APPROVAL" \
  -H "Authorization: Bearer <checker's bearer key>"
```

Read `proposedContent.rules` and the proposal's own `reason`. The response also
includes `diff.current` vs. `diff.proposed` (what's live today vs. what's being
proposed) and `coverageWarnings`/`ruleConflicts` if the validator or the advisory
conflict checker found anything worth a second look. This is a judgment call — no
script makes it for you.

### Step C — Sign (on the checker's own machine, never anyone else's)

```bash
npx tsx scripts/sign-policy-change-step-up.ts \
  --private-key-file ./checker.step-up.private.pem \
  --key-id <checker-name> \
  --pending-policy-change-id <id from Step A/B> \
  --action approve
```

Prints a `stepUpAuthorization` JSON envelope, valid for **120 seconds**. This
script never talks to the API — it only signs, locally.

### Step D — Submit

```bash
curl -X POST "<api-base>/policies/pending-changes/<id>/approve" \
  -H "Authorization: Bearer <checker's bearer key>" \
  -H "Content-Type: application/json" \
  -d '{"stepUpAuthorization": <envelope from Step C>}'
```

(For a rejection: `.../reject` with `{"rejectionReason": "...", "stepUpAuthorization": ...}`.)
Must happen within 120 seconds of signing, or you'll need to re-sign — see §6.

### Step E — Verify

```bash
curl "<api-base>/policies/pending-changes?status=PENDING_APPROVAL" \
  -H "Authorization: Bearer <any valid bearer key>"
```

The resolved change should no longer appear. Separately, anyone can confirm the
live file and the approval record agree:

```bash
npx tsx scripts/verify-policy-changes-approved.ts --full-scan
```

## 5. The one-shot scripts (recommended over manual curl)

Manually chaining curl commands across the 120-second signing window is fragile —
see §6 for exactly how it breaks. Two scripts in this repo collapse Steps C+D (or
A through D) into one process invocation, so there's no human-speed gap between
signing and submitting:

**`scripts/local-review-action.ts`** — signs and submits approve/reject for an
_existing_ pending change, in one run:

```powershell
$env:REVIEWER_KEY = "<checker's bearer key>"
npx tsx scripts/local-review-action.ts --pending-policy-change-id <id> --action approve
```

**`scripts/refresh-approved-policy-content.ts`** — proposes the _current on-disk
file content_ as a fresh pending change, then immediately signs and approves it,
in one run. Useful when you want to (re-)approve exactly what's in the file right
now without hand-copying JSON:

```powershell
$env:PROPOSER_KEY = "<maker's bearer key>"
$env:REVIEWER_KEY = "<checker's bearer key>"
npx tsx scripts/refresh-approved-policy-content.ts --policy-name <name> --policy-version <version>
```

Both read the step-up private key from `./reviewer.step-up.private.pem` by default
(override with `--private-key-file`), and print only non-secret output (HTTP
status, response body) — neither script ever prints your bearer key or private key.

## 6. Troubleshooting — real failures, and what they actually mean

| Symptom                                                                                                                                                                   | Real cause                                                                                                                                                                                                                                                                                                                                                                                                                                   | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{"error":"authentication required"}`, HTTP 401                                                                                                                           | The bearer key is missing, wrong, or stale (rotated since). Also happens if your header literally reads `Authorization: Bearer` with nothing after it, or the header is missing the word `Bearer` entirely (`Authorization: <key>` alone doesn't work).                                                                                                                                                                                      | Confirm the env var is actually set in _this_ terminal (`$env:REVIEWER_KEY.Length` should print a number like 43, not `0`). If it's set but still 401, the key may be stale — see "Rotating a credential" below.                                                                                                                                                                                                                                                                                            |
| `{"error":"The step-up authorization envelope is missing, invalid, expired, replayed, or does not match this request.","code":"STEP_UP_AUTHORIZATION_INVALID"}`, HTTP 403 | One of: (a) more than 120 seconds passed between signing and submitting; (b) the envelope was already used once (nonces are single-use); (c) **the step-up private key you signed with doesn't match the `stepUpPublicKey` currently on file for that caller** — this is the easy one to miss, since the server verifies against whatever public key is _currently_ configured for your `callerId`, not whatever key generated the envelope. | Re-sign and resubmit within the window (or use the one-shot scripts in §5, which make this a non-issue). If it persists even with near-zero delay, verify your local `.pem` file actually matches the currently-configured public key: `node -e "const c=require('crypto');const f=require('fs');console.log(c.createPublicKey(c.createPrivateKey(f.readFileSync('reviewer.step-up.private.pem','utf8'))).export({type:'spki',format:'pem'}))"` and compare to the `stepUpPublicKey` in `PARMANA_API_KEYS`. |
| `{"error":"Internal Server Error"}`, HTTP 500, and the server log shows `Invalid JSON` from `body-parser`                                                                 | The request body wasn't valid JSON by the time it reached the server — usually a shell-quoting problem, not a real JSON bug. PowerShell in particular rewrites how it passes quoted arguments to native executables like `curl.exe`, and a long inline `-d '{"a":"b",...}'` with many embedded quotes can get mangled in transit.                                                                                                            | Don't build the JSON body inline in the command line. Write it to a file first (`[System.IO.File]::WriteAllText("body.json", $json, [System.Text.Encoding]::ASCII)`), then `curl.exe --data-binary "@body.json"`. Or use the one-shot scripts in §5, which build the request body inside Node, never through a shell.                                                                                                                                                                                       |
| `Error: EROFS: read-only file system, open '...policy.json...tmp'`                                                                                                        | `PolicyChangeApprovalService.approve()` tried to write the approved policy content to the local filesystem via `FilePolicyRepository`, but the environment's filesystem is read-only (Vercel serverless Functions). This was a real bug, fixed 2026-09-16 — see `docs/CLAIMS.md` §2.26.                                                                                                                                                      | Should not happen anymore on a current deployment; `SupabasePolicyRepository` is used automatically whenever `PARMANA_STORAGE` isn't `memory`. If you see this, the deployed code predates the fix — redeploy from current `main`.                                                                                                                                                                                                                                                                          |
| `vercel deploy --prod` fails with `"message": "fetch failed"`                                                                                                             | Transient network issue between your machine and Vercel's upload endpoint — not a code or config problem.                                                                                                                                                                                                                                                                                                                                    | Just retry `vercel deploy --prod`. It succeeded on retry every time this came up.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Proposal succeeds, but the approved content is missing fields you expect (e.g. `boundSignals`)                                                                            | You approved a pending change that was proposed a long time ago, and the live file has since gained fields the old proposal doesn't have. Proposals are frozen snapshots — nothing re-checks them against the current file while they sit `PENDING_APPROVAL`.                                                                                                                                                                                | Reject or don't approve stale proposals blindly. If you want to approve _current_ content, use `scripts/refresh-approved-policy-content.ts` (§5), which always proposes from the live file, not an old snapshot. Confirm with `scripts/verify-policy-changes-approved.ts --full-scan` afterward.                                                                                                                                                                                                            |
| `{"error":"proposedContent is required and must be a policy.json object."}` or similar 400 on propose                                                                     | Malformed request body, or `proposedContent.policyId` doesn't match the `name` in the URL, or `policyVersion` doesn't match `^[A-Za-z0-9._-]+$`.                                                                                                                                                                                                                                                                                             | Read the exact `error` message — it names the specific field.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `SAME_ACTOR_CANNOT_APPROVE_OWN_CHANGE`, HTTP 403                                                                                                                          | The bearer key you're approving with belongs to the same `callerId` that proposed the change.                                                                                                                                                                                                                                                                                                                                                | Use a genuinely different checker credential. There is no override.                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## 7. Rotating a credential

If a bearer key or step-up private key is ever exposed (pasted somewhere it
shouldn't have been, committed by accident, etc.), rotate it immediately — treat
it as compromised the moment it's been seen anywhere outside the holder's own
terminal.

```powershell
npx tsx scripts/generate-api-key.ts --caller-id "<same-name>" --credential-holder-type USER --generate-step-up-key
```

This produces an entirely new bearer key **and** step-up keypair (they're
independent — a leak of one doesn't compromise the other, but regenerating
`--generate-step-up-key` always refreshes both together). Update the `entry` in
`PARMANA_API_KEYS`, **and overwrite the local `.pem` file with the new private
key** — the single most common mistake is rotating the bearer key but forgetting
to also replace the `.pem` file, which produces the confusing
`STEP_UP_AUTHORIZATION_INVALID` failure in the table above even though everything
looks right at a glance. Verify the two actually match before moving on (the
`node -e ...` command in §6's second row).

## 8. FAQ

**Q: Can I approve my own proposal if there's no one else around?**
No. `SameActorCannotApproveOwnChangeError` is enforced server-side, not just a
convention. You need a genuinely distinct second credential.

**Q: Does the step-up private key ever get sent to the API?**
No. Only the _signature_ it produces (the `stepUpAuthorization` envelope) is sent.
The private key never leaves the checker's machine — this is the entire point of
the mechanism.

**Q: What happens if I let a signed envelope's 120 seconds expire before submitting?**
The submit request fails with `STEP_UP_AUTHORIZATION_INVALID` (see §6). Just
re-sign — envelopes are cheap and instant to produce.

**Q: Can a rejection be un-rejected, or an approval undone?**
No. `PendingPolicyChange` moves `PENDING_APPROVAL` → `APPROVED`/`REJECTED` exactly
once, never back. To change your mind, propose a new change.

**Q: Where does the approved content actually take effect?**
In any environment with a real database configured (`PARMANA_STORAGE` other than
`memory`), `PolicyChangeApprovalService.approve()` writes the approved content into
the `policies` table via `SupabasePolicyRepository`, and that's what
`RuntimeEngine` reads on every subsequent real request. In local dev/tests, it
writes to the local file instead.

**Q: Is there a UI for any of this?**
`packages/governance-ui` covers propose/list/diff-review only — deliberately no
approve/reject controls, since a web UI collecting a step-up private key would
defeat the guarantee that the key never leaves the checker's machine. Approve/reject
stays CLI-only, by design.

## 9. If you're stuck

1. **Read the actual error message and HTTP status first** — every error in this
   system is written to name the specific problem (missing field, wrong value,
   which check failed). §6's table covers the ones that look confusing at first
   glance but have a clear, specific cause.
2. **Check the server logs** for anything that returned a generic `500 Internal
Server Error` — `vercel logs <url>` (or your platform's equivalent) usually
   shows the real underlying exception, which is almost always more specific than
   what the HTTP response body says.
3. **Run `scripts/verify-policy-changes-approved.ts --full-scan`** to get an
   honest, database-backed picture of what's actually approved vs. not, rather
   than trusting assumptions about what should have happened.
4. **If a credential might be compromised, rotate it immediately** (§7) — don't
   try to keep using something that might have leaked, and don't wait to see if
   it "still works."
5. **If none of the above resolves it**, the underlying source is not large:
   `packages/api/src/routes/pending-policy-changes.ts` (the four endpoints),
   `packages/api/src/governance/PolicyChangeApprovalService.ts` (what approve
   actually does), `packages/api/src/auth/PolicyChangeStepUpVerifier.ts` (what
   step-up verification actually checks) are the three files that cover nearly
   everything in this guide, in well under a thousand lines combined.
