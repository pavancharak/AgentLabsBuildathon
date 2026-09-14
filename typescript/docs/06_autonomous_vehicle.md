\# Example 06 — Autonomous Vehicle Governance

\## Overview

Autonomous vehicles make thousands of decisions every minute.

These decisions may involve navigation, obstacle avoidance, speed control, lane changes, emergency braking, passenger safety, and regulatory compliance.

While AI models determine \*how\* to drive, organizations also need confidence that every autonomous action is:

\* Authorized

\* Governed by policy

\* Executed deterministically

\* Independently verifiable

\* Replayable

\* Auditable

Parmana provides this execution authorization through its \*\*Execution Trust Infrastructure\*\*.

This guide demonstrates how an autonomous driving workflow is represented using the TypeScript SDK.

\---

\# Learning Objectives

After completing this guide you will understand:

\* Why autonomous systems require execution authorization

\* How Business Transactions represent driving operations

\* How runtime signals influence policy evaluation

\* How execution evidence is recorded

\* How autonomous driving becomes replayable and auditable

\---

\# Why Autonomous Vehicles Need Governance

Driving is not a single decision.

It is a continuous sequence of governed business operations.

Examples include:

\* Start autonomous driving

\* Change lane

\* Reduce speed

\* Stop vehicle

\* Yield to pedestrians

\* Enter restricted road

\* Park vehicle

\* Emergency braking

Each operation should be explainable after it occurs.

\---

\# Execution Trust Chain

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

Runtime Signals

&#x20;     │

Policy Evaluation

&#x20;     │

Decision

&#x20;     │

Execution

&#x20;     │

Execution Evidence

&#x20;     │

Receipt

&#x20;     │

Execution Trust Record

```

Every stage becomes an immutable governance artifact.

\---

\# Example Scenario

An autonomous delivery vehicle receives an instruction to drive to a destination.

Before movement begins, Parmana evaluates whether execution is permitted.

The Runtime checks:

\* Vehicle authorization

\* Selected driving policy

\* GPS availability

\* Obstacle detection

\* Battery level

\* Environmental conditions

Only after policy approval does execution begin.

\---

\# Authority

Authority identifies the organization responsible for vehicle operations.

Example:

```typescript

const authority = {

&#x20;   authorityId: "authority-001",

&#x20;   authorityName: "Autonomous Fleet Authority"

};

```

Authority establishes accountability for every execution.

\---

\# Authorization

Authorization grants the vehicle permission to execute autonomous driving.

Example:

```typescript

permissions: \[

&#x20;   "AUTONOMOUS\_DRIVE"

]

```

Authorization answers:

> Which autonomous operations may this vehicle perform?

\---

\# Intent

Intent defines the requested operation.

Example:

```typescript
operation: "AUTONOMOUS\_DRIVE";

target: "Destination Alpha";
```

Intent describes \*\*what\*\* the vehicle is attempting to accomplish.

\---

\# Policy Reference

The Business Transaction specifies the exact driving policy.

```typescript

policyName:

&#x20;   "autonomous-driving-policy"



policyVersion:

&#x20;   "1.0.0"

```

Replay always uses this recorded policy version.

\---

\# Runtime Signals

Policy evaluation depends on runtime signals captured at execution time.

Example:

```typescript

signals: {



&#x20;   gpsLock: true,



&#x20;   obstacleDetected: false,



&#x20;   batteryLevel: 92,



&#x20;   weather: "CLEAR"



}

```

Signals represent the execution context.

They become permanent evidence.

\---

\# Decision

The Runtime evaluates the policy using the recorded signals.

Example:

```text

Decision



APPROVED

```

The Decision records:

\* Outcome

\* Reason

\* Evaluation time

\* Policy used

\* Runtime signals

\---

\# Execution

Execution records what actually happened.

Example:

```text

Status



COMPLETED

```

Execution is separate from Decision.

Decision authorizes.

Execution records reality.

\---

\# Execution Evidence

Evidence describes observable execution results.

Example:

```typescript

{



&#x20;   distanceKm: 18.4,



&#x20;   averageSpeed: 42,



&#x20;   destinationReached: true



}

```

Evidence may include:

\* Telemetry

\* Sensor summaries

\* Route information

\* Vehicle state

\* Operational metrics

Parmana intentionally treats evidence as application-defined.

\---

\# Receipt

Successful execution generates a Receipt.

Example:

```text

Receipt ID



receipt-001



Algorithm



Ed25519

```

Receipts provide cryptographic proof of execution.

\---

\# Execution Trust Record

All artifacts become part of the immutable Execution Trust Record.

```text

BusinessTransaction



Decision



Execution



Evidence



Receipt



Verification



Replay

```

Nothing is discarded.

\---

\# Replay

Replay reconstructs the original execution.

Replay uses:

\* Same PolicyReference

\* Same runtime signals

\* Same Business Transaction

Replay never substitutes current GPS coordinates or current weather.

Historical replay always uses recorded evidence.

\---

\# Verification

Verification confirms:

\* Trust Record integrity

\* Receipt integrity

\* Hash consistency

\* Decision consistency

Verification determines whether the execution record remains authentic.

\---

\# Auditing

An auditor can later determine:

\* Who authorized driving

\* Which vehicle executed

\* Which policy was applied

\* Which runtime signals existed

\* Which decision was produced

\* What evidence was collected

No external logs are required.

\---

\# Safety Benefits

Execution authorization supports:

\* Fleet accountability

\* Incident investigation

\* Regulatory compliance

\* Insurance review

\* Manufacturer analysis

\* Safety certification

Parmana governs the execution process rather than the vehicle's control algorithms.

\---

\# Complete Example

See:

```text

examples/06\_autonomous\_vehicle.ts

```

for the full TypeScript implementation.

\---

\# Architectural Principles

Autonomous vehicle governance follows the same Parmana principles used across every domain:

\* Explicit Authority

\* Explicit Authorization

\* Explicit Intent

\* Explicit PolicyReference

\* Deterministic Policy Evaluation

\* Immutable Decisions

\* Recorded Runtime Signals

\* Execution Evidence

\* Independent Verification

\* Deterministic Replay

These principles remain constant whether the system controls a robot, a vehicle, or another autonomous platform.

\---

\# Relationship to Other Examples

The concepts introduced here extend naturally to other domains.

| Example | Focus |

| ------- | --------------------------------- |

| 07 | Clinical AI governance |

| 08 | Financial transaction governance |

| 09 | Multi-agent AI coordination |

| 10 | Explicit policy version selection |

The trust architecture remains identical even though the application domain changes.

\---

\# Summary

In this guide you learned how Parmana governs autonomous vehicle execution by recording:

\* Authority

\* Authorization

\* Intent

\* PolicyReference

\* Runtime Signals

\* Decision

\* Execution

\* Evidence

\* Receipt

\* Execution Trust Record

This approach provides deterministic, replayable, independently verifiable execution authorization for autonomous systems.

\---

\# Next

Continue with:

```text

docs/07\_medical\_ai.md

```

to explore how the same execution trust architecture applies to AI-assisted clinical workflows, where human oversight, policy evaluation, execution evidence, and regulatory auditability are equally critical.
