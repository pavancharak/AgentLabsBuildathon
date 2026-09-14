\# Tutorial 18 — Runtime Hooks

\## Overview

This tutorial demonstrates how to observe the Parmana Runtime lifecycle using Runtime Hooks.

Runtime Hooks allow developers to:

\- Log execution events

\- Measure performance

\- Export metrics

\- Send notifications

\- Integrate observability platforms

Hooks \*\*observe\*\* execution only.

They \*\*must never modify\*\* Runtime state.

If execution behavior must change, use \*\*Runtime Components\*\* instead.

\---

\## Runtime Lifecycle

```

beforePolicyLoad

&#x20;       ↓

Policy Load

&#x20;       ↓

afterPolicyLoad

&#x20;       ↓

beforePolicyEvaluation

&#x20;       ↓

Policy Evaluation

&#x20;       ↓

afterPolicyEvaluation

&#x20;       ↓

beforeDecision

&#x20;       ↓

Decision Build

&#x20;       ↓

Execution Gate

&#x20;       ↓

beforeAuthorization

&#x20;       ↓

Authorization Signing

&#x20;       ↓

afterAuthorization

&#x20;       ↓

Execution Build

&#x20;       ↓

Runtime Context

&#x20;       ↓

afterDecision

&#x20;       ↓

beforeExecution

&#x20;       ↓

Runtime Pipeline

&#x20;       ↓

afterExecution

&#x20;       ↓

beforeTrustRecord

&#x20;       ↓

Trust Pipeline

&#x20;       ↓

afterTrustRecord

&#x20;       ↓

Return

&#x20;       ↓

onRuntimeError

```

\---

\## Creating a Hook

Implement the `RuntimeHook` interface.

Example:

```ts

export class LoggingHook implements RuntimeHook {

&#x20; async beforePolicyLoad() {

&#x20;   console.log("Loading policy...");

&#x20; }

}

```

\---

\## Registering Hooks

```ts

const runtime =

&#x20; new RuntimeBuilder()

&#x20;   .addHook(new LoggingHook())

&#x20;   .addHook(new MetricsHook())

&#x20;   .build(repository);

```

Hooks execute sequentially in the order they are registered.

\---

\## Included Hooks

\### LoggingHook

Demonstrates observing every Runtime lifecycle event.

\### MetricsHook

Measures the duration of each Runtime phase.

\---

\## Running the Example

```bash

tsx examples/tutorials/18-runtime-hooks/run.ts

```

\---

\## Expected Output

```

\[Hook] Loading policy...

\[Metrics] Policy Load: 1.21 ms



\[Hook] Evaluating policy...

\[Metrics] Policy Evaluation: 0.42 ms



\[Hook] Building Decision artifact.

\[Metrics] Decision: 0.15 ms



\[Hook] Signing execution authorization.

\[Metrics] Authorization: 1.84 ms



\[Hook] Executing runtime pipeline.

\[Metrics] Runtime Pipeline: 2.08 ms



\[Hook] Building Execution Trust Record.

\[Metrics] Trust Pipeline: 0.76 ms

```

\---

\## Runtime Hooks vs Runtime Components

| Runtime Hooks | Runtime Components |

|---------------|--------------------|

| Observe execution | Modify execution |

| Logging | Signal enrichment |

| Metrics | Context transformation |

| Tracing | Validation |

| Notifications | Policy-aware processing |

| Auditing | Runtime customization |

\---

\## Summary

Runtime Hooks provide a safe, extensible mechanism for observing the complete Parmana Runtime lifecycle without affecting deterministic execution.
