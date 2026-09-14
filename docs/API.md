\# Parmana API Specification

Version: 1.0

Status: Normative

\---

\# Purpose

This document defines the logical API surface of the Parmana Execution Trust Infrastructure.

The API exposes the capabilities required to:

\* execute Business Transactions

\* verify execution evidence

\* replay historical execution

\* retrieve execution artifacts

The specification is transport-independent.

REST, gRPC, SDK, and CLI implementations may expose different interfaces while preserving the same semantics.

\---

\# API Principles

The Parmana API is designed around trust artifacts rather than runtime operations.

Every request is expected to preserve the execution trust chain.

The API SHALL:

\* validate inputs

\* preserve deterministic behavior

\* produce immutable execution evidence

\* support independent verification

\---

\# API Overview

```text

Client

&#x20;   │

&#x20;   ▼

Execute

&#x20;   │

&#x20;   ▼

Runtime

&#x20;   │

&#x20;   ▼

Execution Trust Record

&#x20;   │

&#x20;   ├────────► Verify

&#x20;   │

&#x20;   ├────────► Replay

&#x20;   │

&#x20;   └────────► Retrieve

```

\---

\# Operations

\## Execute

Processes a Business Transaction.

\### Input

BusinessTransaction

\### Processing

\* Validate Business Transaction

\* Load referenced Policy

\* Evaluate Policy

\* Produce Decision

\* Execute Runtime

\* Produce Execution Trust Record

\* Produce Receipt

\### Output

```text

ExecutionResult



\- Decision

\- Execution

\- Execution Trust Record

\- Receipt

```

\---

\## Verify

Verifies execution evidence.

\### Input

Execution Trust Record

Receipt

\### Processing

\* Verify hashes

\* Verify signatures

\* Verify integrity

\### Output

```text

VerificationResult



\- valid

\- verification details

```

\---

\## Replay

Replays historical execution.

\### Input

Execution Trust Record

\### Processing

\* Load recorded execution

\* Re-evaluate

\* Compare results

\* Report differences

\### Output

```text

ReplayResult



\- replay decision

\- comparison

\- detected differences

```

\---

\## Retrieve

Retrieves historical execution artifacts.

Examples:

\* Business Transaction

\* Decision

\* Execution

\* Execution Trust Record

\* Receipt

\---

\# Request Lifecycle

Every Execute request follows the same lifecycle.

```text

Request

&#x20;   ↓

Business Transaction Validation

&#x20;   ↓

Policy Selection

&#x20;   ↓

Policy Validation

&#x20;   ↓

Policy Evaluation

&#x20;   ↓

Decision

&#x20;   ↓

Runtime Execution

&#x20;   ↓

Execution Trust Record

&#x20;   ↓

Receipt

&#x20;   ↓

Response

```

\---

\# Execution Guarantees

The Execute operation SHALL:

\* validate Business Transactions

\* execute exactly one referenced Policy

\* produce one Decision

\* produce one Execution

\* produce one Execution Trust Record

\* produce one Receipt

Execution SHALL fail when required trust artifacts are missing.

\---

\# Verification Guarantees

Verification SHALL:

\* validate execution integrity

\* verify cryptographic evidence

\* preserve immutable execution artifacts

Verification SHALL NOT modify execution evidence.

\---

\# Replay Guarantees

Replay SHALL:

\* preserve historical evidence

\* compare recorded and replayed execution

\* report detected differences

Replay SHALL NOT modify historical execution records.

\---

\# Error Model

Implementations SHOULD return structured errors.

Examples include:

```text

VALIDATION\_ERROR



POLICY\_NOT\_FOUND



POLICY\_VERSION\_MISMATCH



POLICY\_VALIDATION\_ERROR



UNAUTHORIZED\_EXECUTION



DECISION\_REQUIRED



VERIFICATION\_FAILED



REPLAY\_FAILED

```

Error identifiers SHOULD remain stable across implementations.

\---

\# Security Requirements

API implementations SHOULD:

\* validate all inputs

\* reject malformed Business Transactions

\* verify policy identity before evaluation

\* protect cryptographic material

\* validate execution evidence before verification

Authentication and authorization mechanisms are deployment-specific and outside the scope of this specification.

\---

\# Transport Independence

This specification does not mandate:

\* HTTP

\* REST

\* gRPC

\* GraphQL

\* CLI

\* SDK

Any transport MAY be used provided the execution semantics defined by this specification are preserved.

\---

\# Conformance

An API implementation conforms when it:

\* preserves the canonical execution trust chain

\* satisfies the Parmana Specification

\* satisfies the Parmana Guarantees

\* passes the Parmana Conformance Suite

\---

\# Related Documents

\* VISION.md

\* ARCHITECTURE.md

\* SPECIFICATION.md

\* TRUST\_MODEL.md

\* GUARANTEES.md

\* PROOFS.md

\* CONFORMANCE.md

\---

\# Guiding Principle

The Parmana API is not simply an interface to a runtime.

It is the public entry point into the Execution Trust Infrastructure, preserving the integrity of the trust chain from Business Transaction to independently verifiable execution evidence.
