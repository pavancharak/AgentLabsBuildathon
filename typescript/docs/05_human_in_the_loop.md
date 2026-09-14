\# Example 05 — Human in the Loop

\## Overview

Not every AI-assisted decision should execute autonomously.

Many organizations require explicit human approval before an AI system performs a sensitive action. Parmana supports this governance model by treating human approvals as \*\*first-class trust artifacts\*\*.

A human override does not replace the trust chain. Instead, it becomes an immutable part of it.

This guide demonstrates how Human-in-the-Loop (HITL) governance is modeled using the TypeScript SDK.

\---

\# Learning Objectives

After completing this guide you will understand:

\* When human approval is required

\* What an `Override` represents

\* How overrides become part of the Execution Trust Record

\* How replay and verification include human decisions

\* Why immutable approval history matters

\---

\# Prerequisites

Complete the previous guides:

\* `docs/01\_basic\_execution.md`

\* `docs/02\_verify\_receipt.md`

\* `docs/03\_replay\_execution.md`

\* `docs/04\_audit\_trust\_chain.md`

\---

\# Why Human-in-the-Loop?

Some business decisions cannot be fully delegated to automation.

Examples include:

\* Large financial transfers

\* Clinical recommendations

\* Military operations

\* Critical infrastructure control

\* Production releases

\* Safety-critical robotics

In these situations, AI may recommend an action, but a human must explicitly approve execution.

\---

\# Execution Trust Chain with Human Approval

```text

Authority

&#x20;     │

Authorization

&#x20;     │

Intent

&#x20;     │

PolicyReference

&#x20;     │

BusinessTransaction

&#x20;     │

Policy Evaluation

&#x20;     │

Decision

&#x20;     │

Human Approval

&#x20;     │

Override

&#x20;     │

Execution

&#x20;     │

Receipt

&#x20;     │

ExecutionTrustRecord

```

The override extends the trust chain without replacing any existing artifacts.

\---

\# What Is an Override?

An `Override` records an authorized human decision.

It includes:

\* Override identifier

\* Business Transaction identifier

\* Approver

\* Reason

\* Justification

\* Approval timestamp

Unlike traditional approval logs, Parmana treats the override as an immutable governance artifact.

\---

\# Example Scenario

A warehouse robot requests permission to enter a restricted loading zone.

The policy determines that the action requires supervisor approval.

The supervisor reviews the request and authorizes execution.

The approval becomes part of the permanent execution history.

\---

\# Creating the Override

```typescript

const override: Override = {

&#x20;   overrideId: "override-001",



&#x20;   businessTransactionId:

&#x20;       transaction.businessTransactionId,



&#x20;   approvedBy: "operations-manager",



&#x20;   reason:

&#x20;       "Urgent customer shipment.",



&#x20;   justification:

&#x20;       "Supervisor approval recorded.",



&#x20;   approvedAt: new Date()

};

```

The override is explicit and immutable.

\---

\# Building the Trust Record

The override is stored alongside every other trust artifact.

```typescript

const trustRecord: ExecutionTrustRecord = {



&#x20;   ...



&#x20;   overrides: \[

&#x20;       override

&#x20;   ],



&#x20;   executions: \[

&#x20;       execution

&#x20;   ],



&#x20;   ...



};

```

Notice that overrides are modeled as an array.

Although many business processes allow only one accepted override, an append-only history preserves future extensibility.

\---

\# Why Are Overrides Immutable?

A common mistake is to overwrite approval history.

Parmana never modifies an existing approval.

Instead:

\* approvals are recorded

\* history grows

\* previous approvals remain intact

This guarantees historical transparency.

\---

\# Approval vs Authorization

These concepts are related but different.

| Authorization | Override |

| ------------------------ | ------------------------------------------ |

| Grants permission to act | Grants approval for a specific transaction |

| Long-lived | Transaction-specific |

| Issued before execution | Recorded during execution |

| Defines capabilities | Documents human intervention |

Authorization establishes capability.

Override records an exceptional or required human decision.

\---

\# Replay with Human Approval

Replay restores the original approval context.

```text

Replay

&#x20;     │

Load Override

&#x20;     │

Restore Approval

&#x20;     │

Replay Execution

```

Replay does not ask for approval again.

It uses the recorded approval because replay reconstructs historical execution, not current business state.

\---

\# Verification with Human Approval

Verification validates:

\* Override identifier

\* Business Transaction identifier

\* Approval timestamp

\* Approver

\* Trust record integrity

If an override has been modified after execution, verification fails.

\---

\# Auditing Human Decisions

Auditors can determine:

\* Who approved

\* Why approval was granted

\* When approval occurred

\* Which transaction was affected

\* Which execution used the approval

This provides significantly stronger governance than free-form approval notes or application logs.

\---

\# Typical Use Cases

Human-in-the-Loop is common in:

\* Healthcare

\* Banking

\* Insurance

\* Defense

\* Manufacturing

\* Robotics

\* Critical infrastructure

\* Enterprise approvals

Each domain can define different approval policies while preserving the same trust chain structure.

\---

\# Benefits

Modeling approvals as immutable trust artifacts provides:

\* Accountability

\* Explainability

\* Replayability

\* Auditability

\* Regulatory evidence

\* Independent verification

\---

\# Complete Workflow

```text

Business Transaction

&#x20;       │

Policy Evaluation

&#x20;       │

Decision

&#x20;       │

Human Review

&#x20;       │

Override

&#x20;       │

Execution

&#x20;       │

Receipt

&#x20;       │

Verification

&#x20;       │

Replay

&#x20;       │

Audit

```

Every stage contributes to the final Execution Trust Record.

\---

\# Architectural Principles

Human approval in Parmana follows these principles:

\* Explicit approval

\* Immutable recording

\* Append-only history

\* Independent verification

\* Deterministic replay

\* Separation of authorization and approval

These principles ensure that human intervention strengthens the trust chain rather than bypassing it.

\---

\# Complete Example

See:

```text

examples/05\_human\_in\_the\_loop.ts

```

for the full implementation.

\---

\# Summary

In this guide you learned:

\* Why Human-in-the-Loop governance exists

\* How overrides are modeled

\* Why overrides are immutable

\* How approvals participate in replay

\* How verification validates human decisions

\* How auditing benefits from explicit approval records

Parmana treats human approvals as durable governance artifacts, ensuring they remain visible, reproducible, and independently verifiable throughout the lifetime of the Execution Trust Record.

\---

\# Next

Continue with:

```text

docs/06\_autonomous\_vehicle.md

```

to learn how the same execution trust architecture governs autonomous vehicle operations, where policy evaluation, runtime signals, execution evidence, and trust artifacts combine to produce verifiable autonomous behavior.
