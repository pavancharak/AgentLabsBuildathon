\# Architecture

\*\*Document:\*\* `docs/02-architecture/ARCHITECTURE.md`

\## Purpose

This document defines the reference architecture of Parmana.

It describes the major architectural components, their responsibilities, their relationships, and the overall execution flow.

The architecture is implementation-independent. It specifies the logical structure of the Parmana platform rather than a particular programming language, deployment model, or storage technology.

This document is normative.

\---

\# Overview

Parmana is an \*\*Execution Authorization and Verification Infrastructure for Enterprise AI\*\*.

Its purpose is to ensure that high-impact business operations are executed only after organizational authority has been verified through explicit policy evaluation and trusted evidence.

Parmana does \*\*not\*\* execute business operations.

Parmana authorizes business operations.

Execution is performed by external execution systems after successful authorization.

\---

\# Architectural Principles

The Parmana architecture is built upon the following principles.

\## Separation of Concerns

Each architectural component has one clearly defined responsibility.

Examples:

\* Policy evaluation

\* Authority verification

\* Persistence

\* Cryptographic integrity

\* Receipt generation

Responsibilities do not overlap.

\---

\## Separation of Intelligence and Authority

AI systems may determine:

> What should happen.

Parmana determines:

> Whether the organization authorizes it.

Reasoning and authority remain separate.

\---

\## Deterministic Authorization

Equivalent inputs must produce equivalent Authorization Decisions.

Determinism enables:

\* Replay

\* Independent verification

\* Compliance

\* Audit

\---

\## Evidence-Based Trust

Authorization is based on verified evidence rather than assumptions.

Evidence includes:

\* Enterprise Facts

\* Human Authority Signals

\* AI-Derived Signals

\* Organizational Policy

\---

\## Technology Independence

The logical architecture does not depend upon:

\* Programming language

\* Database

\* Cloud provider

\* AI model

\* Workflow platform

Implementations may vary while preserving architectural behavior.

\---

\# High-Level Architecture

```text

&#x20;                          +---------------------------+

&#x20;                          |     AI Systems / Users    |

&#x20;                          +-------------+-------------+

&#x20;                                        |

&#x20;                                        | Execution Request

&#x20;                                        ▼

&#x20;                        +-------------------------------+

&#x20;                        |         Parmana Runtime        |

&#x20;                        +-------------------------------+

&#x20;                        |  Execution Engine             |

&#x20;                        |  Policy Engine                |

&#x20;                        |  Verification Engine          |

&#x20;                        |  Receipt Generation           |

&#x20;                        +---------------+---------------+

&#x20;                                        |

&#x20;                         +--------------+--------------+

&#x20;                         |                             |

&#x20;                         ▼                             ▼

&#x20;               Repository Layer              Cryptography Layer

&#x20;                         |                             |

&#x20;                         +--------------+--------------+

&#x20;                                        |

&#x20;                                        ▼

&#x20;                                Storage Layer

&#x20;                                        |

&#x20;                                        ▼

&#x20;                            Execution Trust Record

&#x20;                                        |

&#x20;                                        ▼

&#x20;                              Execution Receipt

&#x20;                                        |

&#x20;                                        ▼

&#x20;                          External Execution System

```

\---

\# Architectural Layers

Parmana is organized into six logical layers.

\## Layer 1 — Request Layer

Responsible for receiving Execution Requests.

Primary responsibilities:

\* API

\* Request validation

\* Authentication

\* Request normalization

Output:

\* Execution Request

\---

\## Layer 2 — Authorization Layer

The core of Parmana.

Responsible for:

\* Policy evaluation

\* Signal evaluation

\* Authority Verification

\* Authorization Decision

Output:

\* Authorization Decision

\---

\## Layer 3 — Trust Layer

Responsible for creating authorization evidence.

Produces:

\* Execution Trust Record

\* Execution Receipt

Provides:

\* Replay

\* Verification

\* Audit

\---

\## Layer 4 — Repository Layer

Provides persistence abstractions.

Responsibilities include:

\* Store records

\* Retrieve records

\* Query records

\* Maintain storage independence

\---

\## Layer 5 — Storage Layer

Responsible for physical persistence.

Examples:

\* PostgreSQL

\* Supabase

\* Future storage implementations

Storage technologies do not affect authorization behavior.

\---

\## Layer 6 — Integrity Layer

Provides cryptographic protection.

Responsibilities include:

\* Hashing

\* Digital signatures

\* Integrity verification

Integrity protects evidence.

It does not establish authority.

\---

\# Core Components

\## Execution Engine

Coordinates the complete authorization workflow.

Responsibilities:

\* Runtime orchestration

\* Stage management

\* Error handling

\* Lifecycle control

\---

\## Policy Engine

Evaluates Organizational Policies.

Responsibilities:

\* Resolve Policy References

\* Evaluate rules

\* Apply constraints

\* Determine policy compliance

\---

\## Verification Engine

Implements Authority Verification.

Responsibilities:

\* Validate evidence

\* Verify Human Authority

\* Evaluate Enterprise Facts

\* Evaluate AI-Derived Signals

\* Produce Authorization Decisions

\---

\## Repository

Provides the persistence abstraction.

The Runtime communicates only with the Repository.

The Runtime never depends directly upon storage technologies.

\---

\## Storage

Persists authorization artifacts.

Examples include:

\* Execution Trust Records

\* Receipts

\* Metadata

\---

\## Cryptography

Protects authorization artifacts.

Responsibilities:

\* SHA-256 hashing

\* Ed25519 signatures

\* Integrity verification

\---

\## Receipt Generation

Produces portable Execution Receipts from Execution Trust Records.

Receipts are optimized for sharing.

The Execution Trust Record remains the canonical record.

\---

\# Primary Data Flow

The logical execution flow is:

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Execution Request

&#x20;       │

&#x20;       ▼

Policy Resolution

&#x20;       │

&#x20;       ▼

Signal Collection

&#x20;       │

&#x20;       ▼

Authority Verification

&#x20;       │

&#x20;       ▼

Authorization Decision

&#x20;       │

&#x20;       ▼

Execution Trust Record

&#x20;       │

&#x20;       ▼

Execution Receipt

&#x20;       │

&#x20;       ▼

Execution System

```

Each stage produces deterministic outputs suitable for replay and verification.

\---

\# Component Dependencies

The dependencies between architectural components are intentionally one-directional.

```text

API

&#x20;│

&#x20;▼

Runtime

&#x20;│

&#x20;├── Execution Engine

&#x20;│

&#x20;├── Policy Engine

&#x20;│

&#x20;├── Verification Engine

&#x20;│

&#x20;▼

Repository

&#x20;│

&#x20;▼

Storage

&#x20;│

&#x20;▼

Cryptography

```

Higher layers depend only on lower abstractions.

Lower layers never depend on higher layers.

\---

\# Trust Boundaries

Parmana defines three trust boundaries.

\## External Boundary

AI systems and enterprise applications may propose execution.

They do not authorize execution.

\---

\## Authorization Boundary

Authority Verification determines whether execution is permitted.

This is the primary trust boundary.

\---

\## Execution Boundary

Execution systems consume Authorization Decisions.

Execution occurs only after successful authorization.

\---

\# Architectural Guarantees

The architecture provides the following guarantees:

\* AI systems never authorize their own actions.

\* Organizational Policy governs every authorization.

\* Human Authority remains the ultimate source of execution authority.

\* Authorization Decisions are deterministic.

\* Authorization evidence is immutable.

\* Execution Trust Records are the canonical source of truth.

\* Execution Receipts are derived from Execution Trust Records.

\* Authorization is independently verifiable.

\* Replay reproduces Authorization Decisions.

\* Runtime components remain independent of storage implementations.

\---

\# Extensibility

The architecture supports extension through well-defined interfaces.

Examples include:

\* New policy engines

\* Alternative storage implementations

\* Additional signal providers

\* New cryptographic algorithms

\* Additional SDKs

\* Alternative deployment environments

Extensions must preserve the architectural guarantees defined in this document.

\---

\# Relationship to Other Documents

This document provides the architectural overview.

Implementation details are specified in:

\* `RUNTIME.md`

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

The Parmana architecture separates AI reasoning from execution authority by introducing an independent authorization and verification layer between AI systems and enterprise execution systems.

Rather than trusting AI outputs directly, Parmana evaluates Execution Requests against organizational policies, verified enterprise evidence, and required human authority to produce deterministic Authorization Decisions.

The resulting Execution Trust Record becomes the canonical evidence of authorization, while the Execution Receipt provides a portable, cryptographically verifiable proof that can be consumed by external systems.

This architecture enables organizations to deploy autonomous AI into high-impact business workflows while preserving governance, accountability, and independent verification.
