\# 23 – Frequently Asked Questions (FAQ)

This guide answers common questions about the Parmana Execution Trust Platform.

\---

\# What is Parmana?

Parmana is an Execution Trust Platform that transforms Business Transactions into cryptographically verifiable Execution Trust Records.

\---

\# What problem does Parmana solve?

Parmana enables organizations to independently verify that business actions were executed as authorized and that the underlying execution evidence has not been modified.

\---

\# What is an Execution Trust Record?

An Execution Trust Record is the immutable audit artifact produced after execution.

It contains the evidence required to verify a Business Transaction.

\---

\# What is verified?

Verification performs three independent checks:

\- Integrity

\- Digital Signature

\- Authorization Binding

All checks execute independently and every failure is reported.

\---

\# Why is the Trust Record hashed?

Hashing provides tamper detection.

Any modification to protected execution evidence changes the Trust Record hash.

\---

\# Why is the Trust Record signed?

Digital signatures prove that the Trust Record was produced by a trusted signer and has not been modified after signing.

\---

\# What is the Canonical Record?

The Canonical Record is the immutable subset of the Execution Trust Record used for hashing and signing.

Lifecycle artifacts such as verification history and receipts are intentionally excluded.

\---

\# Why are verification history and receipts excluded from signing?

Verification events and receipts are append-only lifecycle artifacts.

Excluding them allows the audit history to grow without changing the cryptographically protected execution evidence.

\---

\# What is Replay?

Replay reconstructs the canonical Trust Record and performs deterministic verification without executing the original business operation again.

\---

\# Does Replay execute the Business Transaction again?

No.

Replay only verifies the stored execution evidence.

No external business action is performed.

\---

\# What is Authorization Binding?

Authorization Binding ensures that every approved execution references the authorization that permitted it.

Verification fails if an approved execution lacks an `authorizationId`.

\---

\# How are API endpoints protected?

Protected endpoints require a valid Bearer API key.

Public endpoints are:

\- GET /health

\- GET /openapi.yaml

\- GET /documentation

\---

\# Can historical Trust Records still be verified after key rotation?

Yes.

Each signature includes a `keyId`, allowing historical Trust Records to be verified using the corresponding public key.

\---

\# Can verification history grow over time?

Yes.

Verification events are append-only lifecycle artifacts and do not modify the signed execution evidence.

\---

\# Can multiple receipts exist?

Yes.

Receipts are append-only and multiple receipts may exist for the same Execution Trust Record.

\---

\# Is verification deterministic?

Yes.

The same immutable Execution Trust Record always produces the same verification result.

\---

\# What happens if the Trust Record is modified?

Verification fails because:

\- The recomputed Trust Record hash changes.

\- The digital signature no longer validates.

\---

\# Does Parmana require the original execution environment for verification?

No.

Verification uses the stored immutable evidence and the corresponding public key.

\---

\# How can I inspect the API?

Parmana provides:

\- OpenAPI specification (`GET /openapi.yaml`)

\- Interactive Swagger UI (`GET /documentation`)

\---

\# Where should I start?

Recommended reading order:

1\. Architecture Overview

2\. Runtime Architecture

3\. Cryptographic Architecture

4\. Security Architecture

5\. End-to-End Guides

6\. API Reference

\---

\# Summary

Parmana provides deterministic execution evidence, independent verification, cryptographic integrity, and replayable audit capabilities. These properties enable organizations to verify what was executed, how it was authorized, and whether the execution evidence has remained unchanged.
