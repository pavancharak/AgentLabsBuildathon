\# 11 – Cryptographic Architecture

Parmana protects the integrity and authenticity of every Execution Trust Record using deterministic hashing and digital signatures.

\## Architecture

```

Execution Trust Record

&#x20;       │

&#x20;       ▼

Canonical Record

&#x20;       │

&#x20;       ▼

Trust Record Hasher

&#x20;       │

&#x20;       ▼

SHA-256 Trust Record Hash

&#x20;       │

&#x20;       ▼

Ed25519 Digital Signature

&#x20;       │

&#x20;       ▼

Execution Trust Record

```

\---

\## Canonicalization

Before hashing or signing, Parmana creates a canonical representation of the Execution Trust Record.

Only immutable evidence is included.

Included:

\- Trust Record ID

\- Business Transaction ID

\- Business Transaction

\- Overrides

\- Executions

\- Created At

Excluded:

\- Verification history

\- Receipt history

\- Trust Record Hash

\- Signature

\- Updated At

This ensures cryptographic evidence remains stable while lifecycle artifacts continue to grow.

\---

\## Trust Record Hash

Parmana computes a deterministic SHA-256 hash over the canonical Trust Record.

Every verifier independently recomputes the same hash.

If any protected field changes, the recomputed hash differs and verification fails.

\---

\## Digital Signature

After hashing, Parmana signs the canonical Trust Record using an Ed25519 private key.

Verification uses the corresponding public key.

If the Trust Record is modified after signing, signature verification fails.

\---

\## Verification

Verification performs three independent checks:

1\. Integrity

&#x20; - Recompute Trust Record Hash

&#x20; - Compare with stored hash

2\. Authenticity

&#x20; - Verify Ed25519 signature

3\. Authorization Binding

&#x20; - Every APPROVED execution must contain an authorizationId

All checks execute independently and every failure is reported.

\---

\## Replay

Replay uses the same canonical representation and cryptographic verification logic.

Because replay reconstructs the same immutable evidence, verification remains deterministic.

\---

\## Security Properties

Parmana provides:

\- Deterministic verification

\- Tamper detection

\- Cryptographic authenticity

\- Immutable execution evidence

\- Replayable audit history

\- Stable signatures despite new receipts and verification events
