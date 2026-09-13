# Parmana

**Institutional Authority Infrastructure: protecting who has the authority
to decide what becomes real-world execution.**

[![CI](https://github.com/pavancharak/parmana-exp/actions/workflows/ci.yml/badge.svg)](https://github.com/pavancharak/parmana-exp/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](package.json)

> **Proprietary software evaluation only.** This repository is source-available
> for evaluation purposes. No license is granted to use, copy, modify, or
> distribute this software, in whole or in part, without a separate written
> agreement with Parmana Systems. See [LICENSE](./LICENSE).

As organizations connect AI agents to real systems, the open question is
no longer whether the agent can act, it's what it's actually allowed to
do, and whether what it did can be proven afterward rather than assumed.
Parmana sits between an AI agent and the systems it calls: every
requested action is checked against an explicit policy before it runs, so
an agent can only do what it was approved to do. Every approved action
also produces a signed, tamper-evident record, so what happened can be
proven afterward, not just trusted. Parmana does not decide what the
agent should do. It decides, and proves, whether the agent was allowed to
do it the authorization layer beneath that guarantee, not a
replacement for it.

## Proven, not promised

Parmana's own documentation discipline is the differentiator: [docs/CLAIMS.md](docs/CLAIMS.md)
states every technical claim at the scope its evidence actually supports,
cites the specific code and test backing it, and keeps a running list of
what is explicitly not yet true. Nothing below is asserted without a
section number you can go check.

The chain: **authorize -> verify -> execute -> confirm**. A Business
Transaction carries an explicit authority, authorization, and intent. A
deterministic policy evaluates it and approves or rejects. An approved
transaction executes through a gateway that never lets the caller hold
real credentials directly. The result is signed into an append-only
Execution Trust Record, independently verifiable without trusting
Parmana's own runtime or database.

What's actually been demonstrated, not just built:

- **1,671 automated tests** across the workspace (1,631 passed, 38 skipped, 0 failed; the
  skips are Supabase/live-credential-gated suites that skip cleanly with no credentials
  configured; re-verified 2026-09-10 via a JSON-reporter run, not just the summary line, see
  [docs/VERIFICATION-GAPS.md](docs/VERIFICATION-GAPS.md) G-24 and the 2026-09-10 session's
  own gap-closure table).
- A live, reproducible execution-authorization bypass was found and fixed the same session:
  policy-evaluation signals are now bound to the executed Intent before any rule evaluates
  (`Policy.boundSignals` + `SignalIntentBinder`), closing the gap where a caller could declare
  a small, fully-verified action while `intent` executed something else entirely. See
  [docs/VERIFICATION-GAPS.md](docs/VERIFICATION-GAPS.md) G-24 for the full incident, including
  the live proof-of-concept figures, and what's deliberately still open.
- **A real external system, not a mock**: HubSpot deal-stage/amount updates, authorized by policy, executed through the signed gateway pipeline, proven against HubSpot's actual production API, including a real, non-destructive read-nudge-revert mutation on a real account ([CLAIMS.md 3.10](docs/CLAIMS.md)).
- Assessed at **Technology Readiness Level 6**, system/subsystem model or prototype demonstration in a relevant environment, on the strength of the point above ([CLAIMS.md, Maturity Assessment](docs/CLAIMS.md)). A prior deployment briefly reached TRL 7 on Razorpay evidence before that connector was deliberately removed 2026-08-12 — see CLAIMS.md's Maturity Assessment for the full history.
- **Independently source-code-validated**, not merely documented: a from-scratch audit checked whether an action can become real-world execution without satisfying institutional authorization, for every capability this system exposes and regardless of what kind of system requests it (AI agent, human, or otherwise) — tracing the actual execution path rather than trusting function names or comments. Verdict: **directly validated**, for the capabilities currently registered in production, with precisely scoped caveats stated alongside the result, not smoothed over ([docs/architecture/strategic-positioning-validation.md](docs/architecture/strategic-positioning-validation.md)).

## Architecture

```
Authority --> Authorization --> Intent --> Business Transaction
                                                  |
                                                  v
                                          Policy Engine (deterministic)
                                                  |
                                                  v
                                              Decision
                                                  |
                                                  v
                                          Execution Gateway
                                     (credentials never touch the caller)
                                                  |
                                                  v
                                        Connector -> real system
                                                  |
                                                  v
                              Execution Trust Record (signed, append-only)
                                                  |
                                                  v
                                Verification  <-->  Settlement Confirmation
```

| Package | Role |
|---|---|
| `@parmana/api` | REST API: `/execute`, `/verification`, webhooks, caller authentication |
| `@parmana/runtime` | Orchestrates a Business Transaction through policy, execution, and evidence |
| `@parmana/policy` | Deterministic policy evaluation, sequential rules, first-match semantics |
| `@parmana/execution-gateway` | The sole boundary that releases an approved request to a connector |
| `@parmana/execution-control` | Credential-isolating, single-use execution release |
| `@parmana/connector-sdk` | Connector authoring contract: capability definitions, schemas, and the Connector/CredentialProvider interfaces |
| `@parmana/envelope-verifier` | Verifies a Parmana authorization independently, no trust in Parmana's runtime or database required |
| `@parmana/crypto` | Signing and verification, Ed25519 by default, ML-DSA-65 (post-quantum) configurable |
| `@parmana/receipt` | Signed, portable proof of execution |
| `@parmana/replay` | Deterministic reconstruction of a past policy decision |
| `@parmana/storage` | Append-only persistence, in-memory or Supabase-backed |
| `@parmana/shared` | Domain model and configuration shared across every package |

Key properties: fail-closed configuration (a misconfigured process refuses
to start rather than degrade silently), credential isolation (a connector
never receives long-lived credentials, only a single-use session), exactly-once
consumption of every authorization and webhook event, append-only signed
evidence, and both classical (Ed25519) and post-quantum (ML-DSA-65)
signing.

## Getting started

```bash
npm install
npm test
```

To see the full chain run against a local mock connector, no network
access or credentials required:

```bash
npx tsx examples/tutorials/60-end-to-end-enterprise-execution/run.ts
```

This walks through the full pipeline: policy evaluation, signed
authorization, envelope verification, request-bound attestation, session
credential issuance, connector execution, credential destruction, and the
signed audit/trust record.

For a real deployment, see [DEPLOYMENT.md](DEPLOYMENT.md). It covers
required configuration, fail-closed startup validation, and what was
verified against two real Fly.io deployments (test mode and live mode).

To call a live, running instance directly — authentication, the full
request shape, every deployed policy's signal schema, how to author and
deploy a new policy, and independent offline verification with zero
network access — see [LIVE-API-GUIDE.md](LIVE-API-GUIDE.md).

A further tier of integration tests exercises HubSpot's real API and is
opt-in, skipped by default so `npm test` never needs live credentials.
The env vars involved (names only, see the test files for what each
gates): `ALLOW_LIVE_HUBSPOT`, `TEST_HUBSPOT_PRIVATE_APP_TOKEN`,
`TEST_HUBSPOT_DEAL_ID`, and separately `ALLOW_LIVE_SUPABASE` for the
Supabase-gated storage suite.

To measure request throughput/latency for `POST /execute` (real policy
evaluation, Ed25519 signing, and connector execution, run at
configurable concurrency against an in-memory, caller-auth-disabled
instance (see the script's own header comment for exact scope):

```bash
npm run loadtest -- --connections 20 --duration 15
```

## Status and scope

Assessed at TRL 6 on the evidence in [docs/CLAIMS.md](docs/CLAIMS.md).
Explicitly not claimed: sustained volume, load-bearing traffic, high
availability, or multi-tenant production operation. The claims file also
tracks what has no implementation yet, every connector beyond HubSpot,
GitHub, and Paytm among them. Adding a new connector is a bootstrap source change
today, not a runtime configuration option — see
[docs/connectors/BUILDING_A_CONNECTOR.md](docs/connectors/BUILDING_A_CONNECTOR.md).

We're looking for a small number of design partners to run Parmana
against a real integration under real constraints. If that's you, or
you're evaluating Parmana for a role, reach out: **founder@parmanasystems.com**.

## Support

- Email: [founder@parmanasystems.com](mailto:founder@parmanasystems.com)
- Documentation: [parmanasystems.com](https://parmanasystems.com)
- Issues: [github.com/pavancharak/parmana-exp/issues](https://github.com/pavancharak/parmana-exp/issues)

## License

Source-available for evaluation only. See [LICENSE](./LICENSE). No
license is granted to use, copy, modify, distribute, or create
derivative works from this repository except as expressly permitted in a
separate written agreement with Parmana Systems.

## More documentation

[docs/README.md](docs/README.md) indexes the rest: CLAIMS.md, DEPLOYMENT.md,
SECURITY.md, and package-level documentation, in reading order.

Connecting an external agent? Start with
[docs/connectors/CONNECTING_AN_AGENT.md](docs/connectors/CONNECTING_AN_AGENT.md)
(what's required and why, a step-by-step walkthrough, and every response/error
cited to source).

Adding a connector? Start with
[docs/architecture/CONNECTOR_ISOLATION.md](docs/architecture/CONNECTOR_ISOLATION.md)
(how credential isolation actually works) and
[docs/connectors/BUILDING_A_CONNECTOR.md](docs/connectors/BUILDING_A_CONNECTOR.md)
(the concrete steps, using the real HubSpot/GitHub connectors as reference).
