\# Example 10 — Custom Policy Selection

\## Overview

One of Parmana's core architectural principles is that \*\*policy selection is explicit\*\*.

A Business Transaction always specifies the exact `PolicyReference` that governs execution.

The Runtime never:

\* Discovers policies

\* Searches for matching policies

\* Chooses the "best" policy

\* Applies the latest policy automatically

Instead, the Runtime loads \*\*exactly one\*\* policy identified by the `BusinessTransaction`.

This deterministic approach ensures that execution, replay, verification, and auditing always evaluate the same governance rules.

This guide demonstrates explicit policy selection using the TypeScript SDK.

\---

\# Learning Objectives

After completing this guide you will understand:

\* Why policy selection is explicit

\* How `PolicyReference` participates in the trust chain

\* Why runtime policy discovery is prohibited

\* How deterministic replay depends on policy versions

\* How explicit policy references improve governance

\---

\# Why Explicit Policies?

Many policy engines automatically search for policies.

For example:

```text id="0utwji"

Find latest policy...



Find matching policy...



Apply newest version...

```

Although convenient, this approach creates uncertainty.

Questions become difficult to answer:

\* Which policy executed?

\* Which version produced the decision?

\* Can the decision be reproduced?

\* Will replay produce the same outcome?

Parmana eliminates this ambiguity through explicit policy selection.

\---

\# Execution Trust Chain

```text id="h61ndz"

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

Execution

&#x20;     │

Receipt

&#x20;     │

Execution Trust Record

```

The `PolicyReference` is an immutable trust artifact.

\---

\# Example Scenario

A manufacturing system requests permission to start a production batch.

The request explicitly specifies:

```text id="pl7szp"

manufacturing-production-policy



Version 2.3.1

```

The Runtime loads that exact policy.

No discovery occurs.

\---

\# Creating the Policy Reference

```typescript id="k5zj4a"

const policy = {



&#x20;   policyName:

&#x20;       "manufacturing-production-policy",



&#x20;   policyVersion:

&#x20;       "2.3.1"



};

```

Both the policy name and version become part of the immutable Business Transaction.

\---

\# Business Transaction

The Business Transaction includes the selected policy.

```typescript id="bdh8v2"

const transaction = {



&#x20;   businessTransactionId:

&#x20;       "production-001",



&#x20;   authority,



&#x20;   authorization,



&#x20;   intent,



&#x20;   policy,



&#x20;   createdAt: new Date()



};

```

Policy selection occurs before execution begins.

\---

\# Runtime Responsibilities

When execution starts, the Runtime performs the following sequence:

```text id="m8x1qn"

BusinessTransaction

&#x20;       │

Read PolicyReference

&#x20;       │

Load Exact Policy

&#x20;       │

Evaluate

&#x20;       │

Produce Decision

```

Notice what does \*\*not\*\* happen:

\* No policy search

\* No policy ranking

\* No automatic upgrades

\* No implicit defaults

\---

\# Decision

The Decision records the policy that produced it.

Example:

```text id="6uuh8x"

Decision



APPROVED

```

The Decision references the same immutable `PolicyReference` contained in the Business Transaction.

\---

\# Runtime Signals

Policy evaluation uses the recorded runtime signals.

Example:

```typescript id="7c8lra"

signals: {



&#x20;   machineReady: true,



&#x20;   operatorCertified: true,



&#x20;   safetyInspectionPassed: true,



&#x20;   inventoryAvailable: true



}

```

Signals and policy together determine the decision.

\---

\# Execution

Execution records what occurred after policy approval.

Example:

```text id="7wz9hl"

Status



COMPLETED

```

Execution is governed by the selected policy—not by the Runtime.

\---

\# Execution Evidence

Execution Evidence records application-specific production details.

Example:

```typescript id="jv3j1w"

{



&#x20;   productionLine:

&#x20;       "LINE-3",



&#x20;   batch:

&#x20;       "BATCH-2026-001",



&#x20;   productionStarted: true



}

```

Evidence becomes part of the immutable execution history.

\---

\# Replay

Replay depends on explicit policy selection.

Replay sequence:

```text id="h4p7kt"

Execution Trust Record

&#x20;       │

Read PolicyReference

&#x20;       │

Load Version 2.3.1

&#x20;       │

Replay Signals

&#x20;       │

Replay Decision

```

Replay never evaluates version \*\*2.4.0\*\* simply because it exists.

Historical executions always use the original policy version.

\---

\# Verification

Verification confirms:

\* PolicyReference integrity

\* Decision consistency

\* Trust Record integrity

\* Receipt integrity

\* Hash consistency

Verification guarantees that the recorded policy has not been altered.

\---

\# Why Runtime Discovery Is Dangerous

Imagine that version \*\*3.0.0\*\* becomes available after execution.

If replay automatically selected the newest policy:

```text id="vqy4zh"

Original



Policy 2.3.1



Replay



Policy 3.0.0

```

The reproduced decision might differ from the historical decision.

Replay would no longer be deterministic.

Parmana prevents this by treating the policy version as part of the immutable trust chain.

\---

\# Architectural Principle

Policy selection belongs to the Business Transaction.

The Runtime's responsibility is limited to:

\* Loading the specified policy

\* Evaluating the specified policy

\* Recording the resulting decision

The Runtime never decides \*which\* policy should apply.

\---

\# Benefits

Explicit policy selection provides:

\* Deterministic execution

\* Deterministic replay

\* Independent verification

\* Historical reproducibility

\* Regulatory transparency

\* Version traceability

\* Explainable governance

\---

\# Complete Workflow

```text id="szz2f8"

Business Transaction

&#x20;       │

PolicyReference

&#x20;       │

Load Exact Version

&#x20;       │

Evaluate

&#x20;       │

Decision

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

Every stage preserves the selected policy version.

\---

\# Complete Example

See:

```text id="1l8phx"

examples/10\_custom\_policy.ts

```

for the complete TypeScript implementation.

\---

\# Relationship to the Parmana Architecture

This example illustrates one of Parmana's foundational architectural guarantees:

\* \*\*BusinessTransaction specifies the `PolicyReference`.\*\*

\* \*\*The Runtime loads exactly one policy.\*\*

\* \*\*Policy discovery is never performed at runtime.\*\*

\* \*\*Replay always evaluates the recorded policy version.\*\*

These guarantees make execution reproducible across time and environments.

\---

\# Summary

In this guide you learned:

\* Why policy selection is explicit

\* How `PolicyReference` becomes part of the trust chain

\* Why runtime policy discovery is prohibited

\* How replay depends on policy versioning

\* How explicit policy references improve governance and auditability

Explicit policy selection is fundamental to Parmana's Execution Trust Infrastructure because it ensures there is never any ambiguity about \*\*which governance rules authorized an execution\*\*.

\---

\# Congratulations

You have completed all ten TypeScript SDK examples.

You now understand how Parmana governs AI execution through:

\* Authority

\* Authorization

\* Intent

\* PolicyReference

\* BusinessTransaction

\* Decision

\* Execution

\* Execution Evidence

\* Human Overrides

\* Receipts

\* Verification

\* Replay

\* Execution Trust Records

These concepts form the foundation of Parmana's \*\*Execution Trust Infrastructure\*\*, enabling AI systems to execute only what has been authorized, under explicitly selected policies, with every execution remaining deterministic, replayable, independently verifiable, and fully auditable.
