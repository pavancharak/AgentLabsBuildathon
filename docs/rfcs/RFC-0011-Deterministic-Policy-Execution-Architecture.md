\# RFC-0011: Deterministic Policy Execution Architecture

\*\*Status:\*\* Accepted

\## Purpose

This RFC defines the canonical execution architecture of the Parmana Runtime.

Its purpose is to ensure that policy execution is deterministic, reproducible, independently verifiable, and free from runtime policy-selection logic.

This RFC establishes the execution contract between the Business Transaction, Policy Reference, Policy Registry, Policy Router, and Policy Engine.

\---

\# Design Principles

The runtime SHALL:

\* execute exactly one policy

\* never determine which policy applies

\* never infer business intent

\* never discover policies dynamically

\* remain deterministic

\* remain domain independent

Business decisions belong to policy artifacts.

Execution belongs to the runtime.

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

(name, version, schemaVersion)

&#x20;     │

&#x20;     ▼

PolicyRegistry

(metadata only)

&#x20;     │

&#x20;     ▼

PolicyRouter

(load exact policy artifact)

&#x20;     │

&#x20;     ▼

Policy Schema Validation

&#x20;     │

&#x20;     ▼

PolicyAdapter

(RuntimeTransaction → PolicySignals)

&#x20;     │

&#x20;     ▼

PolicyEngine

&#x20;     │

&#x20;     ▼

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

Each stage has a single responsibility.

No stage performs another stage's responsibility.

\---

\# BusinessTransaction

A BusinessTransaction SHALL contain exactly one PolicyReference.

The runtime SHALL NOT determine which policy to execute.

Policy selection occurs before runtime execution.

\---

\# PolicyReference

Every execution SHALL identify exactly one policy artifact.

```ts

interface PolicyReference {

&#x20;   readonly name: string;

&#x20;   readonly version: string;

&#x20;   readonly schemaVersion: string;

}

```

The PolicyReference is part of the execution trust chain.

\---

\# PolicyRegistry

The PolicyRegistry manages policy metadata.

Responsibilities:

\* register policies

\* list policies

\* resolve metadata

The PolicyRegistry SHALL NOT:

\* load policy files

\* execute policies

\* evaluate business logic

\---

\# PolicyRouter

The PolicyRouter loads exactly one policy artifact.

Responsibilities:

\* load the referenced artifact

\* validate policy identifier

\* validate business version

\* validate schema version

The PolicyRouter SHALL NOT:

\* scan policy directories

\* discover applicable policies

\* evaluate rules

\* select between multiple policies

\* apply fallback policy selection

If the referenced policy cannot be loaded or validated, execution SHALL fail.

\---

\# PolicyAdapter

The PolicyAdapter converts runtime data into PolicySignals.

```text

RuntimeTransaction

&#x20;       │

&#x20;       ▼

PolicySignals

```

The adapter SHALL remain domain independent.

It SHALL NOT contain payment-specific, healthcare-specific, HR-specific, or any other business-specific mappings.

\---

\# PolicySignals

Policy signals are generic runtime inputs.

```ts

interface PolicySignals {

&#x20;   \[key: string]: JsonValue;

}

```

A policy may evaluate any number of signals.

The runtime imposes no domain-specific restrictions.

\---

\# PolicyEngine

The PolicyEngine evaluates exactly one loaded policy.

Responsibilities:

\* deterministic rule evaluation

\* decision generation

\* evaluation trace generation

The PolicyEngine SHALL NOT:

\* load policy artifacts

\* select policies

\* modify execution state

\---

\# Decision

A Decision is derived exclusively from:

\* the referenced policy artifact

\* runtime signals

\* deterministic evaluation

No external runtime state may influence the decision.

\---

\# Determinism

Given identical:

\* BusinessTransaction

\* PolicyReference

\* Policy artifact

\* Runtime signals

the runtime SHALL always produce the same Decision.

This invariant enables:

\* replay

\* verification

\* cryptographic evidence

\* reproducibility

\---

\# Separation of Responsibilities

| Component | Responsibility |

| ------------------- | --------------------------------- |

| BusinessTransaction | References policy |

| PolicyReference | Identifies policy artifact |

| PolicyRegistry | Maintains metadata |

| PolicyRouter | Loads exact artifact |

| PolicyAdapter | Produces PolicySignals |

| PolicyEngine | Evaluates policy |

| Decision | Captures deterministic outcome |

| TrustRecord | Records execution evidence |

| Receipt | Produces cryptographic proof |

| Verification | Independently validates execution |

Each component owns exactly one responsibility.

\---

\# Architectural Invariants

The runtime SHALL satisfy the following invariants:

1\. BusinessTransaction SHALL contain exactly one PolicyReference.

2\. PolicyReference SHALL contain name, version, and schemaVersion.

3\. PolicyRegistry SHALL manage metadata only.

4\. PolicyRouter SHALL load exactly one policy artifact.

5\. PolicyRouter SHALL validate policyId, policyVersion, and schemaVersion.

6\. PolicyEngine SHALL evaluate exactly one loaded policy.

7\. Runtime SHALL NOT scan policy directories to determine applicability.

8\. Runtime SHALL NOT infer, guess, or select policies.

9\. Policy artifacts SHALL be immutable after publication.

10\. Identical inputs SHALL always produce identical decisions.

\---

\# Failure Conditions

Execution SHALL fail if:

\* PolicyReference is missing.

\* The policy artifact cannot be found.

\* policyId does not match.

\* policyVersion does not match.

\* schemaVersion does not match.

\* The policy artifact is malformed.

\* Runtime signals do not satisfy policy requirements.

The runtime SHALL fail explicitly rather than attempting recovery or fallback.

\---

\# Relationship to Other RFCs

\* RFC-0007 — Canonical Trust Chain Domain Model

\* RFC-0008 — Generic Policy Runtime Architecture

\* RFC-0009 — Policy Versioning and Resolution

\* RFC-0010 — Policy Schema Evolution

\* RFC-0011 — Deterministic Policy Execution Architecture

\---

\# Status

This RFC defines the canonical execution architecture for the Parmana Runtime.

It establishes the deterministic execution contract for all future implementations and ensures that policy execution remains reproducible, independently verifiable, domain independent, and free from runtime policy-selection logic.
