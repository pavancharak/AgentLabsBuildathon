import {
  AuthorizationSigner,
  CryptoBootstrap,
  FileKeyProvider,
} from "@parmana/crypto";

import type {
  ExecutableContent,
  SignedExecutionAuthorization,
} from "@parmana/shared";

import {
  FileTenantKeyResolver,
  type TenantKeyResolver,
} from "./TenantKeyResolver.js";

/**
 * Runtime Authorization Signer.
 *
 * Signs Execution Authorizations using the same
 * CryptoProvider and key-loading mechanism already
 * used to sign Execution Trust Records and Receipts
 * (CryptoBootstrap + FileKeyProvider). The keyId used
 * for a given authorization is resolved per-tenant by
 * TenantKeyResolver, falling back to the shared default
 * key ("default") when no tenant-specific key has been
 * provisioned -- see TenantKeyResolver's own doc comment.
 */
export class RuntimeAuthorizationSigner {
  private readonly crypto =
    CryptoBootstrap.create();

  private readonly keys =
    new FileKeyProvider();

  private readonly signer =
    new AuthorizationSigner(this.crypto);

  private readonly keyResolver: TenantKeyResolver;

  constructor(keyResolver?: TenantKeyResolver) {
    this.keyResolver =
      keyResolver ?? new FileTenantKeyResolver(this.keys);
  }

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
      readonly submittedBy?: string;
      readonly grantedCapability?: string;
      readonly tenantId?: string;
      readonly executableContent: ExecutableContent;
    },
    ttlSeconds: number,
  ): Promise<SignedExecutionAuthorization> {
    const keyId =
      await this.keyResolver.resolveKeyId(input.tenantId);

    const privateKey =
      await this.keys.getPrivateKey(keyId);

    return this.signer.sign(
      input,
      privateKey,
      keyId,
      ttlSeconds,
    );
  }
}
