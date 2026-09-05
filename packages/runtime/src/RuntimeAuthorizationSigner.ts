import {
  AuthorizationSigner,
  CryptoBootstrap,
  DEFAULT_KEY_ID,
  FileKeyProvider,
} from "@parmana/crypto";

import type {
  ExecutableContent,
  SignedExecutionAuthorization,
} from "@parmana/shared";

/**
 * Runtime Authorization Signer.
 *
 * Signs Execution Authorizations using the same
 * CryptoProvider and key-loading mechanism already
 * used to sign Execution Trust Records and Receipts
 * (CryptoBootstrap + FileKeyProvider, keyId "default").
 */
export class RuntimeAuthorizationSigner {
  private static readonly KEY_ID = DEFAULT_KEY_ID;

  private readonly crypto =
    CryptoBootstrap.create();

  private readonly keys =
    new FileKeyProvider();

  private readonly signer =
    new AuthorizationSigner(this.crypto);

  /**
   * Signs an authorization payload.
   */
  async sign(
    input: {
      readonly decisionId: string;
      readonly businessTransactionId: string;
      readonly policyName: string;
      readonly policyVersion: string;
      readonly policyContentHash?: string;
      readonly signalsHash?: string;
      readonly executableContent: ExecutableContent;
    },
    ttlSeconds: number,
  ): Promise<SignedExecutionAuthorization> {
    const privateKey =
      await this.keys.getPrivateKey(
        RuntimeAuthorizationSigner.KEY_ID,
      );

    return this.signer.sign(
      input,
      privateKey,
      RuntimeAuthorizationSigner.KEY_ID,
      ttlSeconds,
    );
  }
}
