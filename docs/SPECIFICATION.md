\# Parmana Specification

Version: 1.0

Status: Normative

\---

\# Purpose

This specification defines the normative behavior of the Parmana Execution Trust Infrastructure.

Any implementation claiming compatibility with Parmana should conform to this specification.

Normative keywords such as \*\*MUST\*\*, \*\*MUST NOT\*\*, \*\*SHOULD\*\*, \*\*SHOULD NOT\*\*, and \*\*MAY\*\* are used as defined by RFC 2119.

\---

\# Scope

This specification defines:

\* canonical execution model

\* trust chain

\* business transaction model

\* policy selection

\* policy evaluation

\* runtime execution

\* execution evidence

\* verification

\* replay

This specification does not define:

\* business policies

\* authentication systems

\* identity providers

\* workflow orchestration

\* AI models

\---

\# Canonical Trust Chain

A conforming implementation MUST model execution using the following trust chain.

```text

Authority

&#x20;   ↓

Authorization

&#x20;   ↓

Intent

&#x20;   ↓

Business Transaction

&#x20;   ↓

Policy Reference

&#x20;   ↓

Policy

&#x20;   ↓

Decision

&#x20;   ↓

Execution

&#x20;   ↓

Execution Trust Record

&#x20;   ↓

Receipt

&#x20;   ↓

Verification

&#x20;   ↓

Replay

```

Each artifact MUST be explicitly linked to its predecessor.

\---

\# Business Transaction

A Business Transaction MUST include:

\* Business Transaction identifier

\* Transaction metadata

\* Authority

\* Authorization

\* Intent

\* Policy Reference

\* Runtime signals

\* Status

\* Creation timestamp

The Business Transaction SHALL be treated as immutable after acceptance.

\---

\# Trust Relationships

A conforming implementation MUST enforce the following relationships.

\* Authorization.authorityId MUST equal Authority.authorityId.

\* Intent.authorizationId MUST equal Authorization.authorizationId.

\* BusinessTransaction.businessTransactionId MUST equal Metadata.businessTransactionId.

\* PolicyReference MUST identify exactly one policy.

\---

\# Policy Selection

Policy selection MUST be deterministic.

The runtime:

\* MUST load the policy explicitly referenced by the Business Transaction.

\* MUST validate policy identity and version.

\* MUST NOT discover policies.

\* MUST NOT automatically select the latest version.

\* MUST NOT substitute a different policy.

\---

\# Policy Evaluation

Policy evaluation MUST be deterministic.

The implementation:

\* MUST evaluate rules sequentially.

\* MUST stop at the first matching rule.

\* MUST record the matched rule.

\* MUST record the decision reason.

\* MUST record the evaluation trace.

For identical policy inputs and runtime signals, evaluation SHOULD produce the same decision outcome, excluding intentionally variable runtime metadata such as timestamps or generated identifiers.

\---

\# Runtime Execution

Execution MUST occur only after:

\* trust validation

\* policy evaluation

\* approved decision

Execution MUST NOT occur when the decision outcome is not approved.

\---

\# Execution Trust Record

Every successful execution MUST produce an Execution Trust Record.

The Trust Record MUST include:

\* Business Transaction

\* Execution

\* Overrides (if any)

\* Verification artifacts

\* Receipts

\* Canonical Trust Record hash

The Trust Record SHALL be treated as immutable evidence.

\---

\# Receipt

Every Receipt MUST include:

\* Trust Record reference

\* Cryptographic signature

\* Signature algorithm

Receipts MUST be verifiable independently of the runtime.

\---

\# Verification

A conforming implementation MUST support verification of execution evidence.

Verification MUST confirm the integrity of the supplied execution artifacts.

Verification MUST NOT modify execution evidence.

\---

\# Replay

Replay SHOULD support re-evaluation of previously recorded execution.

Replay SHOULD detect differences between the recorded execution and the replayed execution.

Replay MUST NOT modify historical evidence.

\---

\# Architectural Constraints

A conforming implementation:

\* MUST separate policy evaluation from runtime execution.

\* MUST separate execution from verification.

\* MUST separate verification from replay.

\* MUST preserve immutable execution evidence.

\---

\# Security Requirements

Implementations SHOULD:

\* use canonical serialization for hashing

\* use cryptographically secure hashing algorithms

\* use digital signatures for receipts

\* validate execution integrity before verification

Specific cryptographic algorithms are implementation choices unless otherwise specified.

\---

\# Conformance

An implementation conforms to this specification when it:

\* implements the required trust chain

\* satisfies the documented guarantees

\* passes the conformance test suite

\* produces verifiable execution evidence

Conformance requirements are further defined in `CONFORMANCE.md`.

\---

\# Related Documents

\* VISION.md

\* ARCHITECTURE.md

\* GOVERNANCE.md

\* CLAIMS.md

\* GUARANTEES.md

\* PROOFS.md

\* SECURITY.md

\* CONFORMANCE.md
