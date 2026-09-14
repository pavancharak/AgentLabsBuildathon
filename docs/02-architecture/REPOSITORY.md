\# Repository

\*\*Document:\*\* `docs/02-architecture/REPOSITORY.md`

\## Purpose

This document defines the \*\*Repository Layer\*\*, the persistence abstraction of the Parmana Runtime.

The Repository Layer provides a technology-independent interface for storing and retrieving authorization artifacts. It isolates the Runtime from storage implementations, allowing different databases or persistence technologies to be used without changing runtime behavior.

This document is normative.

\---

\# Overview

The Parmana Runtime produces authorization artifacts such as:

\* Execution Trust Records

\* Execution Receipts

\* Replay metadata

\* Verification metadata

These artifacts must be stored reliably and retrieved consistently.

Rather than allowing runtime components to communicate directly with databases, Parmana introduces a Repository Layer that acts as the single persistence interface.

\---

\# Responsibilities

The Repository Layer is responsible for:

\* Persisting authorization artifacts.

\* Retrieving stored artifacts.

\* Maintaining storage abstraction.

\* Providing deterministic persistence behavior.

\* Supporting replay and verification.

\* Preserving immutable authorization records.

The Repository Layer does \*\*not\*\*:

\* Evaluate policies.

\* Perform Authority Verification.

\* Execute business operations.

\* Generate cryptographic signatures.

\* Produce Authorization Decisions.

\---

\# Architectural Position

```text id="w3j2fa"

Execution Engine

&#x20;      │

&#x20;      ▼

Verification Engine

&#x20;      │

&#x20;      ▼

Repository Layer

&#x20;      │

&#x20;      ▼

Storage Implementation

```

The Runtime communicates only with the Repository Layer.

Storage technologies remain hidden behind the Repository interface.

\---

\# Design Goals

The Repository Layer exists to achieve the following objectives.

\## Storage Independence

Runtime components never depend upon a specific database.

Supported implementations may include:

\* PostgreSQL

\* Supabase

\* Cloud SQL

\* Distributed databases

\* Future implementations

Changing storage should not require changes to Runtime logic.

\---

\## Consistent Persistence

All authorization artifacts are stored through the same abstraction.

This ensures:

\* consistent behavior,

\* simplified testing,

\* predictable replay,

\* easier maintenance.

\---

\## Deterministic Retrieval

Retrieving a stored artifact should always produce the same result for the same identifier.

Repository implementations must not modify persisted authorization records.

\---

\# Repository Architecture

Conceptually:

```text id="9nqz3j"

Runtime

&#x20;  │

&#x20;  ▼

Repository Interface

&#x20;  │

&#x20;  ├── Store Execution Trust Record

&#x20;  ├── Retrieve Execution Trust Record

&#x20;  ├── Store Execution Receipt

&#x20;  ├── Retrieve Execution Receipt

&#x20;  ├── Query Records

&#x20;  └── Replay Access

&#x20;  │

&#x20;  ▼

Storage Implementation

```

The Repository defines \*\*operations\*\*, not storage technology.

\---

\# Repository Objects

The Repository manages the following logical objects.

\## Execution Trust Record

Canonical authorization evidence.

The Repository provides:

\* Store

\* Retrieve

Execution Trust Records are immutable.

\---

\## Execution Receipt

Portable authorization proof.

The Repository provides:

\* Store

\* Retrieve

Execution Receipts are derived from Execution Trust Records.

\---

\## Replay Metadata

Metadata supporting replay operations.

Examples include:

\* Runtime version

\* Verification version

\* Replay status

\---

\## Verification Metadata

Operational information describing the authorization process.

Examples include:

\* Verification timestamp

\* Processing duration

\* Runtime identifier

\---

\# Repository Operations

Conceptually, the Repository exposes the following operations.

```text id="kvv98r"

Repository



Store()



Retrieve()



Exists()



Query()



ReplayLookup()



VerifyIntegrity()

```

The actual programming interface is implementation-specific.

\---

\# Persistence Rules

The Repository follows these rules.

\## Immutable Records

Execution Trust Records are immutable.

Once stored, they MUST NOT be modified.

\---

\## Append-Only Behavior

Authorization history is append-only.

Changes create new records rather than modifying existing ones.

\---

\## Stable Identifiers

Every persisted object has a stable identifier.

Identifiers never change.

\---

\## Referential Integrity

Relationships between objects remain valid.

Examples:

Execution Receipt → Execution Trust Record

Execution Trust Record → Execution Request

Authorization Decision → Policy Reference

\---

\# Repository Transactions

Repository operations should behave atomically.

For example:

```text id="2f2k2v"

Persist ETR

&#x20;     │

&#x20;     ▼

Persist Receipt

&#x20;     │

&#x20;     ▼

Commit

```

If persistence cannot be completed successfully, the Runtime must treat the authorization process as incomplete.

\---

\# Query Model

Repository queries should support retrieval by:

\* Record Identifier

\* Request Identifier

\* Business Transaction Identifier

\* Authorization Decision

\* Policy Reference

\* Time range

Query capabilities may vary by implementation.

\---

\# Replay Support

Replay retrieves authorization artifacts through the Repository.

```text id="cp58ps"

Replay

&#x20;  │

&#x20;  ▼

Repository

&#x20;  │

&#x20;  ▼

Execution Trust Record

```

Replay never depends directly on storage implementation.

\---

\# Repository Independence

The Runtime interacts only with the Repository abstraction.

The Runtime does not know whether persistence is implemented using:

\* SQL

\* NoSQL

\* Cloud services

\* Object storage

\* Distributed storage

This separation improves portability and testability.

\---

\# Error Handling

Repository operations may fail due to:

\* storage unavailability,

\* integrity violations,

\* identifier conflicts,

\* transaction failures,

\* infrastructure errors.

Repository failures prevent authorization completion.

\---

\# Security Considerations

The Repository protects against:

\* unauthorized modification,

\* unauthorized deletion,

\* identifier collision,

\* inconsistent persistence,

\* incomplete authorization records.

Access control is implementation-specific.

\---

\# Design Principles

The Repository follows these principles:

\* Technology independence.

\* Immutable persistence.

\* Deterministic retrieval.

\* Stable identifiers.

\* Storage abstraction.

\* Append-only authorization history.

\* Replay support.

\---

\# What the Repository Is Not

The Repository is \*\*not\*\*:

\* a database,

\* a storage engine,

\* a Policy Engine,

\* a Verification Engine,

\* a Runtime,

\* an audit system.

It is the persistence abstraction used by the Runtime.

\---

\# Guarantees

The Repository guarantees:

\* Runtime independence from storage technology.

\* Immutable Execution Trust Records.

\* Stable object identifiers.

\* Deterministic retrieval.

\* Consistent persistence interfaces.

\* Replay access to authorization artifacts.

\* Append-only authorization history.

\---

\# Relationship to Other Documents

This document defines the persistence abstraction.

Implementation details are described in:

\* `STORAGE.md`

\* `CRYPTOGRAPHY.md`

\* `REPLAY.md`

Conceptual definitions are described in:

\* `01-concepts/EXECUTION\_TRUST\_RECORD.md`

\* `01-concepts/EXECUTION\_RECEIPT.md`

\---

\# Summary

The Repository Layer is the persistence abstraction of the Parmana Runtime.

It isolates runtime components from storage technologies while providing a deterministic, immutable, and replayable interface for storing and retrieving authorization artifacts.

By separating persistence from business logic, the Repository enables Parmana to evolve its storage implementations without affecting the authorization model or the guarantees provided by the platform.
