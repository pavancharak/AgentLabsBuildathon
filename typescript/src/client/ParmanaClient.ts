/**
 * Parmana SDK
 *
 * Canonical SDK client.
 *
 * ParmanaClient is the primary entry point for interacting
 * with the Parmana Runtime.
 *
 * Responsibilities:
 * - Hold immutable SDK configuration.
 * - Compose SDK APIs.
 * - Delegate SDK operations.
 *
 * ParmanaClient does NOT:
 * - evaluate policy
 * - authorize execution
 * - execute business logic
 * - verify trust records
 * - replay executions
 * - communicate directly with the Runtime
 */

import type {
  AuditEvent,
  BusinessTransaction,
  ExecutionTrustRecord,
  Receipt,
  RefusalRecord,
  Signature,
  Verification,
} from "../models/index.js";

import type { ReplayResult } from "../models/replay-result.js";

import type { Configuration } from "../config/Configuration.js";

import type { Transport } from "../config/Transport.js";

import { ConfigurationError } from "../errors/ConfigurationError.js";

import { HttpTransport } from "../transport/HttpTransport.js";

import { HealthApi, type HealthStatus } from "./HealthApi.js";

import { ExecutionApi } from "./ExecutionApi.js";

import { VerificationApi } from "./VerificationApi.js";

import { ReplayApi } from "./ReplayApi.js";

import { ReceiptApi } from "./ReceiptApi.js";

import { TransactionApi } from "./TransactionApi.js";

import { TrustRecordApi } from "./TrustRecordApi.js";

import { PolicyApi, type PolicyValidationResult } from "./PolicyApi.js";

import { RefusalApi } from "./RefusalApi.js";

import { AuditApi } from "./AuditApi.js";

/**
 * Canonical Parmana SDK client.
 */
export class ParmanaClient {
  /**
   * Immutable SDK configuration.
   */
  public readonly configuration: Configuration;

  /**
   * Configured transport.
   */
  private readonly transport: Transport;

  /**
   * Runtime Health API.
   */
  private readonly healthApi: HealthApi;

  /**
   * Runtime Execution API.
   */
  private readonly executionApi: ExecutionApi;

  /**
   * Runtime Verification API.
   */
  private readonly verificationApi: VerificationApi;

  /**
   * Runtime Replay API.
   */
  private readonly replayApi: ReplayApi;

  /**
   * Runtime Receipt API.
   */
  private readonly receiptApi: ReceiptApi;

  /**
   * Runtime Transaction API.
   */
  private readonly transactionApi: TransactionApi;

  /**
   * Runtime Trust Record API.
   */
  private readonly trustRecordApi: TrustRecordApi;

  /**
   * Runtime Policy API.
   */
  private readonly policyApi: PolicyApi;

  /**
   * Runtime Refusal Record API.
   */
  private readonly refusalApi: RefusalApi;

  /**
   * Runtime Audit Event API.
   */
  private readonly auditApi: AuditApi;

  /**
   * Creates a Parmana SDK client.
   */
  constructor(configuration: Configuration) {
    if (!configuration.endpoint) {
      throw new ConfigurationError("Runtime endpoint is required.");
    }

    this.configuration = configuration;
    this.transport =
      configuration.transport ?? new HttpTransport(configuration);

    //
    // Compose SDK APIs.
    //
    this.healthApi = new HealthApi(this.transport);

    this.executionApi = new ExecutionApi(this.transport);

    this.verificationApi = new VerificationApi(this.transport);

    this.replayApi = new ReplayApi(this.transport);

    this.receiptApi = new ReceiptApi(this.transport);

    this.transactionApi = new TransactionApi(this.transport);

    this.trustRecordApi = new TrustRecordApi(this.transport);

    this.policyApi = new PolicyApi(this.transport);

    this.refusalApi = new RefusalApi(this.transport);

    this.auditApi = new AuditApi(this.transport);
  }

  /**
   * Returns the configured Runtime endpoint.
   */
  public endpoint(): string {
    return this.configuration.endpoint;
  }

  /**
   * Performs a Runtime health check.
   */
  public health(): Promise<HealthStatus> {
    return this.healthApi.health();
  }

  /**
   * Returns the Runtime name, version, and API version.
   */
  public version(): Promise<unknown> {
    return this.executionApi.version();
  }

  /**
   * Executes a Business Transaction.
   */
  public execute(
    transaction: BusinessTransaction,
  ): Promise<ExecutionTrustRecord> {
    return this.executionApi.execute(transaction);
  }

  /**
   * Runs a fresh verification of an Execution Trust Record, appending a
   * new Verification to its history. Distinct from
   * getLatestVerification(), which reads the most recent one without
   * re-verifying.
   */
  public verify(businessTransactionId: string): Promise<Verification> {
    return this.verificationApi.verify(businessTransactionId);
  }

  /**
   * Returns the latest Verification.
   */
  public getLatestVerification(
    businessTransactionId: string,
  ): Promise<Verification> {
    return this.verificationApi.getLatest(businessTransactionId);
  }

  /**
   * Performs deterministic replay.
   */
  public replay(businessTransactionId: string): Promise<ReplayResult> {
    return this.replayApi.replay(businessTransactionId);
  }

  /**
   * Generates an execution receipt.
   */
  public receipt(businessTransactionId: string): Promise<Receipt> {
    return this.receiptApi.generate(businessTransactionId);
  }

  /**
   * Creates (executes) a Business Transaction via POST /transactions,
   * a second, independent entry point into the identical execution
   * pipeline as execute() (POST /execute). See TransactionApi.create.
   */
  public createTransaction(
    transaction: BusinessTransaction,
  ): Promise<ExecutionTrustRecord> {
    return this.transactionApi.create(transaction);
  }

  /**
   * Retrieves a Business Transaction.
   */
  public transaction(
    businessTransactionId: string,
  ): Promise<BusinessTransaction> {
    return this.transactionApi.get(businessTransactionId);
  }

  /**
   * Lists Business Transactions.
   */
  public transactions(page = 1, pageSize = 25): Promise<BusinessTransaction[]> {
    return this.transactionApi.list(page, pageSize);
  }

  /**
   * Retrieves an Execution Trust Record.
   */
  public trustRecord(
    businessTransactionId: string,
  ): Promise<ExecutionTrustRecord> {
    return this.trustRecordApi.get(businessTransactionId);
  }

  /**
   * Confirms that a policy (name + version) is loadable by the Runtime.
   */
  public validatePolicy(
    policyId: string,
    policyVersion: string,
  ): Promise<PolicyValidationResult> {
    return this.policyApi.validate(policyId, policyVersion);
  }

  /**
   * Retrieves a Refusal Record by Business Transaction ID.
   */
  public refusalRecord(businessTransactionId: string): Promise<RefusalRecord> {
    return this.refusalApi.get(businessTransactionId);
  }

  /**
   * Verifies a Refusal Record's signature.
   */
  public verifyRefusalRecord(record: RefusalRecord): Promise<boolean> {
    return this.refusalApi.verify(record);
  }

  /**
   * Verifies a signed caller-authentication audit event's signature.
   */
  public verifyAuditEvent(
    event: AuditEvent,
    signature: Signature,
  ): Promise<boolean> {
    return this.auditApi.verify(event, signature);
  }
}
