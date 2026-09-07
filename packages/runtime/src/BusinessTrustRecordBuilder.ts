import crypto from "node:crypto";

import { CryptoBootstrap, DEFAULT_KEY_ID, VerificationCrypto } from "@parmana/crypto";

import {
  ExecutionTrustRecord,
  loadConfig,
} from "@parmana/shared";

import { RuntimeContext } from "./context/RuntimeContext.js";

/**
 * Internal draft used during construction.
 */
type TrustRecordDraft = Omit<
  ExecutionTrustRecord,
  "trustRecordHash" | "signature"
>;

/**
 * Builds the canonical Execution Trust Record.
 */
export class BusinessTrustRecordBuilder {
  private readonly crypto =
    new VerificationCrypto();

  private readonly config =
    loadConfig();

  /**
   * Builds an immutable Execution Trust Record
   * from the current RuntimeContext.
   */
  async build(
    context: RuntimeContext,
  ): Promise<ExecutionTrustRecord> {
    if (!context.execution) {
      throw new Error(
        "Execution artifact is required.",
      );
    }

    const now = new Date();

    const draft: TrustRecordDraft = {
      trustRecordId: crypto.randomUUID(),

      businessTransactionId:
        context.transaction.businessTransactionId,

      transaction: context.transaction,

      ...(context.authorization !== undefined
        ? { authorization: context.authorization }
        : {}),

      overrides:
        context.override
          ? [context.override]
          : [],

      executions: [context.execution],

      verifications:
        context.verification
          ? [context.verification]
          : [],

      receipts:
        context.receipt
          ? [context.receipt]
          : [],

      createdAt: now,

      updatedAt: now,
    };

    //
    // Temporary Trust Record for hashing.
    //
    const trustRecord = {
      ...draft,

      trustRecordHash: "",

      signature: {
        algorithm:
          CryptoBootstrap.create().signature.algorithm,

        keyId: DEFAULT_KEY_ID,

        value: "",

        signedAt: now,
      },
    };

    const trustRecordHash =
  await this.crypto.hash(
    trustRecord,
  );

const recordWithHash = {
  ...trustRecord,

  trustRecordHash,
};

const signature =
  await this.crypto.sign(
    recordWithHash,
  );

//
// Hybrid Signature Support milestone, Phase A: additive second
// signature pass, only when CRYPTO_MODE=hybrid. The legacy
// `signature` above is unaffected either way.
//
if (this.config.crypto.mode !== "hybrid") {
  return {
    ...recordWithHash,

    signature,
  };
}

const signatures =
  await this.crypto.signHybrid(
    recordWithHash,
  );

return {
  ...recordWithHash,

  signature,

  schemaVersion: 2,

  signatures,
};
  }
}