\# Parmana Reference Policy Specification

Version: 1.0.0

Status: Canonical

\---

\# Purpose

This document defines the canonical structure and quality requirements for the reference policies distributed with Parmana.

Reference policies demonstrate recommended enterprise policy authoring practices and serve as templates for customer-defined policies.

\---

\# Objectives

Reference policies SHALL:

\- demonstrate deterministic policy evaluation

\- demonstrate execution authorization

\- be replayable

\- be independently verifiable

\- be suitable for production deployment

\- pass PolicyValidator without modification

\---

\# Canonical Policy Library

The reference policy library consists of:

\- access-control

\- customer-refund

\- database-change

\- github-pr-approval

\- llm-tool-call

\- production-deployment

\- rag-document-access

\- vendor-payment

\---

\# Canonical Policy Structure

Every policy SHALL contain:

{

&#x20; policyId

&#x20; policyVersion

&#x20; schemaVersion

&#x20; title

&#x20; description

&#x20; owner

&#x20; category

&#x20; classification

&#x20; signalsSchema

&#x20; rules

}

\---

\# Metadata

\## policyId

Unique policy identifier.

Immutable.

\---

\## policyVersion

Business version.

Semantic versioning.

\---

\## schemaVersion

Policy language version.

\---

\## title

Human-readable policy name.

\---

\## description

Business description.

Describes governance intent rather than implementation.

\---

\## owner

Policy owner.

Example:

Parmana

\---

\## category

Example values:

Execution Authorization

AI Execution Authorization

Deployment Governance

Access Governance

\---

\## classification

Example values:

Reference

Customer

Enterprise

Internal

\---

\# Signals Schema

Every policy SHALL explicitly declare every runtime signal.

Example:

{

&#x20; "riskScore": "number",

&#x20; "humanApproval": "boolean",

&#x20; "resourceAuthorized": "boolean"

}

Signals SHALL be validated before policy evaluation.

\---

\# Rules

Rules SHALL be evaluated in document order.

The first matching rule SHALL determine the policy outcome.

\---

\# Canonical Rule Ordering

Policies SHOULD follow this structure:

1\. Approval rules

2\. Require Override rules (optional)

3\. Reject rules

4\. Default rule

\---

\# Default Rule

The final rule SHALL be:

{

&#x20; "condition": {

&#x20; "always": true

&#x20; }

}

No rules shall appear after an always condition.

\---

\# Rule Identifiers

Rule identifiers SHOULD follow a consistent naming convention.

Examples:

approve-access

approve-refund

require-human-review

reject-high-risk

reject-unauthorized

default-reject

\---

\# Policy Conditions

Supported condition types:

Leaf

{

&#x20; "fact": "...",

&#x20; "operator": "...",

&#x20; "value": ...

}

AND

{

&#x20; "all": \[ ... ]

}

OR

{

&#x20; "any": \[ ... ]

}

Always

{

&#x20; "always": true

}

No other condition types are permitted.

\---

\# Supported Operators

Equality

eq

neq

Numeric

gt

gte

lt

lte

between

Collection

in

not\_in

contains

not\_contains

contains\_all

contains\_any

String

starts\_with

ends\_with

matches

Existence

exists

not\_exists

Boolean

is\_true

is\_false

Null

is\_null

is\_not\_null

Length

length\_eq

length\_gt

length\_gte

length\_lt

length\_lte

Type

type\_is

\---

\# Outcome Reasons

Outcome reasons SHALL be suitable for audit records.

Reasons SHOULD explain the governance decision.

Examples:

Execution authorized. All required governance conditions were satisfied.

Execution rejected because the assessed risk exceeds the maximum permitted threshold.

Execution rejected because the requested operation is not authorized.

\---

\# Determinism

Reference policies SHALL be deterministic.

Policy evaluation SHALL NOT depend upon:

\- clocks

\- randomness

\- databases

\- network requests

\- LLMs

\- external services

All external information SHALL be supplied as runtime signals.

\---

\# Replay Guarantee

Given:

\- identical policy

\- identical signals

\- identical engine version

evaluation SHALL produce:

\- identical outcome

\- identical reason

\- identical matched rule

\- identical evaluation trace

\---

\# Validation

Every reference policy SHALL:

\- pass PolicyValidator

\- declare all signals

\- use only canonical operators

\- contain a default rule

\- be replay-safe
