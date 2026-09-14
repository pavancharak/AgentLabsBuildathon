\# Error Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

The Parmana Error Model defines the canonical structure for all API error responses.

Every API endpoint MUST return errors using this specification.

The goals are:

\* Consistency

\* Deterministic error reporting

\* Machine readability

\* Human readability

\* Predictable client behavior

\---

\# Scope

This specification defines:

\* Error response format

\* Error categories

\* HTTP status mapping

\* Error codes

\* Error handling principles

This specification does not define:

\* Individual endpoint validation rules

\* Authentication implementation

\* Business policies

\---

\# Error Response Structure

Every error response uses the following structure.

```json

{

&#x20; "error": {

&#x20;   "code": "POLICY\_NOT\_FOUND",

&#x20;   "message": "Requested policy version does not exist."

&#x20; }

}

```

\---

\# Error Object

| Field | Required | Description |

| ------- | -------- | ---------------------------------------- |

| code | Yes | Stable machine-readable error identifier |

| message | Yes | Human-readable error description |

Future versions may extend the object with additional fields while preserving backward compatibility.

\---

\# Error Categories

\## Validation Errors

Request structure or content is invalid.

Examples:

\* Missing required fields

\* Invalid schema

\* Invalid JSON

\* Invalid identifiers

\---

\## Authentication Errors

Caller identity cannot be established.

Examples:

\* Missing credentials

\* Invalid token

\* Expired token

\---

\## Authorization Errors

Caller lacks permission.

Examples:

\* Override not permitted

\* Policy publication denied

\---

\## Resource Errors

Requested resource cannot be resolved.

Examples:

\* Business Transaction not found

\* Execution not found

\* Policy not found

\* Receipt not found

\---

\## Conflict Errors

The request conflicts with existing immutable state.

Examples:

\* Duplicate Business Transaction with different payload

\* Override after terminal Execution

\* Immutable resource modification

\---

\## Verification Errors

Verification cannot establish trust.

Examples:

\* Receipt signature invalid

\* Policy mismatch

\* Corrupted Evidence

\* Execution Trust Record integrity failure

\---

\## Internal Errors

Unexpected platform failures.

Examples:

\* Database unavailable

\* Storage failure

\* Unexpected runtime exception

Internal implementation details must never be exposed to clients.

\---

\# Canonical Error Codes

\## Validation

```text

INVALID\_REQUEST



INVALID\_METADATA



INVALID\_POLICY



INVALID\_SIGNALS



INVALID\_SCHEMA

```

\---

\## Authentication

```text

UNAUTHENTICATED



INVALID\_TOKEN



TOKEN\_EXPIRED

```

\---

\## Authorization

```text

FORBIDDEN



INSUFFICIENT\_PERMISSIONS

```

\---

\## Resource

```text

BUSINESS\_TRANSACTION\_NOT\_FOUND



EXECUTION\_NOT\_FOUND



RECEIPT\_NOT\_FOUND



POLICY\_NOT\_FOUND



VERIFICATION\_NOT\_FOUND

```

\---

\## Conflict

```text

DUPLICATE\_TRANSACTION



OVERRIDE\_NOT\_ALLOWED



IMMUTABLE\_RESOURCE

```

\---

\## Verification

```text

VERIFICATION\_FAILED



INVALID\_SIGNATURE



TRUST\_RECORD\_CORRUPTED



POLICY\_MISMATCH

```

\---

\## Internal

```text

INTERNAL\_ERROR



STORAGE\_FAILURE



UNEXPECTED\_ERROR

```

\---

\# HTTP Status Mapping

| HTTP Status | Category | Example |

| ----------- | ------------------------- | --------------------- |

| 400 | Validation | INVALID\_REQUEST |

| 401 | Authentication | UNAUTHENTICATED |

| 403 | Authorization | FORBIDDEN |

| 404 | Resource | POLICY\_NOT\_FOUND |

| 409 | Conflict | DUPLICATE\_TRANSACTION |

| 422 | Verification / Validation | VERIFICATION\_FAILED |

| 500 | Internal | INTERNAL\_ERROR |

\---

\# Error Handling Rules

\## Rule 1

Every error response SHALL include both:

\* code

\* message

\---

\## Rule 2

Error codes are stable.

They are part of the public API contract and must not change between minor versions.

\---

\## Rule 3

Messages are intended for humans.

Clients should rely on the error code for programmatic behavior.

\---

\## Rule 4

Internal implementation details must never be exposed.

\---

\## Rule 5

Failed requests never partially modify immutable resources.

Either the request succeeds or no state change occurs.

\---

\# Relationship to Business Transactions

Business Transaction creation is atomic.

If any validation step fails:

\* No Business Transaction is created.

\* No Execution Trust Record is created.

\* No partial state is persisted.

\---

\# Relationship to Verification

Verification failures indicate that trust could not be established.

They do not modify the Execution Trust Record.

Verification results remain append-only.

\---

\# Canonical Principles

\## Principle 1

Every error uses the canonical Error Response structure.

\---

\## Principle 2

Error codes are stable and machine-readable.

\---

\## Principle 3

Messages are human-readable.

\---

\## Principle 4

Errors never expose internal implementation details.

\---

\## Principle 5

Failed operations preserve deterministic system state.

\---

\## Principle 6

Business Transactions are created atomically.

\---

\## Principle 7

Error semantics are consistent across all Parmana APIs.

\---

\# Canonical Model

```text

Client



&#x20;       │



HTTP Request



&#x20;       │



&#x20;       ▼



Validation



Authentication



Authorization



Business Logic



&#x20;       │



&#x20;┌──────┴──────┐



&#x20;▼             ▼



Success      Error



&#x20;               │



&#x20;               ▼



&#x20;     Canonical Error Response

```

\---

\# Summary

The Parmana Error Model provides a deterministic and uniform mechanism for reporting API failures.

By standardizing error structures, stable error codes, HTTP status mappings, and error-handling principles, Parmana enables predictable client behavior, simplifies SDK development, and ensures that failures never compromise the integrity or immutability of Business Transactions or Execution Trust Records.
