\# Tutorial 21 — Partial Failure Handling

\## Overview

This tutorial demonstrates how Parmana continues processing independent Business Transactions even when some of them fail.

Each transaction is executed independently through the Runtime. A failure in one transaction does not stop the remaining transactions from being processed.

This pattern is commonly used for:

\- Payment processing

\- Invoice processing

\- Purchase order approval

\- Financial reconciliation

\- Scheduled enterprise jobs

\- Large-scale transaction processing

\---

\## Partial Failure Handling

```

&#x20;               Runtime

&#x20;                  │

&#x20;                  ▼



Transaction 1 ─────────► APPROVED



Transaction 2 ─────────► FAILED



Transaction 3 ─────────► APPROVED



Transaction 4 ─────────► REJECTED



&#x20;                  │

&#x20;                  ▼



&#x20;            Failure Summary

```

Every Business Transaction remains isolated from the others.

\---

\## Runtime Construction

A single Runtime instance is reused throughout the batch.

```ts

const runtime =

&#x20; new RuntimeBuilder()

&#x20;   .withPolicyRepository(

&#x20;     new FilePolicyRepository("policies"),

&#x20;   )

&#x20;   .build(repository);

```

\---

\## Executing Transactions

Each transaction is executed inside its own `try/catch` block.

```ts

for (const transaction of transactions) {

&#x20; try {

&#x20;   await runtime.execute(transaction);

&#x20; } catch (error) {

&#x20;   // Record the failure and continue.

&#x20; }

}

```

This ensures the remaining transactions continue executing regardless of previous failures.

\---

\## Recording Failures

Failures are collected into a report.

```ts

failures.push({

&#x20; businessTransactionId,

&#x20; reason,

});

```

At the end of processing, a summary is generated showing both successful and failed transactions.

\---

\## Expected Output

```text

==================================================

Tutorial 21 - Partial Failure Handling

==================================================



Processing Transaction 1...

✓ APPROVED



Processing Transaction 2...

✗ Vendor not verified.



Processing Transaction 3...

✓ APPROVED



Processing Transaction 4...

✗ Payment rejected by policy.



==================================================

Summary

==================================================



Processed : 4

Succeeded : 2

Failed    : 2



Failed Transactions



• 22222222-2222-4222-8222-222222222222

&#x20; Vendor not verified.



• 44444444-4444-4444-8444-444444444444

&#x20; Payment rejected by policy.



Tutorial completed successfully.

```

\---

\## Why Continue Processing?

Enterprise workloads often contain hundreds or thousands of independent Business Transactions.

Stopping the entire batch because one transaction fails would:

\- Reduce throughput

\- Delay unrelated work

\- Increase operational overhead

Instead, each transaction is evaluated independently while failures are reported separately.

\---

\## Design Principles

Every transaction has its own:

\- Policy Evaluation

\- Decision

\- Execution

\- Authorization

\- Execution Trust Record

There is no shared execution state between transactions.

This isolation allows Parmana to provide deterministic governance while supporting resilient batch processing.

\---

\## Running the Example

```bash

tsx examples/tutorials/21-partial-failure-handling/run.ts

```

or

```bash

npm run examples

```

\---

\## Summary

In this tutorial you learned how to:

\- Process multiple independent Business Transactions

\- Continue execution after individual failures

\- Capture failure information without stopping the batch

\- Produce a clear execution summary

Partial Failure Handling is a common enterprise execution pattern that improves reliability while maintaining deterministic governance for every transaction.
