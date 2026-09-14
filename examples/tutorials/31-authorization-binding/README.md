\# Tutorial 31 — Authorization Binding

\## Overview

In previous tutorials we verified that an Execution Authorization was:

\- correctly signed

\- not expired

\- not replayed

This tutorial demonstrates another critical security property:

> \*\*An Execution Authorization is cryptographically bound to the exact executable request that Parmana approved.\*\*

A valid authorization cannot be reused for another payment, invoice, vendor, or business transaction.

\---

\## Execution Flow

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Executable Content

&#x20;       │

&#x20;       ▼

ExecutableContentHasher

&#x20;       │

&#x20;       ▼

businessTransactionHash

&#x20;       │

&#x20;       ▼

Execution Authorization

&#x20;       │

&#x20;       ▼

Enterprise Execution

&#x20;       │

&#x20;       ▼

Recompute Hash

&#x20;       │

&#x20;       ▼

Match?

&#x20;       │

&#x20;     ┌─┴────────────┐

&#x20;     │              │

&#x20;    YES            NO

&#x20;     │              │

&#x20;     ▼              ▼

&#x20;Execute      Reject Execution

```

\---

\## Why Authorization Binding Exists

Suppose Parmana approved:

```text

Vendor A



Invoice INV-1001



Amount $25,000

```

An attacker must never be able to reuse that authorization for:

```text

Vendor A



Invoice INV-1001



Amount $50,000

```

Although the authorization itself is genuine, it is bound to the original executable content.

Changing any execution parameter changes the executable content hash.

\---

\## Executable Content

The Runtime computes a deterministic hash of the executable request.

```ts

const hash =

&#x20; await hasher.hash(

&#x20;   executableContent,

&#x20; );

```

That hash is embedded inside the signed Execution Authorization.

\---

\## Verification

Before execution, the enterprise system recomputes the executable content hash.

```ts

const computedHash =

&#x20; await hasher.hash(

&#x20;   modifiedContent,

&#x20; );

```

It compares that value against:

```ts
authorization.payload.businessTransactionHash;
```

If the hashes differ, execution is rejected.

\---

\## Expected Output

```text

==================================================

Tutorial 31 - Authorization Binding

==================================================



Generating authorization...



✓ Authorization generated.



✓ Authorization verified.



Execution Binding Check

\------------------------------



Authorization Hash : ...



Execution Hash     : ...



✓ Execution rejected.



Reason: Authorization is bound to a different executable request.



Tutorial completed successfully.

```

\---

\## Security Guarantees

Authorization Binding prevents:

\- payment amount substitution

\- invoice substitution

\- vendor substitution

\- target system substitution

\- parameter manipulation

The authorization can only be used for the executable content originally approved by Parmana.

\---

\## Cryptographic Layers

Execution security now consists of multiple independent checks.

```text

Signature Verification

&#x20;       │

&#x20;       ▼

Expiration Check

&#x20;       │

&#x20;       ▼

Replay Detection

&#x20;       │

&#x20;       ▼

Policy Version Check

&#x20;       │

&#x20;       ▼

Authorization Binding

&#x20;       │

&#x20;       ▼

Enterprise Execution

```

Every layer must succeed before execution proceeds.

\---

\## Running the Example

```bash

tsx examples/tutorials/31-authorization-binding/run.ts

```

or

```bash

npm run examples

```

\---

\## Next Tutorial

\*\*Tutorial 32 — Multi-Step Execution\*\*

The next tutorial demonstrates how a single Business Transaction can authorize multiple execution steps while preserving verification and auditability.

\---

\## Summary

In this tutorial you learned:

\- Execution Authorizations are bound to executable content.

\- Enterprise systems recompute the executable content hash.

\- Any modification changes the hash.

\- Hash mismatch causes execution to be rejected.

\- Authorization Binding ensures Parmana-approved work cannot be redirected to a different request.
