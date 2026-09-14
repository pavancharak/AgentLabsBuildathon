\# RFC-0018: Execution Service Orchestration

\*\*Status:\*\* Accepted

\## Purpose

This RFC defines the canonical responsibilities of the `ExecutionService` within the Parmana Runtime.

With the domain model, policy runtime, `DecisionService`, and `ExecutionTrustRecordService` established, the `ExecutionService` becomes the orchestration layer that coordinates execution without containing business logic.

\---

\# Objectives

The `ExecutionService` SHALL:

\* orchestrate the end-to-end execution workflow

\* invoke runtime services in the correct order

\* coordinate artifact creation

\* manage execution lifecycle

\* terminate execution on unrecoverable validation failures

The `ExecutionService` SHALL NOT:

\* evaluate policy rules

\* construct Decisions

\* construct ExecutionTrustRecords

\* generate Receipts

\* perform Verification

\* contain business-specific logic

\---

\# Current Runtime Services

```text

packages/runtime/src/services/

│

├── business-transaction-service.ts

├── decision-service.ts

├── execution-service.ts

├── execution-trust-record-service.ts

├── override-service.ts

├── receipt-service.ts

└── verification-service.ts

```

\---

\# Canonical Execution Pipeline

```text

Authority

&#x20;     │

&#x20;     ▼

Authorization

&#x20;     │

&#x20;     ▼

Intent

&#x20;     │

&#x20;     ▼

BusinessTransaction

&#x20;     │

&#x20;     ▼

PolicyReference

&#x20;     │

&#x20;     ▼

PolicyRegistry

&#x20;     │

&#x20;     ▼

PolicyRouter

(load)

&#x20;     │

&#x20;     ▼

PolicyValidator

(validate)

&#x20;     │

&#x20;     ▼

PolicyAdapter

(RuntimeTransaction → PolicySignals)

&#x20;     │

&#x20;     ▼

SignalValidator

(validate)

&#x20;     │

&#x20;     ▼

PolicyEngine

(evaluate)

&#x20;     │

&#x20;     ▼

DecisionService

(build Decision)

&#x20;     │

&#x20;     ▼

Decision

&#x20;     │

&#x20;     ▼

ExecutionService

(orchestrate)

&#x20;     │

&#x20;     ▼

Execution

&#x20;     │

&#x20;     ▼

ExecutionTrustRecordService

(build ExecutionTrustRecord)

&#x20;     │

&#x20;     ▼

ExecutionTrustRecord

&#x20;     │

&#x20;     ▼

ReceiptService

(generate Receipt)

&#x20;     │

&#x20;     ▼

Receipt

&#x20;     │

&#x20;     ▼

VerificationService

(verify)

&#x20;     │

&#x20;     ▼

Verification

```

\---

\# ExecutionService Responsibilities

The `ExecutionService` SHALL orchestrate the following components:

```text

ExecutionService

&#x20;     │

&#x20;     ├── PolicyRouter

&#x20;     ├── PolicyValidator

&#x20;     ├── PolicyAdapter

&#x20;     ├── SignalValidator

&#x20;     ├── PolicyEngine

&#x20;     ├── DecisionService

&#x20;     ├── ExecutionTrustRecordService

&#x20;     ├── ReceiptService

&#x20;     └── VerificationService

```

The `ExecutionService` SHALL coordinate these components but SHALL NOT implement their internal responsibilities.

\---

\# Runtime Service Responsibilities

| Service | Responsibility |

| --------------------------- | --------------------------------------------- |

| BusinessTransactionService | Construct BusinessTransaction |

| ExecutionService | Orchestrate execution workflow |

| PolicyRouter | Load policy artifact |

| PolicyValidator | Validate policy artifact |

| PolicyAdapter | Convert RuntimeTransaction into PolicySignals |

| SignalValidator | Validate runtime signals |

| PolicyEngine | Evaluate deterministic policy rules |

| DecisionService | Construct immutable Decision |

| ExecutionTrustRecordService | Construct immutable ExecutionTrustRecord |

| ReceiptService | Generate cryptographic Receipt |

| VerificationService | Verify execution artifacts |

Every runtime service SHALL own exactly one responsibility.

\---

\# Execution Flow

The `ExecutionService` SHALL execute the following sequence:

1\. Receive a validated `BusinessTransaction`.

2\. Resolve the referenced policy.

3\. Load the policy artifact.

4\. Validate the policy artifact.

5\. Convert the runtime transaction into `PolicySignals`.

6\. Validate the runtime signals.

7\. Evaluate the policy.

8\. Construct the immutable `Decision`.

9\. Create the `Execution`.

10\. Construct the immutable `ExecutionTrustRecord`.

11\. Generate the cryptographic `Receipt`.

12\. Perform verification.

13\. Return the completed execution result.

Execution SHALL terminate immediately if any mandatory validation step fails.

\---

\# Architectural Invariants

The runtime SHALL satisfy the following invariants:

1\. `ExecutionService` SHALL act only as an orchestrator.

2\. Policy evaluation SHALL occur only in the `PolicyEngine`.

3\. Decision construction SHALL occur only in the `DecisionService`.

4\. ExecutionTrustRecord construction SHALL occur only in the `ExecutionTrustRecordService`.

5\. Receipt generation SHALL occur only in the `ReceiptService`.

6\. Verification SHALL occur only in the `VerificationService`.

7\. Runtime SHALL remain deterministic.

8\. Runtime SHALL remain domain independent.

9\. Business logic SHALL reside exclusively in policy artifacts.

10\. Identical validated inputs SHALL produce identical Decisions.

\---

\# Remaining Phase 1 Implementation

The remaining implementation work SHALL proceed in the following order:

1\. Refactor `ExecutionService` into a pure orchestrator.

2\. Refactor `ReceiptService` to operate on `ExecutionTrustRecord`.

3\. Refactor `VerificationService` to verify immutable execution artifacts.

4\. Complete replay integration.

5\. Complete persistence integration.

6\. Complete end-to-end integration tests.

7\. Validate persistence, replay, receipt generation, cryptographic integrity, and verification.

\---

\# Phase 1 Milestone

With the implementation of:

\* DecisionService

\* ExecutionTrustRecordService

the project has transitioned from architectural definition to execution pipeline integration.

The remaining work focuses on wiring the existing components into a complete, deterministic execution workflow without changing the established architecture.

\---

\# Status

This RFC locks the orchestration responsibilities of the `ExecutionService` for Parmana Phase 1.

Future implementations SHALL preserve the orchestration model and the single-responsibility design established by the runtime service architecture.
