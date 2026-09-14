\# RFC-0007 — Agent SDK

\*\*Status:\*\* Draft

\*\*Author:\*\* Parmana Architecture Team

\*\*Created:\*\* 2026-06-25

\*\*Target Version:\*\* 0.4.0

\---

\# Summary

Introduce an Agent SDK that enables autonomous systems to integrate with Parmana and produce verifiable execution records.

The Agent SDK provides a developer-friendly interface for recording authority, intent, authorization, execution, evidence, and verification while remaining independent of any specific AI framework or model provider.

\---

\# Motivation

Modern AI systems increasingly operate as autonomous agents capable of planning, reasoning, invoking tools, and executing actions.

Organizations require evidence that these actions:

\* Were authorized.

\* Matched the intended objective.

\* Produced immutable execution records.

\* Can be independently verified.

The Agent SDK provides this capability without replacing existing agent frameworks.

\---

\# Goals

\* Integrate with existing agent frameworks.

\* Record immutable execution transactions.

\* Preserve deterministic execution semantics.

\* Support replay and verification.

\* Provide a consistent developer experience.

\---

\# Non-Goals

This RFC does not define:

\* An LLM abstraction.

\* Prompt engineering.

\* Agent orchestration.

\* Planning algorithms.

\* Memory systems.

\* Vector databases.

\* Tool execution frameworks.

These remain the responsibility of external agent frameworks.

\---

\# Architectural Principle

The Agent SDK extends autonomous systems with Execution Trust.

It does not replace agent runtimes.

\---

\# Architecture

```text

&#x20;               AI Framework

&#x20;                      │

&#x20;                      ▼

&#x20;                Agent SDK

&#x20;                      │

&#x20;       ┌──────────────┼──────────────┐

&#x20;       ▼              ▼              ▼

&#x20;   Runtime       Verification      Replay

&#x20;                      │

&#x20;                      ▼

&#x20;            ExecutionTransaction

```

The SDK acts as an integration layer between autonomous systems and the Parmana platform.

\---

\# Responsibilities

The Agent SDK SHALL:

\* Create execution transactions.

\* Capture authority and intent.

\* Submit execution requests.

\* Record execution evidence.

\* Invoke verification.

\* Support replay integration.

The Agent SDK SHALL NOT:

\* Execute LLM inference.

\* Manage prompts.

\* Implement planning.

\* Replace orchestration frameworks.

\---

\# Agent Execution Model

A typical execution flow:

```text

Agent Request

&#x20;     │

&#x20;     ▼

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

```

The SDK records each stage as part of the execution lifecycle.

\---

\# Integration Model

The SDK MAY integrate with:

\* Single-agent systems.

\* Multi-agent systems.

\* Human-in-the-loop systems.

\* Workflow engines.

\* Custom automation platforms.

Integration occurs through stable public APIs.

\---

\# Developer API

Illustrative example:

```typescript

const sdk = new AgentSDK();



const transaction = await sdk.execute({

&#x20; authority,

&#x20; intent,

&#x20; execute: async () => {

&#x20;   return toolResult;

&#x20; }

});



const report = await sdk.verify(transaction);

```

The API emphasizes execution recording rather than agent orchestration.

\---

\# Execution Context

The SDK MAY capture contextual information such as:

\* Agent Identifier

\* Session Identifier

\* Tool Invocation Metadata

\* Runtime Configuration

\* Model Metadata

\* Correlation Identifiers

Context is recorded only when relevant to execution trust.

\---

\# Evidence

The SDK records immutable evidence, including:

\* Tool invocations.

\* Execution results.

\* Approval outcomes.

\* Policy decisions.

\* Runtime metadata.

Evidence remains append-only.

\---

\# Verification

The SDK exposes verification capabilities but does not implement verification itself.

Verification is delegated to the Verification Engine.

\---

\# Replay

The SDK MAY expose replay functionality by delegating to the Replay Engine.

Replay remains an independent subsystem.

\---

\# Framework Independence

The Agent SDK SHALL remain independent of any specific:

\* AI model.

\* LLM provider.

\* Agent framework.

\* Workflow engine.

\* Cloud provider.

Framework-specific integrations SHOULD be implemented as adapters.

\---

\# Package Mapping

```text

packages/



sdk/

&#x20;   src/

&#x20;       AgentSDK.ts

&#x20;       AgentBuilder.ts

&#x20;       ExecutionClient.ts

&#x20;       VerificationClient.ts

&#x20;       ReplayClient.ts

&#x20;       adapters/

```

Adapters provide integration with external ecosystems without changing the SDK's public contract.

\---

\# Compatibility

This RFC is backward compatible.

Existing Runtime, Verification, and Replay packages require no architectural changes.

The SDK is an additional integration layer.

\---

\# Alternatives Considered

\## Agent Framework

Rejected because Parmana's purpose is Execution Trust, not agent orchestration.

\---

\## Runtime-Coupled SDK

Rejected because coupling the SDK directly to Runtime internals would reduce portability and hinder future implementations.

\---

\## AI Provider SDK

Rejected because model providers evolve rapidly.

The SDK should remain provider-neutral and focus on execution trust.

\---

\# Open Questions

\* Should streaming tool execution be standardized?

\* Should agent capabilities be discoverable?

\* Should agent identity become a first-class domain concept?

\* Should SDK adapters be maintained within the core repository or separately?

\---

\# Acceptance Criteria

\* An `AgentSDK` abstraction exists.

\* The SDK integrates with Runtime through public APIs.

\* Execution transactions are recorded immutably.

\* Verification and Replay are exposed through client interfaces.

\* The SDK remains independent of AI frameworks and model providers.

\* Existing Core, Runtime, and Verification packages require no architectural changes.

\---

\# References

\* 003-EXECUTION-TRANSACTION.md

\* 006-API.md

\* 007-SDK.md

\* 011-RUNTIME.md

\* 013-VERIFICATION-ENGINE.md

\* 014-EXECUTION-TRUST-MODEL.md

\* ADR-0003 — Verification Is Independent

\* ADR-0004 — Runtime Pipeline

\* ADR-0007 — Deterministic Execution

\* RFC-0002 — Replay Engine

\* RFC-0003 — Human Approval
