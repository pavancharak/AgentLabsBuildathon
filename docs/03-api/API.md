\# API

\*\*Document:\*\* `docs/03-api/API.md`

\## Purpose

This document provides the normative specification for the \*\*Parmana REST API\*\*.

The API is the external interface through which AI systems, enterprise applications, workflow engines, and other clients interact with the Parmana Runtime.

The API allows clients to:

\* Submit Execution Requests.

\* Retrieve Execution Trust Records.

\* Retrieve Execution Receipts.

\* Verify Execution Receipts.

\* Replay Authorization Decisions.

\* Verify authorization artifacts.

This document defines the API architecture and guiding principles. Detailed request and response formats are specified in the accompanying API documents.

\---

\# Overview

The Parmana API exposes the Runtime as an \*\*Execution Authorization and Verification Service\*\*.

Rather than executing business operations, the API allows clients to request authorization before execution.

The Runtime evaluates organizational policy, verified evidence, and Human Authority to produce an Authorization Decision.

The API provides a stable, versioned interface independent of implementation technology.

\---

\# API Principles

The Parmana API is designed around the following principles.

\## Authorization First

Every business operation requiring governance is submitted to Parmana before execution.

The API authorizes actions.

It never performs the actions themselves.

\---

\## Deterministic Behavior

Equivalent requests produce equivalent authorization results when evaluated using identical policy versions and evidence.

This property enables:

\* Replay

\* Independent verification

\* Audit

\* Compliance

\---

\## Explicit Governance

Every authorization request references an explicit Policy Reference.

The API never infers organizational policy.

\---

\## Technology Independence

The API is independent of:

\* Programming language

\* AI model

\* Workflow platform

\* Storage technology

\* Cloud provider

Any client capable of making HTTPS requests can integrate with Parmana.

\---

\## Immutable Authorization

Authorization artifacts produced through the API are immutable.

Historical authorization decisions are never modified.

\---

\# API Architecture

The API provides access to the Parmana Runtime.

```text

Client

&#x20;  │

HTTPS

&#x20;  │

&#x20;  ▼

REST API

&#x20;  │

&#x20;  ▼

Runtime

&#x20;  │

&#x20;  ├── Execution Engine

&#x20;  ├── Policy Engine

&#x20;  ├── Verification Engine

&#x20;  ├── Repository

&#x20;  └── Receipt Generation

```

The API exposes Runtime capabilities without exposing internal implementation details.

\---

\# API Consumers

Typical API consumers include:

\* AI Agents

\* Enterprise Applications

\* ERP Systems

\* Workflow Engines

\* Financial Systems

\* Identity Platforms

\* Compliance Platforms

\* SDKs

\* Command-line tools

All consumers interact through the same versioned API.

\---

\# API Resources

The primary resources exposed by the API are:

| Resource | Description |

| ---------------------- | ------------------------------------------- |

| Execution Request | Authorization request submitted by a client |

| Execution Trust Record | Canonical authorization record |

| Execution Receipt | Portable authorization proof |

| Authorization Decision | Authorization outcome |

| Replay Result | Replay verification result |

| Verification Result | Integrity verification result |

\---

\# API Versioning

The API uses explicit versioning.

Example:

```text

/v1/

```

Versioning ensures:

\* Backward compatibility

\* Predictable evolution

\* Stable client integrations

Breaking changes require a new API version.

\---

\# Resource Lifecycle

The typical API interaction follows this sequence.

```text

Client

&#x20;  │

&#x20;  ▼

Submit Execution Request

&#x20;  │

&#x20;  ▼

Authority Verification

&#x20;  │

&#x20;  ▼

Authorization Decision

&#x20;  │

&#x20;  ▼

Execution Trust Record

&#x20;  │

&#x20;  ▼

Execution Receipt

&#x20;  │

&#x20;  ▼

Client

```

Replay and verification operate on previously generated authorization artifacts.

\---

\# Primary Endpoints

The reference implementation exposes the following endpoints.

| Method | Endpoint | Purpose |

| ------ | ---------------------------------- | ---------------------------------- |

| POST | `/v1/execution-requests` | Submit an Execution Request |

| GET | `/v1/execution-requests/{id}` | Retrieve an Execution Request |

| GET | `/v1/execution-trust-records/{id}` | Retrieve an Execution Trust Record |

| GET | `/v1/execution-receipts/{id}` | Retrieve an Execution Receipt |

| POST | `/v1/execution-receipts/verify` | Verify an Execution Receipt |

| POST | `/v1/replay` | Replay an Authorization Decision |

| POST | `/v1/verify` | Verify authorization artifacts |

| GET | `/v1/health` | Runtime health |

| GET | `/v1/version` | Runtime version information |

Future versions may introduce additional endpoints while preserving compatibility.

\---

\# Request Processing

Every API request follows the same high-level lifecycle.

```text

Receive Request

&#x20;      │

Authenticate

&#x20;      │

Validate Request

&#x20;      │

Route Request

&#x20;      │

Execute Runtime Operation

&#x20;      │

Generate Response

&#x20;      │

Return Response

```

Authorization requests invoke the full Runtime authorization pipeline.

\---

\# Authentication

All protected API endpoints require authentication.

The reference implementation uses:

```text

Authorization: Bearer <token>

```

Authentication verifies client identity.

Authorization decisions remain governed by organizational policy rather than client authentication alone.

\---

\# Content Type

The API exchanges JSON documents.

Request:

```http

Content-Type: application/json

```

Response:

```http

Content-Type: application/json

```

Canonical serialization for cryptographic operations is defined separately in `CRYPTOGRAPHY.md`.

\---

\# Response Model

Successful responses may contain:

\* Authorization Decision

\* Execution Receipt

\* Execution Trust Record

\* Verification Result

\* Replay Result

Each response follows a consistent JSON structure defined in `RESPONSES.md`.

\---

\# Error Model

Errors are returned using structured JSON responses.

Typical error categories include:

\* Validation errors

\* Authentication failures

\* Authorization failures

\* Policy resolution failures

\* Verification failures

\* Repository failures

\* Cryptographic verification failures

The complete error model is defined in `ERROR\_CODES.md`.

\---

\# Security

The API is designed to operate over HTTPS.

Security objectives include:

\* Confidentiality

\* Authentication

\* Integrity

\* Replay protection

\* Request validation

Cryptographic protection of authorization artifacts is specified separately.

\---

\# Idempotency

Authorization requests should include stable request identifiers.

Duplicate requests with the same identifier should not produce duplicate authorization artifacts.

Idempotency behavior is implementation-specific but recommended for production deployments.

\---

\# Relationship to the Runtime

The API is an interface to the Runtime.

It does not implement:

\* Authority Verification

\* Policy evaluation

\* Cryptography

\* Repository operations

Those responsibilities belong to Runtime components.

\---

\# Design Principles

The Parmana API follows these principles:

\* RESTful design.

\* Explicit versioning.

\* Stateless communication.

\* Deterministic behavior.

\* Technology independence.

\* Stable contracts.

\* Security by default.

\* Clear separation between authorization and execution.

\---

\# Relationship to Other Documents

This document provides the API overview.

Detailed specifications are provided in:

\* `REST.md`

\* `REQUESTS.md`

\* `RESPONSES.md`

\* `ERROR\_CODES.md`

\* `EXAMPLES.md`

Runtime behavior is specified in:

\* `docs/02-architecture/RUNTIME.md`

Conceptual definitions are specified in:

\* `docs/01-concepts/`

\---

\# Current Reference Implementation

The current Parmana reference implementation provides:

\* REST-based HTTP API

\* JSON request and response payloads

\* Bearer token authentication

\* Execution Request submission

\* Execution Trust Record persistence

\* Execution Receipt generation

\* Receipt verification

\* Replay support

Future implementations may expose additional protocols (such as gRPC or messaging interfaces) while preserving the semantics defined by this API specification.

\---

\# Summary

The Parmana API provides a stable, versioned, and technology-independent interface for execution authorization and verification.

By exposing the Runtime through a consistent REST API, Parmana enables AI systems, enterprise applications, and workflow engines to request authorization, retrieve authorization evidence, verify execution receipts, and replay historical authorization decisions while preserving organizational governance, deterministic behavior, and independent verification.
