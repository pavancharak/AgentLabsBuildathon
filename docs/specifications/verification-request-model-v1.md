\# Verification Request Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

This specification defines the request model for initiating verification of a Business Transaction.

Verification is deterministic and always validates the complete Execution Trust Record.

The client does not specify which trust artifacts to verify.

\---

\# Verification Endpoint

```http

POST /v1/transactions/{businessTransactionId}/verify

```

The `businessTransactionId` uniquely identifies the Execution Trust Record to verify.

\---

\# Request Body

The verification request does not require a request body.

Examples:

```http

POST /v1/transactions/PAY-1001/verify

Authorization: Bearer <token>

```

or

```http

POST /v1/transactions/PAY-1001/verify

Content-Type: application/json



{}

```

Both forms are functionally equivalent.

\---

\# Rationale

The Business Transaction uniquely identifies the Execution Trust Record.

The Execution Trust Record already contains every trust artifact required for verification, including:

\* Metadata

\* Policy

\* Signals

\* Decision

\* Override History

\* Executions

\* Evidence

\* Receipts

No additional client input is required.

\---

\# Why Selective Verification Is Not Supported

The API intentionally does not support requests such as:

\* Verify only the Receipt.

\* Verify only the Policy.

\* Verify only the Decision.

\* Verify only the Evidence.

Selective verification would introduce multiple verification semantics and increase API complexity.

Parmana defines verification as a validation of the complete Execution Trust Record.

\---

\# Verification Scope

Every verification operation validates all recorded trust artifacts:

\* Business Transaction

\* Metadata

\* Policy

\* Signals

\* Decision

\* Override History

\* Executions

\* Evidence

\* Receipts

Verification always produces a single deterministic result for the entire Execution Trust Record.

\---

\# Benefits

This model provides:

\* Minimal API surface.

\* Deterministic verification behavior.

\* No client-side configuration.

\* Consistent verification semantics.

\* Simpler SDKs.

\* Reduced implementation complexity.

\---

\# Canonical Principles

\## Principle 1

Verification always operates on the complete Execution Trust Record.

\---

\## Principle 2

The Business Transaction identifier is sufficient to initiate verification.

\---

\## Principle 3

Verification requires no business input from the client.

\---

\## Principle 4

Selective verification is not supported.

\---

\## Principle 5

Verification behavior is deterministic and identical for every request.

\---

\# Summary

The Verification API is intentionally minimal. The `businessTransactionId` identifies the Execution Trust Record, and Parmana verifies the complete record without requiring additional request parameters. This design aligns with the Execution Trust architecture, preserves deterministic behavior, and keeps the verification interface simple, consistent, and implementation-independent.
