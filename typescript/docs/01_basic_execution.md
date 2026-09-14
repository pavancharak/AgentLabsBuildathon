\# Example 01 — Basic Execution

\## Overview

This example demonstrates the simplest end-to-end interaction with the Parmana Runtime using the TypeScript SDK.

By the end of this guide you will understand:

\* Creating the core trust-chain objects

\* Constructing a `BusinessTransaction`

\* Executing the transaction

\* Receiving an execution receipt

\* Understanding the resulting Execution Trust Chain

This example is the foundation for every subsequent example in the SDK.

\---

\# Learning Objectives

After completing this example you will understand:

\* Authority

\* Authorization

\* Intent

\* PolicyReference

\* BusinessTransaction

\* Receipt

\* ParmanaClient

Later examples build upon these concepts.

\---

\# Prerequisites

\* Node.js 22+

\* TypeScript SDK installed

\* Parmana Runtime running locally

```bash

npm install @parmana/typescript-sdk

```

\---

\# The Execution Trust Chain

Every execution begins with a Business Transaction.

```text

Authority

&#x20;     │

Authorization

&#x20;     │

Intent

&#x20;     │

PolicyReference

&#x20;     │

BusinessTransaction

&#x20;     │

Parmana Runtime

&#x20;     │

Decision

&#x20;     │

Execution

&#x20;     │

Receipt

```

This sequence is deterministic.

Every artifact becomes part of the trust chain.

\---

\# Step 1 — Create the Client

```typescript

import { ParmanaClient } from "@parmana/typescript-sdk";



const client = new ParmanaClient({

&#x20;   endpoint: "http://localhost:8080"

});

```

The client communicates with the Parmana Runtime.

\---

\# Step 2 — Create an Authority

Authority represents the business authority responsible for the transaction.

```typescript

const authority = {

&#x20;   authorityId: "authority-001",

&#x20;   authorityName: "Acme Corporation",

&#x20;   createdAt: new Date()

};

```

Authority defines \*\*who owns the decision-making authority\*\*.

\---

\# Step 3 — Create an Authorization

Authorization grants permission to execute.

```typescript

const authorization = {

&#x20;   authorizationId: "authorization-001",

&#x20;   authorityId: authority.authorityId,

&#x20;   subject: "warehouse-robot-01",

&#x20;   permissions: \[

&#x20;       "MOVE\_PALLET"

&#x20;   ],

&#x20;   issuedAt: new Date(),

&#x20;   expiresAt: new Date(Date.now() + 86400000)

};

```

Authorization answers:

> Who is allowed to execute?

\---

\# Step 4 — Create an Intent

Intent describes the requested business operation.

```typescript

const intent = {

&#x20;   intentId: "intent-001",

&#x20;   authorizationId: authorization.authorizationId,

&#x20;   operation: "MOVE\_PALLET",

&#x20;   target: "Loading Bay 3",

&#x20;   createdAt: new Date()

};

```

Intent answers:

> What should happen?

\---

\# Step 5 — Select a Policy

Every Business Transaction specifies exactly one policy.

```typescript

const policy = {

&#x20;   policyName: "warehouse-policy",

&#x20;   policyVersion: "1.0.0"

};

```

This explicit policy reference becomes part of the immutable trust chain.

The Runtime never searches for policies.

\---

\# Step 6 — Build the Business Transaction

```typescript

const transaction = {

&#x20;   businessTransactionId: "txn-001",

&#x20;   authority,

&#x20;   authorization,

&#x20;   intent,

&#x20;   policy,

&#x20;   createdAt: new Date()

};

```

This object becomes the canonical request submitted to Parmana.

\---

\# Step 7 — Execute

```typescript

const receipt =

&#x20;   await client.execute(transaction);

```

The Runtime performs:

1\. Trust validation

2\. Policy evaluation

3\. Decision creation

4\. Execution recording

5\. Receipt generation

\---

\# Receipt

The returned Receipt contains:

```typescript
console.log(receipt.receiptId);

console.log(receipt.receiptHash);

console.log(receipt.algorithm);
```

Example:

```text

Receipt ID



receipt-001



Algorithm



Ed25519



Issued



2026-06-29T12:45:16Z

```

\---

\# What Happened Internally?

Although the SDK exposes a single method:

```typescript
await client.execute(transaction);
```

The Runtime performs multiple deterministic operations.

```text

Business Transaction

&#x20;       │

Validate

&#x20;       │

Load Policy

&#x20;       │

Evaluate

&#x20;       │

Create Decision

&#x20;       │

Execute

&#x20;       │

Collect Evidence

&#x20;       │

Generate Receipt

```

\---

\# Why Use a Business Transaction?

Instead of sending loose parameters, Parmana requires a structured Business Transaction.

Advantages:

\* Explicit authority

\* Explicit authorization

\* Explicit intent

\* Explicit policy

\* Deterministic replay

\* Independent verification

\---

\# Error Handling

Always wrap execution in a try/catch block.

```typescript

try {



&#x20;   const receipt =

&#x20;       await client.execute(transaction);



}

catch(error){



&#x20;   console.error(error);



}

```

Production applications should log failures and handle retries according to their operational requirements.

\---

\# Architectural Principles

This example demonstrates several core Parmana principles.

\## Explicit Authority

Authority is always identified.

\---

\## Explicit Authorization

Execution permission is explicit.

\---

\## Explicit Intent

Intent is immutable.

\---

\## Explicit Policy

Exactly one PolicyReference is provided.

\---

\## Deterministic Runtime

The Runtime evaluates the supplied policy.

It does not discover or choose one automatically.

\---

\# Relationship to Later Examples

This example introduces the minimal trust chain.

Subsequent examples extend it:

| Example | Adds |

| ------- | ---------------------- |

| 02 | Verification |

| 03 | Replay |

| 04 | Audit |

| 05 | Human Override |

| 06 | Autonomous Vehicle |

| 07 | Medical AI |

| 08 | Financial Governance |

| 09 | Multi-Agent Systems |

| 10 | Custom Policy Versions |

\---

\# Complete Example

See:

```text

examples/01\_basic\_execution.ts

```

\---

\# Summary

You have learned how to:

\* Create an Authority

\* Create an Authorization

\* Define an Intent

\* Select a PolicyReference

\* Construct a BusinessTransaction

\* Execute the transaction

\* Receive a Receipt

These concepts form the foundation of every workflow built with Parmana.

\---

\# Next

Continue with:

```text

docs/02\_verify\_receipt.md

```

to learn how to independently verify an execution using the TypeScript SDK.
