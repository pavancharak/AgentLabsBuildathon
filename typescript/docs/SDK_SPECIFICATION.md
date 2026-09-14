Parmana SDK Specification v1.0

Purpose

The Parmana SDK provides the canonical developer interface for interacting with the Parmana Execution Trust Infrastructure.

The SDK abstracts the internal implementation of Parmana and exposes a stable, product-oriented API.

The SDK does not expose internal runtime, policy, replay, or verification components directly.

Design Principles

One SDK, one client.

Same conceptual API across all languages.

Stable domain model.

Strong typing.

Deterministic behavior.

Language idiomatic, conceptually identical.

Thin client over the Parmana platform.

Canonical Client

ParmanaClient

Every operation starts from this client.

Canonical Operations

execute()

verify()

replay()

audit()

validatePolicy()

health()

These are the only top-level operations in v1.

Canonical Domain Models

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

No SDK-specific business models.

Error Hierarchy

ParmanaError

ValidationError

AuthorizationError

ExecutionRejectedError

VerificationError

ReplayError

ConfigurationError

NetworkError

Configuration

Configuration

Credentials

Transport

RetryPolicy

Public Surface

ParmanaClient

Configuration

Domain Models

Exceptions

Everything else is internal.

Internal Components

These must not be exposed:

RuntimeEngine

PolicyEngine

ExecutionGate

DecisionBuilder

ExecutionBuilder

RuntimePipeline

ExecutionTrustPipeline

PolicyRouter

These remain implementation details.

Language Parity

The TypeScript and Python SDKs must expose the same conceptual capabilities.

For example:

TypeScript

const client = new ParmanaClient(config);

await client.execute(transaction);

await client.verify(trustRecord);

await client.replay(request);

Python

client = ParmanaClient(config)

await client.execute(transaction)

await client.verify(trust\_record)

await client.replay(request)

The syntax may follow language conventions, but the concepts and operations remain the same.
