\# Runtime

\*\*Document:\*\* `docs/02-architecture/RUNTIME.md`

\## Purpose

This document defines the \*\*Parmana Runtime\*\*, the execution environment responsible for processing Execution Requests and producing Authorization Decisions.

The Runtime coordinates all architectural components involved in authorization while preserving the guarantees defined by the Parmana Trust Model.

This document describes runtime behavior. It does not define business concepts or API contracts.

This document is normative.

\---

\# Overview

The Parmana Runtime is the central orchestration layer of the platform.

Its responsibility is to transform an incoming Execution Request into a deterministic Authorization Decision using organizational policy, verified evidence, and Human Authority.

The Runtime never performs business operations itself.

Its sole responsibility is authorization.

\---

\# Responsibilities

The Runtime is responsible for:

\* Receiving Execution Requests.

\* Validating requests.

\* Resolving Policy References.

\* Collecting required signals.

\* Coordinating Authority Verification.

\* Producing Authorization Decisions.

\* Persisting Execution Trust Records.

\* Generating Execution Receipts.

\* Returning authorization results.

\---

\# Runtime Position

The Runtime sits between execution request producers and execution systems.

```text id="3t2qpb"

AI Systems

Applications

Workflow Engines

Users

&#x20;       │

&#x20;       ▼

+---------------------------+

|      Parmana Runtime      |

+---------------------------+

&#x20;       │

&#x20;       ▼

Authorization Decision

&#x20;       │

&#x20;       ▼

Execution Systems

```

Execution systems never bypass the Runtime.

\---

\# Runtime Architecture

The Runtime coordinates several specialized components.

```text id="9t3x5n"

&#x20;               Runtime

&#x20;                  │

&#x20;  ┌───────────────┼───────────────┐

&#x20;  │               │               │

Execution      Policy        Verification

&#x20;Engine         Engine          Engine

&#x20;  │               │               │

&#x20;  └───────────────┼───────────────┘

&#x20;                  │

&#x20;             Repository

&#x20;                  │

&#x20;              Storage

&#x20;                  │

&#x20;           Cryptography

&#x20;                  │

&#x20;        Receipt Generation

```

Each component has a single responsibility.

\---

\# Runtime Lifecycle

Every Execution Request follows the same lifecycle.

```text id="7drzh4"

Receive Request

&#x20;      │

&#x20;      ▼

Validate Request

&#x20;      │

&#x20;      ▼

Resolve Policy

&#x20;      │

&#x20;      ▼

Collect Signals

&#x20;      │

&#x20;      ▼

Validate Signals

&#x20;      │

&#x20;      ▼

Authority Verification

&#x20;      │

&#x20;      ▼

Authorization Decision

&#x20;      │

&#x20;      ▼

Persist Execution Trust Record

&#x20;      │

&#x20;      ▼

Generate Execution Receipt

&#x20;      │

&#x20;      ▼

Return Response

```

The Runtime executes these stages in order.

\---

\# Stage 1 — Receive Request

The Runtime accepts an Execution Request from an authenticated client.

Typical request sources include:

\* AI Agents

\* Enterprise Applications

\* Workflow Engines

\* REST API Clients

\* Internal Services

The Runtime treats every request uniformly.

\---

\# Stage 2 — Validate Request

The Runtime validates that:

\* the request is well-formed,

\* required fields are present,

\* identifiers are valid,

\* the request is internally consistent,

\* authentication has succeeded.

Invalid requests are rejected immediately.

\---

\# Stage 3 — Resolve Policy

The Runtime resolves the Policy Reference contained in the Execution Request.

Resolution identifies:

\* governing policy,

\* policy version,

\* required evidence,

\* approval requirements,

\* authorization rules.

Policy resolution is deterministic.

\---

\# Stage 4 — Collect Signals

The Runtime gathers the evidence required by the resolved policy.

Signal sources include:

\* Enterprise systems

\* Human approval systems

\* AI services

\* Identity providers

Only required signals are collected.

\---

\# Stage 5 — Validate Signals

Collected signals are validated.

Validation includes:

\* integrity,

\* completeness,

\* authenticity,

\* freshness,

\* schema correctness.

Invalid signals terminate authorization.

\---

\# Stage 6 — Authority Verification

The Runtime delegates verification to the Verification Engine.

Authority Verification evaluates:

\* Organizational Policy

\* Enterprise Facts

\* Human Authority

\* AI-Derived Signals

\* Execution Context

The result is an Authorization Decision.

\---

\# Stage 7 — Persist Execution Trust Record

Following Authority Verification, the Runtime creates the canonical Execution Trust Record.

The ETR contains:

\* Execution Request

\* Authorization Decision

\* Policy information

\* Evaluated evidence

\* Verification metadata

The Runtime persists the ETR using the Repository.

\---

\# Stage 8 — Generate Execution Receipt

After successfully persisting the ETR, the Runtime generates an Execution Receipt.

The receipt:

\* references the ETR,

\* preserves cryptographic integrity,

\* provides portable proof of authorization.

The Execution Receipt is returned to the requesting client.

\---

\# Stage 9 — Return Authorization Result

The Runtime returns:

\* Authorization Decision

\* Execution Receipt

\* Status information

The Runtime never performs business execution.

Execution remains the responsibility of external systems.

\---

\# Runtime State Model

Conceptually, every request progresses through a series of states.

```text id="4ej52w"

Received

&#x20;   │

Validated

&#x20;   │

Policy Resolved

&#x20;   │

Signals Collected

&#x20;   │

Verified

&#x20;   │

Authorized

&#x20;   │

Recorded

&#x20;   │

Receipt Generated

&#x20;   │

Completed

```

State transitions are deterministic.

\---

\# Failure Handling

The Runtime terminates processing when:

\* request validation fails,

\* policy cannot be resolved,

\* required evidence is unavailable,

\* verification fails,

\* repository persistence fails,

\* integrity protection cannot be applied.

No Authorization Decision is considered complete until the Execution Trust Record has been successfully persisted.

\---

\# Runtime Guarantees

The Runtime guarantees that:

\* every request is evaluated independently,

\* every request follows the same lifecycle,

\* policy selection is explicit,

\* authorization is deterministic,

\* execution never precedes authorization,

\* every completed authorization produces exactly one Execution Trust Record,

\* every Execution Receipt is derived from an Execution Trust Record.

\---

\# Concurrency

The Runtime supports concurrent processing of independent Execution Requests.

Each request is isolated.

Processing one request must not alter the authorization outcome of another request.

Determinism is preserved regardless of execution order.

\---

\# Error Recovery

The Runtime is designed so that partially completed authorization cannot result in unauthorized execution.

If processing fails:

\* authorization terminates,

\* no Execution Receipt is issued,

\* incomplete authorization is not treated as successful.

Recovery mechanisms are implementation-specific.

\---

\# Runtime Interfaces

The Runtime interacts with the following architectural components:

| Component | Responsibility |

| ------------------- | --------------------------------- |

| Execution Engine | Orchestrates lifecycle |

| Policy Engine | Evaluates organizational policies |

| Verification Engine | Implements Authority Verification |

| Repository | Persists authorization artifacts |

| Storage | Physical persistence |

| Cryptography | Integrity protection |

| Receipt Generation | Produces Execution Receipts |

The Runtime coordinates these components without exposing their internal implementations.

\---

\# Design Principles

The Runtime follows these principles:

\* Stateless request processing.

\* Deterministic behavior.

\* Explicit policy selection.

\* Evidence-driven authorization.

\* Immutable authorization records.

\* Technology-independent architecture.

\* Separation of authorization and execution.

\---

\# Relationship to Other Documents

This document defines the overall Runtime lifecycle.

Detailed component behavior is specified in:

\* `EXECUTION\_ENGINE.md`

\* `POLICY\_ENGINE.md`

\* `VERIFICATION\_ENGINE.md`

\* `REPOSITORY.md`

\* `STORAGE.md`

\* `CRYPTOGRAPHY.md`

\* `RECEIPT\_GENERATION.md`

\* `REPLAY.md`

\---

\# Summary

The Parmana Runtime is the orchestration layer responsible for transforming an Execution Request into a deterministic Authorization Decision.

By coordinating policy evaluation, evidence collection, Authority Verification, persistence, cryptographic integrity, and receipt generation, the Runtime provides a consistent execution authorization process that is independent of AI models, enterprise applications, and storage technologies.

The Runtime authorizes execution. It never performs execution itself.
