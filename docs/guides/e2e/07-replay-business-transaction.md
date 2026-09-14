\# 07 – Replay a Business Transaction

This guide demonstrates how to replay a previously executed Business Transaction.

Replay reconstructs the Execution Trust Record from the stored transaction and validates that Parmana can deterministically reproduce the recorded execution.

\---

\## Prerequisites

Complete:

\- 01 – Starting the API

\- 02 – Authentication

\- 03 – Execute a Business Transaction

\- 04 – Execute Transaction

\- 05 – Verify an Execution Trust Record

\- 06 – Generate an Execution Receipt

Use the Business Transaction ID returned during execution.

Example:

```

b9404bdf-ad2a-4dce-8001-0eacd0974200

```

\---

\## Request File

```

docs/guides/e2e/replay-request.json

```

```json

{

&#x20; "businessTransactionId": "b9404bdf-ad2a-4dce-8001-0eacd0974200"

}

```

\---

\## Replay

```powershell

$body = Get-Content .\\docs\\guides\\e2e\\replay-request.json -Raw



Invoke-RestMethod `

&#x20;   -Method POST `

&#x20;   -Uri http://localhost:3000/replay `

&#x20;   -Headers @{

&#x20;       Authorization = "Bearer my-secret-api-key"

&#x20;   } `

&#x20;   -ContentType "application/json" `

&#x20;   -Body $body

```

\---

\## Successful Response

The API returned:

```json

{

&#x20; "businessTransactionId": "b9404bdf-ad2a-4dce-8001-0eacd0974200",

&#x20; "trustRecordHash": "f6b35361c5cf90fefef039c56cacafdb9cc030f0d2c1259e6eb3b565c58cc3e4",

&#x20; "verified": true

}

```

The complete response is also available in:

```

docs/guides/e2e/replay-response.json

```

\---

\## Replay Summary

| Property | Value |

|----------|-------|

| Business Transaction ID | b9404bdf-ad2a-4dce-8001-0eacd0974200 |

| Trust Record Hash | f6b35361c5cf90fefef039c56cacafdb9cc030f0d2c1259e6eb3b565c58cc3e4 |

| Verified | \*\*true\*\* |

\---

\## What This Validates

Replay confirms that Parmana successfully:

\- Located the stored Business Transaction.

\- Reconstructed the corresponding Execution Trust Record.

\- Recomputed the Trust Record Hash.

\- Verified that the reconstructed Trust Record matches the stored evidence.

A successful replay demonstrates deterministic reconstruction of execution evidence without invoking external connectors or re-executing the original business operation.

\## What Replay Validates

Replay confirms that Parmana can reconstruct the execution using the stored Business Transaction and its associated evidence.

A successful replay demonstrates that:

\- The Business Transaction exists.

\- The associated Execution Trust Record can be reconstructed.

\- Stored evidence is sufficient for deterministic replay.

\- The execution history remains auditable.

Replay does \*\*not\*\* execute external connectors again. It reconstructs and validates the recorded execution.

\---

\## Replay Lifecycle

```text

Business Transaction

&#x20;       │

&#x20;       ▼

Load Stored Evidence

&#x20;       │

&#x20;       ▼

Reconstruct Execution

&#x20;       │

&#x20;       ▼

Replay Result

```

\---

\## Files Used

| File | Purpose |

|------|---------|

| `docs/guides/e2e/replay-request.json` | Replay request |

| `docs/guides/e2e/replay-response.json` | Replay response |

| `docs/guides/e2e/07-replay-business-transaction.md` | This guide |

\---

\## Next Guide

Continue with:

\*\*08 – Query Stored Trust Records\*\*
