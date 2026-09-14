\# Receipt Generation

\*\*Document:\*\* `docs/02-architecture/RECEIPT\_GENERATION.md`

\## Purpose

This document defines the \*\*Receipt Generation\*\* component of the Parmana Runtime.

Receipt Generation is responsible for producing a portable, cryptographically verifiable \*\*Execution Receipt\*\* from a persisted \*\*Execution Trust Record (ETR)\*\*.

The Receipt Generation component transforms Parmana's canonical authorization record into an artifact that can be shared with execution systems, enterprise applications, auditors, and external verifiers without exposing the complete internal authorization record.

This document is normative.

\---

\# Overview

The Parmana Runtime produces two primary authorization artifacts:

1\. \*\*Execution Trust Record (ETR)\*\* – the canonical internal authorization record.

2\. \*\*Execution Receipt (ER)\*\* – the portable proof of authorization.

Receipt Generation creates the second artifact.

It does not create new authorization evidence.

It transforms existing authorization evidence into a portable verification artifact.

\---

\# Architectural Position

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

Receipt Generation

&#x20;         │

&#x20;         ▼

Execution Receipt

&#x20;         │

&#x20;         ▼

Execution System

```

Receipt Generation always operates \*\*after\*\* successful Authority Verification and persistence of the Execution Trust Record.

\---

\# Responsibilities

Receipt Generation is responsible for:

\* Reading a persisted Execution Trust Record.

\* Creating the canonical receipt representation.

\* Computing receipt integrity information.

\* Applying digital signatures.

\* Producing the Execution Receipt.

\* Returning the receipt to the Runtime.

Receipt Generation does \*\*not\*\*:

\* Evaluate policies.

\* Perform Authority Verification.

\* Produce Authorization Decisions.

\* Execute business operations.

\* Modify Execution Trust Records.

\---

\# Design Principle

Receipt Generation follows one fundamental principle:

> \*\*The Execution Trust Record is the source of truth.\*\*

Execution Receipts are derived artifacts.

A receipt never becomes the authoritative authorization record.

\---

\# Inputs

Receipt Generation consumes:

\## Execution Trust Record

The canonical authorization record.

Includes:

\* Authorization Decision

\* Policy Reference

\* Evaluated evidence

\* Verification metadata

\* Integrity metadata

\---

\## Cryptographic Configuration

The Runtime provides:

\* Hash algorithm

\* Signature algorithm

\* Key identifier

\* Private signing key

Cryptographic implementation details are specified in `CRYPTOGRAPHY.md`.

\---

\# Receipt Generation Process

Receipt Generation follows a deterministic sequence.

```text

Execution Trust Record

&#x20;         │

&#x20;         ▼

Extract Receipt Fields

&#x20;         │

&#x20;         ▼

Canonical Serialization

&#x20;         │

&#x20;         ▼

Compute SHA-256 Hash

&#x20;         │

&#x20;         ▼

Generate Ed25519 Signature

&#x20;         │

&#x20;         ▼

Construct Execution Receipt

&#x20;         │

&#x20;         ▼

Return Receipt

```

Equivalent Execution Trust Records always produce equivalent Execution Receipts.

\---

\# Receipt Contents

Conceptually, an Execution Receipt contains:

```text

Execution Receipt



├── Receipt Identifier

├── Execution Trust Record Reference

├── Authorization Decision

├── Policy Reference

├── Policy Version

├── Timestamp

├── Integrity Hash

├── Digital Signature

├── Signature Algorithm

├── Hash Algorithm

├── Key Identifier

└── Receipt Metadata

```

The serialization format is implementation-specific.

\---

\# Receipt Construction

Receipt Generation extracts only the information required for verification.

Examples include:

\* Authorization outcome

\* Policy identifier

\* Policy version

\* Trust Record reference

\* Verification timestamp

\* Integrity information

Sensitive authorization evidence remains inside the Execution Trust Record.

\---

\# Canonical Serialization

Before cryptographic operations, the receipt is serialized into a canonical representation.

Canonical serialization guarantees:

\* deterministic output,

\* stable hashing,

\* stable signatures,

\* reproducible verification.

The reference implementation uses \*\*RFC 8785 (JSON Canonicalization Scheme)\*\*.

\---

\# Integrity Protection

Receipt integrity is established by computing a SHA-256 hash over the canonical receipt representation.

Conceptually:

```text

Canonical Receipt

&#x20;       │

&#x20;       ▼

SHA-256

&#x20;       │

&#x20;       ▼

Receipt Hash

```

Any modification changes the resulting hash.

\---

\# Digital Signature

After hashing, the Runtime signs the receipt using Ed25519.

```text

Receipt Hash

&#x20;     │

&#x20;     ▼

Private Key

&#x20;     │

&#x20;     ▼

Digital Signature

```

The signature allows external parties to verify that the receipt originated from Parmana.

\---

\# Determinism

Receipt Generation is deterministic.

Given:

\* identical Execution Trust Records,

\* identical cryptographic configuration,

\* identical canonical serialization,

the resulting Execution Receipt is identical.

Determinism supports replay and independent verification.

\---

\# Immutability

Execution Receipts are immutable.

Once generated:

\* fields must not change,

\* signatures remain valid,

\* receipt identifiers remain stable.

A new Authorization Decision always results in a new Execution Receipt.

\---

\# Relationship to Execution Trust Record

Every Execution Receipt references exactly one Execution Trust Record.

```text

Execution Trust Record

&#x20;         │

&#x20;         ▼

Execution Receipt

```

This relationship is permanent.

\---

\# Relationship to Cryptography

Receipt Generation depends upon the Cryptography Layer for:

\* canonical serialization,

\* hashing,

\* digital signatures,

\* integrity verification.

Cryptographic implementation remains independent of receipt construction.

\---

\# Relationship to Verification

Independent verification validates:

\* receipt integrity,

\* digital signature,

\* referenced Execution Trust Record,

\* authorization metadata.

Verification does not require access to the original Runtime.

\---

\# Failure Conditions

Receipt Generation fails when:

\* the Execution Trust Record cannot be retrieved,

\* canonical serialization fails,

\* hashing fails,

\* signing fails,

\* cryptographic keys are unavailable,

\* receipt construction is incomplete.

Receipt Generation failure prevents successful completion of the authorization pipeline.

\---

\# Security Considerations

Receipt Generation protects against:

\* receipt forgery,

\* unauthorized modification,

\* signature substitution,

\* integrity loss,

\* incomplete receipt generation.

Only successfully signed receipts are returned by the Runtime.

\---

\# Design Principles

Receipt Generation follows these principles:

\* Derived from the Execution Trust Record.

\* Deterministic.

\* Immutable.

\* Cryptographically protected.

\* Independently verifiable.

\* Minimal disclosure.

\* Technology independent.

\---

\# What Receipt Generation Is Not

Receipt Generation is \*\*not\*\*:

\* an authorization engine,

\* a policy engine,

\* a verification engine,

\* a storage system,

\* an execution system.

Its sole responsibility is producing portable authorization receipts.

\---

\# Guarantees

Receipt Generation guarantees:

\* Every Execution Receipt is derived from exactly one Execution Trust Record.

\* Equivalent Execution Trust Records produce equivalent receipts.

\* Every receipt is cryptographically protected.

\* Every receipt supports independent verification.

\* Receipt contents remain immutable.

\* Authorization evidence remains in the Execution Trust Record.

\* Receipts disclose only the information required for verification.

\---

\# Relationship to Other Documents

This document specifies receipt generation.

Related specifications include:

\* `CRYPTOGRAPHY.md`

\* `REPOSITORY.md`

\* `STORAGE.md`

\* `REPLAY.md`

Conceptual definitions include:

\* `01-concepts/EXECUTION\_TRUST\_RECORD.md`

\* `01-concepts/EXECUTION\_RECEIPT.md`

\---

\# Current Reference Implementation

The current Parmana reference implementation performs receipt generation as follows:

1\. Persist the Execution Trust Record.

2\. Serialize the receipt using RFC 8785 canonical JSON.

3\. Compute a SHA-256 hash.

4\. Sign the hash using Ed25519.

5\. Construct the Execution Receipt.

6\. Return the signed receipt to the Runtime.

Alternative implementations may use different technologies provided they preserve the architectural guarantees defined in this specification.

\---

\# Summary

The Receipt Generation component transforms Parmana's canonical authorization record into a portable, cryptographically verifiable Execution Receipt.

By deriving receipts exclusively from persisted Execution Trust Records and protecting them with deterministic serialization, SHA-256 hashing, and Ed25519 digital signatures, Parmana enables execution systems and external verifiers to validate authorization without requiring direct access to the Runtime or its internal records.

The Execution Trust Record remains the canonical source of truth. The Execution Receipt is its portable proof.
