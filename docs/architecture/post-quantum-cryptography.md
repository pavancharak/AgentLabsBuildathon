\# Post-Quantum Cryptography

\## Overview

Parmana supports both classical and post-quantum digital signatures.

Digital signatures are used to protect:

\* Execution Trust Records

\* Receipts

\* Execution Authorizations (the signed envelope forwarded to receiving systems)

The active signature algorithm is selected through configuration without changing application code, for one process at a time — see "Operational Constraint: One Provider Per Process" below.

\---

\# Supported Algorithms

| Algorithm | Type | Status |

| ---------------------- | ------------ | --------- |

| Ed25519 | Classical | Supported (default) |

| ML-DSA-65 (Dilithium3) | Post-Quantum | Supported |

ML-DSA-65 is implemented using Node's native `node:crypto` support (`generateKeyPairSync("ml-dsa-65")`, `crypto.sign`/`crypto.verify`), backed by OpenSSL >= 3.5. This requires \*\*Node >= 24\*\*. No third-party post-quantum library is used for signing or verification.

Future releases may add:

\* ML-DSA-87

\* SLH-DSA (SPHINCS+)

\---

\# Configuration

The signature provider is configured through the environment.

```dotenv

SIGNATURE\_PROVIDER=ed25519

```

or

```dotenv

SIGNATURE\_PROVIDER=dilithium3

```

No application code changes are required. Invalid values are rejected at config load time; an unset value defaults to `ed25519`.

\---

\# Architecture

```

Application

&#x20;       │

&#x20;       ▼

ReceiptCrypto / VerificationCrypto / AuthorizationSigner / AuthorizationVerifier

&#x20;       │

&#x20;       ▼

CryptoBootstrap

&#x20;       │

&#x20;       ▼

SignatureRegistry

&#x20;       │

&#x20;       ├───────────────┐

&#x20;       ▼               ▼

Ed25519SignatureProvider   Dilithium3SignatureProvider

```

Only the configured provider is used for signing and verification. `CryptoBootstrap` caches the resolved provider for the lifetime of the process — see the operational constraint below.

\---

\# Persistent Key Management

Parmana stores signing keys outside individual packages, as PEM files read by `FileKeyProvider`.

```

<keyDirectory>/

&#x20;   default.private.pem

&#x20;   default.public.pem

```

The same two filenames are used regardless of which algorithm is configured — a directory holds keys for exactly one algorithm at a time, matching whichever `SIGNATURE\_PROVIDER` produced them. `FileKeyProvider` and `node:crypto`'s `createPrivateKey`/`createPublicKey` auto-detect the key type from the PEM's own encoding (PKCS8/SPKI), so no separate raw-key format is needed for ML-DSA-65.

The directory defaults to `./keys` (resolved relative to the process's working directory) and can be overridden with:

```dotenv

PARMANA\_KEY\_DIR=/absolute/path/to/keys

```

\#\# Generating keys

Keys are \*\*not\*\* generated automatically. Use the provided script:

```bash

node ./node\_modules/tsx/dist/cli.mjs packages/crypto/scripts/generate-keypair.ts --algorithm ed25519

\# or

node ./node\_modules/tsx/dist/cli.mjs packages/crypto/scripts/generate-keypair.ts --algorithm dilithium3

```

The script refuses to overwrite an existing `default.private.pem`/`default.public.pem` pair unless `--force` is passed.

\#\# Fail-closed behavior

If `SIGNATURE\_PROVIDER` is set to an algorithm whose key files are missing at the configured key directory, `FileKeyProvider` throws rather than generating a keypair on the fly. If the key files exist but are the \*\*wrong type\*\* for the configured provider (for example, `SIGNATURE\_PROVIDER=dilithium3` pointed at a directory holding Ed25519 PEMs), signing and verification fail closed with a `CryptoError` naming both the expected and actual key type (`assertKeyType`, used by both `Ed25519SignatureProvider` and `Dilithium3SignatureProvider`) — the process never silently signs with the wrong algorithm.

This is a deliberate change from an earlier design: Parmana does \*\*not\*\* auto-generate keys on first use. A missing or mismatched key is always an error, never a silent fallback.

\---

\# Runtime Selection

The configured provider is selected through the Signature Registry.

```

SignatureRegistry



&#x20;   register(Ed25519SignatureProvider)



&#x20;   register(Dilithium3SignatureProvider)



&#x20;           │



&#x20;           ▼



config.crypto.signatureProvider (from SIGNATURE\_PROVIDER)

```

The remainder of the Parmana runtime is algorithm-independent: `AuthorizationSigner`, `ExecutionTrustRecordBuilder`, and `ReceiptCrypto` all read the active algorithm from the configured provider (`this.crypto.signature.algorithm`) rather than hardcoding it.

\---

\# Operational Constraint: One Provider Per Process

`CryptoBootstrap.create()` resolves and caches a single `CryptoProvider` for the lifetime of the process. A process is configured for exactly one signature algorithm at a time — it cannot sign or verify both Ed25519 and ML-DSA-65 authorizations simultaneously.

This has a direct consequence for cross-system verification: \*\*a signer process and a verifier process must be configured with the same `SIGNATURE\_PROVIDER` and must share the corresponding key material.\*\* `AuthorizationVerifier` does not inspect or dispatch on the envelope's own `algorithm` field — that field is informational metadata recorded in the envelope, not a routing key. A verifier configured for `ed25519` will simply fail to verify an ML-DSA-65-signed envelope (and vice versa), regardless of what the envelope's `algorithm` field says.

\---

\# Algorithm Migration Is Unsolved

Re-keying an existing deployment from one signature algorithm to another (for example, Ed25519 to ML-DSA-65) while retaining the ability to verify records signed before the switch is \*\*not currently supported\*\*. There is no mechanism for a single verifying process to hold multiple active providers, and no documented migration procedure. Treat a `SIGNATURE\_PROVIDER` change as applying only to authorizations signed after the change; previously issued authorizations and historical Trust Records signed under the old algorithm cannot be verified by a process now configured for the new one.

\---

\# Randomized Signatures (ML-DSA-65)

ML-DSA-65 signatures are randomized by design: signing the same message twice with the same private key produces two different, independently valid signatures. This is expected cryptographic behavior, not a defect. Any code or test that asserts signature determinism (comparing two signatures of identical input for equality) is valid for Ed25519 only and must not be applied to the post-quantum provider.

\---

\# Receipt Signing

Receipt generation uses the configured signature provider.

```

Receipt

&#x20;     │

&#x20;     ▼

Canonical Serialization

&#x20;     │

&#x20;     ▼

Receipt Hash

&#x20;     │

&#x20;     ▼

Configured Signature Provider

&#x20;     │

&#x20;     ▼

Digital Signature

```

Receipts also record the algorithm that produced the signature.

Example:

```json

{

&#x20; "algorithm": "dilithium3",

&#x20; "signature": "<base64>"

}

```

\---

\# Security Considerations

Private keys must never be committed to source control.

The following should be ignored by Git:

```

keys/

\*\*/keys/



\*.pem

\*.key

```

Production deployments should use a secure key management solution such as:

\* AWS KMS

\* Azure Key Vault

\* Google Cloud KMS

\* HashiCorp Vault

\* Hardware Security Modules (HSM)

The current file-based provider (`FileKeyProvider`) is intended for development and local deployments only; no KMS/HSM/cloud key vault integration exists today.

\---

\# Benefits

Post-quantum signatures provide resistance against attacks from cryptographically relevant quantum computers.

Parmana's provider-based architecture allows organizations to migrate from classical signatures to post-quantum signatures by changing configuration rather than modifying application code, \*\*for newly signed data\*\* — see "Algorithm Migration Is Unsolved" above for what this does not yet cover.
