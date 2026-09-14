\# Glossary

\## Purpose

This glossary provides a quick-reference alphabetical index of the terminology used throughout the Parmana documentation.

Unlike \*\*TERMINOLOGY.md\*\*, which defines the canonical meaning of each concept, this glossary is intended as a convenient reference for readers.

The definitions in this document are summaries. Where additional detail is required, readers should refer to the corresponding specification document.

\---

\# A

\## AI-Derived Signal

Information produced by an AI system that contributes evidence to an authorization decision but does not independently authorize execution.

See: `01-concepts/SIGNAL\_MODEL.md`

\---

\## Authorization

The determination of whether an Execution Request is permitted to execute according to organizational policy and verified evidence.

See: `01-concepts/AUTHORITY\_VERIFICATION.md`

\---

\## Authorization Decision

The outcome of Authority Verification.

Possible outcomes include:

\* Approved

\* Rejected

\* Escalated

\* Awaiting Approval

See: `01-concepts/AUTHORITY\_VERIFICATION.md`

\---

\# B

\## Business Transaction

A unit of business work initiated by a user, system, or AI that requires organizational authorization before execution.

See: `01-concepts/BUSINESS\_TRANSACTION.md`

\---

\# C

\## Cryptographic Integrity

The property that authorization evidence cannot be modified without detection.

Parmana protects execution records using cryptographic hashing and digital signatures.

See: `02-architecture/CRYPTOGRAPHY.md`

\---

\# E

\## Enterprise Fact

Verified information obtained from an authoritative enterprise system of record.

Examples include:

\* Employee role

\* Budget availability

\* Customer status

\* Purchase order information

See: `01-concepts/SIGNAL\_MODEL.md`

\---

\## Evidence

The collection of verified information evaluated during Authority Verification.

Evidence may include Enterprise Facts, Human Approvals, AI-Derived Signals, Organizational Policies, and Execution Context.

See: `01-concepts/AUTHORITY\_VERIFICATION.md`

\---

\## Execution

The performance of an approved Business Transaction after successful authorization.

Execution occurs only after Authority Verification completes successfully.

\---

\## Execution Context

Information describing the environment in which an Execution Request is evaluated.

Examples include identity, request metadata, timestamps, and policy references.

See: `02-architecture/RUNTIME.md`

\---

\## Execution Receipt

A verifiable summary generated after an authorization decision.

Execution Receipts provide operational evidence that an authorization decision occurred.

See: `01-concepts/EXECUTION\_RECEIPT.md`

\---

\## Execution Request

A structured request submitted to Parmana requesting authorization for a Business Transaction.

An Execution Request does not imply approval.

See: `01-concepts/EXECUTION\_REQUEST.md`

\---

\## Execution Trust Record (ETR)

The canonical record of an authorization decision.

It captures the evidence, policy, verification results, authorization outcome, and integrity information necessary for replay, verification, and audit.

See: `01-concepts/EXECUTION\_TRUST\_RECORD.md`

\---

\# H

\## Human Approval

Explicit authorization provided by an authorized individual as required by organizational policy.

Human Approval cannot be inferred.

See: `05-governance/HUMAN\_APPROVAL.md`

\---

\## Human Authority

The organizational authority delegated to people through governance, policy, and business responsibility.

Human Authority remains the ultimate source of execution authority.

See: `01-concepts/HUMAN\_AUTHORITY.md`

\---

\# O

\## Organizational Policy

A formally defined set of organizational rules governing execution authorization.

Policies define:

\* Required approvals

\* Constraints

\* Compliance obligations

\* Risk controls

\* Authorization conditions

See: `05-governance/POLICY\_MODEL.md`

\---

\# P

\## Parmana

An Execution Authorization and Verification Infrastructure for Enterprise AI.

Parmana enables organizations to deploy autonomous AI while ensuring that every high-impact action is authorized, policy-compliant, verifiable, and independently auditable.

\---

\## Policy Reference

A unique identifier that specifies which organizational policy governs an Execution Request.

Policy selection is explicit and deterministic.

See: `05-governance/POLICY\_REFERENCE.md`

\---

\# R

\## Replay

The process of re-evaluating a previously authorized Execution Request using its recorded evidence to verify that the authorization decision is reproducible.

See: `02-architecture/REPLAY.md`

\---

\## Repository

The abstraction responsible for storing and retrieving Parmana records independently of the underlying storage technology.

See: `02-architecture/REPOSITORY.md`

\---

\## Runtime

The execution environment that coordinates request processing, evidence collection, policy evaluation, authorization, receipt generation, and persistence.

See: `02-architecture/RUNTIME.md`

\---

\# S

\## Signal

A piece of information evaluated during Authority Verification.

Signals may originate from enterprise systems, AI systems, or human approvals.

See: `01-concepts/SIGNAL\_MODEL.md`

\---

\## System of Record

An enterprise system that serves as the authoritative source for a category of business information.

Examples include ERP, HR, IAM, Finance, and CRM systems.

See: `01-concepts/SIGNAL\_MODEL.md`

\---

\# T

\## Trust

Confidence established through verified evidence rather than assumption.

Within Parmana, trust is created by policy evaluation, evidence verification, and organizational authority.

\---

\# V

\## Verification

The process of confirming that an authorization decision is supported by complete, valid, and verifiable evidence.

Verification enables replay, audit, and independent validation.

See: `02-architecture/VERIFICATION.md`

\---

\# Related Documents

Readers seeking detailed specifications should refer to:

\* `TERMINOLOGY.md` — Canonical definitions of Parmana concepts.

\* `01-concepts/` — Detailed conceptual specifications.

\* `02-architecture/` — Runtime and architectural design.

\* `05-governance/` — Policy, approvals, and governance model.

\* `06-audit/` — Audit, verification, proofs, and guarantees.

\---

\# Summary

This glossary provides a concise reference to the core concepts used throughout the Parmana documentation.

For authoritative definitions, implementation details, and normative behavior, refer to the corresponding specification documents referenced throughout this glossary.
