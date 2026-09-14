# 06 – Generate an Execution Receipt

This guide demonstrates how to generate an Execution Receipt for a completed Business Transaction.

An Execution Receipt is a cryptographically signed artifact that provides verifiable evidence of a completed and verified execution.

---

## Prerequisites

Complete the following guides before proceeding:

- 01 – Starting the API
- 02 – Authentication
- 03 – Execute a Business Transaction
- 04 – Execute Transaction

Ensure you have a completed Business Transaction.

Example:

```
Business Transaction ID

b9404bdf-ad2a-4dce-8001-0eacd0974200
```

---

## Request File

```
docs/guides/e2e/receipt-request.json
```

```json
{
  "businessTransactionId": "b9404bdf-ad2a-4dce-8001-0eacd0974200"
}
```

---

## Generate Receipt

```powershell
$body = Get-Content .\docs\guides\e2e\receipt-request.json -Raw

Invoke-RestMethod `
    -Method POST `
    -Uri http://localhost:3000/receipt `
    -Headers @{
        Authorization = "Bearer my-secret-api-key"
    } `
    -ContentType "application/json" `
    -Body $body
```

---

## Successful Response

The API returned the following receipt.

```json
{
  "receiptId": "6f1e7586-ae5d-4718-8d06-36aa541bdb8b",
  "businessTransactionId": "b9404bdf-ad2a-4dce-8001-0eacd0974200",
  "trustRecordHash": "f6b35361c5cf90fefef039c56cacafdb9cc030f0d2c1259e6eb3b565c58cc3e4",
  "receiptHash": "bd1280f038f0e9257b86f006fb023d90ae1f00d0b9f12451c72bf7d06c469ac6",
  "issuedAt": "2026-07-18T04:05:47.378Z",
  "algorithm": "ed25519",
  "signature": "r4+YxAtVIL7BHJhEr5bPZSq1lvAKf50C3umPmIrMwfb9wAGks5Oxs4A+Ohae/6H7qddb3QxTvxcNtVR4Uo75CQ=="
}
```

The complete response is also available in:

```
docs/guides/e2e/receipt-response.json
```

---

## Receipt Summary

| Property                | Value                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| Receipt ID              | 6f1e7586-ae5d-4718-8d06-36aa541bdb8b                             |
| Business Transaction ID | b9404bdf-ad2a-4dce-8001-0eacd0974200                             |
| Trust Record Hash       | f6b35361c5cf90fefef039c56cacafdb9cc030f0d2c1259e6eb3b565c58cc3e4 |
| Receipt Hash            | bd1280f038f0e9257b86f006fb023d90ae1f00d0b9f12451c72bf7d06c469ac6 |
| Signature Algorithm     | Ed25519                                                          |
| Status                  | Receipt Generated                                                |

---

## Receipt Lifecycle

```text
Business Transaction
        │
        ▼
Execution Trust Record
        │
        ▼
Verification
        │
        ▼
Receipt Generation
        │
        ▼
Receipt Hash
        │
        ▼
Digital Signature
        │
        ▼
Execution Receipt
```

---

## What This Validates

Generating an Execution Receipt confirms that Parmana successfully:

- Located the completed Business Transaction.
- Retrieved the associated Execution Trust Record.
- Generated a deterministic Receipt Hash.
- Signed the receipt using the configured signature provider.
- Returned a portable cryptographic artifact that can be independently verified.

The receipt serves as verifiable evidence that the execution completed successfully and is suitable for audit, compliance, and long-term record keeping.

---

## Files Used

| File                                               | Purpose             |
| -------------------------------------------------- | ------------------- |
| `docs/guides/e2e/receipt-request.json`             | Request payload     |
| `docs/guides/e2e/receipt-response.json`            | Successful response |
| `docs/guides/e2e/06-generate-execution-receipt.md` | This guide          |

---

## Next Guide

Continue with:

**07 – Replay a Business Transaction**

The next guide demonstrates deterministic replay of a previously executed Business Transaction to confirm that identical inputs produce identical authorization and execution outcomes.
