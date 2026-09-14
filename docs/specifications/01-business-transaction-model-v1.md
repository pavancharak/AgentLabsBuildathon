\# Business Transaction Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

A \*\*Business Transaction\*\* is the primary resource in Parmana.

It represents a single business intent submitted by a calling application for policy evaluation, execution, and trust recording.

Every operation performed by Parmana is scoped to a Business Transaction.

The Business Transaction is the root object from which all trust artifacts are derived.

\---

\# Scope

This specification defines:

\* Business Transaction identity

\* Business Transaction lifecycle

\* Business Transaction ownership

\* Business Transaction invariants

\* Relationship to other Parmana resources

This specification does \*\*not\*\* define:

\* Metadata structure

\* Policy resolution

\* Decision evaluation

\* Override processing

\* Execution

\* Verification

\* Receipt generation

These are defined in their respective specifications.

\---

\# Definition

A Business Transaction represents a single business operation.

Examples include:

\* Payment approval

\* Loan approval

\* Account creation

\* Insurance claim

\* Order fulfillment

\* Customer onboarding

The Business Transaction represents the business intent—not the execution attempt.

\---

\# Identity

Every Business Transaction is uniquely identified by:

```text

businessTransactionId

```

The identifier is supplied by the calling application.

Parmana never generates or modifies the Business Transaction identifier.

\---

\# Identity Rules

\## Rule 1

`businessTransactionId` is mandatory.

Every request must contain exactly one Business Transaction identifier.

\---

\## Rule 2

`businessTransactionId` is globally unique within the Parmana deployment.

No two Business Transactions may share the same identifier.

\---

\## Rule 3

The identifier is immutable.

Once a Business Transaction has been created, its identifier can never be changed.

\---

\## Rule 4

The identifier is business-defined.

Parmana treats the identifier as an opaque value and does not infer business meaning from it.

\---

\# Ownership

A Business Transaction owns exactly one:

\* Metadata

\* Policy Definition

\* Decision

\* Execution Trust Record

It may additionally own:

\* Zero or more Override Decisions

\* Zero or more Executions

\* Zero or more Verification Events

\---

\# Canonical Resource Model

```text

Business Transaction



├── Metadata



├── Policy



├── Decision



├── Override History



├── Executions



├── Verification History



└── Execution Trust Record

```

\---

\# Immutability

A Business Transaction is immutable after creation.

The following cannot be modified:

\* Business Transaction identifier

\* Metadata

\* Policy reference

\* Input signals

Subsequent processing creates new append-only artifacts without altering the original Business Transaction.

\---

\# Relationship to Executions

A Business Transaction represents business intent.

Execution represents an attempt to realize that intent.

One Business Transaction may contain multiple Executions.

Example:

```text

Business Transaction



PAY-1001



│



├── Execution #1 (FAILED)



├── Execution #2 (FAILED)



└── Execution #3 (COMPLETED)

```

Execution retries never create a new Business Transaction.

\---

\# Relationship to Overrides

A Business Transaction may contain multiple historical Override Decisions.

Only one Override Decision may be active at any point in time.

Override history is append-only.

\---

\# Relationship to Verification

Verification validates the Execution Trust Record associated with the Business Transaction.

Verification does not modify the Business Transaction.

Each verification event is recorded independently.

\---

\# Relationship to the Execution Trust Record

Every Business Transaction owns exactly one Execution Trust Record.

The Execution Trust Record is the canonical append-only record of all trust artifacts generated during the lifecycle of the Business Transaction.

\---

\# Lifecycle

```text

Business Transaction



↓



Policy Resolution



↓



Decision



↓



Override (optional)



↓



Execution(s)



↓



Receipt



↓



Verification(s)

```

The Business Transaction remains constant throughout the lifecycle.

Only child resources evolve.

\---

\# Duplicate Transactions

Business Transactions are idempotent.

If the same `businessTransactionId` is submitted:

\* with an identical request, Parmana returns the existing Business Transaction.

\* with different content, Parmana rejects the request because a Business Transaction identifier cannot represent multiple sets of business facts.

\---

\# Canonical Principles

\## Principle 1

The Business Transaction is the primary resource in Parmana.

\---

\## Principle 2

Every Business Transaction is uniquely identified by a `businessTransactionId`.

\---

\## Principle 3

The Business Transaction represents business intent, not execution.

\---

\## Principle 4

A Business Transaction is immutable.

\---

\## Principle 5

Executions, Overrides, and Verification Events are child resources of the Business Transaction.

\---

\## Principle 6

Every Business Transaction owns exactly one Execution Trust Record.

\---

\## Principle 7

All historical artifacts are append-only.

No historical information is modified or deleted.

\---

\# Canonical Model

```text

Business Transaction



│



├── Metadata



├── Policy



├── Decision



├── Override History



├── Executions



├── Verification History



└── Execution Trust Record

```

\---

\# Summary

The Business Transaction is the foundational resource within Parmana.

It defines the business intent submitted by the calling application and serves as the root object for all subsequent trust artifacts.

Every policy decision, override, execution, verification, receipt, and trust record is associated with exactly one immutable Business Transaction, ensuring deterministic execution, replay, auditability, and long-term trust.
