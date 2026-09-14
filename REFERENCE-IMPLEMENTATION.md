\# Parmana Reference Implementation

\*\*Version:\*\* 0.1.0

\*\*Status:\*\* Active

\---

\# Purpose

This document defines the official reference implementation of the Parmana Specification.

The reference implementation demonstrates one correct implementation of the specification.

It is not the specification itself.

Other implementations MAY differ internally while remaining conformant.

\---

\# Principles

The reference implementation SHALL:

\* Conform to the Parmana Specification.

\* Preserve all Platform Guarantees.

\* Preserve all accepted ADRs.

\* Serve as executable documentation.

The implementation is intended to demonstrate correctness rather than maximize performance.

\---

\# Repository Structure

```text

packages/



core/

runtime/

verification/

crypto/

storage/

sdk/

api/

cli/

```

Each package corresponds to a logical component defined by the specification.

\---

\# Package Responsibilities

\## @parmana/core

Defines:

\* Value Objects

\* Domain Objects

\* Aggregate Roots

\* Shared Types

Contains no infrastructure code.

\---

\## @parmana/runtime

Responsible for:

\* Runtime orchestration

\* Runtime pipeline

\* Execution stages

Produces immutable `ExecutionTransaction` instances.

\---

\## Verification

Verification is not a separate package. It lives in
`packages/runtime/src/services/verification-service.ts` and runs on the
live execution path (`ExecutionTrustApplication.execute()` /
`POST /verify`), checking:

\* Integrity — recomputed trust-record hash matches the stored hash

\* Signature — cryptographic signature verifies against the stored key

\* Authorization binding — every APPROVED execution carries an authorizationId

A separate six-stage `@parmana/verification` pipeline package (Authority /
Authorization / Intent / Evidence / Signature stages) previously existed as
unwired scaffolding — no real implementation, no real test coverage — and
was retired in Session 5. Authority, Intent, and Evidence checks remain
unimplemented; see docs/CLAIMS.md's Future Claims.

\---

\## @parmana/crypto

Responsible for:

\* Hash providers

\* Signature providers

\* Integrity verification

Contains no business logic.

\---

\## @parmana/storage

Responsible for:

\* Repository interfaces

\* Persistence

\* Serialization

Storage remains replaceable.

\---

\## @parmana/sdk

Provides:

\* Public APIs

\* Builders

\* Developer utilities

Hides internal implementation details.

\---

\## @parmana/api

Provides HTTP access.

Responsibilities include:

\* Request validation

\* Routing

\* Response serialization

Delegates execution to the Runtime.

\---

\## @parmana/cli

Provides command-line tooling.

Capabilities include:

\* Execute

\* Verify

\* Replay

\* Inspect

\* Export

\---

\# Package Dependencies

Dependencies flow inward.

```text

CLI

API

SDK

&#x20;    │

&#x20;    ▼

Runtime

Verification

Storage

Crypto

&#x20;    │

&#x20;    ▼

Core

```

Core has no dependency on higher-level packages.

\---

\# Testing Strategy

Each package SHALL include:

\* Unit tests

\* Integration tests (where applicable)

\* Conformance tests

\* Documentation examples

\---

\# Reference Quality

The reference implementation prioritizes:

1\. Correctness

2\. Readability

3\. Determinism

4\. Testability

5\. Maintainability

Performance optimizations SHALL NOT compromise platform guarantees.

\---

\# Conformance

The reference implementation is considered conformant when:

\* All specifications are implemented.

\* All ADRs are preserved.

\* Conformance tests pass.

\* Platform guarantees remain satisfied.

\---

\# Future Implementations

Alternative implementations MAY:

\* Use different programming languages.

\* Use different databases.

\* Use different runtime environments.

\* Use different cryptographic providers.

Alternative implementations SHALL preserve the externally observable behavior defined by the Parmana Specification.

\---

\# Summary

The reference implementation serves as the canonical executable realization of the Parmana Specification.

It demonstrates how Execution Trust can be achieved through deterministic execution, immutable domain models, append-only evidence, independent verification, and cryptographic integrity while remaining implementation independent.
