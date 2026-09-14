\# RFC-0014: Phase 1 Execution Architecture

\*\*Status:\*\* Accepted

\## Purpose

This RFC records the completion of the Phase 1 execution architecture for Parmana.

Phase 1 establishes the canonical execution trust model, deterministic policy execution pipeline, and domain model that all future implementations SHALL follow.

This RFC serves as the architectural baseline for implementation.

\---

\# Phase 1 Goals

Phase 1 establishes:

\* Deterministic execution

\* Domain-independent policy evaluation

\* Immutable execution artifacts

\* Replayability

\* Independent verification

\* Cryptographically verifiable execution evidence

\---

\# Canonical Trust Chain

The canonical trust chain is:

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

(name, version, schemaVersion)

&#x20;     │

&#x20;     ▼

Policy

&#x20;     │

&#x20;     ▼

Decision

&#x20;     │

&#x20;     ▼

Execution

&#x20;     │

&#x20;     ▼

ExecutionTrustRecord

&#x20;     │

&#x20;     ▼

Receipt

&#x20;     │

&#x20;     ▼

Verification

```

Each artifact is immutable.

Each artifact extends the trust chain.

\---

\# Canonical Policy Execution Pipeline

```text

BusinessTransaction

&#x20;       │

&#x20;       ▼

PolicyReference

&#x20;       │

&#x20;       ▼

PolicyRegistry

(metadata)

&#x20;       │

&#x20;       ▼

PolicyRouter

(load policy artifact)

&#x20;       │

&#x20;       ▼

PolicyValidator

(validate artifact)

&#x20;       │

&#x20;       ▼

PolicyAdapter

(RuntimeTransaction → PolicySignals)

&#x20;       │

&#x20;       ▼

SignalValidator

(validate runtime signals)

&#x20;       │

&#x20;       ▼

PolicyEngine

(evaluate)

&#x20;       │

&#x20;       ▼

Decision

```

The runtime executes exactly one policy.

\---

\# Domain Model

\## Authority

Defines who is permitted to authorize actions.

\---

\## Authorization

Records approval granted by an authority.

\---

\## Intent

Represents the desired business outcome.

\---

\## BusinessTransaction

Represents an execution request.

It contains exactly one:

```text

PolicyReference

```

\---

\## PolicyReference

```ts

interface PolicyReference {

&#x20;   readonly name: string;

&#x20;   readonly version: string;

&#x20;   readonly schemaVersion: string;

}

```

It uniquely identifies the policy artifact.

\---

\## Policy

Every policy declares:

```text

policyId

policyVersion

schemaVersion

signalsSchema

rules

```

Policy artifacts are immutable.

\---

\## Decision

The deterministic result of evaluating a policy against validated runtime signals.

A Decision binds together:

\* Intent

\* PolicyReference

\* Runtime signals

\* Outcome

\* Reason

\* Evaluation timestamp

\---

\## Execution

Records the lifecycle of processing a BusinessTransaction.

Execution captures:

\* lifecycle state

\* execution mode

\* timestamps

\* execution evidence

\* execution metadata

Execution is immutable.

\---

\## ExecutionTrustRecord

The canonical aggregate.

It contains:

\* BusinessTransaction

\* Executions

\* Overrides

\* Verifications

\* Receipts

\* TrustRecordHash

It is the authoritative source for replay, audit, receipt generation, and verification.

\---

\## Receipt

Cryptographically signed proof of the ExecutionTrustRecord state.

Receipts are immutable.

\---

\## Verification

Records the independent verification of an ExecutionTrustRecord.

Each verification is immutable.

\---

\# Runtime Components

\## PolicyRegistry

Maintains policy metadata.

\---

\## PolicyRouter

Loads the exact policy artifact identified by the PolicyReference.

The router SHALL NOT:

\* discover policies

\* infer applicability

\* evaluate business logic

\---

\## PolicyValidator

Validates:

\* policyId

\* policyVersion

\* schemaVersion

\* signalsSchema

\* rule structure

\---

\## PolicyAdapter

Converts RuntimeTransaction into generic PolicySignals.

The adapter contains no business-specific logic.

\---

\## SignalValidator

Validates runtime signals against the policy's declared signalsSchema.

Execution SHALL fail if validation fails.

\---

\## PolicyEngine

Evaluates exactly one loaded policy.

The engine is deterministic and domain independent.

\---

\# Architectural Invariants

The runtime SHALL satisfy the following invariants:

1\. Exactly one policy is executed.

2\. BusinessTransaction contains exactly one PolicyReference.

3\. Policy artifacts are immutable.

4\. Runtime never discovers policies.

5\. Runtime never guesses policies.

6\. Policy evaluation is deterministic.

7\. Runtime signals are validated before evaluation.

8\. Business logic resides exclusively in policy artifacts.

9\. Runtime remains domain independent.

10\. Identical inputs SHALL produce identical decisions.

\---

\# Phase 1 Deliverables

The following architectural components are complete:

\* Authority

\* Authorization

\* Intent

\* BusinessTransaction

\* PolicyReference

\* Policy

\* PolicyRegistry

\* PolicyRouter

\* PolicyValidator

\* PolicyAdapter

\* SignalValidator

\* PolicyEngine

\* Decision

\* Execution

\* ExecutionTrustRecord

\* Receipt

\* Verification

\---

\# Remaining Implementation Work

The remaining work focuses on implementation rather than architectural redesign.

Priority order:

1\. DecisionService

2\. ExecutionTrustRecordService

3\. ReceiptService

4\. ReplayService completion

5\. VerificationService completion

6\. End-to-end integration tests

7\. Performance optimization

These components SHALL implement the architecture defined in this RFC without altering the canonical domain model.

\---

\# Relationship to Previous RFCs

\* RFC-0007 — Canonical Trust Chain Domain Model

\* RFC-0008 — Generic Policy Runtime Architecture

\* RFC-0009 — Policy Versioning and Resolution

\* RFC-0010 — Policy Schema Evolution

\* RFC-0011 — Deterministic Execution Contract

\* RFC-0012 — Phase 1 Architecture Completion

\* RFC-0013 — Policy Execution Pipeline

\* RFC-0014 — Phase 1 Execution Architecture

\---

\# Status

This RFC locks the Phase 1 execution architecture for Parmana.

Future work SHALL extend this architecture without changing the core execution trust model, deterministic policy pipeline, or canonical domain model established in Phase 1.
