\# Policy Language Specification

\*\*Version:\*\* 1.0.0

\*\*Status:\*\* Canonical

\*\*Applies To:\*\*

\- Parmana Runtime

\- Policy Engine

\- SDKs

\- Policy Authoring

\- Policy Validation

\- Replay

\- Verification

\---

\# 1. Purpose

The Parmana Policy Language defines the deterministic language used by the Parmana Policy Engine to evaluate Business Transactions.

The policy language is intentionally declarative.

Policies describe \*\*what\*\* conditions must hold.

The Policy Engine determines \*\*whether\*\* those conditions are satisfied.

Policies SHALL NOT execute code.

Policies SHALL NOT invoke external systems.

Policies SHALL remain deterministic.

\---

\# 2. Design Principles

The Policy Language is designed around the following principles.

\- Deterministic

\- Replayable

\- Auditable

\- Versioned

\- Human-readable

\- Machine-readable

\- Extensible

\- Platform Independent

\---

\# 3. Policy Document

Every policy SHALL contain:

```json

{

&#x20;   "policyId": "vendor-payment",

&#x20;   "policyVersion": "2.0.0",

&#x20;   "schemaVersion": "1.0.0",

&#x20;   "description": "...",

&#x20;   "rules": \[]

}

```

\---

\# 4. Rule Structure

A rule consists of

\- identifier

\- condition

\- outcome

Example

```json

{

&#x20;   "id": "approve-payment",



&#x20;   "condition": {

&#x20;       "fact": "amount",

&#x20;       "operator": "lte",

&#x20;       "value": 1000

&#x20;   },



&#x20;   "outcome": {

&#x20;       "action": "approve",

&#x20;       "reason": "Payment within threshold."

&#x20;   }

}

```

\---

\# 5. Canonical Condition Model

Every leaf condition SHALL use the canonical form

```json

{

&#x20;   "fact": "...",

&#x20;   "operator": "...",

&#x20;   "value": ...

}

```

Example

```json

{

&#x20;   "fact": "riskScore",

&#x20;   "operator": "lte",

&#x20;   "value": 25

}

```

\---

\# 6. Logical Conditions

Policies may combine conditions.

\## AND

```json

{

&#x20;   "all": \[

&#x20;       {

&#x20;           "fact": "vendorVerified",

&#x20;           "operator": "eq",

&#x20;           "value": true

&#x20;       },

&#x20;       {

&#x20;           "fact": "paymentApproved",

&#x20;           "operator": "eq",

&#x20;           "value": true

&#x20;       }

&#x20;   ]

}

```

\---

\## OR

```json

{

&#x20;   "any": \[

&#x20;       {

&#x20;           "fact": "isAdmin",

&#x20;           "operator": "eq",

&#x20;           "value": true

&#x20;       },

&#x20;       {

&#x20;           "fact": "overrideApproved",

&#x20;           "operator": "eq",

&#x20;           "value": true

&#x20;       }

&#x20;   ]

}

```

Logical conditions may be nested.

\---

\# 7. Supported Operators

The Policy Engine SHALL support the following operators.

| Operator | Description |

|-----------|-------------|

| eq | equals |

| neq | not equals |

| gt | greater than |

| gte | greater than or equal |

| lt | less than |

| lte | less than or equal |

| in | value exists within collection |

| not\_in | value does not exist within collection |

| exists | fact exists |

| not\_exists | fact does not exist |

Future operators SHALL be introduced through schema versioning.

\---

\# 8. Evaluation Model

Policy evaluation SHALL proceed as follows.

```

Policy

&#x20;   │

&#x20;   ▼

Rule 1

&#x20;   │

&#x20;   ├── Match → Decision

&#x20;   │

&#x20;   ▼

Rule 2

&#x20;   │

&#x20;   ├── Match → Decision

&#x20;   │

&#x20;   ▼

Rule N

&#x20;   │

&#x20;   ▼

Reject

```

Rules SHALL be evaluated in document order.

The first matching rule SHALL determine the outcome.

\---

\# 9. Determinism

The Parmana Policy Engine SHALL be deterministic.

Given identical

\- Policy

\- Policy Version

\- Schema Version

\- Runtime Signals

\- Policy Engine Version

the engine SHALL produce identical

\- Decision

\- Outcome

\- Matched Rule

\- Reason

\- Evaluation Trace

Determinism is a fundamental platform guarantee.

\---

\# 10. Deterministic Evaluation

Policy evaluation SHALL be a pure function.

```

Decision = Evaluate(

&#x20;   Policy,

&#x20;   RuntimeSignals

)

```

The evaluation SHALL depend exclusively upon

\- Policy

\- Runtime Signals

\---

\# 11. Canonical Inputs

Signals SHALL be normalized before evaluation.

Signal values SHALL preserve type.

Examples

```

100

```

is NOT equivalent to

```

"100"

```

No implicit type conversion SHALL occur.

\---

\# 12. Immutable Policies

Policies SHALL be immutable during evaluation.

The Policy Engine SHALL NOT modify

\- Policy

\- Rules

\- Conditions

\- Outcomes

\---

\# 13. Replay Guarantee

Replay SHALL produce an identical decision when evaluated with

\- identical policy

\- identical signals

\- identical engine version

Replay SHALL NOT depend upon

\- system time

\- execution order

\- environment

\---

\# 14. Prohibited Operations

The Policy Engine SHALL NOT

\- call LLMs

\- call external APIs

\- access databases

\- perform network requests

\- generate random numbers

\- mutate runtime state

\- use current timestamps

Policy evaluation SHALL remain isolated.

\---

\# 15. Runtime Signals

Signals SHALL be supplied by the Runtime.

Example

```json

{

&#x20;   "vendorVerified": true,

&#x20;   "paymentApproved": true,

&#x20;   "amount": 5000

}

```

The Policy Engine SHALL consume these values exactly as supplied.

\---

\# 16. Policy Outcomes

Each rule SHALL produce exactly one outcome.

```json

{

&#x20;   "action": "approve",

&#x20;   "reason": "Vendor verified."

}

```

Supported actions

\- approve

\- reject

\- require\_override

\---

\# 17. Versioning

Policies SHALL be versioned independently from the Policy Language.

Example

```json

{

&#x20;   "policyId": "vendor-payment",

&#x20;   "policyVersion": "2.0.0",

&#x20;   "schemaVersion": "1.0.0"

}

```

Policy versions evolve independently.

Language changes SHALL increment the Schema Version.

\---

\# 18. Backward Compatibility

Prior to Parmana v1.0

The legacy condition format

```json

{

&#x20;   "signal": "...",

&#x20;   "equals": true

}

```

is deprecated.

The canonical Policy Language SHALL use

```json

{

&#x20;   "fact": "...",

&#x20;   "operator": "...",

&#x20;   "value": ...

}

```

No backward compatibility is required because Parmana has not yet reached a stable public release.

\---

\# 19. Architecture Guarantee

The Policy Language is part of Parmana's public contract.

All SDKs, runtimes, validators, replay engines and verification engines SHALL interpret policies identically.

This guarantees deterministic execution, replay, verification and auditability across every Parmana implementation.
