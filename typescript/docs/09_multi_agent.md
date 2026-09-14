\# Example 09 — Multi-Agent Governance

\## Overview

Modern AI systems increasingly consist of \*\*multiple specialized agents\*\* rather than a single monolithic model.

A customer request might involve:

\* A planning agent

\* A research agent

\* A reasoning agent

\* A coding agent

\* A validation agent

\* An execution agent

While these agents collaborate to complete a business objective, organizations still require confidence that the overall workflow is:

\* Authorized

\* Governed by policy

\* Deterministic

\* Replayable

\* Independently verifiable

\* Fully auditable

Parmana provides this governance by recording the entire multi-agent workflow as a single immutable \*\*Execution Trust Record\*\*.

This guide demonstrates how coordinated AI agents operate under a shared trust chain using the TypeScript SDK.

\---

\# Learning Objectives

After completing this guide you will understand:

\* Why multi-agent systems require governance

\* How multiple agents share one Business Transaction

\* How agent outputs become execution evidence

\* How replay reproduces coordinated workflows

\* How auditing spans every participating agent

\---

\# Why Multi-Agent Systems Need Governance

Large AI applications rarely rely on a single model.

Typical workflows include:

\* Planning

\* Information retrieval

\* Tool execution

\* Validation

\* Report generation

\* Human approval

\* Final execution

Each agent performs a different responsibility, but the organization still owns one business decision.

Parmana governs the entire workflow rather than each agent independently.

\---

\# Multi-Agent Execution Trust Chain

```text id="0vru8q"

Authority

&#x20;     │

Authorization

&#x20;     │

Business Intent

&#x20;     │

PolicyReference

&#x20;     │

BusinessTransaction

&#x20;     │

Planner Agent

&#x20;     │

Research Agent

&#x20;     │

Execution Agent

&#x20;     │

Policy Evaluation

&#x20;     │

Decision

&#x20;     │

Execution

&#x20;     │

Execution Evidence

&#x20;     │

Receipt

&#x20;     │

Execution Trust Record

```

Every participating agent contributes evidence to the same immutable trust chain.

\---

\# Example Scenario

A customer support platform receives a request.

Three AI agents collaborate:

1\. Planner Agent creates a workflow.

2\. Research Agent retrieves customer history.

3\. Execution Agent prepares the response.

Parmana governs the workflow as one Business Transaction.

\---

\# Authority

Authority identifies the organization responsible for the workflow.

Example:

```typescript id="m1bknr"

const authority = {

&#x20;   authorityId: "authority-001",

&#x20;   authorityName: "Acme AI Operations"

};

```

Authority establishes organizational ownership.

\---

\# Authorization

Authorization grants permission to execute coordinated AI workflows.

Example:

```typescript id="m83t9n"

permissions: \[

&#x20;   "EXECUTE\_MULTI\_AGENT\_WORKFLOW"

]

```

Authorization defines what the agent platform may do.

\---

\# Business Intent

Intent records the requested business objective.

Example:

```typescript id="4k3txk"

operation:

&#x20;   "HANDLE\_CUSTOMER\_REQUEST"



target:

&#x20;   "customer-1001"

```

Intent belongs to the overall workflow—not to any individual agent.

\---

\# Policy Reference

Every workflow specifies exactly one policy.

Example:

```typescript id="3f7zyv"

policyName:

&#x20;   "multi-agent-governance-policy"



policyVersion:

&#x20;   "1.0.0"

```

Every participating agent operates under the same governing policy.

\---

\# Participating Agents

In this example three specialized agents contribute.

\### Planner Agent

Responsible for:

\* Workflow planning

\* Task sequencing

\* Dependency analysis

Example output:

```text id="pm7v0x"

Workflow generated

```

\---

\### Research Agent

Responsible for:

\* Retrieving customer history

\* Collecting supporting information

\* Preparing execution context

Example output:

```text id="h0fqyj"

Customer history retrieved

```

\---

\### Execution Agent

Responsible for:

\* Producing the final business action

\* Preparing the customer response

\* Completing execution

Example output:

```text id="rjlwmr"

Support response prepared

```

\---

\# Runtime Signals

Policy evaluation considers recorded runtime signals.

Example:

```typescript id="if4e7h"

signals: {



&#x20;   plannerCompleted: true,



&#x20;   researchCompleted: true,



&#x20;   executionCompleted: true,



&#x20;   safetyChecksPassed: true,



&#x20;   confidence: 0.97



}

```

These signals become part of deterministic replay.

\---

\# Decision

The Runtime evaluates the shared policy.

Example:

```text id="4gyotn"

Decision



APPROVED

```

The Decision records:

\* Outcome

\* Reason

\* Runtime signals

\* Policy version

\* Evaluation timestamp

The decision governs the entire workflow rather than an individual agent.

\---

\# Execution Evidence

Execution Evidence records each participating agent.

Example:

```typescript id="mrrjlwm"

{



&#x20;   planner: {



&#x20;       agent: "PlannerAgent",



&#x20;       result:

&#x20;           "Workflow generated"



&#x20;   },



&#x20;   research: {



&#x20;       agent: "ResearchAgent",



&#x20;       result:

&#x20;           "Customer history retrieved"



&#x20;   },



&#x20;   execution: {



&#x20;       agent: "ExecutionAgent",



&#x20;       result:

&#x20;           "Support response prepared"



&#x20;   }



}

```

Evidence preserves the contribution of every agent.

\---

\# Receipt

Successful execution produces a cryptographic Receipt.

Example:

```text id="rm3rwb"

Receipt ID



receipt-001



Algorithm



Ed25519

```

The receipt proves that the governed workflow completed successfully.

\---

\# Execution Trust Record

Every workflow artifact becomes part of the immutable Execution Trust Record.

```text id="tt9nka"

Business Transaction



Decision



Execution



Evidence



Receipt



Verification



Replay

```

This single record represents the authoritative history of the coordinated AI workflow.

\---

\# Replay

Replay reconstructs the original workflow.

Replay restores:

\* Original Business Transaction

\* Original PolicyReference

\* Original runtime signals

\* Original agent outputs

\* Original decision

Replay never invokes current AI models.

Historical replay uses the recorded execution artifacts.

\---

\# Verification

Verification confirms:

\* Trust Record integrity

\* Receipt integrity

\* Hash consistency

\* Artifact consistency

Verification demonstrates that the recorded workflow remains authentic.

\---

\# Auditing

An auditor can later determine:

\* Which organization initiated the workflow

\* Which policy governed execution

\* Which agents participated

\* Which runtime signals existed

\* Which decision was produced

\* Which evidence each agent generated

\* Whether execution completed successfully

The complete workflow becomes independently explainable.

\---

\# Benefits

Execution authorization provides:

\* Cross-agent accountability

\* Explainable AI workflows

\* Deterministic replay

\* Independent verification

\* Regulatory evidence

\* Enterprise auditability

Parmana governs the execution of coordinated AI systems without dictating how the agents collaborate internally.

\---

\# Complete Workflow

```text id="vjlwm9"

Customer Request

&#x20;       │

Business Transaction

&#x20;       │

Planner Agent

&#x20;       │

Research Agent

&#x20;       │

Execution Agent

&#x20;       │

Policy Evaluation

&#x20;       │

Decision

&#x20;       │

Execution

&#x20;       │

Receipt

&#x20;       │

Verification

&#x20;       │

Replay

&#x20;       │

Audit

```

Every stage contributes to the immutable trust chain.

\---

\# Complete Example

See:

```text id="e9tsyz"

examples/09\_multi\_agent.ts

```

for the complete TypeScript implementation.

\---

\# Architectural Principles

Multi-agent governance follows the same Parmana architecture used across every domain:

\* Explicit Authority

\* Explicit Authorization

\* Explicit Intent

\* Explicit PolicyReference

\* Deterministic Policy Evaluation

\* Shared BusinessTransaction

\* Immutable Decision

\* Recorded Agent Evidence

\* Independent Verification

\* Deterministic Replay

The number of AI agents may increase, but the trust architecture remains unchanged.

\---

\# Relationship to Other Examples

This example demonstrates that Parmana governs workflows rather than individual AI models.

| Example | Focus |

| ------- | ------------------------- |

| 06 | Autonomous Systems |

| 07 | Clinical AI |

| 08 | Financial Governance |

| 10 | Explicit Policy Selection |

All domains use the same immutable Execution Trust Chain.

\---

\# Summary

In this guide you learned how Parmana governs coordinated AI systems by recording:

\* Authority

\* Authorization

\* Business Intent

\* PolicyReference

\* Participating Agents

\* Runtime Signals

\* Decision

\* Execution

\* Agent Evidence

\* Receipt

\* Execution Trust Record

This architecture enables organizations to build sophisticated multi-agent systems while preserving transparency, determinism, replayability, and independent verification.

\---

\# Next

Continue with:

```text

docs/10\_custom\_policy.md

```

to learn how explicit `PolicyReference` selection guarantees deterministic policy evaluation by ensuring that every Business Transaction specifies the exact policy name and version to be executed, eliminating runtime policy discovery and preserving reproducible execution.
