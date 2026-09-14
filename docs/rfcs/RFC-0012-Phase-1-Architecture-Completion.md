\# RFC-0012: Phase 1 Architecture Completion

\*\*Status:\*\* Accepted

\## Purpose

This RFC records the successful completion of Phase 1 of the Parmana architecture.

Phase 1 establishes the canonical execution trust foundation upon which all future capabilities will be built.

The objective of Phase 1 was to transform the runtime from a payment-oriented implementation into a deterministic, policy-driven, domain-independent execution platform.

\---

\# Phase 1 Objectives

Phase 1 established the following architectural principles:

\* deterministic execution

\* policy-driven execution

\* domain independence

\* immutable policy artifacts

\* execution trust

\* replayability

\* independent verification

\---

\# Locked Architecture

\## PolicyReference

The canonical PolicyReference is:

```ts

interface PolicyReference {

&#x20;   readonly name: string;

&#x20;   readonly version: string;

&#x20;   readonly schemaVersion: string;

}

```

The PolicyReference uniquely identifies the policy artifact.

It forms part of the execution trust chain.

\---

\## PolicyRouter

The PolicyRouter is responsible for loading exactly one policy artifact.

Responsibilities:

\* load referenced policy

\* validate policy identity

\* validate policy version

\* validate schema version

The PolicyRouter SHALL NOT:

\* scan policy directories

\* discover policies

\* infer applicability

\* evaluate business rules

\* choose between policies

\---

\## Policy

The canonical policy artifact contains:

```ts

interface Policy {

&#x20;   policyId: string;

&#x20;   policyVersion: string;

&#x20;   schemaVersion: string;

&#x20;   signalsSchema: Record<string, string>;

&#x20;   rules: PolicyRule\[];

}

```

Policy artifacts are immutable after publication.

\---

\## PolicyEngine

The PolicyEngine is generic.

Responsibilities:

\* deterministic evaluation

\* rule execution

\* decision generation

The PolicyEngine contains no business-specific logic.

\---

\## PolicyAdapter

The PolicyAdapter converts runtime data into policy signals.

```text

RuntimeTransaction

&#x20;       │

&#x20;       ▼

PolicySignals

```

The adapter is domain independent.

It performs no business-specific transformation.

\---

\## RuntimeTransaction

The canonical RuntimeTransaction is:

```ts

interface RuntimeTransaction {

&#x20;   readonly signals: Record<string, JsonValue>;

}

```

The runtime no longer contains fields such as:

\* amount

\* currency

\* recipient

Business-specific information is represented entirely as runtime signals.

\---

\# Domain Independence

The runtime supports any business domain.

Examples include:

\## Payment

```json

{

&#x20; "signals": {

&#x20;   "amount": 5000,

&#x20;   "currency": "USD"

&#x20; }

}

```

\## Lending

```json

{

&#x20; "signals": {

&#x20;   "creditScore": 760,

&#x20;   "income": 90000

&#x20; }

}

```

\## Healthcare

```json

{

&#x20; "signals": {

&#x20;   "patientAge": 67,

&#x20;   "diagnosis": "Diabetes"

&#x20; }

}

```

\## Cybersecurity

```json

{

&#x20; "signals": {

&#x20;   "riskScore": 82,

&#x20;   "deviceTrusted": true

&#x20; }

}

```

\## Manufacturing

```json

{

&#x20; "signals": {

&#x20;   "temperature": 72,

&#x20;   "pressure": 125

&#x20; }

}

```

The runtime requires no code changes to support additional domains.

\---

\# Architectural Achievements

Phase 1 establishes:

\* Generic policy evaluation

\* Unlimited runtime signals

\* Policy schema awareness

\* Policy version awareness

\* Deterministic execution

\* Replayable execution

\* Independently verifiable execution

\* Clear separation of responsibilities

\---

\# Remaining Phase 1 Milestone

One architectural refinement remains.

The runtime currently contains residual policy-selection behavior.

The final step is to eliminate all policy-selection logic.

The runtime SHALL execute only the policy explicitly referenced by the BusinessTransaction.

\---

\# Target Execution Flow

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

(load exact artifact)

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

Once the PolicyRouter loads only the explicitly referenced policy, the runtime becomes a pure execution engine.

\---

\# Phase 1 Completion Criteria

Phase 1 is considered complete when all of the following conditions are satisfied:

\* BusinessTransaction references exactly one PolicyReference.

\* PolicyReference contains `name`, `version`, and `schemaVersion`.

\* PolicyRegistry manages metadata only.

\* PolicyRouter loads exactly one policy artifact.

\* PolicyRouter performs no policy discovery.

\* PolicyEngine evaluates exactly one loaded policy.

\* Runtime contains no policy-selection logic.

\* Policy artifacts are immutable.

\* Execution is deterministic.

\* Replay reproduces the original decision.

\* Verification independently validates the execution.

\---

\# Foundation for Future Phases

Phase 1 provides the foundation for:

\* richer policy language features

\* additional condition operators

\* policy schema evolution

\* advanced policy tooling

\* policy authoring environments

\* policy registries

\* distributed policy repositories

\* execution authorization

\* cryptographic policy attestations

None of these future capabilities require changes to the core execution architecture established in Phase 1.

\---

\# Status

This RFC records the completion of the Phase 1 architectural foundation for Parmana.

The runtime is now a generic, deterministic, policy-driven execution platform capable of supporting any business domain while preserving execution trust, replayability, and independent verification.
