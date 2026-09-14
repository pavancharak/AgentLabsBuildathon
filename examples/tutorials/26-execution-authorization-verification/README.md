\# Tutorial 26 — Execution Authorization Verification

\## Overview

In Tutorial 25, the Runtime generated a signed Execution Authorization after successfully evaluating a Business Transaction.

This tutorial demonstrates how an enterprise system independently verifies that authorization before allowing execution.

Verification proves that:

\- The authorization was issued by Parmana.

\- The authorization has not been modified.

\- The authorization format is supported.

\- The authorization has not expired.

Only verified authorizations should be trusted to cross the execution boundary.

\---

\## Execution Flow

```

Business Transaction

&#x20;       │

&#x20;       ▼

Parmana Runtime

&#x20;       │

&#x20;       ▼

Signed Execution Authorization

&#x20;       │

&#x20;       ▼

AuthorizationVerifier

&#x20;       │

&#x20;       ▼

✓ VALID

&#x20;       │

&#x20;       ▼

Enterprise Execution

```

\---

\## Building the Runtime

The Runtime produces a signed Execution Authorization.

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

\## Executing the Transaction

```ts

const { context } =

&#x20; await runtime.execute(transaction);

```

The Runtime Context contains the generated authorization.

```ts

const authorization =

&#x20; context.authorization;

```

\---

\## Loading the Public Key

The Runtime signs using Parmana's private key.

Verification uses the corresponding public key.

```ts

const keyProvider =

&#x20; new FileKeyProvider();



const publicKey =

&#x20; await keyProvider.getPublicKey(

&#x20;   authorization.keyId,

&#x20; );

```

\---

\## Verifying the Authorization

```ts

const verifier =

&#x20; new AuthorizationVerifier(

&#x20;   CryptoBootstrap.create(),

&#x20; );



const result =

&#x20; await verifier.verify(

&#x20;   authorization,

&#x20;   publicKey,

&#x20; );

```

The verifier performs multiple independent checks.

\---

\## Verification Checks

The verification result contains:

| Check | Purpose |

|-------|---------|

| `versionSupported` | Payload version is recognized |

| `signatureVerified` | Digital signature is valid |

| `notExpired` | Authorization is still valid |

| `valid` | Overall verification result |

Every check is reported independently to simplify troubleshooting.

\---

\## Expected Output

```text

==================================================

Tutorial 26 - Execution Authorization Verification

==================================================



Executing transaction...



✓ Execution Authorization generated.



Verifying authorization...



Valid               : true

Version Supported   : true

Signature Verified  : true

Not Expired         : true



✓ Execution Authorization verified.



Tutorial completed successfully.

```

\---

\## Why Verification Matters

Execution Authorization should never be trusted simply because it was received.

The receiving system must independently verify:

\- Signature authenticity

\- Payload integrity

\- Authorization validity

\- Supported payload version

This prevents forged or modified authorizations from reaching enterprise systems.

\---

\## Running the Example

```bash

tsx examples/tutorials/26-execution-authorization-verification/run.ts

```

or

```bash

npm run examples

```

\---

\## Next Tutorial

\*\*Tutorial 27 — Authorization Expiration\*\*

The next tutorial demonstrates how expired Execution Authorizations are rejected even when their signatures remain valid.

\---

\## Summary

In this tutorial you learned how to:

\- Retrieve the Runtime-generated Execution Authorization.

\- Load Parmana's public key.

\- Verify the authorization independently.

\- Interpret the verification checks.

\- Allow execution only after successful verification.

Execution Authorization verification is the first step in protecting the execution boundary between AI systems and enterprise applications.
