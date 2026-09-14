\# 06 – Retrieve an Execution Receipt

This guide demonstrates how to retrieve the signed Execution Receipt for a completed business transaction.

An Execution Receipt is cryptographically signed evidence that a business transaction completed successfully.

\---

\## Prerequisites

Complete:

\- 01 – Starting the API

\- 02 – Authentication

\- 03 – Execute a Business Transaction

\- 04 – Execute Transaction

You should have a Receipt ID similar to:

```

a677de4e-472c-4b37-8a12-4199d2510b8b

```

\---

\## Retrieve the Latest Receipt

```powershell

Invoke-RestMethod `

&#x20;   -Method GET `

&#x20;   -Uri http://localhost:3000/receipt/latest `

&#x20;   -Headers @{

&#x20;       Authorization = "Bearer my-secret-api-key"

&#x20;   }

```

\---

\## Retrieve a Specific Receipt

Replace the receipt ID with your own.

```powershell

$receiptId = "a677de4e-472c-4b37-8a12-4199d2510b8b"



Invoke-RestMethod `

&#x20;   -Method GET `

&#x20;   -Uri "http://localhost:3000/receipt/$receiptId" `

&#x20;   -Headers @{

&#x20;       Authorization = "Bearer my-secret-api-key"

&#x20;   }

```

\---

\## Expected Response

A successful request returns an Execution Receipt containing:

\- Receipt ID

\- Business Transaction ID

\- Trust Record Hash

\- Receipt Hash

\- Signature

\- Signature Algorithm

\- Issue Timestamp

Example:

```json

{

&#x20; "receiptId": "a677de4e-472c-4b37-8a12-4199d2510b8b",

&#x20; "businessTransactionId": "b9404bdf-ad2a-4dce-8001-0eacd0974200",

&#x20; "trustRecordHash": "f6b35361c5cf90fefef039c56cacafdb9cc030f0d2c1259e6eb3b565c58cc3e4",

&#x20; "receiptHash": "562410a8687a2771d2f50ae71811cff2822340c52f485cb58eed918823a67de1",

&#x20; "algorithm": "ed25519",

&#x20; "signature": "<base64 signature>",

&#x20; "issuedAt": "2026-07-18T03:59:47.535Z"

}

```

\---

\## Receipt Contents

Every Execution Receipt binds together:

\- The completed business transaction

\- The generated Execution Trust Record

\- A cryptographic hash of the Trust Record

\- A digital signature

\- The issuance timestamp

This allows independent verification of the execution evidence without re-running the transaction.

\---

\## Receipt Lifecycle

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Execution Trust Record

&#x20;       │

&#x20;       ▼

Hash

&#x20;       │

&#x20;       ▼

Digital Signature

&#x20;       │

&#x20;       ▼

Execution Receipt

```

\---

\## What This Demonstrates

Retrieving a receipt confirms that Parmana has produced a persistent, signed record of the completed execution. The receipt can be stored, shared, or verified later as evidence of what was executed and when.

\---

\## Next Guide

Continue with:

\*\*07 – Replay a Business Transaction\*\*

Replay demonstrates deterministic execution by re-evaluating a previously recorded transaction and confirming that the same inputs produce the same outcome.
