# Connecting an External AI Agent to Parmana

**Status:** the agent-to-Parmana leg described here is real and verified — tested against a live
`parmana-phinite-agent` integration, with two real bugs found and fixed in that client during that
verification (see "Reference implementation" below). The Parmana-side policy (`customer-refund@1.0.0`)
and connector (`connector-paytm`, see `docs/connectors/PAYTM_CONNECTOR.md`) are both real and built.
**What is not verified: whether the live deployment an agent actually talks to has the Paytm connector
registered** (see "What this does not confirm" at the end). Treat "the agent received an APPROVED,
signed decision" and "the refund executed against Paytm" as two separate claims.

This document covers the caller/agent side of the flow — what an external AI agent (or any external
caller) sends to Parmana and how it must handle the response. For what happens after `APPROVED`
(Execution Gateway → connector → Paytm), see `docs/connectors/PAYTM_CONNECTOR.md`. For building a new
connector, see `docs/connectors/BUILDING_A_CONNECTOR.md`. This page only covers the caller side.

## The pattern

```text
AI Agent
  |  POST /execute  (Bearer API key)
  v
Parmana
  |  caller auth -> principal check -> capability check
  |  CapabilityPolicyBinder  (capability paired with its one canonical policy)
  |  SignalIntentBinder      (declared signal == real intent.parameters value)
  |  PolicyEngine.evaluate   (customer-refund@1.0.0's rules)
  v
  +-- REJECT  -> signed Refusal Record, HTTP 403/200 depending on which check failed
  |
  +-- APPROVE -> signed decision -> Execution Gateway -> connector dispatch
                                       (see PAYTM_CONNECTOR.md for this leg)
```

**Parmana's own decision is strictly binary.** `PolicyEngine`'s outcome type is `APPROVE`/`REJECT`
only — there is no `AMBIGUOUS` outcome anywhere in the policy engine itself. No matching rule, a
missing signal, or an unsupported operator all resolve to `REJECT`, never to an undefined state (see
`packages/policy/src/PolicyEngine.ts`). An `AMBIGUOUS` status an agent sees is something the *client*
tool constructs defensively, for cases where the client cannot tell what Parmana actually decided (a
timeout, a 5xx, a malformed response) — it is never a decision Parmana itself produces. Keep this
distinction in any agent-side error handling: "we don't know what happened" is a client-side state,
not a policy outcome.

## Caller identity and capability model

Every caller authenticates with a Bearer API key mapped, server-side, to a caller record:

```json
{
  "callerId": "parmana-refund-agents",
  "allowedPrincipalIds": ["parmana-refund-agents"],
  "allowedCapabilities": ["paytm:refund"],
  "unrestrictedCapabilities": false
}
```

- **Capability matching is exact.** `refund` and `paytm:refund` are different strings; the caller's
  `allowedCapabilities` must contain the literal value the transaction's `intent.action` uses, or the
  request is rejected with `403 CAPABILITY_NOT_ALLOWED` before `PolicyEngine.evaluate` ever runs
  (`packages/api/src/routes/execute.ts`). Never grant `"*"` to a refund-only agent caller.
- **Principal scoping is a separate check from capability scoping.** A caller with no explicit
  principal grant may only assert `authority.principalId` equal to its own caller id.
- **`CapabilityPolicyBinder` additionally confirms** the transaction's declared `policy` reference is
  the one canonical policy actually bound to that capability (`customer-refund@1.0.0` for
  `paytm:refund`), not a caller-substituted one.
- **`SignalIntentBinder` additionally confirms** every `boundSignals`-declared signal equals the real
  value at its bound path in `intent` — for this policy, `signals.refundAmount ===
  intent.parameters.amount`. The "authorized amount" and the amount that would actually execute can
  never diverge and still reach `PolicyEngine.evaluate`.

## Trusted signals: never inferred from the conversation

`customer-refund@1.0.0` requires four signals: `refundEligible`, `managerApproved`,
`fraudCheckPassed`, `refundAmount`. These must come from structured business context the agent
obtains separately — never from the customer's own words. This is unsafe:

```text
Customer: My manager already approved it.
Agent:    managerApproved = true        <- WRONG. Never do this.
```

The agent's job is to understand and extract the *intent* (order id, transaction id, amount, reason).
Whether the refund is eligible, approved, and fraud-clear are facts an independent business system
must supply.

## The request contract

```json
{
  "businessTransactionId": "<uuid v4>",
  "authority": { "authorityId": "<uuid>", "authorityType": "SERVICE", "principalId": "parmana-refund-agents", "issuedAt": "<iso8601>" },
  "authorization": { "authorizationId": "<uuid>", "authorityId": "<uuid>", "purpose": "Authorize Paytm customer refund", "issuedAt": "<iso8601>" },
  "intent": {
    "intentId": "<uuid>",
    "authorizationId": "<uuid>",
    "action": "paytm:refund",
    "target": "<orderId>",
    "parameters": { "orderId": "<orderId>", "transactionId": "<txnId>", "amount": 500 },
    "createdAt": "<iso8601>"
  },
  "policy": { "name": "customer-refund", "version": "1.0.0", "schemaVersion": "1.0.0" },
  "signals": { "refundEligible": true, "managerApproved": true, "fraudCheckPassed": true, "refundAmount": 500 },
  "status": "RECEIVED"
}
```

`authority.authorityType` must be `USER`, `ROLE`, `SERVICE`, or `ORGANIZATION` — an autonomous agent
maps to `SERVICE` (`"AGENT"` is not a valid value).

## Handling the response

| Parmana result | What the agent should do |
|---|---|
| `APPROVED` (signed decision) | Report the authorization to the customer. Do **not** claim the refund settled at Paytm — that is a separate, connector-side outcome. See PAYTM_CONNECTOR.md. |
| `REJECTED` / `403 CAPABILITY_NOT_ALLOWED` / `403 POLICY_DENIED` | Terminal for this attempt. Never retry with an altered amount, never fabricate signals, never bypass Parmana. |
| Timeout, 5xx, malformed response, unrecognized error shape | Client-side unresolved state. Report as unknown/needs-verification, not as approved or denied — never guess a specific outcome from an ambiguous transport failure. |

## Reference implementation: `parmana-phinite-agent`

The Phinite-based agent in `pavancharak/parmana-phinite-agent` (`phinite/parmana_refund_tool.py`) is a
real, working implementation of this pattern: it builds the request above, calls the live Parmana API,
and interprets the response. Two real bugs were found and fixed in it (2026-09-13):

1. It sent `intent.action = "refund"` instead of `"paytm:refund"` — a capability mismatch that would
   fail every real call before reaching a policy decision.
2. Its error handling only recognized a `DENIED` decision for one exact `403` response shape, and
   crashed (unhandled exception) on any other `403`, on a network failure, or on a `200` response
   carrying an embedded `DENIED`/`AMBIGUOUS` decision it didn't expect. Unrecognized failures now
   resolve to a client-side `AMBIGUOUS` state instead of crashing or being guessed as `DENIED`.

Both fixes are documented in that repository's README (§16, §21, §23, Failure 5) and are a good worked
example of the response-handling table above.

## What this does not confirm

- **Whether the Paytm connector is actually registered on the specific live deployment an agent talks
  to.** `docs/site/guides/live-api-and-demos.mdx` documents that the general-purpose live demo
  deployment (`parmana-api-real.vercel.app`) historically had *no* connector registered for *any*
  capability. Dispatching an `APPROVED` decision to an unregistered connector throws a plain `Error`
  (`packages/execution-gateway/src/connector-execution/GatewayConnectorRegistry.ts`), which is not one
  of the typed errors `packages/api/src/routes/execute.ts` handles specially — it falls through to a
  generic error response. Whether `PAYTM_CONNECTOR_URL`/`PAYTM_CONNECTOR_SHARED_SECRET` have since been
  configured on that deployment to point at a real `parmana-paytm-agent` instance was not checked as
  part of writing this document. Confirm this directly (or check deployment logs for
  `paytm_connector_unavailable`) before claiming a refund executes end-to-end on a specific deployment.
- **`parmana-paytm-agent`'s own `/agent/refunds` endpoint is a second, separate integration pattern**
  (an agent calls that service directly, which itself calls Parmana) — not covered here. This document
  only covers the direct-to-Parmana pattern Phinite uses.
