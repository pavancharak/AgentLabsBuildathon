# Parmana TypeScript SDK

The official TypeScript SDK for **Parmana**.

Parmana ensures that only Parmana-approved actions are executed.

Parmana is an **Execution Trust Infrastructure** for AI systems.

It ensures that autonomous systems execute **only policy-compliant actions** and produces cryptographically verifiable evidence for every execution.

---

# Why Parmana?

Modern AI systems can make decisions autonomously, but organizations need assurance that those decisions comply with business policies before execution.

Parmana provides that assurance.

Using Parmana, organizations can:

- Execute only policy-compliant actions
- Produce verifiable execution evidence
- Build an auditable authorization-to-execution trust chain
- Independently verify every execution
- Support governance and regulatory compliance

---

# Core Principle

Parmana does not execute business actions.

Parmana authorizes execution.

Only Parmana-approved actions are executed.

---

# Architecture

```
Application
      │
      ▼
Parmana TypeScript SDK
      │
      ▼
Parmana Runtime
      │
      ▼
Execution Trust Infrastructure
      │
      ▼
Execution Trust Record
      │
      ▼
Independent Verification
```

---

# Installation

```bash
npm install @parmana/typescript-sdk
```

---

# Quick Start

```typescript
import { ParmanaClient, HttpTransport } from "@parmana/typescript-sdk";

const client = new ParmanaClient({
  endpoint: "https://runtime.example.com",

  transport: new HttpTransport({
    endpoint: "https://runtime.example.com",
  }),
});
```

---

# Runtime Health

```typescript
const health = await client.health();
```

---

# Execute

```typescript
const trustRecord = await client.execute(transaction);
```

The Runtime:

1. Loads the requested policy.
2. Evaluates policy deterministically.
3. Produces a Decision.
4. Enforces execution approval.
5. Executes the Runtime Pipeline.
6. Produces an Execution Trust Record.

---

# Verify

```typescript
const verification = await client.getLatestVerification(
  trustRecord.businessTransactionId,
);
```

Verification independently validates the Execution Trust Record.

---

# Replay

```typescript
const replay = await client.replay(trustRecord.businessTransactionId);
```

Replay deterministically re-executes the recorded execution.

---

# Validate Policy

```typescript
const result = await client.validatePolicy(policy);
```

Policy validation checks that a policy is structurally valid before deployment.

---

# SDK Architecture

```
ParmanaClient
│
├── HealthApi
├── ExecutionApi
├── VerificationApi
├── ReplayApi
├── ReceiptApi
├── TransactionApi
├── TrustRecordApi
└── PolicyApi
```

The client is intentionally small.

Each API encapsulates a single Parmana capability.

---

# Canonical Domain Model

The SDK re-exports the canonical Parmana domain model from `@parmana/shared`.

Core artifacts include:

- Authority
- Authorization
- Intent
- PolicyReference
- BusinessTransaction
- Decision
- Execution
- ExecutionEvidence
- ExecutionTrustRecord
- Verification
- Receipt
- Override

The SDK does not redefine these models.

---

# Error Handling

All SDK exceptions inherit from:

```typescript
ParmanaError;
```

Common errors include:

- ConfigurationError
- ValidationError
- ExecutionRejectedError
- VerificationError
- ReplayError
- NetworkError
- TimeoutError
- InternalServerError

---

# Configuration

```typescript
const configuration = {
    endpoint: "...",
    transport: ...,
};
```

The SDK configuration controls communication with the Parmana Runtime.

It does not control policy evaluation or runtime behavior.

No route in the Parmana API enforces authentication or authorization today; every request is accepted from any caller who can reach the port (see docs/CLAIMS.md, "API-layer authentication and authorization"). The SDK configuration has no credentials field for that reason — do not build a client that assumes one.

---

# Examples

See the `examples/` directory.

- Runtime Health
- Execute
- Verify
- Replay
- Policy Validation

---

# Documentation

The complete SDK documentation is available in:

```
docs/sdk/
```

Including:

- SDK Architecture
- SDK Specification
- Error Model
- Configuration
- Versioning
- Conformance

---

# License

Apache License 2.0

---

# About Parmana

Parmana is an Execution Trust Infrastructure for autonomous and AI systems.

It establishes a cryptographically verifiable trust chain linking:

Authority → Authorization → Intent → Policy → Decision → Execution → Evidence → Verification

This enables organizations to confidently deploy AI in high-impact workflows while maintaining governance, auditability, and independent verification.
