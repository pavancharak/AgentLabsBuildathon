import { loadConfig } from "@parmana/shared";
import type {
  ExecutionTrustRecord,
  Signature,
  SignatureEntry,
} from "@parmana/shared";

import { CryptoBootstrap } from "./CryptoBootstrap.js";
import { HybridSignatureProvider } from "./HybridSignatureProvider.js";
import { TrustRecordHasher } from "./TrustRecordHasher.js";
import { ArtifactSigner } from "./ArtifactSigner.js";
import { SignatureVerifier } from "./SignatureVerifier.js";
import { FileKeyProvider } from "./providers/key/FileKeyProvider.js";
import { DEFAULT_KEY_ID, DEFAULT_SECONDARY_KEY_ID } from "./KeyProvider.js";

/**
 * Schema version stamped on `signatures`-bearing records produced by
 * this class. Bumped from the implicit v1 (no `schemaVersion` field
 * at all -- today's shape) the moment a second, independent signature
 * is added alongside the legacy one (Hybrid Signature Support
 * milestone, Phase A).
 */
const HYBRID_SCHEMA_VERSION = 2;

/**
 * Verification cryptographic operations.
 *
 * Provides hashing, signing and verification
 * services for Execution Trust Records.
 */
export class VerificationCrypto {
  private readonly crypto =
    CryptoBootstrap.create();

  private readonly config =
    loadConfig();

  /**
   * File-based key provider.
   */
  private readonly keys =
    new FileKeyProvider();

  private readonly hasher =
    new TrustRecordHasher(this.crypto);

  private readonly signer =
    new ArtifactSigner(this.crypto);

  private readonly verifier =
    new SignatureVerifier(this.crypto);

  /**
   * Creates the canonical immutable view of an
   * Execution Trust Record used for hashing and
   * signing.
   *
   * Mutable lifecycle artifacts are intentionally
   * excluded so the signed content remains stable.
   *
   * `authorization` is included: unlike verifications/receipts (which
   * are produced from this record after it is sealed, and would be
   * circular to sign), the authorization is already known by the time
   * BusinessTrustRecordBuilder builds this record, so it can safely be
   * covered by the same hash/signature as transaction/overrides/
   * executions. For a record with no authorization (built before this
   * field existed, or for a transaction that never reached execution),
   * `trustRecord.authorization` is `undefined`, and CanonicalSerializer
   * (via JSON.stringify) drops an undefined-valued key entirely -- so
   * this produces byte-identical output to before this field existed,
   * and every pre-existing hash/signature keeps verifying unchanged.
   */
  private canonicalRecord(
    trustRecord: ExecutionTrustRecord,
  ) {
    return {
      trustRecordId:
        trustRecord.trustRecordId,

      businessTransactionId:
        trustRecord.businessTransactionId,

      transaction:
        trustRecord.transaction,

      authorization:
        trustRecord.authorization,

      overrides:
        trustRecord.overrides,

      executions:
        trustRecord.executions,

      createdAt:
        trustRecord.createdAt,
    };
  }

  /**
   * Canonical view signed/verified by the hybrid `signatures` array:
   * the same content as canonicalRecord(), plus schemaVersion. Kept
   * separate from canonicalRecord() itself so the legacy `signature`
   * field's signed content -- and therefore its verifiability by
   * pre-milestone verifiers, including @parmana/sign -- never changes.
   */
  private hybridCanonicalRecord(
    trustRecord: ExecutionTrustRecord,
    schemaVersion: number,
  ) {
    return {
      ...this.canonicalRecord(trustRecord),
      schemaVersion,
    };
  }

  private hybridSignatureProvider(): HybridSignatureProvider {
    return new HybridSignatureProvider(
      CryptoBootstrap.createHybrid(),
      this.keys,
    );
  }

  /**
   * Computes the canonical Trust Record hash.
   */
  async hash(
    trustRecord: ExecutionTrustRecord,
  ): Promise<string> {
    return this.hasher.hash(
      this.canonicalRecord(trustRecord),
    );
  }

  /**
   * Creates a digital signature over the canonical
   * Trust Record.
   *
   * Unchanged by hybrid mode: always the single, legacy signature,
   * over exactly the same content as before this milestone. See
   * signHybrid() for the additive second signature.
   */
  async sign(
    trustRecord: ExecutionTrustRecord,
  ): Promise<Signature> {
    const keyId = DEFAULT_KEY_ID;

    const privateKey =
      await this.keys.getPrivateKey(keyId);

    const value =
      await this.signer.sign(
        this.canonicalRecord(trustRecord),
        privateKey,
      );

    return {
      algorithm:
        this.crypto.signature.algorithm,

      keyId,

      value,

      signedAt: new Date(),
    };
  }

  /**
   * Signs the Trust Record with both configured algorithms
   * (Hybrid Signature Support milestone, Phase A). Additive:
   * callers combine this with the unchanged sign() above -- the
   * legacy `signature` field is untouched, `signatures` is new.
   *
   * Fails closed: throws if CRYPTO_MODE is not "hybrid", or if
   * SECONDARY_SIGNATURE_PROVIDER isn't configured (via
   * CryptoBootstrap.createHybrid()'s own guard), or if either key
   * file is missing (via FileKeyProvider's own guard) -- never a
   * silent partial signature.
   */
  async signHybrid(
    trustRecord: ExecutionTrustRecord,
  ): Promise<readonly SignatureEntry[]> {
    if (this.config.crypto.mode !== "hybrid") {
      throw new Error(
        "VerificationCrypto.signHybrid() requires CRYPTO_MODE=hybrid.",
      );
    }

    return this.hybridSignatureProvider().sign(
      this.hybridCanonicalRecord(
        trustRecord,
        HYBRID_SCHEMA_VERSION,
      ),
      DEFAULT_KEY_ID,
      DEFAULT_SECONDARY_KEY_ID,
    );
  }

  /**
   * Verifies only the cryptographic signature(s) of the Trust
   * Record, independent of hash comparison.
   *
   * The legacy `signature` field is always checked (unchanged
   * behavior). If `signatures` is also present and non-empty, it is
   * independently and fully verified too -- both must pass. A
   * `signatures`-bearing record with a missing or malformed entry
   * fails here even if the legacy `signature` alone is valid: never a
   * silent downgrade to single-signature verification.
   *
   * Reuses the same canonical view and verifier as verify(), so
   * callers that need to report integrity and signature failures
   * independently don't have to reimplement canonicalization.
   */
  async verifySignature(
    trustRecord: ExecutionTrustRecord,
  ): Promise<boolean> {
    const publicKey =
      await this.keys.getPublicKey(
        trustRecord.signature.keyId,
      );

    const legacyVerified =
      await this.verifier.verify(
        this.canonicalRecord(trustRecord),
        trustRecord.signature.value,
        publicKey,
      );

    if (
      trustRecord.signatures === undefined ||
      trustRecord.signatures.length === 0
    ) {
      return legacyVerified;
    }

    const hybridVerified =
      await this.hybridSignatureProvider().verify(
        this.hybridCanonicalRecord(
          trustRecord,
          trustRecord.schemaVersion ?? HYBRID_SCHEMA_VERSION,
        ),
        trustRecord.signatures,
      );

    return legacyVerified && hybridVerified;
  }

  /**
   * Verifies integrity and authenticity of the
   * Trust Record.
   */
  async verify(
    trustRecord: ExecutionTrustRecord,
  ): Promise<boolean> {
    //
    // Verify hash integrity.
    //
    const expectedHash =
      await this.hash(trustRecord);

    if (
      expectedHash !==
      trustRecord.trustRecordHash
    ) {
      return false;
    }

    //
    // Verify signature(s) -- legacy always, hybrid additionally
    // when the record declares itself hybrid-signed.
    //
    return this.verifySignature(trustRecord);
  }
}
