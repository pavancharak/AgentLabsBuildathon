\# 18 – Key Management

This guide describes how Parmana manages cryptographic keys used to sign and verify Execution Trust Records.

\---

\# Overview

Parmana uses asymmetric cryptography to provide authenticity for Execution Trust Records.

The Runtime signs Trust Records using a private key, while verification uses the corresponding public key.

```

Private Key

&#x20;     │

&#x20;     ▼

Sign Trust Record

&#x20;     │

&#x20;     ▼

Execution Trust Record

&#x20;     │

&#x20;     ▼

Public Key

&#x20;     │

&#x20;     ▼

Verify Signature

```

\---

\# Key Components

The cryptographic implementation consists of:

| Component | Responsibility |

|-----------|----------------|

| FileKeyProvider | Loads cryptographic keys |

| DEFAULT\_KEY\_ID | Default signing key identifier |

| ArtifactSigner | Creates digital signatures |

| SignatureVerifier | Verifies signatures |

| VerificationCrypto | Coordinates hashing, signing, and verification |

\---

\# Signing Process

During execution:

1\. Create the canonical Trust Record.

2\. Compute the Trust Record hash.

3\. Load the private key.

4\. Sign the canonical Trust Record.

5\. Store the signature with the Trust Record.

```

Canonical Record

&#x20;       │

&#x20;       ▼

Private Key

&#x20;       │

&#x20;       ▼

Ed25519 Signature

&#x20;       │

&#x20;       ▼

Execution Trust Record

```

\---

\# Verification Process

During verification:

1\. Load the public key referenced by the Trust Record.

2\. Reconstruct the canonical Trust Record.

3\. Verify the digital signature.

4\. Report the verification result.

```

Execution Trust Record

&#x20;       │

&#x20;       ▼

Canonical Record

&#x20;       │

&#x20;       ▼

Public Key

&#x20;       │

&#x20;       ▼

Signature Verification

```

\---

\# Key Identification

Every signature includes:

\- Algorithm

\- Key ID

\- Signature Value

\- Signed Timestamp

The `keyId` identifies which public key should be used during verification.

\---

\# Development Keys

The development environment uses file-based keys loaded by the `FileKeyProvider`.

These keys are intended for:

\- Local development

\- Testing

\- Continuous Integration

They should not be used in production.

\---

\# Production Recommendations

Production deployments should replace the file-based key provider with a secure key management solution such as:

\- Hardware Security Module (HSM)

\- Cloud Key Management Service (KMS)

\- Enterprise secrets management platform

The Runtime should never expose private keys outside the signing process.

\---

\# Key Rotation

Key rotation should follow these principles:

\- Generate a new signing key pair.

\- Assign a new `keyId`.

\- Use the new private key for future signatures.

\- Retain previous public keys to verify historical Trust Records.

Historical signatures remain valid because each Trust Record references the `keyId` that was used when it was signed.

\---

\# Security Considerations

To protect signing keys:

\- Restrict filesystem access.

\- Limit key usage to the signing service.

\- Monitor key access.

\- Rotate keys periodically.

\- Back up keys securely.

\- Protect production keys with HSM or KMS.

\---

\# Trust Model

```text

Private Key

&#x20;     │

&#x20;     ▼

Sign

&#x20;     │

&#x20;     ▼

Execution Trust Record

&#x20;     │

&#x20;     ▼

Public Key

&#x20;     │

&#x20;     ▼

Verify

```

The Runtime requires the private key only for signing. Verification requires only the corresponding public key.

\---

\# Summary

Parmana separates signing and verification through asymmetric cryptography. Trust Records are signed with a private key and verified with the matching public key, enabling independent verification while supporting secure key rotation and long-term validation of historical execution evidence.
