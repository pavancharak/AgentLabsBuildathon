\---

\# Parmana Architecture Lock v1

\*\*Status:\*\* LOCKED

\*\*Version:\*\* v1.0

\*\*Date:\*\* 2026-06-27

\---

\# Purpose

This document defines the architectural decisions that are frozen for Parmana v1.

Unless a major version is planned, these decisions must not change.

Future work must extend the architecture rather than modify these core principles.

\---

\# Product Category

\*\*Execution Trust Infrastructure\*\*

Parmana ensures there is no gap between what humans decide and what AI systems do.

\---

\# Core Trust Lifecycle

The canonical lifecycle is:

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Execute

&#x20;       │

&#x20;       ▼

Execution Trust Record

&#x20;       │

&#x20;       ▼

Verify

&#x20;       │

&#x20;       ▼

Receipt

&#x20;       │

&#x20;       ▼

Replay

```

This lifecycle is locked.

No additional mandatory stages may be inserted into this sequence for v1.

\---

\# Execution Trust Record

The Execution Trust Record is the immutable evidence produced from execution.

It is the canonical trust artifact throughout the platform.

Everything else references it.

\---

\# Cryptographic Invariant

Exactly one canonical implementation computes the Trust Record hash.

```text

VerificationCrypto

&#x20;       │

&#x20;       ▼

TrustRecordHasher

&#x20;       │

&#x20;       ▼

CanonicalSerializer

&#x20;       │

&#x20;       ▼

SHA-256

```

No other component may independently compute Trust Record hashes.

\---

\# Trust Record Hash

The Trust Record hash is computed only from immutable execution evidence.

Included:

\* trustRecordId

\* businessTransactionId

\* transaction

\* overrides

\* executions

\* createdAt

Excluded:

\* trustRecordHash

\* verifications

\* receipts

\* updatedAt

This invariant is frozen.

\---

\# Replay

Replay is an integrity operation.

Replay:

\* loads an existing Execution Trust Record

\* recomputes the canonical Trust Record hash

\* verifies integrity

\* returns verification results

Replay never executes business logic.

Replay never modifies state.

Replay is deterministic.

\---

\# Verification

Verification validates that the stored Trust Record has not been modified.

Verification always recomputes the canonical hash before comparison.

\---

\# Receipt

Receipts represent cryptographic proof of a verified Execution Trust Record.

Each Receipt contains:

\* receiptHash

\* trustRecordHash

\* Ed25519 signature

\* algorithm

\* issuedAt

Receipts never modify the Trust Record.

\---

\# Runtime Responsibilities

Runtime is responsible for:

\* execution

\* Trust Record generation

Runtime is not responsible for:

\* cryptographic key management

\* replay logic

\* storage implementation

\---

\# API Surface

Canonical API lifecycle:

```text

POST /execute



POST /verify



POST /receipt



POST /replay

```

Read APIs:

```text

GET /transactions/:id



GET /trust-records/:id



GET /verification/latest/:id



GET /receipt/latest/:id

```

\---

\# Storage

Storage implementations are interchangeable.

Current implementations:

\* Memory

\* Supabase

Future implementations must implement the repository interfaces.

\---

\# Cryptography

Current algorithms:

Hash

\* SHA-256

Signature

\* Ed25519

Algorithm selection occurs through provider abstractions.

\---

\# Testing

The following are required for v1:

\* Execute integration

\* Verify integration

\* Receipt integration

\* Replay integration

\* Workflow integration

\* Trust Record lifecycle tests

\* Receipt signature verification

\* Negative-path tests

\* API validation tests

These form the minimum acceptance suite.

\---

\# Deferred to v2

The following capabilities are intentionally excluded from v1:

\* Persistent Key Management

\* FileKeyProvider

\* Key Rotation

\* Multi-tenant signing

\* AWS KMS

\* Azure Key Vault

\* Google Cloud KMS

\* HashiCorp Vault

\* HSM integration

These are implementation extensions and must not alter the v1 trust model.

\---

\# Architectural Principles

1\. Deterministic execution evidence

2\. Immutable Trust Records

3\. Canonical serialization

4\. Deterministic hashing

5\. Cryptographic verification

6\. Replay without execution

7\. Storage abstraction

8\. Algorithm abstraction

9\. Provider-based cryptography

10\. Backward-compatible evolution

\---

\# Change Policy

The following require a major architecture review:

\* changing the Trust Record structure

\* changing canonical hashing

\* changing Replay semantics

\* changing the lifecycle order

\* changing Receipt semantics

\* changing cryptographic invariants

Minor enhancements may extend the architecture but must not violate these principles.

\---

\# Architecture Lock Declaration

Parmana v1 establishes a stable Execution Trust Infrastructure with a canonical lifecycle:

```text

Execute

&#x20;   ↓

Execution Trust Record

&#x20;   ↓

Verify

&#x20;   ↓

Receipt

&#x20;   ↓

Replay

```

This lifecycle, its cryptographic invariants, and the canonical Trust Record hashing model are hereby locked for v1. All future enhancements must preserve these guarantees while extending the platform with production-grade capabilities such as persistent key management, key rotation, and enterprise key providers.
