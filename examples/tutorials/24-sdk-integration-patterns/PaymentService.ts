import type {
  BusinessTransaction,
  ExecutionTrustRecord,
} from "@parmana/shared";

import type { Runtime } from "@parmana/runtime";

/**
 * Example application service.
 *
 * Applications should integrate Parmana
 * behind a business-oriented service rather
 * than calling the Runtime directly from
 * controllers, routes, or UI code.
 */
export class PaymentService {
  constructor(private readonly runtime: Runtime) {}

  /**
   * Releases a vendor payment through
   * the Parmana Runtime.
   */
  async releasePayment(
    transaction: BusinessTransaction,
  ): Promise<ExecutionTrustRecord> {
    const { trustRecord } = await this.runtime.execute(transaction);

    return trustRecord;
  }
}
