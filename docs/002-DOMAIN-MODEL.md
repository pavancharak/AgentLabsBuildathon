\# Parmana Domain Model

\*\*Document:\*\* 002-DOMAIN-MODEL.md

\*\*Version:\*\* 1.0.0 (Draft)

\*\*Status:\*\* Architecture Lock

\---

\# Purpose

This document defines the canonical domain model of the Parmana platform.

The domain model establishes the vocabulary, ownership, relationships, and responsibilities of every core concept in the platform.

Only the concepts defined in this document are considered first-class domain objects.

\---

\# Domain Philosophy

Parmana models \*\*trusted execution\*\*.

The platform does not model workflows.

The platform does not model applications.

The platform models the lifecycle of a single execution and the evidence required to independently verify that execution.

\---

\# Root Aggregate

The root aggregate is:

```text

ExecutionTransaction

```

Every domain object belongs to exactly one ExecutionTransaction.

Nothing exists outside an ExecutionTransaction.

\---

\# Aggregate Structure

```text

ExecutionTransaction

│

├── Authority

├── Intent

├── Authorization

├── Execution

├── Evidence

└── Verification

```

This structure is permanent.

\---

\# Domain Objects

\## 1. ExecutionTransaction

\### Purpose

Represents one complete trusted execution lifecycle.

\### Owns

\* Authority

\* Intent

\* Authorization

\* Execution

\* Evidence

\* Verification

\* Crypto Profile

\### Responsibilities

\* Establish aggregate boundaries.

\* Maintain lifecycle consistency.

\* Provide a stable identity for every execution.

\### Invariants

\* Has exactly one Authority.

\* Has exactly one Intent.

\* Has exactly one Authorization.

\* Has exactly one Execution.

\* May contain multiple Evidence artifacts.

\* Produces one Verification outcome.

\---

\## 2. Authority

\### Purpose

Identifies who is permitted to authorize execution.

\### Responsibilities

\* Establish execution authority.

\* Record delegation.

\* Record identity.

\* Record approval source.

\### Examples

\* Human Approver

\* AI Supervisor

\* Policy Authority

\* External System

\* Organization

\### Invariants

\* Authority is immutable.

\* Authority identity is verifiable.

\---

\## 3. Intent

\### Purpose

Defines what execution is expected to perform.

\### Responsibilities

\* Describe expected execution.

\* Record parameters.

\* Record expected outcome.

\* Bind execution to authorization.

\### Invariants

\* Intent is immutable.

\* Intent is uniquely identifiable.

\* Intent cannot change after authorization.

\---

\## 4. Authorization

\### Purpose

Determines whether execution is permitted.

\### Responsibilities

\* Evaluate policy.

\* Produce authorization decision.

\* Bind authorization to intent.

\### May Produce

\* Decision

\* Policy Snapshot

\* Execution Permit

\* Authorization Metadata

\### Invariants

\* Authorization references exactly one Intent.

\* Authorization precedes Execution.

\---

\## 5. Execution

\### Purpose

Records what actually occurred.

\### Responsibilities

\* Record execution status.

\* Record execution system.

\* Record execution reference.

\* Record execution timestamp.

\### Invariants

\* Execution is immutable.

\* Execution references one Authorization.

\* Execution belongs to one ExecutionTransaction.

\---

\## 6. Evidence

\### Purpose

Preserves every artifact required for independent verification.

\### May Contain

\* Signals

\* Attestations

\* Receipts

\* Signatures

\* Hashes

\* Ledger Records

\* Policy Snapshots

\* Execution Metadata

\### Responsibilities

\* Preserve history.

\* Preserve integrity.

\* Preserve provenance.

\### Invariants

\* Evidence is append-only.

\* Evidence is immutable.

\* Historical evidence is never deleted.

\---

\## 7. Verification

\### Purpose

Determine whether execution matched authorized intent.

\### Responsibilities

\* Verify Authority

\* Verify Intent

\* Verify Authorization

\* Verify Execution

\* Verify Evidence

\* Produce Trust Report

\### Outputs

\* PASS

\* FAIL

\* INCOMPLETE

\* UNKNOWN

\### Invariants

\* Verification is deterministic.

\* Verification is reproducible.

\* Verification depends on recorded evidence.

\---

\## 8. CryptoProfile

\### Purpose

Defines the cryptographic configuration used by an ExecutionTransaction.

\### Components

\* Canonicalization

\* Hash Algorithm

\* Signature Algorithm

\* Key Identifier

\* Version

\### Responsibilities

\* Enable cryptographic agility.

\* Preserve historical verification.

\### Invariants

\* CryptoProfile is immutable.

\* Every signature references one CryptoProfile.

\---

\# Relationships

```text

ExecutionTransaction

&#x20;       │

&#x20;       ├── Authority

&#x20;       │

&#x20;       ├── Intent

&#x20;       │

&#x20;       ├── Authorization

&#x20;       │

&#x20;       ├── Execution

&#x20;       │

&#x20;       ├── Evidence

&#x20;       │

&#x20;       ├── Verification

&#x20;       │

&#x20;       └── CryptoProfile

```

\---

\# Ownership Rules

| Object | Owner |

| ------------- | -------------------- |

| Authority | ExecutionTransaction |

| Intent | ExecutionTransaction |

| Authorization | ExecutionTransaction |

| Execution | ExecutionTransaction |

| Evidence | ExecutionTransaction |

| Verification | ExecutionTransaction |

| CryptoProfile | ExecutionTransaction |

No domain object may be shared between ExecutionTransactions.

\---

\# Domain Boundaries

Implementation artifacts belong to domains.

They are \*\*not\*\* top-level domain objects.

| Artifact | Domain |

| ---------------- | ------------- |

| Decision | Authorization |

| Policy Snapshot | Authorization |

| Execution Permit | Authorization |

| Signals | Evidence |

| Attestation | Evidence |

| Receipt | Evidence |

| Signature | Evidence |

| Hash | Evidence |

| Ledger Record | Evidence |

| Trust Report | Verification |

| Replay | Verification |

| Integrity Check | Verification |

\---

\# Domain Invariants

Every ExecutionTransaction must satisfy the following invariants.

\### Authority

Execution originates from a recognized authority.

\---

\### Intent

Execution matches immutable intent.

\---

\### Authorization

Execution is explicitly authorized.

\---

\### Execution

Execution is permanently recorded.

\---

\### Evidence

Evidence is independently verifiable.

\---

\### Verification

Execution matches authorized intent.

\---

\# Aggregate Lifecycle

```text

Authority

&#x20;     ↓

Intent

&#x20;     ↓

Authorization

&#x20;     ↓

Execution

&#x20;     ↓

Evidence

&#x20;     ↓

Verification

&#x20;     ↓

Execution Trust

```

This lifecycle defines every ExecutionTransaction.

\---

\# Evolution Rules

The following objects are permanent architectural concepts.

\* ExecutionTransaction

\* Authority

\* Intent

\* Authorization

\* Execution

\* Evidence

\* Verification

\* CryptoProfile

Implementation artifacts may evolve without changing the domain model.

New domain objects require an architecture decision and an update to this document.

\---

\# Success Criterion

The domain model succeeds when every execution can be represented by a single ExecutionTransaction whose Authority, Intent, Authorization, Execution, Evidence, and Verification are sufficient for an independent verifier to determine whether execution matched authorized intent.
