# Connecting an External Agent to Parmana — Complete Guide

Everything a new developer needs to connect an external AI agent (or any external caller) to
Parmana: what's required, why each requirement exists, exactly how to do it, and how to
troubleshoot every failure mode. Grounded in this codebase's actual source — every status code and
error shape below is cited to the file that produces it, not guessed.

**Scope:** this document covers the caller/agent side — the leg from your agent to Parmana's
`POST /execute`. What happens after Parmana approves (Execution Gateway → connector → the real
business system) is a separate document: `docs/connectors/PAYTM_CONNECTOR.md` for the worked Paytm
example, `docs/connectors/BUILDING_A_CONNECTOR.md` to build a new one.

## The mental model

```text
AI Agent  --------------------------------------------------->  Parmana
   |  understands the request, extracts an intent                  |
   |  never decides whether the action is authorized                |
   |  never holds the downstream system's credentials                |
   v                                                                v
"I want to refund order X for ₹500"                    caller auth -> capability check
                                                         -> CapabilityPolicyBinder
                                                         -> SignalIntentBinder
                                                         -> PolicyEngine.evaluate
                                                         -> APPROVE or REJECT (binary, signed)
```

**The one rule everything below enforces:** the agent proposes an intent; Parmana decides whether
it's authorized; only Parmana's decision can unlock execution. If your integration ever lets the
agent (or the customer, via the agent) directly set a value that determines the outcome — an
approval flag, a fraud-check result, a policy name — you have broken this model, even if the code
still technically "works."

## Part 1 — What you need, and why

| #   | You need                                                                                                                                 | Why                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A reachable Parmana deployment (a base URL for `POST /execute`)                                                                          | There's nothing to connect to without one. Could be a self-hosted `packages/api` instance or an existing live deployment.                                                                                                                                                               |
| 2   | A capability name your agent will invoke (e.g. `paytm:refund`)                                                                           | Parmana authorizes _capabilities_, not free-form actions. The capability string is what gets bound to a policy and to a caller's permissions — pick it before writing any code.                                                                                                         |
| 3   | A deployed policy bound to that capability (e.g. `customer-refund@1.0.0`)                                                                | The policy is what actually decides APPROVE/REJECT. If it doesn't exist on the target deployment yet, your first call fails with `404` (`PolicyNotFoundError`) — see Troubleshooting.                                                                                                   |
| 4   | The policy's exact `signalsSchema` and `boundSignals`                                                                                    | You must send every signal the policy's rules reference, and any `boundSignals` entry must equal the corresponding `intent.parameters` value exactly, or the request is rejected before the policy engine ever runs. Read the policy's `.json` file directly — don't guess field names. |
| 5   | An API key, scoped to exactly that capability                                                                                            | This is your agent's identity. See Step 3 below for how to mint one.                                                                                                                                                                                                                    |
| 6   | A source of trusted business signals that is _not_ the conversation                                                                      | The signals a policy evaluates (e.g. `managerApproved`, `fraudCheckPassed`) must come from an independent business system. An LLM inferring `managerApproved = true` because the customer said so is exactly the failure mode this whole architecture exists to prevent.                |
| 7   | UUID generation for `businessTransactionId` / `authorityId` / `authorizationId` / `intentId`                                             | `businessTransactionId` is validated against a UUID-shaped regex (versions 1–5, `packages/api/src/routes/execute.ts`); a slug or short string is rejected with `400` before anything else runs.                                                                                         |
| 8   | (Only if you need real downstream execution) confirmation that a connector is registered for your capability on this specific deployment | An `APPROVED` decision with no registered connector fails at dispatch — see Step 8 below. This is a separate question from whether your agent-to-Parmana integration is correct.                                                                                                        |

## Part 2 — Step by step

### Step 1: Confirm the deployment and the policy exist

Read the policy file directly — don't rely on a description of it:

```bash
cat policies/customer-refund/1.0.0/policy.json
```

Note its `signalsSchema` (every field you must send in `signals`) and `boundSignals` (every field
that must also equal a specific `intent.parameters` value). If you're pointing at someone else's
deployment, ask them for the deployed policy's exact name/version/schemaVersion, or fetch it if the
deployment exposes a policy-listing endpoint.

**Why this step first:** everything downstream — the API key you mint, the request shape you build
— depends on knowing the exact capability name and exact signal names. Guessing them wastes every
subsequent step.

### Step 2: Decide the capability name

Use the capability the policy is actually bound to (check
`packages/capability-registry/src/CapabilityPolicyBinding.ts`'s
`CANONICAL_CAPABILITY_POLICY_BINDINGS` if you're unsure which policy a capability maps to). For the
worked refund example, this is `paytm:refund`.

**Why exact spelling matters:** Parmana does exact string matching, not fuzzy matching or
normalization. `refund` and `paytm:refund` are different strings. This is not a minor detail — it is
the single most common integration failure (see Troubleshooting: `CAPABILITY_NOT_ALLOWED`).

### Step 3: Mint an API key scoped to exactly that capability

```bash
npx tsx scripts/generate-api-key.ts \
  --caller-id my-refund-agent \
  --allowed-capabilities "paytm:refund" \
  --credential-holder-type SERVICE
```

This prints the raw key **once** (never written to disk, never recoverable after the terminal
closes) and a JSON entry to append to the deployment's `PARMANA_API_KEYS` environment variable (a
JSON array of caller records). Adding it requires redeploying/restarting the API process.

**If you're the deployment operator adding this key, not just the agent developer:** `PARMANA_API_KEYS`
is a single environment variable holding a JSON **array**. Two real mistakes were made adding a new
caller to a live deployment (2026-09-15/16, `docs/operations/2026-09-15-kms-migration-troubleshooting-guide.md`
item 6), both from hand-editing the value in a hosting provider's dashboard rather than scripting it:

- **Pasting the new entry as the entire value**, not appended to the array — e.g. saving
  `{"callerId":"my-refund-agent",...}` instead of `[{"callerId":"existing-caller",...},{"callerId":"my-refund-agent",...}]`.
  The server fails closed on this (`PARMANA_API_KEYS must be a JSON array of { "callerId": string,
"keyHash": string } entries`, `packages/shared/src/config/ConfigValidation.ts`) — every caller,
  including ones that worked before, gets a 500 at startup until the array is fixed.
- **Losing existing entries** by replacing the value instead of appending to it — every previously
  working caller silently loses access.

When adding a caller by hand, always paste the **complete** array (every existing entry plus the new
one), never a single entry alone. If you can't see the deployment's current value to merge safely,
get it from whoever manages the deployment rather than guessing.

**Why `--credential-holder-type SERVICE`, not `USER`:** an autonomous agent is not a human operator.
`AuthorityType` accepts `USER`, `ROLE`, `SERVICE`, `ORGANIZATION` — `"AGENT"` is **not** a valid
value (a documented, real mistake made while building the live demo deployment). Map an agent to
`SERVICE`.

**Why scope `--allowed-capabilities` narrowly:** never grant `"*"` to a single-purpose agent. Least
privilege here is not a formality — `unrestrictedCapabilities` in `/callers/me`'s response is
literally derived as `allowedCapabilities.includes("*")` (`packages/api/src/routes/callers-me.ts`), so
a wildcard caller can invoke _any_ capability on the deployment, not just the one your agent needs.

### Step 4: Verify the key works before writing any agent code

```bash
curl -i "https://<your-deployment>/callers/me" \
  -H "Authorization: Bearer <your-key>" \
  -H "Accept: application/json"
```

Expect:

```json
{
  "callerId": "my-refund-agent",
  "allowedPrincipalIds": ["my-refund-agent"],
  "allowedCapabilities": ["paytm:refund"],
  "unrestrictedCapabilities": false
}
```

**Why this step matters:** it isolates "is my key/deployment configuration correct" from "is my
agent's request shape correct." If this call fails, nothing about your agent's code is relevant yet
— fix authentication first (see Troubleshooting).

### Step 5: Wire up your trusted-signal source

Identify, for real, where each signal in the policy's `signalsSchema` comes from in your business
systems (an eligibility service, a manager-approval workflow, a fraud engine — whatever your
organization actually has). Do not fabricate a source "for now" and plan to fix it later — the
non-negotiable rule is that these values are never inferred from the agent's conversation with the
end user, full stop, from day one.

### Step 6: Build the request

Generate real UUIDs (any RFC 4122 generator works — the server-side check is regex-shaped and
accepts version nibbles 1–5, not a v4-only parser):

**This example was missing `metadata` until 2026-09-14** — found while running the full
end-to-end flow against a real deployment (`END-TO-END-FLOW.md`, repo root). Omitting it
fails with `{"error":"metadata.businessTransactionId must match businessTransactionId."}`
(400), before policy is ever evaluated. It's included below.

```json
{
  "businessTransactionId": "<uuid>",
  "metadata": {
    "businessTransactionId": "<same uuid as above>"
  },
  "authority": {
    "authorityId": "<uuid>",
    "authorityType": "SERVICE",
    "principalId": "my-refund-agent",
    "issuedAt": "<iso8601>"
  },
  "authorization": {
    "authorizationId": "<uuid>",
    "authorityId": "<uuid>",
    "purpose": "Authorize Paytm customer refund",
    "issuedAt": "<iso8601>"
  },
  "intent": {
    "intentId": "<uuid>",
    "authorizationId": "<uuid>",
    "action": "paytm:refund",
    "target": "<orderId>",
    "parameters": {
      "orderId": "<orderId>",
      "transactionId": "<txnId>",
      "amount": 500
    },
    "createdAt": "<iso8601>"
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
    "refundAmount": 500
  },
  "status": "RECEIVED"
}
```

Field-by-field notes that matter:

- **`intent.action` must equal your caller's exact `allowedCapabilities` entry.** Not a prefix, not
  a related string.
- **`policy.name`/`policy.version` must match a real, deployed policy exactly.** It is _not_ inferred
  from `intent.action` — you name it explicitly, and a caller could otherwise pair a real capability
  with an unrelated policy if `CapabilityPolicyBinder` didn't independently confirm this pairing.
- **Every `boundSignals` entry must equal its bound `intent.parameters` path.** Here,
  `signals.refundAmount` must equal `intent.parameters.amount` exactly, or the request is rejected
  before policy evaluation — this is what prevents "authorize 500, execute 50000."
- **`authority.principalId` must be one your caller is permitted to assert** — with no explicit
  `allowedPrincipalIds` grant, that's your own `callerId` only.

### Step 7: Send the request and handle the response

```bash
curl -i "https://<your-deployment>/execute" \
  -H "Authorization: Bearer <your-key>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  --data-binary @transaction.json
```

See Part 3 for the complete, exhaustive response reference — don't guess at response handling from
this example alone.

### Step 8 (only if you need real downstream execution): confirm a connector is registered

`APPROVED` from Parmana means _authorization_ succeeded. It does not by itself mean a downstream
system (Paytm, HubSpot, GitHub, whatever your capability's connector talks to) actually executed
anything. Before claiming end-to-end execution:

- Check the specific deployment's startup logs for a `paytm_connector_unavailable`-style warning (or
  the equivalent for your capability's connector).
- If you can, deliberately submit a transaction you expect to approve and inspect whether execution
  actually completes rather than failing at dispatch (see "500 Internal Server Error" in
  Troubleshooting — this is the most common way to discover a missing connector registration).

**Why this is a separate step, not an assumption:** the general-purpose live demo deployment
documented in `docs/site/guides/live-api-and-demos.mdx` historically had **no connector registered
at all**, for any capability. "The agent got an APPROVED decision" and "the refund executed" are two
different, independently-verifiable claims. Never conflate them in what you tell a user or a
stakeholder.

### Step 9: Verify independently

- `GET /refusal/:id` returns a signed Refusal Record for a rejected transaction; verify its signature
  with `POST /refusal/verify` (unauthenticated, purely cryptographic) with zero trust in the server's
  own "yes it's valid" claim.
- `GET /trust-records/:id` returns the full signed Execution Trust Record, but only once a connector
  is actually wired for that capability.
- For fully offline verification with no server calls at all, use
  `verifyExecutionTrustRecordOffline` from `@parmana/crypto`.

## Part 3 — Complete response and error reference

Every row below is cited to the exact source that produces it — this is not a paraphrase.

| HTTP status               | `code`                   | Where it comes from                                                                                                                                                                                                               | What it actually means                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | What to do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200`                     | —                        | `execute.ts`, decision outcome `APPROVE`                                                                                                                                                                                          | Parmana approved the transaction; a signed decision was produced. Execution dispatch (if any) happens after this.                                                                                                                                                                                                                                                                                                                                                                                        | Report the authorization. Do not claim downstream execution unless separately confirmed (Step 8).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `400`                     | —                        | `execute.ts` (`businessTransactionId` not a valid UUID)                                                                                                                                                                           | Structural rejection before any auth/policy logic runs.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Fix the UUID; this is a bug in your request construction, not a policy decision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `400`                     | —                        | `error-handler.ts` (`BusinessTransactionValidationError` / `PolicyValidationError` / `SignalValidationError`)                                                                                                                     | The transaction shape, or the policy/signal shape, failed structural validation.                                                                                                                                                                                                                                                                                                                                                                                                                         | Read `error.message` — it names the specific field.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `400`                     | —                        | `error-handler.ts` (`entity.parse.failed`, from Express body parsing)                                                                                                                                                             | Malformed JSON body.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Fix request serialization; this happens before any Parmana logic runs at all.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `403`                     | (none)                   | `execute.ts` — `authority.principalId` not permitted                                                                                                                                                                              | Caller authenticated, but tried to assert a `principalId` it isn't allowed to use.                                                                                                                                                                                                                                                                                                                                                                                                                       | Set `principalId` to your own `callerId`, or request a broader `allowedPrincipalIds` grant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `403`                     | `CAPABILITY_NOT_ALLOWED` | `execute.ts` — `intent.action` not in caller's `allowedCapabilities`                                                                                                                                                              | **The single most common integration bug.** Your capability string doesn't exactly match what your API key is scoped to.                                                                                                                                                                                                                                                                                                                                                                                 | `GET /callers/me` and compare its exact `allowedCapabilities` strings against your `intent.action` string, character for character.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `403`                     | `POLICY_DENIED`          | `ExecutionGate.enforce` (`packages/runtime/src/ExecutionGate.ts`) — **uniform for every policy rejection, regardless of which rule caused it**                                                                                    | The policy evaluated your signals and rejected the transaction. `error.message` is `"Execution rejected: <the matched rule's reason>"` — read it, it names the actual cause (excessive amount, failed fraud check, not manager-approved, or the policy's default fallback).                                                                                                                                                                                                                              | This is a real, correct decision, not a bug. Do not retry with altered parameters; do not treat it as a client error to route around.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `404`                     | —                        | `error-handler.ts` (`PolicyNotFoundError`)                                                                                                                                                                                        | `policy.name`/`policy.version` in your request doesn't match any policy deployed on this instance.                                                                                                                                                                                                                                                                                                                                                                                                       | Check spelling/version exactly, and confirm the policy is actually deployed on _this_ deployment (policies are baked into the build per deployment).                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `409`                     | —                        | `error-handler.ts` (`DuplicateBusinessTransactionError`)                                                                                                                                                                          | You reused a `businessTransactionId` that was already accepted.                                                                                                                                                                                                                                                                                                                                                                                                                                          | Generate a fresh UUID per attempt. If retrying a specific logical operation, that's a separate idempotency concern your integration must design for explicitly — Parmana's own uniqueness check is not an idempotency mechanism you should rely on for that.                                                                                                                                                                                                                                                                                                                                                  |
| `413`                     | —                        | `error-handler.ts` (Express body-parser, oversized body)                                                                                                                                                                          | Request body too large.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Trim the payload; this is a transport-level limit, unrelated to policy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `500`                     | —                        | `error-handler.ts`'s generic fallback — **catches every error that isn't one of the typed ones above**, including `ExecutionGateway.execute()` rejecting a signed envelope (`packages/execution-gateway/src/ExecutionGateway.ts`) | Deliberately ambiguous by design — **not a bug in the error handler itself.** Could be: a genuine server bug; the Gateway's own envelope verification failing (bad signature, tampered content hash, replayed nonce). This last case is intentionally not distinguished from a crash in the HTTP response, by design — see `packages/api/src/middleware/error-handler.ts`'s own comment on why only nonce-replay gets a distinguishable response and every other Gateway rejection deliberately doesn't. | Check server logs for the exact error message — this is a case where you genuinely cannot resolve a 500 from the HTTP response alone; you need Parmana-operator-side log access. If it says "No connector registered," that's Step 8's issue. A repeated `failed checks [signatureVerified, ...]` for requests that should be valid is a Parmana-side signing/verification bug, not your agent's — see `examples/tutorials/114-signing-verification-key-agreement/` for what that specific failure mode looks like and why. Never assume a 500 means your agent's request was malformed; it very often isn't. |
| (no HTTP response at all) | —                        | network/timeout                                                                                                                                                                                                                   | The request may or may not have reached Parmana at all.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Treat as an unresolved, client-side state — never assume either APPROVED or REJECTED from a timeout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Part 4 — Common mistakes checklist

- [ ] Capability string in `intent.action` does not exactly match an entry in your API key's
      `allowedCapabilities` (the #1 real-world cause of "why is this always rejected").
- [ ] `authority.authorityType` set to `"AGENT"` — not a valid value; use `"SERVICE"`.
- [ ] A signal value inferred from what the customer said, instead of from an independent business
      system.
- [ ] `businessTransactionId` reused across retries where each retry should be its own attempt (or
      the opposite — a fresh ID generated for what should logically be the same idempotent retry).
- [ ] Treating a `403 POLICY_DENIED` as a bug to work around rather than a correct decision to
      respect and report.
- [ ] Claiming a refund/action "executed" based on an `APPROVED` response alone, without confirming
      the connector for that capability is actually registered on that specific deployment.
- [ ] Granting `"*"` in `allowedCapabilities` "just to get it working," and never narrowing it
      afterward.
- [ ] Guessing at signal field names instead of reading the policy's `signalsSchema` directly.
- [ ] Hand-editing `PARMANA_API_KEYS` in a dashboard by pasting a single entry instead of the
      complete array, or overwriting instead of appending — see Step 3's operator note.
- [ ] Assuming a `500` always means your agent's request was wrong — it's deliberately ambiguous by
      design and very often isn't (see Part 3's `500` row).

## Reference implementation

`pavancharak/parmana-phinite-agent` (`phinite/parmana_refund_tool.py`) is a real, working
implementation of every step above. Two real bugs were found and fixed in it (2026-09-13):

1. It sent `intent.action = "refund"` instead of `"paytm:refund"` — exactly the `CAPABILITY_NOT_ALLOWED`
   failure mode described in Part 3, and the single most common integration mistake.
2. Its error handling only recognized a `DENIED` decision for one exact `403` response shape and
   crashed (unhandled exception) on any other `403`, a network failure, or a `200` response carrying
   an unexpected embedded decision. It now resolves every unrecognized failure to a client-side
   "unresolved" state instead of crashing or guessing at `DENIED`.

Read that repository's README (§16, §21, §23, Failure 5) for the full writeup — it's a good worked
example of Part 3's table in practice, including the mistakes to avoid.

**Second round, entirely on Parmana's own side (2026-09-15/16):** after the agent-side fixes above,
this same integration hit a sequence of Parmana-operator issues while onboarding as a new caller on
a freshly KMS-migrated deployment — not agent bugs, but exactly the kind of failure this guide's
Part 3 table exists to help a caller correctly _not_ blame on themselves:

1. No `PARMANA_API_KEYS` entry existed for the new caller at all → `401`.
2. A hand-edited entry was malformed JSON (see Step 3's operator note above) → `500` on every request,
   for every caller, until fixed.
3. The entry existed but had no `allowedPrincipalIds` grant for the `principalId` the agent was
   actually asserting → `403` (Part 3's `authority.principalId not permitted` row).
4. Once authenticated and authorized correctly, a real request still failed with a `500` — traced to
   a genuine Parmana-side bug (the gateway's signing and verification paths silently using different
   keys after a KMS migration, `docs/VERIFICATION-GAPS.md` G-48) that had nothing to do with the
   caller's request at all. See `examples/tutorials/114-signing-verification-key-agreement/` for a
   runnable reproduction.

Full account: `docs/operations/2026-09-15-kms-migration-troubleshooting-guide.md`.

## What this guide does not cover

- **Building a new connector** (the execution side, after `APPROVED`) — see
  `docs/connectors/BUILDING_A_CONNECTOR.md`.
- **The Paytm connector specifically** — see `docs/connectors/PAYTM_CONNECTOR.md`.
- **`parmana-paytm-agent`'s own `/agent/refunds` endpoint** — a second, separate integration shape
  (an agent calls that service, which itself calls Parmana) — not the pattern documented here.
- **Policy authoring** — see `docs/site/guides/write-your-first-policy.mdx` and
  `LIVE-API-GUIDE.md` (repo root) for the exact condition/operator language.
