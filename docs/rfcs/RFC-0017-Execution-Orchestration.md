\# RFC-0017: Execution Orchestration

\*\*Status:\*\* Accepted

\## Purpose

This RFC defines the canonical execution orchestration architecture for the Parmana Runtime.

With the domain model, policy runtime, `DecisionService`, and `ExecutionTrustRecordService` complete, the remaining work is orchestration rather than architectural design.

The ExecutionService becomes the coordinator of the execution pipeline while delegating all specialized work to dedicated runtime services.

\---

\# Phase 1 Status

The following architectural components are complete.

\## Domain Model

\* Authority

\* Authorization

\* Intent

\* BusinessTransaction

\* PolicyReference

\* Policy

\* Decision

\* Execution

\* ExecutionTrustRecord

\* Receipt

\* Verification

\---

\## Policy Runtime

\* PolicyRegistry

\* PolicyRouter

\* PolicyValidator

\* PolicyAdapter

\* SignalValidator

\* PolicyEngine

\---

\## Runtime Services

Implemented:

\* BusinessTransactionService

\* DecisionService

\* ExecutionTrustRecordService

\* OverrideService

\* ReceiptService

\* VerificationService

ExecutionService remains to be aligned with the completed architecture.

\---

\# Canonical Runtime Services

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

Each runtime service owns exactly one responsibility.

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

&#x20;     │

&#x20;     ▼

PolicyValidator

&#x20;     │

&#x20;     ▼

PolicyAdapter

&#x20;     │

&#x20;     ▼

SignalValidator

&#x20;     │

&#x20;     ▼

PolicyEngine

&#x20;     │

&#x20;     ▼

DecisionService

&#x20;     │

&#x20;     ▼

Decision

&#x20;     │

&#x20;     ▼

ExecutionService

&#x20;     │

&#x20;     ▼

Execution

&#x20;     │

&#x20;     ▼

ExecutionTrustRecordService

&#x20;     │

&#x20;     ▼

ExecutionTrustRecord

&#x20;     │

&#x20;     ▼

ReceiptService

&#x20;     │

&#x20;     ▼

Receipt

&#x20;     │

&#x20;     ▼

VerificationService

&#x20;     │

&#x20;     ▼

Verification

```

Execution remains deterministic throughout the pipeline.

\---

\# ExecutionService

The ExecutionService is the runtime orchestrator.

It SHALL coordinate execution without implementing business logic.

ExecutionService SHALL invoke:

\* PolicyRouter

\* PolicyValidator

\* PolicyAdapter

\* SignalValidator

\* PolicyEngine

\* DecisionService

\* ExecutionTrustRecordService

\* ReceiptService

\* VerificationService

ExecutionService SHALL NOT:

\* evaluate policy rules

\* construct Decisions

\* construct ExecutionTrustRecords

\* generate Receipts

\* perform Verification

Those responsibilities belong to dedicated services.

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

| PolicyEngine | Evaluate deterministic rules |

| DecisionService | Construct immutable Decision |

| ExecutionTrustRecordService | Construct immutable ExecutionTrustRecord |

| ReceiptService | Generate cryptographic Receipt |

| VerificationService | Verify execution artifacts |

Each service SHALL own one responsibility only.

\---

\# Architectural Invariants

The runtime SHALL satisfy the following invariants:

1\. ExecutionService SHALL act only as an orchestrator.

2\. Policy evaluation SHALL occur only in the PolicyEngine.

3\. Decision construction SHALL occur only in the DecisionService.

4\. ExecutionTrustRecord construction SHALL occur only in the ExecutionTrustRecordService.

5\. Receipt generation SHALL occur only in the ReceiptService.

6\. Verification SHALL occur only in the VerificationService.

7\. Runtime SHALL remain deterministic.

8\. Runtime SHALL remain domain independent.

9\. Policy artifacts SHALL remain immutable.

10\. Identical validated inputs SHALL produce identical Decisions.

\---

\# Remaining Phase 1 Work

The remaining implementation tasks are:

1\. Refactor ExecutionService into a pure orchestrator.

2\. Align ReceiptService with the ExecutionTrustRecord model.

3\. Align VerificationService with the immutable trust chain.

4\. Complete replay integration.

5\. Complete persistence integration.

6\. Complete end-to-end execution tests.

7\. Validate replay, receipts, verification, and cryptographic integrity.

No further changes to the core domain model or policy execution architecture are required.

\---

\# Phase 1 Milestone

Phase 1 has transitioned from architecture design to implementation.

The canonical:

\* domain model,

\* policy runtime,

\* execution pipeline, and

\* runtime service architecture

are now established.

Future work focuses on integrating these components into a complete execution trust pipeline without changing the architectural foundations defined by the preceding RFCs.

\---

\# Status

This RFC locks the canonical execution orchestration architecture for Parmana Phase 1.

Future implementations SHALL preserve the orchestration model and the single-responsibility design of runtime services.
