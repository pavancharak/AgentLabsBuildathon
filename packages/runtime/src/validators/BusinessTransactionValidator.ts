import { BusinessTransaction } from "@parmana/shared";

import { BusinessTransactionValidationError } from "../errors/BusinessTransactionValidationError.js";

export class BusinessTransactionValidator {
  public static validate(transaction: BusinessTransaction): void {
    //
    // Trust-chain invariants
    //
    if (
      transaction.businessTransactionId !==
      transaction.metadata.businessTransactionId
    ) {
      throw new BusinessTransactionValidationError(
        "metadata.businessTransactionId must match businessTransactionId.",
      );
    }

    if (
      transaction.authorization.authorityId !==
      transaction.authority.authorityId
    ) {
      throw new BusinessTransactionValidationError(
        "authorization.authorityId must match authority.authorityId.",
      );
    }

    if (
      transaction.intent.authorizationId !==
      transaction.authorization.authorizationId
    ) {
      throw new BusinessTransactionValidationError(
        "intent.authorizationId must match authorization.authorizationId.",
      );
    }

    //
    // Required fields
    //
    if (!transaction.policy.name.trim()) {
      throw new BusinessTransactionValidationError("policy.name is required.");
    }

    if (!transaction.policy.version.trim()) {
      throw new BusinessTransactionValidationError(
        "policy.version is required.",
      );
    }

    if (!transaction.intent.action.trim()) {
      throw new BusinessTransactionValidationError(
        "intent.action is required.",
      );
    }
  }
}
