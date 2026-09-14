\# Verification Engine

\*\*Document:\*\* `docs/02-architecture/VERIFICATION\_ENGINE.md`

\## Purpose

This document defines the \*\*Verification Engine\*\*, the Parmana Runtime component responsible for implementing \*\*Authority Verification\*\* and producing the \*\*Authorization Decision\*\*.

The Verification Engine combines the Policy Evaluation Result with verified evidence to determine whether an Execution Request is authorized.

It is the architectural implementation of the \*\*Authority Verification\*\* concept defined in `01-concepts/AUTHORITY\_VERIFICATION.md`.

This document is normative.

\---

\# Overview

The Verification Engine is the authorization core of the Parmana Runtime.

Its responsibility is to determine whether execution is permitted by evaluating:

\* The Execution Request

\* The Policy Evaluation Result

\* Verified Enterprise Facts

\* Human Authority Signals

\* AI-Derived Signals

\* Execution Context

The output of the Verification Engine is a single \*\*Authorization Decision\*\*.

The Verification Engine never executes business operations.

\---

\# Responsibilities

The Verification Engine is responsible for:

\* Implementing Authority Verification.

\* Validating authorization evidence.

\* Confirming Human Authority.

\* Evaluating the Policy Evaluation Result.

\* Producing the Authorization Decision.

\* Recording verification metadata.

\* Returning deterministic verification results.

The Verification Engine does \*\*not\*\*:

\* Resolve policies.

\* Persist records.

\* Generate receipts.

\* Execute workflows.

\* Perform business operations.

\---

\# Architectural Position

```text id="n8tmfr"

Execution Engine

&#x20;       │

&#x20;       ▼

Verification Engine

&#x20;       │

&#x20;┌──────┼──────────────┐

&#x20;│      │              │

&#x20;▼      ▼              ▼

Policy  Signals   Execution Context

Result

&#x20;       │

&#x20;       ▼

Authority Verification

&#x20;       │

&#x20;       ▼

Authorization Decision

&#x20;       │

&#x20;       ▼

Execution Trust Record

```

The Verification Engine is the final decision-making component within the authorization pipeline.

\---

\# Core Principle

The Verification Engine answers one question:

> \*\*"Is this Execution Request authorized to execute?"\*\*

The answer is based entirely on:

\* Organizational Policy

\* Verified Evidence

\* Human Authority

The answer is never based solely on AI reasoning.

\---

\# Inputs

The Verification Engine evaluates the following inputs.

\## Execution Request

Provides:

\* Business Transaction

\* Requested Action

\* Requesting Principal

\* Policy Reference

\* Execution Context

\---

\## Policy Evaluation Result

Produced by the Policy Engine.

Contains:

\* Policy evaluation outcome

\* Satisfied requirements

\* Unsatisfied requirements

\* Evaluation metadata

The Verification Engine does not re-evaluate policy.

\---

\## Enterprise Facts

Verified organizational information.

Examples include:

\* Identity

\* Budget

\* Role

\* Department

\* Purchase order

\* Customer status

Enterprise Facts remain authoritative.

\---

\## Human Authority Signals

Examples include:

\* Manager approval

\* Executive approval

\* Compliance approval

\* Manual override

Human Authority remains the ultimate source of execution authority.

\---

\## AI-Derived Signals

Examples include:

\* Risk score

\* Fraud analysis

\* Classification

\* Recommendation

\* Confidence

AI-Derived Signals support verification.

They never independently authorize execution.

\---

\## Execution Context

Execution Context includes:

\* Organization

\* Environment

\* Timestamp

\* Tenant

\* Request metadata

Context provides additional information used during verification.

\---

\# Verification Process

The Verification Engine performs the following logical stages.

```text id="6b7l3g"

Receive Inputs

&#x20;       │

&#x20;       ▼

Validate Evidence

&#x20;       │

&#x20;       ▼

Verify Human Authority

&#x20;       │

&#x20;       ▼

Evaluate Policy Result

&#x20;       │

&#x20;       ▼

Evaluate Constraints

&#x20;       │

&#x20;       ▼

Produce Authorization Decision

```

Each stage executes deterministically.

\---

\# Evidence Validation

Before authorization begins, the Verification Engine validates that:

\* required evidence exists,

\* evidence integrity is intact,

\* evidence is complete,

\* evidence satisfies policy requirements.

Incomplete evidence prevents authorization.

\---

\# Human Authority Verification

Where organizational policy requires approval, the Verification Engine confirms that:

\* required approvals exist,

\* delegated authority is valid,

\* approval requirements are satisfied.

Missing required authority prevents authorization.

\---

\# Constraint Verification

The Verification Engine evaluates operational constraints.

Examples include:

\* Financial limits

\* Regulatory restrictions

\* Organizational boundaries

\* Separation of duties

\* Risk thresholds

Constraints originate from policy.

\---

\# Authorization Decision

After verification completes, the Verification Engine produces one Authorization Decision.

Canonical outcomes include:

\* Approved

\* Rejected

\* Awaiting Approval

\* Escalated

Only one outcome is produced for each Execution Request.

\---

\# Verification Metadata

The Verification Engine records metadata describing the verification process.

Examples include:

\* Verification timestamp

\* Runtime version

\* Verification duration

\* Decision identifier

\* Processing metadata

Metadata supports replay and operational analysis.

\---

\# Determinism

The Verification Engine is deterministic.

Given identical:

\* Execution Request

\* Policy Evaluation Result

\* Enterprise Facts

\* Human Authority Signals

\* AI-Derived Signals

\* Execution Context

the Authorization Decision must be identical.

Implementation details must not affect observable behavior.

\---

\# Failure Conditions

Verification fails when:

\* required evidence is missing,

\* evidence integrity fails,

\* Human Authority requirements are not satisfied,

\* policy evaluation cannot be completed,

\* constraints are violated,

\* authorization conditions remain unsatisfied.

Verification failure is an authorization outcome, not necessarily a system failure.

\---

\# Relationship to Policy Engine

The Verification Engine consumes the Policy Evaluation Result.

```text id="08xjlwm"

Policy Engine

&#x20;     │

&#x20;     ▼

Policy Evaluation Result

&#x20;     │

&#x20;     ▼

Verification Engine

&#x20;     │

&#x20;     ▼

Authorization Decision

```

The Policy Engine evaluates policy.

The Verification Engine determines authorization.

\---

\# Relationship to Execution Trust Record

Every completed Authorization Decision becomes part of an Execution Trust Record.

The Verification Engine provides:

\* Authorization Decision

\* Verification metadata

\* Evaluated evidence references

The Repository persists the resulting record.

\---

\# Security Considerations

The Verification Engine protects against:

\* unauthorized execution,

\* missing approvals,

\* forged evidence,

\* invalid policy results,

\* evidence tampering,

\* incomplete verification.

Authorization occurs only after successful verification.

\---

\# Design Principles

The Verification Engine follows these principles:

\* Evidence-driven verification.

\* Deterministic authorization.

\* Human Authority preservation.

\* Policy-governed decisions.

\* Immutable authorization outcomes.

\* Technology independence.

\* Independent verifiability.

\---

\# What the Verification Engine Is Not

The Verification Engine is \*\*not\*\*:

\* a Policy Engine,

\* an Execution Engine,

\* a Repository,

\* an AI reasoning engine,

\* a workflow engine,

\* an execution platform.

Its sole responsibility is Authority Verification.

\---

\# Guarantees

The Verification Engine guarantees:

\* Every Authorization Decision is based on verified evidence.

\* Organizational Policy governs every authorization.

\* Human Authority requirements are enforced.

\* Enterprise Facts remain authoritative.

\* AI-Derived Signals never independently authorize execution.

\* Equivalent inputs produce equivalent Authorization Decisions.

\* Every completed verification produces one Authorization Decision.

\* Every Authorization Decision is suitable for replay and independent verification.

\---

\# Relationship to Other Documents

This document specifies the implementation of Authority Verification.

Related specifications include:

\* `01-concepts/AUTHORITY\_VERIFICATION.md`

\* `01-concepts/AUTHORIZATION\_DECISION.md`

\* `01-concepts/SIGNAL\_MODEL.md`

\* `POLICY\_ENGINE.md`

\* `REPOSITORY.md`

\---

\# Summary

The Verification Engine is the authorization component of the Parmana Runtime.

It implements Authority Verification by combining the Policy Evaluation Result with verified Enterprise Facts, Human Authority Signals, AI-Derived Signals, and Execution Context to produce a deterministic Authorization Decision.

By separating policy evaluation from authorization and execution orchestration, the Verification Engine provides a clear, auditable, and technology-independent implementation of execution authorization while preserving the core principle of Parmana:

\*\*Organizations authorize execution. AI systems do not.\*\*
