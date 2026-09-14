\# 10 – Verification and Tamper Detection

Parmana verifies an Execution Trust Record using three independent checks.

\## Verification Pipeline

```

Execution Trust Record

&#x20;       │

&#x20;       ▼

Integrity Check

&#x20;       │

&#x20;       ▼

Signature Check

&#x20;       │

&#x20;       ▼

Authorization Binding Check

&#x20;       │

&#x20;       ▼

Verification Result

```

\## Canonical Trust Record

Parmana hashes and signs only the immutable portion of the Execution Trust Record.

Included in the canonical representation:

\- Trust Record ID

\- Business Transaction ID

\- Business Transaction

\- Overrides

\- Executions

\- Created At

Excluded from the canonical representation:

\- Verification history

\- Receipt history

\- Trust Record hash

\- Signature

\- Updated At

This design allows additional verification events and execution receipts to be appended over time without changing the cryptographically protected content of the Execution Trust Record. As a result, the original evidence remains stable while the audit history can continue to grow.

\## 1. Integrity Check

The Trust Record hash is recomputed from the stored record.

Verification fails if the recomputed hash differs from the stored `trustRecordHash`.

\## 2. Signature Check

The Ed25519 signature is verified using the configured public key.

Verification fails if the signature cannot be validated.

\## 3. Authorization Binding

Every execution whose decision is `APPROVED` must contain a valid `authorizationId`.

Rejected executions are not required to contain an authorization binding.

\## Failure Reporting

All verification checks execute independently.

Verification reports every failed check instead of stopping after the first failure.

This produces a complete verification result suitable for forensic investigation.
