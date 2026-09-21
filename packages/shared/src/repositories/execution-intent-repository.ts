import type {
  ExecutionIntent,
  ExecutionIntentFinalizationMode,
  StoredExecutionIntent,
} from "../domain/index.js";

/**
 * Persistence for Execution Intents (ADR-0012).
 *
 * `create` is the fail closed step: the runtime refuses to release an action
 * if it cannot complete. The `mark*` methods only move operational status and
 * never touch the signed intent. `markFinalized` must never move a
 * FINALIZED intent backwards, and every `mark*` is safe to repeat.
 */
export interface ExecutionIntentRepository {
  create(intent: ExecutionIntent): Promise<ExecutionIntent>;

  findByTransactionId(
    businessTransactionId: string,
  ): Promise<StoredExecutionIntent | null>;

  /** PREPARED to RELEASED, saving the context needed to rebuild the record. */
  markReleased(
    businessTransactionId: string,
    releasedContext: unknown,
    releasedAt: Date,
  ): Promise<void>;

  /** Any state except FINALIZED to FINALIZED. */
  markFinalized(
    businessTransactionId: string,
    trustRecordId: string,
    mode: ExecutionIntentFinalizationMode,
    finalizedAt: Date,
  ): Promise<void>;

  /** PREPARED to ERRORED. */
  markErrored(businessTransactionId: string, reason: string): Promise<void>;

  /**
   * Intents that are not FINALIZED, oldest first. Used by operators to find
   * released actions that have no signed Trust Record.
   */
  listUnfinalized(limit: number): Promise<readonly StoredExecutionIntent[]>;
}
