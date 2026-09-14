\# Parmana SDK Configuration

\*\*Version:\*\* 1.0

\*\*Status:\*\* Canonical

\*\*Applies To:\*\* All Official Parmana SDKs

\---

\# 1. Purpose

This document defines the canonical configuration model for all official Parmana SDKs.

The configuration model provides a consistent mechanism for connecting SDKs to the Parmana Runtime while remaining independent of programming language.

Every official SDK MUST implement the concepts defined in this document.

\---

\# 2. Design Goals

The SDK configuration model is designed to be:

\* Simple

\* Explicit

\* Secure by default

\* Environment-independent

\* Language-independent

\* Forward compatible

\---

\# 3. Configuration Philosophy

Configuration defines \*\*how the SDK communicates with Parmana\*\*.

It does \*\*not\*\* configure:

\* policy behavior

\* runtime authorization

\* execution rules

\* verification logic

\* replay behavior

Those are runtime responsibilities.

\---

\# 4. Configuration Components

Every SDK configuration consists of the following logical components.

```text

Configuration

├── Runtime Endpoint

├── Authentication

├── Transport

├── Timeout

├── Retry Policy

├── TLS

├── Logging

└── User Agent

```

\---

\# 5. Runtime Endpoint

Every SDK MUST specify the Parmana Runtime endpoint.

Examples

```text

https://runtime.company.com



http://localhost:8080

```

The endpoint identifies the Runtime that processes SDK requests.

\---

\# 6. Authentication

Authentication identifies the calling application.

SDKs MUST support authentication independently from transport.

The authentication mechanism is implementation-specific.

Possible authentication methods include:

\* API Key

\* Bearer Token

\* Mutual TLS

\* Future enterprise authentication mechanisms

SDKs MUST NOT embed credentials in source code.

\---

\# 7. Transport

The transport layer defines how requests are sent.

Supported transports are implementation-specific.

Current transport

```text

HTTP/HTTPS

```

Future transports MAY include:

\* gRPC

\* Message Queue

\* Enterprise Connectors

Applications should not depend on transport-specific behavior.

\---

\# 8. Timeout

SDKs MUST allow configuration of request timeouts.

Timeouts SHOULD apply to:

\* connection establishment

\* request transmission

\* response reception

Timeout values are SDK implementation details.

\---

\# 9. Retry Policy

Retry behavior must be configurable.

A retry policy may define:

\* maximum attempts

\* retry interval

\* exponential backoff

\* retry conditions

SDKs SHOULD retry only transient failures.

SDKs MUST NOT retry deterministic failures such as:

\* ValidationError

\* AuthorizationError

\* ExecutionRejectedError

\---

\# 10. TLS

Secure transport SHOULD be enabled by default.

SDKs SHOULD support:

\* certificate validation

\* custom certificate authorities

\* hostname verification

SDKs MUST NOT disable TLS verification by default.

\---

\# 11. Logging

SDKs SHOULD provide configurable logging.

Logging configuration MAY include:

\* log level

\* output destination

\* structured logging

\* request identifiers

Sensitive information MUST NOT be logged.

Examples of sensitive information:

\* API keys

\* bearer tokens

\* passwords

\* private business data

\* cryptographic secrets

\---

\# 12. User Agent

SDKs SHOULD identify themselves when communicating with the Runtime.

Example

```text

Parmana-TypeScript-SDK/1.0.0

```

or

```text

Parmana-Python-SDK/1.0.0

```

The user agent assists with diagnostics and compatibility.

\---

\# 13. Environment Configuration

SDKs SHOULD support loading configuration from application environments.

Typical configuration sources include:

\* constructor parameters

\* environment variables

\* configuration files

\* dependency injection

SDKs MUST define a clear precedence order.

\---

\# 14. Default Configuration

SDKs SHOULD provide safe defaults.

Examples include:

\* secure transport enabled

\* retry disabled or conservative

\* reasonable timeout values

\* minimal logging

Applications may override defaults when necessary.

\---

\# 15. Immutable Configuration

Configuration SHOULD be immutable after the ParmanaClient has been created.

Changing configuration during active operation is discouraged.

Creating a new client instance is preferred.

\---

\# 16. Thread Safety

Configuration objects SHOULD be safe for concurrent read access.

Configuration mutation should not affect active requests.

\---

\# 17. Validation

SDKs MUST validate configuration before establishing communication with the Runtime.

Examples of validation include:

\* valid endpoint

\* supported transport

\* required authentication

\* valid timeout values

Invalid configuration MUST result in a ConfigurationError.

\---

\# 18. Language Mapping

Every official SDK exposes the same conceptual configuration model.

Example

TypeScript

```text

Configuration

```

Python

```text

Configuration

```

The implementation syntax may differ, but the concepts remain identical.

\---

\# 19. Compatibility

New configuration options MAY be introduced in future SDK versions.

Existing configuration behavior MUST remain backward compatible whenever practical.

Breaking configuration changes require a major version increment.

\---

\# 20. Conformance Requirements

An official Parmana SDK MUST:

\* expose a canonical Configuration model

\* support runtime endpoint configuration

\* support authentication configuration

\* support transport configuration

\* support timeout configuration

\* support retry configuration

\* validate configuration before use

\* provide secure defaults

\* preserve language parity

\---

\# Summary

The Parmana SDK Configuration model provides a consistent, secure, and language-independent mechanism for configuring communication between applications and the Parmana Runtime.

By separating communication concerns from runtime behavior, the SDK maintains a stable public interface while allowing the Parmana platform to evolve independently.
