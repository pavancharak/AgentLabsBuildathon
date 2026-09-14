\# Tutorial 12 — Envelope Verification

\## Objective

This tutorial demonstrates how a downstream execution system verifies a Parmana Execution Authorization before executing business logic.

Unlike policy evaluation, envelope verification does \*\*not\*\* determine whether an action should be allowed. It verifies that Parmana has already authorized the action.

\---

\## What this tutorial demonstrates

The runtime:

\- Evaluates policy

\- Produces a Decision

\- Generates a signed Execution Authorization

The downstream system:

\- Verifies the signature

\- Confirms the authorization has not expired

\- Validates the authorization TTL

\- Performs replay protection using the nonce

Only after all checks succeed should execution proceed.

\---

\## Run

```bash

npx tsx examples/tutorials/12-envelope-verification/run.ts

```

\---

\## Expected output

The verification result contains:

```json

{

&#x20; "valid": true,

&#x20; "checks": {

&#x20;   "signatureVerified": true,

&#x20;   "notExpired": true,

&#x20;   "ttlWithinPolicy": true,

&#x20;   "nonceUnseen": true

&#x20; }

}

```

\---

\## Architecture

```

Business Transaction

&#x20;       │

&#x20;       ▼

&#x20;Runtime

&#x20;       │

&#x20;       ▼

Signed Execution Authorization

&#x20;       │

&#x20;       ▼

Envelope Verifier

&#x20;       │

&#x20;       ├── Signature Verification

&#x20;       ├── Expiry Verification

&#x20;       ├── TTL Verification

&#x20;       └── Replay Protection (Nonce)

&#x20;       │

&#x20;       ▼

Verified Execution Request

&#x20;       │

&#x20;       ▼

Execution System

```

This tutorial demonstrates the trust boundary between Parmana and downstream execution systems. Execution systems do not re-evaluate enterprise policy—they verify that Parmana authorized the request and that the authorization remains valid.
