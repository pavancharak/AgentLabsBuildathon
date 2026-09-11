import { createPublicKey } from "node:crypto";

import type { ExecutionTrustRecord, SignatureEntry } from "@parmana/shared";

import {
  canonicalExecutionTrustRecord,
  hybridCanonicalExecutionTrustRecord,
} from "./ExecutionTrustRecordCanonicalView.js";
import { SHA256HashProvider } from "./providers/hash/SHA256HashProvider.js";
import { Ed25519SignatureProvider } from "./providers/signature/Ed25519SignatureProvider.js";
import { Dilithium3SignatureProvider } from "./providers/signature/Dilithium3SignatureProvider.js";
import type { SignatureProvider } from "./providers/SignatureProvider.js";
import { SignatureVerifier } from "./SignatureVerifier.js";
import { TrustRecordHasher } from "./TrustRecordHasher.js";

/**
 * Standalone, offline verification of an Execution Trust Record
 * (PQC audit RED-1, docs/VERIFICATION-GAPS.md).
 *
 * Zero network calls, zero disk reads, zero environment variables.
 * Callers supply the exact public key material for every keyId a
 * record references; everything else this module needs
 * (CanonicalSerializer, the canonical Execution Trust Record field
 * mapping, the Ed25519/ML-DSA-65 SignatureProvider implementations)
 * is the same code the real, online VerificationCrypto uses --
 * ExecutionTrustRecordCanonicalView.ts is shared between them so there
 * is exactly one definition of "which fields participate in the
 * signature," not two implementations that could silently drift apart.
 *
 * This is the reference this repository's own VerificationCrypto is
 * built on; @parmana/sign (github.com/pavancharak/parmana-sign, a
 * real, separately published, independently maintained package --
 * see docs/CLAIMS.md 3.12) ships the lower-level primitives
 * (canonical serialization, Ed25519/ML-DSA-65 sign/verify) this module
 * also builds on, but does not yet know the Execution-Trust-Record-
 * specific canonical field mapping, or the `signatures`/`schemaVersion`
 * hybrid envelope shape -- syncing that into @parmana/sign itself is
 * separate, external work, not something this repository's build can
 * do on its own.
 */

/**
 * Registry of the signature algorithms this module can actually
 * verify. Deliberately the same two this repository's
 * SignatureRegistry (CryptoBootstrap.ts) registers -- "ecdsa-p256",
 * "dilithium5", and "sphincs-plus" are declared as valid
 * PRIMARY_SIGNATURE_PROVIDER config values elsewhere in this codebase
 * but have no real implementation anywhere (see CODEBASE-REFERENCE.md);
 * an offline verifier claiming to support them would be worse than
 * refusing outright.
 */
function signatureProviderFor(
  algorithm: string,
): SignatureProvider | undefined {
  switch (algorithm) {
    case "ed25519":
      return new Ed25519SignatureProvider();
    case "dilithium3":
      return new Dilithium3SignatureProvider();
    default:
      return undefined;
  }
}

export interface OfflineVerificationResult {
  /**
   * Overall result: hash matches, the legacy signature verifies, and
   * -- only when the record carries a `signatures` array at all --
   * every entry in it also verifies. `false` on any error (missing
   * key, unsupported algorithm, malformed input) as well as any
   * cryptographic failure; see `errors` for which.
   */
  readonly valid: boolean;

  /**
   * Whether the record's own `trustRecordHash` matches a fresh hash
   * of its canonical content. Recomputed using SHA-256 -- the only
   * hash algorithm this codebase actually implements today (sha3-512/
   * blake3 are declared config values with no real provider); a
   * record hashed under a different algorithm cannot be distinguished
   * from a tampered one by this check alone, since the algorithm used
   * is not itself recorded on the artifact.
   */
  readonly hashValid: boolean;

  /**
   * Whether the always-present legacy `signature` field verifies.
   */
  readonly legacySignatureValid: boolean;

  /**
   * Whether the hybrid `signatures` array verifies -- present only
   * when the record actually carries one. `undefined` means "this
   * record has no `signatures` array to check," not "it failed."
   * Mirrors VerificationCrypto.verifySignature()'s own "absent means
   * not covered" semantics, deliberately: this function reports facts
   * about what is present, it does not enforce a policy about what
   * *should* be present (the equivalent of the online verifier's
   * HYBRID_SIGNATURE_REQUIRED flag is a decision for the caller to
   * make from this result, not something an offline, stateless
   * function can decide on the record's own say-so).
   */
  readonly hybridSignaturesValid?: boolean;

  /**
   * Every algorithm identifier this call actually attempted to
   * verify, legacy and hybrid combined, in the order checked.
   */
  readonly algorithmsChecked: readonly string[];

  /**
   * Human-readable reasons for any check that failed or could not be
   * attempted (missing key material for a keyId, an unsupported
   * algorithm, a malformed `signatures` array). Empty when `valid` is
   * true.
   */
  readonly errors: readonly string[];
}

/**
 * `publicKeys` maps keyId -> PEM-encoded public key (SPKI). Supply an
 * entry for every keyId the record's `signature.keyId` and (if
 * present) each `signatures[].keyId` reference -- typically fetched
 * once from a key-discovery endpoint (see the `/keys` and
 * `/.well-known/jwks.json` routes) and cached by the caller, not
 * re-fetched per verification.
 */
export async function verifyExecutionTrustRecordOffline(
  trustRecord: ExecutionTrustRecord,
  publicKeys: Readonly<Record<string, string>>,
): Promise<OfflineVerificationResult> {
  const errors: string[] = [];
  const algorithmsChecked: string[] = [];

  const hasher = new TrustRecordHasher({
    hash: new SHA256HashProvider(),
    signature: new Ed25519SignatureProvider(),
  });

  const expectedHash = await hasher.hash(
    canonicalExecutionTrustRecord(trustRecord),
  );

  const hashValid = expectedHash === trustRecord.trustRecordHash;

  if (!hashValid) {
    errors.push(
      `trustRecordHash mismatch: expected ${expectedHash}, got ${trustRecord.trustRecordHash}.`,
    );
  }

  const legacySignatureValid = await verifyOneEntry(
    {
      algorithm: trustRecord.signature.algorithm,
      keyId: trustRecord.signature.keyId,
      signature: trustRecord.signature.value,
    },
    canonicalExecutionTrustRecord(trustRecord),
    publicKeys,
    algorithmsChecked,
    errors,
  );

  let hybridSignaturesValid: boolean | undefined;

  if (trustRecord.signatures !== undefined && trustRecord.signatures.length > 0) {
    const schemaVersion = trustRecord.schemaVersion ?? 2;
    const hybridArtifact = hybridCanonicalExecutionTrustRecord(
      trustRecord,
      schemaVersion,
    );

    const seenAlgorithms = new Set<string>();
    let allValid = trustRecord.signatures.length >= 2;

    if (!allValid) {
      errors.push(
        `signatures array has ${trustRecord.signatures.length} entr${trustRecord.signatures.length === 1 ? "y" : "ies"}, need at least 2 for a hybrid record.`,
      );
    }

    for (const entry of trustRecord.signatures) {
      if (seenAlgorithms.has(entry.algorithm)) {
        errors.push(`duplicate algorithm in signatures array: ${entry.algorithm}.`);
        allValid = false;
        continue;
      }

      seenAlgorithms.add(entry.algorithm);

      const entryValid = await verifyOneEntry(
        entry,
        hybridArtifact,
        publicKeys,
        algorithmsChecked,
        errors,
      );

      allValid = allValid && entryValid;
    }

    hybridSignaturesValid = allValid;
  }

  const valid =
    hashValid &&
    legacySignatureValid &&
    (hybridSignaturesValid ?? true);

  return {
    valid,
    hashValid,
    legacySignatureValid,
    ...(hybridSignaturesValid !== undefined ? { hybridSignaturesValid } : {}),
    algorithmsChecked,
    errors,
  };
}

async function verifyOneEntry(
  entry: Pick<SignatureEntry, "algorithm" | "keyId" | "signature">,
  artifact: unknown,
  publicKeys: Readonly<Record<string, string>>,
  algorithmsChecked: string[],
  errors: string[],
): Promise<boolean> {
  const signatureProvider = signatureProviderFor(entry.algorithm);

  if (!signatureProvider) {
    errors.push(`unsupported algorithm: ${entry.algorithm}.`);
    return false;
  }

  const publicKeyPem = publicKeys[entry.keyId];

  if (!publicKeyPem) {
    errors.push(`no public key supplied for keyId "${entry.keyId}".`);
    return false;
  }

  algorithmsChecked.push(entry.algorithm);

  try {
    const publicKey = createPublicKey(publicKeyPem);

    const verifier = new SignatureVerifier({
      hash: new SHA256HashProvider(),
      signature: signatureProvider,
    });

    const verified = await verifier.verify(
      artifact,
      entry.signature,
      publicKey,
    );

    if (!verified) {
      errors.push(
        `signature verification failed for keyId "${entry.keyId}" (${entry.algorithm}).`,
      );
    }

    return verified;
  } catch (error) {
    errors.push(
      `error verifying keyId "${entry.keyId}" (${entry.algorithm}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    return false;
  }
}
