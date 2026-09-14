\# Step 1 - Authentication Enforcement

\## Request

GET /

No Authorization header.

\## Result

HTTP 401

{

&#x20; "error": "authentication required"

}

\## Status

PASS

The API rejects anonymous callers before routing requests.

\# Authenticated Request

\## Request

GET /

Authorization: Bearer my-secret-api-key

\## Response

HTTP 200 OK

```json

{

&#x20; "name": "Parmana",

&#x20; "status": "UP"

}

```

\## Status

PASS

Authenticated callers can successfully access protected endpoints after caller authentication.
