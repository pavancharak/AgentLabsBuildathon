# Using the Live Parmana API to Build Any Demo

**Base URL:** `https://parmana-api-real.vercel.app`

This is the real, production `@parmana/api` code (`packages/api`), not the standalone
buildathon demo (deleted), not a mock. Real `PolicyEngine`, real Ed25519 signing, real
Supabase storage (`parmana-sandbox` project), real caller authentication. Deployed via
`vercel.json` + `api/index.ts` at the repo root; see `docs/VERIFICATION-GAPS.md` ("Gaps
closed in the 2026-09-11 real-deployment verification session" and the PQC remediation
table) for the full history of how it got here and what was found and fixed along the way.

This file is the practical "how do I actually call it" reference. For what each piece
_means_ conceptually, see `docs/site/` (published docs); for what's cryptographically
guaranteed and what isn't, see `docs/CLAIMS.md`.

**Contents**

- [What This Deployment Is, and Isn't](#what-this-deployment-is--and-isnt)
- [Authentication](#authentication), how to get an API key and how to use it
- [The Shape of a Request](#the-shape-of-a-request-businesstransaction)
- [Available Policies](#available-policies), the 12 already deployed
- [How to Write a New Policy](#how-to-write-a-new-policy), schema, rules, **how to deploy it**
- [Endpoints Reference](#endpoints-reference), every real route, full table
- [Step by Step: Building a New Demo](#step-by-step-building-a-new-demo), worked example
- [Verifying a Result Independently](#verifying-a-result-independently)
- [When to Use This vs. Other Options](#when-to-use-this-vs-other-options)
- [Troubleshooting](#troubleshooting)

---

## TL;DR

```bash
curl -X POST https://parmana-api-real.vercel.app/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your key>" \
  -d @your-transaction.json
```

Every route except `GET /health`, `GET /ready`, `GET /openapi.yaml`, `GET /openapi.json`,
`GET /api-manifest.json`, `GET /documentation`, `GET /reference`, `POST /refusal/verify`,
`POST /audit/verify`, `GET /keys/:keyId`, and `GET /.well-known/jwks.json` requires that
`Authorization: Bearer` header.

---

## What This Deployment Is, and Isn't

**Is:** a real authorization engine. Submit a `BusinessTransaction`, it evaluates the
named policy against your declared signals, produces a real, deterministic, Ed25519-signed
decision (`APPROVE`/`REJECT`), and persists it durably. Rejections complete end to end,
signed, durable, retrievable. This is genuinely useful for demoing: policy authoring,
signal binding, guardrails correctly declining a request, cryptographic proof of a
decision, independent offline verification, audit trails.

**Correction (2026-09-14): `paytm:refund` is now a real, wired connector on this
deployment, and this section's blanket "no connector is registered" claim is no longer
accurate for it.** `PAYTM_CONNECTOR_URL`/`PAYTM_CONNECTOR_SHARED_SECRET` are configured on
this deployment, pointing at a real, separately deployed `parmana-paytm-agent` service,
which itself talks to Paytm's staging API. A `paytm:refund` request that policy approves
now reaches Paytm's real staging API and returns a real (non-success, for a synthetic
order) result — proven live, end to end, including a full cross-service, correlated audit
trail (`execution_audit_events`, joined by `businessTransactionId` across both services).
Full runbook, every command, every error hit while wiring this up and how each was fixed:
`END-TO-END-FLOW.md` (repo root) / [End-to-end: agent → Parmana → Paytm](/guides/end-to-end-paytm-flow).

**Everything else below about HubSpot/GitHub still holds**, and mirrors this codebase's own
G-27 finding (`docs/VERIFICATION-GAPS.md`): a capability should not be wired to a connector
until its signals are independently verified, not merely caller-declared. `HUBSPOT_PRIVATE_APP_TOKEN`
and GitHub App credentials are still not configured on this deployment, and `NODE_ENV` isn't
`test` (so the test-fixture connector isn't registered either). An **APPROVED** decision for
`hubspot-deal-update`/`github-pr-approval`/etc. still reaches Policy Engine, gets signed, and
then fails with `503`/`CONNECTOR_NOT_REGISTERED` at the dispatch
stage. A **DENIED** decision never reaches that stage (policy rejection happens before
dispatch), so it always completes cleanly regardless of capability. Plan demos accordingly:
"show the system correctly declining" is a complete, real demo for any capability; "show
money/data actually moving" is real and demonstrable specifically for `paytm:refund` as of
this correction, and not yet for HubSpot/GitHub.

If you need HubSpot/GitHub to fire too, add real `HUBSPOT_PRIVATE_APP_TOKEN` /
`GITHUB_APP_ID`+`GITHUB_INSTALLATION_ID`+`GITHUB_APP_PRIVATE_KEY` to this deployment's
Vercel env vars and redeploy, or build a fully self-contained, connector-free
demonstration the way the (now removed) standalone buildathon demo did.

---

## Authentication

Bearer token in the `Authorization` header. Two keys currently provisioned
(`PARMANA_API_KEYS` on Vercel):

| `callerId`                  | `allowedCapabilities`                     | Use for                                                                           |
| --------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| `demo`                      | `["*"]` (wildcard, any policy/capability) | Building new demos. Use this one by default.                                      |
| `agent-vendor-payment-demo` | `["agent-vendor-payment"]` only           | The original RED-work test key; kept for continuity, don't need it for new demos. |

The raw key values were shown once in a terminal and are not stored in this repo (only
their salted hashes are, in the `PARMANA_API_KEYS` env var on Vercel). If you don't have
the `demo` key's raw value, mint a new one:

```bash
npx tsx scripts/generate-api-key.ts \
  --caller-id my-new-demo \
  --allowed-capabilities "*" \
  --credential-holder-type SERVICE
```

This prints the raw key once (save it somewhere, it's never recoverable after) and a
`PARMANA_API_KEYS` entry to add. To actually enable it on the live deployment:

```bash
npx vercel env rm PARMANA_API_KEYS production --yes
# then re-add the FULL array (existing entries + your new one) via stdin:
printf '%s' '[ ...existing entries..., {"callerId":"my-new-demo","keyHash":"...","allowedCapabilities":["*"],"credentialHolderType":"SERVICE"} ]' \
  | npx vercel env add PARMANA_API_KEYS production
npx vercel deploy --prod
```

**Principal scoping, a separate check from capability scoping:** a key with no
`allowedPrincipalIds` configured (both keys above) may only assert
`authority.principalId` equal to its own `callerId`. Simplest path: set
`authority.principalId` to `"demo"` in every transaction you submit with the `demo` key.

---

## The Shape of a Request: `BusinessTransaction`

```json
{
  "businessTransactionId": "<a real UUID v4>",
  "metadata": { "businessTransactionId": "<same UUID>" },
  "authority": {
    "authorityId": "authority-demo",
    "authorityType": "SERVICE",
    "principalId": "demo",
    "issuedAt": "2026-01-01T00:00:00Z"
  },
  "authorization": {
    "authorizationId": "auth-demo",
    "authorityId": "authority-demo",
    "purpose": "human-readable reason",
    "issuedAt": "2026-01-01T00:00:00Z"
  },
  "intent": {
    "intentId": "intent-demo",
    "authorizationId": "auth-demo",
    "action": "<must match a boundSignals-declared capability if the policy binds one>",
    "target": "<free-form string, a vendor id, an order id, a resource path>",
    "parameters": { "amount": 50 },
    "createdAt": "2026-01-01T00:00:00Z"
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
    "refundAmount": 50
  },
  "status": "RECEIVED",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

Hard requirements, all fail-closed with a clear `400`/`403` if wrong:

- `businessTransactionId` **must be a real UUID** (regex-validated), `crypto.randomUUID()`
  in Node, `uuid4()` in Python, etc. Not a slug like `"txn-1"`.
- `authority.authorityType` must be one of `USER`, `ROLE`, `SERVICE`, `ORGANIZATION`, not
  `"AGENT"` (a real mistake made and caught earlier in this same deployment's build, see
  `docs/VERIFICATION-GAPS.md`'s "Gaps closed in the 2026-09-11 real-deployment verification
  session"). An autonomous agent maps to `SERVICE`.
- `intent.action` must match `authority.principalId`'s permitted capability if you're using
  a capability-scoped key; the `demo` key's wildcard skips this check.
- `policy.name`/`policy.version` must match a real, deployed policy directory under
  `policies/` (see the table below), the caller names the policy explicitly, it is not
  inferred from `intent.action`.
- Every fact a policy's rules reference must appear in `signals`, with the exact key names
  from that policy's `signalsSchema` (see below). A fact the policy declares as
  `boundSignals` (bound to an `intent` field) is additionally cross-checked: your declared
  signal value must equal the real `intent` field it's bound to, or the whole request is
  rejected before Policy Engine ever runs (`SignalIntentBinder`).

---

## Available Policies

Every policy actually deployed (`policies/*/*/policy.json`, baked into the Vercel build).
`bound` signals are cross-checked against real `intent` fields, get these right or the
request is rejected before policy evaluation even starts. Everything else is a plain,
caller-declared attestation (fine for a demo; see `docs/VERIFICATION-GAPS.md` G-27 for why
that distinction matters for anything beyond a demo).

| Policy (`name@version`)       | What it authorizes                                                                   | Signals (`signalsSchema`)                                                                                                                                                                                    | Bound to `intent`                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `access-control@1.0.0`        | Access requests via auth/MFA/device-trust/session-risk                               | `userAuthenticated`, `userAuthorized`, `mfaVerified`, `deviceTrusted`, `sessionRiskScore`                                                                                                                    | None                                                                             |
| `agent-vendor-payment@1.0.0`  | An autonomous agent paying a vendor, within credential/velocity limits               | `vendorAllowed`, `withinCredentialLimit`, `withinVelocityLimit`, `paymentAmount`, `vendorId`                                                                                                                 | `paymentAmount`→`parameters.amount`, `vendorId`→`target`                         |
| `api-key-issuance@1.0.0`      | Issuing a new API key                                                                | `requesterVerified`, `scopeAuthorized`, `keyLifetimeDays`, `riskScore`                                                                                                                                       | `keyLifetimeDays`→`parameters.lifetimeDays`                                      |
| `connector-capability@1.0.0`  | Capability-based connector authorization (reference policy)                          | `capability`, `paymentAmount`                                                                                                                                                                                | `paymentAmount`→`parameters.amount`                                              |
| `customer-refund@1.0.0`       | Customer refunds, bounded by eligibility/approval/fraud check/amount                 | `refundEligible`, `managerApproved`, `fraudCheckPassed`, `refundAmount`                                                                                                                                      | `refundAmount`→`parameters.amount`                                               |
| `database-change@3.0.0`       | Production DB changes                                                                | `changeApproved`, `migrationValidated`, `backupAvailable`, `maintenanceWindow`, `riskScore`                                                                                                                  | None                                                                             |
| `github-pr-approval@1.0.0`    | PR approval via reviews/status checks/branch protection                              | `repositoryAuthorized`, `requiredReviewsCompleted`, `statusChecksPassed`, `branchProtected`, `riskScore`                                                                                                     | None                                                                             |
| `hubspot-deal-update@1.0.0`   | HubSpot deal stage/amount updates                                                    | `currentDealStage`, `proposedDealStage`, `dealStageChangeRequested`, `dealStageTransitionAllowed`, `amountChangeRequested`, `amountDeltaAbs`, `amountChangeExceedsThreshold`, `preAuthorizedForAmountChange` | `proposedDealStage`→`parameters.dealstage`, `proposedAmount`→`parameters.amount` |
| `llm-tool-call@1.0.0`         | AI-initiated tool execution                                                          | `toolAllowed`, `resourceAuthorized`, `humanApproval`, `executionEnvironment`, `riskScore`                                                                                                                    | None                                                                             |
| `production-deployment@1.0.0` | Production deployments                                                               | `deploymentApproved`, `changeVerified`, `rollbackReady`, `maintenanceWindow`, `riskScore`                                                                                                                    | None                                                                             |
| `rag-document-access@1.0.0`   | Enterprise document retrieval                                                        | `requesterAuthenticated`, `requesterAuthorized`, `documentAccessible`, `classificationPermitted`, `riskScore`                                                                                                | None                                                                             |
| `vendor-payment@2.0.0`        | Vendor payments (real production policy, see G-27's own account of why it's unwired) | `vendorVerified`, `invoiceVerified`, `paymentApproved`, `sufficientFunds`, `paymentAmount`, `riskScore`, `vendorId`                                                                                          | `paymentAmount`→`parameters.amount`, `vendorId`→`target`                         |

**Want a new scenario none of these cover?** Write a new policy, the full spec is next.

---

## How to Write a New Policy

A policy is one JSON file: `policies/<policyId>/<version>/policy.json`. Authoritative
source: `packages/policy/src/types/Policy.ts` and `PolicyValidator.ts`
(`packages/policy/src`), everything below is read directly from there, not guessed.

### 1. The schema

```jsonc
{
  "policyId": "expense-reimbursement", // required, non-empty
  "policyVersion": "1.0.0", // required, non-empty, this is what
  // callers put in policy.version
  "schemaVersion": "1.0.0", // required, non-empty
  "description": "Human-readable summary.", // optional

  // Every signal a rule below references, and its type. Documentation
  // only, not enforced against actual submitted values, but every
  // key here should also appear in either boundSignals or
  // unboundSignalReasons (see below), or the policy fails to load.
  "signalsSchema": {
    "employeeVerified": "boolean",
    "expenseAmount": "number",
    "receiptAttached": "boolean",
    "categoryApproved": "boolean",
  },

  // Signals that MUST equal a real field of the submitted Intent
  // (target/parameters), cryptographically cross-checked by
  // SignalIntentBinder BEFORE PolicyEngine ever runs. A mismatch is
  // an outright rejection, not a policy REJECT decision -- it never
  // reaches your rules at all.
  "boundSignals": {
    "expenseAmount": "parameters.amount",
  },

  // Every OTHER fact your rules reference must be acknowledged here,
  // with a real reason, or the policy fails PolicyValidator and
  // cannot be loaded at all. This is enforced, not a style guideline.
  "unboundSignalReasons": {
    "employeeVerified": "Independently attested by an HR/identity system; no Intent-side equivalent field exists to bind against.",
    "receiptAttached": "Result of a document-upload check; not a value the Intent itself declares.",
    "categoryApproved": "Result of an expense-category policy lookup, evaluated independently of this Intent.",
  },

  // Evaluated in order. First match wins.
  "rules": [
    {
      "id": "approve-expense",
      "condition": {
        "all": [
          { "fact": "employeeVerified", "operator": "eq", "value": true },
          { "fact": "receiptAttached", "operator": "eq", "value": true },
          { "fact": "categoryApproved", "operator": "eq", "value": true },
          { "fact": "expenseAmount", "operator": "lte", "value": 5000 },
        ],
      },
      "outcome": {
        "action": "approve",
        "reason": "Expense authorized: employee verified, receipt attached, category approved, amount within limit.",
      },
    },
    {
      "id": "reject-missing-receipt",
      "condition": {
        "fact": "receiptAttached",
        "operator": "eq",
        "value": false,
      },
      "outcome": {
        "action": "reject",
        "reason": "Expense rejected: no receipt attached.",
      },
    },
    {
      "id": "reject-excessive-amount",
      "condition": { "fact": "expenseAmount", "operator": "gt", "value": 5000 },
      "outcome": {
        "action": "reject",
        "reason": "Expense rejected: amount exceeds the $5,000 auto-approval limit.",
      },
    },
    {
      "id": "reject-default",
      "condition": { "always": true },
      "outcome": {
        "action": "reject",
        "reason": "Expense rejected: one or more required conditions were not satisfied.",
      },
    },
  ],
}
```

### 2. Condition grammar

Four shapes, recursively composable:

| Shape                                           | Meaning                                        |
| ----------------------------------------------- | ---------------------------------------------- |
| `{ "fact": "x", "operator": "eq", "value": v }` | Leaf comparison                                |
| `{ "all": [cond, cond, ...] }`                  | Every child must be true (AND)                 |
| `{ "any": [cond, cond, ...] }`                  | At least one child must be true (OR)           |
| `{ "always": true }`                            | Always true, the standard final catch-all rule |

Full operator list (`PolicyOperator`, enforced, an unknown operator fails to load):

`eq`, `neq` · `gt`, `gte`, `lt`, `lte`, `between` · `in`, `not_in` · `contains`,
`not_contains`, `contains_all`, `contains_any` · `starts_with`, `ends_with`, `matches` ·
`exists`, `not_exists` · `is_true`, `is_false` · `is_null`, `is_not_null` · `length_eq`,
`length_gt`, `length_gte`, `length_lt`, `length_lte` · `type_is`

Operators must be deterministic, side-effect-free, and operate only on the signals you
supply, no clocks, no randomness, no network/database access from inside a condition,
by design (`packages/policy/src/types/Policy.ts`'s own doc comment).

### 3. What gets rejected at load time (`PolicyValidator.validate()`, fail-closed)

- Missing/empty `policyId`, `policyVersion`, or `schemaVersion`
- `rules` not a non-empty array
- A rule with no `id`, or an `id` reused by another rule
- A rule whose `outcome.action` isn't `"approve"` or `"reject"`, or with no `outcome.reason`
- An operator not in the list above
- A `boundSignals` or `unboundSignalReasons` entry that isn't a well-formed
  `{ string: string }` pair
- The same fact appearing in **both** `boundSignals` and `unboundSignalReasons`
  (contradictory, a bound fact needs no reason for being unbound)
- **Any rule-referenced fact that is in neither `boundSignals` nor
  `unboundSignalReasons`**, the exact error: `Policy references fact(s) 'x' with no
boundSignals entry and no unboundSignalReasons entry.` This is the one people miss most
  often: every single fact your rules touch needs one or the other, no silent gaps allowed.

Advisory only, never blocks loading, `PolicyValidator.findRuleConflicts()` warns (not
throws) when two rules' conditions could both be true for the same input, since an earlier
rule then silently decides and the later one is partly/wholly unreachable. Worth checking,
not enforced.

### 4. Deploy it

Drop the file at `policies/<policyId>/<version>/policy.json` in this repo, then:

```bash
git add policies/expense-reimbursement/
git commit -m "Add expense-reimbursement policy"
npx vercel deploy --prod
```

(Policies are baked into the Vercel build via `vercel.json`'s `includeFiles`, there's no
separate "upload a policy" API call; a new policy file requires a redeploy to take effect
on the live URL. Locally, `npm run dev` picks up a new file on the next process restart,
no redeploy needed.)

### 5. Call it

Exactly the same as any policy in the table above, set `policy.name`/`policy.version` to
match, and `intent.action` should equal your policyId if you want the `demo` key's
capability check to have a natural, self-describing mapping (not structurally required,
since `policy.name` is what's actually evaluated, but keeps `GET /transactions` readable):

```json
{
  "intent": {
    "action": "expense-reimbursement",
    "target": "expense-4471",
    "parameters": { "amount": 1200 }
  },
  "policy": {
    "name": "expense-reimbursement",
    "version": "1.0.0",
    "schemaVersion": "1.0.0"
  },
  "signals": {
    "employeeVerified": true,
    "expenseAmount": 1200,
    "receiptAttached": true,
    "categoryApproved": true
  }
}
```

**This exact policy is real, not illustrative**, it's deployed at
`policies/expense-reimbursement/1.0.0/policy.json` and live on this deployment right now.
The whole loop above (write → validate → deploy → call → get a real signed decision →
independently verify) was run for real while writing this doc: an amount of `12000`
produced a real `403 POLICY_DENIED`, a real signed `RefusalRecord`, retrievable via
`GET /refusal/:id`, and independently verified `true` via `POST /refusal/verify`. Try it
yourself with the `demo` key.

---

## Endpoints Reference

**Real code, not aspirational.** Full machine-readable spec: `GET /openapi.yaml`
(or `GET /openapi.json`) or browse `GET /documentation` (Swagger UI) / `GET /reference`
(ReDoc). Machine-readable discovery index, including both SDKs' real current versions:
`GET /api-manifest.json`. Source of truth: `packages/api/src/app.ts`.

| Method & path                | Auth     | What it does                                                                                                                                        |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                | none     | Liveness. `{"status":"UP"}`                                                                                                                         |
| `GET /ready`                 | none     | Readiness, includes `authDisabled`                                                                                                                  |
| `GET /openapi.yaml`          | none     | The full OpenAPI 3.1 spec, YAML                                                                                                                     |
| `GET /openapi.json`          | none     | The identical spec, JSON                                                                                                                            |
| `GET /api-manifest.json`     | none     | Machine-readable discovery index: spec locations, auth scheme, both SDKs' real versions                                                             |
| `GET /documentation`         | none     | Swagger UI over the spec above                                                                                                                      |
| `GET /reference`             | none     | Read-only ReDoc view of the spec above                                                                                                              |
| `GET /version`               | required | `{name, version, api}`                                                                                                                              |
| `GET /callers/me`            | required | The authenticated caller's own identity and resolved scope                                                                                          |
| `POST /execute`              | required | **The main endpoint.** Submit a `BusinessTransaction`, get back the full signed `ExecutionTrustRecord` (or a `403 POLICY_DENIED` / `500` per above) |
| `POST /transactions`         | required | Same pipeline as `/execute`, different response shape (raw transaction, not the full trust record)                                                  |
| `GET /transactions`          | required | List your own submitted transactions, paginated                                                                                                     |
| `POST /verify`               | required | Re-verify a Trust Record by id; appends a new `Verification`                                                                                        |
| `GET /verification/:id`      | required | Read the most recent `Verification` without re-verifying                                                                                            |
| `GET /trust-records/:id`     | required | The full signed Execution Trust Record for one transaction                                                                                          |
| `GET /trust-records`         | required | Bulk export, paginated, `since`/`until` filters                                                                                                     |
| `GET /refusal/:id`           | required | The signed Refusal Record for a rejected transaction                                                                                                |
| `POST /refusal/verify`       | **none** | Independently verify a Refusal Record's signature, body is the record itself, get `{valid}` back                                                    |
| `POST /audit/verify`         | **none** | Verify a signed caller-audit event's signature, body is `{ event, signature }` (note: _wrapped_, unlike `/refusal/verify`'s bare-record body)       |
| `GET /keys/:keyId`           | **none** | Fetch a public signing key (PEM + JWK where supported), `default` and `gateway` exist today                                                         |
| `GET /.well-known/jwks.json` | **none** | Every public key this deployment currently holds                                                                                                    |
| `POST /receipt`              | required | Generate a portable Receipt from a Trust Record                                                                                                     |
| `GET /receipt/latest/:id`    | required | The latest Receipt for a transaction                                                                                                                |
| `POST /replay`               | required | Deterministic replay of a past decision                                                                                                             |
| `GET /policies`              | required | List loaded policies                                                                                                                                |

---

## Step by Step: Building a New Demo

1. **Pick a policy** from the table above (or write a new one, see "How to Write a New
   Policy" above).
2. **Decide your approve/deny signal set.** Every fact the policy's rules reference must
   be in `signals`; get the `boundSignals` ones (if any) to actually match the `intent`
   fields they're bound to.
3. **Generate a real UUID** for `businessTransactionId`.
4. **`POST /execute`** with the `demo` key. A `DENIED` decision (`403`) completes fully,
   good for "guardrail correctly declines" demos. An `APPROVED` decision reaches Policy
   Engine and signs, then `500`s at dispatch (see "What this deployment is/isn't"), still
   useful to show the signed `authorization` payload if you fetch the record before/instead
   of relying on the `/execute` response for the approved case (see next point).
5. **Read it back**, `GET /transactions` to confirm it was durably persisted even for the
   approved-then-failed-dispatch case (the `BusinessTransaction` itself is written before
   dispatch is attempted; the full `ExecutionTrustRecord`/signed authorization is only
   available for transactions whose pipeline completed, i.e. denied ones, or approved ones
   against a capability with a real registered connector).
6. **Verify independently**, see below.

### Full worked example (denied, completes end to end)

```bash
TXN_ID=$(node -e "console.log(require('crypto').randomUUID())")
cat > txn.json << EOF
{
  "businessTransactionId": "$TXN_ID",
  "metadata": { "businessTransactionId": "$TXN_ID" },
  "authority": { "authorityId": "authority-demo", "authorityType": "SERVICE", "principalId": "demo", "issuedAt": "2026-01-01T00:00:00Z" },
  "authorization": { "authorizationId": "auth-demo", "authorityId": "authority-demo", "purpose": "demo", "issuedAt": "2026-01-01T00:00:00Z" },
  "intent": { "intentId": "intent-demo", "authorizationId": "auth-demo", "action": "customer-refund", "target": "order-123", "parameters": { "amount": 50000 }, "createdAt": "2026-01-01T00:00:00Z" },
  "policy": { "name": "customer-refund", "version": "1.0.0", "schemaVersion": "1.0.0" },
  "signals": { "refundEligible": true, "managerApproved": true, "fraudCheckPassed": true, "refundAmount": 50000 },
  "status": "RECEIVED",
  "createdAt": "2026-01-01T00:00:00Z"
}
EOF

curl -X POST https://parmana-api-real.vercel.app/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your demo key>" \
  -d @txn.json
# {"error":"Execution rejected: Refund rejected because the requested refund amount
#  exceeds the maximum permitted threshold.","code":"POLICY_DENIED"}  -- 403, real,
#  durably recorded, retrievable via GET /transactions and GET /refusal/:id
```

Change `amount`/`refundAmount` to `50` instead of `50000` and you get a real `APPROVED`
Policy Engine decision, signed, followed by the documented `500`/no-connector error at
dispatch. Both are genuine, both are worth showing depending on what your demo is about.

---

## Verifying a Result Independently

**Important, deployment-specific fact:** on this deployment, `GET /trust-records/:id`
only ever returns a real record for a capability with a registered connector, which, per
"What this deployment is/isn't" above, is none of them. So for a real, fetchable, signed
artifact from `/execute` today, use the **Refusal Record** (`GET /refusal/:id`), produced
for every genuine policy `REJECT`, this is a completely real, independently verifiable,
signed artifact, not a lesser substitute. `scripts/verify-trust-record.ts` verifies
`ExecutionTrustRecord`s specifically; to verify a `RefusalRecord`'s signature use
`POST /refusal/verify` (still real, still cryptographic, just a server-side check rather
than the offline one) or the low-level `SignatureVerifier`/`CanonicalSerializer` primitives
from `@parmana/crypto` directly, the same way `RefusalCrypto` does internally.

Fetch the record and verify its signature, tested against the live deployment while
writing this doc, real output below:

```bash
curl -s https://parmana-api-real.vercel.app/refusal/<businessTransactionId> \
  -H "Authorization: Bearer <your key>" \
  -o refusal.json

# The whole record IS the request body -- not wrapped in an envelope.
# Deliberately unauthenticated: verifying a refusal must not itself
# require a Parmana credential.
curl -X POST https://parmana-api-real.vercel.app/refusal/verify \
  -H "Content-Type: application/json" \
  -d @refusal.json
# {"valid":true}
```

This specific route still calls back into Parmana's own server to do the check (the
signature math runs server-side, the record and public key never leave the artifact you
already have). For a check that runs entirely on your own machine, with the record never
leaving it, `@parmana/crypto`'s low-level `SignatureVerifier`/`CanonicalSerializer`
primitives can reproduce `RefusalCrypto`'s exact canonical view
(`refusalRecordId`, `businessTransactionId`, `decision`, `evaluatedIntent`,
`bindingViolations`, `submittedBy`, `createdAt`, not `refusalRecordHash` or `signature`
themselves), see `packages/crypto/src/RefusalCrypto.ts` for the authoritative field list
before hand-rolling this, since getting the field set even slightly wrong produces a false
negative, not a crash.

For an `ExecutionTrustRecord` specifically (the shape you'll get once a real connector is
wired, see "When to Use This vs. Other Options"), the fully offline path is
`verifyExecutionTrustRecordOffline` from `@parmana/crypto` (TypeScript) or
`verify_execution_trust_record_offline` from `parmana.crypto` (Python, see
`python/parmana/crypto/offline_verifier.py`, Ed25519 only for now, no ML-DSA-65 yet), or
the CLI: `npx tsx scripts/verify-trust-record.ts record.json default=default.public.pem`.
Full worked examples, including a genuine hybrid (Ed25519 + ML-DSA-65) record and a
downgrade-attack demonstration: `examples/tutorials/107-offline-verification/`,
`108-public-key-discovery/`, `110-hybrid-signature-downgrade-protection/`.

---

## When to Use This vs. Other Options

| You want to demo...                                                                                  | Use                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A real policy engine making a real, signed decision, approve or deny                                 | **This deployment**                                                                                                                                                                                                                                                                                                      |
| Independent, offline, cryptographic proof of a decision                                              | **This deployment**, `/keys` + `verifyExecutionTrustRecordOffline`                                                                                                                                                                                                                                                       |
| An end-to-end flow where a real downstream action actually happens (a payment, a CRM update)         | Needs real connector credentials added to this deployment (HubSpot/GitHub have real code, just no configured secrets here), or a purpose-built connector-free illustration                                                                                                                                               |
| A fully self-contained, dependency-free, "run this in 30 seconds with nothing installed" walkthrough | The pattern the old buildathon demo used, standalone, vendored code, no Supabase, no real connectors, now removed from this repo, but the pattern (`demo/src/vendor/*`, three layers: Policy + Scope + Proof) is documented in `docs/VERIFICATION-GAPS.md`'s G-27/agent-vendor-payment entries if you want to rebuild it |
| Local development, iterating on a new policy before deploying                                        | `npm run dev` + `PARMANA_AUTH_DISABLED=true` locally, see `DEPLOYMENT.md`                                                                                                                                                                                                                                                |

---

## Troubleshooting

- **`401 {"error":"authentication required"}`**, missing or wrong `Authorization` header.
- **`403 {"code":"POLICY_DENIED"}`**, the policy evaluated your signals and rejected. This
  is a _correct_, complete result, not an error to fix, unless you expected an approval (in
  which case check your `signals` against the policy's `signalsSchema`/rules in `policies/`).
- **`403` with no `POLICY_DENIED` code**, principal or capability scoping denied the
  request before policy evaluation ran (see Authentication above).
- **`503` with code `CONNECTOR_NOT_REGISTERED`**,
  expected for every `APPROVED` decision on this deployment (see "What this deployment
  is/isn't"). Not a bug to report.
- **`400 {"error":"businessTransactionId must be a valid UUID."}`**, use a real UUID, not
  a slug.
- **`400` on signals**, `SignalIntentBinder` rejected because a `boundSignals` fact didn't
  match the real `intent` field it's bound to (message names exactly which one).

---

## Reference: Where the Real Code Lives

- Routes: `packages/api/src/routes/`
- Policies: `policies/<name>/<version>/policy.json`
- Deployment config: `vercel.json`, `api/index.ts`
- What's cryptographically guaranteed, precisely scoped: `docs/CLAIMS.md`
- Every gap found and closed on this deployment, with evidence: `docs/VERIFICATION-GAPS.md`
- Live, database-cross-checked verification sessions: `docs/site/trust-and-claims/verification-log.mdx`
- Full tutorial catalog (numbered, runnable, same patterns used above): `examples/tutorials/`,
  indexed at `docs/site/tutorials/index.mdx`
