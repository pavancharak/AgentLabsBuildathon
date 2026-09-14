\# Policy Authoring Guide

Version: 1.0.0

Status: Canonical

\---

\# Purpose

This guide defines how execution authorization policies are authored in Parmana.

Policies describe deterministic business authorization logic.

Policies SHALL NOT contain application code.

Policies SHALL NOT perform execution.

Policies SHALL NOT contain side effects.

\---

\# Policy Lifecycle

Author

↓

Validate

↓

Review

↓

Approve

↓

Deploy

↓

Evaluate

↓

Replay

↓

Verify

\---

\# Policy Anatomy

Every policy consists of:

\- metadata

\- signals schema

\- ordered rules

\---

\# Metadata

Required

\- policyId

\- policyVersion

\- schemaVersion

\- title

\- description

\- owner

\- category

\- classification

\---

\# Signals

Policies consume runtime signals.

Signals represent facts known at evaluation time.

Examples

\- riskScore

\- humanApproval

\- amount

\- currency

\- repository

\- environment

Signals SHALL be immutable during evaluation.

\---

\# Rules

Rules are evaluated sequentially.

First matching rule wins.

Rules SHALL NOT overlap unnecessarily.

\---

\# Conditions

Leaf

{

&#x20; "fact": "riskScore",

&#x20; "operator": "lte",

&#x20; "value": 25

}

Logical AND

{

&#x20; "all": \[

&#x20; ...

&#x20; ]

}

Logical OR

{

&#x20; "any": \[

&#x20; ...

&#x20; ]

}

Always

{

&#x20; "always": true

}

\---

\# Operators

Document every supported operator with examples.

Equality

Numeric

Collections

Strings

Existence

Boolean

Null

Length

Type

\---

\# Outcomes

Approve

Require Override

Reject

Every outcome SHALL include an audit-quality reason.

\---

\# Rule Design Guidelines

Prefer simple rules.

Split complex business logic into multiple rules.

Avoid deeply nested conditions.

Prefer explicit signals over implicit behavior.

\---

\# Rule Ordering

Recommended

Approve

↓

Require Override

↓

Reject

↓

Default Reject

\---

\# Default Rule

Every policy SHALL end with

{

&#x20; "condition": {

&#x20; "always": true

&#x20; }

}

No rules SHALL follow.

\---

\# Determinism Requirements

Policies SHALL NOT

\- use current time

\- use random values

\- call external APIs

\- query databases

\- invoke LLMs

Policies SHALL evaluate only supplied runtime signals.

\---

\# Replay Requirements

Given identical

\- policy

\- signals

\- engine version

evaluation SHALL produce identical results.

\---

\# Validation Checklist

Before publishing a policy verify:

✓ Metadata complete

✓ Signals declared

✓ Operators supported

✓ Default rule exists

✓ Reasons provided

✓ PolicyValidator passes

✓ Replay deterministic

\---

\# Style Guide

Use business terminology.

Avoid implementation details.

Write audit-friendly reasons.

Use consistent rule identifiers.

Prefer positive approval rules followed by explicit rejection rules.

\---

\# Example Policy

Provide one complete production-quality policy demonstrating every convention.
