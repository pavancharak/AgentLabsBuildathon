\# OpenAPI Specification v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

This specification defines the canonical OpenAPI contract for the Parmana API.

The OpenAPI document is derived from the locked architecture and API specifications.

It is the authoritative machine-readable API contract used for:

\* SDK generation

\* Client generation

\* Server stub generation

\* API documentation

\* API testing

The OpenAPI specification must remain consistent with the architecture documents.

\---

\# Scope

This specification defines:

\* OpenAPI version

\* API versioning

\* Resource organization

\* Schema organization

\* Security definition

\* Naming conventions

This specification does \*\*not\*\* define:

\* Business architecture

\* API semantics

\* Policy behavior

Those are defined by the Architecture Specifications.

\---

\# OpenAPI Version

Parmana uses:

```text

OpenAPI 3.1.0

```

\---

\# API Version

Current API version:

```text

v1

```

Example:

```text

/v1/transactions

```

Future API versions introduce new paths rather than changing existing behavior.

\---

\# API Base Path

Canonical base path:

```text

/v1

```

\---

\# Resource Groups

The OpenAPI document is organized by resource.

\## Business Transactions

```text

POST   /transactions



GET    /transactions/{businessTransactionId}

```

\---

\## Executions

```text

POST   /transactions/{businessTransactionId}/executions



GET    /transactions/{businessTransactionId}/executions



GET    /transactions/{businessTransactionId}/executions/{executionId}

```

\---

\## Override

```text

POST   /transactions/{businessTransactionId}/override



GET    /transactions/{businessTransactionId}/override

```

\---

\## Verification

```text

POST   /transactions/{businessTransactionId}/verify



GET    /transactions/{businessTransactionId}/verifications

```

\---

\## Receipt

```text

GET    /transactions/{businessTransactionId}/receipt



GET    /transactions/{businessTransactionId}/executions/{executionId}/receipt

```

\---

\## Trust Chain

```text

GET    /transactions/{businessTransactionId}/trust-chain

```

\---

\## Policies

```text

GET    /policies



GET    /policies/{name}/{version}

```

\---

\## System

```text

GET    /health



GET    /version

```

\---

\# Schema Organization

Schemas are grouped under:

```text

components/schemas

```

Canonical schemas include:

\* BusinessTransaction

\* Metadata

\* Policy

\* Signals

\* Decision

\* Override

\* Execution

\* Receipt

\* Verification

\* ExecutionTrustRecord

\* Error

\---

\# Security

Protected endpoints use:

```text

Bearer Authentication

```

Defined under:

```text

components/securitySchemes

```

Authentication mechanisms may evolve without changing API semantics.

\---

\# Response Model

Successful responses return:

```json

{

&#x20; "data": { }

}

```

Error responses return:

```json

{

&#x20; "error": {

&#x20;   "code": "...",

&#x20;   "message": "..."

&#x20; }

}

```

The OpenAPI document shall reference the canonical Request Response Model and Error Model.

\---

\# Naming Conventions

\## Paths

\* Lowercase

\* Hyphen-separated where required

\* Resource-oriented

Examples:

```text

/transactions



/trust-chain



/executions

```

\---

\## Schemas

PascalCase.

Examples:

```text

BusinessTransaction



Execution



Receipt

```

\---

\## Properties

camelCase.

Examples:

```text

businessTransactionId



executionId



schemaVersion

```

\---

\## Enumerations

UPPER\_SNAKE\_CASE.

Examples:

```text

APPROVED



REJECTED



PROCESSING



COMPLETED



FAILED

```

\---

\# Generation Principles

The OpenAPI document is generated from the frozen specifications.

It must not introduce:

\* New resources

\* New fields

\* New semantics

\* Alternative behaviors

The architecture specifications remain the authoritative source.

\---

\# Compatibility

Minor versions:

\* Additive only.

Major versions:

\* May introduce breaking changes.

Backward compatibility must be preserved within a major version.

\---

\# Canonical Principles

\## Principle 1

The OpenAPI specification is derived from the architecture specifications.

\---

\## Principle 2

The OpenAPI specification is the authoritative machine-readable API contract.

\---

\## Principle 3

The OpenAPI specification never introduces new architecture.

\---

\## Principle 4

Resources are organized around Business Transactions.

\---

\## Principle 5

Schemas follow consistent naming conventions.

\---

\## Principle 6

All protected endpoints use the canonical security definition.

\---

\## Principle 7

The OpenAPI specification enables deterministic SDK generation and API interoperability.

\---

\# Canonical Model

```text

Architecture Specifications



&#x20;       │



&#x20;       ▼



API Specifications



&#x20;       │



&#x20;       ▼



OpenAPI 3.1 Specification



&#x20;       │



&#x20;┌──────┼────────┬──────────┐



&#x20;▼      ▼        ▼          ▼



SDKs  Clients  Servers  Documentation

```

\---

\# Summary

The Parmana OpenAPI Specification is the machine-readable representation of the locked API architecture.

It is derived directly from the Business Transaction model, Request Response Model, Error Model, and all supporting architecture specifications.

By treating the OpenAPI document as an implementation artifact rather than the source of architectural truth, Parmana guarantees that generated SDKs, client libraries, server stubs, and documentation remain consistent with the frozen v1 architecture.
