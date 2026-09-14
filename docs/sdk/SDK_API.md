\# Parmana SDK API Specification

\*\*Version:\*\* 1.0

\*\*Status:\*\* Canonical

\---

\# 1. Purpose

Defines the canonical public API implemented by every official Parmana SDK.

This specification is language-independent.

TypeScript, Python, Go, Java, .NET, and future SDKs MUST conform to this API contract.

\---

\# 2. API Design Goals

\* Simple

\* Predictable

\* Strongly Typed

\* Product-Oriented

\* Forward Compatible

\* Deterministic

\---

\# 3. Public Entry Point

Every SDK MUST expose exactly one primary client.

```text

ParmanaClient

```

All SDK operations begin from this client.

\---

\# 4. Client Lifecycle

\## Construction

Configuration

Authentication

Transport

Connection

Resource Cleanup

\---

\# 5. Canonical Operations

\## execute()

Submits a BusinessTransaction to the Parmana Runtime.

Input

BusinessTransaction

Output

ExecutionTrustRecord

\---

\## verify()

Verifies an ExecutionTrustRecord.

Input

ExecutionTrustRecord

Output

Verification

\---

\## replay()

Performs deterministic replay.

Input

ReplayRequest

Output

ReplayResult

\---

\## validatePolicy()

Validates a policy before deployment.

Input

Policy

Output

PolicyValidationResult

\---

\## health()

Checks runtime availability.

Output

HealthStatus

\---

\# 6. Domain Objects

Authority

Authorization

Intent

PolicyReference

BusinessTransaction

Decision

Execution

ExecutionEvidence

Receipt

ExecutionTrustRecord

Verification

ReplayResult

Override

\---

\# 7. Request Objects

ExecuteRequest

ReplayRequest

VerificationRequest

HealthRequest

\---

\# 8. Response Objects

ExecuteResponse

VerificationResponse

ReplayResponse

HealthResponse

\---

\# 9. Error Model

ParmanaError

ValidationError

AuthorizationError

ExecutionRejectedError

VerificationError

ReplayError

ConfigurationError

NetworkError

TimeoutError

\---

\# 10. Configuration

Runtime Endpoint

Authentication

TLS

Retry Policy

Timeout

Logging

\---

\# 11. Authentication

API Keys

Bearer Tokens

Future Authentication Methods

\---

\# 12. Thread Safety

Client Reuse

Connection Reuse

Concurrency Expectations

\---

\# 13. Serialization

JSON

RFC 3339 timestamps

UTF-8

Canonical field names

\---

\# 14. Versioning

Semantic Versioning

API Compatibility

Deprecation Policy

\---

\# 15. Conformance Requirements

Every official SDK MUST:

\* expose the canonical client

\* expose the canonical domain model

\* implement every required capability

\* preserve deterministic behavior

\* preserve API compatibility

\---

\# 16. Prohibited APIs

SDKs MUST NOT expose:

RuntimeEngine

PolicyEngine

ExecutionGate

DecisionBuilder

ExecutionBuilder

RuntimePipeline

ExecutionTrustPipeline

PolicyRouter

\---

\# 17. Future Extensions

Streaming

Async Execution

Event Notifications

Additional Authentication Methods

Additional Transports
