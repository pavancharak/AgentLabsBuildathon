\# Business Transaction

\## Purpose

This document defines the concept of a \*\*Business Transaction\*\* within Parmana.

A Business Transaction represents the organizational objective that requires authorization before execution. It is the highest-level business concept in the Parmana domain model and serves as the foundation for all execution authorization.

This document is normative.

\---

\# Definition

A \*\*Business Transaction\*\* is a unit of business work that an organization intends to perform.

A Business Transaction represents \*\*what\*\* the organization wants to accomplish.

It does \*\*not\*\* describe:

\* how the work is implemented,

\* which systems execute it,

\* which AI model generated it,

\* or whether it has been authorized.

Those concerns are handled by other Parmana concepts.

\---

\# Characteristics

A Business Transaction has the following characteristics:

\* Represents a business objective.

\* Exists independently of implementation.

\* May originate from a human or an AI system.

\* Requires organizational authorization before execution.

\* May result in one or more operational actions.

\* Produces an auditable execution record after authorization.

\---

\# Examples

Examples of Business Transactions include:

\* Approve an invoice.

\* Create a purchase order.

\* Process an insurance claim.

\* Grant employee access.

\* Approve a customer refund.

\* Execute a supplier payment.

\* Onboard a new employee.

\* Update customer information.

\* Terminate a user account.

\* Release a software deployment.

Each example represents a business objective rather than a technical operation.

\---

\# Business Transaction vs Technical Operation

A Business Transaction should not be confused with an API call, database update, or workflow step.

For example:

Business Transaction:

> Approve supplier payment.

Possible technical operations:

\* Validate budget.

\* Retrieve supplier record.

\* Verify approval chain.

\* Create payment instruction.

\* Update ERP.

\* Notify finance.

\* Record audit event.

Parmana authorizes the \*\*Business Transaction\*\*.

The underlying implementation remains the responsibility of enterprise systems.

\---

\# Relationship to AI

An AI system may identify, recommend, or propose a Business Transaction.

For example:

> "Approve Invoice #78431."

The AI proposes the transaction.

It does not authorize it.

Authorization remains an organizational responsibility.

\---

\# Relationship to Execution Request

A Business Transaction is transformed into an \*\*Execution Request\*\* before authorization.

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Execution Request

```

The Execution Request contains the structured information required for Authority Verification.

\---

\# Relationship to Organizational Policy

Every Business Transaction is governed by one or more organizational policies.

Policies determine:

\* whether execution is allowed,

\* required approvals,

\* applicable constraints,

\* compliance obligations,

\* authorization conditions.

Business Transactions themselves do not contain policy logic.

\---

\# Relationship to Human Authority

Business Transactions are executed under organizational authority.

Organizations define:

\* who may request them,

\* who may approve them,

\* under which circumstances they may execute.

Human Authority remains the source of execution authority.

\---

\# Relationship to Evidence

A Business Transaction does not contain evidence.

Evidence is collected during Authority Verification and may include:

\* Enterprise Facts,

\* Human Approvals,

\* AI-Derived Signals,

\* Execution Context,

\* Policy evaluation results.

Evidence supports the authorization decision—not the Business Transaction itself.

\---

\# Lifecycle

The lifecycle of a Business Transaction is:

```text

Business Need

&#x20;     │

&#x20;     ▼

Business Transaction

&#x20;     │

&#x20;     ▼

Execution Request

&#x20;     │

&#x20;     ▼

Authority Verification

&#x20;     │

&#x20;     ▼

Authorization Decision

&#x20;     │

&#x20;     ▼

Execution

&#x20;     │

&#x20;     ▼

Execution Trust Record

&#x20;     │

&#x20;     ▼

Execution Receipt

```

The Business Transaction is the starting point of the authorization lifecycle.

\---

\# Design Principles

Business Transactions follow these principles:

\* Business-first rather than system-first.

\* Independent of implementation.

\* Independent of programming language.

\* Independent of AI model.

\* Independent of deployment environment.

\* Governed by organizational policy.

\* Authorized before execution.

\* Fully auditable after execution.

\---

\# What a Business Transaction Is Not

A Business Transaction is \*\*not\*\*:

\* an API request,

\* a workflow definition,

\* a prompt,

\* an LLM response,

\* a database transaction,

\* an execution log,

\* an authorization decision,

\* an audit record,

\* an implementation artifact.

These concepts are defined separately within Parmana.

\---

\# Guarantees

Within Parmana:

\* Every Execution Request represents exactly one Business Transaction.

\* Every authorization decision applies to one Business Transaction.

\* Every Execution Trust Record records the authorization outcome of one Business Transaction.

\* Every Execution Receipt references one authorized Business Transaction.

These guarantees ensure traceability throughout the execution lifecycle.

\---

\# Summary

The Business Transaction is the foundational business concept in Parmana.

It represents the organizational objective that requires authorization before execution.

All subsequent concepts—including Execution Requests, Authority Verification, Authorization Decisions, Execution Trust Records, and Execution Receipts—exist to evaluate, authorize, record, and verify the execution of a Business Transaction.
