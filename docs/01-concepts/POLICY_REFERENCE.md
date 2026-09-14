\# Policy Reference

\## Purpose

This document defines the \*\*Policy Reference\*\*, the mechanism by which an Execution Request identifies the organizational policy that governs its authorization.

A Policy Reference does not contain policy logic. Instead, it provides a stable and explicit reference to the policy that must be evaluated during Authority Verification.

This document is normative.

\---

\# Definition

A \*\*Policy Reference\*\* is a unique identifier that specifies the organizational policy applicable to an Execution Request.

It establishes \*\*which policy\*\* the Parmana Runtime must evaluate before authorizing execution.

Policy References make policy selection explicit, deterministic, and auditable.

\---

\# Why Policy References Exist

Organizations often maintain hundreds or thousands of policies covering different business domains.

Examples include:

\* Financial approval policies

\* Procurement policies

\* Identity and access policies

\* Data protection policies

\* Regulatory compliance policies

\* Security policies

\* Human resources policies

Parmana does not determine which policy should apply.

Instead, the applicable policy is explicitly identified through the Policy Reference.

This design ensures that authorization is predictable and transparent.

\---

\# Core Principle

A Policy Reference identifies \*\*the governing policy\*\*, not the authorization result.

The Policy Reference answers:

> \*\*"Which organizational policy governs this execution request?"\*\*

Authority Verification answers:

> \*\*"Does this request satisfy that policy?"\*\*

These responsibilities remain separate.

\---

\# Relationship to Human Authority

Human Authority defines \*\*who\*\* possesses execution authority.

A Policy Reference identifies \*\*which organizational rules express that authority\*\* for a specific Business Transaction.

Together they determine whether execution is permitted.

\---

\# Relationship to Business Transaction

Every Business Transaction is governed by one or more organizational policies.

When a Business Transaction is transformed into an Execution Request, the applicable policy is identified through a Policy Reference.

```text id="9ixt3n"

Business Transaction

&#x20;       │

&#x20;       ▼

Execution Request

&#x20;       │

&#x20;       ▼

Policy Reference

```

\---

\# Relationship to Execution Request

Every Execution Request MUST include exactly one Policy Reference.

The Runtime evaluates the referenced policy during Authority Verification.

Execution Requests without a valid Policy Reference cannot be authorized.

\---

\# Relationship to Authority Verification

Authority Verification retrieves the referenced policy and evaluates the Execution Request against its requirements.

Typical policy requirements include:

\* Required approvals

\* Delegated authority

\* Risk limits

\* Compliance obligations

\* Operational constraints

\* Required Enterprise Facts

\* Required AI-Derived Signals

The Policy Reference determines \*\*which rules are evaluated\*\*, not whether those rules are satisfied.

\---

\# Explicit Policy Selection

Policy selection is always explicit.

The Runtime MUST NOT:

\* infer policies,

\* guess applicable policies,

\* automatically search for policies,

\* evaluate multiple unrelated policies,

\* substitute alternative policies.

Every authorization decision is evaluated against the Policy Reference supplied by the request.

This guarantees deterministic behavior.

\---

\# Policy Versioning

Policies evolve over time.

A Policy Reference should identify a specific policy version so that historical authorization decisions remain reproducible.

Examples:

```text id="jlwmn9"

finance/payment-approval/v1



procurement/purchase-order/v3



iam/privileged-access/v2

```

Versioning enables replay and audit using the policy that was in effect when the authorization decision was made.

\---

\# Logical Model

Conceptually, a Policy Reference identifies:

```text id="ijutsk"

Policy Reference

├── Policy Identifier

├── Policy Version

├── Policy Domain

└── Optional Metadata

```

The internal representation is implementation-specific.

\---

\# Policy Resolution

During Runtime execution, the Policy Reference is resolved to an organizational policy.

```text id="k1m74q"

Execution Request

&#x20;       │

&#x20;       ▼

Policy Reference

&#x20;       │

&#x20;       ▼

Policy Repository

&#x20;       │

&#x20;       ▼

Authority Verification

```

Resolution occurs before policy evaluation begins.

\---

\# Immutability

Once an Execution Request enters Authority Verification, its Policy Reference MUST NOT change.

If a different policy is required, a new Execution Request MUST be created.

Immutability ensures that authorization decisions remain reproducible and independently verifiable.

\---

\# Security Considerations

Policy References should be protected against:

\* Unauthorized modification

\* Policy substitution

\* Version ambiguity

\* Invalid references

\* Missing references

The Runtime validates that the referenced policy exists and is suitable for evaluation.

\---

\# Design Principles

Policy References follow these principles:

\* Explicit rather than implicit.

\* Stable over time.

\* Versioned.

\* Deterministic.

\* Independently auditable.

\* Independent of storage implementation.

\* Independent of policy language.

\---

\# What a Policy Reference Is Not

A Policy Reference is \*\*not\*\*:

\* the policy itself,

\* an approval,

\* an authorization decision,

\* business logic,

\* policy evaluation results,

\* an access token,

\* an identity claim.

It is a stable reference to the governing organizational policy.

\---

\# Guarantees

Parmana provides the following guarantees:

\* Every Execution Request references exactly one governing policy.

\* Policy selection is explicit.

\* Policy References remain immutable during authorization.

\* Policy versions support replay and audit.

\* Authorization decisions can always identify the policy against which they were evaluated.

\---

\# Example Authorization Flow

```text id="o7a9lg"

Business Transaction

&#x20;       │

&#x20;       ▼

Execution Request

&#x20;       │

&#x20;       ▼

Policy Reference

&#x20;       │

&#x20;       ▼

Retrieve Policy

&#x20;       │

&#x20;       ▼

Authority Verification

&#x20;       │

&#x20;       ▼

Authorization Decision

```

The Policy Reference determines the policy evaluated during Authority Verification.

\---

\# Summary

The Policy Reference is the link between organizational governance and runtime authorization.

It identifies the exact organizational policy that governs an Execution Request, ensuring that authorization is explicit, deterministic, reproducible, and auditable.

By separating policy identification from policy evaluation, Parmana enables organizations to evolve their governance while preserving the integrity and traceability of every authorization decision.
