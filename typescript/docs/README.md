\# Parmana TypeScript SDK

\## Overview

The Parmana TypeScript SDK enables JavaScript and TypeScript applications to interact with the Parmana Runtime.

Parmana is an \*\*Execution Trust Infrastructure\*\* that ensures AI systems execute only authorized business transactions under explicitly defined governance policies. Every execution produces an immutable trust chain that can be replayed, verified, and independently audited.

The SDK provides strongly typed domain models, a high-level client, and helper APIs for execution, verification, and replay.

\---

\# What is Parmana?

Modern AI systems make decisions that increasingly affect business operations, financial transactions, healthcare, autonomous systems, and critical infrastructure.

Organizations require more than accurate AI models—they require confidence that AI systems execute only what has been authorized and approved.

Parmana provides this confidence through a deterministic execution trust architecture.

Every governed execution records:

\* Authority

\* Authorization

\* Intent

\* Policy Reference

\* Decision

\* Execution

\* Execution Evidence

\* Verification

\* Receipt

\* Execution Trust Record

These artifacts collectively form the \*\*Execution Trust Chain\*\*.

\---

\# Features

The TypeScript SDK provides:

\* Strongly typed domain models

\* High-level `ParmanaClient`

\* Business Transaction execution

\* Execution Trust Record verification

\* Deterministic replay

\* TypeScript-first developer experience

\* Promise-based asynchronous API

\* Support for Node.js and modern TypeScript applications

\---

\# Installation

Using npm:

```bash

npm install @parmana/typescript-sdk

```

Using pnpm:

```bash

pnpm add @parmana/typescript-sdk

```

Using yarn:

```bash

yarn add @parmana/typescript-sdk

```

\---

\# Requirements

\* Node.js 22+

\* TypeScript 5.9+

\* Parmana Runtime

\---

\# Quick Start

```typescript

import {

&#x20; ParmanaClient,

} from "@parmana/typescript-sdk";



const client = new ParmanaClient({

&#x20; endpoint: "http://localhost:8080",

});



const receipt = await client.execute(transaction);



console.log(receipt.receiptId);

```

\---

\# SDK Structure

```text

typescript/

├── src/

│   ├── client.ts

│   ├── http.ts

│   ├── replay.ts

│   ├── verification.ts

│   ├── errors.ts

│   └── types/

├── examples/

├── docs/

└── test/

```

\---

\# Domain Model

The SDK mirrors the Parmana Trust Core.

\## Authority

Defines who owns the business authority.

\---

\## Authorization

Defines who or what may execute.

\---

\## Intent

Defines the requested business operation.

\---

\## PolicyReference

Identifies the exact governance policy.

\---

\## BusinessTransaction

The immutable business request submitted to Parmana.

\---

\## Decision

Records deterministic policy evaluation.

\---

\## Execution

Records what actually happened.

\---

\## Verification

Records independent verification.

\---

\## Receipt

Cryptographic proof of execution.

\---

\## ExecutionTrustRecord

Canonical immutable record representing the complete execution trust chain.

\---

\# ParmanaClient

The SDK revolves around `ParmanaClient`.

```typescript

const client = new ParmanaClient({

&#x20; endpoint: "http://localhost:8080",

});

```

The client exposes:

```typescript
await client.execute(transaction);

await client.verify(trustRecord);

await client.replay(trustRecord);

await client.health();

await client.version();
```

\---

\# Architecture

```text

Application

&#x20;     │

&#x20;     ▼

ParmanaClient

&#x20;     │

&#x20;     ▼

HTTP Client

&#x20;     │

&#x20;     ▼

Parmana Runtime

&#x20;     │

&#x20;     ▼

Execution Trust Infrastructure

```

The SDK is intentionally lightweight. Business governance remains inside the Parmana Runtime.

\---

\# Examples

The SDK includes ten complete examples.

| Example | Description |

| ------- | --------------------- |

| 01 | Basic execution |

| 02 | Verify receipt |

| 03 | Replay execution |

| 04 | Audit trust chain |

| 05 | Human-in-the-loop |

| 06 | Autonomous vehicle |

| 07 | Medical AI |

| 08 | Financial transaction |

| 09 | Multi-agent workflow |

| 10 | Custom policy |

\---

\# Documentation

Each example has a corresponding guide.

```text

docs/

README.md

01\_basic\_execution.md

02\_verify\_receipt.md

03\_replay\_execution.md

04\_audit\_trust\_chain.md

05\_human\_in\_the\_loop.md

06\_autonomous\_vehicle.md

07\_medical\_ai.md

08\_financial\_transaction.md

09\_multi\_agent.md

10\_custom\_policy.md

```

\---

\# Design Principles

The TypeScript SDK follows the same architectural principles as the Parmana Runtime:

\* Explicit policy selection

\* Deterministic execution

\* Immutable trust artifacts

\* Independent verification

\* Replayable execution

\* Strong typing

\* Minimal client API

\---

\# Relationship to the Runtime

The SDK is \*\*not\*\* the Runtime.

The Runtime:

\* Evaluates policies

\* Produces decisions

\* Records execution

\* Generates receipts

\* Produces verification artifacts

The SDK simply provides a convenient, type-safe interface for interacting with those capabilities.

\---

\# Development Status

Current SDK capabilities include:

\* Typed domain models

\* HTTP client

\* Execution API

\* Verification API

\* Replay API

\* Complete example applications

\* Comprehensive documentation

Future releases will expand support for authentication, streaming APIs, advanced runtime features, and additional developer tooling.

\---

\# Next Steps

Begin with:

```text

docs/01\_basic\_execution.md

```

to learn how to construct a `BusinessTransaction`, submit it to the Parmana Runtime, and understand the resulting execution trust chain.

\---

\# License

Apache License 2.0

\---

\# Learn More

The remaining documentation explores replay, verification, auditing, human oversight, autonomous systems, healthcare, financial governance, multi-agent coordination, and deterministic policy selection using the TypeScript SDK.
