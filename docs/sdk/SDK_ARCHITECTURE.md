\# Parmana SDK Architecture

\*\*Version:\*\* 1.0

\*\*Status:\*\* Canonical

\*\*Applies To:\*\* All Parmana SDKs (TypeScript, Python, and future SDKs)

\---

\# Purpose

This document defines the architecture of the Parmana Software Development Kits (SDKs).

The SDK architecture establishes a consistent, language-independent contract for interacting with the Parmana Execution Trust Infrastructure.

Every SDK MUST conform to this architecture.

\---

\# Goals

The Parmana SDKs are designed to:

\* Provide a simple developer experience.

\* Expose Parmana as a product rather than a collection of internal packages.

\* Maintain feature parity across programming languages.

\* Provide strongly typed access to canonical Parmana domain models.

\* Hide internal implementation details.

\* Preserve forward compatibility.

\---

\# Non-Goals

The SDKs do NOT:

\* Evaluate policies.

\* Authorize execution.

\* Execute business operations.

\* Generate trust records.

\* Perform verification algorithms.

\* Perform deterministic replay.

\* Expose internal runtime architecture.

These responsibilities belong to the Parmana Runtime.

\---

\# Design Principles

The SDK architecture follows these principles.

\## Product-Oriented API

Developers interact with Parmana.

They do not interact with Runtime, Policy, Verification, or Replay packages individually.

\---

\## One Client

Every SDK exposes a single public client.

```text

ParmanaClient

```

All SDK capabilities begin with this client.

\---

\## Thin Client

The SDK is a thin interface over the Parmana platform.

Business logic remains inside the Parmana Runtime.

\---

\## Stable Public Contract

The SDK exposes only stable APIs.

Internal implementation changes must not require SDK consumers to change their code.

\---

\## Language Parity

All official SDKs expose the same conceptual capabilities.

Language syntax may differ, but behavior and semantics must remain consistent.

\---

\## Strong Typing

SDKs expose canonical Parmana domain models using the native type system of each language.

\---

\## Deterministic Behavior

The SDK must preserve deterministic request and response semantics.

It must never introduce behavior that changes authorization outcomes.

\---

\# High-Level Architecture

```text

Application

&#x20;     │

&#x20;     ▼

Parmana SDK

&#x20;     │

&#x20;     ▼

Parmana Runtime

&#x20;     │

&#x20;     ▼

Execution Trust Infrastructure

```

The SDK is the public interface to the Parmana platform.

\---

\# Public SDK Surface

The public API consists of:

```text

ParmanaClient



Configuration



Domain Models



Errors

```

Everything else is considered internal.

\---

\# Canonical Client

Every SDK MUST expose:

```text

ParmanaClient

```

The client represents a connection to a Parmana Runtime.

All SDK operations originate from this client.

\---

\# SDK Capabilities

Version 1.0 defines the following capabilities.

```text

execute()



verify()



replay()



validatePolicy()



health()

```

Additional capabilities may be introduced in future versions without breaking existing APIs.

\---

\# Canonical Domain Model

SDKs expose the canonical Parmana domain model.

```text

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

No SDK-specific business models should be introduced unless absolutely necessary.

\---

\# Domain Model Ownership

The canonical domain model is defined by the Parmana core.

SDKs must not redefine or modify these models.

Where practical, SDKs should reuse the canonical model rather than duplicate it.

\---

\# Configuration

Every SDK provides configuration for:

```text

Runtime Endpoint



Authentication



Transport



Retry Policy



Timeouts

```

Configuration concerns belong to the SDK.

Business concerns do not.

\---

\# Error Model

Every SDK exposes a consistent error hierarchy.

```text

ParmanaError



ValidationError



AuthorizationError



ExecutionRejectedError



VerificationError



ReplayError



ConfigurationError



NetworkError

```

Applications should rely on structured error types rather than parsing error messages.

\---

\# Internal Components

The following components are implementation details.

SDKs MUST NOT expose them as part of the public API.

```text

RuntimeEngine



PolicyEngine



ExecutionGate



DecisionBuilder



ExecutionBuilder



RuntimePipeline



ExecutionTrustPipeline



PolicyRouter

```

These remain internal to the Parmana platform.

\---

\# TypeScript Architecture

```text

typescript/



src/



&#x20;   client/



&#x20;       ParmanaClient.ts



&#x20;   config/



&#x20;   models/



&#x20;   errors/



&#x20;   version.ts



&#x20;   index.ts

```

The TypeScript SDK should re-export canonical domain models where practical instead of duplicating them.

\---

\# Python Architecture

```text

python/



parmana/



&#x20;   client.py



&#x20;   config/



&#x20;   models/



&#x20;   errors/



&#x20;   version.py



&#x20;   \_\_init\_\_.py

```

The Python SDK mirrors the same conceptual architecture using Python conventions.

\---

\# Package Responsibilities

\## ParmanaClient

Provides the primary interface to the Parmana Runtime.

Responsible for invoking SDK capabilities.

\---

\## Configuration

Manages runtime connection settings.

\---

\## Domain Models

Expose immutable representations of Parmana artifacts.

\---

\## Errors

Represent structured SDK failures.

\---

\# Runtime Interaction

The SDK communicates with the Parmana Runtime.

The Runtime performs:

\* Policy loading

\* Policy evaluation

\* Decision creation

\* Execution authorization

\* Execution

\* Trust record generation

\* Verification

\* Replay

The SDK never performs these operations locally.

\---

\# Extensibility

Future SDK capabilities must extend the existing architecture without breaking the public contract.

Backward compatibility is a primary design objective.

\---

\# Versioning

All SDKs follow Semantic Versioning.

Breaking API changes require a major version increment.

Feature additions require a minor version increment.

Bug fixes require a patch version increment.

\---

\# Compatibility

Official SDKs should maintain feature parity whenever practical.

Language-specific improvements are permitted provided they do not alter the conceptual API.

\---

\# Testing

Every SDK must include:

\* Unit tests

\* Integration tests

\* Example validation

\* Conformance tests against the SDK Specification

\---

\# Documentation

Every SDK must provide:

\* README

\* Installation Guide

\* Quick Start

\* API Reference

\* Examples

\* Migration Guide (when applicable)

\---

\# Architectural Guarantees

The Parmana SDK architecture guarantees:

\* A single, consistent developer experience.

\* Stable public APIs.

\* Consistent domain models.

\* Hidden implementation details.

\* Language parity.

\* Forward compatibility.

\---

\# Summary

The Parmana SDK is the canonical developer interface to the Parmana Execution Trust Infrastructure.

It presents Parmana as a single product through a unified client while hiding internal implementation details.

This architecture enables multiple language implementations to provide a consistent, predictable, and maintainable developer experience while remaining aligned with the core Parmana platform.
