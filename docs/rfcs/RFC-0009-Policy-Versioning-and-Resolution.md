\# RFC-0009: Policy Versioning and Resolution

\*\*Status:\*\* Accepted

\## Purpose

This RFC defines the canonical model for policy identification, versioning, and resolution in Parmana.

Its purpose is to ensure that every execution is reproducible, deterministic, and independently verifiable by uniquely identifying the policy artifact used during execution.

\---

\# Goals

The policy versioning model SHALL:

\* uniquely identify every policy artifact

\* support deterministic execution

\* support independent verification

\* support future schema evolution

\* eliminate runtime policy discovery

\* preserve execution reproducibility

\---

\# Policy Identity

A policy is uniquely identified by three attributes:

```ts

interface PolicyReference {

&#x20;   readonly name: string;

&#x20;   readonly version: string;

&#x20;   readonly schemaVersion: string;

}

```

These attributes form the canonical identity of a policy artifact.

\---

\# Policy Name

The policy name identifies the business policy.

Examples:

```

vendor-payment

loan-approval

employee-access

insurance-claim

purchase-order

```

The name is stable across business versions.

\---

\# Business Version

The business version identifies the business logic revision.

Example:

```

1.0.0

1.1.0

2.0.0

```

Changing business rules requires a new business version.

Examples:

\* approval thresholds

\* risk scoring logic

\* authorization requirements

\* rule ordering

Business versions SHALL be immutable.

\---

\# Schema Version

The schema version identifies the structure of the policy artifact.

Examples:

```

1.0.0

2.0.0

```

Changing the artifact format requires a schema version change.

Examples include:

\* new JSON fields

\* modified field structure

\* new condition operators

\* metadata changes

Changing the schema SHALL NOT imply a change in business logic.

\---

\# Policy Artifact

Each policy SHALL declare its identity.

Example:

```json

{

&#x20; "policyId": "vendor-payment",

&#x20; "policyVersion": "1.0.0",

&#x20; "schemaVersion": "1.0.0",



&#x20; "signalsSchema": {

&#x20;   "amount": "number",

&#x20;   "vendorVerified": "boolean"

&#x20; },



&#x20; "rules": \[

&#x20;   ...

&#x20; ]

}

```

\---

\# Policy Directory Layout

The canonical layout is:

```text

policies/

└── vendor-payment/

&#x20;   ├── 1.0.0/

&#x20;   │   └── policy.json

&#x20;   ├── 1.1.0/

&#x20;   │   └── policy.json

&#x20;   └── 2.0.0/

&#x20;       └── policy.json

```

The directory structure is organized by business version.

The policy artifact itself declares both the business version and schema version.

\---

\# Resolution Process

Policy resolution SHALL follow this sequence:

```text

BusinessTransaction

&#x20;       │

&#x20;       ▼

PolicyReference

(name, version, schemaVersion)

&#x20;       │

&#x20;       ▼

PolicyRegistry

(metadata lookup)

&#x20;       │

&#x20;       ▼

PolicyRouter

(load exact artifact)

&#x20;       │

&#x20;       ▼

Validate:

• policyId

• policyVersion

• schemaVersion

&#x20;       │

&#x20;       ▼

PolicyEngine

```

No policy discovery occurs during resolution.

\---

\# Policy Registry Responsibilities

The PolicyRegistry SHALL:

\* register policy metadata

\* resolve policy metadata

\* list available policies

The PolicyRegistry SHALL NOT:

\* execute policies

\* evaluate rules

\* choose policies

\---

\# Policy Router Responsibilities

The PolicyRouter SHALL:

\* load the exact referenced policy

\* read the policy artifact

\* validate:

&#x20; \* policyId

&#x20; \* policyVersion

&#x20; \* schemaVersion

The PolicyRouter SHALL NOT:

\* scan all policies

\* infer applicable policies

\* select the best policy

\* evaluate business logic

\---

\# Runtime Responsibilities

The runtime SHALL execute only the policy referenced by the BusinessTransaction.

The runtime SHALL NOT determine which policy should execute.

Policy selection occurs before runtime execution.

\---

\# Deterministic Resolution

Given the same:

\* PolicyReference

\* policy artifact

\* runtime signals

the runtime SHALL always load the same policy artifact and produce the same decision.

Policy resolution is therefore deterministic.

\---

\# Version Evolution

Business Version changes:

\* business rules

\* approval logic

\* decision behavior

Schema Version changes:

\* artifact structure

\* metadata

\* serialization format

\* policy language capabilities

Business versions and schema versions evolve independently.

\---

\# Verification

A verifier SHALL confirm that:

\* the requested policy name matches

\* the requested business version matches

\* the requested schema version matches

\* the executed policy artifact matches the reference

Failure of any validation SHALL invalidate the execution.

\---

\# Architectural Invariants

\* Every BusinessTransaction SHALL reference exactly one PolicyReference.

\* Policy identity SHALL consist of name, version, and schemaVersion.

\* Policy artifacts SHALL declare their own identity.

\* Runtime SHALL execute exactly one policy.

\* Runtime SHALL NOT discover policies.

\* Runtime SHALL NOT guess policy versions.

\* Policy resolution SHALL be deterministic.

\* Policy artifacts SHALL be immutable after publication.

\---

\# Relationship to Other RFCs

\* \*\*RFC-0007\*\* defines the canonical trust-chain domain model.

\* \*\*RFC-0008\*\* defines the generic policy runtime architecture.

\* \*\*RFC-0009\*\* defines how policies are uniquely identified and deterministically resolved.

\---

\# Status

This document defines the canonical policy versioning and resolution model for Parmana Phase 1 and establishes the foundation for deterministic, reproducible, and independently verifiable policy execution.
