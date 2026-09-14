\# Example 03 — Replay Execution

\## Overview

One of Parmana's defining capabilities is \*\*deterministic replay\*\*.

Replay allows an execution to be reproduced from its immutable Execution Trust Record, enabling organizations to demonstrate that a recorded outcome can be regenerated using the same inputs, policy, and execution context.

Unlike verification, which proves integrity, replay proves reproducibility.

This guide demonstrates replay using the TypeScript SDK.

\---

\# Learning Objectives

After completing this guide you will understand:

\* What deterministic replay is

\* Why replay matters

\* How replay differs from verification

\* How to replay an Execution Trust Record

\* How replay supports debugging, auditing, and governance

\---

\# Prerequisites

Complete the previous guides:

\* `docs/01\_basic\_execution.md`

\* `docs/02\_verify\_receipt.md`

You should already understand:

\* BusinessTransaction

\* Receipt

\* Verification

\* ExecutionTrustRecord

\---

\# What Is Replay?

Replay reconstructs a previously executed Business Transaction.

The Runtime loads the recorded trust chain and evaluates the same policy using the same recorded inputs.

If the execution is deterministic, replay produces the same decision.

\---

\# Replay Architecture

```text

Original Execution

&#x20;       │

BusinessTransaction

&#x20;       │

Decision

&#x20;       │

Execution

&#x20;       │

ExecutionTrustRecord

&#x20;       │

────────────────────────

&#x20;       │

Replay Request

&#x20;       │

Load Trust Record

&#x20;       │

Load Same Policy Version

&#x20;       │

Replay Signals

&#x20;       │

Recompute Decision

&#x20;       │

Compare Results

```

Replay never invents missing information.

Everything required must already exist in the trust chain.

\---

\# Why Replay Exists

Replay is useful for:

\* Governance

\* Internal audit

\* Regulatory review

\* Incident investigation

\* Testing

\* Compliance

\* Root-cause analysis

Rather than asking:

> "What do we think happened?"

Replay answers:

> "What does the recorded evidence reproduce?"

\---

\# Replay vs Verification

These capabilities serve different purposes.

| Verification | Replay |

| --------------------- | ----------------------- |

| Validates integrity | Reproduces execution |

| Checks hashes | Re-evaluates policy |

| Detects tampering | Detects non-determinism |

| Produces Verification | Produces replay result |

Most systems stop at verification.

Parmana provides both.

\---

\# Creating the Client

```typescript

import { ParmanaClient } from "@parmana/typescript-sdk";



const client = new ParmanaClient({

&#x20;   endpoint: "http://localhost:8080",

});

```

\---

\# Load the Trust Record

Replay requires an immutable `ExecutionTrustRecord`.

```typescript
const trustRecord = getExecutionTrustRecord();
```

In the SDK example, a placeholder record is supplied.

\---

\# Replay the Execution

Replay is initiated with a single SDK call.

```typescript
await client.replay(trustRecord);
```

The Runtime reconstructs the execution using the recorded trust artifacts.

\---

\# Replay Pipeline

Internally the Runtime performs:

```text

Execution Trust Record

&#x20;       │

Validate Record

&#x20;       │

Load Policy Version

&#x20;       │

Restore Runtime Signals

&#x20;       │

Reconstruct Decision Context

&#x20;       │

Evaluate Policy

&#x20;       │

Generate Replay Result

```

Every step is deterministic.

\---

\# Why Policy Versions Matter

Replay always uses the recorded `PolicyReference`.

For example:

```text

Policy



warehouse-policy



Version



1.0.0

```

Even if version \*\*2.0.0\*\* exists later, replay still evaluates \*\*1.0.0\*\*.

This guarantees historical reproducibility.

\---

\# Runtime Signals

Replay uses the recorded runtime signals.

Example:

```typescript

signals: {

&#x20;   batteryLevel: 92,

&#x20;   gpsLock: true,

&#x20;   obstacleDetected: false

}

```

Signals are never regenerated from current system state.

They are restored from the trust record.

\---

\# Deterministic Decision

Replay recomputes the policy decision.

Original:

```text

Decision



APPROVED

```

Replay:

```text

Decision



APPROVED

```

Matching results demonstrate deterministic execution.

\---

\# Replay Failure

Replay may fail when:

\* Trust record is incomplete

\* Required artifacts are missing

\* Policy version cannot be loaded

\* Recorded evidence is corrupted

\* Trust validation fails

Replay failures should be investigated rather than ignored.

\---

\# Error Handling

```typescript

try {



&#x20;   await client.replay(trustRecord);



}

catch(error){



&#x20;   console.error(error);



}

```

Applications should distinguish replay failures from execution failures.

\---

\# Replay Is Read-Only

Replay never changes the original trust chain.

It does not:

\* modify executions

\* replace decisions

\* update receipts

\* change trust hashes

Replay is a read-only governance capability.

\---

\# Benefits

Deterministic replay enables:

\* Repeatable investigations

\* Transparent governance

\* Reliable debugging

\* Regulatory evidence

\* Historical reconstruction

\* Independent validation

\---

\# Example Workflow

```text

Business Transaction

&#x20;       │

Execute

&#x20;       │

Receipt

&#x20;       │

Verification

&#x20;       │

Replay

&#x20;       │

Audit

```

Replay is one stage in the complete execution lifecycle.

\---

\# Complete Example

See:

```text

examples/03\_replay\_execution.ts

```

for the full implementation.

\---

\# Relationship to Later Examples

Replay becomes increasingly valuable in the remaining examples.

| Example | Replay Context |

| ------- | ------------------------------------ |

| 04 | Audit complete trust chain |

| 05 | Replay with human override |

| 06 | Replay autonomous vehicle execution |

| 07 | Replay clinical AI workflow |

| 08 | Replay financial approval |

| 09 | Replay multi-agent workflow |

| 10 | Replay using explicit policy version |

\---

\# Architectural Principles

Replay follows the same principles as the Parmana Runtime:

\* Deterministic execution

\* Immutable artifacts

\* Explicit PolicyReference

\* Recorded runtime signals

\* Independent reproducibility

\* No policy discovery

\* No hidden state

These guarantees make replay suitable for high-assurance systems.

\---

\# Summary

In this guide you learned how to:

\* Replay an Execution Trust Record

\* Reproduce a deterministic execution

\* Reuse the recorded policy version

\* Restore runtime signals

\* Understand the difference between replay and verification

Replay is a cornerstone of Parmana's Execution Trust Infrastructure because it transforms recorded evidence into reproducible evidence.

\---

\# Next

Continue with:

```text

docs/04\_audit\_trust\_chain.md

```

to learn how to inspect and audit an entire Execution Trust Record, including its authority, authorization, decision, execution history, verification history, and receipts.
