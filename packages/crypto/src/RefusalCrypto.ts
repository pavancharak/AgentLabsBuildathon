import type {
  RefusalRecord,
  Signature,
} from "@parmana/shared";

import { CryptoBootstrap } from "./CryptoBootstrap.js";
import { TrustRecordHasher } from "./TrustRecordHasher.js";
import { ArtifactSigner } from "./ArtifactSigner.js";
import { SignatureVerifier } from "./SignatureVerifier.js";
import { FileKeyProvider } from "./providers/key/FileKeyProvider.js";
import { currentVerificationKeyId } from "./KeyProvider.js";

/**
 * Refusal cryptographic operations (RFC-0021).
 *
 * Parallel to VerificationCrypto, over Refusal Records instead of
 * Execution Trust Records. Deliberately reuses the exact same
 * signing stack and DEFAULT_KEY_ID as VerificationCrypto — RFC-0021
 * §2's resolved decision is one root of trust for both approvals and
 * refusals, not a second key to manage.
 */
export class RefusalCrypto {
  private readonly crypto =
    CryptoBootstrap.create();

  private readonly keys =
    new FileKeyProvider();

  private readonly hasher =
    new TrustRecordHasher(this.crypto);

  private readonly signer =
    new ArtifactSigner(this.crypto);

  private readonly verifier =
    new SignatureVerifier(this.crypto);

  /**
   * Creates the canonical immutable view of a Refusal Record used
   * for hashing and signing. Excludes the signature itself.
   */
  private canonicalRecord(
    refusalRecord: RefusalRecord,
  ) {
    return {
      refusalRecordId:
        refusalRecord.refusalRecordId,

      businessTransactionId:
        refusalRecord.businessTransactionId,

      decision:
        refusalRecord.decision,

      evaluatedIntent:
        refusalRecord.evaluatedIntent,

      bindingViolations:
        refusalRecord.bindingViolations,

      submittedBy:
        refusalRecord.submittedBy,

      createdAt:
        refusalRecord.createdAt,
    };
  }

  /**
   * Computes the canonical Refusal Record hash.
   */
  async hash(
    refusalRecord: RefusalRecord,
  ): Promise<string> {
    return this.hasher.hash(
      this.canonicalRecord(refusalRecord),
    );
  }

  /**
   * Creates a digital signature over the canonical Refusal Record.
   */
  async sign(
    refusalRecord: RefusalRecord,
  ): Promise<Signature> {
    const keyId = currentVerificationKeyId();

    const privateKey =
      await this.keys.getPrivateKey(keyId);

    const value =
      await this.signer.sign(
        this.canonicalRecord(refusalRecord),
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
   * Verifies integrity and authenticity of a Refusal Record.
   */
  async verify(
    refusalRecord: RefusalRecord,
  ): Promise<boolean> {
    const expectedHash =
      await this.hash(refusalRecord);

    if (
      expectedHash !==
      refusalRecord.refusalRecordHash
    ) {
      return false;
    }

    const publicKey =
      await this.keys.getPublicKey(
        refusalRecord.signature.keyId,
      );

    return this.verifier.verify(
      this.canonicalRecord(refusalRecord),
      refusalRecord.signature.value,
      publicKey,
    );
  }
}
