/**
 * Parmana Trust Record API.
 *
 * Retrieve Execution Trust Records.
 */

import type { ExecutionTrustRecord } from "../models/index.js";

import type { Transport } from "../config/Transport.js";

/**
 * Trust Record API.
 */
export class TrustRecordApi {
  constructor(private readonly transport: Transport) {}

  /**
   * Retrieve an Execution Trust Record.
   */
  public async get(
    businessTransactionId: string,
  ): Promise<ExecutionTrustRecord> {
    const response = await this.transport.send<ExecutionTrustRecord>({
      method: "GET",
      path: `/trust-records/${businessTransactionId}`,
    });

    return response.body;
  }
}
