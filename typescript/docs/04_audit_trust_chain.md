\# Example 04 — Audit the Execution Trust Chain

\## Overview

One of Parmana's primary goals is to make AI execution independently auditable.

Most systems record logs.

Parmana records an immutable \*\*Execution Trust Record\*\*, allowing an auditor to reconstruct exactly what happened, why it happened, who authorized it, which policy was applied, what decision was made, what executed, and what evidence was produced.

This guide demonstrates how to inspect and audit an `ExecutionTrustRecord` using the TypeScript SDK.

\---

\# Learning Objectives

After completing this guide you will understand:

\* The purpose of an Execution Trust Record

\* What information auditors require

\* How to inspect a complete trust chain

\* How immutable artifacts support governance

\* How auditing differs from verification and replay

\---

\# Prerequisites

Complete the previous guides:

\* `docs/01\_basic\_execution.md`

\* `docs/02\_verify\_receipt.md`

\* `docs/03\_replay\_execution.md`

You should already understand:

\* BusinessTransaction

\* Receipt

\* Verification

\* Replay

\---

\# Why Audit?

Execution answers:

> What happened?

Verification answers:

> Is the execution authentic?

Replay answers:

> Can the execution be reproduced?

Audit answers:

> Is the entire business process understandable, explainable, and independently reviewable?

Auditing is broader than verification.

\---

\# The Execution Trust Record

The Execution Trust Record is the canonical representation of everything Parmana knows about a Business Transaction.

```text

ExecutionTrustRecord

│

├── BusinessTransaction

│   ├── Authority

│   ├── Authorization

│   ├── Intent

│   └── PolicyReference

│

├── Overrides

│

├── Executions

│   ├── Decision

│   ├── Evidence

│   └── Metadata

│

├── Verifications

│

├── Receipts

│

└── Trust Record Hash

```

Nothing is hidden.

Everything required for governance is contained within this aggregate.

\---

\# Audit Workflow

```text

Business Transaction

&#x20;       │

Execute

&#x20;       │

Verification

&#x20;       │

Replay

&#x20;       │

Audit

```

Auditing typically occurs after execution but may be performed repeatedly throughout the lifetime of a trust record.

\---

\# Loading a Trust Record

An auditor begins by obtaining the immutable Execution Trust Record.

```typescript
const trustRecord = getExecutionTrustRecord();
```

In the SDK example, a placeholder trust record is provided for demonstration.

\---

\# Inspecting the Trust Record

The SDK example walks through the major sections.

```typescript

console.log(

&#x20;   trustRecord.trustRecordId

);



console.log(

&#x20;   trustRecord.businessTransactionId

);

```

These identifiers uniquely identify the audited execution.

\---

\# Reviewing the Business Transaction

The Business Transaction explains \*\*why execution was requested\*\*.

Review:

\* Authority

\* Authorization

\* Intent

\* PolicyReference

Example:

```typescript

console.log(

&#x20;   trustRecord.transaction.authority.authorityName

);



console.log(

&#x20;   trustRecord.transaction.intent.operation

);



console.log(

&#x20;   trustRecord.transaction.policy.policyName

);

```

\---

\# Reviewing Authority

Authority answers:

> Who owns this business decision?

Example:

```text

Acme Corporation

```

Authority establishes organizational accountability.

\---

\# Reviewing Authorization

Authorization answers:

> Who was permitted to execute?

Example:

```text

warehouse-robot-01

```

Authorization confirms that execution was permitted under organizational policy.

\---

\# Reviewing Intent

Intent answers:

> What business action was requested?

Example:

```text

MOVE\_PALLET

```

Intent remains immutable throughout the lifecycle of the transaction.

\---

\# Reviewing the Policy Reference

PolicyReference identifies exactly which governance policy was evaluated.

```text

warehouse-policy



Version 1.0.0

```

Historical replay always uses this recorded version.

\---

\# Reviewing Executions

The Execution history records what actually happened.

```typescript

for (const execution of trustRecord.executions) {



&#x20;   console.log(

&#x20;       execution.executionId

&#x20;   );



}

```

Each execution contains:

\* Decision

\* Status

\* Mode

\* Evidence

\* Metadata

\---

\# Reviewing Decisions

Every execution contains exactly one immutable Decision.

Review:

\* Decision ID

\* Outcome

\* Reason

\* Signals

\* Evaluated Time

Example:

```text

Outcome



APPROVED

```

\---

\# Reviewing Runtime Signals

Signals explain \*\*why\*\* the decision was produced.

Example:

```typescript

console.log(

&#x20;   execution.decision.signals

);

```

Signals become part of deterministic replay.

\---

\# Reviewing Execution Evidence

Evidence explains what occurred during execution.

Examples:

\* API response

\* File identifier

\* Vehicle telemetry

\* Medical recommendation

\* Payment reference

Evidence depends on the executing application.

\---

\# Reviewing Human Overrides

Some executions require human approval.

The trust record preserves override history.

```typescript

console.log(

&#x20;   trustRecord.overrides.length

);

```

Each override records:

\* Approver

\* Reason

\* Justification

\* Approval time

\---

\# Reviewing Verification History

Verification is append-only.

Every verification becomes part of the trust chain.

```typescript

console.log(

&#x20;   trustRecord.verifications.length

);

```

Auditors can determine:

\* When verification occurred

\* Which trust record was verified

\* Whether verification succeeded

\---

\# Reviewing Receipts

Receipts are cryptographic attestations of execution.

```typescript

console.log(

&#x20;   trustRecord.receipts.length

);

```

Typical receipt information includes:

\* Receipt ID

\* Signature

\* Algorithm

\* Trust Record Hash

\* Issued Time

\---

\# Reviewing the Trust Record Hash

Every Execution Trust Record has a canonical digest.

```typescript

console.log(

&#x20;   trustRecord.trustRecordHash

);

```

The hash enables independent integrity validation.

\---

\# Complete Audit Checklist

A complete audit should answer:

\* Who authorized execution?

\* Who executed?

\* What was requested?

\* Which policy was evaluated?

\* Which runtime signals were used?

\* What decision was produced?

\* What evidence was recorded?

\* Was execution verified?

\* Was replay successful?

\* Was a receipt generated?

If every answer is available, the trust chain is complete.

\---

\# Audit vs Traditional Logging

Traditional logs typically contain isolated events.

Parmana provides an immutable, structured trust chain.

| Traditional Logs | Parmana Audit |

| --------------------- | ---------------------------- |

| Individual events | Complete execution history |

| Mutable | Immutable |

| Partial context | Full business context |

| Difficult correlation | Single trust record |

| Weak provenance | Cryptographically verifiable |

\---

\# Complete Example

See:

```text

examples/04\_audit\_trust\_chain.ts

```

for the complete implementation.

\---

\# Architectural Principles

Auditing in Parmana is based on:

\* Immutable records

\* Explicit authority

\* Explicit authorization

\* Explicit intent

\* Explicit policy selection

\* Deterministic execution

\* Independent verification

\* Replayable evidence

These principles ensure that every governed execution can be reviewed years after it occurred.

\---

\# Summary

In this guide you learned how to audit an Execution Trust Record by inspecting:

\* Business Transaction

\* Authority

\* Authorization

\* Intent

\* PolicyReference

\* Executions

\* Decisions

\* Runtime Signals

\* Evidence

\* Overrides

\* Verifications

\* Receipts

\* Trust Record Hash

Together these artifacts provide a complete, explainable, and independently auditable record of execution.

\---

\# Next

Continue with:

```text

docs/05\_human\_in\_the\_loop.md

```

to learn how authorized human overrides become immutable components of the Execution Trust Chain while preserving replayability, verification, and auditability.
