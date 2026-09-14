\# Override Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

An \*\*Override\*\* is an explicit, human-authorized decision that supersedes a previously rejected policy Decision.

Overrides exist to handle exceptional business situations that cannot be resolved through automated policy evaluation.

An Override never replaces the original Decision. Instead, it creates a new immutable trust artifact that becomes part of the Execution Trust Record.

\---

\# Scope

This specification defines:

\* Override creation

\* Override lifecycle

\* Override constraints

\* Override ownership

\* Relationship to Decision

\* Relationship to Execution

This specification does \*\*not\*\* define:

\* Policy Resolution

\* Policy Evaluation

\* Execution

\* Verification

\* Authentication and Authorization

\---

\# Override Flow

```text

Business Transaction



&#x20;       │



&#x20;       ▼



Policy Evaluation



&#x20;       │



&#x20;       ▼



Decision



&#x20;       │



&#x20;  REJECTED



&#x20;       │



&#x20;       ▼



Manual Review

(Outside Parmana)



&#x20;       │



&#x20;       ▼



Override



&#x20;       │



&#x20;       ▼



Execution

```

Manual Review is performed by the calling organization.

Parmana records only the resulting Override.

\---

\# Override Purpose

Overrides exist only for exceptional business situations.

Typical examples include:

\* Manager approval

\* Regulatory exception

\* Emergency operation

\* Risk acceptance

\* Business exception

Parmana does not determine whether an Override should occur.

\---

\# Override Object

Canonical structure:

```json

{

&#x20; "override": {

&#x20;   "outcome": "APPROVED",

&#x20;   "reason": "Manager approved exception",

&#x20;   "overriddenBy": "manager-001",

&#x20;   "overriddenAt": "2026-06-26T11:30:00Z"

&#x20; }

}

```

\---

\# Override Fields

| Field | Required | Description |

| ------------ | -------- | ---------------------------------------------- |

| outcome | Yes | Override outcome |

| reason | Yes | Business justification |

| overriddenBy | Yes | Authenticated identity initiating the override |

| overriddenAt | Yes | UTC timestamp |

\---

\# Override Rules

\## Rule 1

Overrides may only be created after a Decision has been recorded.

\---

\## Rule 2

Overrides are intended for rejected Decisions.

Approved Decisions do not require Overrides.

\---

\## Rule 3

Overrides never modify the original Decision.

The original Decision remains permanently recorded.

\---

\## Rule 4

Overrides are immutable.

Once recorded, an Override cannot be modified or deleted.

\---

\## Rule 5

Override history is append-only.

Every Override attempt is permanently recorded.

\---

\## Rule 6

Only one Override may be active for a Business Transaction.

Historical Overrides remain recorded but become inactive once superseded according to organizational policy.

\---

\## Rule 7

Overrides cannot be created after Execution has reached a terminal state.

If Execution has:

\* COMPLETED

\* FAILED

business corrections must be represented by a new Business Transaction (for example, refund, reversal, cancellation), not by an Override.

\---

\# Relationship to Decision

The original Decision remains authoritative as the policy evaluation result.

The Override represents an explicit business exception.

Example:

```text

Decision



REJECTED



↓



Override



APPROVED

```

Both are permanently preserved.

\---

\# Relationship to Execution

Execution proceeds using the effective decision:

\* Original Decision, or

\* Active Override

The original Decision is never removed.

\---

\# Relationship to Replay

Replay always reproduces:

\* Original Decision

\* Override History

Replay never recreates or changes Overrides.

\---

\# Relationship to Verification

Verification validates:

\* Override integrity

\* Override identity

\* Override timestamps

\* Override linkage to the Business Transaction

Verification does not determine whether the Override was an appropriate business decision.

\---

\# Relationship to the Execution Trust Record

Every Override becomes part of the immutable Execution Trust Record.

```text

Execution Trust Record



├── Decision



├── Override History



└── Executions

```

\---

\# Failure Conditions

An Override request is rejected if:

\* No Decision exists.

\* Execution has already reached a terminal state.

\* The Business Transaction does not exist.

\* The requester is not authorized (defined by the Authentication \& Authorization Model).

\---

\# Canonical Principles

\## Principle 1

Overrides are explicit human-authorized business exceptions.

\---

\## Principle 2

Overrides never replace the original Decision.

\---

\## Principle 3

Overrides are immutable.

\---

\## Principle 4

Override history is append-only.

\---

\## Principle 5

Only one Override may be active at any time.

\---

\## Principle 6

Overrides cannot occur after Execution has completed or failed.

\---

\## Principle 7

Business corrections after completed execution require a new Business Transaction.

\---

\# Canonical Model

```text

Business Transaction



&#x20;       │



&#x20;       ▼



Decision



&#x20;       │



&#x20;  REJECTED



&#x20;       │



&#x20;       ▼



Manual Review



&#x20;       │



&#x20;       ▼



Override



&#x20;       │



&#x20;       ▼



Execution



&#x20;       │



&#x20;       ▼



Execution Trust Record

```

\---

\# Summary

The Override Model provides a controlled mechanism for handling exceptional business situations where a rejected policy Decision must be superseded by an authorized human decision.

Overrides preserve the original Decision, create an immutable append-only history, and ensure that every exception remains permanently recorded within the Execution Trust Record, maintaining complete auditability and deterministic replay.
