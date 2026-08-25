import { randomUUID } from "node:crypto";
import type { KeyObject } from "node:crypto";

import type {
  ExecutableContent,
  ExecutionAuthorizationPayload,
  SignedExecutionAuthorization,
} from "@parmana/shared";

import { ArtifactSigner } from "./ArtifactSigner.js";
import { ExecutableContentHasher } from "./ExecutableContentHasher.js";

import type { CryptoProvider } from "./providers/CryptoProvider.js";

/**
 * Authorization Signer.
 *
 * Produces a SignedExecutionAuthorization for an
 * approved decision. Delegates all cryptography to
 * ArtifactSigner over the CanonicalSerializer, and
 * content hashing to ExecutableContentHasher (the
 * same hasher the execution gateway uses to verify).
 */
export class AuthorizationSigner {
  private readonly signer: ArtifactSigner;
  private readonly contentHasher: ExecutableContentHasher;

  constructor(
    private readonly crypto: CryptoProvider,
  ) {
    this.signer = new ArtifactSigner(crypto);
    this.contentHasher = new ExecutableContentHasher(crypto);
  }

  /**
   * Signs an authorization payload.
   *
   * The caller supplies identity fields; this
   * method supplies nonce, issue time, and
   * expiry, then signs.
   */
  async sign(
    input: {
      readonly decisionId: string;
      readonly businessTransactionId: string;
      readonly policyName: string;
      readonly policyVersion: string;
      readonly policyContentHash?: string;
      readonly executableContent: ExecutableContent;
    },
    privateKey: KeyObject,
    keyId: string,
    ttlSeconds: number,
  ): Promise<SignedExecutionAuthorization> {
    //
    // Validate TTL before computing expiry.
    //
    if (
      !Number.isFinite(ttlSeconds) ||
      ttlSeconds <= 0
    ) {
      throw new Error(
        `Invalid authorization TTL: ${ttlSeconds}`,
      );
    }

    const issuedAt = new Date();

    const expiresAt = new Date(
      issuedAt.getTime() + ttlSeconds * 1000,
    );

    const businessTransactionHash =
      await this.contentHasher.hash(
        input.executableContent,
      );

    const payload: ExecutionAuthorizationPayload = {
      version: 1,

      authorizationId: randomUUID(),

      nonce: randomUUID(),

      decisionId: input.decisionId,

      businessTransactionId:
        input.businessTransactionId,

      policyName: input.policyName,

      policyVersion: input.policyVersion,

      ...(input.policyContentHash !== undefined && {
        policyContentHash: input.policyContentHash,
      }),

      authorizedAt:
        issuedAt.toISOString(),

      expiresAt:
        expiresAt.toISOString(),

      businessTransactionHash,
    };

    const signature =
      await this.signer.sign(
        payload,
        privateKey,
      );

    return {
      payload,
      signature,
      keyId,
      algorithm:
        this.crypto.signature.algorithm,
    };
  }
}