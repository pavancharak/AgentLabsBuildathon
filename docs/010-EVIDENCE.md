\# Evidence Specification

\*\*Document:\*\* 010-EVIDENCE.md

\*\*Version:\*\* 1.0.0 (Draft)

\*\*Status:\*\* Implementation Specification

\---

\# Purpose

This document defines the Evidence architecture of the Parmana platform.

Evidence is the permanent, immutable record of an ExecutionTransaction.

Evidence enables independent verification.

Without evidence there is no Execution Trust.

\---

\# Evidence Philosophy

Execution is temporary.

Evidence is permanent.

Evidence is the source of truth used for verification.

Evidence is not generated for debugging.

Evidence is generated to establish trust.

\---

\# Design Principles

Evidence must be:

\* Immutable

\* Append-only

\* Deterministic

\* Verifiable

\* Replayable

\* Cryptographically protected

\* Technology independent

\---

\# Evidence Model

Evidence belongs to exactly one ExecutionTransaction.

```text id="r5nkwj"

ExecutionTransaction

&#x20;       │

&#x20;       ▼

Evidence

&#x20;       │

&#x20;       ├── Signals

&#x20;       ├── Decision Record

&#x20;       ├── Policy Snapshot

&#x20;       ├── Attestation

&#x20;       ├── Receipt

&#x20;       ├── Signatures

&#x20;       ├── Hashes

&#x20;       ├── Ledger Reference

&#x20;       └── Metadata

```

Evidence is a collection of immutable artifacts.

\---

\# Evidence Lifecycle

```text id="8r32to"

Execution

&#x20;     │

&#x20;     ▼

Evidence Generated

&#x20;     │

&#x20;     ▼

Canonicalized

&#x20;     │

&#x20;     ▼

Hashed

&#x20;     │

&#x20;     ▼

Signed

&#x20;     │

&#x20;     ▼

Persisted

&#x20;     │

&#x20;     ▼

Available for Verification

```

Evidence is complete only after persistence.

\---

\# Evidence Categories

\## Signals

Input observations used during execution.

Examples:

\* User input

\* Agent state

\* Context snapshot

\* External events

Signals are factual observations.

Signals are never modified.

\---

\## Decision Record

Records the authorization outcome.

May include:

\* Decision Identifier

\* Decision Result

\* Decision Timestamp

\* Decision Metadata

Decision Records belong to the Authorization domain but are stored as Evidence.

\---

\## Policy Snapshot

Preserves the exact policy evaluated during authorization.

Policy Snapshots are immutable.

Future policy changes do not modify historical evidence.

\---

\## Attestation

Records assertions made during execution.

Examples:

\* Execution started

\* Execution completed

\* External confirmation

Attestations are append-only.

\---

\## Receipt

Represents cryptographic proof that evidence has been accepted and recorded.

Receipts include:

\* Receipt Identifier

\* Timestamp

\* Evidence Reference

\* Integrity Metadata

Receipts never change.

\---

\## Hashes

Provide integrity verification.

Each hash records:

\* Algorithm

\* Value

\* Canonicalization Version

Multiple hashes may coexist to support algorithm migration.

\---

\## Signatures

Provide authenticity.

Each signature records:

\* Algorithm

\* Key Identifier

\* Signature Value

\* Timestamp

Multiple signatures may coexist to support hybrid cryptography.

\---

\## Ledger Reference

Optionally links evidence to an external append-only ledger.

Ledger integration is implementation-specific.

The domain model remains unchanged.

\---

\## Metadata

Stores operational information.

Examples:

\* Correlation ID

\* Tenant ID

\* Labels

\* Tags

Metadata must never alter evidence semantics.

\---

\# Evidence Rules

Evidence is:

\* Immutable

\* Append-only

\* Timestamped

\* Versioned

\* Traceable

Evidence is never edited.

Corrections produce additional evidence.

\---

\# Evidence Relationships

Every evidence artifact references:

\* ExecutionTransaction

\* Artifact Type

\* Created Timestamp

\* Crypto Profile Reference

\* Evidence Version

No evidence artifact exists without an ExecutionTransaction.

\---

\# Integrity Requirements

Every evidence artifact supports:

\* Canonicalization

\* Hash Verification

\* Signature Verification

\* Provenance

\* Replay

Integrity is evaluated by the Verification Engine.

Evidence does not verify itself.

\---

\# Cryptographic Independence

Evidence records cryptographic metadata.

Evidence does not implement cryptographic algorithms.

Algorithm selection belongs to the Crypto layer.

\---

\# Replay Requirements

Evidence must preserve sufficient information to reconstruct the execution environment required for deterministic verification.

Replay depends only on recorded evidence.

Replay never depends on runtime memory.

\---

\# Evolution

New evidence types may be introduced.

Existing evidence types remain valid.

Historical evidence is never rewritten to match newer formats.

Transformation creates new evidence while preserving the original.

\---

\# Dependency Rules

```text id="l3y1df"

Runtime

&#x20;     │

&#x20;     ▼

Evidence

&#x20;     │

&#x20;     ▼

Storage

&#x20;     │

&#x20;     ▼

Verification

```

Evidence does not depend on Verification.

Verification depends on Evidence.

\---

\# Package Structure

```text id="lhxtzj"

packages/



evidence/



&#x20;   signals/



&#x20;   decisions/



&#x20;   policies/



&#x20;   attestations/



&#x20;   receipts/



&#x20;   hashes/



&#x20;   signatures/



&#x20;   ledger/



&#x20;   metadata/

```

Each evidence type owns its own implementation.

The Evidence domain provides the common abstraction.

\---

\# Success Criterion

The Evidence architecture succeeds when an independent verifier can reconstruct the complete factual record of an ExecutionTransaction, validate its integrity and authenticity, and reproduce the verification outcome without requiring access to the original runtime or application.
