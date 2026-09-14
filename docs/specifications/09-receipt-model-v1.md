\# Receipt Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

A \*\*Receipt\*\* is a compact, cryptographically verifiable representation of an Execution Trust Record.

The Receipt provides portable proof that Parmana processed a Business Transaction and produced an Execution Trust Record.

Receipts are intended for:

\* Sharing

\* Auditing

\* Long-term storage

\* Independent verification

The Receipt is \*\*not\*\* the Execution Trust Record.

\---

\# Scope

This specification defines:

\* Receipt purpose

\* Receipt generation

\* Receipt contents

\* Receipt guarantees

\* Relationship to the Execution Trust Record

\* Relationship to Verification

This specification does \*\*not\*\* define:

\* Verification

\* Policy Evaluation

\* Execution

\* Trust Chain

\---

\# Receipt Generation

A Receipt is generated after an Execution reaches a terminal state.

Terminal states:

\* `COMPLETED`

\* `FAILED`

Exactly one Receipt is generated for each Execution.

\---

\# Receipt Flow

```text id="t6pyfv"

Business Transaction



&#x20;       │



&#x20;       ▼



Execution



&#x20;       │



&#x20;       ▼



Execution Trust Record



&#x20;       │



&#x20;       ▼



Receipt

```

The Receipt is always derived from the Execution Trust Record.

\---

\# Receipt Object

Canonical structure:

```json id="6ps2db"

{

&#x20; "receipt": {

&#x20;   "receiptId": "RCT-000001",

&#x20;   "businessTransactionId": "PAY-1001",

&#x20;   "executionId": "EXEC-0001",

&#x20;   "executionTrustRecordId": "ETR-000001",

&#x20;   "policy": {

&#x20;     "name": "payment-approval",

&#x20;     "version": "2.1.0",

&#x20;     "schemaVersion": "1.0"

&#x20;   },

&#x20;   "decision": "APPROVED",

&#x20;   "executionOutcome": "COMPLETED",

&#x20;   "issuedAt": "2026-06-26T12:00:00Z",

&#x20;   "executionTrustRecordHash": "...",

&#x20;   "signature": "...",

&#x20;   "receiptVersion": "1.0"

&#x20; }

}

```

\---

\# Required Fields

Every Receipt SHALL contain:

\* receiptId

\* businessTransactionId

\* executionId

\* executionTrustRecordId

\* policy

\* decision

\* executionOutcome

\* issuedAt

\* executionTrustRecordHash

\* signature

\* receiptVersion

\---

\# Receipt Guarantees

A valid Receipt guarantees that:

\* Parmana processed the identified Business Transaction.

\* Parmana created the referenced Execution Trust Record.

\* The Receipt corresponds to that exact Execution Trust Record.

\* The Receipt has not been modified since issuance.

\* The Receipt can be independently verified using Parmana's public verification key.

\---

\# Receipt Does Not Guarantee

A Receipt does \*\*not\*\* guarantee:

\* That the business decision was correct.

\* That the business policy was appropriate.

\* That execution succeeded (a Receipt may represent a failed Execution).

\* That external systems behaved correctly.

The Receipt guarantees only the integrity and authenticity of Parmana's recorded trust artifacts.

\---

\# Cryptographic Integrity

Every Receipt is cryptographically protected.

Generation flow:

```text id="rtm87t"

Execution Trust Record



&#x20;       │



&#x20;       ▼



Canonical Serialization



&#x20;       │



&#x20;       ▼



Hash



&#x20;       │



&#x20;       ▼



Digital Signature



&#x20;       │



&#x20;       ▼



Receipt

```

The signature enables independent verification without requiring access to Parmana.

\---

\# Independent Verification

Any verifier possessing Parmana's public verification key can:

\* Validate the Receipt signature.

\* Validate the Receipt integrity.

\* Confirm that the Receipt corresponds to the referenced Execution Trust Record.

Independent verification does not require re-executing the Business Transaction.

\---

\# Relationship to the Execution Trust Record

The Execution Trust Record is the authoritative source.

The Receipt is a compact representation derived from it.

```text id="3jptb2"

Execution Trust Record



&#x20;       │



&#x20;       ▼



Receipt

```

The Receipt never replaces the Execution Trust Record.

\---

\# Relationship to Verification

Verification validates:

\* Receipt integrity.

\* Receipt signature.

\* Receipt linkage to the Execution Trust Record.

Verification does not regenerate Receipts.

\---

\# Receipt Immutability

Receipts are immutable.

Once issued:

\* Contents cannot be modified.

\* Signature cannot be regenerated.

\* Receipt cannot be replaced.

If a new Execution occurs, a new Receipt is generated for that Execution.

\---

\# Canonical Principles

\## Principle 1

The Receipt is a portable trust artifact.

\---

\## Principle 2

Every Receipt is derived from exactly one Execution Trust Record.

\---

\## Principle 3

Every Execution has exactly one Receipt.

\---

\## Principle 4

Receipts are cryptographically signed.

\---

\## Principle 5

Receipts are independently verifiable.

\---

\## Principle 6

Receipts are immutable.

\---

\## Principle 7

Receipts never replace the Execution Trust Record.

\---

\# Canonical Model

```text id="h3srwo"

Business Transaction



&#x20;       │



&#x20;       ▼



Execution



&#x20;       │



&#x20;       ▼



Execution Trust Record



&#x20;       │



&#x20;       ▼



Receipt



&#x20;       │



&#x20;       ▼



Independent Verification

```

\---

\# Summary

The Receipt Model defines the portable, cryptographically verifiable artifact issued by Parmana after an Execution reaches a terminal state.

A Receipt provides compact proof that Parmana processed a specific Business Transaction, produced an Execution Trust Record, and protected that record with cryptographic integrity.

By separating the Receipt from the Execution Trust Record, Parmana enables secure sharing, long-term retention, and independent verification without exposing the complete internal trust record.
