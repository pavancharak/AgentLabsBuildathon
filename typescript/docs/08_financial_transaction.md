\# Example 08 — Financial Transaction Governance

\## Overview

Modern financial institutions increasingly rely on Artificial Intelligence to assist with payment processing, fraud detection, sanctions screening, anti-money laundering (AML), credit decisions, and transaction monitoring.

While AI can improve efficiency and accuracy, financial organizations must also ensure that every AI-assisted transaction is:

\* Authorized

\* Governed by approved policies

\* Explainable

\* Replayable

\* Independently verifiable

\* Auditable

Parmana provides this capability through its \*\*Execution Trust Infrastructure\*\*, creating an immutable execution history for every governed financial transaction.

This guide demonstrates how financial workflows are modeled using the TypeScript SDK.

\---

\# Learning Objectives

After completing this guide you will understand:

\* Why financial AI requires execution authorization

\* How payment approvals become Business Transactions

\* How risk signals influence policy evaluation

\* How execution evidence supports compliance

\* How financial workflows become replayable and auditable

\---

\# Why Financial AI Needs Governance

Financial systems routinely make high-impact decisions.

Examples include:

\* Payment approvals

\* Wire transfers

\* Fraud detection

\* AML screening

\* Sanctions compliance

\* Credit approvals

\* Loan underwriting

\* Insurance claims

Organizations must be able to explain every decision long after the transaction has completed.

\---

\# Execution Trust Chain

```text id="d0r2nh"

Bank Authority

&#x20;       │

Financial Authorization

&#x20;       │

Payment Intent

&#x20;       │

PolicyReference

&#x20;       │

BusinessTransaction

&#x20;       │

Risk Signals

&#x20;       │

Policy Evaluation

&#x20;       │

Decision

&#x20;       │

Execution

&#x20;       │

Execution Evidence

&#x20;       │

Receipt

&#x20;       │

Execution Trust Record

```

Every stage contributes to an immutable governance record.

\---

\# Example Scenario

A payment engine receives a request to transfer funds to a supplier.

Before approving the transaction, Parmana evaluates the organization's financial policies using recorded risk signals.

The Runtime verifies:

\* Authorization

\* Payment amount

\* KYC status

\* AML results

\* Sanctions screening

\* Fraud score

Only after successful policy evaluation is the payment approved.

\---

\# Authority

Authority identifies the financial institution responsible for the transaction.

Example:

```typescript id="0dyq9i"

const authority = {

&#x20;   authorityId: "bank-001",

&#x20;   authorityName: "Acme National Bank"

};

```

Authority establishes organizational accountability.

\---

\# Authorization

Authorization grants permission to perform financial operations.

Example:

```typescript id="77m3zd"

permissions: \[

&#x20;   "APPROVE\_PAYMENT"

]

```

Authorization answers:

> Which financial operations may this system perform?

\---

\# Payment Intent

Intent defines the requested financial action.

Example:

```typescript id="quc62m"
operation: "APPROVE\_PAYMENT";

target: "SUPPLIER-ACME";
```

Intent records the requested business action.

\---

\# Policy Reference

Every Business Transaction specifies the exact financial policy to evaluate.

Example:

```typescript id="aqjlwm"

policyName:

&#x20;   "aml-fraud-policy"



policyVersion:

&#x20;   "1.0.0"

```

Policy selection is deterministic.

The Runtime never searches for or automatically selects policies.

\---

\# Risk Signals

Financial policy evaluation uses recorded runtime signals.

Example:

```typescript id="8bjlwm"

signals: {



&#x20;   amount: 25000,



&#x20;   currency: "USD",



&#x20;   kycVerified: true,



&#x20;   amlPassed: true,



&#x20;   sanctionsMatch: false,



&#x20;   fraudScore: 0.08



}

```

These signals represent the execution context used by the policy engine.

They become immutable evidence for replay and audit.

\---

\# Decision

The Runtime evaluates the financial policy.

Example:

```text id="2f7zcf"

Decision



APPROVED

```

The Decision records:

\* Outcome

\* Reason

\* Policy version

\* Runtime signals

\* Evaluation timestamp

This creates a transparent explanation for the approval.

\---

\# Execution

Execution records the actual financial operation.

Example:

```text id="b7m6to"

Status



COMPLETED

```

Execution documents what occurred after policy approval.

\---

\# Execution Evidence

Execution Evidence records application-specific financial results.

Example:

```typescript id="44v4mn"

{



&#x20;   paymentReference:

&#x20;       "PAY-2026-0001",



&#x20;   settlementStatus:

&#x20;       "SETTLED",



&#x20;   paymentNetwork:

&#x20;       "SWIFT",



&#x20;   settlementTime:

&#x20;       "2026-06-29T13:45:12Z"



}

```

Evidence may also include:

\* Transaction identifiers

\* Ledger references

\* Settlement confirmations

\* Clearing network information

\* Audit references

Parmana intentionally allows financial systems to define their own evidence structure.

\---

\# Receipt

Successful execution produces a cryptographic Receipt.

Example:

```text id="s8h67q"

Receipt ID



receipt-001



Algorithm



Ed25519

```

The Receipt provides independently verifiable proof of execution.

\---

\# Execution Trust Record

Every financial artifact becomes part of the immutable Execution Trust Record.

```text id="8nvf9m"

Business Transaction



Decision



Execution



Evidence



Receipt



Verification



Replay

```

The trust record becomes the canonical history of the transaction.

\---

\# Replay

Replay reconstructs the original payment approval.

Replay restores:

\* Original payment request

\* Original policy version

\* Original risk signals

\* Original decision

Replay never evaluates current fraud scores or current sanctions lists.

Historical replay always uses recorded execution evidence.

\---

\# Verification

Verification confirms:

\* Trust Record integrity

\* Receipt integrity

\* Hash consistency

\* Artifact consistency

Verification ensures that the financial record has not been altered.

\---

\# Auditing

Auditors can later determine:

\* Which institution authorized the payment

\* Which system executed it

\* Which policy version was evaluated

\* Which risk signals were considered

\* Which fraud score was recorded

\* Which execution evidence was generated

\* Whether the payment settled successfully

No external logs are required to reconstruct the execution.

\---

\# Compliance Benefits

Execution authorization supports:

\* Anti-Money Laundering (AML)

\* Fraud investigation

\* Regulatory reporting

\* Payment audits

\* Financial controls

\* Internal governance

\* Independent assurance

Parmana governs execution without replacing existing banking systems.

\---

\# Complete Workflow

```text id="y7gwgs"

Payment Request

&#x20;       │

Business Transaction

&#x20;       │

Policy Evaluation

&#x20;       │

Decision

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

Every stage contributes to the immutable Execution Trust Record.

\---

\# Complete Example

See:

```text id="br8v6i"

examples/08\_financial\_transaction.ts

```

for the complete TypeScript implementation.

\---

\# Architectural Principles

Financial execution authorization follows the same Parmana architecture used across all domains:

\* Explicit Authority

\* Explicit Authorization

\* Explicit Intent

\* Explicit PolicyReference

\* Deterministic Policy Evaluation

\* Immutable Decision

\* Recorded Runtime Signals

\* Execution Evidence

\* Independent Verification

\* Deterministic Replay

The financial domain changes the business context—not the trust architecture.

\---

\# Relationship to Other Examples

The same execution trust model applies across regulated industries.

| Example | Domain |

| ------- | ----------------------- |

| 06 | Autonomous Vehicles |

| 07 | Medical AI |

| 09 | Multi-Agent AI |

| 10 | Custom Policy Selection |

Each domain records different business data while preserving the same deterministic governance model.

\---

\# Summary

In this guide you learned how Parmana governs financial transactions by recording:

\* Bank Authority

\* Financial Authorization

\* Payment Intent

\* PolicyReference

\* Financial Risk Signals

\* Decision

\* Execution

\* Execution Evidence

\* Receipt

\* Execution Trust Record

This architecture enables financial institutions to deploy AI-assisted systems while preserving transparency, accountability, regulatory compliance, replayability, and independent verification.

\---

\# Next

Continue with:

```text id="5q5d4w"

docs/09\_multi\_agent.md

```

to learn how Parmana governs coordinated AI agent workflows, where multiple autonomous agents operate under a single Business Transaction and Execution Trust Record while preserving deterministic execution and auditability.
