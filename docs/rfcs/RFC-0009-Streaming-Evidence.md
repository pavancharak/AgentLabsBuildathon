\# RFC-0009 — Streaming Evidence

\*\*Status:\*\* Draft

\*\*Author:\*\* Parmana Architecture Team

\*\*Created:\*\* 2026-06-25

\*\*Target Version:\*\* 0.4.0

\---

\# Summary

Introduce Streaming Evidence to allow long-running executions to emit immutable evidence artifacts incrementally before execution completes.

Streaming Evidence enables near real-time observability, monitoring, and audit without compromising Parmana's append-only evidence model or deterministic execution guarantees.

The ExecutionTransaction remains the aggregate root. Streaming Evidence extends how evidence is recorded, not how execution is modeled.

\---

\# Motivation

Some executions may last:

\* Minutes

\* Hours

\* Days

\* Weeks

Waiting until completion to record evidence delays:

\* Monitoring

\* Incident response

\* Compliance visibility

\* Human supervision

\* Operational diagnostics

Streaming Evidence allows immutable execution facts to be recorded as they occur.

\---

\# Goals

\* Record evidence incrementally.

\* Preserve append-only semantics.

\* Preserve deterministic replay.

\* Support long-running execution.

\* Enable real-time consumers.

\---

\# Non-Goals

This RFC does not define:

\* Event streaming platforms.

\* Message brokers.

\* Transport protocols.

\* Observability dashboards.

\* Workflow orchestration.

Streaming transport remains implementation specific.

\---

\# Architectural Principle

Execution remains atomic.

Evidence becomes incrementally observable.

Execution semantics remain unchanged.

\---

\# Architecture

```text

Execution

&#x20;     │

&#x20;     ├───────────────┐

&#x20;     ▼               ▼

Evidence 1       Evidence Stream

&#x20;     │               │

&#x20;     ▼               ▼

Evidence 2       Subscribers

&#x20;     │

&#x20;     ▼

Evidence 3

&#x20;     │

&#x20;     ▼

Execution Complete

&#x20;     │

&#x20;     ▼

ExecutionTransaction

```

Evidence artifacts are appended throughout execution.

\---

\# Evidence Model

Streaming Evidence SHALL consist of immutable Evidence Artifacts.

Each artifact:

\* Represents a factual observation.

\* Is immutable.

\* Is append-only.

\* Has a deterministic order.

Previously emitted artifacts SHALL NOT be modified.

\---

\# Streaming Model

```text

Execution



Artifact 1



Artifact 2



Artifact 3



Artifact 4



Execution Complete

```

Each artifact becomes immediately available after creation.

\---

\# Ordering

Streaming Evidence SHALL preserve logical ordering.

Every artifact SHALL include ordering metadata sufficient to reconstruct the original execution sequence.

Ordering MAY be represented by:

\* Sequence Number

\* Event Index

\* Logical Clock

\* Equivalent deterministic mechanism

\---

\# Runtime Integration

The Runtime MAY emit evidence after each Runtime Stage.

Example:

```text

AuthorityStage

&#x20;     │

&#x20;     ▼

Evidence



IntentStage

&#x20;     │

&#x20;     ▼

Evidence



AuthorizationStage

&#x20;     │

&#x20;     ▼

Evidence



ExecutionStage

&#x20;     │

&#x20;     ▼

Evidence

```

Streaming is an implementation capability.

The Runtime Pipeline remains unchanged.

\---

\# ExecutionTransaction

ExecutionTransaction SHALL contain the complete ordered evidence collection after execution completes.

Streaming does not alter the final execution record.

\---

\# Verification

The Verification Engine verifies the completed evidence collection.

Verification SHALL NOT require live evidence streaming.

Streaming is an optimization for operational visibility, not a verification requirement.

\---

\# Replay

Replay consumes the completed immutable evidence collection.

Replay MAY reconstruct intermediate execution milestones using streaming order metadata.

Replay SHALL remain deterministic.

\---

\# Subscribers

Implementations MAY expose evidence to subscribers.

Typical consumers include:

\* Monitoring systems.

\* Audit systems.

\* Human approval workflows.

\* Incident response tools.

\* Compliance platforms.

Subscribers SHALL NOT modify evidence.

\---

\# Storage

Storage SHALL preserve:

\* Artifact ordering.

\* Artifact immutability.

\* Append-only semantics.

Storage implementations MAY persist artifacts individually before assembling the final execution record.

\---

\# Package Mapping

```text

packages/



runtime/

&#x20;   streaming/

&#x20;       EvidencePublisher.ts

&#x20;       EvidenceSubscriber.ts

&#x20;       EvidenceStream.ts

```

Streaming components extend Runtime without modifying the Core domain model.

\---

\# Compatibility

This RFC is fully backward compatible.

Implementations that do not support streaming continue to produce identical completed ExecutionTransactions.

Streaming is optional.

\---

\# Alternatives Considered

\## Buffer Until Completion

Rejected because long-running executions benefit from incremental visibility.

\---

\## Mutable Evidence

Rejected because modifying evidence violates append-only semantics and weakens execution trust.

\---

\## Event-Sourced Runtime

Rejected because Parmana records execution evidence rather than treating events as the primary execution model.

ExecutionTransaction remains the aggregate root.

\---

\# Open Questions

\* Should evidence streams support filtering?

\* Should subscribers receive cryptographically signed artifacts?

\* Should evidence batching be standardized?

\* Should streaming back-pressure be part of the Runtime contract?

\---

\# Acceptance Criteria

\* Runtime supports incremental evidence publication.

\* Evidence remains immutable.

\* Evidence remains append-only.

\* ExecutionTransaction contains the complete ordered evidence collection.

\* Verification requires no architectural changes.

\* Replay remains deterministic.

\---

\# References

\* 003-EXECUTION-TRANSACTION.md

\* 010-EVIDENCE.md

\* 011-RUNTIME.md

\* 012-RUNTIME-STAGES.md

\* 013-VERIFICATION-ENGINE.md

\* 016-PLATFORM-GUARANTEES.md

\* ADR-0004 — Runtime Pipeline

\* ADR-0005 — Evidence Is Append-Only

\* ADR-0007 — Deterministic Execution

\* RFC-0002 — Replay Engine
