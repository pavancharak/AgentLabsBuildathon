\# Request Response Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

This specification defines the canonical HTTP request and response model for the Parmana API.

Every API endpoint MUST follow this specification unless explicitly documented otherwise.

The objective is to provide a predictable, deterministic, and consistent API contract across all Parmana resources.

\---

\# Scope

This specification defines:

\* Request structure

\* Response structure

\* Success responses

\* Error responses

\* Resource identifiers

\* HTTP status code usage

This specification does not define:

\* Individual endpoint schemas

\* Error codes

\* Authentication

\* OpenAPI specification

\---

\# Request Model

Every request consists of:

```text

HTTP Request



│



├── Headers



├── Path Parameters



├── Query Parameters (optional)



└── Request Body (optional)

```

\---

\# Request Headers

Every protected endpoint requires:

```http

Authorization: Bearer <token>

Content-Type: application/json

Accept: application/json

```

Additional implementation-specific headers may be supported.

\---

\# Path Parameters

Resource identifiers are always expressed as path parameters.

Example:

```http

GET /transactions/{businessTransactionId}

```

Nested resources follow the same pattern.

Example:

```http

GET /transactions/{businessTransactionId}/executions/{executionId}

```

\---

\# Query Parameters

Query parameters are optional.

They are used only for operations such as:

\* Pagination

\* Filtering

\* Sorting

Query parameters never change business semantics.

\---

\# Request Body

Endpoints that create resources use JSON request bodies.

Example:

```json

{

&#x20; "metadata": {

&#x20;   "businessTransactionId": "PAY-1001"

&#x20; },

&#x20; "policy": {

&#x20;   "name": "payment-approval",

&#x20;   "version": "2.1.0",

&#x20;   "schemaVersion": "1.0"

&#x20; },

&#x20; "signals": {

&#x20;   "amount": 5000,

&#x20;   "currency": "USD"

&#x20; }

}

```

\---

\# Success Response Model

Successful responses use the following structure.

```json

{

&#x20; "data": {

&#x20; }

}

```

The `data` object contains the resource returned by the endpoint.

\---

\# Collection Response

Collection endpoints return:

```json

{

&#x20; "data": \[

&#x20; ]

}

```

Pagination metadata may be included when applicable.

\---

\# Error Response Model

Every error response uses the following structure.

```json

{

&#x20; "error": {

&#x20;   "code": "POLICY\_NOT\_FOUND",

&#x20;   "message": "Requested policy version does not exist."

&#x20; }

}

```

The Error Model specification defines canonical error codes.

\---

\# HTTP Status Codes

The Parmana API uses standard HTTP status codes.

| Status | Meaning |

| ------ | ------------------------------- |

| 200 | Successful request |

| 201 | Resource created |

| 202 | Request accepted for processing |

| 400 | Invalid request |

| 401 | Authentication required |

| 403 | Authorization failed |

| 404 | Resource not found |

| 409 | Resource conflict |

| 422 | Validation failed |

| 500 | Internal server error |

\---

\# Resource Identifiers

Canonical identifiers include:

\* businessTransactionId

\* executionId

\* receiptId

\* executionTrustRecordId

Identifiers are immutable.

\---

\# Idempotency

Business Transaction creation is idempotent.

The `businessTransactionId` is the canonical idempotency key.

If:

\* the same identifier is submitted with identical content, the existing Business Transaction is returned.

If:

\* the payload differs, the request fails with a conflict.

\---

\# API Versioning

The API version is represented in the URL.

Example:

```text

/v1/transactions

```

Future versions introduce new API paths.

Versioning does not modify existing API behavior.

\---

\# Canonical Principles

\## Principle 1

Every endpoint follows a consistent request structure.

\---

\## Principle 2

Every successful response returns a `data` object.

\---

\## Principle 3

Every error response returns an `error` object.

\---

\## Principle 4

Resource identifiers are immutable.

\---

\## Principle 5

Business Transaction creation is idempotent.

\---

\## Principle 6

Standard HTTP semantics are used consistently.

\---

\## Principle 7

API versioning is explicit.

\---

\# Canonical Model

```text

Client



&#x20;       │



HTTP Request



&#x20;       │



&#x20;       ▼



Parmana API



&#x20;       │



&#x20;       ▼



HTTP Response



&#x20;       │



&#x20;┌──────┴──────┐



&#x20;▼             ▼



Success      Error



&#x20;│             │



&#x20;▼             ▼



data         error

```

\---

\# Summary

The Request Response Model establishes a uniform HTTP contract for the Parmana API.

By standardizing request composition, response envelopes, status codes, resource identifiers, and idempotency behavior, Parmana provides a consistent developer experience while preserving deterministic behavior across all API resources.

This specification serves as the foundation for the OpenAPI definition and all generated SDKs.
