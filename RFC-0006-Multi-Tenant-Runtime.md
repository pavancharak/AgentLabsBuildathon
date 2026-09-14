\# RFC-0006 — Multi-Tenant Runtime

\*\*Status:\*\* Draft

\*\*Author:\*\* Parmana Architecture Team

\*\*Created:\*\* 2026-06-25

\*\*Target Version:\*\* 0.4.0

\---

\# Summary

Introduce a Multi-Tenant Runtime architecture that enables multiple organizations (tenants) to execute independent workloads on the same Parmana deployment while maintaining strict isolation of execution, evidence, verification, policy, and operational resources.

Multi-tenancy is an infrastructure capability and SHALL NOT alter the Core domain model.

\---

\# Motivation

Enterprise deployments frequently require a single platform to serve multiple organizations.

Examples include:

\* SaaS platforms

\* Managed AI platforms

\* Enterprise business units

\* Government agencies

\* Cloud service providers

Each tenant must remain logically isolated while benefiting from a shared runtime infrastructure.

\---

\# Goals

\* Strong tenant isolation.

\* Shared Runtime infrastructure.

\* Independent execution records.

\* Independent verification.

\* Independent policy configuration.

\* Independent storage.

\* Deterministic execution.

\---

\# Non-Goals

This RFC does not define:

\* Identity providers.

\* Billing.

\* User management.

\* Authentication.

\* Authorization between tenants.

Those concerns belong to platform administration.

\---

\# Architectural Principle

Multi-tenancy is an operational concern.

The Core domain SHALL remain tenant-neutral.

Tenant awareness exists only within infrastructure components.

\---

\# Architecture

```text

&#x20;                Runtime Cluster

&#x20;                       │

&#x20;       ┌───────────────┼───────────────┐

&#x20;       ▼               ▼               ▼

&#x20;   Tenant A        Tenant B       Tenant C

&#x20;       │               │               │

&#x20;       ▼               ▼               ▼

&#x20;Runtime Context   Runtime Context Runtime Context

&#x20;       │               │               │

&#x20;       ▼               ▼               ▼

Execution Txn   Execution Txn   Execution Txn

```

Each tenant receives an isolated runtime context.

\---

\# Tenant Context

Every runtime execution SHALL execute within a Tenant Context.

A Tenant Context MAY include:

\* Tenant Identifier

\* Runtime Configuration

\* Policy Configuration

\* Cryptographic Providers

\* Storage Providers

\* Verification Configuration

Tenant Context is infrastructure metadata and is not part of the Core domain model.

\---

\# Isolation Requirements

Tenant isolation SHALL apply to:

\* Execution

\* Evidence

\* Verification

\* Storage

\* Policy

\* Runtime Configuration

\* Cryptographic Providers

A tenant SHALL NOT access another tenant's execution artifacts unless explicitly permitted by external platform controls.

\---

\# Runtime Model

```text

Runtime

&#x20;     │

&#x20;     ▼

Tenant Runtime

&#x20;     │

&#x20;     ▼

Runtime Pipeline

&#x20;     │

&#x20;     ▼

ExecutionTransaction

```

The Runtime selects the appropriate Tenant Context before execution begins.

\---

\# Storage

Storage providers MAY:

\* Share infrastructure.

\* Partition data logically.

\* Partition data physically.

Regardless of implementation, the observable behavior SHALL preserve tenant isolation.

\---

\# Verification

Each tenant MAY operate:

\* Its own Verification Engine.

\* A shared Verification service.

\* Distributed Verification.

Verification SHALL operate only on execution records accessible within the applicable tenant context unless an external governance policy explicitly permits cross-tenant verification.

\---

\# Policy

Each tenant MAY define:

\* Independent policies.

\* Independent approval workflows.

\* Independent policy providers.

Policy evaluation occurs within the Tenant Context.

\---

\# Cryptography

Each tenant MAY configure:

\* Independent key material.

\* Independent provider registries.

\* Independent cryptographic policies.

Cryptographic metadata remains associated with individual execution records.

\---

\# Runtime Context

Example:

```text

Tenant Context



Tenant ID



Runtime Profile



Policy Profile



Storage Profile



Crypto Profile



Verification Profile

```

The Runtime loads this context before pipeline execution.

\---

\# Core Domain

The following Core objects remain tenant-independent:

\* Authority

\* Intent

\* Authorization

\* Execution

\* Evidence

\* ExecutionTransaction

The Core package SHALL NOT introduce tenant-specific fields.

\---

\# Determinism

Tenant Context SHALL be considered part of the execution environment.

Any tenant-specific configuration that influences observable execution SHOULD be preserved as execution context or evidence sufficient to support replay and verification.

Replay within the same tenant context SHALL produce equivalent execution semantics.

\---

\# Package Mapping

```text

packages/



runtime/

&#x20;   tenancy/

&#x20;       TenantContext.ts

&#x20;       TenantRuntime.ts

&#x20;       TenantResolver.ts

&#x20;       TenantConfiguration.ts

```

Multi-tenancy extends Runtime without changing the Core domain.

\---

\# Compatibility

This RFC is backward compatible.

Single-tenant deployments continue to operate unchanged.

The default Runtime behaves as a single-tenant Runtime when no Tenant Context is configured.

\---

\# Alternatives Considered

\## Tenant Identifier in Core

Rejected because tenancy is an infrastructure concern rather than a domain concept.

Embedding tenant identifiers in domain objects would reduce portability and increase coupling.

\---

\## Separate Runtime per Tenant

Rejected because it increases operational complexity and resource usage for deployments that can safely share infrastructure.

\---

\## Shared Execution Store

Rejected because it weakens tenant isolation and complicates governance.

Storage implementations may share infrastructure but must preserve logical isolation.

\---

\# Open Questions

\* Should tenant configuration be versioned?

\* Should tenant migration tooling be standardized?

\* Should tenant-specific conformance profiles exist?

\* Should tenant capabilities be discoverable through the SDK?

\---

\# Acceptance Criteria

\* Runtime supports isolated Tenant Contexts.

\* Core domain remains tenant-neutral.

\* Execution records remain immutable.

\* Verification supports tenant isolation.

\* Storage preserves tenant boundaries.

\* Replay functions correctly within isolated tenant contexts.

\* Multi-tenancy requires no changes to the Core domain model.

\---

\# References

\* 001-ARCHITECTURE.md

\* 003-EXECUTION-TRANSACTION.md

\* 011-RUNTIME.md

\* 012-RUNTIME-STAGES.md

\* 013-VERIFICATION-ENGINE.md

\* 015-PLATFORM-ARCHITECTURE.md

\* 016-PLATFORM-GUARANTEES.md

\* ADR-0002 — Immutable Domain Model

\* ADR-0003 — Verification Is Independent

\* ADR-0004 — Runtime Pipeline

\* ADR-0007 — Deterministic Execution
