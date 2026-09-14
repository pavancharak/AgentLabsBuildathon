\# Parmana Manual Review and Override Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

Parmana provides \*\*Execution Trust Infrastructure\*\*.

Policy evaluation produces an initial decision.

Business organizations may require human review before a final execution decision is reached.

This specification defines the canonical Manual Review and Override model.

\---

\# Design Principle

A \*\*Policy Decision\*\* is always the first decision.

A \*\*Human Review\*\* is an optional business process that occurs after a policy decision.

An \*\*Override\*\* is not a workflow.

An \*\*Override\*\* is one possible outcome of a Manual Review.

\---

\# Decision Flow

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Policy Evaluation

&#x20;       │

&#x20;       ▼

Policy Decision

&#x20;       │

&#x20;       ├── APPROVE

&#x20;       │       │

&#x20;       │       ▼

&#x20;       │   Execute

&#x20;       │

&#x20;       └── REJECT

&#x20;               │

&#x20;               ▼

&#x20;       Manual Review

&#x20;               │

&#x20;       ┌───────┴────────┐

&#x20;       │                │

&#x20;       ▼                ▼

Confirm Rejection   Override Approval

&#x20;       │                │

&#x20;       ▼                ▼

&#x20;Close Transaction   Execute

```

\---

\# Manual Review

Manual Review is initiated by the business workflow.

Parmana does not determine whether a transaction should be manually reviewed.

The calling application or business process decides whether manual review is required.

A common organizational policy may state:

> Every rejected transaction is routed for manual review.

Parmana records the outcome but does not enforce this workflow.

\---

\# Manual Review Outcomes

A Manual Review has exactly two outcomes.

\## Outcome 1

\*\*Confirm Rejection\*\*

The reviewer agrees with the policy decision.

No override is created.

The transaction remains rejected.

\---

\## Outcome 2

\*\*Override Approval\*\*

The reviewer disagrees with the policy decision.

A Human Override Decision is created.

The transaction proceeds through the normal execution trust pipeline.

\---

\# Override Definition

An Override exists only when the final human decision differs from the original policy decision.

Example:

```text

Policy Decision



REJECT



↓



Human Decision



APPROVE

```

This creates an Override.

Example:

```text

Policy Decision



REJECT



↓



Human Decision



REJECT

```

This does not create an Override.

It records a confirmed rejection.

\---

\# Trust Record

Every Business Transaction maintains a complete append-only history.

```text

Business Transaction



├── Policy Decision

│

├── Manual Review

│

├── Review Outcome

│

├── Override (if applicable)

│

├── Execution

│

├── Evidence

│

├── Verification

│

└── Receipt

```

Nothing is removed.

Nothing is replaced.

History is append-only.

\---

\# Responsibilities

\## Business Application

Responsible for:

\* Routing rejected transactions to manual review.

\* Assigning reviewers.

\* Initiating review.

\* Calling Parmana with the review outcome.

\---

\## Parmana

Responsible for:

\* Recording the policy decision.

\* Recording the manual review outcome.

\* Verifying reviewer authority.

\* Recording an override when applicable.

\* Maintaining the append-only trust record.

\* Generating execution evidence.

\* Generating verification artifacts.

\---

\# Canonical Principles

\## Principle 1

Every transaction begins with a Policy Decision.

\---

\## Principle 2

Manual Review is a business workflow.

It is external to Parmana.

\---

\## Principle 3

An Override is not a workflow.

It is one possible outcome of a Manual Review.

\---

\## Principle 4

Confirming a rejection does not create an Override.

\---

\## Principle 5

Only a human decision that changes the policy decision creates an Override.

\---

\## Principle 6

The original Policy Decision is never modified or removed.

\---

\## Principle 7

Every decision, review, and override is permanently recorded within the Business Transaction's Execution Trust Record.

\---

\# Canonical Model (Locked)

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Policy Decision

&#x20;       │

&#x20;       ├── APPROVE

&#x20;       │       │

&#x20;       │       ▼

&#x20;       │   Execute

&#x20;       │

&#x20;       └── REJECT

&#x20;               │

&#x20;               ▼

&#x20;       Manual Review

&#x20;               │

&#x20;       ┌───────┴────────┐

&#x20;       │                │

&#x20;       ▼                ▼

Confirm Rejection   Override Approval

&#x20;       │                │

&#x20;       ▼                ▼

&#x20;Close Transaction   Execute

```

This model establishes the relationship between policy decisions, manual review, and overrides while preserving Parmana's core principle of an append-only, verifiable execution trust record.
