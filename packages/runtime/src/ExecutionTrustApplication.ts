import { RefusalCrypto, VerificationCrypto } from "@parmana/crypto";

import {
  BusinessTransaction,
  ExecutionTrustRecord,
  ExecutionTrustRecordRepository,
  Receipt,
  RefusalRecord,
  RefusalRecordRepository,
  Verification,
} from "@parmana/shared";

import { Runtime } from "./Runtime.js";

import { VerificationFailedError } from "./errors/VerificationFailedError.js";
import { BusinessTransactionService } from "./services/business-transaction-service.js";
import { ReceiptService } from "./services/receipt-service.js";
import { VerificationService } from "./services/verification-service.js";

/**
 * Execution Trust Application.
 *
 * Orchestrates the complete lifecycle:
 *
 * Business Transaction
 *        ↓
 * Runtime
 *        ↓
 * Verification
 *        ↓
 * Receipt
 *        ↓
 * Replay
 */
export class ExecutionTrustApplication {
  private readonly crypto = new VerificationCrypto();

  private readonly refusalCrypto = new RefusalCrypto();

  constructor(
    private readonly transactions: BusinessTransactionService,
    private readonly runtime: Runtime,
    private readonly verification: VerificationService,
    private readonly receipts: ReceiptService,
    private readonly trustRecords: ExecutionTrustRecordRepository,
    /**
     * RFC-0021. Optional so existing callers that construct
     * ExecutionTrustApplication directly (tests) keep compiling.
     * getRefusalRecord()/verifyRefusalRecord() return
     * null/false-shaped results rather than throwing when omitted --
     * see each method.
     */
    private readonly refusalRecords?: RefusalRecordRepository,
  ) {
    Object.freeze(this);
  }

  /**
   * Execute Business Transaction through the
   * complete Execution Trust pipeline.
   */
  async execute(
    transaction: BusinessTransaction,
  ): Promise<ExecutionTrustRecord> {
    //
    // Accept Business Transaction
    //
    await this.transactions.accept(transaction);

    //
    // Execute Runtime
    //
    await this.runtime.execute(transaction);

    //
    // Verification
    //
    await this.verification.verify(transaction.businessTransactionId);

    //
    // Receipt
    //
    await this.receipts.generate(transaction.businessTransactionId);

    //
    // Load completed Trust Record
    //
    const trustRecord = await this.trustRecords.findByTransactionId(
      transaction.businessTransactionId,
    );

    if (!trustRecord) {
      throw new Error("Execution Trust Record not found.");
    }

    return trustRecord;
  }

  /**
   * Verify an Execution Trust Record.
   */
  async verify(businessTransactionId: string): Promise<Verification> {
    return this.verification.verify(businessTransactionId);
  }

  /**
   * Generate a Receipt.
   */
  async generateReceipt(businessTransactionId: string): Promise<Receipt> {
    return this.receipts.generate(businessTransactionId);
  }

  /**
   * Replay execution deterministically.
   */
  async replay(businessTransactionId: string): Promise<{
    businessTransactionId: string;
    trustRecordHash: string;
    verified: boolean;
  }> {
    const trustRecord = await this.trustRecords.findByTransactionId(
      businessTransactionId,
    );

    if (!trustRecord) {
      throw new VerificationFailedError("Execution Trust Record not found.");
    }

    const verified = await this.crypto.verify(trustRecord);

    return {
      businessTransactionId,
      trustRecordHash: trustRecord.trustRecordHash,
      verified,
    };
  }

  /**
   * Get Trust Record.
   */
  async getTrustRecord(
    businessTransactionId: string,
  ): Promise<ExecutionTrustRecord | null> {
    return this.trustRecords.findByTransactionId(businessTransactionId);
  }

  /**
   * List Execution Trust Records — the bulk/compliance-export
   * counterpart to getTrustRecord()/listTransactions(). Paginates over
   * this.transactions (BusinessTransactionService.list(), the same
   * source listTransactions() above already uses) and resolves each
   * page entry to its full signed Execution Trust Record, rather than
   * adding a parallel pagination path directly against
   * ExecutionTrustRecordRepository — every Business Transaction that
   * exists has exactly one Trust Record (see Runtime.execute()), so
   * paginating the transactions and joining is equivalent to
   * paginating the trust records directly, without requiring every
   * ExecutionTrustRecordRepository implementation (in-memory, Supabase,
   * and any future one) to grow its own list() method.
   *
   * A transaction with no resolvable Trust Record yet (execution still
   * in flight) is silently skipped rather than surfaced as null/error —
   * this endpoint's purpose is exporting settled, signed evidence, not
   * reporting in-flight state.
   */
  async listTrustRecords(
    page = 1,
    pageSize = 25,
  ): Promise<readonly ExecutionTrustRecord[]> {
    const transactions = await this.transactions.list(page, pageSize);

    const records = await Promise.all(
      transactions.map((transaction) =>
        this.trustRecords.findByTransactionId(
          transaction.businessTransactionId,
        ),
      ),
    );

    return records.filter(
      (record): record is ExecutionTrustRecord => record !== null,
    );
  }

  /**
   * Get Refusal Record (RFC-0021).
   *
   * Returns null when no RefusalRecordRepository is configured, the
   * same shape as "no record found" -- callers (the GET
   * /refusal/:id route) do not need to distinguish "not wired up"
   * from "nothing to find here."
   */
  async getRefusalRecord(
    businessTransactionId: string,
  ): Promise<RefusalRecord | null> {
    if (!this.refusalRecords) {
      return null;
    }

    return this.refusalRecords.findByTransactionId(businessTransactionId);
  }

  /**
   * Verify a Refusal Record's signature (RFC-0021).
   *
   * Takes the record itself, not an ID -- no database lookup, no
   * caller authentication required. This is the capability that
   * makes a refusal independently third-party-verifiable: anyone
   * holding a RefusalRecord (e.g. the caller who was refused) can
   * check it themselves against Parmana's public key alone.
   */
  async verifyRefusalRecord(refusalRecord: RefusalRecord): Promise<boolean> {
    return this.refusalCrypto.verify(refusalRecord);
  }

  /**
   * Get Business Transaction.
   */
  async getTransaction(
    businessTransactionId: string,
  ): Promise<BusinessTransaction | null> {
    return this.transactions.get(businessTransactionId);
  }

  /**
   * List Business Transactions.
   */
  async listTransactions(
    page = 1,
    pageSize = 25,
  ): Promise<readonly BusinessTransaction[]> {
    return this.transactions.list(page, pageSize);
  }
}
