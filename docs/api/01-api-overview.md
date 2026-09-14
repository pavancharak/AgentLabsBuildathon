\# API Overview v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

The Parmana API provides a resource-oriented interface for creating, executing, verifying, and auditing Business Transactions.

The API is built around a single primary resource:

> \*\*Business Transaction\*\*

All other resources are owned by a Business Transaction.

The API exposes the complete lifecycle of a Business Transaction while preserving deterministic execution, replay, verification, and auditability.

\---

\# API Principles

\## Principle 1

The Business Transaction is the primary API resource.

\---

\## Principle 2

All subordinate resources belong to a Business Transaction.

\---

\## Principle 3

Resources are immutable unless explicitly defined otherwise.

\---

\## Principle 4

Historical artifacts are append-only.

\---

\## Principle 5

Every Business Transaction owns exactly one Execution Trust Record.

\---

\## Principle 6

The API is deterministic.

Identical Business Transactions evaluated under the same recorded Policy always produce the same trust artifacts.

\---

\# Resource Model

```text

Business Transaction



├── Executions



├── Override



├── Verification History



├── Receipt



└── Trust Chain

```

The Execution Trust Record is the canonical internal trust object.

The Trust Chain is a representation of that record.

\---

\# Primary Resource

\## Business Transaction

Represents a single business operation submitted by a calling application.

Examples:

\* Payment approval

\* Loan approval

\* Insurance claim

\* Customer onboarding

Every Business Transaction is uniquely identified by:

```text

businessTransactionId

```

\---

\# Child Resources

\## Executions

Represent attempts to execute the Business Transaction.

A Business Transaction may have:

\* Zero Executions

\* One Execution

\* Multiple Executions

\---

\## Override

Represents a human-authorized exception to a rejected Decision.

Overrides never replace the original Decision.

\---

\## Verification History

Records every Verification event performed against the Execution Trust Record.

Verification history is append-only.

\---

\## Receipt

A portable, cryptographically verifiable artifact derived from an Execution.

Each Execution has exactly one Receipt.

\---

\## Trust Chain

A navigable representation of the Execution Trust Record.

Used for:

\* Audit

\* Investigation

\* Visualization

\* Independent inspection

\---

\# API Groups

The API is organized into the following resource groups.

\## Business Transactions

Create and retrieve Business Transactions.

\---

\## Executions

Create and retrieve Execution resources.

\---

\## Overrides

Create and retrieve Overrides.

\---

\## Verification

Verify the integrity of a Business Transaction.

\---

\## Receipts

Retrieve cryptographically signed Receipts.

\---

\## Trust Chain

Retrieve the complete trust relationship for a Business Transaction.

\---

\## Policies

Discover available Policies.

\---

\## System

Operational endpoints.

Examples:

\* Health

\* Version

\---

\# API Resource Hierarchy

```text

/transactions



/transactions/{businessTransactionId}



/transactions/{businessTransactionId}/executions



/transactions/{businessTransactionId}/override



/transactions/{businessTransactionId}/verify



/transactions/{businessTransactionId}/receipt



/transactions/{businessTransactionId}/trust-chain



/policies



/health



/version

```

\---

\# API Workflow

A typical Business Transaction progresses through the following sequence.

```text

Create Business Transaction



↓



Policy Resolution



↓



Decision



↓



Override (Optional)



↓



Execution



↓



Receipt



↓



Verification



↓



Trust Chain

```

\---

\# Design Goals

The Parmana API is designed to provide:

\* Deterministic policy evaluation.

\* Immutable execution records.

\* Cryptographic trust artifacts.

\* Independent verification.

\* Deterministic replay.

\* Complete auditability.

\---

\# Canonical Principles

\## Principle 1

Business Transaction is the primary API resource.

\---

\## Principle 2

All API resources are transaction-scoped.

\---

\## Principle 3

The Execution Trust Record is the canonical trust object.

\---

\## Principle 4

The Trust Chain is a representation of the Execution Trust Record.

\---

\## Principle 5

Receipts provide portable cryptographic proof.

\---

\## Principle 6

Verification validates trust artifacts without modifying them.

\---

\## Principle 7

The API is resource-oriented, deterministic, and append-only.

\---

\# Summary

The Parmana API exposes the complete lifecycle of a Business Transaction through a resource-oriented interface.

By centering the API on immutable Business Transactions and append-only trust artifacts, Parmana enables deterministic execution, replay, verification, and long-term auditability while maintaining a clear separation between business resources and platform infrastructure.
