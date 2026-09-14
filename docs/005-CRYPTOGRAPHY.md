\# Cryptography Specification

\*\*Document:\*\* 005-CRYPTOGRAPHY.md

\*\*Version:\*\* 1.0.0 (Draft)

\*\*Status:\*\* Architecture Lock

\---

\# Purpose

This document defines the cryptographic architecture of the Parmana platform.

Cryptography protects the integrity, authenticity, and verifiability of execution evidence.

Cryptography is infrastructure.

It is not part of the business domain.

\---

\# Design Principle

Parmana depends on cryptographic properties, not cryptographic algorithms.

Algorithms may change.

Architecture must not.

\---

\# Objectives

The cryptographic layer must provide:

\* Integrity

\* Authenticity

\* Non-repudiation

\* Tamper evidence

\* Replay verification

\* Cryptographic agility

\---

\# Platform Boundary

```text

Business Domains

│

├── Authority

├── Intent

├── Authorization

├── Execution

├── Evidence

└── Verification

&#x20;       │

&#x20;       ▼

Cryptographic Layer

&#x20;       │

&#x20;       ├── Canonicalization

&#x20;       ├── Hashing

&#x20;       ├── Signatures

&#x20;       ├── Key Management

&#x20;       └── Crypto Profiles

```

Business domains never depend directly on specific cryptographic algorithms.

\---

\# Cryptographic Responsibilities

The cryptographic layer is responsible for:

\* Canonical serialization

\* Hash generation

\* Signature generation

\* Signature verification

\* Key identification

\* Algorithm selection

The cryptographic layer is \*\*not\*\* responsible for:

\* Authorization

\* Policy evaluation

\* Verification logic

\* Business decisions

\---

\# Canonicalization

All cryptographic operations must operate on canonical representations.

Canonicalization ensures identical input produces identical cryptographic output.

Requirements:

\* Deterministic

\* Language-independent

\* Platform-independent

\* Versioned

Canonicalization is mandatory before:

\* Hash generation

\* Signature generation

\* Verification

\---

\# Hashing

Hashes provide integrity.

Every evidence artifact may contain one or more hashes.

Each hash records:

\* Algorithm

\* Value

\* Canonicalization Version

The architecture does not mandate a specific hash algorithm.

\---

\# Digital Signatures

Signatures provide authenticity.

Every signature records:

\* Algorithm

\* Key Identifier

\* Signature Value

\* Timestamp

The architecture does not mandate a specific signature algorithm.

\---

\# Crypto Profile

Every ExecutionTransaction is associated with one Crypto Profile through its evidence.

A Crypto Profile defines:

\* Profile Identifier

\* Profile Version

\* Canonicalization Version

\* Hash Algorithm

\* Signature Algorithm

\* Key Policy

Example:

```text

Profile



enterprise-2026



Canonicalization

RFC8785-v1



Hash

SHA-256



Signature

Ed25519



Version

1.0

```

A future profile may use different algorithms while preserving the same domain model.

\---

\# Cryptographic Providers

The cryptographic layer exposes abstract providers.

\## Hash Provider

Responsibilities:

\* Generate hash

\* Verify hash

\---

\## Signature Provider

Responsibilities:

\* Sign

\* Verify

\---

\## Canonicalization Provider

Responsibilities:

\* Canonicalize data

\* Validate canonical representation

\---

\## Key Provider

Responsibilities:

\* Resolve key identifiers

\* Validate key metadata

\* Rotate keys

\---

\# Algorithm Independence

Business code must never reference specific algorithms.

Incorrect:

```text

verifyEd25519()

```

Correct:

```text

signatureProvider.verify()

```

The provider determines the appropriate implementation.

\---

\# Cryptographic Agility

Cryptographic algorithms will evolve.

The platform must support:

\* Algorithm replacement

\* Parallel algorithm support

\* Historical verification

\* Future migration

Algorithm changes must not require changes to:

\* ExecutionTransaction

\* Domain Model

\* Verification Model

\* Public API

\---

\# Hybrid Cryptography

The platform supports multiple algorithms during migration.

Example:

```text

Evidence



├── SHA-256

├── SHA3-512

├── Ed25519

└── ML-DSA

```

Verification succeeds when the configured Crypto Profile requirements are satisfied.

\---

\# Key Management

Keys are identified, never embedded.

Every signature references:

\* Key Identifier

\* Key Version

Key material remains external to the business domain.

\---

\# Replay

Historical transactions must remain verifiable.

Verification selects the appropriate Crypto Profile based on the recorded evidence.

Replay never assumes the latest algorithm.

Replay uses the algorithm originally associated with the transaction.

\---

\# Post-Quantum Readiness

The architecture is designed for cryptographic evolution.

Future algorithms may replace existing algorithms without changing:

\* Domain Model

\* ExecutionTransaction

\* Verification Engine

\* APIs

\* SDKs

Only the cryptographic providers and Crypto Profiles evolve.

\---

\# Security Principles

1\. Canonicalize before hashing.

2\. Canonicalize before signing.

3\. Never sign mutable data.

4\. Never modify signed evidence.

5\. Every cryptographic operation is versioned.

6\. Every cryptographic artifact records its algorithm.

7\. Historical evidence remains verifiable.

\---

\# Package Structure

```text

packages/



crypto/



&#x20;   canonicalization/



&#x20;   hashing/



&#x20;   signatures/



&#x20;   keys/



&#x20;   providers/



&#x20;   profiles/

```

The crypto package is the only location that contains algorithm-specific implementations.

\---

\# Dependency Rules

```text

Runtime

&#x20;       │

Evidence

&#x20;       │

Verification

&#x20;       │

Crypto Interfaces

&#x20;       │

Provider Implementations

```

Business domains depend only on cryptographic interfaces.

Provider implementations remain isolated.

\---

\# Success Criterion

The cryptographic architecture succeeds when Parmana can adopt new cryptographic algorithms, including post-quantum algorithms, without requiring changes to its domain model, execution model, verification model, public APIs, or business logic.
