\# RFC-0001 — Policy Engine

\*\*Status:\*\* Draft

\*\*Author:\*\* Parmana Architecture Team

\*\*Created:\*\* 2026-06-25

\*\*Target Version:\*\* 0.2.0

\---

\# Summary

Introduce a pluggable Policy Engine responsible for evaluating whether an execution request is authorized.

The Policy Engine operates before execution and produces an immutable `Authorization` object that becomes part of the `ExecutionTransaction`.

The Policy Engine is independent of the Runtime, Verification Engine, Storage, and Cryptography.

\---

\# Motivation

Execution Trust requires more than recording execution.

It requires proving that execution was permitted according to an explicit policy.

Today, authorization is represented as a domain object but no architectural component is responsible for evaluating policy.

The Policy Engine fills that gap.

\---

\# Goals

\* Provide deterministic policy evaluation.

\* Produce immutable Authorization objects.

\* Support multiple policy providers.

\* Record policy decisions as execution evidence.

\* Remain independent of Runtime orchestration.

\---

\# Non-Goals

This RFC does not define:

\* A policy language.

\* A rule authoring UI.

\* Role management.

\* Identity management.

\* Authentication.

These concerns remain external to Parmana.

\---

\# Architecture

```text

Authority

&#x20;     │

&#x20;     ▼

Intent

&#x20;     │

&#x20;     ▼

Policy Engine

&#x20;     │

&#x20;     ▼

Authorization

&#x20;     │

&#x20;     ▼

Runtime

&#x20;     │

&#x20;     ▼

Execution

```

The Policy Engine determines whether execution may proceed.

The Runtime executes only after authorization has been established.

\---

\# Responsibilities

The Policy Engine SHALL:

\* Evaluate execution requests.

\* Produce Authorization objects.

\* Record policy identifiers.

\* Record policy versions.

\* Record evaluation timestamps.

\* Record evaluation outcomes.

The Policy Engine SHALL NOT:

\* Execute business logic.

\* Modify execution results.

\* Verify execution.

\* Persist transactions.

\---

\# Provider Model

The Policy Engine delegates evaluation to interchangeable providers.

Example providers include:

\* Static Policy Provider

\* JSON Policy Provider

\* YAML Policy Provider

\* Enterprise Policy Provider

\* External Decision Service

\* Open Policy Agent (OPA) Provider

\* Custom Provider

Providers implement a common interface.

\---

\# Policy Evaluation

Policy evaluation accepts:

\* Authority

\* Intent

\* Execution Context

\* Policy Snapshot

It produces:

\* Authorization

\* Decision

\* Optional Reason

\* Policy Metadata

Evaluation must be deterministic.

\---

\# Runtime Integration

The Runtime invokes the Policy Engine during the Authorization Stage.

```text

AuthorityStage

&#x20;     │

&#x20;     ▼

IntentStage

&#x20;     │

&#x20;     ▼

AuthorizationStage

&#x20;     │

&#x20;     ▼

Policy Engine

&#x20;     │

&#x20;     ▼

Authorization

&#x20;     │

&#x20;     ▼

ExecutionStage

```

Execution SHALL NOT continue if authorization is denied.

\---

\# Evidence

Policy evaluation contributes immutable evidence to the execution record.

Typical evidence includes:

\* Policy Identifier

\* Policy Version

\* Decision

\* Evaluation Timestamp

\* Decision Reason (optional)

This evidence enables later verification and audit.

\---

\# Verification

The Verification Engine validates:

\* An Authorization exists.

\* The recorded policy metadata is complete.

\* The authorization is internally consistent.

\* Policy evidence has not been modified.

The Verification Engine does not re-evaluate policy.

\---

\# Determinism

Policy evaluation SHALL be deterministic.

Equivalent inputs MUST produce equivalent authorization results.

Providers that depend on external systems SHALL preserve or record the information required to explain the resulting authorization decision.

\---

\# Alternatives Considered

\## Policy Inside Runtime

Rejected because it couples execution orchestration with policy evaluation.

\---

\## Policy Inside Verification

Rejected because verification evaluates recorded facts rather than making authorization decisions.

\---

\## Embedded Rule Engine

Rejected because organizations use diverse policy technologies.

Parmana should integrate with existing policy systems rather than replace them.

\---

\# Package Mapping

```text

packages/



policy/

&#x20;   src/

&#x20;       PolicyEngine.ts

&#x20;       PolicyProvider.ts

&#x20;       PolicyDecision.ts

&#x20;       PolicyContext.ts

&#x20;       providers/

```

The Policy package remains independent of Runtime and Verification.

\---

\# Compatibility

This RFC is backward compatible.

Implementations without a Policy Engine MAY continue using static Authorization objects.

Future Runtime implementations MAY delegate Authorization creation to the Policy Engine without changing the `ExecutionTransaction` domain model.

\---

\# Open Questions

\* Should policy snapshots become first-class domain objects?

\* Should policy bundles be cryptographically signed?

\* Should policy evaluation support batch authorization?

\* Should policy metadata include provenance information?

\---

\# Acceptance Criteria

\* A `PolicyEngine` abstraction exists.

\* Provider interfaces are defined.

\* Runtime integrates with the Policy Engine during the Authorization Stage.

\* Policy decisions produce immutable Authorization objects.

\* Policy evidence is recorded within the `ExecutionTransaction`.

\* Verification validates authorization artifacts without re-evaluating policy.

\---

\# References

\* 001-ARCHITECTURE.md

\* 003-EXECUTION-TRANSACTION.md

\* 011-RUNTIME.md

\* 012-RUNTIME-STAGES.md

\* 013-VERIFICATION-ENGINE.md

\* 014-EXECUTION-TRUST-MODEL.md

\* ADR-0003 — Verification Is Independent

\* ADR-0004 — Runtime Pipeline
