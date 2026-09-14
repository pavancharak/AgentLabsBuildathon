\# RFC-0019: Business Transaction Domain Model

\*\*Status:\*\* Accepted

\## Purpose

This RFC defines the canonical `BusinessTransaction` domain model within the Parmana Execution Trust Architecture.

The `BusinessTransaction` represents the immutable business context submitted for execution. It captures everything required to deterministically evaluate a policy, but it does not contain the results of that evaluation.

\---

\# Architectural Position

The `BusinessTransaction` is an input artifact.

It exists before policy evaluation and therefore SHALL NOT contain execution artifacts produced later in the trust chain.

The canonical execution flow is:

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

PolicyEngine

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

\---

\# Responsibilities

The `BusinessTransaction` SHALL:

\* identify the business transaction

\* capture the complete upstream trust chain

\* specify the exact policy to execute

\* carry the runtime signals required for evaluation

\* remain immutable after creation

The `BusinessTransaction` SHALL NOT:

\* contain a `Decision`

\* contain execution state

\* contain receipt information

\* contain verification results

\* contain execution evidence

\---

\# Canonical Structure

The canonical `BusinessTransaction` SHALL contain:

```text

BusinessTransaction

├── businessTransactionId

├── metadata

├── authority

├── authorization

├── intent

├── policy : PolicyReference

├── signals

├── status

└── createdAt

```

\---

\# Policy Reference

Every `BusinessTransaction` SHALL contain exactly one `PolicyReference`.

The `PolicyReference` SHALL include:

```text

PolicyReference

├── name

├── version

└── schemaVersion

```

The `PolicyReference` forms part of the cryptographically verifiable execution trust chain.

\---

\# Runtime Signals

Runtime signals are opaque business facts supplied at execution time.

Examples include:

Payment

```json

{

&#x20; "amount": 5000,

&#x20; "currency": "USD"

}

```

Loan

```json

{

&#x20; "creditScore": 760,

&#x20; "income": 90000

}

```

Healthcare

```json

{

&#x20; "patientAge": 67,

&#x20; "diagnosis": "Diabetes"

}

```

Cybersecurity

```json

{

&#x20; "riskScore": 82,

&#x20; "deviceTrusted": true

}

```

Manufacturing

```json

{

&#x20; "temperature": 72,

&#x20; "pressure": 125

}

```

Parmana assigns no business meaning to these values.

Their interpretation belongs entirely to the referenced policy.

\---

\# Decision Separation

A `Decision` SHALL NOT be embedded within a `BusinessTransaction`.

The `Decision` is produced only after deterministic policy evaluation.

```text

BusinessTransaction

&#x20;       │

&#x20;       ▼

PolicyEngine

&#x20;       │

&#x20;       ▼

Decision

```

This preserves the causal relationship between inputs and outputs.

\---

\# Architectural Invariants

The `BusinessTransaction` SHALL satisfy the following invariants:

1\. It SHALL be immutable.

2\. It SHALL represent only execution inputs.

3\. It SHALL contain exactly one `PolicyReference`.

4\. It SHALL contain the runtime signals required for policy evaluation.

5\. It SHALL NOT contain execution artifacts.

6\. It SHALL NOT contain a `Decision`.

7\. It SHALL remain domain independent.

8\. Identical `BusinessTransaction` instances SHALL produce identical policy evaluation inputs.

\---

\# Relationship to Other Domain Objects

The trust chain is defined as:

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

Each domain object represents a distinct stage in the execution lifecycle and owns only the data created at that stage.

\---

\# Benefits

Separating the `BusinessTransaction` from the `Decision` provides:

\* clear separation of inputs and outputs

\* deterministic policy evaluation

\* domain independence

\* replayability

\* immutable execution artifacts

\* independently verifiable execution

\* a clean execution trust chain

\---

\# Status

This RFC locks the canonical `BusinessTransaction` domain model for Parmana.

The `BusinessTransaction` SHALL remain an immutable execution input and SHALL NOT embed downstream execution artifacts such as `Decision`, `Execution`, `Receipt`, or `Verification`.
