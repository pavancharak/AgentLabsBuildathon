# Parmana Execution-Authority Validation Stack Demo

Four independent validation layers (Policy + Fraud + Scope + Proof) converging at the execution boundary — this is what **RBI** requires on **Jan 1, 2027**, for autonomous agent payments.

**Live:** https://parmana-exp-demo.vercel.app

> This document is intentionally specific about what's real production code and what's demo-tier. See [Section 3](#four-layer-architecture) and [Section 13](#license--attribution) for the exact provenance of every line.

---

## Table of Contents

1. [Quick Start](#quick-start-live-demo)
2. [Four-Layer Architecture](#four-layer-architecture)
3. [Endpoints Reference](#endpoints-reference)
4. [Test Scenarios](#test-scenarios)
5. [Local Development](#local-development)
6. [Deployment](#deployment)
7. [Demo Script for Judges](#demo-script-for-judges)
8. [Why This Matters](#why-this-matters)
9. [Technical Details](#technical-details)
10. [Troubleshooting](#troubleshooting)
11. [Future Work](#future-work)
12. [License & Attribution](#license--attribution)

---

## Quick Start (Live Demo)

Three commands. All hit the live deployment — no setup required.

**1. Approved payment** ($50 against a $100 limit):

```bash
curl -X POST https://parmana-exp-demo.vercel.app/demo/payment \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-1","vendorId":"vendor-9","amount":50,"limit":100}'
```

**2. Denied payment** ($500 against a $100 limit):

```bash
curl -X POST https://parmana-exp-demo.vercel.app/demo/payment \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-1","vendorId":"vendor-9","amount":500,"limit":100}'
```

**3. Audit trail:**

```bash
curl https://parmana-exp-demo.vercel.app/proofs
```

---

## Four-Layer Architecture

An agent payment request passes through four gates before anything executes:

| Layer | Purpose | Source | Status in Demo |
|---|---|---|---|
| **Policy** (M6) | Deterministic rule evaluation — amount limit, vendor allowlist, velocity | Real production code | ✅ Real |
| **Fraud** (M5) | Scores amount-vs-limit ratio, request velocity, deviation from the agent's own history | Purpose-built heuristic | ⚡ Demo-tier |
| **Credential Scope** (M4) | Time-bounded credential scoped to `maxAmount` + `authorizedVendors` | Purpose-built heuristic | ⚡ Demo-tier |
| **Proof** (M7) | **Ed25519**-signs the decision over its canonical byte serialization | Real production code | ✅ Real |

**Any one layer can block execution. All layers must pass for approval. Every decision — approved or denied — is cryptographically signed.**

Policy catches rule violations. Fraud catches anomalies. Scope catches capability creep. Proof means none of it can be denied happened later.

---

## Endpoints Reference

### `POST /demo/payment`

The headline endpoint. An agent attempts to pay a vendor; all four layers evaluate the request.

**Request:**

```json
{"agentId":"agent-1","vendorId":"vendor-9","amount":50,"limit":100}
```

**Response** (approved — real, captured from the live deployment):

```json
{
  "approved": true,
  "decision": { "approved": true },
  "validation": {
    "policy": {
      "approved": true,
      "policyId": "demo-payment-policy",
      "policyVersion": "1.0.0",
      "matchedRuleId": "defaultApprove",
      "reason": "all policy rules passed",
      "evaluatedRules": 4,
      "matchedPath": ["amountRule", "vendorRule", "velocityRule", "defaultApprove"]
    },
    "fraud": {
      "score": 0,
      "riskLevel": "low",
      "signals": { "amountToLimitRatio": 0.5, "recentAttempts": 0, "amountDeviationFactor": 1 }
    },
    "credential": {
      "agentId": "agent-1",
      "credentialId": "cred_8911af72-...",
      "scope": { "maxAmount": 100, "authorizedVendors": ["vendor-9"] },
      "inScope": true,
      "reason": "within credential scope"
    }
  },
  "proof": {
    "proofId": "proof_2ec4d6fa-...",
    "algorithm": "ed25519",
    "signature": "vQ9vp55llAquavOIER0rM54sa8Zx9jsdoEqr44mhCL0iuWGN4LiAIF5GtmIAQuhwLlVhpPGSRujT+9OXHlNQDg==",
    "payload": { "agentId": "agent-1", "vendorId": "vendor-9", "amount": 50, "limit": 100, "approved": true }
  },
  "message": "Agent agent-1 paid vendor vendor-9 $50 — passed policy, fraud, and credential-scope checks."
}
```

### `GET /health` and `GET /healthz`

Plain liveness check.

```bash
curl https://parmana-exp-demo.vercel.app/healthz
# {"status":"ok"}
```

### `POST /verify-proof`

Independently re-verifies a proof's **Ed25519** signature against its own canonical payload, without trusting anything the server currently says.

**Request:**

```json
{
  "proof": {
    "proofId": "proof_1ad31ce7-...",
    "keyId": "demo-key-97574514-...",
    "algorithm": "ed25519",
    "signature": "qQk6toLdTvAqi53og21K6OiYCobjewH1+5sRcd22oZZCZTaTJqYBjvSdASP6/z/EFcZgHRuKnJP9VgyAmFCGBA==",
    "payload": { "proofId": "proof_1ad31ce7-...", "agentId": "agent-x", "amount": 10, "approved": true }
  }
}
```

**Response** (real, captured from the live deployment):

```json
{ "valid": true, "keyId": "demo-key-97574514-...", "algorithm": "ed25519" }
```

Change one byte in `payload` and re-send it — `valid` flips to `false`. That's the point: the signature covers the exact decision, not a label attached to it later.

### `GET /proofs`

Audit trail, newest first. Default `limit=100`; override with `?limit=N`.

```bash
curl "https://parmana-exp-demo.vercel.app/proofs?limit=10"
```

```json
{
  "count": 1,
  "total": 1,
  "proofs": [
    {
      "proofId": "proof_1ad31ce7-...",
      "type": "payment",
      "agentId": "agent-x",
      "decision": "approved",
      "algorithm": "ed25519",
      "signature": "qQk6toLdTvAqi53og21K6OiYCobjewH1+5sRcd22oZZCZTaTJqYBjvSdASP6/z/EFcZgHRuKnJP9VgyAmFCGBA=="
    }
  ]
}
```

### `GET /architecture`

Shows each layer's real provenance and the current Ed25519 public key, so anyone can verify a proof without asking the server to vouch for itself.

```bash
curl https://parmana-exp-demo.vercel.app/architecture
```

Returns the four layers (as in the table above) plus:

```json
{
  "keyId": "demo-key-97574514-4cdb-4595-8ef4-a173ad359bcf",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----\n"
}
```

---

## Test Scenarios

### Scenario 1: Approved ($50 ≤ $100)

```bash
curl -X POST https://parmana-exp-demo.vercel.app/demo/payment \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-1","vendorId":"vendor-9","amount":50,"limit":100}'
```

All four layers pass:

- **Policy:** ✅ evaluates 4 rules, matches `defaultApprove`
- **Fraud:** ✅ score `0`, `low` risk
- **Credential:** ✅ `inScope: true`
- **Proof:** ✅ **Ed25519**-signed

**Real-world meaning:** the agent has authority to make this payment, and there's a signed record saying so.

### Scenario 2: Denied ($500 > $100)

```bash
curl -X POST https://parmana-exp-demo.vercel.app/demo/payment \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-1","vendorId":"vendor-9","amount":500,"limit":100}'
```

All four layers block:

- **Policy:** ❌ `amountRule` fails
- **Fraud:** ❌ score `0.775`, `high` risk (5x the credential limit, flagged as a spike)
- **Credential:** ❌ exceeds `maxAmount`
- **Proof:** ✅ still signed — the denial is on the record just as permanently as an approval would be

**Real-world meaning:** the agent exceeded its bounds, execution never happened, and the decision is on the ledger either way.

### Scenario 3: Audit Trail

```bash
curl https://parmana-exp-demo.vercel.app/proofs
```

Both decisions above are visible here — the approval and the denial, both signed. Nothing is filtered out because it was a rejection.

**Real-world meaning:** a regulator can audit every decision an agent's credential ever made; a merchant can prove, after the fact, exactly what was and wasn't authorized.

---

## Local Development

**Prerequisites:** Node 18+, npm 9+ (developed and tested on Node 22 / npm 11).

```bash
cd demo
npm install
npm run dev        # starts on http://localhost:3000
```

Test it:

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/demo/payment \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-1","vendorId":"vendor-9","amount":50,"limit":100}'
```

Build for production:

```bash
npm run build       # tsc -> dist/
npm start           # node dist/index.js
```

**Environment variables:** none are required. The Ed25519 keypair is generated in-process at boot (see [Troubleshooting](#troubleshooting) for what that means for signature verification across restarts).

---

## Deployment

**Current status:** deployed to Vercel, production, at https://parmana-exp-demo.vercel.app (serverless — `api/index.ts` wraps the Express app for `@vercel/node`, `vercel.json` rewrites every path to it).

**Redeploy:**

```bash
cd demo
vercel deploy --prod
```

**Docker alternative** — `demo/Dockerfile.fly` is a working multi-stage build (`node:22-alpine`, `npm run build`, `node dist/index.js`, healthcheck on `/health`) if you'd rather run this as a long-lived container instead of serverless functions:

```bash
docker build -f Dockerfile.fly -t parmana-exp-demo .
docker run -p 3000:3000 parmana-exp-demo
```

**Fly.io reference** — `demo/fly.toml` and `demo/Dockerfile.fly` are present and were validated locally, but this demo is **not currently deployed to Fly** (Fly blocked app creation on this account pending a payment method; Vercel was used instead for the live URL above). They're kept in the repo in case that changes.

---

## Demo Script for Judges

### Part 1: Show Architecture (30 sec)

```bash
curl -s https://parmana-exp-demo.vercel.app/architecture | jq
```

**Say:** "This endpoint shows what's real production code and what's purpose-built for this demo — Policy and Proof are vendored straight from our production packages, Fraud and Credential Scope are demo-tier. I'm not going to pretend all four are production-hardened. Two are. Two aren't yet."

### Part 2: Approved Payment (1 min)

```bash
curl -s -X POST https://parmana-exp-demo.vercel.app/demo/payment \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-1","vendorId":"vendor-9","amount":50,"limit":100}' | jq
```

**Say:** "An agent tries to pay $50 to a vendor, with a $100 credential limit. Watch what happens: Policy evaluates four rules and approves. Fraud scores it — zero, low risk, nothing anomalous. Credential Scope checks it's within `maxAmount` and the vendor's on the allowlist — in scope. Then Proof signs the whole decision with **Ed25519**. Four gates, all green, one signature."

### Part 3: Denied Payment (1 min)

```bash
curl -s -X POST https://parmana-exp-demo.vercel.app/demo/payment \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-1","vendorId":"vendor-9","amount":500,"limit":100}' | jq
```

**Say:** "Same agent, same vendor, different amount — $500 against the same $100 limit. Policy rejects on `amountRule` immediately. Fraud independently flags it too — score jumps to 0.775, high risk, because it's a 5x spike over the credential bound. Credential Scope also says no — it's outside `maxAmount`. Three independent layers reach the same conclusion without coordinating, and the denial gets signed exactly like the approval did."

### Part 4: Show Audit Trail (1 min)

```bash
curl -s https://parmana-exp-demo.vercel.app/proofs | jq
```

**Say:** "Every decision is cryptographically signed and lands here — the $50 approval and the $500 denial, both on the record. This is what an auditor pulls up six months later to check whether an agent ever exceeded its authority. Nothing gets to quietly disappear because it was a rejection."

### Part 5: Closing Pitch (1-2 min)

**Say:** "Here's why this matters: RBI's liability framework for autonomous agent transactions takes effect Jan 1, 2027. Right now, if an agent pays the wrong vendor or the wrong amount, there's no standard way to prove — after the fact — what it was authorized to do and whether it stayed inside those bounds. Parmana sits between the policy decision and the actual execution, so every agent action gets checked against a scoped credential and produces a signed proof, before money moves, not after.

For Track 2: this is what a merchant needs to go live with agent-initiated payments — bounded credentials, an audit trail a regulator can actually read, and a decision that's provably tied to a signature instead of a log line someone could edit.

For a merchant like Paytm, integrating an autonomous agent into a payment flow means someone eventually asks 'how do you know the agent didn't overspend, and how do you prove it?' This is that answer — not a promise, a signed record."

### Follow-Up Q&A

**"Why do you need four layers?"**
Because they catch different failure modes and none of them substitutes for another. Policy catches rule violations you wrote down in advance. Fraud catches anomalies you didn't think to write a rule for. Scope catches an agent trying to act outside what it was ever issued authority to do, even if policy and fraud both miss it. If any one layer is buggy or bypassed, the other two are still standing between the agent and execution.

**"Can an agent bypass this?"**
Not without controlling the process that issues its credential and holds the signing key — the checks happen before the payment executes, not as a log written after. In this demo, credential issuance and signing both happen server-side in the same request; the agent never sees or touches key material.

**"What if the policy is wrong?"**
Then it fails the way a wrong policy should: transparently and correctably. `/architecture` publishes exactly which policy version evaluated the request, `matchedRuleId` tells you which rule fired, and because the engine is deterministic, replaying the same signals against a fixed policy always gives the same answer — you can diff policy versions and know precisely what changed, rather than debugging opaque model behavior.

**"Does this work with NPCI AtOM?"**
NPCI AtOM (announced Sep 8, 2026) is about authenticating an agent's identity and transaction rails. Parmana is about authorizing what that agent is allowed to do once it's authenticated — a different layer. NPCI handles authentication. We handle authorization. They sit in different layers, and they're complementary, not competing.

---

## Why This Matters

**The market problem:** RBI's liability framework for autonomous agent payments takes effect **Jan 1, 2027**. NPCI announced AtOM on **Sep 8, 2026** — that leaves **115 days** for merchants and platforms to have a real authorization layer in place, not just an authentication one.

**The solution:** Parmana sits between policy decisions and execution. An agent doesn't get a blank credential — it gets one scoped to a specific amount, a specific set of vendors, a specific time window, and a specific velocity limit. Every decision, in or out of bounds, produces a signed proof.

**What it enables:**
- Scoped credentials (amount + vendor bounds, not blanket access)
- Time windows and expiry on every credential
- Velocity limits that catch runaway agent loops
- A signed proof for every decision, not just the approvals
- An audit trail regulators and merchants can both read

**For merchants (Track 2):** proof of authorization, an audit trail that survives a dispute, and a path to being regulator-ready before Jan 1 — without hand-rolling this yourselves.

**For judges:** multiple independent gates, a verifiable signature instead of a trust-me log line, and an honest architecture that tells you which parts are production-hardened and which parts were built for this weekend.

---

## Technical Details

**Code structure** (everything below lives in `demo/`, self-contained):

```
demo/
├── src/
│   ├── index.ts              # bootstraps app.listen() for local/Docker
│   ├── server.ts             # Express app, all routes
│   ├── layers/
│   │   ├── policyLayer.ts        # builds the payment Policy, calls PolicyEngine
│   │   ├── fraudLayer.ts         # demo-tier fraud heuristic
│   │   ├── credentialLayer.ts    # demo-tier scoped payment credential
│   │   ├── activityTracker.ts    # shared in-memory velocity/history store
│   │   └── proofLayer.ts         # Ed25519 signing + verification
│   └── vendor/
│       ├── policy/                # PolicyEngine, OperatorEvaluator, types
│       │                          #   — vendored from packages/policy/src/
│       └── crypto/                # CanonicalSerializer, Ed25519SignatureProvider
│                                   #   — vendored from packages/crypto/src/
├── api/index.ts               # Vercel serverless entry (wraps the Express app)
├── vercel.json
├── fly.toml / Dockerfile.fly  # present, not currently the deployment target
└── package.json
```

**Layer implementation, one sentence each:**
- **Policy** — deterministic first-match-wins rule evaluation over `amountExceedsLimit`, `vendorBlocked`, and `velocityExceeded` signals.
- **Fraud** — scores amount-to-limit ratio, requests-per-minute, and deviation from the agent's own historical spend.
- **Credential Scope** — issues a 5-minute-lived credential bound to `maxAmount` + `authorizedVendors`, then checks the request against it.
- **Proof** — canonically serializes the decision and signs it with **Ed25519**, using Node's built-in `crypto`.

**Dependencies:** `express` is the only runtime npm dependency. Everything cryptographic and policy-related uses `node:crypto` (built-in) plus the vendored code above — **zero external dependencies for the four validation layers themselves.** The vendored files have no import back into the rest of the monorepo; `demo/` deploys as a fully standalone unit.

---

## Troubleshooting

**`POST /demo/payment` returns `403`**
Expected behavior when a request is denied — check the `message` and `validation` fields in the response body for which layer(s) blocked it.

**`/proofs` looks empty right after deploying, or right after another call succeeded**
Expected. The audit trail is in-memory per serverless instance. Immediately after a deploy, or under concurrent load, requests can land on different warm instances that don't share memory — a proof written on one instance won't show up when `/proofs` is served by another. This is demo-grade storage, not a production audit log (see [Future Work](#future-work)).

**A signature doesn't verify**
Fetch `/architecture` and confirm you're checking against the `publicKey` and `keyId` it currently reports. The keypair is generated fresh per running instance — if the proof was signed by a different instance (see above), its `keyId` won't match the key `/architecture` is currently showing.

**Local tests work, live tests fail**
Check you're using `https://`, not `http://`; check for a trailing slash or typo in the path (`/demo/payment`, not `/demo/payments`); confirm you're sending `Content-Type: application/json` with a JSON body on the `POST` requests.

---

## Future Work

This demo is intentionally minimal — four layers, honest framing, production-ready by Sep 10, 2026. What's next:

- Integrate a real payment connector (e.g. Razorpay) so `/demo/payment` moves real (sandboxed) money
- A policy editor UI, instead of hand-editing the `Policy` object in `policyLayer.ts`
- Replace the demo-tier fraud heuristic with a real, trained fraud module
- Database-backed audit trail (durable, shared across instances — not in-memory)
- Public key rotation and a key registry, instead of one keypair per running instance
- Policy version history and diffing
- Multi-tenant support (per-merchant policies, credentials, and audit trails)

---

## License & Attribution

**License:** MIT

**Attribution for real code:**
- Policy Engine (M6) — real code from this repository's `packages/policy/src/` (PolicyEngine, OperatorEvaluator), vendored into `demo/src/vendor/policy/` unmodified except for removing the monorepo-internal type import.
- Cryptographic Proof (M7) — real code from this repository's `packages/crypto/src/` (CanonicalSerializer, Ed25519SignatureProvider), vendored into `demo/src/vendor/crypto/` unmodified except for the same import fix.

**Attribution for demo-tier code:**
- Fraud Detection, Credential Scope — purpose-built for this demo scenario. No equivalent module exists elsewhere in this repository.

**Contact:** founder@parmanasystems.com

---

**Live:** https://parmana-exp-demo.vercel.app
**Built:** Sep 10, 2026
**Event:** Agent Labs Buildathon (Track 2)
**For:** Judges, merchants, regulators
**Pitch:** Four independent validation layers. Any one can block. All signed. This is what RBI requires on Jan 1.
