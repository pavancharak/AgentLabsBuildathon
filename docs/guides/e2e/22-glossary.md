\# 22 – Glossary

This glossary defines the core terminology used throughout the Parmana Execution Trust Platform documentation.

\---

\# API

The REST interface exposed by Parmana for submitting Business Transactions, verifying Execution Trust Records, generating receipts, replaying transactions, and querying stored evidence.

\---

\# Authorization Binding

The association between an approved execution and the authorization that permitted it to occur.

Every approved execution must contain an `authorizationId`, which is verified during Trust Record verification.

\---

\# Business Transaction

A request to perform a business operation.

Examples include:

\- Creating a vendor

\- Approving an invoice

\- Processing a payment

\- Creating a purchase order

\- Approving a contract

Each Business Transaction is assigned a unique Business Transaction ID.

\---

\# Business Transaction ID

The unique identifier assigned to a Business Transaction.

This identifier is used throughout the platform to retrieve Trust Records, perform verification, generate receipts, and execute replay operations.

\---

\# Canonical Record

The immutable representation of an Execution Trust Record used for cryptographic hashing and digital signatures.

Lifecycle artifacts such as verification history and receipts are intentionally excluded from the canonical representation.

\---

\# Connector

A component responsible for executing approved business actions against external systems such as ERP platforms, payment providers, procurement systems, or identity services.

\---

\# Decision

The result of policy evaluation for a Business Transaction.

Typical outcomes include:

\- APPROVED

\- REJECTED

\---

\# Deterministic Verification

A verification process that always produces the same result when evaluating the same immutable Execution Trust Record.

\---

\# Digital Signature

A cryptographic signature created using the Runtime's private key and verified using the corresponding public key.

Digital signatures provide authenticity and detect unauthorized modifications.

\---

\# Execution

An attempt to perform a business action.

Each execution records its decision, metadata, evidence, and authorization information.

\---

\# Execution Evidence

Immutable information collected during execution, including identifiers, decisions, metadata, and timestamps.

Execution evidence forms the basis of the Execution Trust Record.

\---

\# Execution Trust Record

The immutable audit artifact produced after execution.

It contains the evidence required to independently verify that a Business Transaction was executed as authorized.

\---

\# Integrity

The property that ensures protected execution evidence has not been modified since it was created.

Integrity is validated by recomputing the Trust Record hash during verification.

\---

\# Key ID

The identifier associated with the cryptographic key used to sign an Execution Trust Record.

It enables verifiers to select the correct public key.

\---

\# Policy Evaluation

The process of evaluating a Business Transaction against governance policies to determine whether execution is approved or rejected.

\---

\# Receipt

A cryptographic record confirming that an Execution Trust Record existed in a verified state at a specific point in time.

Receipts are append-only lifecycle artifacts.

\---

\# Replay

The process of reconstructing and re-verifying a previously stored Execution Trust Record without executing the original business operation again.

Replay validates that stored evidence remains authentic and unchanged.

\---

\# Runtime

The core execution engine responsible for policy evaluation, authorization, execution orchestration, evidence collection, and Trust Record generation.

\---

\# Signature Verification

The process of validating a digital signature using the corresponding public key to confirm the authenticity of an Execution Trust Record.

\---

\# Trust Record Hash

A deterministic cryptographic hash computed over the canonical representation of an Execution Trust Record.

Any modification to protected data changes the hash and causes integrity verification to fail.

\---

\# Trust Record ID

The unique identifier assigned to an Execution Trust Record.

It identifies the audit artifact associated with a Business Transaction.

\---

\# Verification

The process of validating an Execution Trust Record by performing integrity, signature, and authorization binding checks.

\---

\# Verification ID

The unique identifier assigned to a verification event.

Each verification operation generates a new Verification ID and records the verification result.

\---

\# Verification Status

The outcome of a verification operation.

Typical values include:

\- VERIFIED

\- FAILED

\---

\# Summary

Understanding these terms provides a consistent vocabulary for discussing execution authorization, cryptographic verification, immutable audit evidence, and the runtime architecture of the Parmana Execution Trust Platform.
