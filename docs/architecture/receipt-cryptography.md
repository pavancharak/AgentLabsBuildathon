\# Receipt Cryptography

\## Overview

Receipts are cryptographic attestations that prove an Execution Trust Record has been successfully verified.

A receipt contains:

\* Receipt metadata

\* Canonical receipt hash

\* Trust Record hash

\* Digital signature

\* Signature algorithm

Receipts provide tamper-evident proof that an execution has been authorized, verified, and recorded.

\---

\# Purpose

A receipt serves four purposes:

\* Prove the integrity of an Execution Trust Record.

\* Provide a cryptographic signature from Parmana.

\* Enable independent verification.

\* Produce long-term audit evidence.

\---

\# Receipt Structure

```text

Receipt

│

├── receiptId

├── businessTransactionId

├── trustRecordHash

├── receiptHash

├── issuedAt

├── algorithm

└── signature

```

Every receipt is immutable after creation.

\---

\# Receipt Generation Pipeline

```text

Execution Trust Record

&#x20;          │

&#x20;          ▼

Canonical Serialization

&#x20;          │

&#x20;          ▼

TrustRecordHasher

&#x20;          │

&#x20;          ▼

ReceiptHasher

&#x20;          │

&#x20;          ▼

ReceiptSigner

&#x20;          │

&#x20;          ▼

Receipt

```

Each stage has a single responsibility.

\---

\# Canonical Serialization

Before hashing, Parmana converts the receipt into a deterministic representation.

Requirements:

\* Stable property ordering

\* UTF-8 encoding

\* No formatting differences

\* No runtime-dependent serialization

Every compliant implementation must produce identical bytes for identical receipts.

\---

\# Receipt Hash

The receipt hash protects the receipt contents.

```text

Receipt

&#x20;     │

&#x20;     ▼

Canonical Bytes

&#x20;     │

&#x20;     ▼

Hash Provider

&#x20;     │

&#x20;     ▼

receiptHash

```

The hash provider is configurable.

Current implementation:

\* SHA-256

Future implementations:

\* SHA3-512

\* BLAKE3

\---

\# Digital Signature

The canonical receipt is digitally signed.

```text

receiptHash

&#x20;      │

&#x20;      ▼

Signature Provider

&#x20;      │

&#x20;      ▼

signature

```

Supported providers:

\* Ed25519

\* ML-DSA-65 (Dilithium3)

The selected provider is determined by configuration.

\---

\# Receipt Fields

| Field | Description |

| --------------------- | ---------------------------------- |

| receiptId | Unique receipt identifier |

| businessTransactionId | Business transaction reference |

| trustRecordHash | Hash of the Execution Trust Record |

| receiptHash | Hash of the canonical receipt |

| issuedAt | Receipt creation timestamp |

| algorithm | Signature algorithm |

| signature | Base64-encoded digital signature |

\---

\# Verification

Receipt verification performs the following steps:

```text

Receipt

&#x20;    │

&#x20;    ▼

Canonical Serialization

&#x20;    │

&#x20;    ▼

Receipt Hash

&#x20;    │

&#x20;    ▼

Signature Verification

&#x20;    │

&#x20;    ▼

Verified / Invalid

```

Verification succeeds only if:

\* The receipt has not been modified.

\* The receipt hash matches.

\* The signature is valid.

\* The configured public key verifies the signature.

\---

\# Algorithm Independence

Receipt generation is independent of the underlying signature algorithm.

Changing:

```dotenv

SIGNATURE\_PROVIDER=ed25519

```

to

```dotenv

SIGNATURE\_PROVIDER=dilithium3

```

changes only the cryptographic implementation.

The receipt generation workflow remains identical.

\---

\# Security Properties

Receipts provide:

\* Integrity

\* Authenticity

\* Tamper evidence

\* Independent verification

\* Non-repudiation (subject to key management)

Receipts do not encrypt data. Their purpose is to prove integrity and origin.

\---

\# Design Principles

Receipt cryptography follows these principles:

\* Deterministic serialization

\* Immutable receipt structure

\* Algorithm-independent business logic

\* Pluggable cryptographic providers

\* Persistent signing keys

\* Verifiable audit evidence

These principles ensure that receipts remain trustworthy regardless of the cryptographic algorithm selected by the deployment.
