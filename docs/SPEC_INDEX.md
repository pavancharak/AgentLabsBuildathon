\# Parmana Specification Index

\*\*Project:\*\* Parmana — Execution Trust Infrastructure

\*\*Version:\*\* 1.0.0

\*\*Status:\*\* Architecture Locked

\---

\# Overview

This specification defines the architecture, domain model, implementation contracts, and engineering principles of the Parmana platform.

The specification is organized into three layers.

\---

\# Part I — Foundation

These documents define the permanent architecture of Parmana.

They change rarely.

| Document | Purpose |

| ---------------------------- | ---------------------------------------------- |

| 000-CONSTITUTION.md | Core principles and architectural constitution |

| 001-ARCHITECTURE.md | Overall platform architecture |

| 002-DOMAIN-MODEL.md | Canonical business domain model |

| 003-EXECUTION-TRANSACTION.md | Root aggregate specification |

| 004-VERIFICATION.md | Verification model and trust invariants |

\---

\# Part II — Platform Contracts

These documents define the public interfaces of the platform.

| Document | Purpose |

| ------------------- | -------------------------------------- |

| 005-CRYPTOGRAPHY.md | Cryptographic architecture and agility |

| 006-API.md | Public REST API specification |

| 007-SDK.md | SDK architecture |

| 008-CLI.md | Command-line interface |

\---

\# Part III — Runtime Contracts

These documents define execution behavior.

| Document | Purpose |

| --------------- | ----------------------------------- |

| 009-STORAGE.md | Storage abstraction and persistence |

| 010-EVIDENCE.md | Evidence architecture |

| 011-RUNTIME.md | Runtime orchestration |

\---

\# Canonical Execution Lifecycle

```text

Authority

&#x20;     │

&#x20;     ▼

Intent

&#x20;     │

&#x20;     ▼

Authorization

&#x20;     │

&#x20;     ▼

Execution

&#x20;     │

&#x20;     ▼

Evidence

&#x20;     │

&#x20;     ▼

Verification

&#x20;     │

&#x20;     ▼

Execution Trust

```

Every ExecutionTransaction follows this lifecycle.

\---

\# Core Domains

The platform defines six canonical business domains.

\* Authority

\* Intent

\* Authorization

\* Execution

\* Evidence

\* Verification

These domains are owned by the ExecutionTransaction aggregate.

\---

\# Architectural Layers

```text

Applications

&#x20;       │

&#x20;       ▼

SDK / CLI / API

&#x20;       │

&#x20;       ▼

Runtime

&#x20;       │

&#x20;       ▼

Evidence

&#x20;       │

&#x20;       ▼

Verification

&#x20;       │

&#x20;       ▼

Storage + Crypto

```

Each layer has a single responsibility.

\---

\# Guiding Principles

\* ExecutionTransaction is the root aggregate.

\* Evidence is immutable and append-only.

\* Verification is deterministic and reproducible.

\* Trust is established through verification.

\* Cryptography is replaceable.

\* Storage is implementation-independent.

\* Business domains are independent of infrastructure.

\---

\# Repository Structure

```text

parmana/



docs/



packages/



runtime/



evidence/



verification/



crypto/



shared/



examples/



tests/

```

\---

\# Implementation Order

Implementation follows the specification.

\### Phase 1

Shared domain model

\* ExecutionTransaction

\* Authority

\* Intent

\* Authorization

\* Execution

\* Evidence

\* Verification

\---

\### Phase 2

Crypto layer

Storage layer

Evidence layer

\---

\### Phase 3

Runtime

Verification Engine

Trust Report

\---

\### Phase 4

SDK

REST API

CLI

Examples

\---

\# Success Criteria

The Parmana platform is complete when:

\* Every execution is represented by an ExecutionTransaction.

\* Every execution produces immutable Evidence.

\* Every execution can be independently Verified.

\* Every verification produces an Execution Trust Report.

\* The platform remains independent of specific storage technologies and cryptographic algorithms.
