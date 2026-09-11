# Paytm Refund Connector

**Status:** Implemented this milestone. See `docs/CLAIMS.md` §3.22 for the full evidence list (exact
files, exact test counts, exact commands run). This document is the architecture/operator reference;
CLAIMS.md is the checkable claim.

**Read `docs/CONNECTOR-BUILD-GUIDE.md` and `docs/connectors/BUILDING_A_CONNECTOR.md` first** — this
connector follows that same architecture (HubSpot is still the canonical reference for the
in-process case). This document only covers what is different about a *remote* connector, and the
Paytm-specific configuration/operational details.

## Why this connector is different from every other connector in this codebase

Every other connector Parmana has (HubSpot, GitHub) calls the vendor's real API **in-process** — the
executable adapter class itself is the thing that holds an `https://api.hubapi.com` or
`https://api.github.com` HTTP call. Paytm is different by design:

```
Parmana never talks to Paytm directly, at all.

AI Agent
  -> Parmana POST /execute
  -> customer-refund@1.0.0 policy
  -> APPROVED
  -> Parmana Execution Gateway
  -> GatewayPaytmAdapter (this codebase)
       -> HTTPS -> PAYTM_CONNECTOR_URL/connector/paytm-refund
  -> a separate, trusted service ("parmana-paytm-agent")
       -> Paytm /refund/apply
```

`parmana-paytm-agent` is a **separate repository** this codebase does not have access to and does not
need to. It is the only thing that ever holds a real Paytm merchant key, and the only thing that ever
speaks Paytm's own checksum-authenticated wire protocol. Everything this codebase implements stops at
one HTTPS call to that service's `POST /connector/paytm-refund` endpoint.

## Two authentication layers — do not conflate them

This is the single most important distinction to keep straight, and the milestone that built this
connector was explicitly required not to blur it:

| Layer | What it proves | Where it lives | What it is NOT |
|---|---|---|---|
| **Parmana authorization** | This specific refund (this amount, this order, this transaction) was actually approved by policy, for a reason Parmana can show. | `customer-refund@1.0.0` policy, `SignalIntentBinder`, `CapabilityPolicyBinder`, `SignedTokenConnectorAuthenticator`, `ExecutionControlService` — all pre-existing, all unmodified by this connector. | Not something Paytm's API has any concept of. |
| **Connector transport authentication** | This HTTPS request actually came from Parmana's gateway, not an arbitrary caller. | `PAYTM_CONNECTOR_SHARED_SECRET`, sent as a Bearer token on the one call `GatewayPaytmAdapter` makes. | Not Paytm's merchant key/checksum. Does not decide whether the refund is *allowed* — only whether the *caller* is Parmana. |
| **Paytm's own authentication/checksum** | Paytm's API believes the connector service is a legitimate Paytm merchant integration. | Entirely inside `parmana-paytm-agent`. This codebase never sees it, never holds `PAYTM_MERCHANT_KEY`, and never constructs a Paytm checksum. | Not a substitute for Parmana authorization. A request that passes Paytm's checksum but was never approved by Parmana policy can never reach Paytm at all, because the connector service only ever receives requests `GatewayPaytmAdapter` forwards, which only happen after (1) above already passed. |

A caller who somehow obtained a valid `PAYTM_CONNECTOR_SHARED_SECRET` still cannot invoke Paytm: the
only thing that secret authenticates is Parmana's own gateway calling its own connector service, and
the only caller of that HTTPS request is `GatewayPaytmAdapter.execute()`, which only ever runs after
`POST /execute` -> policy -> `APPROVED`. There is no route, endpoint, or code path in this codebase
that lets an agent or caller reach the Paytm connector service directly.

## Approved flow

```
1. AI Agent calls Parmana POST /execute with:
     intent.action = "paytm:refund"
     intent.parameters = { orderId, transactionId, amount, refundReason? }
     policy = { name: "customer-refund", version: "1.0.0", schemaVersion: "1.0.0" }
     signals = { refundEligible, managerApproved, fraudCheckPassed, refundAmount }

2. CapabilityPolicyBinder confirms paytm:refund is paired with exactly the
   canonical policy bound to it (customer-refund@1.0.0) -- not a caller-substituted one.

3. SignalIntentBinder confirms signals.refundAmount === intent.parameters.amount
   (policy.json's boundSignals) -- the declared "authorized amount" and the
   amount that will actually execute cannot diverge.

4. PolicyEngine.evaluate runs customer-refund/1.0.0's rules against the
   signals. All four conditions true and refundAmount <= 10000 -> APPROVE.

5. Execution Gateway signs the authorization and dispatches to the
   registered "paytm" connector (GatewayPaytmAdapter).

6. GatewayPaytmAdapter validates the request shape (deny-by-default
   parameter allowlist), resolves the connector shared secret, and sends
   exactly { businessTransactionId, capability, action, target, parameters }
   as JSON to PAYTM_CONNECTOR_URL/connector/paytm-refund, authenticated
   with PAYTM_CONNECTOR_SHARED_SECRET as a Bearer token.

7. The connector service processes the refund against Paytm's real API
   (out of this codebase's scope) and returns a PaytmRefundExecutionResult.

8. GatewayPaytmAdapter validates every identifying field in the response
   echoes the request exactly (businessTransactionId, capability, orderId,
   transactionId) before trusting it. status: "completed" -> success.
```

## Denied flow

```
1. AI Agent calls Parmana POST /execute with the same shape as above, but
   e.g. managerApproved: false (or refundAmount > 10000, or
   fraudCheckPassed: false, or a tampered/mismatched signal).

2. PolicyEngine.evaluate (or an earlier binding check -- see below) returns
   REJECT.

3. ExecutionGate.enforce throws before ExecutionComponent ever dispatches
   to any connector. HTTP response: 403, code POLICY_DENIED.

4. GatewayPaytmAdapter.execute() is never called. Zero HTTPS requests are
   made to PAYTM_CONNECTOR_URL. Paytm's own API is never reached.
```

This is proven directly in `packages/api/tests/integration/paytm-refund.integration.test.ts`: every
denial case asserts, via a `fetch` spy AND the hermetic mock connector service's own call counter,
that literally zero requests reached the connector service.

**A denial can come from three independent checks, all pre-existing and unmodified by this
connector**, not just an ordinary policy rule:

1. **`CapabilityPolicyBinder`** — the caller declared a `policy` reference other than the canonical
   one bound to `paytm:refund` (`customer-refund@1.0.0`). Closes the "pair a real capability with an
   unrelated, unprotected policy" exploit class.
2. **`SignalIntentBinder`** — a `boundSignals`-declared signal (`refundAmount`) does not equal the
   value at its bound Intent path (`parameters.amount`). This is what catches "authorized amount 500,
   actual execution amount 50000": the two can never diverge and still reach `PolicyEngine.evaluate`.
3. **`PolicyEngine.evaluate`** against `customer-refund/1.0.0`'s own rules — the ordinary case
   (excessive amount, failed fraud check, not manager-approved, or the unconditional
   `reject-default` fallback).

## Capability and policy binding

Exactly one capability is registered: `paytm:refund` (`PAYTM_REFUND_CAPABILITY`,
`packages/connector-paytm/src/PaytmCapabilities.ts`). It is bound, in
`packages/capability-registry/src/CapabilityPolicyBinding.ts`'s
`CANONICAL_CAPABILITY_POLICY_BINDINGS`, to `customer-refund@1.0.0` — a pre-existing policy this
connector did not need to create or modify. It is **not** listed in
`packages/api/src/bootstrap/intentionallyUnboundCapabilities.ts`, so
`assertConnectorCapabilitiesBound.ts`'s fail-closed startup guardrail actively protects it: if this
binding were ever removed while the connector stayed registered, the process refuses to start.

## Trust / connector identity

`paytm` / `spiffe://parmana/connectors/paytm-refund`, added to
`packages/api/src/bootstrap/createConnectorAuthenticator.ts`'s trusted-connector-identity list, which
feeds the existing, unmodified `SignedTokenConnectorAuthenticator`. The Paytm connector is subject to
exactly the same gateway-issued, signed-attestation authentication check as every other connector —
nothing about this connector bypasses or weakens `SignedTokenConnectorAuthenticator`.

## Environment variables

```
PAYTM_CONNECTOR_URL=                    # Base URL of the trusted parmana-paytm-agent service.
                                         # Must use HTTPS outside NODE_ENV=test.
PAYTM_CONNECTOR_SHARED_SECRET=          # Bearer token Parmana authenticates itself to that
                                         # service with. NOT Paytm's merchant key.
PAYTM_CONNECTOR_TIMEOUT_MS=10000        # Optional, per-request timeout. Defaults to 10000.

TEST_PAYTM_CONNECTOR_SHARED_SECRET=     # Test-mode secret (NODE_ENV=test), read directly with
                                         # no bridge variable, mirroring every other connector's
                                         # test-credential convention.
```

`PAYTM_CONNECTOR_URL` and `PAYTM_CONNECTOR_SHARED_SECRET` are optional as a *pair*, but never
independently:

| `PAYTM_CONNECTOR_URL` | `PAYTM_CONNECTOR_SHARED_SECRET` | Result |
|---|---|---|
| unset | unset | Connector simply not registered. No effect on Parmana's own boot, matching HubSpot/GitHub's own optional-connector behavior. |
| set | unset | **Startup fails hard** (`assertPaytmConnectorConfigured.ts`, called from `server.ts` before the port binds). |
| unset | set | **Startup fails hard**, same check. |
| set, non-HTTPS | set | **Startup fails hard**, outside `NODE_ENV=test`. |
| set, HTTPS | set | Connector registers normally. |

This is deliberately stricter than HubSpot/GitHub's "any one missing variable means simply not
registered" behavior, because a Paytm connector registered with only one of the two would silently be
either unreachable or unauthenticated — neither of which should ever happen quietly.

## Idempotency and replay protection

**No second authoritative transaction store is introduced.** Parmana's existing nonce/execution-trust-
record machinery remains the sole authority for whether a given signed authorization has already been
consumed — this connector adds nothing parallel to it.

Paytm's own `refId` represents the *logical refund* — identified by `(orderId, transactionId)`, the
Paytm order and transaction actually being refunded, not by Parmana's `businessTransactionId` (which
is unique per authorization attempt and therefore differs across two distinct Parmana authorizations
for the same logical refund, e.g. a legitimate retry after a prior attempt's outcome was unclear).

The connector service's contract — exercised hermetically in this repository by
`MockPaytmConnectorServer`'s deterministic `refIdFor(orderId, transactionId)`, and expected of the
real `parmana-paytm-agent` service — is: **a retried request for the same `(orderId, transactionId)`
must receive the same `refId` back, never a newly minted one.** `GatewayPaytmAdapter` never generates
a `refId` itself; it only forwards the request and validates what comes back.

## Ambiguous Paytm execution status

The connector service reports one of three statuses:

- **`completed`** — `GatewayPaytmAdapter` returns `ConnectorResponse.success: true`.
- **`failed`** — Paytm itself declined the refund. Returned as `success: false` (a clean, recorded
  execution result — never an exception).
- **`ambiguous`** — the connector service could not determine Paytm's actual outcome (e.g. a timeout
  or checksum failure on its own leg to Paytm). Returned as `success: false` with
  `metadata.requiresReconciliation: true`.

**`ambiguous` is deliberately never thrown as an error.** Throwing would look, to anything upstream
that retries on exception, like a transient infrastructure failure — exactly the behavior that could
cause a second refund attempt for a refund whose actual outcome was never confirmed. Instead it is
recorded as ordinary execution evidence, and:

```
DO NOT:
  - generate a new refId
  - issue another refund automatically

INSTEAD:
  - reconcile the existing refund's real status (the connector service's own
    responsibility, using Paytm's documented reconciliation/status-query
    semantics -- out of this codebase's scope)
  - only retry once that reconciliation confirms it is safe to do so
```

`GatewayPaytmAdapter` itself contains no internal retry loop of any kind — every `execute()` call
makes exactly one HTTPS request.

## Staging -> production setup

1. Deploy `parmana-paytm-agent` (a separate repository) with a real `PAYTM_MERCHANT_KEY` and Paytm
   credentials. This codebase has no role in that deployment.
2. Generate a strong, random `PAYTM_CONNECTOR_SHARED_SECRET` and configure it identically on both
   sides: this Parmana deployment's `PAYTM_CONNECTOR_SHARED_SECRET`, and whatever the connector
   service's own configuration calls the same value.
3. Set `PAYTM_CONNECTOR_URL` to the connector service's real, HTTPS base URL.
4. Boot Parmana. `assertPaytmConnectorConfigured.ts` fails startup immediately if the configuration is
   partial or non-HTTPS — this is intentional; fix the configuration rather than working around it.
5. Confirm `paytm` appears as a registered connector (no `paytm_connector_unavailable` warning in
   startup logs).
6. Exercise the flow with a real, small-amount, staging-safe refund through `POST /execute` before
   relying on it for real traffic.

There is no gated live-integration suite in this repository for this connector (unlike HubSpot's
`ALLOW_LIVE_HUBSPOT`/GitHub's `ALLOW_LIVE_GITHUB`), because this milestone has no reachable
`parmana-paytm-agent` deployment to run one against. Building and running that suite is open work for
whoever next has a real deployment of that service reachable.

## What this connector does not do

- It never calls Paytm's own API. It never holds `PAYTM_MERCHANT_KEY`.
- It never re-enters Parmana's own `/execute` authorization path — the connector service's endpoint is
  `POST /connector/paytm-refund`, never `/execute`. There is no recursive authorization loop.
- It never trusts a connector-service response at face value: every identifying field must echo the
  original request exactly, or the response is refused.
- It never retries an ambiguous Paytm outcome automatically, and never mints its own `refId`.
