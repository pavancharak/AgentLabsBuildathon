import { KeyProviders, loadConfig } from "@parmana/shared";

import { CryptoBootstrap } from "./CryptoBootstrap.js";
import type { Signer } from "./Signer.js";

import { KmsSigner } from "./providers/signer/KmsSigner.js";
import { LocalFileSigner } from "./providers/signer/LocalFileSigner.js";

/**
 * Signer Bootstrap.
 *
 * Composition root for the Signer abstraction (ADR-0009) -- the
 * signing-capable sibling of KeyBootstrap/KeyProvider. Reuses the
 * already-reserved KEY_PROVIDER=aws-kms value from
 * packages/shared/src/config/KeyProviders.ts; KeyBootstrap.ts itself
 * is unchanged (nothing in this codebase's production paths actually
 * calls it today -- every existing signing call site constructed its
 * own FileKeyProvider directly, which is exactly what this bootstrap
 * replaces).
 *
 * async, unlike KeyBootstrap.create(): resolving KmsSigner's
 * credentials may require a dynamic import of an optional peer
 * dependency (see KmsSigner.create()'s own doc comment).
 */
export class SignerBootstrap {
  private static signer: Signer | undefined;

  static async create(): Promise<Signer> {
    if (!this.signer) {
      const configuredProvider = loadConfig().keys.provider;

      if (configuredProvider === KeyProviders.LOCAL) {
        this.signer = new LocalFileSigner(CryptoBootstrap.create());
      } else if (configuredProvider === KeyProviders.AWS_KMS) {
        this.signer = await KmsSigner.create();
      } else {
        throw new Error(
          `KEY_PROVIDER=${configuredProvider} is not implemented. Only "${KeyProviders.LOCAL}" ` +
            `and "${KeyProviders.AWS_KMS}" have a real Signer implementation today. Refusing to ` +
            "start with a configured key custody model (azure-key-vault, gcp-kms, hsm) that would " +
            "silently fall back to file-based keys instead of the custody the configuration requested.",
        );
      }
    }

    return this.signer;
  }
}
