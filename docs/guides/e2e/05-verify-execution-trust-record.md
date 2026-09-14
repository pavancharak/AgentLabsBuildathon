\# 05 – Verify an Execution Trust Record

This guide demonstrates how to independently verify an Execution Trust Record after execution.

Verification confirms that the Trust Record has not been modified since it was created and that its cryptographic signature is valid.

\---

\## Prerequisites

Complete:

\- 01 – Starting the API

\- 02 – Authentication

\- 03 – Execute a Business Transaction

You should have a Trust Record ID similar to:

```

3280db24-fdd3-4feb-ac04-97c3b07c8c41

```

\---

\## Verify

Send the Trust Record to the verification endpoint.

```powershell

$body = Get-Content .\\docs\\guides\\e2e\\verify-request.json -Raw



Invoke-RestMethod `

&#x20;   -Method POST `

&#x20;   -Uri http://localhost:3000/verify `

&#x20;   -Headers @{

&#x20;       Authorization = "Bearer my-secret-api-key"

&#x20;   } `

&#x20;   -ContentType "application/json" `

&#x20;   -Body $body

```

\---

\## Successful Response

A successful verification returns:

```json

{

&#x20; "status": "VERIFIED",

&#x20; "message": "Execution Trust Record verified successfully.",

&#x20; "verificationId": "999bedec-876d-4fdf-b1a3-91d01866ffcd",

&#x20; "verifiedAt": "2026-07-18T03:59:45.798Z",

&#x20; "trustRecordHash": "f6b35361c5cf90fefef039c56cacafdb9cc030f0d2c1259e6eb3b565c58cc3e4",

&#x20; "businessTransactionId": "b9404bdf-ad2a-4dce-8001-0eacd0974200"

}

```

\---

\## Verification Summary

| Item | Value |

|------|-------|

| Status | VERIFIED |

| Algorithm | ed25519 |

| Trust Record Hash | f6b35361c5cf90fefef039c56cacafdb9cc030f0d2c1259e6eb3b565c58cc3e4 |

| Result | Signature Valid |

\---

\## Verification Pipeline

```text

Execution Trust Record

&#x20;       │

&#x20;       ▼

Canonical Serialization

&#x20;       │

&#x20;       ▼

Hash Calculation

&#x20;       │

&#x20;       ▼

Signature Verification

&#x20;       │

&#x20;       ▼

Trust Record Validation

&#x20;       │

&#x20;       ▼

VERIFIED

```

\---

\## What Verification Confirms

Verification provides independent evidence that:

\- The Trust Record has not been altered.

\- The cryptographic signature is valid.

\- The recorded execution is authentic.

\- The evidence is suitable for audit and compliance.

Verification does not re-execute the business transaction. It validates the integrity and authenticity of the recorded execution.

\---

\## Expected Failure Cases

Verification should fail if:

\- Any field in the Trust Record is modified.

\- The Trust Record hash changes.

\- The signature is altered.

\- The signing key is unknown.

\- The signature algorithm does not match the stored signature.

These failure modes help detect tampering and protect the integrity of execution evidence.

\---

\## Next Guide

Continue with:

\*\*06 – Retrieve an Execution Receipt\*\*

This guide shows how to retrieve the signed Execution Receipt generated for a completed business transaction.
