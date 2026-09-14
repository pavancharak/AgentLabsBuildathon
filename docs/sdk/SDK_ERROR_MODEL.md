\# Parmana SDK Error Model

\*\*Version:\*\* 1.0

\*\*Status:\*\* Canonical

\*\*Applies To:\*\* All Official Parmana SDKs

\---

\# 1. Purpose

This document defines the canonical error model implemented by every official Parmana SDK.

The objective of the error model is to provide:

\* predictable behavior

\* consistent error handling

\* language-independent semantics

\* strongly typed exceptions

\* forward compatibility

Every official SDK MUST implement the concepts defined in this document.

\---

\# 2. Design Principles

The Parmana SDK error model follows these principles.

\## Strongly Typed

Applications MUST handle structured error types rather than parsing error messages.

\---

\## Deterministic

Identical failures MUST produce the same error category.

\---

\## Stable

Future SDK versions MAY introduce additional error types but MUST NOT change the meaning of existing ones.

\---

\## Product-Oriented

Errors represent failures in interacting with Parmana as a platform.

They do not expose internal implementation details.

\---

\# 3. Error Hierarchy

Every SDK MUST expose the following hierarchy.

```text

ParmanaError

│

├── ConfigurationError

├── ValidationError

├── AuthenticationError

├── AuthorizationError

├── ExecutionRejectedError

├── VerificationError

├── ReplayError

├── NetworkError

├── TimeoutError

└── InternalServerError

```

Language-specific inheritance may vary while preserving these semantics.

\---

\# 4. ParmanaError

Base class for every SDK error.

Every SDK exception MUST inherit from ParmanaError.

Required information:

\* error code

\* message

\* optional cause

\* optional request identifier

\* optional metadata

\---

\# 5. ConfigurationError

Raised when the SDK configuration is invalid.

Examples:

\* missing endpoint

\* malformed URL

\* invalid credentials

\* unsupported transport

\* invalid retry policy

Example:

```text

ConfigurationError



Invalid Runtime endpoint.

```

\---

\# 6. ValidationError

Raised before a request is sent to Parmana.

Typical causes:

\* missing required field

\* malformed request

\* invalid identifier

\* invalid schema

\* serialization failure

Examples:

```text

BusinessTransaction is missing.

```

```text

Intent identifier is invalid.

```

ValidationError represents client-side validation failures.

\---

\# 7. AuthenticationError

Raised when authentication fails.

Examples:

\* invalid API key

\* expired token

\* missing credentials

\* unsupported authentication method

AuthenticationError indicates that the client identity could not be established.

\---

\# 8. AuthorizationError

Raised when the caller lacks permission to perform an operation.

Examples:

\* insufficient privileges

\* unauthorized runtime operation

\* restricted resource

AuthorizationError concerns the caller's permissions.

It does NOT represent policy evaluation.

\---

\# 9. ExecutionRejectedError

Raised when Parmana rejects execution.

Examples:

\* Decision outcome is REJECTED

\* execution denied by policy

\* execution blocked by runtime enforcement

This is the canonical SDK representation of execution rejection.

Example:

```text

Execution rejected.



Reason:

Payment amount exceeds approval threshold.

```

\---

\# 10. VerificationError

Raised when execution verification fails.

Examples:

\* invalid trust record

\* evidence mismatch

\* receipt mismatch

\* integrity verification failure

VerificationError indicates that execution could not be independently verified.

\---

\# 11. ReplayError

Raised when deterministic replay fails.

Examples:

\* missing execution artifacts

\* replay mismatch

\* inconsistent replay state

\* unsupported replay request

ReplayError does not indicate runtime failure.

It indicates replay failure.

\---

\# 12. NetworkError

Raised when communication with the Parmana Runtime fails.

Examples:

\* DNS failure

\* TLS failure

\* connection refused

\* transport interruption

NetworkError occurs before Parmana processes the request.

\---

\# 13. TimeoutError

Raised when the configured timeout expires.

Examples:

\* request timeout

\* connection timeout

\* read timeout

TimeoutError does not imply that execution failed.

Only that the SDK did not receive a response within the configured timeout.

\---

\# 14. InternalServerError

Raised when the Parmana Runtime encounters an unexpected internal failure.

Examples:

\* unexpected runtime exception

\* unavailable subsystem

\* internal processing failure

Applications SHOULD log InternalServerError and retry only when appropriate.

\---

\# 15. Error Codes

Every SDK error SHOULD expose a stable machine-readable code.

Examples:

```text

CONFIGURATION\_ERROR



VALIDATION\_ERROR



AUTHENTICATION\_ERROR



AUTHORIZATION\_ERROR



EXECUTION\_REJECTED



VERIFICATION\_FAILED



REPLAY\_FAILED



NETWORK\_ERROR



TIMEOUT



INTERNAL\_SERVER\_ERROR

```

Error codes are stable across SDK implementations.

\---

\# 16. Error Messages

Human-readable messages:

\* SHOULD explain the failure.

\* SHOULD avoid implementation details.

\* SHOULD not expose sensitive information.

\* SHOULD remain concise.

Applications MUST NOT depend on message text.

\---

\# 17. Error Metadata

SDKs MAY include additional metadata.

Examples:

```text

requestId



traceId



executionTrustRecordId



businessTransactionId



timestamp



runtimeVersion

```

Metadata must never alter the meaning of the error.

\---

\# 18. Retry Guidance

Recommended behavior:

| Error | Retry |

| ---------------------- | ----------- |

| ConfigurationError | No |

| ValidationError | No |

| AuthenticationError | No |

| AuthorizationError | No |

| ExecutionRejectedError | No |

| VerificationError | No |

| ReplayError | No |

| NetworkError | Yes |

| TimeoutError | Yes |

| InternalServerError | Conditional |

Retries should follow the configured retry policy.

\---

\# 19. Language Mapping

Every SDK must preserve the same conceptual hierarchy.

Example:

TypeScript

```text

ParmanaError

&#x20;   ├── ValidationError

&#x20;   ├── ExecutionRejectedError

```

Python

```text

ParmanaError

&#x20;   ├── ValidationError

&#x20;   ├── ExecutionRejectedError

```

The inheritance syntax may differ.

The semantics must remain identical.

\---

\# 20. Logging

SDKs SHOULD log:

\* error code

\* request identifier

\* timestamp

SDKs SHOULD NOT log:

\* credentials

\* secrets

\* authorization tokens

\* private business data

\---

\# 21. Compatibility

New SDK versions MAY introduce additional error types.

Existing error types MUST preserve their semantics.

Existing applications must continue to function without modification.

\---

\# 22. Conformance Requirements

An official Parmana SDK MUST:

\* expose ParmanaError as the base error

\* implement the canonical error hierarchy

\* preserve canonical error semantics

\* expose stable error codes

\* avoid exposing internal runtime exceptions

\* provide structured error information

\* maintain language parity with other official SDKs

\---

\# Summary

The Parmana SDK Error Model provides a stable, language-independent framework for representing failures when interacting with the Parmana Execution Trust Infrastructure.

By exposing structured, deterministic, and strongly typed errors while hiding internal implementation details, the SDK enables applications to handle failures consistently across all official Parmana SDK implementations.
