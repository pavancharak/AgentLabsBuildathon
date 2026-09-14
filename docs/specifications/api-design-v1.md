\# Parmana API Design v1 (Final Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

Parmana is \*\*Execution Trust Infrastructure\*\*.

Applications submit Business Transactions to Parmana.

Parmana evaluates those transactions using organizational policies, executes approved actions, generates execution evidence, and maintains a verifiable Execution Trust Record.

The public API is intentionally designed around \*\*business capabilities\*\*, not internal implementation stages.

Internal concepts such as Authority, Intent, Authorization, Evidence, and Verification remain implementation details.

\---

\# Design Principles

\## Principle 1

The Business Transaction is the primary resource.

Every API operation is performed on a Business Transaction.

\---

\## Principle 2

Clients interact with business capabilities.

Clients never interact directly with internal pipeline stages.

\---

\## Principle 3

Every Business Transaction has exactly one Execution Trust Record.

\---

\## Principle 4

The Business Transaction ID is the canonical identifier across all APIs.

\---

\## Principle 5

Manual Review is a business workflow.

It is owned by the calling application.

Parmana does not manage review queues, reviewer assignment, approvals, escalations, or workflow state.

\---

\## Principle 6

Override is an authoritative business action.

Parmana verifies, records, and executes authorized overrides.

\---

\# API Overview

| Method | Endpoint | Purpose |

| ------ | ------------------------------------------------- | -------------------------------------- |

| GET | /health | Service health |

| GET | /version | Runtime version |

| POST | /transactions | Submit a Business Transaction |

| GET | /transactions/{businessTransactionId} | Retrieve Execution Trust Record |

| GET | /transactions/{businessTransactionId}/receipt | Retrieve Execution Receipt |

| GET | /transactions/{businessTransactionId}/trust-chain | Retrieve Trust Chain |

| POST | /transactions/{businessTransactionId}/override | Submit an authorized Override Decision |

| POST | /transactions/{businessTransactionId}/verify | Verify Execution Trust Record |

| POST | /transactions/{businessTransactionId}/replay | Replay Business Transaction |

\---

\# API Details

\## GET /health

Returns service health for monitoring and orchestration.

\---

\## GET /version

Returns runtime version information.

\---

\## POST /transactions

\### Purpose

Submit a Business Transaction.

\### Request

```json

{

&#x20; "metadata": {},

&#x20; "policy": {},

&#x20; "signals": {}

}

```

\### Processing

Parmana performs:

\* Request validation

\* Policy loading

\* Policy evaluation

\* Decision generation

\* Execution

\* Evidence generation

\* Verification

\* Receipt generation

\* Trust record persistence

\---

\## GET /transactions/{businessTransactionId}

Retrieves the complete Execution Trust Record.

Returns:

\* Metadata

\* Policy

\* Signals

\* Decision

\* Override History

\* Execution

\* Evidence

\* Verification

\* Receipt

\* Trust Chain

\---

\## GET /transactions/{businessTransactionId}/receipt

Returns a lightweight execution receipt suitable for applications, reporting, and regulatory evidence.

\---

\## GET /transactions/{businessTransactionId}/trust-chain

Returns the complete execution trust chain including:

\* Authority

\* Intent

\* Authorization

\* Decision

\* Execution

\* Evidence

\* Verification

\---

\## POST /transactions/{businessTransactionId}/override

\### Purpose

Submit an authorized Override Decision.

\### Why

Manual Review belongs to the business application.

Once an authorized reviewer decides to change the policy decision, the application submits the final Override Decision to Parmana.

Parmana does not manage:

\* Review queues

\* Reviewer assignment

\* Escalation

\* Workflow

Parmana only verifies and records the authoritative override.

\### Example

```json

{

&#x20; "authority": {

&#x20;   "id": "manager-101",

&#x20;   "role": "RiskManager"

&#x20; },

&#x20; "decision": "APPROVE",

&#x20; "reason": "Manual KYC verification completed."

}

```

\### Processing

Parmana performs:

\* Authority verification

\* Override validation

\* Append Override Decision

\* Continue Execution Trust Pipeline

\* Generate execution evidence

\* Generate verification artifacts

\* Update Execution Trust Record

The original Policy Decision is never modified or removed.

\---

\## POST /transactions/{businessTransactionId}/verify

Verifies the integrity of the Execution Trust Record.

Used during:

\* Audit

\* Compliance

\* Investigation

\* Operational verification

\---

\## POST /transactions/{businessTransactionId}/replay

Replays the Business Transaction using the recorded:

\* Signals

\* Policy Version

\* Schema Version

Replay never creates a new Business Transaction.

Replay never modifies historical records.

Replay demonstrates deterministic execution.

\---

\# API Lifecycle

```text

Application



&#x20;       │



POST /transactions



&#x20;       │



Policy Evaluation



&#x20;       │



Policy Decision



&#x20;       │



&#x20;┌──────┴───────────────┐

&#x20;│                      │

&#x20;▼                      ▼



APPROVE              REJECT

&#x20;│                      │

&#x20;▼                      ▼



Execute        Business Manual Review

&#x20;                     │

&#x20;                     ▼



&#x20;          Override Decision (optional)



&#x20;                     │

&#x20;                     ▼



POST /transactions/{businessTransactionId}/override



&#x20;                     │

&#x20;                     ▼



Authority Verification



&#x20;                     │

&#x20;                     ▼



Execute



&#x20;                     │

&#x20;                     ▼



Execution Trust Record



&#x20;                     │



&#x20;     ┌───────────┬────────────┬─────────────┐

&#x20;     ▼           ▼            ▼



&#x20;  Receipt   Trust Chain   Verification



&#x20;                     │

&#x20;                     ▼



&#x20;                 Replay

```

\---

\# Resource Model

```text

Business Transaction



│



├── Metadata



├── Policy



├── Signals



├── Policy Decision



├── Override Decision (optional)



├── Execution



├── Evidence



├── Verification



├── Receipt



└── Trust Chain

```

\---

\# Separation of Responsibilities

\## Business Application

Owns:

\* Manual Review

\* Reviewer assignment

\* Approval workflow

\* Escalation

\* User interface

\## Parmana

Owns:

\* Policy evaluation

\* Authority verification

\* Override recording

\* Execution

\* Evidence generation

\* Verification

\* Receipt generation

\* Trust Chain generation

\---

\# Canonical API (Final Locked)

| Method | Endpoint |

| ------ | ------------------------------------------------- |

| GET | /health |

| GET | /version |

| POST | /transactions |

| GET | /transactions/{businessTransactionId} |

| GET | /transactions/{businessTransactionId}/receipt |

| GET | /transactions/{businessTransactionId}/trust-chain |

| POST | /transactions/{businessTransactionId}/override |

| POST | /transactions/{businessTransactionId}/verify |

| POST | /transactions/{businessTransactionId}/replay |

This is the canonical public API for Parmana v1. It exposes business capabilities centered on the Business Transaction while keeping manual review workflows outside Parmana and preserving a single, append-only Execution Trust Record for every transaction.
