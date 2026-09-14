\# Cryptography

\*\*Document:\*\* `docs/02-architecture/CRYPTOGRAPHY.md`

\## Purpose

This document defines the cryptographic architecture of Parmana.

Cryptography provides \*\*integrity\*\*, \*\*authenticity\*\*, and \*\*tamper detection\*\* for authorization artifacts produced by the Parmana Runtime.

Cryptography protects the trust established through Authority Verification. It does \*\*not\*\* establish execution authority.

This document specifies the architectural requirements and the reference implementation used by Parmana.

This document is normative.

\---

\# Overview

Parmana authorizes business operations based on organizational policy and verified evidence.

Once an Authorization Decision has been produced, the resulting authorization artifacts must be protected against:

\* Modification

\* Forgery

\* Corruption

\* Unauthorized substitution

\* Integrity loss

The Cryptography Layer provides these guarantees.

\---

\# Core Principle

Cryptography protects evidence.

Cryptography does \*\*not\*\* determine whether execution is authorized.

Authorization is established through:

\* Human Authority

\* Organizational Policy

\* Authority Verification

Cryptography ensures that the resulting authorization artifacts remain trustworthy after they have been created.

\---

\# Security Objectives

The Cryptography Layer provides the following guarantees.

\## Integrity

Detect unauthorized modification of authorization artifacts.

\---

\## Authenticity

Allow verifiers to confirm that an authorization artifact originated from Parmana.

\---

\## Tamper Detection

Detect any unauthorized change to persisted records or receipts.

\---

\## Independent Verification

Enable third parties to verify authorization artifacts without trusting the original Runtime instance.

\---

\## Replay Support

Ensure replay operates on cryptographically protected authorization evidence.

\---

\# Protected Artifacts

Cryptographic protection applies to:

\* Execution Trust Records

\* Execution Receipts

\* Verification metadata (where applicable)

\* Replay artifacts (where applicable)

Business Transactions and Execution Requests are protected indirectly through the Execution Trust Record.

\---

\# Reference Algorithms

The current Parmana reference implementation uses the following algorithms.

| Purpose | Algorithm |

| ------------------ | --------- |

| Hashing | SHA-256 |

| Digital Signatures | Ed25519 |

Future implementations may introduce additional algorithms while preserving compatibility and verification guarantees.

\---

\# Hashing

\## Purpose

Hashing produces a deterministic digest representing the contents of an authorization artifact.

The hash enables detection of unauthorized modification.

\---

\## Algorithm

Reference implementation:

```text

SHA-256

```

\---

\## Properties

The hash must be:

\* Deterministic

\* Collision-resistant

\* Stable

\* Independent of storage implementation

Equivalent authorization artifacts produce identical hashes.

\---

\# Canonical Serialization

Before hashing, authorization artifacts MUST be serialized into a canonical representation.

Canonical serialization ensures that:

\* equivalent records produce identical hashes,

\* formatting differences do not affect integrity,

\* replay remains deterministic.

The reference implementation uses canonical JSON serialization compliant with \*\*RFC 8785 (JSON Canonicalization Scheme)\*\*.

\---

\# Hash Generation

Conceptually:

```text

Execution Trust Record

&#x20;         │

&#x20;         ▼

Canonical Serialization

&#x20;         │

&#x20;         ▼

SHA-256

&#x20;         │

&#x20;         ▼

Record Hash

```

The generated hash becomes part of the authorization evidence.

\---

\# Digital Signatures

\## Purpose

Digital signatures provide authenticity.

They enable verifiers to determine whether an authorization artifact was issued by Parmana.

\---

\## Algorithm

Reference implementation:

```text

Ed25519

```

\---

\## Signature Process

Conceptually:

```text

Record Hash

&#x20;     │

&#x20;     ▼

Private Key

&#x20;     │

&#x20;     ▼

Digital Signature

```

The resulting signature accompanies the protected artifact.

\---

\# Signature Verification

Verification uses the corresponding public key.

Conceptually:

```text

Execution Receipt

&#x20;        │

&#x20;        ▼

Extract Signature

&#x20;        │

&#x20;        ▼

Public Key

&#x20;        │

&#x20;        ▼

Verify Signature

&#x20;        │

&#x20;        ▼

Valid / Invalid

```

Successful verification confirms:

\* integrity,

\* authenticity,

\* absence of unauthorized modification.

\---

\# Key Management

Cryptographic keys are managed separately from authorization logic.

The Runtime requires:

\* private keys for signing,

\* public keys for verification.

Key storage mechanisms are deployment-specific.

Examples include:

\* Hardware Security Modules (HSMs)

\* Cloud Key Management Services (KMS)

\* Secure software key stores

The Runtime should never embed private keys within application source code.

\---

\# Cryptographic Workflow

The Runtime performs cryptographic operations after successful Authority Verification.

```text

Authority Verification

&#x20;         │

&#x20;         ▼

Authorization Decision

&#x20;         │

&#x20;         ▼

Execution Trust Record

&#x20;         │

&#x20;         ▼

Canonical Serialization

&#x20;         │

&#x20;         ▼

SHA-256 Hash

&#x20;         │

&#x20;         ▼

Ed25519 Signature

&#x20;         │

&#x20;         ▼

Execution Receipt

```

Cryptography protects completed authorization artifacts.

\---

\# Replay Protection

Replay relies on cryptographic integrity.

During replay:

\* the stored artifact is retrieved,

\* canonical serialization is performed,

\* the hash is recomputed,

\* signatures are verified,

\* authorization evidence is validated.

Replay fails if integrity verification fails.

\---

\# Cryptographic Metadata

Protected artifacts may contain metadata including:

\* Hash algorithm

\* Signature algorithm

\* Signature value

\* Key identifier

\* Integrity version

Metadata supports future algorithm evolution.

\---

\# Algorithm Agility

Parmana is designed to support future cryptographic algorithms.

Implementations should identify:

\* hash algorithm,

\* signature algorithm,

\* key version.

This enables algorithm upgrades without invalidating historical authorization artifacts.

\---

\# Failure Conditions

Cryptographic verification fails when:

\* hashes differ,

\* signatures are invalid,

\* unsupported algorithms are encountered,

\* required keys are unavailable,

\* canonical serialization fails.

Cryptographic failure prevents successful verification.

\---

\# Security Considerations

Private keys should be protected against:

\* unauthorized access,

\* disclosure,

\* modification,

\* accidental deletion.

Public verification keys should be distributed securely to authorized verifiers.

Key rotation policies are deployment-specific.

\---

\# Design Principles

The Cryptography Layer follows these principles:

\* Deterministic hashing.

\* Strong digital signatures.

\* Canonical serialization.

\* Algorithm independence.

\* Independent verification.

\* Technology independence.

\* Tamper detection.

\* Future algorithm agility.

\---

\# What Cryptography Is Not

The Cryptography Layer is \*\*not\*\*:

\* an authorization engine,

\* a policy engine,

\* an identity system,

\* a workflow engine,

\* a trust model.

It protects authorization artifacts after they have been produced.

\---

\# Guarantees

The Cryptography Layer guarantees:

\* Unauthorized modification is detectable.

\* Execution Trust Records have stable cryptographic hashes.

\* Execution Receipts are digitally signed.

\* Authorization artifacts support independent verification.

\* Replay validates artifact integrity.

\* Equivalent authorization artifacts produce identical hashes through canonical serialization.

\* Historical authorization artifacts remain verifiable across supported algorithm versions.

\---

\# Relationship to Other Documents

This document specifies cryptographic protection.

Related specifications include:

\* `REPOSITORY.md`

\* `STORAGE.md`

\* `RECEIPT\_GENERATION.md`

\* `REPLAY.md`

Conceptual definitions include:

\* `01-concepts/EXECUTION\_TRUST\_RECORD.md`

\* `01-concepts/EXECUTION\_RECEIPT.md`

\---

\# Current Reference Implementation

The current Parmana reference implementation uses:

| Component | Implementation |

| --------------------------- | --------------------------------------- |

| Canonical Serialization | RFC 8785 (JSON Canonicalization Scheme) |

| Hash Algorithm | SHA-256 |

| Digital Signature Algorithm | Ed25519 |

| Hash Target | Execution Trust Record |

| Signature Target | Canonical Execution Receipt |

These implementation choices define the reference implementation and may evolve provided future implementations preserve the architectural guarantees defined in this specification.

\---

\# Summary

The Cryptography Layer protects the integrity and authenticity of Parmana authorization artifacts.

By combining canonical serialization, SHA-256 hashing, and Ed25519 digital signatures, Parmana enables Execution Trust Records and Execution Receipts to remain tamper-evident, independently verifiable, and suitable for replay, audit, and long-term compliance.

Cryptography does not authorize execution. It preserves the integrity of the authorization evidence produced by the Parmana Runtime.
