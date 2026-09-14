\# Example 07 — Medical AI Governance

\## Overview

Artificial Intelligence is increasingly assisting physicians in diagnosis, treatment planning, medical imaging, triage, and clinical decision support.

While AI can improve healthcare outcomes, hospitals must also ensure that every AI-assisted action is:

\* Authorized

\* Governed by approved clinical policies

\* Explainable

\* Auditable

\* Replayable

\* Independently verifiable

Parmana provides this governance by recording an immutable \*\*Execution Trust Chain\*\* for every AI-assisted clinical workflow.

This guide demonstrates how healthcare organizations can use the TypeScript SDK to govern AI execution while preserving physician oversight.

\---

\# Learning Objectives

After completing this guide you will understand:

\* Why healthcare requires execution authorization

\* How clinical decisions become Business Transactions

\* How policy evaluation supports clinical safety

\* How physician oversight integrates into the trust chain

\* How clinical workflows become replayable and auditable

\---

\# Why AI Governance Matters in Healthcare

Clinical AI should support healthcare professionals—not replace them.

Examples of AI-assisted workflows include:

\* Disease diagnosis

\* Medical image interpretation

\* Treatment recommendations

\* Drug interaction analysis

\* Emergency triage

\* Laboratory result interpretation

\* Risk prediction

\* Clinical documentation

Each recommendation should be explainable long after patient care has been completed.

\---

\# Execution Trust Chain

```text

Hospital Authority

&#x20;       │

Clinical Authorization

&#x20;       │

Medical Intent

&#x20;       │

Clinical Policy

&#x20;       │

BusinessTransaction

&#x20;       │

Clinical Signals

&#x20;       │

Policy Evaluation

&#x20;       │

Decision

&#x20;       │

Physician Review

&#x20;       │

Execution

&#x20;       │

Execution Evidence

&#x20;       │

Receipt

&#x20;       │

Execution Trust Record

```

Every stage contributes to the permanent governance record.

\---

\# Example Scenario

A physician requests an AI assessment for a patient with respiratory symptoms.

The AI system:

\* Reviews structured clinical data

\* Evaluates the approved clinical policy

\* Produces a recommendation

\* Waits for physician approval

\* Records the completed workflow

Parmana governs this execution from beginning to end.

\---

\# Authority

Authority identifies the healthcare organization responsible for the workflow.

Example:

```typescript

const authority = {

&#x20;   authorityId: "hospital-001",

&#x20;   authorityName: "City General Hospital"

};

```

Authority establishes organizational accountability.

\---

\# Authorization

Authorization identifies the AI system that is permitted to assist clinicians.

Example:

```typescript

permissions: \[

&#x20;   "CLINICAL\_DECISION\_SUPPORT"

]

```

Authorization answers:

> Which clinical operations may this AI perform?

\---

\# Medical Intent

Intent records the requested clinical operation.

Example:

```typescript
operation: "ASSESS\_PATIENT";

target: "patient-100234";
```

Intent represents the physician's request—not the AI's opinion.

\---

\# Clinical Policy

Every Business Transaction specifies an explicit policy.

Example:

```typescript

policyName:

&#x20;   "clinical-decision-policy"



policyVersion:

&#x20;   "1.0.0"

```

Policy selection is explicit.

The Runtime never searches for policies.

\---

\# Clinical Signals

Policy evaluation uses recorded clinical information.

Example:

```typescript

signals: {



&#x20;   patientAge: 64,



&#x20;   bloodPressure: "145/90",



&#x20;   heartRate: 96,



&#x20;   oxygenSaturation: 98,



&#x20;   allergyCheck: "CLEAR",



&#x20;   physicianAvailable: true



}

```

These signals represent the clinical context used during decision evaluation.

They become immutable replay evidence.

\---

\# Decision

The Runtime evaluates the clinical policy.

Example:

```text

Decision



APPROVED

```

The Decision records:

\* Outcome

\* Explanation

\* Runtime signals

\* Policy version

\* Evaluation timestamp

This creates a deterministic record of why the recommendation was produced.

\---

\# Physician Oversight

Clinical AI recommendations should typically remain subject to physician judgment.

Execution evidence may indicate:

```typescript

{



&#x20;   diagnosisSuggestion:

&#x20;       "Community Acquired Pneumonia",



&#x20;   confidence: 0.94,



&#x20;   physicianReviewRequired: true,



&#x20;   physicianApproved: true



}

```

Parmana records the physician's participation as part of the trust chain rather than replacing clinical responsibility.

\---

\# Execution

Execution records what actually occurred after policy approval.

Example:

```text

Status



COMPLETED

```

Execution answers:

> What happened?

Decision answers:

> What should happen?

\---

\# Execution Evidence

Execution Evidence records application-specific results.

Examples include:

\* Diagnostic recommendation

\* Confidence score

\* Physician approval

\* Generated report

\* Imaging reference

\* Treatment recommendation

Evidence remains intentionally application-defined.

\---

\# Receipt

Successful execution generates an immutable Receipt.

Example:

```text

Receipt ID



receipt-001



Algorithm



Ed25519

```

The receipt provides cryptographic evidence that the workflow completed successfully.

\---

\# Execution Trust Record

Every clinical artifact becomes part of the immutable Execution Trust Record.

```text

Business Transaction



Decision



Execution



Evidence



Receipt



Verification



Replay

```

This aggregate forms the authoritative history of the AI-assisted workflow.

\---

\# Replay

Replay reconstructs the original clinical execution.

Replay restores:

\* Recorded patient signals

\* Policy version

\* Decision context

\* Clinical recommendation

Replay never substitutes current patient information.

Historical replay always evaluates the original recorded evidence.

\---

\# Verification

Verification confirms:

\* Trust Record integrity

\* Clinical artifact consistency

\* Receipt validity

\* Trust hash correctness

Verification determines whether the historical record remains authentic.

\---

\# Auditing

Auditors can later determine:

\* Which hospital authorized the workflow

\* Which AI system participated

\* Which physician requested the assessment

\* Which policy version was evaluated

\* Which patient signals were considered

\* Which recommendation was produced

\* Whether physician review occurred

\* Which execution evidence was recorded

The complete clinical workflow becomes independently reviewable.

\---

\# Benefits

Execution authorization provides:

\* Clinical accountability

\* Regulatory compliance

\* Explainable AI

\* Physician oversight

\* Medical auditability

\* Incident investigation

\* Reproducible clinical decisions

Parmana governs execution without replacing medical expertise.

\---

\# Complete Workflow

```text

Physician Request

&#x20;       │

Business Transaction

&#x20;       │

Policy Evaluation

&#x20;       │

Clinical Decision

&#x20;       │

Physician Review

&#x20;       │

Execution

&#x20;       │

Evidence

&#x20;       │

Receipt

&#x20;       │

Verification

&#x20;       │

Replay

&#x20;       │

Audit

```

Every stage becomes a permanent trust artifact.

\---

\# Complete Example

See:

```text

examples/07\_medical\_ai.ts

```

for the full TypeScript implementation.

\---

\# Architectural Principles

Clinical AI governance follows the same Parmana architecture used across every domain:

\* Explicit Authority

\* Explicit Authorization

\* Explicit Intent

\* Explicit PolicyReference

\* Deterministic Policy Evaluation

\* Immutable Decision

\* Recorded Clinical Signals

\* Execution Evidence

\* Independent Verification

\* Deterministic Replay

The healthcare domain changes the business context—not the trust architecture.

\---

\# Relationship to Other Examples

The same governance model extends naturally to other regulated domains.

| Example | Domain |

| ------- | ----------------------- |

| 06 | Autonomous Vehicles |

| 08 | Financial Transactions |

| 09 | Multi-Agent AI |

| 10 | Custom Policy Selection |

Parmana applies the same execution trust principles regardless of industry.

\---

\# Summary

In this guide you learned how Parmana governs AI-assisted clinical workflows by recording:

\* Hospital Authority

\* Clinical Authorization

\* Medical Intent

\* Clinical Policy

\* Runtime Clinical Signals

\* Decision

\* Physician Oversight

\* Execution

\* Execution Evidence

\* Receipt

\* Execution Trust Record

This architecture enables hospitals to deploy AI-assisted systems while preserving transparency, accountability, replayability, and independent verification.

\---

\# Next

Continue with:

```text

docs/08\_financial\_transaction.md

```

to explore how Parmana governs AI-assisted financial transactions, where authorization, fraud controls, policy evaluation, execution evidence, and regulatory compliance form a deterministic Execution Trust Chain.
