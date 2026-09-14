\# RFC-0016: Runtime Service Architecture

\*\*Status:\*\* Accepted

\## Purpose

This RFC defines the canonical runtime service architecture for Parmana.

Phase 1 established the canonical domain model and deterministic policy execution pipeline.

This RFC defines how runtime services collaborate to execute that architecture while maintaining strict separation of responsibilities.

\---

\# Objectives

The runtime service architecture SHALL:

\* separate orchestration from business logic

\* isolate policy evaluation from decision construction

\* isolate execution from persistence

\* preserve deterministic execution

\* produce immutable execution artifacts

\* maintain a single responsibility for every runtime service

\---

\# Runtime Service Pipeline

```text

BusinessTransaction

&#x20;       │

&#x20;       ▼

ExecutionService

(orchestrator)

&#x20;       │

&#x20;       ├────────► PolicyRouter

&#x20;       │

&#x20;       ├────────► PolicyValidator

&#x20;       │

&#x20;       ├────────► PolicyAdapter

&#x20;       │

&#x20;       ├────────► SignalValidator

&#x20;       │

&#x20;       ├────────► PolicyEngine

&#x20;       │

&#x20;       ├────────► DecisionService

&#x20;       │

&#x20;       ├────────► ExecutionTrustRecordService

&#x20;       │

&#x20;       ├────────► ReceiptService

&#x20;       │

&#x20;       └────────► VerificationService

```

The ExecutionService coordinates the workflow.

It does not contain business logic.

\---

\# Runtime Services

\## BusinessTransactionService

Responsibilities:

\* construct BusinessTransaction

\* validate transaction structure

\* initialize execution request

\---

\## ExecutionService

Responsibilities:

\* coordinate execution workflow

\* invoke runtime services

\* manage execution lifecycle

The ExecutionService SHALL NOT:

\* evaluate policy rules

\* construct Decisions

\* generate Receipts

\* verify execution

\---

\## PolicyRouter

Responsibilities:

\* locate policy artifact

\* load one policy

\---

\## PolicyValidator

Responsibilities:

\* validate policy artifact

\* validate policy identity

\* validate schema version

\---

\## PolicyAdapter

Responsibilities:

Convert RuntimeTransaction into PolicySignals.

\---

\## SignalValidator

Responsibilities:

Validate PolicySignals against the policy's declared signalsSchema.

\---

\## PolicyEngine

Responsibilities:

Evaluate deterministic policy rules.

The PolicyEngine SHALL NOT construct Decisions.

\---

\## DecisionService

Responsibilities:

Construct immutable Decision artifacts.

The DecisionService SHALL:

\* generate decisionId

\* bind PolicyReference

\* bind PolicySignals

\* record outcome

\* record reason

\* record timestamp

\---

\## ExecutionTrustRecordService

Responsibilities:

Construct immutable ExecutionTrustRecord aggregates.

The service SHALL:

\* initialize execution history

\* initialize receipt history

\* initialize verification history

\* initialize override history

\* compute initial trustRecordHash

\---

\## ReceiptService

Responsibilities:

Generate immutable cryptographic Receipts.

\---

\## VerificationService

Responsibilities:

Perform independent verification of execution artifacts.

\---

\# Service Responsibilities

| Service | Responsibility |

| --------------------------- | --------------------------------------------- |

| BusinessTransactionService | Create BusinessTransaction |

| ExecutionService | Orchestrate runtime execution |

| PolicyRouter | Load policy artifact |

| PolicyValidator | Validate policy artifact |

| PolicyAdapter | Convert RuntimeTransaction into PolicySignals |

| SignalValidator | Validate runtime signals |

| PolicyEngine | Evaluate policy |

| DecisionService | Build Decision |

| ExecutionTrustRecordService | Build ExecutionTrustRecord |

| ReceiptService | Generate Receipt |

| VerificationService | Verify execution |

Every service SHALL own exactly one responsibility.

\---

\# Execution Flow

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

Policy

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

\---

\# Architectural Invariants

The runtime SHALL satisfy the following invariants:

1\. Runtime services SHALL have a single responsibility.

2\. Policy evaluation SHALL occur only in the PolicyEngine.

3\. Decision construction SHALL occur only in the DecisionService.

4\. Execution orchestration SHALL occur only in the ExecutionService.

5\. ExecutionTrustRecord construction SHALL occur only in the ExecutionTrustRecordService.

6\. Receipt generation SHALL occur only in the ReceiptService.

7\. Verification SHALL occur only in the VerificationService.

8\. Runtime SHALL remain deterministic.

9\. Runtime SHALL remain domain independent.

10\. Business logic SHALL reside exclusively in policy artifacts.

\---

\# Remaining Phase 1 Implementation

The remaining implementation work SHALL proceed in the following order:

1\. Refactor ExecutionService into a pure orchestrator.

2\. Refactor ReceiptService to consume ExecutionTrustRecord.

3\. Refactor VerificationService to verify immutable execution artifacts.

4\. Complete ReplayService integration.

5\. Complete end-to-end integration tests.

6\. Validate persistence, replay, cryptographic receipts, and verification.

No additional architectural changes are required.

\---

\# Status

This RFC locks the runtime service architecture for Parmana Phase 1.

Future enhancements SHALL extend this architecture without changing the canonical execution trust chain or the single-responsibility service model.
