[← Book Index](README.md) · [← Previous: Chapter 5, The Runtime Pipeline](05-runtime-pipeline.md)

# Chapter 6: Cryptography

`packages/crypto/src/` in full: `providers/CryptoProvider.ts`, `CanonicalSerializer.ts`,
`TrustRecordHasher.ts`, `providers/signature/{Ed25519SignatureProvider,Dilithium3SignatureProvider,assertKeyType}.ts`,
`KeyProvider.ts`, `providers/key/FileKeyProvider.ts`, `KeyExpiry.ts`, `HybridSignatureProvider.ts`.

## One interface, swappable algorithms

Every signature and hash operation in this codebase goes through one small interface:

```typescript
// packages/crypto/src/providers/CryptoProvider.ts:13-17
export interface CryptoProvider {
  readonly hash: HashProvider;
  readonly signature: SignatureProvider;
}
```

`CryptoBootstrap.create()` assembles a concrete `CryptoProvider` from configuration
(`CRYPTO_MODE`, `PRIMARY_SIGNATURE_PROVIDER`, `HASH_PROVIDER`), and every higher-level
service in this package (`AuthorizationSigner`, `ArtifactSigner`, `ReceiptCrypto`,
`ExecutionChainCrypto`, and the rest) depends on `CryptoProvider`, never on a concrete
algorithm. This is what makes the hybrid/post-quantum story below an additive capability
rather than a rewrite.

## Canonical serialization: the thing every hash and signature is actually over

`CanonicalSerializer` produces a deterministic byte sequence from an object. The same input
always serializes to the same bytes, independent of key insertion order, so a hash or
signature computed on the signing side and recomputed on the verifying side from
independently-constructed but logically-identical data always match. `TrustRecordHasher`
(`hash(value: unknown): Promise<string>`) is the generic hasher built on top of it, reused
directly by `RuntimeEngine` for both `policyContentHash` and `signalsHash` (Chapter 5). It
is deliberately the *same* hasher every other artifact hash in this codebase uses. There is
exactly one canonicalization-and-hash implementation, not one per artifact type, which is
what lets an independent verifier recompute any of these hashes without needing to know which
subsystem originally produced it.

## Signature providers, and the guard that keeps them from lying about themselves

```typescript
// packages/crypto/src/providers/signature/assertKeyType.ts:5-27 (abridged)
/**
 * node:crypto's sign()/verify() dispatch on the key's own
 * asymmetricKeyType, not on which SignatureProvider happens to be
 * configured. Without this check, a dilithium3-configured process
 * holding Ed25519 PEMs on disk would silently sign with Ed25519 while
 * labeling the envelope "dilithium3".
 */
export function assertKeyType(key: KeyObject, expected: string, operation: "sign" | "verify"): void {
  if (key.asymmetricKeyType !== expected) {
    throw new CryptoError(
      `${operation}() expected a "${expected}" key but received "${key.asymmetricKeyType}". ` +
      "The configured signature algorithm does not match the supplied key material.",
    );
  }
}
```

Both `Ed25519SignatureProvider` and `Dilithium3SignatureProvider` call this before touching
`node:crypto`'s `sign()`/`verify()`, on both the signing and the verifying side. The failure
mode this closes is specifically a key-rotation or algorithm-migration window: a deployment
mid-move from Ed25519 to hybrid signing could otherwise mix up which key file belongs to
which provider with no error at all, until an independently-verifying third party, using the
*correct* key/algorithm pairing, rejects a signature that was never produced the way its own
metadata claimed. Failing closed at sign time, naming both the expected and actual type,
catches the misconfiguration at the source instead of shipping a mislabeled artifact.
Tutorial 99 (`examples/tutorials/99-key-algorithm-binding-guard/run.ts`) exercises both
mismatch directions directly.

## Keys: files on disk, with an opt-in expiry/revocation layer

`FileKeyProvider` reads PEM files from a configured key directory
(`PARMANA_KEY_DIR`, default `./keys`). This is the only implemented `KeyProvider` in this
codebase today; `aws-kms`/`azure-key-vault`/`gcp-kms`/`hsm` are declared as config values with
zero implementing classes (an open item, Chapter 18). `KeyExpiryStore`/`FileKeyExpiryStore`
add an optional, additive layer on top: a small sidecar `key-expiry.json` file next to the
PEM files, keyed by `keyId`, with optional `expiresAt`/`revoked` per entry. A `keyId` absent
from the file, the default for every key today, means "no expiry, always valid," so
adopting key expiry is opt-in per key, never a breaking change for a deployment that hasn't
opted in. `EnvelopeVerifier` (Chapter 7) consults this store, when supplied, before trusting
any signature, and fails closed on a missing key, an unreadable key, or an expired/revoked
one. This is the mechanism that would let a real key-compromise incident revoke a key
immediately, rather than only by rotating it and hoping every verifier picks up the new key
in time.

## The incident this generalizes from

That last sentence isn't hypothetical. `docs/CLAIMS.md`'s own opening section, "Key
Compromise Notice," records a real one: the default signing key
(`keys/default.private.pem`/`.public.pem`) was publicly exposed in a Parmana Systems GitHub
repository prior to 2026-07-05, not this repository's own commit history, but the key
itself is compromised regardless of which repository leaked it. Every signature ever
produced by that key is void for authenticity purposes, retroactively, regardless of when the
signed artifact was created; the key pair was rotated on 2026-07-05. `FileKeyExpiryStore`
and `EnvelopeVerifier`'s key-expiry check postdate this incident and exist specifically so a
future compromise doesn't require waiting on every verifier in the field to notice a rotated
public key. A `revoked: true` entry is enough.

## Hybrid and post-quantum signing

`CRYPTO_MODE=hybrid` causes an `ExecutionTrustRecord` (Chapter 1) to be signed twice,
independently, by two different algorithms. The existing `signature` field stays the sole,
always-present, single-algorithm attestation; a populated `signatures: SignatureEntry[]`
array (only present when `schemaVersion >= 2`) is additive proof that a second algorithm also
signed the identical content. The verification rule is strict, not best-effort: a verifier
that finds `signatures` non-empty **must** require every entry to verify. A missing or
malformed entry is a rejection, never a silent fallback to `signature` alone.
`Dilithium3SignatureProvider` implements ML-DSA-65 (FIPS 204), selectable via
`PRIMARY_SIGNATURE_PROVIDER`; whether it's supported at all is a Node-version question
(`isMlDsa65Supported()`/`ML_DSA_65_SKIP_REASON` in `packages/crypto/src/support/MlDsaSupport.ts`),
which is why tests and tutorials that exercise the ML-DSA-65 path guard themselves with that
check and print a skip reason rather than failing on an older Node runtime. One property
worth remembering if you ever build tooling against this: **ML-DSA-65 signatures are
randomized, not deterministic**. Signing the same message twice with the same key produces
two different, both-valid signatures; only verification is deterministic.

---

[← Book Index](README.md) · [← Previous: Chapter 5, The Runtime Pipeline](05-runtime-pipeline.md) · [Next: Chapter 7, The Execution Authorization Envelope →](07-execution-authorization-envelope.md)
