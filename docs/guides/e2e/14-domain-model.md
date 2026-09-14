\# 14 – Domain Model

This guide describes the core domain objects used by the Parmana Execution Trust Platform and how they relate to one another.

\---

\# Domain Overview

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Policy Evaluation

&#x20;       │

&#x20;       ▼

Execution

&#x20;       │

&#x20;       ▼

Execution Trust Record

&#x20;       │

&#x20;       ├── Decision

&#x20;       ├── Authorization

&#x20;       ├── Execution Evidence

&#x20;       ├── Verification

&#x20;       └── Receipt

```

\---

\# Business Transaction

A Business Transaction represents a business operation requested by a caller.

Examples include:

\- Vendor creation

\- Invoice approval

\- Payment

\- Purchase Order

\- Contract approval

Each transaction receives a unique Business Transaction ID.

\---

\# Execution

An Execution represents an attempt to perform a business action.

Each execution records:

\- Execution ID

\- Decision

\- Metadata

\- Connector information

\- Evidence

Multiple executions may belong to a single Business Transaction.

\---

\# Decision

A Decision represents the policy evaluation result.

Possible outcomes include:

\- APPROVED

\- REJECTED

Each execution contains exactly one decision.

\---

\# Authorization

Approved executions must contain an authorization identifier.

The authorization binding proves that the execution was authorized before it occurred.

\---

\# Execution Trust Record

The Execution Trust Record is the immutable evidence package produced after execution.

It contains:

\- Transaction

\- Executions

\- Overrides

\- Hash

\- Signature

\- Verification history

\- Receipt history

The Trust Record is the primary audit artifact.

\---

\# Verification

Verification validates the Trust Record by checking:

\- Integrity

\- Signature

\- Authorization Binding

Verification results are appended without modifying the protected evidence.

\---

\# Receipt

A Receipt is cryptographic proof that an Execution Trust Record existed in a verified state.

Receipts are append-only lifecycle artifacts.

\---

\# Relationships

```text

Business Transaction

&#x20;       │ 1

&#x20;       │

&#x20;       ▼

Execution Trust Record

&#x20;       │

&#x20;       ├── 1..N Executions

&#x20;       ├── 0..N Verifications

&#x20;       └── 0..N Receipts

```

\---

\# Immutable vs Mutable Data

Immutable:

\- Business Transaction

\- Executions

\- Decisions

\- Overrides

\- Created At

Mutable Lifecycle Artifacts:

\- Verification History

\- Receipt History

Only immutable fields are included in the canonical representation used for hashing and signing.

\---

\# Summary

Parmana models execution as a sequence of immutable business evidence protected by cryptographic integrity and enriched over time with verification and receipt lifecycle events.
