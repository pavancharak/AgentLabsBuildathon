\# Metadata Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

Metadata uniquely identifies a Business Transaction and provides the immutable contextual information required to process, audit, replay, and verify that transaction.

Metadata is part of every Business Transaction and is recorded permanently within the Execution Trust Record.

\---

\# Scope

This specification defines:

\* Metadata structure

\* Required metadata fields

\* Metadata invariants

\* Metadata ownership

\* Metadata immutability

This specification does \*\*not\*\* define:

\* Policy

\* Signals

\* Decision

\* Override

\* Execution

\* Verification

\* Receipt

\---

\# Metadata Structure

Every Business Transaction MUST contain a Metadata object.

Canonical structure:

```json

{

&#x20; "metadata": {

&#x20;   "businessTransactionId": "PAY-1001"

&#x20; }

}

```

\---

\# Required Fields

\## businessTransactionId

Unique identifier assigned by the calling application.

Example:

```text

PAY-1001

```

This identifier uniquely identifies the Business Transaction throughout its entire lifecycle.

\---

\# Optional Fields

The Metadata model is intentionally extensible.

Organizations may include additional immutable metadata such as:

\* tenantId

\* organizationId

\* applicationId

\* environment

\* correlationId

\* requestId

\* initiatedBy

\* submittedAt

\* businessDomain

These fields are implementation-specific and do not affect Parmana's trust model.

\---

\# Canonical Example

```json

{

&#x20; "metadata": {

&#x20;   "businessTransactionId": "PAY-1001",

&#x20;   "tenantId": "tenant-a",

&#x20;   "applicationId": "payment-service",

&#x20;   "environment": "production",

&#x20;   "correlationId": "CORR-92873",

&#x20;   "submittedAt": "2026-06-26T10:15:43Z"

&#x20; }

}

```

\---

\# Ownership

Metadata belongs exclusively to the Business Transaction.

Exactly one Metadata object exists for every Business Transaction.

Metadata is never shared between Business Transactions.

\---

\# Immutability

Metadata becomes immutable immediately after the Business Transaction is accepted.

The following fields cannot be modified:

\* businessTransactionId

\* tenantId

\* organizationId

\* applicationId

\* environment

\* correlationId

\* requestId

\* initiatedBy

\* submittedAt

\* any other Metadata field supplied during creation

\---

\# Metadata Validation

Before Policy Resolution begins, Parmana validates:

\* Metadata object exists.

\* Required fields are present.

\* Required fields are correctly formatted.

\* businessTransactionId is unique.

\* Duplicate requests comply with the Duplicate Transaction Model.

If Metadata validation fails:

\* Policy Resolution does not begin.

\* Policy Evaluation does not begin.

\* Execution does not begin.

\* Verification does not begin.

The request is rejected.

\---

\# Relationship to Policy

Metadata identifies \*\*what\*\* Business Transaction is being processed.

Policy defines \*\*how\*\* the Business Transaction will be evaluated.

Metadata never determines policy selection.

\---

\# Relationship to Signals

Metadata identifies the transaction.

Signals provide the business facts required for policy evaluation.

Metadata is not used as policy input unless explicitly referenced by the policy.

\---

\# Relationship to the Execution Trust Record

Metadata is permanently recorded within the Execution Trust Record.

Replay and Verification always use the recorded Metadata.

Metadata is never regenerated.

\---

\# Duplicate Transaction Rules

The `businessTransactionId` is the canonical idempotency key.

If the same Business Transaction is submitted:

\### Identical Request

Return the existing Business Transaction.

No new Business Transaction is created.

\### Different Request

Reject the request.

A single Business Transaction identifier cannot represent different business facts.

\---

\# Canonical Principles

\## Principle 1

Metadata uniquely identifies a Business Transaction.

\---

\## Principle 2

Metadata belongs exclusively to one Business Transaction.

\---

\## Principle 3

Metadata is immutable.

\---

\## Principle 4

Metadata is validated before Policy Resolution.

\---

\## Principle 5

Metadata is permanently recorded in the Execution Trust Record.

\---

\## Principle 6

The `businessTransactionId` is the canonical identifier for idempotency.

\---

\# Canonical Model

```text

Business Transaction



│



├── Metadata

│      ├── businessTransactionId

│      └── Additional Immutable Metadata



├── Policy



├── Signals



├── Decision



├── Override History



├── Executions



├── Verification History



└── Execution Trust Record

```

\---

\# Summary

The Metadata Model provides the immutable identity and contextual information for every Business Transaction.

It establishes the canonical identifier (`businessTransactionId`), supports deterministic processing through immutable contextual data, enables idempotent request handling, and ensures that replay and verification always operate against the original recorded transaction context.

Metadata forms the foundation upon which Policy Resolution, Decision Evaluation, Execution, and the Execution Trust Record are built.
