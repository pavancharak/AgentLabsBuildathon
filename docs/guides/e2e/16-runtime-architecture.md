\# 16 – Runtime Architecture

This guide explains how the Parmana Runtime processes Business Transactions from API request through execution, evidence collection, and Trust Record generation.

\---

\# Runtime Overview

The Runtime is responsible for executing Business Transactions in a deterministic and auditable manner.

Its responsibilities include:

\- Processing Business Transactions

\- Evaluating execution policies

\- Authorizing execution

\- Collecting execution evidence

\- Building Execution Trust Records

\- Persisting immutable evidence

\---

\# Runtime Pipeline

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Input Validation

&#x20;       │

&#x20;       ▼

Policy Evaluation

&#x20;       │

&#x20;       ▼

Execution Decision

&#x20;       │

&#x20;       ▼

Execution Authorization

&#x20;       │

&#x20;       ▼

Connector Invocation

&#x20;       │

&#x20;       ▼

Evidence Collection

&#x20;       │

&#x20;       ▼

Execution Trust Record Builder

&#x20;       │

&#x20;       ▼

Persistence

```

\---

\# Step 1 – Business Transaction

The Runtime receives a validated Business Transaction from the API layer.

The transaction includes the information required to evaluate and perform the requested business operation.

\---

\# Step 2 – Policy Evaluation

The Runtime evaluates the transaction against execution policies.

Possible outcomes include:

\- APPROVED

\- REJECTED

The decision determines whether execution continues.

\---

\# Step 3 – Execution Authorization

For approved transactions, the Runtime records an authorization that binds the execution to the policy decision.

This authorization is later verified during Trust Record verification.

\---

\# Step 4 – Connector Invocation

The Runtime invokes the appropriate connector or target system to perform the approved business action.

Examples include:

\- Payment systems

\- ERP platforms

\- Procurement systems

\- Identity services

Execution results are captured as evidence.

\---

\# Step 5 – Evidence Collection

The Runtime records execution evidence including:

\- Execution identifiers

\- Decision outcome

\- Connector metadata

\- Authorization reference

\- Execution timestamps

This evidence forms the basis of the Execution Trust Record.

\---

\# Step 6 – Execution Trust Record

The Runtime assembles all immutable execution evidence into an Execution Trust Record.

The Trust Record is then:

\- Canonicalized

\- Hashed

\- Digitally signed

\- Stored

\---

\# Runtime Components

| Component | Responsibility |

|-----------|----------------|

| ExecutionTrustApplication | Coordinates runtime operations |

| VerificationService | Verifies Trust Records |

| VerificationCrypto | Hashing and signature verification |

| TrustRecordRepository | Stores immutable Trust Records |

| Receipt Service | Generates execution receipts |

\---

\# Design Principles

The Runtime is designed around the following principles:

\- Deterministic execution

\- Immutable execution evidence

\- Cryptographic integrity

\- Independent verification

\- Replayability

\- Separation of concerns

\---

\# Relationship to Other Components

```text

API

&#x20;│

&#x20;▼

Runtime

&#x20;│

&#x20;├── Policy Evaluation

&#x20;├── Execution

&#x20;├── Evidence Collection

&#x20;├── Trust Record Builder

&#x20;└── Persistence

&#x20;         │

&#x20;         ▼

Verification

&#x20;         │

&#x20;         ▼

Receipt

```

\---

\# Summary

The Parmana Runtime transforms Business Transactions into immutable Execution Trust Records through deterministic policy evaluation, controlled execution, evidence collection, and cryptographic protection. It forms the operational core of the Execution Trust Platform.
