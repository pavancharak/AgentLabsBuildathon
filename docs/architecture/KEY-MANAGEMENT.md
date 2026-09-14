\# Key Management Architecture

\## Purpose

The Key Management subsystem is responsible for the complete lifecycle of cryptographic keys used by Parmana.

It provides a single, consistent API for generating, loading, storing, rotating, and managing signing keys while keeping cryptographic operations independent of key storage.

\---

\# Design Principles

\- Algorithm agnostic

\- Provider independent

\- Secure by default

\- Extensible

\- Testable

\- No business logic

\- No policy evaluation

\- No signing logic

Key Management only manages keys.

\---

\# Responsibilities

The Key Management subsystem is responsible for:

\- generating key pairs

\- loading key pairs

\- storing key pairs

\- exporting keys

\- importing keys

\- rotating keys

\- listing keys

\- deleting keys

\- retrieving key metadata

\---

\# Non-Responsibilities

Key Management does NOT:

\- sign data

\- verify signatures

\- hash data

\- evaluate policies

\- authorize execution

These responsibilities belong elsewhere.

\---

\# Public API

\## generate()

Creates a new key pair.

Inputs

\- algorithm

\- keyId

Output

\- generated key pair

\---

\## load()

Loads an existing key pair.

Inputs

\- algorithm

\- keyId

Output

\- key pair

\---

\## save()

Persists a key pair.

Inputs

\- key pair

\- destination

Output

\- none

\---

\## export()

Exports keys to PEM.

Inputs

\- key pair

Output

\- PEM

\---

\## import()

Imports PEM.

Inputs

\- PEM

Output

\- key pair

\---

\## rotate()

\*\*Status note (2026-09-11, docs/VERIFICATION-GAPS.md gap 53):\*\* the unified `generate/load/save/export/import/rotate/list/delete` API this whole "Public API" section describes has never been implemented as such. The real `FileKeyProvider` (`packages/crypto/src/providers/key/FileKeyProvider.ts`) implements only `hasKey`, `getMetadata`, `getPrivateKey`, `getPublicKey`, and (added 2026-09-11) `listKeys()` — a flat enumeration of `*.public.pem` files, not the richer `list()` this section describes. Key generation is a separate script (`scripts/generate-keypair.ts`), not a `KeyProvider` method. There is no `save()`, `export()`, `import()`, or `delete()` anywhere in this codebase. Real key-directory layout is `<keyId>.private.pem` / `<keyId>.public.pem` (no algorithm prefix), not the `ed25519.default.private.pem` shape the "Storage Layout" section below describes.

Real rotation, as it actually exists today: `scripts/rotate-verification-key.ts` generates a new keyId's key pair (never touching or deleting an existing one), and an operator points `PARMANA_VERIFICATION_KEY_ID` (or `PARMANA_VERIFICATION_SECONDARY_KEY_ID` for the hybrid-mode secondary) at it for future signing — mirroring `PARMANA_GATEWAY_KEY_ID`'s existing precedent for the Gateway's own key. Every already-issued Trust Record, Refusal Record, or Audit Event keeps verifying unaffected, since verification always resolves the public key by the record's own stored `keyId`, never a hardcoded "current" one.

Creates a replacement key pair while preserving historical keys.

Inputs

\- algorithm

\- keyId

Output

\- new key metadata

\---

\## list()

Lists available keys.

Output

\- key metadata

\---

\## delete()

Deletes a key pair.

Inputs

\- algorithm

\- keyId

Output

\- none

\---

\# Storage Layout

```

keys/



ed25519.default.private.pem

ed25519.default.public.pem



dilithium3.default.private.pem

dilithium3.default.public.pem

```

Algorithm names are part of the filename to avoid ambiguity.

\---

\# Future Providers

The design allows additional providers without changing callers.

Examples

\- Local Files

\- AWS KMS

\- Azure Key Vault

\- Google Cloud KMS

\- HashiCorp Vault

\- HSM

\---

\# Security Requirements

\- Private keys must never be logged.

\- Private keys must never be serialized into audit records.

\- Key material should remain outside business objects.

\- Historical keys should remain available for verification.

\- Active keys must be identifiable.

\- Key rotation must not invalidate historical signatures.

\---

\# Relationship to Other Components

```

Key Management

&#x20;       │

&#x20;       ▼

KeyProvider

&#x20;       │

&#x20;       ▼

ArtifactSigner

&#x20;       │

&#x20;       ▼

SignatureVerifier

```

Key Management owns keys.

Signing components consume keys.

\---

\# Future Enhancements

\- Hardware Security Modules

\- Cloud Key Management Services

\- Automatic rotation

\- Key versioning

\- Certificate chains

\- Multi-tenant key stores

\---

\# Summary

The Key Management subsystem provides a single abstraction for the lifecycle of cryptographic keys used by Parmana.

It is responsible for managing keys, while signing, verification, hashing, and execution authorization remain separate concerns.
