\# RFC-0003 — Human Approval

\*\*Status:\*\* Draft

\*\*Author:\*\* Parmana Architecture Team

\*\*Created:\*\* 2026-06-25

\*\*Target Version:\*\* 0.3.0

\---

\# Summary

Introduce a Human Approval capability that allows execution to pause until one or more authorized humans explicitly approve or reject execution.

Human Approval integrates into the Runtime Pipeline while preserving deterministic execution and immutable execution records.

Approval decisions become part of the immutable execution evidence.

\---

\# Motivation

Many regulated and high-impact systems require human oversight before execution.

Examples include:

\* Financial transactions

\* Healthcare workflows

\* Legal approvals

\* Production deployments

\* AI agent actions

\* Infrastructure changes

Execution Trust should include evidence that required human approvals were obtained before execution.

\---

\# Goals

\* Support single and multiple approvers.

\* Record immutable approval decisions.

\* Support approval and rejection.

\* Support deterministic replay.

\* Preserve independent verification.

\---

\# Non-Goals

This RFC does not define:

\* Identity management.

\* Authentication.

\* User interfaces.

\* Notification systems.

\* Workflow management.

These concerns remain external to Parmana.

\---

\# Architecture

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

Human Approval

&#x20;     │

&#x20;     ▼

Execution

&#x20;     │

&#x20;     ▼

Evidence

```

Execution SHALL NOT proceed until required approvals have been satisfied.

\---

\# Human Approval Model

A Human Approval contains:

\* Approval Identifier

\* Approver Identifier

\* Decision

\* Timestamp

\* Optional Reason

\* Metadata

Approval objects are immutable.

\---

\# Runtime Integration

The Runtime Pipeline introduces an optional HumanApprovalStage.

```text

AuthorityStage

&#x20;     │

&#x20;     ▼

IntentStage

&#x20;     │

&#x20;     ▼

AuthorizationStage

&#x20;     │

&#x20;     ▼

HumanApprovalStage

&#x20;     │

&#x20;     ▼

ExecutionStage

&#x20;     │

&#x20;     ▼

EvidenceStage

```

The stage is configurable.

If approval is not required, execution continues without entering the approval state.

\---

\# Approval States

The following states are defined:

\* Pending

\* Approved

\* Rejected

\* Expired

\* Cancelled

State transitions produce new immutable records.

Historical approval decisions remain preserved.

\---

\# Approval Policies

Implementations MAY support:

\* Single approver

\* Multiple approvers

\* Majority approval

\* Unanimous approval

\* Sequential approval

\* Parallel approval

These policies are implementation concerns and do not alter the Core domain model.

\---

\# Evidence

Approval decisions SHALL become immutable evidence.

Typical evidence includes:

\* Approver Identifier

\* Decision

\* Timestamp

\* Approval Policy Identifier

\* Optional Comments

Approval evidence SHALL be append-only.

\---

\# Verification

The Verification Engine validates:

\* Required approvals exist.

\* Approval evidence is complete.

\* Approval decisions are internally consistent.

\* Approval evidence has not been modified.

Verification SHALL NOT request new approvals or alter approval decisions.

\---

\# Replay

Replay reconstructs approval decisions using recorded evidence.

Replay SHALL NOT request user interaction.

Historical approval decisions are treated as immutable execution facts.

\---

\# Determinism

Human approval introduces a non-deterministic event at execution time.

To preserve deterministic replay:

\* The approval outcome SHALL be recorded.

\* The approval timestamp SHALL be recorded.

\* The approver identity SHALL be recorded.

\* Replay SHALL consume the recorded approval rather than request a new decision.

\---

\# Package Mapping

```text

packages/



approval/

&#x20;   src/

&#x20;       ApprovalEngine.ts

&#x20;       ApprovalRequest.ts

&#x20;       ApprovalDecision.ts

&#x20;       ApprovalPolicy.ts

&#x20;       ApprovalEvidence.ts

```

The Approval package remains independent of Runtime, Verification, and Storage.

\---

\# Alternatives Considered

\## Approval Inside Policy Engine

Rejected because policy evaluation determines whether approval is required, while human approval records a human decision.

Keeping these responsibilities separate improves clarity and auditability.

\---

\## Approval Inside Runtime

Rejected because approval is a domain capability rather than an orchestration concern.

The Runtime invokes the approval stage but does not own approval logic.

\---

\## Approval Inside Verification

Rejected because verification evaluates completed execution rather than interacting with humans.

\---

\# Compatibility

This RFC is backward compatible.

Implementations that do not require human approval continue to operate unchanged.

The HumanApprovalStage is optional and configurable.

\---

\# Open Questions

\* Should delegated approvals be supported?

\* Should approval delegation be time-limited?

\* Should approval chains support organizational hierarchies?

\* Should cryptographic signatures be required for approval decisions?

\* Should approval evidence support external attestations?

\---

\# Acceptance Criteria

\* A `HumanApprovalStage` exists.

\* Immutable Approval objects are defined.

\* Approval decisions become append-only evidence.

\* Runtime supports optional approval gates.

\* Replay reproduces historical approval outcomes.

\* Verification validates approval evidence without requesting new approvals.

\---

\# References

\* 003-EXECUTION-TRANSACTION.md

\* 010-EVIDENCE.md

\* 011-RUNTIME.md

\* 012-RUNTIME-STAGES.md

\* 013-VERIFICATION-ENGINE.md

\* 014-EXECUTION-TRUST-MODEL.md

\* ADR-0002 — Immutable Domain Model

\* ADR-0003 — Verification Is Independent

\* ADR-0004 — Runtime Pipeline

\* ADR-0007 — Deterministic Execution
