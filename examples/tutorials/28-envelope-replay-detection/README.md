\# Tutorial 28 — Envelope Replay Detection

\## Overview

In the previous tutorials we learned how Parmana generates and verifies Execution Authorizations.

This tutorial demonstrates how Parmana prevents the \*\*same authorization\*\* from being accepted more than once.

Even when:

\- the signature is valid,

\- the authorization has not expired,

\- the payload has not been modified,

the second attempt is rejected because the authorization nonce has already been consumed.

\---

\## Execution Flow

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Parmana Runtime

&#x20;       │

&#x20;       ▼

Signed Execution Authorization

&#x20;       │

&#x20;       ▼

EnvelopeVerifier

&#x20;       │

&#x20;       ▼

MemoryNonceStore

&#x20;       │

&#x20;       ▼

First Request

&#x20;       │

&#x20;       ▼

✓ Accepted



Second Request

&#x20;       │

&#x20;       ▼

✗ Replay Detected

```

\---

\## Why Replay Protection Exists

Without replay protection an attacker could capture a valid authorization and execute it repeatedly until it expired.

Replay detection guarantees that every authorization can only be accepted once.

\---

\## Building the Runtime

```ts

const runtime =

&#x20; new RuntimeBuilder()

&#x20;   .withPolicyRepository(

&#x20;     new FilePolicyRepository("policies"),

&#x20;   )

&#x20;   .build(

&#x20;     new MemoryExecutionTrustRecordRepository(),

&#x20;   );

```

\---

\## Generating the Authorization

```ts

const { context } =

&#x20; await runtime.execute(transaction);



const authorization =

&#x20; context.authorization!;

```

\---

\## Creating the Envelope Verifier

```ts

const verifier =

&#x20; new EnvelopeVerifier({

&#x20;   publicKey,

&#x20;   nonceStore:

&#x20;     new MemoryNonceStore(),

&#x20; });

```

The verifier combines:

\- signature verification

\- expiration validation

\- TTL policy

\- replay detection

\---

\## First Verification

```ts

const first =

&#x20; await verifier.verify(

&#x20;   authorization,

&#x20; );

```

Result:

```text

✓ Accepted

```

The nonce is recorded.

\---

\## Second Verification

```ts

const second =

&#x20; await verifier.verify(

&#x20;   authorization,

&#x20; );

```

Result:

```text

✗ Replay Detected

```

The authorization itself has not changed.

Only the nonce state has changed.

\---

\## Expected Output

```text

==================================================

Tutorial 28 - Envelope Replay Detection

==================================================



Generating authorization...



✓ Authorization generated.



First verification...



Valid           : true

Nonce Unseen    : true



✓ Authorization accepted.



Second verification...



Valid           : false

Nonce Unseen    : false



✓ Replay detected.



Tutorial completed successfully.

```

\---

\## Verification Lifecycle

```text

Authorization

&#x20;       │

&#x20;       ▼

Verify Signature

&#x20;       │

&#x20;       ▼

Verify Expiration

&#x20;       │

&#x20;       ▼

Verify TTL

&#x20;       │

&#x20;       ▼

Consume Nonce

&#x20;       │

&#x20;       ▼

Execute

```

The nonce is consumed only after every other verification succeeds.

This prevents invalid or forged authorizations from exhausting nonce values.

\---

\## Development vs Production

This tutorial uses:

```text

MemoryNonceStore

```

The in-memory implementation is intended only for examples and local development.

Production deployments should use a persistent implementation backed by Redis, a database, or another durable store so replay protection survives process restarts.

\---

\## Running the Example

```bash

tsx examples/tutorials/28-envelope-replay-detection/run.ts

```

or

```bash

npm run examples

```

\---

\## Next Tutorial

\*\*Tutorial 29 — Authorization Tampering\*\*

The next tutorial demonstrates how modifying any field of a signed Execution Authorization causes signature verification to fail.

\---

\## Summary

In this tutorial you learned:

\- Replay attacks are detected independently of signature verification.

\- Every authorization nonce can be accepted only once.

\- EnvelopeVerifier combines cryptographic verification with replay protection.

\- NonceStore provides the foundation for secure execution authorization.
