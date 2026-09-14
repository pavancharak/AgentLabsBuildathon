\# RFC-0013: Policy Execution Pipeline

\*\*Status:\*\* Accepted

\## Purpose

This RFC defines the canonical Policy Execution Pipeline for Parmana.

It specifies how a BusinessTransaction progresses from a policy reference to a deterministic Decision while preserving execution trust.

This pipeline separates policy loading, validation, signal preparation, signal validation, and policy evaluation into independent responsibilities.

\---

\# Objectives

The Policy Execution Pipeline SHALL:

\* execute exactly one policy

\* remain deterministic

\* remain domain independent

\* validate policy artifacts before execution

\* validate runtime signals before evaluation

\* produce a deterministic Decision

\---

\# Canonical Pipeline

```text

BusinessTransaction

&#x20;       │

&#x20;       ▼

PolicyReference

(name, version, schemaVersion)

&#x20;       │

&#x20;       ▼

PolicyRegistry

(metadata only)

&#x20;       │

&#x20;       ▼

PolicyRouter

(load policy artifact)

&#x20;       │

&#x20;       ▼

PolicyValidator

(validate policy artifact)

&#x20;       │

&#x20;       ▼

PolicyAdapter

(RuntimeTransaction → PolicySignals)

&#x20;       │

&#x20;       ▼

SignalValidator

(validate PolicySignals)

&#x20;       │

&#x20;       ▼

PolicyEngine

(evaluate policy)

&#x20;       │

&#x20;       ▼

Decision

```

Each component owns exactly one responsibility.

\---

\# Component Responsibilities

\## BusinessTransaction

Provides:

\* execution request

\* PolicyReference

\* runtime data

The BusinessTransaction SHALL NOT contain policy logic.

\---

\## PolicyReference

Identifies the exact policy artifact.

```ts

interface PolicyReference {

&#x20;   readonly name: string;

&#x20;   readonly version: string;

&#x20;   readonly schemaVersion: string;

}

```

\---

\## PolicyRegistry

Responsibilities:

\* register policy metadata

\* resolve metadata

\* list available policies

The registry SHALL NOT execute policies.

\---

\## PolicyRouter

Responsibilities:

\* locate policy artifact

\* load policy.json

The router SHALL NOT:

\* evaluate policies

\* validate policies

\* discover policies

\* apply business logic

\---

\## PolicyValidator

Responsibilities:

Validate:

\* policyId

\* policyVersion

\* schemaVersion

\* signalsSchema

\* rule structure

Execution SHALL fail if validation fails.

\---

\## PolicyAdapter

Responsibilities:

Convert RuntimeTransaction into PolicySignals.

The adapter SHALL remain business-domain independent.

\---

\## SignalValidator

Responsibilities:

Validate runtime signals against the policy's declared signalsSchema.

Validation includes:

\* required signals

\* signal types

Execution SHALL fail on validation errors.

\---

\## PolicyEngine

Responsibilities:

\* evaluate one policy

\* produce one Decision

\* record evaluation trace

The PolicyEngine SHALL NOT:

\* load policies

\* validate policy artifacts

\* validate runtime signals

\---

\# Decision

The Decision is the deterministic result of policy evaluation.

A Decision is derived solely from:

\* PolicyReference

\* policy artifact

\* validated PolicySignals

No external runtime state may influence the result.

\---

\# Determinism

Given identical:

\* BusinessTransaction

\* PolicyReference

\* policy artifact

\* PolicySignals

the Policy Execution Pipeline SHALL always produce the same Decision.

\---

\# Failure Conditions

Execution SHALL terminate if:

\* PolicyReference is invalid.

\* Policy artifact cannot be loaded.

\* Policy validation fails.

\* Signal validation fails.

\* Policy evaluation fails.

No fallback execution is permitted.

\---

\# Architectural Invariants

The pipeline SHALL satisfy the following invariants:

1\. Exactly one policy is executed.

2\. Policy artifacts are validated before execution.

3\. Runtime signals are validated before evaluation.

4\. Policy evaluation is deterministic.

5\. Every component has a single responsibility.

6\. Business logic resides exclusively in policy artifacts.

7\. The runtime remains domain independent.

\---

\# Relationship to the Trust Chain

This RFC covers the transition from:

```text

BusinessTransaction

&#x20;       │

&#x20;       ▼

Decision

```

The Decision becomes the canonical input for the remaining execution trust chain:

```text

Decision

&#x20;     │

&#x20;     ▼

TrustRecord

&#x20;     │

&#x20;     ▼

Receipt

&#x20;     │

&#x20;     ▼

Independent Verification

```

\---

\# Phase 1 Completion

The Policy Execution Pipeline is considered complete when:

\* Policy loading is deterministic.

\* Policy validation is complete.

\* Runtime signal validation is complete.

\* Policy evaluation is deterministic.

\* A canonical Decision is produced.

This completes the policy execution stage of the Parmana Execution Trust Architecture.

\---

\# Status

This RFC defines the canonical Policy Execution Pipeline for Parmana Phase 1 and serves as the implementation contract for all future runtime implementations.
