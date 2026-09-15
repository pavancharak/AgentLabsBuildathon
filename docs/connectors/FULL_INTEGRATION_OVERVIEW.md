# Full Integration Overview: Connecting a Business System to Parmana

**This is a map, not a fifth copy of the detail.** Four pieces make up a real, working
integration with a business system, and each is documented in depth elsewhere. This page
exists because nothing else ties them together — each deep-dive doc deliberately scopes itself
to its own piece, so "what do I actually need, in total, and in what order" has no single
answer anywhere else in this repo.

**A note on naming, to avoid a real trap:** this codebase has two different things both called
"connector." `@parmana/connector-sdk` (see `docs/site/integrations/overview.mdx`) is a generic
library with reference mocks (`SapConnector`, `OracleConnector`, etc.) — none of it talks to a
real enterprise system. The connectors this codebase's **default server actually registers and
runs in production** — HubSpot, GitHub, Paytm, Slack — follow a different, simpler pattern
(`packages/execution-gateway/src/connector-execution/GatewayXAdapter.ts`), documented in
`BUILDING_A_CONNECTOR.md`. This page is about that second, real pattern.

## The four pieces

| #   | Piece                                      | Answers                                                       | Exists independently of the others?                                                                                               |
| --- | ------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **A policy** bound to a capability         | Should this specific request be allowed?                      | Yes — a policy can exist, and reject/approve requests, with zero connectors or callers ever wired to it.                          |
| 2   | **A caller (agent) with a scoped API key** | Who is even allowed to ask?                                   | Yes — a caller can authenticate and get real `APPROVED`/`REJECTED` decisions with no connector registered at all.                 |
| 3   | **A connector** for the capability         | Who actually performs the real-world action once approved?    | Yes — you can build and test a connector's own logic (`MockConnector`/hermetic tests) with no real caller or live policy traffic. |
| 4   | **A `SignalStateVerifier`** (optional)     | Are the caller's claims about real-world state actually true? | Yes, and most capabilities in this codebase don't have one — it's additive hardening, not a requirement.                          |

They're deliberately decoupled. That's _why_ "the agent got `APPROVED`" and "the refund actually
happened" are two separate, independently-verifiable claims — see
`CONNECTING_AN_AGENT.md`'s Step 8. Decoupling is the architecture working as intended, not a gap.

## Recommended build order, and why

There's no enforced order, but building them in a different sequence than this one tends to
waste work:

1. **Write the policy first.** Everything else needs to already know the exact capability
   string and the exact `signalsSchema`/`boundSignals` shape — guessing these before the policy
   exists means redoing Step 2 and Step 3's request/connector shapes once it's written for
   real. See `docs/site/guides/write-your-first-policy.mdx` and `LIVE-API-GUIDE.md` (repo root).
2. **Onboard a caller and test authorization in isolation**, with no connector registered yet.
   `POST /execute` returning a clean `APPROVED`/`REJECTED`/`403 CAPABILITY_NOT_ALLOWED` proves
   your policy and caller scoping are correct _before_ you've written any connector code at all
   — see `CONNECTING_AN_AGENT.md`. A `500 "No connector registered for capability '<name>'"` at
   this stage is expected and fine; it tells you authorization is working and execution isn't
   wired yet, which is exactly what you're testing for.
3. **Build the connector.** Now that you have a real, approved transaction shape to test
   against, implement `Connector`, register it in `createConnectorRegistry.ts` — see
   `BUILDING_A_CONNECTOR.md` and `CONNECTOR_FAQ.md`.
4. **Add a `SignalStateVerifier` only if you need it** — specifically, if a caller declaring a
   false signal value (`vendorVerified: true` when it isn't) is a real risk for this capability
   that a policy rule alone can't catch. See `docs/book/03-signal-state-verification.md`. Most
   capabilities in this codebase don't have one; HubSpot does.

## Worked example: adding refunds for a new payment provider

Say you're adding refunds for a payment provider that isn't Paytm — call it `"newpay:refund"`.

1. **Policy:** author `newpay-refund/1.0.0`, deciding what makes a refund approvable
   (`refundEligible`, `managerApproved`, amount ceilings — whatever your business rules are).
   Bind `newpay:refund` to it in `packages/capability-registry/src/CapabilityPolicyBinding.ts`.
2. **Caller:** `npx tsx scripts/generate-api-key.ts --caller-id my-refund-agent --allowed-capabilities "newpay:refund" --credential-holder-type SERVICE`. Send a real
   transaction, confirm `APPROVED`/`REJECTED` behave correctly. No connector needed yet.
3. **Connector:** implement `GatewayNewPayAdapter` following HubSpot's pattern exactly (deny-by-default
   on parameters, fail-closed on non-2xx/timeout), register it. If the provider's credential
   should never sit in Parmana's own process at all (the exact reasoning Paytm's connector was
   split out for — see `PAYTM_CONNECTOR.md`), use that out-of-process pattern instead: Parmana
   signs an authorization, a separate service holding the real credential verifies that
   signature before calling the provider's real API. `parmana-paytm-agent` is the real,
   working reference for that shape.
4. **Signal verification (optional):** if `refundEligible` should be independently re-checked
   against NewPay's own API rather than trusted from the caller's declaration, implement a
   `NewPaySignalStateVerifier` following `HubSpotSignalStateVerifier`'s pattern and compose it
   via `CompositeSignalStateVerifier`.

## What breaks if you skip a piece — a real failure-mode map

This table is not hypothetical — every row is a failure mode actually hit and diagnosed in this
codebase's own history (several the same night, integrating the real Pfinite/Paytm refund flow).

| You have                                                                   | You're missing               | What actually happens                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Policy + caller key                                                        | Connector                    | `APPROVED`, then `500 "No connector registered for capability '<name>'"` at dispatch. Not a bug — see `CONNECTING_AN_AGENT.md` Part 3.                                                                                                                                                                                                                                                                                                                                   |
| Connector + caller key                                                     | Policy                       | `404 PolicyNotFoundError` — the request never reaches your connector at all.                                                                                                                                                                                                                                                                                                                                                                                             |
| Policy + connector                                                         | Caller key / correct scoping | `401` (no key), or `403 CAPABILITY_NOT_ALLOWED` (key exists but isn't scoped to this capability), or `403` (`principalId` not permitted) — see `CONNECTING_AN_AGENT.md` Part 3's full table.                                                                                                                                                                                                                                                                             |
| All three                                                                  | `SignalStateVerifier`        | Works, but a caller that lies about a signal (`vendorVerified: true` when it isn't) is trusted at face value — the policy evaluates whatever it's told, nothing independently checks it's true. This is the residual gap `docs/book/03-signal-state-verification.md` names directly; it's a real, accepted scope limit for any capability without a verifier wired up, not a hidden bug.                                                                                 |
| Everything, but the deployment's own signing/verification config is broken | —                            | A real, otherwise-correct request fails with an opaque `500` unrelated to anything the caller did — see `docs/operations/2026-09-15-kms-migration-troubleshooting-guide.md` for a full real account of exactly this happening, and `examples/tutorials/114-signing-verification-key-agreement/` to see the failure mode reproduced directly. This is an operator-side deployment problem, not something any of the four pieces above can detect or fix from the outside. |

## Where to go next

- **Policy authoring:** `docs/site/guides/write-your-first-policy.mdx`, `LIVE-API-GUIDE.md`
- **Connecting a caller/agent:** `docs/connectors/CONNECTING_AN_AGENT.md`
- **Building a connector:** `docs/connectors/BUILDING_A_CONNECTOR.md`, `docs/connectors/CONNECTOR_FAQ.md`
- **The out-of-process connector pattern** (credential never touches Parmana's own process):
  `docs/connectors/PAYTM_CONNECTOR.md`
- **Independently re-verifying a caller's claimed signals:** `docs/book/03-signal-state-verification.md`
- **Credential isolation mechanics** (how a connector gets a credential it never fetches
  itself): `docs/architecture/CONNECTOR_ISOLATION.md`
