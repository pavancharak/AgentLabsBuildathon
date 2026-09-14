\# Policy Resolution Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

Policy Resolution determines whether the Business Transaction can be evaluated under the exact policy requested by the calling application.

Parmana does not select policies.

The calling application explicitly specifies the policy to use, and Parmana resolves that policy from its Policy Store before policy evaluation begins.

Policy Resolution guarantees deterministic execution, replay, verification, and long-term auditability.

\---

\# Scope

This specification defines:

\* Policy identification

\* Policy resolution

\* Policy validation

\* Resolution failure conditions

\* Relationship to replay

\* Relationship to verification

This specification does \*\*not\*\* define:

\* Policy authoring

\* Policy publishing

\* Policy evaluation

\* Decision generation

\---

\# Policy Contract

Every Business Transaction MUST include a Policy object.

Canonical structure:

```json

{

&#x20; "policy": {

&#x20;   "name": "payment-approval",

&#x20;   "version": "2.1.0",

&#x20;   "schemaVersion": "1.0"

&#x20; }

}

```

\---

\# Required Fields

| Field | Required | Description |

| --------------- | -------- | ------------------------------ |

| `name` | Yes | Unique policy identifier |

| `version` | Yes | Exact policy version |

| `schemaVersion` | Yes | Expected policy schema version |

All fields are mandatory.

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



&#x20;┌──────┴────────┐



&#x20;▼               ▼



Found        Not Found



&#x20;│               │



&#x20;▼               ▼



Validate      Reject



Schema



&#x20;│



&#x20;┌──────┴────────┐



&#x20;▼               ▼



Valid       Invalid



&#x20;│               │



&#x20;▼               ▼



Policy      Reject

Evaluation

```

\---

\# Resolution Rules

\## Rule 1

The requested Policy Name must exist.

If the Policy Name does not exist, Policy Resolution fails.

\---

\## Rule 2

The requested Policy Version must exist.

Parmana never substitutes another version.

\---

\## Rule 3

The requested Schema Version must exactly match the stored policy schema.

Parmana never performs:

\* Schema migration

\* Schema conversion

\* Compatibility mode

\* Automatic transformation

\---

\## Rule 4

Parmana never falls back to the latest policy version.

The requested version must exist exactly as specified.

\---

\## Rule 5

Parmana never automatically selects another policy.

Policy selection is the responsibility of the calling application.

\---

\## Rule 6

Policy Resolution occurs before Policy Evaluation.

If Policy Resolution fails:

\* Policy Evaluation does not begin.

\* Override processing does not begin.

\* Execution does not begin.

\* Verification does not begin.

\* Receipt generation does not begin.

The request is rejected.

\---

\# Successful Resolution

A successful Policy Resolution binds the Business Transaction to:

\* Policy Name

\* Policy Version

\* Schema Version

These values become immutable and are permanently recorded within the Execution Trust Record.

\---

\# Replay

Replay never performs Policy Resolution.

Replay always uses the recorded:

\* Policy Name

\* Policy Version

\* Schema Version

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

This guarantees deterministic replay regardless of newer policy versions.

\---

\# Verification

Verification validates that the recorded policy:

\* Exists within the Execution Trust Record.

\* Matches the originally resolved Policy Name.

\* Matches the originally resolved Policy Version.

\* Matches the originally resolved Schema Version.

Verification never substitutes or upgrades policies.

\---

\# Failure Conditions

Policy Resolution fails when:

\* Policy Name does not exist.

\* Policy Version does not exist.

\* Schema Version does not match.

\* Policy definition cannot be loaded.

No further processing occurs after Policy Resolution fails.

\---

\# Relationship to Business Transaction

The Business Transaction declares the intended policy.

Policy Resolution validates that declaration.

The Business Transaction is never modified during Policy Resolution.

\---

\# Relationship to Execution Trust Record

The following policy attributes are permanently recorded:

```text

Policy



├── Name

├── Version

└── Schema Version

```

These values are immutable and become part of the Execution Trust Record.

\---

\# Canonical Principles

\## Principle 1

The calling application selects the policy.

\---

\## Principle 2

Parmana resolves and validates the requested policy.

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

The Policy Resolution Model establishes the exact policy context under which a Business Transaction is evaluated.

By requiring the calling application to explicitly specify the Policy Name, Policy Version, and Schema Version, Parmana guarantees deterministic policy resolution, execution, replay, and verification.

Once successfully resolved, the policy becomes an immutable component of the Execution Trust Record and remains the authoritative policy context for the lifetime of the Business Transaction.
