\# Execution Request

\## Purpose

This document defines the \*\*Execution Request\*\*, the canonical input to the Parmana Runtime.

An Execution Request is the structured representation of a Business Transaction that is submitted to Parmana for authorization. It contains the information required for the runtime to evaluate whether the requested business operation may be executed according to organizational policy.

This document is normative.

\---

\# Definition

An \*\*Execution Request\*\* is a structured request that asks Parmana to authorize the execution of a single Business Transaction.

It is the canonical input to the authorization process.

An Execution Request expresses \*\*intent to execute\*\*. It does not imply that execution is permitted.

Authorization is determined only after Authority Verification has successfully completed.

\---

\# Purpose

The Execution Request provides a consistent interface between AI systems, enterprise applications, workflow engines, and the Parmana Runtime.

Regardless of where a request originates, Parmana evaluates all execution requests using the same authorization process.

This separation allows organizations to apply a single governance model across multiple AI systems and enterprise applications.

\---

\# Relationship to Business Transaction

Every Execution Request represents exactly one Business Transaction.

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Execution Request

```

The Business Transaction defines the organizational objective.

The Execution Request provides the structured information required to evaluate that objective.

\---

\# Responsibilities

An Execution Request is responsible for:

\* Identifying the Business Transaction.

\* Identifying the requesting principal.

\* Specifying the intended action.

\* Referencing the governing policy.

\* Providing execution context.

\* Supplying metadata required for authorization.

It is \*\*not\*\* responsible for determining whether execution is allowed.

\---

\# Required Characteristics

Every Execution Request MUST:

\* Represent a single Business Transaction.

\* Be immutable during authorization.

\* Reference an applicable organizational policy.

\* Contain sufficient information for Authority Verification.

\* Be uniquely identifiable.

\* Be suitable for deterministic evaluation.

\---

\# Logical Structure

Conceptually, an Execution Request contains the following information:

```text

Execution Request

├── Request Identifier

├── Business Transaction

├── Requested Action

├── Requesting Principal

├── Policy Reference

├── Execution Context

├── Request Metadata

└── Optional Supporting Information

```

The exact serialization format is implementation-specific and defined by the API specification.

\---

\# Request Identifier

Each Execution Request MUST include a unique identifier.

The identifier enables:

\* Traceability

\* Audit

\* Replay

\* Correlation

\* Verification

The identifier is stable for the lifetime of the request.

\---

\# Business Transaction

The request MUST reference the Business Transaction that the organization intends to execute.

This establishes the business objective being evaluated.

\---

\# Requested Action

The request MUST describe the action that the organization wishes to perform.

Examples include:

\* Approve payment

\* Grant access

\* Create purchase order

\* Update customer record

\* Execute deployment

The requested action is evaluated against organizational policy.

\---

\# Requesting Principal

The request MUST identify the principal responsible for initiating the request.

Examples include:

\* Human user

\* AI agent

\* Enterprise application

\* Workflow engine

\* Service account

The requesting principal is evaluated as part of Authority Verification.

\---

\# Policy Reference

Every Execution Request MUST explicitly reference the policy that governs authorization.

Policy selection is never implicit.

Explicit policy references ensure deterministic authorization and reproducible verification.

\---

\# Execution Context

Execution Context provides information describing the environment in which authorization occurs.

Examples include:

\* Organization

\* Environment

\* Timestamp

\* Tenant

\* Request origin

\* Session information

\* Correlation identifiers

Execution Context supports policy evaluation but does not independently authorize execution.

\---

\# Supporting Information

An Execution Request MAY include additional information relevant to authorization.

Examples include:

\* User-provided justification

\* Business metadata

\* External references

\* Workflow identifiers

Supporting information may contribute evidence but does not replace verified Enterprise Facts.

\---

\# Immutability

Once submitted for authorization, an Execution Request MUST be treated as immutable.

If any material aspect of the request changes, a new Execution Request MUST be created and evaluated independently.

This ensures that authorization decisions remain reproducible and traceable.

\---

\# Deterministic Evaluation

The Execution Request provides one of the inputs to deterministic authorization.

Given the same:

\* Execution Request

\* Policy Reference

\* Enterprise Facts

\* Human Approvals

\* AI-Derived Signals

Parmana should produce the same authorization decision.

\---

\# Relationship to Authority Verification

Authority Verification consumes the Execution Request.

```text

Execution Request

&#x20;       │

&#x20;       ▼

Authority Verification

```

Authority Verification evaluates:

\* Organizational policy

\* Enterprise Facts

\* Human Approvals

\* AI-Derived Signals

\* Execution Context

to determine whether execution is authorized.

\---

\# Relationship to Execution Trust Record

If authorization completes, the evaluated Execution Request becomes part of the Execution Trust Record.

```text

Execution Request

&#x20;       │

&#x20;       ▼

Execution Trust Record

```

The recorded request enables replay, verification, and audit.

\---

\# Relationship to Replay

Replay uses the recorded Execution Request together with the associated evidence to reproduce the authorization decision.

For replay to be reliable, the recorded request must accurately represent the original authorization input.

\---

\# Security Considerations

Execution Requests should be protected against:

\* Unauthorized modification

\* Forgery

\* Replay attacks

\* Identity spoofing

\* Missing policy references

\* Incomplete context

The Runtime validates the integrity and completeness of the request before beginning Authority Verification.

\---

\# What an Execution Request Is Not

An Execution Request is \*\*not\*\*:

\* an authorization decision,

\* evidence,

\* an execution receipt,

\* an audit record,

\* a workflow definition,

\* an AI prompt,

\* an implementation-specific API payload.

It is the standardized authorization request submitted to Parmana.

\---

\# Guarantees

Parmana provides the following guarantees for Execution Requests:

\* One Execution Request represents one Business Transaction.

\* Every Execution Request is evaluated independently.

\* Requests are immutable during authorization.

\* Authorization always evaluates an explicit Policy Reference.

\* Every evaluated request is traceable.

\* Every authorized request can be associated with an Execution Trust Record.

\---

\# Summary

The Execution Request is the canonical input to the Parmana Runtime.

It transforms a Business Transaction into a structured authorization request that can be evaluated consistently, deterministically, and independently of the requesting system.

By standardizing the information required for authorization, the Execution Request enables Parmana to apply organizational governance uniformly across AI systems, enterprise applications, and automated workflows.
