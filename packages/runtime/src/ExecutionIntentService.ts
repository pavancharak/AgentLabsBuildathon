import type {
  ExecutionIntent,
  ExecutionIntentFinalizationMode,
  ExecutionIntentRepository,
  StoredExecutionIntent,
} from "@parmana/shared";

import type { RuntimeContext } from "./context/RuntimeContext.js";
import { ExecutionIntentBuilder } from "./ExecutionIntentBuilder.js";
import { ExecutionIntentUnavailableError } from "./errors/ExecutionIntentUnavailableError.js";

/**
 * Coordinates the Execution Intent lifecycle for the runtime (ADR-0012).
 *
 * Two different failure rules apply on purpose:
 *
 * - `prepare` is FAIL CLOSED. It runs before an action is released. If the
 *   intent cannot be signed and stored, it throws
 *   ExecutionIntentUnavailableError and the caller must not release anything.
 * - `markReleased`, `markErrored` and `markFinalized` are BEST EFFORT. They run
 *   after release, when the action can no longer be undone, so a bookkeeping
 *   failure must not turn a completed execution into a failed request. They
 *   never throw. They log at critical severity, because an intent left in the
 *   wrong state is exactly what an operator needs to find. The unfinalized
 *   list is the safety net: an intent that never reaches FINALIZED stays
 *   visible.
 */
export class ExecutionIntentService {
  constructor(
    private readonly repository: ExecutionIntentRepository,
    private readonly builder: ExecutionIntentBuilder = new ExecutionIntentBuilder(),
  ) {}

  /**
   * Signs and stores the intent. Call this immediately before release.
   */
  async prepare(context: RuntimeContext): Promise<ExecutionIntent> {
    const businessTransactionId = context.transaction.businessTransactionId;

    try {
      const intent = await this.builder.build(context);

      return await this.repository.create(intent);
    } catch (error) {
      console.error({
        event: "execution_intent_prepare_failed",
        severity: "critical",
        businessTransactionId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ExecutionIntentUnavailableError(businessTransactionId, error);
    }
  }

  /**
   * Saves the execution context right after the release stage returned, so the
   * Trust Record can be rebuilt if it cannot be produced inline. The context is
   * saved as plain JSON so memory and Postgres storage behave identically.
   */
  async markReleased(context: RuntimeContext): Promise<void> {
    const businessTransactionId = context.transaction.businessTransactionId;

    try {
      await this.repository.markReleased(
        businessTransactionId,
        JSON.parse(JSON.stringify(context)) as unknown,
        new Date(),
      );
    } catch (error) {
      this.logStatusFailure(
        "execution_intent_mark_released_failed",
        businessTransactionId,
        error,
      );
    }
  }

  /**
   * Records that the release stage raised an error. The action may still have
   * been executed, so this is not a claim that nothing happened.
   */
  async markErrored(
    businessTransactionId: string,
    cause: unknown,
  ): Promise<void> {
    try {
      await this.repository.markErrored(
        businessTransactionId,
        cause instanceof Error ? cause.message : String(cause),
      );
    } catch (error) {
      this.logStatusFailure(
        "execution_intent_mark_errored_failed",
        businessTransactionId,
        error,
      );
    }
  }

  async markFinalized(
    businessTransactionId: string,
    trustRecordId: string,
    mode: ExecutionIntentFinalizationMode,
  ): Promise<void> {
    try {
      await this.repository.markFinalized(
        businessTransactionId,
        trustRecordId,
        mode,
        new Date(),
      );
    } catch (error) {
      this.logStatusFailure(
        "execution_intent_mark_finalized_failed",
        businessTransactionId,
        error,
      );
    }
  }

  async get(
    businessTransactionId: string,
  ): Promise<StoredExecutionIntent | null> {
    return this.repository.findByTransactionId(businessTransactionId);
  }

  async listUnfinalized(
    limit: number,
  ): Promise<readonly StoredExecutionIntent[]> {
    return this.repository.listUnfinalized(limit);
  }

  private logStatusFailure(
    event: string,
    businessTransactionId: string,
    error: unknown,
  ): void {
    console.error({
      event,
      severity: "critical",
      businessTransactionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
