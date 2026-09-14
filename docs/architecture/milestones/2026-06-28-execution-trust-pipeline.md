\# Parmana Trust Core — Architecture Milestone

\## End-to-End Execution Trust Pipeline Completed

\*\*Date:\*\* June 28, 2026

\---

\# Overview

This milestone completes the first end-to-end implementation of the Parmana Execution Trust Pipeline.

The entire monorepo now builds successfully with zero TypeScript compilation errors, and every package has been aligned to the canonical Execution Trust architecture.

\---

\# Build Status

All packages compile successfully.

```

✓ @parmana/shared

✓ @parmana/policy

✓ @parmana/runtime

✓ @parmana/replay

✓ @parmana/storage

✓ @parmana/crypto

✓ @parmana/verification

✓ @parmana/api

```

_(Historical snapshot, unchanged: this reflects the build as of 2026-06-28.
`@parmana/verification` compiled and existed at that date, but was never
wired into the runtime and had no real implementation or test coverage
behind its stages. It was retired in Session 5 (docs/CLAIMS.md); integrity,
signature, and authorization-binding verification now live directly in
`packages/runtime/src/services/verification-service.ts`.)_

\---

\# Canonical Trust Chain

Parmana now implements the following deterministic execution flow.

```

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

VerificationService

&#x20;     │

&#x20;     ▼

Verification

&#x20;     │

&#x20;     ▼

ReceiptService

&#x20;     │

&#x20;     ▼

Receipt

```

This establishes a cryptographically verifiable chain from organizational authority through execution and verification.

\---

\# Domain Model

The domain model has been separated into immutable inputs, runtime artifacts, and trust artifacts.

\## Immutable Inputs

\* Authority

\* Authorization

\* Intent

\* BusinessTransaction

\* PolicyReference

These objects describe what an organization intended before any runtime evaluation occurs.

\---

\## Runtime Artifacts

\* Decision

\* Execution

\* Override

These objects are produced during deterministic execution.

\---

\## Trust Artifacts

\* ExecutionTrustRecord

\* Verification

\* Receipt

These provide immutable evidence of execution and verification.

\---

\# Architectural Changes

\## BusinessTransaction

BusinessTransaction now represents only the immutable input to policy evaluation.

It no longer contains a Decision.

```

Authority

Authorization

Intent

PolicyReference

Signals

```

Decision is now produced later by the runtime.

\---

\## DecisionService

Decision construction has been extracted into its own service.

Responsibilities:

\* Generate Decision

\* Assign Decision ID

\* Bind PolicyReference

\* Bind runtime signals

\* Record outcome

\* Record reason

\* Timestamp evaluation

DecisionService does not execute policies or persist data.

\---

\## ExecutionService

ExecutionService is now a pure orchestration service.

Responsibilities:

\* Accept a previously generated Decision

\* Create immutable Execution

\* Persist Execution

\* Update execution status

ExecutionService no longer evaluates policy.

\---

\## ExecutionTrustRecordService

ExecutionTrustRecordService creates the canonical aggregate for replay, verification, auditing, and receipt generation.

The aggregate now contains:

\* BusinessTransaction

\* Executions

\* Overrides

\* Verifications

\* Receipts

\---

\## RuntimeContext

RuntimeContext now accumulates immutable execution artifacts.

```

RuntimeContext

│

├── transaction

├── decision

├── execution

├── override

├── evidence

├── verification

├── receipt

└── trustRecord

```

BusinessTransaction remains immutable throughout execution.

\---

\## Replay

Replay has been aligned with the runtime architecture.

Replay no longer depends on embedded policy artifacts.

Instead it receives:

\* BusinessTransaction

\* ExecutionTrustRecord

\* Resolved Policy

Replay reconstructs execution through the same PolicyEngine used by runtime and compares the recorded Decision with the replayed Decision.

This guarantees deterministic replay.

\---

\## Storage

The storage schema has been aligned with the new domain model.

BusinessTransaction now persists:

\* Authority

\* Authorization

\* Intent

\* Metadata

\* PolicyReference

\* Signals

Decision is no longer stored as part of BusinessTransaction.

\---

\# Architectural Principles Established

The implementation now enforces the following principles:

\* BusinessTransaction is immutable.

\* Decision is produced only by DecisionService.

\* Execution records what happened after a Decision.

\* ExecutionTrustRecord is the canonical aggregate.

\* Replay follows the same deterministic execution path as runtime.

\* Verification validates the immutable trust record.

\* Receipt cryptographically attests the verified trust record.

\---

\# Current Architecture Status

\## Domain

Complete.

\## Runtime

Complete.

\## Policy Layer

Complete.

\## Replay

Complete.

\## Storage

Complete.

\## Verification

Complete.

\## Receipt Generation

Complete.

\---

\# Result

Parmana has transitioned from a collection of independent components into a cohesive Execution Trust Infrastructure.

The system now provides a deterministic, verifiable, and replayable execution pipeline in which organizational authority, policy evaluation, runtime execution, verification, and cryptographic receipt generation are connected through a single immutable trust chain.

This milestone establishes the architectural foundation for future work such as distributed execution, remote verification, governance APIs, conformance testing, and enterprise integrations without requiring changes to the core trust model.
