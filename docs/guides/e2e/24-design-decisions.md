\# 24 – Design Decisions

This document records the key architectural decisions behind the Parmana Execution Trust Platform, the reasoning for each decision, and the associated trade-offs.

\---

\# Purpose

Architectural decisions are difficult to change after a platform is adopted.

This document explains why Parmana was designed the way it is and serves as a reference for future contributors and maintainers.

\---

\# Decision 1 – Deterministic Execution

\## Decision

Execution decisions must be deterministic.

The same Business Transaction, policy version, and execution inputs must always produce the same decision.

\## Rationale

Deterministic behavior enables:

\- Independent verification

\- Reliable replay

\- Predictable auditing

\- Consistent compliance

\## Trade-offs

Pros

\- Reproducible decisions

\- Easier testing

\- Easier auditing

Cons

\- Reduced flexibility for non-deterministic workflows

\- Greater emphasis on controlled inputs

\---

\# Decision 2 – Immutable Execution Evidence

\## Decision

Execution evidence is immutable after it is created.

\## Rationale

Audit evidence must remain stable throughout its lifetime.

Verification relies on immutable execution data.

\## Trade-offs

Pros

\- Strong audit guarantees

\- Reliable replay

\- Simplified verification

Cons

\- Corrections require new records rather than modifying existing ones

\---

\# Decision 3 – Canonical Representation

\## Decision

Only immutable fields are included in the canonical representation used for hashing and signing.

Included:

\- Trust Record ID

\- Business Transaction ID

\- Transaction

\- Overrides

\- Executions

\- Created At

Excluded:

\- Verification history

\- Receipt history

\- Signature

\- Trust Record Hash

\- Updated At

\## Rationale

Lifecycle artifacts grow over time and should not invalidate existing signatures.

\## Trade-offs

Pros

\- Stable signatures

\- Append-only audit history

Cons

\- Developers must clearly distinguish immutable evidence from lifecycle metadata

\---

\# Decision 4 – Asymmetric Cryptography

\## Decision

Use asymmetric cryptography for signing and verification.

\## Rationale

Only the Runtime requires the private signing key.

Verification requires only the corresponding public key.

\## Trade-offs

Pros

\- Independent verification

\- Secure key separation

\- Supports key rotation

Cons

\- Additional operational requirements for key management

\---

\# Decision 5 – Independent Verification

\## Decision

Verification is performed independently of execution.

\## Rationale

Verification should validate stored evidence rather than trust execution results.

\## Trade-offs

Pros

\- Detects tampering

\- Supports forensic analysis

\- Enables replay

Cons

\- Additional verification processing

\---

\# Decision 6 – Authorization Binding

\## Decision

Every approved execution must include an `authorizationId`.

\## Rationale

Execution must be traceable to the authorization that permitted it.

\## Trade-offs

Pros

\- Strong accountability

\- Improved auditability

Cons

\- Additional metadata requirements

\---

\# Decision 7 – Append-Only Lifecycle Artifacts

\## Decision

Verification events and receipts are append-only.

\## Rationale

Execution evidence remains immutable while operational history continues to grow.

\## Trade-offs

Pros

\- Preserves cryptographic integrity

\- Complete audit history

Cons

\- Larger storage requirements over time

\---

\# Decision 8 – Layered Architecture

\## Decision

Separate responsibilities into focused packages.

Examples include:

\- API

\- Runtime

\- Crypto

\- Governance

\- Repository

\## Rationale

Clear separation of concerns improves maintainability and testing.

\## Trade-offs

Pros

\- Modular design

\- Easier evolution

\- Improved code ownership

Cons

\- More package boundaries to manage

\---

\# Decision 9 – API-First Design

\## Decision

Expose platform capabilities through a REST API with an OpenAPI specification.

\## Rationale

An API-first approach simplifies integration, client generation, and testing.

\## Trade-offs

Pros

\- Consistent integrations

\- Interactive documentation

\- Standard tooling support

Cons

\- API versioning must be managed carefully

\---

\# Decision 10 – Replay Without Re-Execution

\## Decision

Replay verifies stored execution evidence instead of executing the original business action again.

\## Rationale

Replay should validate evidence without producing additional business side effects.

\## Trade-offs

Pros

\- Safe verification

\- Deterministic results

\- No duplicate business operations

Cons

\- Replay cannot validate changes in external systems after the original execution

\---

\# Summary

The Parmana architecture emphasizes deterministic execution, immutable evidence, independent verification, and modular design. These decisions collectively support trustworthy execution authorization while balancing operational simplicity, security, and long-term maintainability.
