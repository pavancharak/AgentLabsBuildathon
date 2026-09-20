import {
  BusinessTransaction,
  ExecutionTrustRecord,
  ExecutionTrustRecordRepository,
} from "@parmana/shared";

import { RuntimeEngine } from "./RuntimeEngine.js";
import { ExecutionRecordIncompleteError } from "./errors/ExecutionRecordIncompleteError.js";

import type { RuntimeResult } from "./RuntimeResult.js";

/**
 * Canonical Parmana Runtime.
 *
 * Thin façade over RuntimeEngine.
 *
 * Responsibilities:
 * - Execute Business Transactions.
 * - Persist Execution Trust Records.
 */
export class Runtime {
  constructor(
    private readonly engine: RuntimeEngine,
    private readonly trustRecords: ExecutionTrustRecordRepository,
  ) {
    Object.freeze(this);
  }

  /**
   * Execute a Business Transaction.
   */
  public async execute(
    transaction: BusinessTransaction,
  ): Promise<RuntimeResult> {
    //
    // Execute Runtime Engine
    //

    const result = await this.engine.execute(transaction);

    //
    // Extract Trust Record
    //
    const trustRecord = result.trustRecord as ExecutionTrustRecord;

    //
    // Persist Trust Record
    //

    //
    // The action was released before this point. If the signed record
    // cannot be persisted, say so explicitly (G-52) rather than surfacing a
    // generic error that would invite a blind retry.
    //
    try {
      await this.trustRecords.create(trustRecord);
    } catch (error) {
      console.error({
        event: "execution_released_record_persist_failed",
        severity: "critical",
        businessTransactionId: trustRecord.businessTransactionId,
        authorizationId: trustRecord.authorization?.payload.authorizationId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ExecutionRecordIncompleteError(
        trustRecord.businessTransactionId,
        trustRecord.authorization?.payload.authorizationId,
        error,
      );
    }

    return {
      transaction: result.transaction,

      context: result.context,

      trustRecord,
    };
  }

  /**
   * Runtime pipeline is empty.
   */
  public isEmpty(): boolean {
    return this.engine["pipeline"].isEmpty();
  }

  /**
   * Number of runtime stages.
   */
  public size(): number {
    return this.engine["pipeline"].size();
  }
}
