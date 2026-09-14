\# RFC-0008: Canonical Policy Architecture

\*\*Status:\*\* Accepted

\## Purpose

This RFC defines the canonical policy architecture for Parmana.

The goal is to ensure that policy selection is deterministic, auditable, and forms part of the Execution Trust Chain.

\---

\# Problem

A runtime must never infer which policy applies by scanning all available policies.

Policy selection is an authorization decision, not a runtime decision.

Allowing the runtime to discover or choose policies would make execution dependent on runtime state rather than the trusted execution request.

\---

\# Canonical Architecture

```

Authority

&#x20;   ↓

Authorization

&#x20;   ↓

Intent

&#x20;   ↓

BusinessTransaction

&#x20;   ↓

PolicyReference

&#x20;   ↓

PolicyRouter

&#x20;   ↓

PolicyRegistry

&#x20;   ↓

PolicyEngine

&#x20;   ↓

Decision

&#x20;   ↓

Execution

```

\---

\# BusinessTransaction

The BusinessTransaction explicitly specifies the PolicyReference.

Example:

```typescript

policy: {

&#x20;   name: "vendor-payment",

&#x20;   version: "1.0.0"

}

```

The PolicyReference is part of the cryptographically verifiable execution trust chain.

\---

\# PolicyRouter

PolicyRouter has a single responsibility.

It loads the requested versioned policy from storage.

Example:

```

load(policyId, version)

```

PolicyRouter MUST NOT:

\* discover policies

\* evaluate policies

\* determine which policy applies

\* scan every policy on disk

\---

\# PolicyRegistry

PolicyRegistry maintains metadata describing available policies.

Responsibilities include:

\* registering policies

\* version lookup

\* metadata lookup

\* latest-version resolution

PolicyRegistry does not evaluate policies.

\---

\# PolicyEngine

PolicyEngine evaluates exactly one loaded policy.

Inputs:

\* Policy

\* Signals

Outputs:

\* Decision

PolicyEngine must remain deterministic.

\---

\# Runtime

Runtime must never guess which policy applies.

Runtime receives the PolicyReference from the BusinessTransaction and passes it unchanged through the execution pipeline.

\---

\# Trust Chain

The policy is part of the execution trust chain.

```

Authority

&#x20;   ↓

Authorization

&#x20;   ↓

Intent

&#x20;   ↓

PolicyReference

&#x20;   ↓

Decision

&#x20;   ↓

Execution

```

Changing the policy changes the trust chain.

\---

\# Determinism

Deterministic execution requires:

\* explicit PolicyReference

\* immutable versioned policies

\* evaluation of exactly one policy

\* no policy discovery

\* no policy guessing

\---

\# Design Principles

1\. Policy selection is an authorization decision.

2\. Policy execution is a runtime decision.

3\. PolicyRouter loads.

4\. PolicyRegistry manages.

5\. PolicyEngine evaluates.

6\. Runtime orchestrates.

7\. BusinessTransaction specifies the PolicyReference.

8\. PolicyReference is part of the trust chain.

\---

\# Architecture Lock

This architecture is locked.

Future changes may extend the policy language or storage mechanisms but must not change these responsibilities or reintroduce runtime policy discovery.
