\# Signal Model

\## Purpose

This document defines the \*\*Signal Model\*\*, the evidence model used by Parmana during Authority Verification.

The Signal Model specifies how information is represented, classified, and evaluated when determining whether an Execution Request is authorized.

It establishes a common evidence model that is independent of AI models, enterprise applications, programming languages, and deployment environments.

This document is normative.

\---

\# Definition

A \*\*Signal\*\* is a structured piece of information evaluated during Authority Verification.

Signals provide evidence about an Execution Request.

Signals do \*\*not\*\* authorize execution independently.

Authorization is produced only after evaluating the complete set of signals according to the governing organizational policy.

\---

\# Why Signals Exist

Enterprise authorization requires evidence from multiple sources.

For example, approving a supplier payment may require:

\* Budget availability

\* Employee authority

\* Purchase order status

\* Invoice validation

\* Fraud risk assessment

\* Manager approval

Each of these represents a signal.

The Signal Model provides a consistent way to represent this evidence.

\---

\# Core Principle

Individual signals are \*\*evidence\*\*.

Evidence becomes \*\*authorization\*\* only after policy evaluation.

No single signal should independently authorize execution unless explicitly permitted by organizational policy.

\---

\# Signal Categories

Parmana recognizes three canonical categories of signals.

\## Enterprise Facts

Enterprise Facts are deterministic facts obtained from authoritative systems of record.

Examples include:

\* Employee role

\* Budget availability

\* Purchase order status

\* Customer account status

\* Identity attributes

\* Department membership

\* Approval limits

\* Contract status

Characteristics:

\* Deterministic

\* Verifiable

\* Authoritative

\* Independently reproducible

Enterprise Facts are considered the highest-trust source of evidence.

\---

\## AI-Derived Signals

AI-Derived Signals are produced by AI systems.

Examples include:

\* Intent classification

\* Risk score

\* Fraud prediction

\* Document extraction

\* Recommendation

\* Sentiment analysis

\* Confidence estimate

\* Classification result

Characteristics:

\* Probabilistic

\* Explainable where possible

\* Supporting evidence

\* Never authoritative by themselves

AI-Derived Signals assist authorization but do not replace organizational governance.

\---

\## Human Authority Signals

Human Authority Signals represent explicit human decisions required by policy.

Examples include:

\* Manager approval

\* Compliance approval

\* Finance approval

\* Executive approval

\* Manual override

\* Emergency authorization

Characteristics:

\* Explicit

\* Traceable

\* Identity-bound

\* Policy governed

Human Authority Signals represent organizational authority rather than AI reasoning.

\---

\# Signal Lifecycle

Signals progress through the following lifecycle:

```text

Signal Source

&#x20;     │

&#x20;     ▼

Signal Collection

&#x20;     │

&#x20;     ▼

Signal Validation

&#x20;     │

&#x20;     ▼

Signal Evaluation

&#x20;     │

&#x20;     ▼

Authority Verification

```

Each stage ensures that only valid and trustworthy evidence contributes to authorization.

\---

\# Signal Sources

Signals may originate from:

\* Enterprise systems

\* Identity providers

\* ERP platforms

\* Financial systems

\* HR systems

\* CRM platforms

\* AI agents

\* Workflow engines

\* Human approval systems

Regardless of origin, all signals are evaluated using the same verification process.

\---

\# Signal Validation

Before evaluation, signals are validated to ensure they are suitable for authorization.

Validation may include:

\* Source verification

\* Schema validation

\* Integrity checks

\* Timestamp validation

\* Identity validation

\* Completeness checks

Invalid signals are rejected before policy evaluation begins.

\---

\# Signal Evaluation

Authority Verification evaluates signals according to the referenced organizational policy.

Evaluation determines:

\* Which signals are required.

\* Which signals are optional.

\* Whether required evidence is present.

\* Whether signals satisfy policy conditions.

\* Whether execution may proceed.

Signal evaluation is deterministic.

\---

\# Signal Independence

Signals remain independent from one another.

For example:

\* An AI risk score does not modify an Enterprise Fact.

\* A Human Approval does not replace identity verification.

\* Budget availability does not imply regulatory compliance.

Each signal contributes its own evidence.

The policy determines how those signals are combined.

\---

\# Signal Composition

Authorization decisions typically depend on multiple signals.

Example:

```text

Enterprise Facts

&#x20;      │

&#x20;      ├── Employee Role

&#x20;      ├── Budget Available

&#x20;      └── Purchase Order Exists

&#x20;               │

AI Signals      │

&#x20;      ├── Fraud Risk

&#x20;      └── Invoice Classification

&#x20;               │

Human Authority

&#x20;      └── Finance Approval

&#x20;               │

&#x20;               ▼

Authority Verification

```

No individual signal determines the authorization outcome.

\---

\# Trust Hierarchy

Signals are not equal in authority.

Conceptually:

```text

Highest Authority

│

├── Human Authority Signals

├── Enterprise Facts

├── AI-Derived Signals

│

Lowest Authority

```

This hierarchy reflects organizational governance.

AI-generated information informs decisions but does not replace authoritative organizational evidence.

\---

\# Immutability

Signals recorded during Authority Verification become part of the authorization evidence.

Recorded signals MUST NOT be modified after authorization.

If new evidence becomes available, a new authorization process should be initiated.

\---

\# Relationship to Authority Verification

Authority Verification consumes validated signals.

```text

Execution Request

&#x20;       │

&#x20;       ▼

Signal Collection

&#x20;       │

&#x20;       ▼

Signal Validation

&#x20;       │

&#x20;       ▼

Authority Verification

```

Signals are inputs.

Authorization is the output.

\---

\# Relationship to Execution Trust Record

The evaluated signals become part of the Execution Trust Record.

This enables:

\* Replay

\* Independent verification

\* Audit

\* Compliance review

The Execution Trust Record preserves the evidence evaluated during authorization.

\---

\# Security Considerations

Signals should be protected against:

\* Forgery

\* Tampering

\* Replay attacks

\* Source impersonation

\* Unauthorized modification

\* Missing required evidence

The Runtime validates signal integrity before evaluation.

\---

\# Design Principles

The Signal Model follows these principles:

\* Signals are evidence.

\* Signals are independently verifiable.

\* Signals are immutable after authorization.

\* Enterprise Facts remain authoritative.

\* AI-Derived Signals support but do not authorize.

\* Human Authority remains the source of execution authority.

\* Policy determines how signals are evaluated.

\* Authorization is deterministic.

\---

\# What a Signal Is Not

A Signal is \*\*not\*\*:

\* an authorization decision,

\* a policy,

\* a Business Transaction,

\* an Execution Request,

\* an Execution Trust Record,

\* an Execution Receipt.

A Signal is an individual piece of evidence used during Authority Verification.

\---

\# Guarantees

Parmana provides the following guarantees:

\* Every authorization decision is supported by evaluated signals.

\* Signal validation occurs before policy evaluation.

\* Recorded signals remain immutable.

\* Enterprise Facts originate from authoritative systems.

\* AI-Derived Signals never independently authorize execution.

\* Human Authority Signals remain subject to organizational policy.

\* Signal evaluation is deterministic and reproducible.

\---

\# Summary

The Signal Model provides the evidence foundation for Parmana.

By representing Enterprise Facts, AI-Derived Signals, and Human Authority Signals within a single, consistent model, Parmana enables organizations to evaluate execution requests using verified evidence rather than assumptions.

The Signal Model ensures that authorization decisions remain explainable, reproducible, independently verifiable, and aligned with organizational governance.
