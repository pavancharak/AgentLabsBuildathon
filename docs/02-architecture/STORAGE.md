\# Storage

\*\*Document:\*\* `docs/02-architecture/STORAGE.md`

\## Purpose

This document defines the \*\*Storage Layer\*\*, the physical persistence layer of the Parmana architecture.

The Storage Layer is responsible for durably storing authorization artifacts produced by the Parmana Runtime. It provides reliable, consistent, and durable persistence while remaining hidden behind the Repository abstraction.

This document specifies the architectural responsibilities of the Storage Layer rather than a specific database implementation.

This document is normative.

\---

\# Overview

The Parmana Runtime produces immutable authorization artifacts that must remain available for:

\* Independent verification

\* Replay

\* Compliance

\* Audit

\* Operational analysis

The Storage Layer provides durable persistence for these artifacts.

Unlike the Repository Layer, which defines the persistence interface, the Storage Layer implements the actual persistence mechanism.

\---

\# Architectural Position

```text

&#x20;                Parmana Runtime

&#x20;                       │

&#x20;                       ▼

&#x20;               Repository Layer

&#x20;                       │

&#x20;                       ▼

&#x20;                Storage Layer

&#x20;                       │

&#x20;       ┌───────────────┼───────────────┐

&#x20;       │               │               │

&#x20;       ▼               ▼               ▼

Execution Trust   Execution      Runtime Metadata

&#x20;   Records        Receipts

```

The Runtime never communicates directly with the Storage Layer.

All access occurs through the Repository.

\---

\# Responsibilities

The Storage Layer is responsible for:

\* Persisting authorization artifacts.

\* Maintaining durable storage.

\* Supporting record retrieval.

\* Preserving immutable records.

\* Supporting replay operations.

\* Supporting verification operations.

\* Maintaining data integrity.

The Storage Layer does \*\*not\*\*:

\* Perform Authority Verification.

\* Evaluate policies.

\* Produce Authorization Decisions.

\* Generate cryptographic signatures.

\* Execute business workflows.

\---

\# Storage Objects

The Storage Layer persists the following logical objects.

\## Execution Trust Records

The canonical authorization record.

Characteristics:

\* Immutable

\* Append-only

\* Replayable

\* Verifiable

Execution Trust Records are the primary persistence object.

\---

\## Execution Receipts

Portable authorization artifacts derived from Execution Trust Records.

Characteristics:

\* Immutable

\* Verifiable

\* Shareable

Execution Receipts never replace Execution Trust Records.

\---

\## Verification Metadata

Operational metadata describing verification.

Examples include:

\* Verification timestamp

\* Runtime version

\* Verification duration

Verification metadata supports operational analysis.

\---

\## Replay Metadata

Metadata required for replay operations.

Examples include:

\* Replay version

\* Verification algorithm version

\* Runtime compatibility information

\---

\# Logical Storage Model

Conceptually:

```text

Storage



├── Execution Trust Records

├── Execution Receipts

├── Verification Metadata

└── Replay Metadata

```

The physical implementation is implementation-specific.

\---

\# Storage Characteristics

The Storage Layer provides the following characteristics.

\## Durability

Successfully committed authorization artifacts must survive:

\* Runtime restart

\* System reboot

\* Process failure

Durability is mandatory.

\---

\## Immutability

Execution Trust Records and Execution Receipts are immutable.

Existing records are never modified.

Changes result in new records.

\---

\## Consistency

Storage must preserve:

\* Referential integrity

\* Stable identifiers

\* Record relationships

Incomplete persistence is not permitted.

\---

\## Availability

Stored authorization artifacts should remain accessible for:

\* Replay

\* Verification

\* Audit

\* Compliance review

Availability requirements depend upon deployment.

\---

\# Append-Only Model

Authorization history is append-only.

```text

Record 1



Record 2



Record 3



Record 4

```

Historical records remain unchanged.

New authorization events create new records.

\---

\# Record Relationships

The Storage Layer preserves relationships between persisted objects.

```text

Execution Trust Record

&#x20;       │

&#x20;       ▼

Execution Receipt



Execution Trust Record

&#x20;       │

&#x20;       ▼

Authorization Decision



Execution Trust Record

&#x20;       │

&#x20;       ▼

Execution Request

```

Relationships remain stable throughout the lifetime of each record.

\---

\# Storage Independence

The architecture does not require a specific storage technology.

Possible implementations include:

\* PostgreSQL

\* Supabase

\* Cloud SQL

\* Managed relational databases

\* Future storage systems

All implementations must preserve the architectural guarantees defined by Parmana.

\---

\# Physical Schema

The physical schema is implementation-specific.

Typical deployments may store:

\* Execution Trust Records

\* Execution Receipts

\* Verification Metadata

\* Runtime Metadata

The logical model remains consistent regardless of schema design.

\---

\# Transaction Model

Persistence operations should be atomic.

Conceptually:

```text

Persist Execution Trust Record

&#x20;           │

&#x20;           ▼

Persist Execution Receipt

&#x20;           │

&#x20;           ▼

Commit Transaction

```

If persistence fails, the Runtime must treat the authorization process as incomplete.

\---

\# Retrieval

The Storage Layer supports retrieval using stable identifiers.

Examples include:

\* Record Identifier

\* Request Identifier

\* Business Transaction Identifier

\* Authorization Decision Identifier

Query capabilities depend upon Repository implementations.

\---

\# Backup and Recovery

Implementations should support:

\* Regular backup

\* Point-in-time recovery

\* Disaster recovery

\* Integrity verification

Backup mechanisms are deployment-specific.

\---

\# Scalability

The Storage Layer should support growth in:

\* Authorization volume

\* Historical records

\* Concurrent requests

\* Replay operations

\* Verification requests

Scalability mechanisms are implementation-specific.

\---

\# Security Considerations

The Storage Layer should protect against:

\* Unauthorized modification

\* Unauthorized deletion

\* Corruption

\* Data loss

\* Identifier collision

Cryptographic integrity protection is defined separately in `CRYPTOGRAPHY.md`.

\---

\# Design Principles

The Storage Layer follows these principles:

\* Durable persistence.

\* Immutable authorization records.

\* Append-only history.

\* Stable identifiers.

\* Technology independence.

\* Repository isolation.

\* Replay support.

\---

\# What the Storage Layer Is Not

The Storage Layer is \*\*not\*\*:

\* a Repository,

\* a Verification Engine,

\* a Policy Engine,

\* a Runtime component,

\* an authorization engine.

It is the physical persistence implementation used by the Repository.

\---

\# Guarantees

The Storage Layer guarantees:

\* Durable storage of authorization artifacts.

\* Immutable Execution Trust Records.

\* Immutable Execution Receipts.

\* Stable record identifiers.

\* Append-only authorization history.

\* Retrieval of persisted artifacts.

\* Preservation of referential integrity.

\---

\# Relationship to Other Documents

This document specifies the physical persistence layer.

Related specifications include:

\* `REPOSITORY.md`

\* `CRYPTOGRAPHY.md`

\* `REPLAY.md`

Conceptual definitions include:

\* `01-concepts/EXECUTION\_TRUST\_RECORD.md`

\* `01-concepts/EXECUTION\_RECEIPT.md`

\---

\# Current Reference Implementation

The current Parmana reference implementation uses:

\* \*\*Repository Layer:\*\* Repository abstraction

\* \*\*Storage Backend:\*\* Supabase (PostgreSQL)

\* \*\*Persistence Model:\*\* Immutable Execution Trust Records

\* \*\*Record Integrity:\*\* SHA-256 hashing

\* \*\*Digital Signatures:\*\* Ed25519

These implementation choices are replaceable provided the architectural guarantees defined in this document continue to be satisfied.

\---

\# Summary

The Storage Layer provides the durable persistence foundation of the Parmana architecture.

It stores immutable authorization artifacts, preserves the integrity and traceability of Execution Trust Records, and enables replay, independent verification, and audit through reliable long-term persistence.

By remaining hidden behind the Repository abstraction, the Storage Layer allows Parmana to evolve its storage technologies without affecting the Runtime, authorization model, or trust guarantees.
