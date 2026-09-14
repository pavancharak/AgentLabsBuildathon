\\# Example 02 — Verify Receipt

\\## Overview

After a Business Transaction has been executed, Parmana produces cryptographic artifacts that allow the execution to be independently verified.

This example demonstrates how to verify an Execution Trust Record using the TypeScript SDK.

Verification is a core capability of Parmana because it allows a third party to determine whether an execution occurred exactly as recorded, without relying on trust in the executing application.

\\---

\\# Learning Objectives

After completing this guide you will understand:

\\\* Why verification exists

\\\* The purpose of a Receipt

\\\* The purpose of a Verification artifact

\\\* How to verify an Execution Trust Record

\\\* How verification differs from execution

\\\* How verification supports independent audit

\\---

\\# Prerequisites

Before completing this example you should understand:

\\\* Authority

\\\* Authorization

\\\* Intent

\\\* PolicyReference

\\\* BusinessTransaction

If not, complete:

```text



docs/01\\\_basic\\\_execution.md



```

first.

\\---

\\# Why Verification?

Execution answers:

> Did the system perform the requested operation?

Verification answers:

> Can someone independently prove that the recorded execution is authentic and internally consistent?

Execution and verification are intentionally separate activities.

\\---

\\# Execution Trust Chain

Verification operates on an existing Execution Trust Record.

```text



Authority



\&#x20;     │



Authorization



\&#x20;     │



Intent



\&#x20;     │



PolicyReference



\&#x20;     │



BusinessTransaction



\&#x20;     │



Decision



\&#x20;     │



Execution



\&#x20;     │



Execution Evidence



\&#x20;     │



Receipt



\&#x20;     │



Execution Trust Record



\&#x20;     │



Verification



```

Verification never modifies the trust chain.

It produces another immutable trust artifact.

\\---

\\# What Is Verified?

The verification process examines the complete trust chain, including:

\\\* Business Transaction identifiers

\\\* Authority

\\\* Authorization

\\\* Intent

\\\* Policy Reference

\\\* Decision

\\\* Execution

\\\* Execution Evidence

\\\* Trust Record Hash

\\\* Receipt integrity

Every component contributes to the verification result.

\\---

\\# Creating the Client

```typescript



import { ParmanaClient } from "@parmana/typescript-sdk";







const client = new ParmanaClient({



\&#x20;   endpoint: "http://localhost:8080",



});



```

\\---

\\# Loading the Trust Record

Normally the Runtime or storage layer returns an `ExecutionTrustRecord`.

```typescript
const trustRecord = getExecutionTrustRecord();
```

For the SDK example, a placeholder trust record is used.

\\---

\\# Verify the Trust Record

Verification requires only one call.

```typescript



const verification =



\&#x20;   await client.verify(trustRecord);



```

The SDK sends the trust record to the Parmana Runtime, which performs deterministic verification.

\\---

\\# Verification Result

A successful verification returns a `Verification` object.

```typescript



console.log(



\&#x20;   verification.verificationId



);







console.log(



\&#x20;   verification.status



);







console.log(



\&#x20;   verification.verifiedAt



);



```

Typical output:

```text



Verification ID







verification-001







Status







VERIFIED







Verified







2026-06-29T12:54:17Z



```

\\---

\\# Internal Verification Process

Although the SDK exposes a single method, the Runtime performs multiple validation steps.

```text



Execution Trust Record



\&#x20;       │



Validate Structure



\&#x20;       │



Validate References



\&#x20;       │



Validate Policy



\&#x20;       │



Validate Decision



\&#x20;       │



Validate Execution



\&#x20;       │



Validate Receipt



\&#x20;       │



Compute Trust Hash



\&#x20;       │



Return Verification



```

Each step is deterministic.

\\---

\\# Trust Record Hash

Every Execution Trust Record has a canonical hash.

```text



trustRecordHash



```

The verifier recomputes this value.

If the computed hash differs from the recorded hash, verification fails.

\\---

\\# Why Hashes Matter

Hashes provide tamper evidence.

Changing even one field produces a completely different digest.

For example:

```text



Original







Authority = Acme







Hash







91df6c...







Modified







Authority = Other







Hash







4af20e...



```

Verification immediately detects the modification.

\\---

\\# Verification Status

Current statuses include:

```text



VERIFIED







FAILED



```

Future versions may introduce additional diagnostic states, while preserving the deterministic verification model.

\\---

\\# Error Handling

Always handle verification failures.

```typescript



try {







\&#x20;   const verification =



\&#x20;       await client.verify(record);







}



catch(error){







\&#x20;   console.error(error);







}



```

Verification may fail because:

\\\* Runtime unavailable

\\\* Invalid trust record

\\\* Corrupted receipt

\\\* Hash mismatch

\\\* Authorization inconsistency

\\\* Missing execution artifacts

\\---

\\# Verification vs Replay

Verification confirms integrity.

Replay reproduces execution.

Verification asks:

> Is this execution authentic?

Replay asks:

> Would the same inputs produce the same outcome?

Both capabilities complement each other but serve different purposes.

\\---

\\# Independent Verification

One of Parmana's design goals is independent verification.

The verifier does not need access to:

\\\* Original application

\\\* Original source code

\\\* Original database

Only the Execution Trust Record and verification logic are required.

This separation improves transparency and auditability.

\\---

\\# Security Benefits

Verification provides:

\\\* Tamper detection

\\\* Evidence validation

\\\* Cryptographic integrity

\\\* Audit support

\\\* Regulatory compliance

\\\* Independent assurance

\\---

\\# Architectural Principles

Verification is:

\\\* Deterministic

\\\* Repeatable

\\\* Immutable

\\\* Independent

\\\* Non-destructive

It never changes the original execution artifacts.

\\---

\\# Complete Example

See:

```text



examples/02\\\_verify\\\_receipt.ts



```

for the complete implementation.

\\---

\\# Relationship to Later Examples

The remaining examples build on verification.

| Example | Additional Capability |

| ------- | --------------------- |

| 03 | Deterministic Replay |

| 04 | Trust Chain Audit |

| 05 | Human Override |

| 06 | Autonomous Vehicle |

| 07 | Medical AI |

| 08 | Financial Governance |

| 09 | Multi-Agent Systems |

| 10 | Custom Policy |

\\---

\\# Summary

In this example you learned:

\\\* Why verification exists

\\\* How to verify an Execution Trust Record

\\\* The role of the Verification artifact

\\\* The importance of trust hashes

\\\* How Parmana detects tampering

\\\* Why verification is independent of execution

Verification transforms execution evidence into independently provable evidence that can be audited, replayed, and trusted across organizational boundaries.

\\---

\\# Next

Continue with:

```text



docs/03\\\_replay\\\_execution.md



```

to learn how Parmana deterministically reproduces an execution using the immutable Execution Trust Record.
