\# 04 – Execute a Business Transaction

This guide walks through the complete execution lifecycle in Parmana—from submitting a business transaction through execution, verification, and receipt generation.

\---

\## Prerequisites

The API is running:

```text

API running on http://localhost:3000

```

Authentication is configured:

```env

PARMANA\_API\_KEYS=\[{"callerId":"demo","keyHash":"325ededd6c3b9988f623c7f964abb9b016b76b0f8b3474df0f7d7c23b941381f"}]

```

Execution connector credential is configured:

```env

VENDOR\_PAYMENT\_TOKEN=integration-test-token

```

\---

\## Execute

```powershell

$body = Get-Content .\\docs\\guides\\e2e\\execute-request.json -Raw



Invoke-RestMethod `

&#x20;   -Method POST `

&#x20;   -Uri http://localhost:3000/execute `

&#x20;   -Headers @{

&#x20;       Authorization = "Bearer my-secret-api-key"

&#x20;   } `

&#x20;   -ContentType "application/json" `

&#x20;   -Body $body

```

\---

\## Successful Response

The API returned a complete Execution Trust Record.

| Component | Status |

|-----------|--------|

| Authentication | ✅ Passed |

| Request Validation | ✅ Passed |

| Policy Evaluation | ✅ Completed |

| Execution | ✅ Completed |

| Trust Record | ✅ Created |

| Signature | ✅ Created |

| Verification | ✅ Verified |

| Receipt | ✅ Issued |

\---

\## Execution Summary

Business Transaction

```

b9404bdf-ad2a-4dce-8001-0eacd0974200

```

Trust Record

```

3280db24-fdd3-4feb-ac04-97c3b07c8c41

```

Execution

```

bf78f1c9-f007-40ab-9a14-92bc6f815f1f

```

Verification

```

999bedec-876d-4fdf-b1a3-91d01866ffcd

```

Receipt

```

a677de4e-472c-4b37-8a12-4199d2510b8b

```

\---

\## Trust Record Hash

```

f6b35361c5cf90fefef039c56cacafdb9cc030f0d2c1259e6eb3b565c58cc3e4

```

\---

\## Digital Signature

Algorithm

```

ed25519

```

The Execution Trust Record was signed successfully.

\---

\## Independent Verification

Verification Status

```

VERIFIED

```

Message

```

Execution Trust Record verified successfully.

```

This confirms that the generated Trust Record is cryptographically valid and has not been modified.

\---

\## Execution Receipt

A signed Execution Receipt was issued.

Receipt ID

```

a677de4e-472c-4b37-8a12-4199d2510b8b

```

Receipt Hash

```

562410a8687a2771d2f50ae71811cff2822340c52f485cb58eed918823a67de1

```

Algorithm

```

ed25519

```

\---

\## Execution Lifecycle

```text

Client

&#x20;  │

&#x20;  ▼

Authenticate Caller

&#x20;  │

&#x20;  ▼

Validate Request

&#x20;  │

&#x20;  ▼

Evaluate Policy

&#x20;  │

&#x20;  ▼

Authorize Execution

&#x20;  │

&#x20;  ▼

Execute Connector

&#x20;  │

&#x20;  ▼

Create Execution Trust Record

&#x20;  │

&#x20;  ▼

Sign Trust Record

&#x20;  │

&#x20;  ▼

Verify Trust Record

&#x20;  │

&#x20;  ▼

Issue Execution Receipt

```

\---

\## What This Demonstrates

This walkthrough validates the complete Parmana execution pipeline:

\- Caller authentication

\- Business transaction creation

\- Policy evaluation

\- Authorized execution

\- Connector invocation

\- Execution Trust Record generation

\- Cryptographic signing

\- Independent verification

\- Execution Receipt issuance

The returned Execution Trust Record provides verifiable evidence of what was requested, what policy authorized it, what was executed, and the cryptographic proof needed to independently validate the outcome.

\---

\## Next Guide

Continue with:

\- \*\*05 – Verify an Execution Trust Record\*\*

This guide demonstrates how to independently verify an existing Execution Trust Record using the `/verify` endpoint.
