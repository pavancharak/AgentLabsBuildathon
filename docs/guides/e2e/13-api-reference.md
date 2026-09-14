\# 13 – REST API Reference

This guide summarizes every REST endpoint exposed by the Parmana API.

\---

\# Authentication

Protected endpoints require:

```

Authorization: Bearer <API\_KEY>

```

Public endpoints:

\- GET /health

\- GET /openapi.yaml

\- GET /documentation

\---

\# Execute

\## POST /execute

Creates and executes a Business Transaction.

\### Request

```json

{

&#x20; "transaction": { ... }

}

```

\### Success

Returns:

\- Business Transaction ID

\- Trust Record ID

\- Trust Record Hash

\- Execution Result

\---

\# Verify

\## POST /verify

Verifies an existing Execution Trust Record.

\### Request

```json

{

&#x20; "businessTransactionId": "<uuid>"

}

```

\### Success

Returns:

\- Verification ID

\- Verification Status

\- Verification Message

\- Trust Record Hash

\- Verified At

\---

\# Receipt

\## POST /receipt

Generates a cryptographic execution receipt.

\### Request

```json

{

&#x20; "businessTransactionId": "<uuid>"

}

```

\### Success

Returns an Execution Receipt.

\---

\# Replay

\## POST /replay

Performs deterministic replay verification.

\### Request

```json

{

&#x20; "businessTransactionId": "<uuid>"

}

```

\### Success

Returns:

\- Business Transaction ID

\- Trust Record Hash

\- Verified

\---

\# Trust Records

\## GET /trust-records/{businessTransactionId}

Returns the complete Execution Trust Record.

\### Path Parameter

```

businessTransactionId

```

\### Success

Returns the complete immutable Trust Record.

\---

\# Health

\## GET /health

Returns API health.

Example:

```json

{

&#x20; "status": "UP"

}

```

\---

\# OpenAPI

\## GET /openapi.yaml

Returns the OpenAPI specification.

\---

\# Swagger UI

\## GET /documentation

Interactive API documentation.

\---

\# Authentication Errors

All protected endpoints return:

```json

{

&#x20; "error": "authentication required"

}

```

when authentication fails.

\---

\# Validation Errors

Typical validation failures include:

\- Missing Business Transaction ID

\- Invalid UUID

\- Missing required fields

\- Execution Trust Record not found

\---

\# Execution Flow

```text

POST /execute

&#x20;       │

&#x20;       ▼

POST /verify

&#x20;       │

&#x20;       ▼

POST /receipt

&#x20;       │

&#x20;       ▼

POST /replay

&#x20;       │

&#x20;       ▼

GET /trust-records/{businessTransactionId}

```

\---

\# Summary

The Parmana REST API exposes deterministic execution, verification, receipt generation, replay, and immutable Execution Trust Record retrieval through a small set of focused endpoints secured by Bearer authentication.
