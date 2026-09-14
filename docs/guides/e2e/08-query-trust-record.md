\# 08 – Query an Execution Trust Record

This guide demonstrates how to retrieve the complete Execution Trust Record for a previously executed Business Transaction.

The current implementation retrieves Trust Records using the \*\*Business Transaction ID\*\*.

\---

\## Prerequisites

Complete:

\- 01 – Starting the API

\- 02 – Authentication

\- 03 – Execute a Business Transaction

\- 04 – Execute Transaction

\- 05 – Verify an Execution Trust Record

\- 06 – Generate an Execution Receipt

\- 07 – Replay a Business Transaction

\---

\## Business Transaction ID

Example

```

b9404bdf-ad2a-4dce-8001-0eacd0974200

```

\---

\## Retrieve the Trust Record

```powershell

Invoke-RestMethod `

&#x20;   -Method GET `

&#x20;   -Uri "http://localhost:3000/trust-records/b9404bdf-ad2a-4dce-8001-0eacd0974200" `

&#x20;   -Headers @{

&#x20;       Authorization = "Bearer my-secret-api-key"

&#x20;   } |

&#x20;   ConvertTo-Json -Depth 100

```

\---

\## Successful Response

The API returned the complete Execution Trust Record.

The response includes:

\- Trust Record metadata

\- Business Transaction

\- Intent

\- Authority

\- Authorization

\- Policy

\- Signals

\- Execution Decision

\- Connector Evidence

\- Verifications

\- Receipts

\- Cryptographic Signature

Save the response as:

```

docs/guides/e2e/trust-record-response.json

```

\---

\## Execution Trust Record Structure

```

Execution Trust Record

│

├── Transaction

│   ├── Intent

│   ├── Authority

│   ├── Authorization

│   ├── Policy

│   └── Signals

│

├── Executions

│   ├── Policy Decision

│   └── Connector Evidence

│

├── Verifications

│

├── Receipts

│

└── Cryptographic Signature

```

\---

\## What This Demonstrates

Retrieving the Trust Record confirms that Parmana permanently stores the complete execution history of a Business Transaction.

The record provides a complete audit trail including:

\- Original request

\- Policy evaluation

\- Authorization

\- Execution evidence

\- Verification history

\- Receipt history

\- Cryptographic proof

This allows an auditor to reconstruct and verify the execution without re-running the business operation.

\---

\## Implementation Note

Although the route is defined as:

```

GET /trust-records/:id

```

the current implementation expects the \*\*Business Transaction ID\*\* rather than the Trust Record ID.

\---

\## Files Used

| File | Purpose |

|------|---------|

| `docs/guides/e2e/trust-record-response.json` | Complete Execution Trust Record |

| `docs/guides/e2e/08-query-trust-record.md` | This guide |

\---

\## Next Guide

Continue with:

\*\*09 – Error Handling and Failure Scenarios\*\*

This guide demonstrates how Parmana behaves when requests are invalid, unauthorized, malformed, or reference missing transactions.
