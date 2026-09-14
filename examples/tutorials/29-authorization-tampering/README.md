\# Tutorial 29 — Authorization Tampering

\## Overview

In the previous tutorials we learned how Parmana generates, verifies, and protects Execution Authorizations from replay.

This tutorial demonstrates another important security property:

> \*\*A signed Execution Authorization cannot be modified.\*\*

Changing even a single field invalidates the cryptographic signature.

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

Modify Payload

&#x20;       │

&#x20;       ▼

AuthorizationVerifier

&#x20;       │

&#x20;       ▼

✗ Signature Verification Failed

```

\---

\## Why Tamper Detection Matters

An attacker must never be able to modify:

\- Policy Version

\- Decision ID

\- Business Transaction ID

\- Expiration Time

\- Executable Content Hash

without detection.

Because the digital signature covers the complete authorization payload, any modification immediately invalidates the signature.

\---

\## Generating the Authorization

```ts

const { context } =

&#x20; await runtime.execute(transaction);



const authorization =

&#x20; context.authorization!;

```

\---

\## Tampering With the Payload

For demonstration purposes we modify the policy version after signing.

```ts

const tampered = {

&#x20; ...authorization,

&#x20; payload: {

&#x20;   ...authorization.payload,

&#x20;   policyVersion: "2.0.1",

&#x20; },

};

```

The signature is \*\*not regenerated\*\*.

\---

\## Verifying the Tampered Authorization

```ts

const result =

&#x20; await verifier.verify(

&#x20;   tampered,

&#x20;   publicKey,

&#x20; );

```

The verifier recomputes the canonical payload and compares it against the signed payload.

Because they no longer match, signature verification fails.

\---

\## Expected Output

```text

==================================================

Tutorial 29 - Authorization Tampering

==================================================



Generating authorization...



✓ Authorization generated.



Authorization payload modified.



Verifying tampered authorization...



Valid               : false

Version Supported   : true

Signature Verified  : false

Not Expired         : true



✓ Tampering detected.



Tutorial completed successfully.

```

\---

\## Why Signature Verification Failed

Originally the authorization contained:

```text

Policy Version



2.0.0

```

After modification:

```text

Policy Version



2.0.1

```

Although only one value changed, the payload hash changed.

Since the signature was generated from the original payload, verification fails.

\---

\## Security Guarantees

Execution Authorization protects against unauthorized modification of:

\- Decision identifiers

\- Policy information

\- Business transaction identifiers

\- Authorization lifetime

\- Executable content

This guarantees that enterprise systems execute exactly what Parmana authorized.

\---

\## Running the Example

```bash

tsx examples/tutorials/29-authorization-tampering/run.ts

```

or

```bash

npm run examples

```

\---

\## Next Tutorial

\*\*Tutorial 30 — Policy Version Pinning\*\*

The next tutorial demonstrates why enterprise systems must reject Execution Authorizations that reference an unexpected policy version, even when the authorization itself is otherwise valid.

\---

\## Summary

In this tutorial you learned:

\- Execution Authorizations are immutable.

\- Digital signatures protect the complete authorization payload.

\- Modifying even a single field invalidates the signature.

\- Tampering is detected before enterprise execution begins.
