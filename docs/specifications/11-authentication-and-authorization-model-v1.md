\# Authentication and Authorization Model v1 (Locked)

\## Status

\*\*Version:\*\* 1.0

\*\*Status:\*\* Locked

\---

\# Purpose

Authentication and Authorization define the security boundary for Parmana.

They determine:

\* Who may access Parmana.

\* Which operations an authenticated identity may perform.

Authentication and Authorization do \*\*not\*\* influence Policy Resolution, Decision generation, Execution, Replay, or Verification semantics.

They protect the platform without altering the Execution Trust Model.

\---

\# Scope

This specification defines:

\* Authentication

\* Authorization

\* Identity

\* Permission model

\* Security auditing

\* Relationship to the Execution Trust Record

This specification does \*\*not\*\* define:

\* Authentication protocol implementation

\* Identity provider integration

\* User management

\* Organization management

These are deployment-specific concerns.

\---

\# Security Boundary

Every request entering Parmana passes through the security boundary before reaching the Business Transaction pipeline.

```text

Client



&#x20;       │



&#x20;       ▼



Authentication



&#x20;       │



&#x20;       ▼



Authorization



&#x20;       │



&#x20;       ▼



Business Transaction



&#x20;       │



&#x20;       ▼



Execution Trust Pipeline

```

\---

\# Authentication

Authentication answers the question:

> \*\*Who is making this request?\*\*

Authentication produces an authenticated identity.

Parmana is authentication-mechanism agnostic.

Supported mechanisms are implementation-specific and may include:

\* JWT

\* OAuth2 Client Credentials

\* API Keys

\* Mutual TLS (mTLS)

Equivalent enterprise authentication mechanisms are also supported.

\---

\# Authenticated Identity

A successful authentication produces an identity.

Canonical model:

```text

Identity



├── identityId

├── organizationId

├── principalType

├── permissions

└── authenticationMethod

```

The authenticated identity becomes available for authorization and auditing.

\---

\# Authorization

Authorization answers the question:

> \*\*What is the authenticated identity allowed to do?\*\*

Authorization is permission-based.

Parmana does not prescribe organizational roles.

Organizations map their own roles to Parmana permissions.

\---

\# Permission Model

Canonical permissions include:

```text

transaction:create



transaction:read



execution:create



execution:read



override:create



override:read



verification:create



verification:read



receipt:read



trustchain:read



policy:read



policy:publish

```

Additional permissions may be introduced without changing the architectural model.

\---

\# Authorization Rules

\## Rule 1

Every protected operation requires successful authentication.

\---

\## Rule 2

Every authenticated request is evaluated against the required permission.

\---

\## Rule 3

Authorization failure prevents the requested operation.

No Business Transaction state is modified.

\---

\## Rule 4

Authorization decisions do not alter Policy Resolution, Decision, Execution, Replay, or Verification semantics.

\---

\# Security Auditing

Security-sensitive operations should record the authenticated identity.

Examples include:

\* Policy publication

\* Override creation

\* Verification requests

\* Administrative operations

Where applicable, the following information is recorded:

\* identityId

\* organizationId

\* timestamp

\* operation

This information supports auditability without modifying business facts.

\---

\# Relationship to Override

Overrides require:

\* Authentication

\* Authorization

The authenticated identity associated with an Override is permanently recorded.

Authorization determines \*\*who may create\*\* an Override.

The Override Model determines \*\*how the Override behaves\*\*.

\---

\# Relationship to Verification

Verification requests require authentication.

Each Verification event may record the authenticated identity initiating the verification.

Verification semantics remain unchanged regardless of the authentication mechanism.

\---

\# Relationship to the Execution Trust Record

Authentication data is \*\*not\*\* part of the immutable business facts.

However, security-relevant identities associated with actions such as Override creation or Policy publication may be recorded as audit metadata within the Execution Trust Record.

Business facts remain immutable and independent of authentication technology.

\---

\# Failure Conditions

Authentication fails when:

\* Credentials are missing.

\* Credentials are invalid.

\* Credentials have expired.

\* Identity cannot be established.

Authorization fails when:

\* Required permissions are not granted.

\* Access to the requested resource is denied.

In both cases:

\* The requested operation is rejected.

\* No Business Transaction state changes occur.

\---

\# Canonical Principles

\## Principle 1

Authentication identifies the caller.

\---

\## Principle 2

Authorization determines permitted operations.

\---

\## Principle 3

Parmana is authentication-mechanism agnostic.

\---

\## Principle 4

Authorization is permission-based.

Roles are implementation-specific.

\---

\## Principle 5

Authentication and Authorization are platform security concerns.

They do not alter the Execution Trust Model.

\---

\## Principle 6

Security-sensitive operations may record authenticated identities for audit purposes.

\---

\## Principle 7

Business facts remain independent of authentication technology.

\---

\# Canonical Model

```text

Client



&#x20;       │



&#x20;       ▼



Authentication



&#x20;       │



&#x20;       ▼



Authenticated Identity



&#x20;       │



&#x20;       ▼



Authorization



&#x20;       │



&#x20;       ▼



Business Transaction



&#x20;       │



&#x20;       ▼



Execution Trust Pipeline



&#x20;       │



&#x20;       ▼



Execution Trust Record

```

\---

\# Summary

The Authentication and Authorization Model establishes the security boundary for Parmana.

Authentication identifies callers, while Authorization determines the operations they are permitted to perform. The model is intentionally independent of any specific authentication technology, allowing organizations to integrate Parmana with existing identity providers and enterprise security infrastructure.

By separating platform security from the Execution Trust Model, Parmana ensures that authentication and authorization protect access to the platform without affecting deterministic policy evaluation, execution, replay, verification, or the integrity of the Execution Trust Record.
