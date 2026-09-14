\# Policy Resolution Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

Every Business Transaction must explicitly declare the policy under which it is to be evaluated.

Parmana does not determine which policy to use.

Parmana resolves the requested policy from its Policy Store and verifies that the requested policy exists before policy evaluation begins.

This guarantees deterministic execution, replay, and verification.

\---

\# Scope

This specification defines:

\* Policy identification

\* Policy resolution

\* Policy validation

\* Failure conditions

\* Replay behavior

\* Verification behavior

\---

\# Design Principles

\## Principle 1

The calling application selects the policy.

Parmana never chooses a policy.

\---

\## Principle 2

Policy Resolution is deterministic.

The same request must always resolve to the same policy.

\---

\## Principle 3

Policy Resolution always occurs before Policy Evaluation.

\---

\## Principle 4

Replay never performs Policy Resolution.

Replay always uses the policy recorded in the Execution Trust Record.

\---

\## Principle 5

Verification always validates against the recorded policy.

\---

\# Request Contract

Every Business Transaction MUST include:

```json

{

&#x20; "metadata": {

&#x20;   "businessTransactionId": "PAY-1001"

&#x20; },

&#x20; "policy": {

&#x20;   "name": "payment-approval",

&#x20;   "version": "2.1.0",

&#x20;   "schemaVersion": "1.0"

&#x20; },

&#x20; "signals": {

&#x20;   "...": "..."

&#x20; }

}

```

\---

\# Required Policy Fields

| Field | Required | Description |

| ------------- | -------- | ------------------------------ |

| name | Yes | Policy identifier |

| version | Yes | Exact policy version |

| schemaVersion | Yes | Expected policy schema version |

All three fields are mandatory.

\---

\# Policy Resolution Flow

```text

Business Transaction



&#x20;       │



&#x20;       ▼



Policy Name



Policy Version



Schema Version



&#x20;       │



&#x20;       ▼



Resolve Policy



&#x20;       │



&#x20;       ├──────────────┐

&#x20;       │              │

&#x20;       ▼              ▼



Policy Found    Policy Not Found



&#x20;       │              │

&#x20;       ▼              ▼



Validate      Reject Request



Schema



&#x20;       │



&#x20;       ├──────────────┐

&#x20;       │              │

&#x20;       ▼              ▼



Schema Valid   Schema Invalid



&#x20;       │              │

&#x20;       ▼              ▼



Policy       Reject Request

Evaluation

```

\---

\# Resolution Rules

\## Rule 1

The requested Policy Name must exist.

If the Policy Name does not exist, the request is rejected.

\---

\## Rule 2

The requested Policy Version must exist.

Parmana never substitutes another version.

\---

\## Rule 3

The requested Schema Version must exactly match the stored policy schema.

Parmana never performs:

\* Schema migration

\* Schema transformation

\* Schema compatibility conversion

\---

\## Rule 4

Parmana never falls back to the latest policy version.

The requested version must exist exactly.

\---

\## Rule 5

Parmana never automatically selects another policy.

Policy selection is always performed by the calling application.

\---

\## Rule 6

Policy Resolution occurs before all other processing.

If Policy Resolution fails:

\* Policy Evaluation does not begin.

\* Override processing does not begin.

\* Execution does not begin.

\* Verification does not begin.

\* Receipt generation does not begin.

\---

\# Successful Resolution

If Policy Resolution succeeds, the following values become part of the immutable Business Transaction:

\* Policy Name

\* Policy Version

\* Schema Version

These values are permanently stored in the Execution Trust Record.

\---

\# Replay

Replay never performs Policy Resolution.

Replay always uses:

\* Recorded Policy Name

\* Recorded Policy Version

\* Recorded Schema Version

Example:

```text

Original Transaction



↓



Policy



payment-approval



Version 2.1.0



Schema 1.0



↓



Execution Trust Record



↓



Replay



↓



Uses payment-approval v2.1.0

```

\---

\# Verification

Verification always validates the Business Transaction using the recorded policy.

Verification never uses:

\* Latest Policy

\* Latest Version

\* Compatible Schema

\* Automatically selected Policy

\---

\# Failure Conditions

Policy Resolution fails if any of the following occur:

\* Policy Name does not exist.

\* Policy Version does not exist.

\* Schema Version does not match.

\* Policy definition cannot be loaded.

No further processing occurs after a Policy Resolution failure.

\---

\# Execution Trust Record

The following policy metadata is permanently recorded:

```text

Policy



├── Name

├── Version

└── Schema Version

```

These values are immutable.

\---

\# Canonical Principles

\## Principle 1

The calling application selects the policy.

\---

\## Principle 2

Parmana verifies the requested policy.

\---

\## Principle 3

Parmana never substitutes, upgrades, or automatically selects policies.

\---

\## Principle 4

Policy Resolution is deterministic.

\---

\## Principle 5

Policy Resolution always precedes Policy Evaluation.

\---

\## Principle 6

Replay always uses the recorded policy.

\---

\## Principle 7

Verification always validates against the recorded policy.

\---

\# Canonical Model

```text

Business Transaction



│



├── Metadata



├── Policy

│      ├── Name

│      ├── Version

│      └── Schema Version



├── Signals



│



▼



Policy Resolution



│



▼



Policy Evaluation



│



▼



Execution Trust Pipeline



│



▼



Execution Trust Record

```

\---

\# Summary

Policy Resolution establishes the exact policy context under which a Business Transaction is evaluated.

By requiring the calling application to explicitly specify the Policy Name, Policy Version, and Schema Version, Parmana guarantees deterministic execution, replay, verification, and long-term auditability.

The resolved policy becomes an immutable part of the Execution Trust Record and is reused throughout the lifecycle of the Business Transaction.
