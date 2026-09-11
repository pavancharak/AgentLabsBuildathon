import type {
  Signature,
} from "@parmana/shared";

import { CryptoBootstrap } from "./CryptoBootstrap.js";
import { ArtifactSigner } from "./ArtifactSigner.js";
import { SignatureVerifier } from "./SignatureVerifier.js";
import { FileKeyProvider } from "./providers/key/FileKeyProvider.js";
import { currentVerificationKeyId } from "./KeyProvider.js";

/**
 * Audit event cryptographic operations.
 *
 * Signs and verifies plain audit-trail events (CallerAuditEvent) with
 * the exact same signing stack and
 * DEFAULT_KEY_ID as ExecutionTrustRecord/RefusalRecord -- one root of
 * trust across every signed artifact this codebase produces, not a
 * third key.
 *
 * Deliberately simpler than VerificationCrypto/RefusalCrypto: audit
 * events are flat, complete-at-write-time objects with no appendable
 * sub-state and no separate hash-for-lookup convenience field, so
 * there is nothing to exclude from the canonical view and no reason
 * for a redundant hash() method -- the signature alone, over the
 * event's own canonical bytes, is what a caller verifies against.
 */
export class AuditEventCrypto {
  private readonly crypto =
    CryptoBootstrap.create();

  private readonly keys =
    new FileKeyProvider();

  private readonly signer =
    new ArtifactSigner(this.crypto);

  private readonly verifier =
    new SignatureVerifier(this.crypto);

  /**
   * Signs an audit event. The event is signed exactly as given --
   * callers must sign before adding any storage-only field (a
   * database-generated id, an insert timestamp) that isn't part of
   * the event itself, the same discipline VerificationCrypto's
   * canonicalRecord() already applies by excluding non-signed fields.
   */
  async sign(
    event: unknown,
  ): Promise<Signature> {
    const keyId = currentVerificationKeyId();

    const privateKey =
      await this.keys.getPrivateKey(keyId);

    const value =
      await this.signer.sign(
        event,
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
   * Verifies an audit event's signature against the event's own
   * canonical bytes. The caller supplies both -- typically fetched
   * back from storage as separate columns -- rather than this class
   * assuming any particular storage shape.
   */
  async verify(
    event: unknown,
    signature: Signature,
  ): Promise<boolean> {
    const publicKey =
      await this.keys.getPublicKey(
        signature.keyId,
      );

    return this.verifier.verify(
      event,
      signature.value,
      publicKey,
    );
  }
}
