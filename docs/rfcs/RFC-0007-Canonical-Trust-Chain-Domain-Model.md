# RFC-0007: Canonical Trust Chain Domain Model

**Status:** Accepted

## Purpose

This RFC defines the canonical domain model for Parmana.

It establishes the immutable trust chain linking authority, authorization, intent, policy, execution, evidence, and verification.

The trust chain is the foundation of Parmana's Execution Trust Infrastructure.

---

# Canonical Trust Chain

```
Authority
    │
    ▼
Authorization
    │
    ▼
Intent
    │
    ▼
BusinessTransaction
    │
    ▼
PolicyReference
(name, version, schemaVersion)
    │
    ▼
Decision
    │
    ▼
TrustRecord
    │
    ▼
Receipt
    │
    ▼
Independent Verification
```

Every execution artifact is cryptographically linked to the previous artifact.

---

# Domain Objects

## Authority

Represents the entity permitted to authorize execution.

Examples:

- Human approver
- Service account
- Organization
- Workflow owner

---

## Authorization

Represents the approval allowing execution.

Examples:

- Approval ID
- Digital signature
- Approval timestamp

---

## Intent

Represents what is intended to happen.

Intent is independent of implementation.

Examples:

- Release vendor payment
- Approve loan
- Grant access

---

## BusinessTransaction

Represents the execution request.

A BusinessTransaction SHALL contain a PolicyReference.

The BusinessTransaction is the canonical execution input.

---

## PolicyReference

```ts
interface PolicyReference {
  readonly name: string;
  readonly version: string;
  readonly schemaVersion: string;
}
```

The PolicyReference identifies the exact policy artifact used during execution.

Runtime SHALL NOT infer or discover policies.

---

## Decision

Represents the deterministic outcome produced by evaluating the referenced policy.

A Decision is derived only from:

- Policy
- Signals
- Deterministic evaluation

---

## TrustRecord

Immutable evidence describing execution.

A TrustRecord binds together:

- BusinessTransaction
- PolicyReference
- Decision
- Hashes
- Metadata

---

## Receipt

Cryptographically signed proof of execution.

A Receipt enables independent verification without trusting the runtime.

---

## Verification

Verification independently proves that:

- the correct policy executed,
- the execution has not been modified,
- the evidence is authentic,
- the receipt signature is valid.

---

# Trust Chain Principles

The system SHALL maintain a cryptographically verifiable chain:

```
Authority
→ Authorization
→ Intent
→ BusinessTransaction
→ PolicyReference
→ Decision
→ TrustRecord
→ Receipt
→ Verification
```

Each stage depends only on the previous stage.

---

# Architectural Invariants

- BusinessTransaction SHALL reference exactly one PolicyReference.
- PolicyReference SHALL contain `name`, `version`, and `schemaVersion`.
- Runtime SHALL execute exactly one policy.
- Runtime SHALL NOT discover, scan, or guess policies.
- Decisions SHALL be deterministic.
- TrustRecords SHALL be immutable once created.
- Receipts SHALL be digitally signed.
- Verification SHALL be independent of the runtime.

---

# Scope

This RFC defines the canonical trust-chain domain model only.

Policy loading, runtime architecture, policy versioning, and schema evolution are defined in separate RFCs.

---

# Status

This document is the canonical domain model for Parmana Phase 1 and serves as the foundation for all subsequent architecture and implementation RFCs.
