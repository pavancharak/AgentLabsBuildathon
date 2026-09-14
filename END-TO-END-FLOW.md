# END-TO-END-FLOW.md: Running a Real Agent → Parmana → Paytm Refund, Start to Finish

**Written:** 2026-09-14, immediately after successfully running this exact flow against real, live, production infrastructure (`parmana-api-real.vercel.app` → `parmana-paytm-agent.vercel.app` → Paytm staging API). Every command, every error message, and every fix in this document is verbatim from that real session — nothing here is theoretical or "should work." Where something failed before it worked, the failure is documented too, because the failure and its fix are exactly the parts a fresh attempt is most likely to repeat.

**Audience:** anyone who needs to run this flow again from zero — a new environment, a new operator, or future-you after forgetting the details. No step here assumes you remember anything from the session that produced it.

---

## Table of Contents

1. [Architecture: what actually happens, hop by hop](#1-architecture-what-actually-happens-hop-by-hop)
2. [Prerequisites](#2-prerequisites)
3. [Part A — Infrastructure: three systems, three separate configurations](#3-part-a--infrastructure-three-systems-three-separate-configurations)
4. [Part B — The Supabase connection string trap (read this before touching `DATABASE_URL`)](#4-part-b--the-supabase-connection-string-trap)
5. [Part C — Generating a caller API key](#5-part-c--generating-a-caller-api-key)
6. [Part D — Wiring the Paytm connector's shared secret](#6-part-d--wiring-the-paytm-connectors-shared-secret)
7. [Part E — Building the request body](#7-part-e--building-the-request-body)
8. [Part F — Running the test](#8-part-f--running-the-test)
9. [Part G — Reading the response](#9-part-g--reading-the-response)
10. [Part H — Verifying the cross-service audit trail](#10-part-h--verifying-the-cross-service-audit-trail)
11. [Appendix: full error catalog, verbatim, with real causes](#11-appendix-full-error-catalog-verbatim-with-real-causes)
12. [Security notes](#12-security-notes)

---

## 1. Architecture: what actually happens, hop by hop

Three separate systems, three separate deployments, three separate configurations. Confusing any two of them costs hours — see the entire troubleshooting history in Section 11, almost all of which was exactly this.

```
[Caller / Agent]
      |
      |  POST /execute  (Authorization: Bearer <caller API key>)
      v
[parmana-api-real.vercel.app]              <- this repository (AgentLabsBuildathon), deployed
      |
      |  1. Caller-auth middleware validates the Bearer key against PARMANA_API_KEYS,
      |     writes a caller-audit-trail event (Supabase, DATABASE_URL) -- fails closed
      |     (503 AUDIT_UNAVAILABLE) if that write fails.
      |  2. BusinessTransactionMapper + BusinessTransactionValidator validate structure.
      |  3. RuntimeEngine evaluates the named policy (e.g. customer-refund@1.0.0)
      |     against the submitted `signals`.
      |  4. If APPROVED: RuntimeAuthorizationSigner mints and Ed25519-signs an
      |     ExecutionAuthorizationPayload (authorizationId, policyContentHash,
      |     signalsHash, businessTransactionHash, nonce, expiresAt, ...).
      |  5. ExecutionGateway re-verifies that authorization (signature, expiry, TTL,
      |     nonce, businessTransactionHash) before ever releasing to a connector --
      |     this is a real second verification, not decorative.
      |  6. ExecutionControlService authenticates the gateway, opens a one-time
      |     session, and calls the resolved connector (GatewayPaytmAdapter for
      |     paytm:refund), recording session.created / execution.completed /
      |     execution.rejected to execution_audit_events (Supabase, same
      |     DATABASE_URL), signed and chained by authorizationId.
      v
[GatewayPaytmAdapter]                      <- packages/execution-gateway, inside parmana-api-real
      |
      |  Re-signs a SEPARATE, narrower authorization (ADR-0009 Phase 2B) over
      |  {businessTransactionId, action, orderId, txnId, amount, expiresAt} using
      |  Parmana's own private key, then makes ONE outbound HTTPS POST.
      v
[parmana-paytm-agent.vercel.app]           <- SEPARATE repository, SEPARATE Vercel project
      |
      |  POST /connector/paytm-refund
      |  1. Checks the Authorization: Bearer header against
      |     PAYTM_CONNECTOR_SHARED_SECRET (transport auth between the two services --
      |     proves the caller knows the secret, NOT that Parmana approved anything).
      |  2. Fetches Parmana's public key fresh from GET /keys/:keyId (no local
      |     caching -- honors key rotation automatically).
      |  3. Rebuilds the same canonical string and verifies the Ed25519 signature
      |     from step "GatewayPaytmAdapter" above. THIS is what actually proves
      |     Parmana's policy engine approved this specific request -- the shared
      |     secret alone proves nothing about approval.
      |  4. Records "authorization.verified" to execution_audit_events (SAME table,
      |     via its own DATABASE_URL, unsigned/unchained -- this service holds
      |     Parmana's public key only, never a private key).
      |  5. Calls Paytm's real API (staging or production, per PAYTM_ENVIRONMENT).
      |  6. Records "execution.completed" or "execution.rejected" (same table).
      v
[Paytm API]  (staging: sandbox, no real money; production: real money)
      |
      |  Returns success/failure. A synthetic/nonexistent order returns a
      |  non-success result (resultStatus/resultCode), NOT an error -- this is
      |  the correct, designed behavior: a business outcome, not an exception.
      v
[response climbs back up through every layer above]
      |
      |  ExecutionTrustRecord is built, signed, chained, independently verified,
      |  and a Receipt is issued and signed. All of this is returned to the
      |  original caller in the POST /execute response body (Section 9).
```

**The one thing to internalize before anything else:** `parmana-api-real` and `parmana-paytm-agent` are two separate Vercel projects with two separate, independently-managed sets of environment variables. Nothing is shared between them automatically. Every piece of configuration below must be set on **both**, separately, even when the value happens to be identical (e.g. `PAYTM_CONNECTOR_SHARED_SECRET`) or even when the underlying resource is the same (e.g. `DATABASE_URL` — same Supabase project, but each service holds its own copy of the connection string).

---

## 2. Prerequisites

- Write access to the `parmana-api-real` Vercel project and the `parmana-paytm-agent` Vercel project (same Vercel account/team in the one real run this document is based on: `pavan-dev-singh-charaks-projects`).
- Write access to the Supabase project both deployments share (project ref `ltjadvsjlpcygborxzet` in the one real run this document is based on — yours will differ; treat every project-ref string below as an example, not a value to copy).
- A local clone of this repository (`AgentLabsBuildathon`) with its own `.env` configured (see `.env.example`) — used to generate API keys and, optionally, to query the audit trail afterward. This repo's own local `.env` does **not** need to be, and in the real run was **not**, the same database as the Vercel deployments' `.env` — but for querying the audit trail afterward (Section 10), it needs to point at the _same_ database those deployments use.
- PowerShell (Windows) or `curl`/bash (any OS) to make the actual HTTP calls.
- Node.js and this repo's own dependencies installed (`npm install` at the repo root) to run `scripts/generate-api-key.ts`.

---

## 3. Part A — Infrastructure: three systems, three separate configurations

| System                         | What it is                                                                                      | Where its config lives                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `parmana-api-real` (Vercel)    | The deployed Parmana API — this repository                                                      | Vercel dashboard → that project → Settings → Environment Variables             |
| `parmana-paytm-agent` (Vercel) | The separate, trusted Paytm connector service — a **different repository**                      | Vercel dashboard → that (different) project → Settings → Environment Variables |
| Supabase project               | The one shared Postgres database both deployments write audit/storage data to                   | Supabase dashboard → that project                                              |
| Your local machine             | Used to generate API keys, build test payloads, and (optionally) query the audit trail directly | This repo's own `.env` file                                                    |

**Migrations required on the Supabase project** before any of this works, run once, directly against the database (this repo has no working automated migration runner — see `docs/VERIFICATION-GAPS.md` G-36 for why `npm run migrate` doesn't work; these were applied via a direct `pg` connection instead):

- `supabase/migrations/20260914120000_add_execution_audit_events.sql`
- `supabase/migrations/20260914130000_add_business_transaction_correlation_to_execution_audit_events.sql`
- `supabase/migrations/20260914140000_add_authorization_verified_to_execution_audit_events.sql`

All three are idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT` + `ADD CONSTRAINT`), safe to re-run. Verify they landed:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'execution_audit_events'
ORDER BY ordinal_position;
```

You should see `business_transaction_id` present and nullable, and `signature_json`/`chain_hash`/`chain_position` nullable (relaxed for `parmana-paytm-agent`'s unsigned writes).

---

## 4. Part B — The Supabase connection string trap

This single issue cost more real time in the session this document is based on than every other issue combined. Read this fully before setting `DATABASE_URL` anywhere.

### 4.1 Direct connection vs. Transaction pooler

Supabase gives you (at minimum) two connection string shapes from its dashboard's **Connect** button:

- **Direct connection**: `postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres`
- **Transaction pooler**: `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`

**Use the Transaction pooler string. Always, for any Vercel/serverless deployment.** The Direct connection hostname (`db.<project-ref>.supabase.co`) is IPv6-only for most Supabase projects. Vercel's serverless functions only have IPv4 egress. The result is not a slow connection or a timeout — it's an immediate DNS failure:

```
{"error":"getaddrinfo ENOTFOUND db.ltjadvsjlpcygborxzet.supabase.co"}
```

This will work perfectly from your own laptop (most home/office networks support IPv6, or your OS falls back sensibly) and fail 100% of the time from Vercel. That mismatch — "it works locally, it's broken in prod, with a hostname-not-found error" — is the signature of this exact issue.

**Notice the username changes too**: Direct uses plain `postgres`; the pooler requires `postgres.<project-ref>` (the tenant suffix is how Supavisor, Supabase's connection pooler, routes the connection to the right project). If you hand-edit a direct connection string into a pooler one by just changing the hostname/port and forgetting to also change the username, authentication will fail.

### 4.2 The `[YOUR-PASSWORD]` placeholder

Supabase's Connect dialog shows the connection string as a **template**, with a literal placeholder in it:

```
postgresql://postgres.ltjadvsjlpcygborxzet:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

The square brackets and the text `YOUR-PASSWORD` are **not** part of the real string. Supabase does not show your actual current password inline in this dialog for security reasons. You must replace the entire `[YOUR-PASSWORD]` token — brackets included — with your real password. Copying the template as-is, or replacing only the text inside the brackets while leaving the brackets themselves, produces:

```
{"error":"password authentication failed for user \"postgres\""}
```

(Postgres error code `28P01`.) Note also that this error message reports the bare role name `postgres`, not `postgres.<project-ref>`, **even when the pooler username format is correct** — Supavisor normalizes the reported username in its own error output. Seeing `user "postgres"` in this error is not evidence your username format is wrong; don't chase that as a separate bug.

### 4.3 Where to actually get the current password

Supabase only ever shows you the real password once: at the moment you create the project, or at the moment you reset it (Project Settings → Database → **Reset database password**). If you don't have it saved from that moment, there is no way to retrieve it later — you must reset it again. Every reset invalidates the previous password immediately, everywhere it's used.

### 4.4 The password-rotation cascade

If you ever reset the database password (for any reason, including "a credential got accidentally exposed and needs rotating" — see Section 12), **every deployment holding the old password breaks immediately and simultaneously**. In the real run, this meant:

1. `parmana-api-real`'s `DATABASE_URL` needed updating **and redeploying**.
2. `parmana-paytm-agent`'s `DATABASE_URL` needed updating **and redeploying** — separately, since it's a different Vercel project with its own copy of the value.
3. This repository's own local `.env` needed updating too, for any local script (like the audit-trail query in Section 10) that connects directly.

Missing any one of these three produces the exact same `password authentication failed` error from whichever piece you forgot — and because the error message is identical regardless of _which_ deployment or file still has the stale value, **you must explicitly check each of the three locations individually**, not infer from one working that the others are fine. In the real run, `parmana-api-real` was fixed and confirmed healthy while `parmana-paytm-agent` sat broken with the identical error for two full rounds, because "I redeployed" was said without specifying which project, and the second project's value was never actually touched.

### 4.5 How to tell the difference between "still propagating" and "actually still broken"

After a genuine, correct redeploy, a request can still fail for a few seconds to roughly a minute while Vercel's routing finishes propagating to the new deployment (old function instances still draining). This looked identical, in real symptoms, to a still-broken configuration. **The fix: retry 2-3 times, a few seconds apart, before concluding anything is still wrong.** In the real run, `parmana-api-real`'s `/health` failed once immediately after a correct redeploy, then returned `{"status":"UP"}` consistently on every retry afterward — that was propagation lag, not a bug. Contrast: `parmana-paytm-agent` returned the _identical_ error 3 times in a row, 4 seconds apart — that was a real, unfixed configuration problem, not lag. If retries don't change the result at all, it's not lag.

### 4.6 How to get the real underlying error when a service returns a generic message

`parmana-api-real`'s error handler deliberately returns a generic `{"error":"Internal Server Error"}` for any unrecognized exception (see `packages/api/src/middleware/error-handler.ts`) — this is intentional (never leak internals to a caller), but it means the client response alone won't tell you what actually broke. `parmana-paytm-agent`'s handler is simpler and returns `error.message` directly, which is why its errors were self-explanatory throughout this whole exercise and `parmana-api-real`'s weren't.

To see the real error from `parmana-api-real` (or any Vercel deployment) when you only have a generic client-facing message: **Vercel Dashboard → that project → Deployments → click the relevant (usually the latest, "Production") deployment → Runtime Logs / Function Logs / "Logs" tab.** The actual thrown error, with its full stack trace, is there. This is how the real `28P01` password error and its exact stack trace (through `PostgresRateLimitStore.increment` via `express-rate-limit` middleware) were found in the real run — reading the dashboard logs directly, not guessing from the generic client response.

If you have programmatic Vercel API access (this document's author did not — every attempt returned `403 Forbidden` or an empty team list, seemingly a scope limitation of the specific integration used, not a fixable account issue after two separate re-authentications), the equivalent is a runtime-errors/runtime-logs API call scoped to the project and a recent time window.

---

## 5. Part C — Generating a caller API key

`POST /execute` requires a valid caller API key (unless the deployment explicitly disables caller-auth, which a real deployment should not do). Check first whether auth is enabled:

```bash
curl -s https://<your-parmana-deployment>/ready
```

```json
{ "status": "READY", "authDisabled": false }
```

If `authDisabled` is `false` (it should be, for anything other than local development), you need a real key. Generate one from this repository's own tooling — **do not** hand-write an entry into `PARMANA_API_KEYS`; the hash must be produced by the same hashing the server verifies against:

```bash
npx tsx scripts/generate-api-key.ts --caller-id <your-caller-id> --allowed-capabilities paytm:refund
```

Scope `--allowed-capabilities` narrowly (here, just `paytm:refund`) rather than granting everything — least privilege, and it matches this codebase's own convention (see `docs/site/guides/connect-an-agent.mdx`: "Never grant `"*"` to a single-purpose agent"). Output looks like:

```
API key generated
--------------------------------
Caller ID : e2e-test-agent
Key       : <raw key, shown once -- yours will be a different random value>
Key hash  : <sha256 hash of the key above -- yours will be a different value>


Give the key above to the caller now. It is not written to disk by
this script and cannot be recovered once this terminal is closed.
Only the hash below is ever persisted.

Add this entry to PARMANA_API_KEYS (a JSON array):
{"callerId":"e2e-test-agent","keyHash":"<the hash printed above>","allowedCapabilities":["paytm:refund"]}
```

**The raw `Key` value is shown exactly once and cannot be recovered afterward.** Copy it somewhere safe immediately (a password manager, not a chat log — see Section 12).

**Add the printed JSON entry to `PARMANA_API_KEYS` on the deployment you're testing** (Vercel dashboard → that project → Environment Variables). `PARMANA_API_KEYS` is a JSON **array** — if one already exists there, append your new entry to it (don't replace the array); if it's empty/unset, set it to a single-element array: `[{"callerId":"...", ...}]` (note the surrounding `[` `]` — a bare object without the array wrapper will fail to parse). Save, then redeploy — saving an environment variable does **not** restart the currently-running deployment; you must trigger a new one (Deployments → latest → Redeploy, or push any commit).

**Verify the key works before attempting `/execute`:**

```bash
curl -i "https://<your-parmana-deployment>/callers/me" -H "Authorization: Bearer <key>"
```

```json
{
  "callerId": "e2e-test-agent",
  "allowedPrincipalIds": ["e2e-test-agent"],
  "allowedCapabilities": ["paytm:refund"],
  "unrestrictedCapabilities": false
}
```

Note `allowedPrincipalIds` — by default it matches your `callerId`. Your test request's `authority.principalId` field (Section 7) must equal one of these values, or the request is rejected with a principal-binding error before policy is ever evaluated.

If this call fails, stop — fix authentication first. Nothing about the request body shape matters until this works.

---

## 6. Part D — Wiring the Paytm connector's shared secret

`GatewayPaytmAdapter` (inside `parmana-api-real`) authenticates itself to `parmana-paytm-agent` with a bearer shared secret — this is **transport authentication between the two services**, proving the caller knows the secret, never a substitute for the real Ed25519 policy-approval signature (Section 1's step under `parmana-paytm-agent`). Generate a strong one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Set the **identical value** on both:

- `parmana-api-real`: `PAYTM_CONNECTOR_URL=https://<your-parmana-paytm-agent-deployment>.vercel.app` and `PAYTM_CONNECTOR_SHARED_SECRET=<the generated value>`
- `parmana-paytm-agent`: `PAYTM_CONNECTOR_SHARED_SECRET=<the exact same value>`

If either is missing on `parmana-api-real`, the `paytm:refund` capability simply isn't registered at all (this codebase's connectors are optional-by-default — see `docs/VERIFICATION-GAPS.md`'s "Gaps checked and found not applicable" entry on this exact design decision) — you'd see a capability-not-found error, not a connection failure. If the two values don't match exactly, `parmana-paytm-agent` returns `{"error":"unauthorized"}` (401) the instant a request arrives, before touching the database or verifying anything.

Redeploy both after setting these.

---

## 7. Part E — Building the request body

### 7.1 The exact validator rules (from `packages/runtime/src/validators/BusinessTransactionValidator.ts`)

These four checks run before policy is ever evaluated, and each has a distinct, specific error message:

| Rule                                                                              | Error if violated                                                    |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `metadata.businessTransactionId` must equal the top-level `businessTransactionId` | `"metadata.businessTransactionId must match businessTransactionId."` |
| `authorization.authorityId` must equal `authority.authorityId`                    | `"authorization.authorityId must match authority.authorityId."`      |
| `intent.authorizationId` must equal `authorization.authorizationId`               | `"intent.authorizationId must match authorization.authorizationId."` |
| `policy.name`, `policy.version`, `intent.action` must all be non-empty            | field-specific `"... is required."`                                  |

The **`metadata` block is easy to forget** — the canonical example in `docs/site/guides/connect-an-agent.mdx` at the time of writing omits it entirely, which is itself a real documentation gap surfaced during the real run; don't copy that example verbatim without adding `metadata`.

### 7.2 `businessTransactionId` is an idempotency key

Reusing the same `businessTransactionId` across attempts — including while you're just debugging and re-running the exact same test payload — will eventually hit:

```json
{ "error": "Business Transaction '<id>' already exists." }
```

(HTTP 409.) This happens as soon as the transaction is successfully **persisted**, which can occur even if a _later_ step in the same request ultimately fails or the response is never seen (e.g. a network timeout after the write succeeded). **Generate a fresh UUID for `businessTransactionId` (and matching `metadata.businessTransactionId`) on every real attempt.** Reuse it only if you are deliberately testing idempotency behavior itself.

### 7.3 The policy: `customer-refund@1.0.0`, exact thresholds

From `policies/customer-refund/1.0.0/policy.json` — these are the real, current values, not approximate:

```json
{
  "signalsSchema": {
    "refundEligible": "boolean",
    "managerApproved": "boolean",
    "fraudCheckPassed": "boolean",
    "refundAmount": "number"
  },
  "boundSignals": { "refundAmount": "parameters.amount" }
}
```

- **Approved** iff `refundEligible == true` AND `managerApproved == true` AND `fraudCheckPassed == true` AND `refundAmount <= 10000`.
- **Rejected**, with a specific reason, if `refundAmount > 10000` or `fraudCheckPassed == false`.
- **Rejected**, generic reason, for anything else that doesn't match an explicit rule (fail-closed default).
- **`boundSignals`**: `signals.refundAmount` is checked against `intent.parameters.amount` by `SignalIntentBinder` — they must match. Declaring `signals.refundAmount: 500` while `intent.parameters.amount` is actually `50000` is caught and rejected as a binding-tamper attempt, before policy evaluation runs at all — this is a deliberate security check (the exact scenario `docs/CLAIMS.md` §3.22's binding-tamper test proves), not a bug to route around by making the two numbers match something convenient. **Always set them to the same value.**

### 7.4 The full, correct request body shape

Verified working, verbatim structure (values below are illustrative placeholders — generate fresh UUIDs and a fresh order/txn ID for a real attempt):

```json
{
  "businessTransactionId": "<uuid-v4, fresh every attempt>",
  "metadata": {
    "businessTransactionId": "<same uuid as above>"
  },
  "authority": {
    "authorityId": "<uuid-v4>",
    "authorityType": "SERVICE",
    "principalId": "<must be one of allowedPrincipalIds from /callers/me, Section 5>",
    "issuedAt": "<ISO 8601 timestamp>"
  },
  "authorization": {
    "authorizationId": "<uuid-v4>",
    "authorityId": "<same authorityId as above>",
    "purpose": "<free text, human-readable>",
    "issuedAt": "<ISO 8601 timestamp>"
  },
  "intent": {
    "intentId": "<uuid-v4>",
    "authorizationId": "<same authorizationId as above>",
    "action": "paytm:refund",
    "target": "<any string; conventionally the orderId>",
    "parameters": {
      "orderId": "<Paytm order id>",
      "transactionId": "<Paytm transaction id being refunded>",
      "amount": 5
    },
    "createdAt": "<ISO 8601 timestamp>"
  },
  "policy": {
    "name": "customer-refund",
    "version": "1.0.0",
    "schemaVersion": "1.0.0"
  },
  "signals": {
    "refundEligible": true,
    "managerApproved": true,
    "fraudCheckPassed": true,
    "refundAmount": 5
  },
  "status": "RECEIVED"
}
```

Note `"authorityType": "SERVICE"` — never `"AGENT"`; that value does not exist in `AuthorityType` (per `docs/site/guides/connect-an-agent.mdx`).

**Using synthetic order/transaction IDs (not a real prior Paytm charge) is fine and expected for a connectivity/wiring test.** The request will be approved by policy, correctly signed, correctly verified, and correctly forwarded — Paytm's staging API will simply respond with a non-success result (`resultStatus: "UNKNOWN"` or similar) because there's nothing real to refund. That is success for the purpose of proving the wiring; it is not success for the purpose of actually refunding anything. Do not mistake one for the other.

**A script to generate this correctly, with fresh IDs, every time** (adjust the deployment/policy details as needed):

```javascript
const { randomUUID } = require("crypto");
const businessTransactionId = randomUUID();
const authorityId = randomUUID();
const authorizationId = randomUUID();
const intentId = randomUUID();
const now = new Date().toISOString();
const orderId = "TEST-ORDER-" + Date.now();
const txnId = "TEST-TXN-" + Date.now();

const body = {
  businessTransactionId,
  metadata: { businessTransactionId },
  authority: {
    authorityId,
    authorityType: "SERVICE",
    principalId: "e2e-test-agent", // must match your key's allowedPrincipalIds
    issuedAt: now,
  },
  authorization: {
    authorizationId,
    authorityId,
    purpose: "End-to-end test",
    issuedAt: now,
  },
  intent: {
    intentId,
    authorizationId,
    action: "paytm:refund",
    target: orderId,
    parameters: { orderId, transactionId: txnId, amount: 5 },
    createdAt: now,
  },
  policy: { name: "customer-refund", version: "1.0.0", schemaVersion: "1.0.0" },
  signals: {
    refundEligible: true,
    managerApproved: true,
    fraudCheckPassed: true,
    refundAmount: 5,
  },
  status: "RECEIVED",
};

require("fs").writeFileSync(
  "e2e-test-body.json",
  JSON.stringify(body, null, 2),
);
console.log("New businessTransactionId:", businessTransactionId);
```

Run it fresh (`node -e "<script above>"`) before every real attempt, not just the first one.

---

## 8. Part F — Running the test

### 8.1 PowerShell (Windows)

```powershell
$headers = @{
    "Authorization" = "Bearer <your raw API key from Section 5>"
    "Content-Type"  = "application/json"
}

$body = Get-Content -Raw -Path ".\e2e-test-body.json"

try {
    $response = Invoke-WebRequest -Uri "https://<your-parmana-deployment>/execute" -Method Post -Headers $headers -Body $body
    Write-Host "STATUS:" $response.StatusCode
    $response.Content
} catch {
    Write-Host "STATUS:" $_.Exception.Response.StatusCode.value__
    $_.ErrorDetails.Message
}
```

**Why the `try`/`catch` is not optional**: `Invoke-WebRequest` throws an exception on any non-2xx response instead of returning it as a normal result. Without the `catch` block capturing `$_.ErrorDetails.Message`, you only see a generic PowerShell error and lose the actual JSON error body — which is where every diagnostic detail in this whole document came from.

**Run each of the three statements above as separate commands** if pasting into an interactive session — don't paste explanatory prose alongside code into a live PowerShell prompt; it will be interpreted as code and produce a parse error.

**Working directory matters**: `Get-Content -Raw -Path ".\e2e-test-body.json"` is relative to wherever your shell's current directory is. If you `cd` into a different repository (e.g. `parmana-paytm-agent`) partway through a session and forget to `cd` back, this fails with `Cannot find path ... because it does not exist` — and PowerShell variables persist across commands in the same session, so a failed re-assignment silently leaves `$body` at whatever it was set to last, which can make a subsequent request "work" using stale data rather than failing loudly. Always verify you're in the right directory before re-running.

### 8.2 curl / bash (any OS)

```bash
curl -s -i -X POST "https://<your-parmana-deployment>/execute" \
  -H "Authorization: Bearer <your raw API key>" \
  -H "Content-Type: application/json" \
  --data @e2e-test-body.json \
  --max-time 30
```

**Note on automated tools running this for you**: a POST that can trigger a real financial-connector action (even against a staging/sandbox environment) may be blocked by an AI coding assistant's own safety classifier as a "real-world transaction" action. If that happens, the assistant should give you the exact command to run yourself rather than attempting to bypass the block — that block is doing its job.

---

## 9. Part G — Reading the response

A successful `POST /execute` (HTTP 200) returns the complete, real `ExecutionTrustRecord` — not a summary. Key fields to check, in order of "how far did this actually get":

1. **`executions[0].decision.outcome`**: `"APPROVED"` or `"REJECTED"` — the policy engine's decision, with a human-readable `.reason`.
2. **`executions[0].evidence.attributes.connector.responseSummary.success`**: `true`/`false` — whether Paytm itself confirmed the refund. `false` with synthetic order/transaction IDs is expected (Section 7.4) — it still proves the entire chain executed correctly; Paytm just had nothing real to refund.
3. **`executions[0].chainHash` / `.chainSignature`**: proof the execution itself was signed and chained.
4. **`verifications[0].status`**: `"VERIFIED"` — proof the resulting trust record was independently re-verified after being written, not just asserted.
5. **`receipts[0]`**: a separately signed receipt, issued only after verification succeeded.
6. **`authorization.payload`**: the full signed authorization Parmana minted for this request — `policyContentHash`, `signalsHash`, `businessTransactionHash`, `nonce`, `authorizationId`, all present.

If any of these levels is missing or the response is a non-200 status, see Section 11 for the specific error catalog before assuming something new is broken — most failure modes at this stage were already hit and diagnosed in the real run.

---

## 10. Part H — Verifying the cross-service audit trail

This is the actual payoff of GAP-1/GAP-3 (see `REMEDIATION.md`, `docs/VERIFICATION-GAPS.md` G-42/G-43): both `parmana-api-real` and `parmana-paytm-agent` write to the **same** `execution_audit_events` table, correlated by `businessTransactionId` (not `authorizationId` — Parmana's own authorization identity is never forwarded across that wire boundary; see Section 1).

Prerequisite: your local `.env`'s `DATABASE_URL` must point at the **same** Supabase project the two deployments use, with a **current** (not stale/rotated-out) password (Section 4.4).

```javascript
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool
  .query(
    `SELECT type, occurred_at, connector_id, authorization_id, session_id, action, reason,
          business_transaction_id, chain_hash IS NOT NULL as signed
   FROM execution_audit_events
   WHERE business_transaction_id = $1
   ORDER BY id ASC`,
    ["<the businessTransactionId from your test>"],
  )
  .then((r) => console.log(JSON.stringify(r.rows, null, 2)))
  .catch((e) => console.error("QUERY FAILED:", e.message));
```

**What a genuinely complete, correct run looks like** (real output from the run this document is based on):

```json
[
  {
    "type": "session.created",
    "connector_id": "paytm",
    "authorization_id": "<Parmana's real authorizationId>",
    "action": "paytm:refund",
    "signed": true
  },
  {
    "type": "authorization.verified",
    "connector_id": "paytm",
    "authorization_id": "<the deterministic refId -- parmana-paytm-agent has no access to Parmana's authorizationId>",
    "action": "paytm-refund",
    "signed": false
  },
  {
    "type": "execution.rejected",
    "connector_id": "paytm",
    "reason": "Paytm refund did not succeed: resultStatus=UNKNOWN, resultCode=UNKNOWN",
    "signed": false
  },
  {
    "type": "execution.completed",
    "connector_id": "paytm",
    "authorization_id": "<Parmana's real authorizationId, same as row 1>",
    "action": "paytm:refund",
    "signed": true
  }
]
```

Four rows: two signed and chained (Parmana's own, using its private key), two unsigned (`parmana-paytm-agent`'s own, since it never holds a private key — this asymmetry is deliberate, not a gap; see G-43's own reasoning). Rows 2 and 3's `execution.rejected` reflects Paytm's own non-success outcome; row 4's `execution.completed` reflects that the **connector call itself** completed without throwing — these are not contradictory. A connector returning `success: false` is a clean, expected business result, not an exception (Section 1) — this is exactly why the type names differ between the two services' perspectives on the same event.

If this query returns fewer than four rows, or an empty result, work backward through Section 1's architecture diagram to determine which hop didn't record what it should have, rather than assuming the whole test failed — the `POST /execute` response itself (Section 9) is the authoritative signal for whether the _transaction_ succeeded; this table is the record of what each _service_ independently observed and wrote down about it.

---

## 11. Appendix: full error catalog, verbatim, with real causes

Every one of these was actually hit, in this order, in the real run. If you hit any of these, this is the real, confirmed cause — not a guess.

| Error (verbatim)                                                                                                                        | HTTP status                                                 | Real cause                                                                                                                                                                                         | Fix                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{"error":"metadata.businessTransactionId must match businessTransactionId."}`                                                          | 400                                                         | Request body omitted the `metadata` block (the canonical doc example does this)                                                                                                                    | Add `metadata: { businessTransactionId: <same value> }`                                                                                              |
| `{"error":"Internal Server Error"}`                                                                                                     | 500                                                         | Generic — the real cause is hidden by design; check Vercel Runtime Logs (Section 4.6)                                                                                                              | —                                                                                                                                                    |
| `{"error":"getaddrinfo ENOTFOUND db.<ref>.supabase.co"}`                                                                                | 500 (from `parmana-paytm-agent`, which doesn't hide errors) | `DATABASE_URL` uses Supabase's Direct connection hostname, unreachable (IPv6-only) from Vercel's IPv4-only egress                                                                                  | Switch to the Transaction pooler connection string (Section 4.1)                                                                                     |
| `{"error":"password authentication failed for user \"postgres\""}`                                                                      | 500                                                         | `DATABASE_URL`'s password is wrong — commonly the literal `[YOUR-PASSWORD]` placeholder left in, or a stale/rotated-out password                                                                   | Get a fresh connection string from Supabase's Connect dialog, substitute the real password in full including removing the brackets (Section 4.2–4.3) |
| `{"error":"Caller authentication audit trail is unavailable; refusing to proceed without an audit record.","code":"AUDIT_UNAVAILABLE"}` | 503                                                         | `parmana-api-real`'s own `DATABASE_URL` is broken (same DB connectivity issue, surfacing at the caller-audit-write step instead of at `/health`)                                                   | Same fix as the password/pooler issues above, applied to `parmana-api-real` specifically                                                             |
| `{"error":"Business Transaction '<id>' already exists."}`                                                                               | 409                                                         | `businessTransactionId` was reused across attempts (it's an idempotency key)                                                                                                                       | Generate a fresh UUID (Section 7.2)                                                                                                                  |
| `{"error":"authorization signature is invalid"}` (from `parmana-paytm-agent`, when testing that service directly)                       | 500                                                         | **Expected and correct** if you deliberately sent a fake/garbage signature to test connectivity in isolation — this actually confirms the DB connection and signature-verification logic both work | None needed — this is proof of correct behavior, not a bug                                                                                           |
| `{"error":"unauthorized"}`                                                                                                              | 401                                                         | `PAYTM_CONNECTOR_SHARED_SECRET` doesn't match between `parmana-api-real` and `parmana-paytm-agent`                                                                                                 | Set the identical value on both, redeploy both (Section 6)                                                                                           |
| `{"error":"authentication required"}`                                                                                                   | 401 (from `/execute`)                                       | The Bearer token was empty/missing — commonly a PowerShell session variable (`$headers`) that was never (re-)set, e.g. after a session reset or `cd` between repos                                 | Re-run the `$headers = @{...}` assignment before retrying                                                                                            |
| `Cannot find path '...\e2e-test-body.json' because it does not exist`                                                                   | (PowerShell error, not HTTP)                                | Wrong working directory                                                                                                                                                                            | `cd` to the directory containing the file before running `Get-Content`                                                                               |
| `Missing property name after reference operator.`                                                                                       | (PowerShell parse error)                                    | Explanatory prose (e.g. a parenthetical note) was pasted into the terminal along with actual code                                                                                                  | Only paste code blocks meant to be run; keep explanations separate                                                                                   |

**A meta-lesson worth stating explicitly**: at one point in the real run, a request for "audit and fix" assumed a _different_ symptom set (empty response body, no server logs, silent crash) than what direct testing had actually just shown (a specific, non-empty, informative error message). Executing a prescriptive fix-list against a premise that doesn't match the evidence in hand wastes real time and can add unnecessary code changes (extra logging, restructured error handling) that don't address the real, already-diagnosed cause. **Before following any troubleshooting procedure — including this one — check its stated symptoms against what you're actually observing right now.** If they don't match, the procedure's premise is wrong for your situation; find the mismatch before applying any of its fixes.

---

## 12. Security notes

- **`DATABASE_URL` values, once they contain a real password, must never be pasted into a chat conversation, an issue tracker, a shared document, or any other place with a retention/access footprint beyond the two systems that need it (the deployment's own env-var store, and your local `.env` if you need to query the database directly).** If one is ever exposed this way, **rotate the database password immediately** (Supabase Dashboard → Project Settings → Database → Reset database password), then update every deployment and local file that held the old value (Section 4.4's cascade). Treat the exposed value as permanently compromised the moment it's typed anywhere outside those two places, regardless of whether anyone is known to have misused it.
- The raw caller API key (Section 5) is shown exactly once by design and is never recoverable from the stored hash. Losing it means generating a new one, not "looking it up."
- `PAYTM_CONNECTOR_SHARED_SECRET` is transport authentication only — it proves the caller knows a shared value, never that Parmana's policy engine approved anything (Section 1). Never treat its presence as a substitute for the real Ed25519 authorization signature check.
- Scope every generated API key's `allowedCapabilities` to exactly what the test needs (Section 5) — never `"*"` for a single-purpose test or agent.
