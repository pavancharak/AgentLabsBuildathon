\# RFC-0008: Generic Policy Runtime Architecture

\*\*Status:\*\* Accepted

\## Purpose

This RFC defines the canonical architecture of the Parmana Policy Runtime.

The runtime is responsible for loading, validating, and executing the exact policy referenced by a BusinessTransaction. It is deterministic, domain-independent, and does not contain business-specific logic.

This RFC complements RFC-0007 (Canonical Trust Chain Domain Model) by defining the runtime responsibilities for policy execution.

\---

\# Goals

The Policy Runtime SHALL:

\* Execute exactly one policy.

\* Never infer or discover which policy applies.

\* Be deterministic.

\* Be domain independent.

\* Support arbitrary business domains.

\* Support future policy schema evolution.

\* Produce verifiable execution evidence.

\---

\# Architecture

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

(load exact artifact)

&#x20;       │

&#x20;       ▼

PolicyAdapter

(RuntimeTransaction → PolicySignals)

&#x20;       │

&#x20;       ▼

PolicyEngine

&#x20;       │

&#x20;       ▼

Decision

```

\---

\# Policy Reference

Every BusinessTransaction SHALL contain exactly one PolicyReference.

```ts

interface PolicyReference {

&#x20;   readonly name: string;

&#x20;   readonly version: string;

&#x20;   readonly schemaVersion: string;

}

```

The PolicyReference uniquely identifies the policy artifact to execute.

\---

\# Policy Artifact

Every policy artifact SHALL declare:

```json

{

&#x20; "policyId": "vendor-payment",

&#x20; "policyVersion": "1.0.0",

&#x20; "schemaVersion": "1.0.0",



&#x20; "signalsSchema": {

&#x20;   "amount": "number",

&#x20;   "currency": "string",

&#x20;   "vendorVerified": "boolean"

&#x20; },



&#x20; "rules": \[

&#x20;   ...

&#x20; ]

}

```

The runtime SHALL validate:

\* policyId

\* policyVersion

\* schemaVersion

before execution.

\---

\# Runtime Transaction

The runtime SHALL remain domain independent.

```ts

interface RuntimeTransaction {

&#x20;   readonly signals: Record<string, JsonValue>;

}

```

The runtime SHALL NOT contain payment-specific, healthcare-specific, or any other business-specific fields.

\---

\# Policy Signals

The Policy Engine evaluates generic runtime signals.

```ts

interface PolicySignals {

&#x20;   \[key: string]: JsonValue;

}



type PolicyInput = PolicySignals;

```

Signals are supplied by the runtime and interpreted by the policy.

\---

\# Policy Adapter

The PolicyAdapter converts a RuntimeTransaction into the PolicyInput consumed by the PolicyEngine.

```text

RuntimeTransaction

&#x20;       │

&#x20;       ▼

PolicyAdapter

&#x20;       │

&#x20;       ▼

PolicySignals

```

The adapter SHALL NOT contain domain-specific mapping logic.

\---

\# Policy Registry

The PolicyRegistry manages policy metadata.

Responsibilities:

\* register policy metadata

\* list policies

\* resolve policy metadata

The PolicyRegistry SHALL NOT execute policies.

\---

\# Policy Router

The PolicyRouter loads the exact policy artifact referenced by the BusinessTransaction.

Responsibilities:

\* locate policy artifact

\* load policy JSON

\* validate identifier

\* validate business version

\* validate schema version

The PolicyRouter SHALL NOT:

\* scan policies to determine applicability

\* evaluate business rules

\* choose among multiple policies

Policy selection occurs before runtime execution.

\---

\# Policy Engine

The PolicyEngine evaluates exactly one loaded policy.

Responsibilities:

\* evaluate rules deterministically

\* produce a Decision

\* record evaluation trace

The PolicyEngine SHALL NOT:

\* load policies

\* discover policies

\* modify runtime state

\---

\# Domain Independence

The runtime supports any policy domain.

Examples:

Payment

```json

{

&#x20; "signals": {

&#x20;   "amount": 5000,

&#x20;   "currency": "USD"

&#x20; }

}

```

Loan

```json

{

&#x20; "signals": {

&#x20;   "creditScore": 780,

&#x20;   "income": 120000

&#x20; }

}

```

Healthcare

```json

{

&#x20; "signals": {

&#x20;   "patientAge": 67,

&#x20;   "diagnosis": "Diabetes"

&#x20; }

}

```

Cybersecurity

```json

{

&#x20; "signals": {

&#x20;   "riskScore": 91,

&#x20;   "deviceTrusted": true

&#x20; }

}

```

No runtime code changes are required to support new domains.

\---

\# Determinism

For identical:

\* PolicyReference

\* Policy Artifact

\* Runtime Signals

the PolicyEngine SHALL always produce the same Decision.

Determinism is a fundamental invariant of Parmana.

\---

\# Separation of Responsibilities

| Component | Responsibility |

| ------------------- | ----------------------------------------- |

| BusinessTransaction | References the policy |

| PolicyReference | Identifies the exact policy |

| PolicyRegistry | Maintains policy metadata |

| PolicyRouter | Loads the exact policy artifact |

| PolicyAdapter | Converts runtime data into policy signals |

| PolicyEngine | Evaluates one policy |

| Decision | Records evaluation result |

No component performs another component's responsibility.

\---

\# Architectural Invariants

\* Exactly one policy SHALL be executed.

\* Runtime SHALL NOT guess the applicable policy.

\* Runtime SHALL NOT scan all policies.

\* Policy loading SHALL be deterministic.

\* Policy execution SHALL be deterministic.

\* Business logic SHALL reside in policy artifacts.

\* Runtime SHALL remain domain independent.

\* New policy domains SHALL require no runtime code changes.

\---

\# Relationship to RFC-0007

RFC-0007 defines the canonical trust-chain domain model.

RFC-0008 defines how the runtime executes the PolicyReference contained within the BusinessTransaction while preserving determinism and execution trust.

\---

\# Status

This document defines the canonical Generic Policy Runtime Architecture for Parmana Phase 1.
