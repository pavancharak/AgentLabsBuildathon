\# Decision Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

A \*\*Decision\*\* is the deterministic outcome produced by evaluating a Business Transaction against a resolved Policy.

The Decision represents Parmana's policy evaluation result.

It determines whether the Business Transaction is:

\* Approved

\* Rejected

The Decision is immutable and becomes part of the Execution Trust Record.

\---

\# Scope

This specification defines:

\* Decision generation

\* Decision outcomes

\* Decision immutability

\* Decision ownership

\* Relationship to Override

\* Relationship to Execution

This specification does \*\*not\*\* define:

\* Policy Resolution

\* Override processing

\* Execution

\* Verification

\---

\# Decision Flow

```text

Business Transaction



&#x20;       │



&#x20;       ▼



Policy Resolution



&#x20;       │



&#x20;       ▼



Policy Evaluation



&#x20;       │



&#x20;       ▼



Decision

```

A Decision is produced only after successful Policy Resolution.

\---

\# Decision Outcomes

Parmana produces exactly one of the following outcomes:

```text

APPROVED



REJECTED

```

No other Decision outcomes are defined in Version 1.

\---

\# Decision Object

Canonical structure:

```json

{

&#x20; "decision": {

&#x20;   "outcome": "APPROVED",

&#x20;   "evaluatedAt": "2026-06-26T10:30:00Z"

&#x20; }

}

```

\---

\# Decision Fields

| Field | Required | Description |

| ----------- | -------- | --------------------------------------- |

| outcome | Yes | APPROVED or REJECTED |

| evaluatedAt | Yes | UTC timestamp when evaluation completed |

Additional implementation-specific fields may be included provided they do not alter the Decision semantics.

\---

\# Decision Rules

\## Rule 1

Exactly one Decision is produced for every successfully evaluated Business Transaction.

\---

\## Rule 2

A Decision is produced only after successful Policy Resolution.

\---

\## Rule 3

A Decision is deterministic.

Given:

\* identical Business Transaction

\* identical Metadata

\* identical Policy

\* identical Signals

the Decision must always be identical.

\---

\## Rule 4

Once created, a Decision is immutable.

It is never modified or deleted.

\---

\## Rule 5

A Decision cannot be re-evaluated.

Any subsequent business action (such as an Override) creates a new trust artifact without changing the original Decision.

\---

\# Relationship to Override

If the Decision is:

```text

REJECTED

```

the calling application may initiate an Override.

The original Decision remains permanently recorded.

The Override never replaces the Decision.

Example:

```text

Decision



REJECTED



↓



Override



APPROVED

```

Both artifacts become part of the Execution Trust Record.

\---

\# Relationship to Execution

Execution is based on the effective decision.

If:

```text

Decision = APPROVED

```

Execution may proceed.

If:

```text

Decision = REJECTED

```

Execution stops unless a valid Override changes the effective decision.

\---

\# Relationship to Replay

Replay never reinterprets a Decision.

Replay re-evaluates the Business Transaction using the recorded:

\* Policy

\* Policy Version

\* Schema Version

\* Signals

The replay result is compared with the recorded Decision to verify deterministic behavior.

\---

\# Relationship to Verification

Verification validates:

\* Decision integrity

\* Decision consistency

\* Decision linkage to the recorded Policy

\* Decision linkage to the Business Transaction

Verification does not determine whether the Decision was "correct" from a business perspective.

\---

\# Relationship to the Execution Trust Record

Every Decision is permanently recorded.

```text

Execution Trust Record



├── Metadata



├── Policy



├── Signals



├── Decision



└── ...

```

The Decision is never replaced by an Override.

\---

\# Failure

If Policy Resolution fails:

No Decision is produced.

If Policy Evaluation fails due to an internal system error:

No Decision is recorded.

The Business Transaction transitions to a failure state according to the Business Transaction State Model.

\---

\# Canonical Principles

\## Principle 1

A Decision is the deterministic outcome of Policy Evaluation.

\---

\## Principle 2

Every successfully evaluated Business Transaction has exactly one Decision.

\---

\## Principle 3

A Decision is immutable.

\---

\## Principle 4

A Decision is never replaced by an Override.

\---

\## Principle 5

Replay validates the recorded Decision against deterministic policy evaluation.

\---

\## Principle 6

Verification validates Decision integrity, not business correctness.

\---

\# Canonical Model

```text

Business Transaction



&#x20;       │



&#x20;       ▼



Policy Resolution



&#x20;       │



&#x20;       ▼



Policy Evaluation



&#x20;       │



&#x20;       ▼



Decision



&#x20;       │



&#x20;┌──────┴──────┐



&#x20;▼             ▼



Execution    Override



&#x20;       │



&#x20;       ▼



Execution Trust Record

```

\---

\# Summary

The Decision Model defines the deterministic outcome of evaluating a Business Transaction against a resolved Policy.

A Decision is immutable, uniquely associated with a single Business Transaction, and permanently recorded within the Execution Trust Record.

It serves as the authoritative policy outcome upon which Overrides, Executions, Receipts, and Verification are built, while preserving a complete and auditable history of the original policy evaluation.
