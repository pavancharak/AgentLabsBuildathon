\## Authentication Failure Behavior

Parmana intentionally returns the same response for both missing and invalid credentials.

| Scenario | HTTP Response |

|----------|---------------|

| Missing Bearer token | 401 `authentication required` |

| Invalid Bearer token | 401 `authentication required` |

Internally, Parmana records different audit events:

\- `missing credential`

\- `invalid credential`

This prevents information disclosure while preserving complete audit evidence.
