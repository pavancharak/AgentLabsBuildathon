\# Parmana SDK Conformance

\*\*Version:\*\* 1.0

\*\*Status:\*\* Canonical

\*\*Applies To:\*\* All Official Parmana SDKs

\---

\# 1. Purpose

This document defines the conformance requirements for all official Parmana SDKs.

Its purpose is to ensure that every SDK provides the same conceptual capabilities, public API, behavior, and developer experience regardless of implementation language.

An SDK that satisfies every requirement in this document may be designated an \*\*Official Parmana SDK\*\*.

\---

\# 2. Objectives

The conformance model ensures:

\* consistent developer experience

\* language parity

\* stable public APIs

\* predictable behavior

\* interoperability

\* long-term maintainability

\---

\# 3. Scope

This document applies to:

\* TypeScript SDK

\* Python SDK

\* Go SDK

\* Java SDK

\* .NET SDK

\* Rust SDK

\* Kotlin SDK

\* Swift SDK

\* Future official SDKs

\---

\# 4. Conformance Levels

SDKs are classified into one of the following levels.

\## Level 0 — Experimental

Prototype implementation.

Characteristics:

\* incomplete

\* unstable API

\* feature gaps permitted

\* not supported for production

\---

\## Level 1 — Developer Preview

Early public implementation.

Requirements:

\* implements most public APIs

\* basic documentation

\* basic tests

\* feature gaps documented

\---

\## Level 2 — Official SDK

Fully conformant implementation.

Requirements:

\* complete public API

\* complete domain model

\* language parity

\* comprehensive testing

\* official documentation

Only Level 2 SDKs may use the designation:

```text id="l2pn97"

Official Parmana SDK

```

\---

\# 5. Public API Conformance

Every Official SDK MUST expose the canonical public API.

Required client:

```text id="0g4a2m"

ParmanaClient

```

Required capabilities:

```text id="z2vbjj"

execute()



verify()



replay()



validatePolicy()



health()

```

Additional convenience APIs MAY be added provided they do not alter the canonical behavior.

\---

\# 6. Domain Model Conformance

Every Official SDK MUST expose the canonical Parmana domain model.

Required models:

```text id="76m5wa"

Authority



Authorization



Intent



PolicyReference



BusinessTransaction



Decision



Execution



ExecutionEvidence



Receipt



ExecutionTrustRecord



Verification



ReplayResult



Override

```

The meaning and relationships of these models must remain consistent across SDKs.

\---

\# 7. Error Model Conformance

Every Official SDK MUST implement the canonical SDK Error Model.

Required hierarchy:

```text id="w2ed3h"

ParmanaError



ConfigurationError



ValidationError



AuthenticationError



AuthorizationError



ExecutionRejectedError



VerificationError



ReplayError



NetworkError



TimeoutError



InternalServerError

```

Language-specific inheritance is permitted while preserving semantics.

\---

\# 8. Configuration Conformance

Every Official SDK MUST implement the canonical configuration model.

Required configuration concepts:

\* Runtime Endpoint

\* Authentication

\* Transport

\* Timeout

\* Retry Policy

\* TLS

\* Logging

\---

\# 9. Serialization Conformance

SDKs MUST preserve canonical serialization semantics.

Requirements:

\* UTF-8 encoding

\* JSON serialization

\* RFC 3339 timestamps where applicable

\* stable field names

\* deterministic request generation

SDKs MUST NOT silently modify application data.

\---

\# 10. Runtime Interaction

SDKs MUST communicate with the Parmana Runtime using supported Runtime interfaces.

SDKs MUST NOT implement:

\* policy evaluation

\* execution authorization

\* trust chain generation

\* verification algorithms

\* replay algorithms

These responsibilities belong exclusively to the Parmana Runtime.

\---

\# 11. Hidden Implementation

Official SDKs MUST NOT expose internal runtime implementation classes.

Examples include:

```text id="zjlwm8"

RuntimeEngine



PolicyEngine



ExecutionGate



DecisionBuilder



ExecutionBuilder



RuntimePipeline



ExecutionTrustPipeline



PolicyRouter

```

These remain internal platform components.

\---

\# 12. Documentation Requirements

Every Official SDK MUST include:

\* README

\* Installation Guide

\* Quick Start

\* API Reference

\* Examples

\* Changelog

\* License

Documentation should be synchronized with SDK releases.

\---

\# 13. Example Requirements

Every Official SDK MUST provide working examples for:

\* client creation

\* execute()

\* verify()

\* replay()

\* validatePolicy()

\* health()

All examples must compile and execute successfully against supported Runtime versions.

\---

\# 14. Testing Requirements

Official SDKs MUST include:

\## Unit Tests

Validate SDK functionality in isolation.

\---

\## Integration Tests

Validate communication with the Parmana Runtime.

\---

\## Conformance Tests

Verify implementation against this specification.

\---

\## Example Validation

Every published example must be executed as part of automated testing.

\---

\# 15. Versioning Conformance

SDKs MUST comply with the Parmana SDK Versioning policy.

Requirements include:

\* Semantic Versioning

\* documented compatibility

\* migration guidance for breaking changes

\* synchronized documentation

\---

\# 16. Performance Requirements

SDKs SHOULD:

\* minimize allocation overhead

\* reuse connections where appropriate

\* avoid unnecessary serialization

\* expose configurable timeouts

Performance optimizations must never change observable behavior.

\---

\# 17. Security Requirements

Official SDKs MUST:

\* validate configuration

\* protect credentials

\* support secure transport

\* avoid logging sensitive information

\* fail securely

SDKs MUST NOT weaken Runtime security guarantees.

\---

\# 18. Backward Compatibility

Minor and patch releases MUST preserve compatibility.

Breaking changes require:

\* major version increment

\* migration documentation

\* updated compatibility matrix

\---

\# 19. Language Parity

Every Official SDK must provide equivalent conceptual functionality.

Equivalent does not mean identical syntax.

SDKs should follow the idioms of their implementation language while preserving:

\* behavior

\* semantics

\* capabilities

\* terminology

\---

\# 20. Release Checklist

Before an SDK is released as an Official Parmana SDK, it must satisfy the following checklist.

\### Public API

\* ParmanaClient implemented

\* Canonical operations implemented

\* Stable public contract

\### Domain Model

\* Canonical domain models exposed

\* No conflicting SDK-specific models

\### Errors

\* Canonical error hierarchy implemented

\* Structured error information provided

\### Configuration

\* Canonical configuration model implemented

\* Configuration validation present

\### Testing

\* Unit tests passing

\* Integration tests passing

\* Conformance tests passing

\* Example validation passing

\### Documentation

\* README complete

\* API documentation complete

\* Examples complete

\* Changelog updated

\### Quality

\* No known critical defects

\* Public API reviewed

\* Version updated

\---

\# 21. Conformance Certification

An SDK may be designated an \*\*Official Parmana SDK\*\* only if it:

\* implements the canonical SDK Specification

\* conforms to the SDK Architecture

\* implements the canonical SDK API

\* implements the canonical Error Model

\* implements the canonical Configuration Model

\* follows the Versioning policy

\* satisfies every requirement in this document

Partial implementations should not be described as Official Parmana SDKs.

\---

\# 22. Future Evolution

Future SDK capabilities may be introduced without invalidating existing conformance, provided they:

\* preserve backward compatibility

\* follow the SDK Specification

\* maintain language parity

\* do not expose internal Runtime implementation details

\---

\# Summary

The Parmana SDK Conformance specification establishes the criteria that every official SDK must satisfy to provide a consistent, secure, and predictable developer experience.

By enforcing a shared public API, canonical domain model, standardized error handling, configuration, testing, documentation, and versioning, Parmana ensures that developers receive the same conceptual experience regardless of programming language while allowing each SDK to remain idiomatic to its ecosystem.
