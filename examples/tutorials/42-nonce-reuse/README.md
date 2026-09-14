\# Tutorial 42 — Nonce Reuse

\## Overview

Every Execution Authorization contains a unique \*\*nonce\*\*.

The nonce ensures that an authorization can be accepted \*\*only once\*\*.

Even if the authorization is still valid and its signature is correct, the gateway rejects any attempt to reuse the same nonce.

\---

\## Attack Scenario

```text

Execution Authorization



Nonce = abc123



&#x20;       │

&#x20;       ▼



Execution Gateway



&#x20;       │

&#x20;       ▼



✓ Accepted



──────────────────────────────



Same Authorization



Nonce = abc123



&#x20;       │

&#x20;       ▼



Execution Gateway



&#x20;       │

&#x20;       ▼



Nonce Store



&#x20;       │

&#x20;       ▼



✗ Nonce Already Used



&#x20;       │

&#x20;       ▼



Execution Rejected

```

\---

\## Why Nonces Exist

A digital signature proves authenticity.

A nonce proves uniqueness.

Both are required.

Without nonce validation, a valid authorization could be executed repeatedly until it expires.

\---

\## First Verification

```text

Nonce



abc123



↓



Not Seen



↓



Stored



↓



Accepted

```

\---

\## Second Verification

```text

Nonce



abc123



↓



Already Recorded



↓



Rejected

```

\---

\## Expected Output

```text

==================================================

Tutorial 42 - Nonce Reuse

==================================================



First Verification

\--------------------------------------------------



Accepted     : true

Nonce Unseen : true



Second Verification

\--------------------------------------------------



Accepted     : false

Nonce Unseen : false



✓ Nonce reuse detected.



Execution rejected.



Tutorial completed successfully.

```

\---

\## Gateway Logic

```text

Receive Authorization

&#x20;       │

&#x20;       ▼

Verify Signature

&#x20;       │

&#x20;       ▼

Verify Expiration

&#x20;       │

&#x20;       ▼

Check Nonce

&#x20;       │

&#x20;       ├── New

&#x20;       │      │

&#x20;       │      ▼

&#x20;       │   Record Nonce

&#x20;       │      │

&#x20;       │      ▼

&#x20;       │   Execute

&#x20;       │

&#x20;       └── Already Seen

&#x20;              │

&#x20;              ▼

&#x20;         Reject Request

```

\---

\## Why This Matters

Nonce reuse protection prevents:

\- duplicate payments

\- repeated purchase orders

\- repeated vendor creation

\- replayed API requests

\- duplicate workflow execution

\---

\## Running the Example

```bash

tsx examples/tutorials/42-nonce-reuse/run.ts

```

or

```bash

npm run examples

```

\---

\## Next Tutorial

\*\*Tutorial 43 — Stolen Authorization\*\*

The next tutorial demonstrates that simply stealing a valid Execution Authorization is not enough to execute a different business request.

\---

\## Summary

In this tutorial you learned:

\- Every Execution Authorization contains a unique nonce.

\- The gateway records accepted nonces.

\- A nonce can only be accepted once.

\- Nonce reuse is rejected before enterprise execution.
