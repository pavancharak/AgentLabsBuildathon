\# RFC-0010: Policy Schema Evolution

\*\*Status:\*\* Accepted

\## Purpose

This RFC defines how the structure of policy artifacts evolves over time while preserving deterministic execution, replayability, and independent verification.

Policy schema evolution enables Parmana to introduce new policy language capabilities without breaking previously executed Business Transactions.

\---

\# Goals

Policy schema evolution SHALL:

\* preserve deterministic execution

\* preserve replayability

\* preserve independent verification

\* allow policy language evolution

\* avoid breaking existing policy artifacts

\* maintain immutable historical artifacts

\---

\# Definitions

\## Business Version

The business version identifies the business rules implemented by a policy.

Example:

```text id="4uxifw"

1.0.0

1.1.0

2.0.0

```

Business version changes when business logic changes.

\---

\## Schema Version

The schema version identifies the structure and capabilities of the policy artifact.

Example:

```text id="xemjlwm"

1.0.0

2.0.0

```

Schema version changes when the policy language or artifact format changes.

Business versions and schema versions evolve independently.

\---

\# Policy Identity

Every policy SHALL declare:

```json id="e89z0u"

{

&#x20; "policyId": "vendor-payment",

&#x20; "policyVersion": "1.0.0",

&#x20; "schemaVersion": "1.0.0"

}

```

The runtime SHALL validate all three values before execution.

\---

\# What Requires a Schema Version Change

A schema version SHALL change whenever the policy artifact structure changes.

Examples include:

\* new top-level JSON fields

\* renamed fields

\* removed fields

\* new rule syntax

\* new condition operators

\* new metadata sections

\* new evaluation semantics

\---

\# What Does NOT Require a Schema Version Change

The following do not require a schema version change:

\* changing rule thresholds

\* changing business limits

\* adding business rules

\* removing business rules

\* modifying decision reasons

\* changing approval values

These are business logic changes and require only a new business version.

\---

\# Examples

\## Business Version Change

Version 1.0.0

```json id="2ohwd9"

{

&#x20; "policyVersion": "1.0.0",

&#x20; "schemaVersion": "1.0.0"

}

```

Version 1.1.0

```json id="8k5oqc"

{

&#x20; "policyVersion": "1.1.0",

&#x20; "schemaVersion": "1.0.0"

}

```

The artifact structure is identical.

Only business rules changed.

\---

\## Schema Version Change

Schema 1.0.0

```json id="r4i9hl"

{

&#x20; "condition": {

&#x20;   "greater\_than": 1000

&#x20; }

}

```

Schema 2.0.0

```json id="cybws7"

{

&#x20; "condition": {

&#x20;   "greater\_than\_or\_equal": 1000

&#x20; }

}

```

The policy language changed.

A new schema version is required.

\---

\# Runtime Responsibilities

The runtime SHALL:

\* read PolicyReference

\* load the referenced policy artifact

\* validate schemaVersion

\* reject incompatible policy artifacts

The runtime SHALL NOT:

\* automatically migrate policies

\* rewrite policy artifacts

\* silently ignore schema differences

\---

\# Replay

Replay SHALL use the exact policy artifact referenced by the original BusinessTransaction.

Replay SHALL NOT substitute:

\* newer business versions

\* newer schema versions

Historical executions remain reproducible.

\---

\# Verification

Independent verification SHALL confirm:

\* policyId matches

\* policyVersion matches

\* schemaVersion matches

If any validation fails, verification SHALL fail.

\---

\# Backward Compatibility

Schema evolution is additive.

Older schema versions remain valid and executable.

The runtime may support multiple schema versions simultaneously, provided each version has deterministic evaluation semantics.

\---

\# Forward Compatibility

Older runtimes SHALL NOT execute policy artifacts with unsupported schema versions.

Instead, execution SHALL fail with an explicit schema compatibility error.

Silent fallback is prohibited.

\---

\# Migration Strategy

When introducing a new schema version:

1\. Publish the new schema specification.

2\. Implement runtime support.

3\. Publish new policy artifacts.

4\. Continue supporting existing schema versions until formally deprecated.

Previously published policy artifacts SHALL remain immutable.

\---

\# Architectural Invariants

\* Business version and schema version evolve independently.

\* Policy artifacts are immutable after publication.

\* Schema changes SHALL be explicit.

\* Runtime SHALL validate schemaVersion.

\* Replay SHALL use the original schema version.

\* Verification SHALL validate schemaVersion.

\* Automatic schema migration is prohibited.

\* Deterministic execution SHALL be preserved across all supported schema versions.

\---

\# Relationship to Other RFCs

\* \*\*RFC-0007\*\* defines the canonical trust-chain domain model.

\* \*\*RFC-0008\*\* defines the generic policy runtime architecture.

\* \*\*RFC-0009\*\* defines policy versioning and deterministic resolution.

\* \*\*RFC-0010\*\* defines how policy schemas evolve without compromising execution trust.

\---

\# Status

This document defines the canonical policy schema evolution strategy for Parmana Phase 1 and establishes the rules for introducing future policy language capabilities while preserving deterministic, replayable, and independently verifiable execution.
