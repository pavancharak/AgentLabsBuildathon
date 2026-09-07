import type { LedgerEntry } from "./ledger/LedgerEntry.js";
import { AppendOnlyLedger } from "./ledger/AppendOnlyLedger.js";

import { ExecutionRepository } from "./repositories/ExecutionRepository.js";
import { VerificationRepository } from "./repositories/VerificationRepository.js";
import { CryptoProofRepository } from "./repositories/CryptoProofRepository.js";

/**
 * StorageEngine is the orchestration layer for all persistence.
 *
 * It ensures:
 * - Append-only writes
 * - Separation of execution / verification / crypto evidence
 * - Deterministic storage behavior
 *
 * NOT part of the live request path: nothing in packages/api,
 * packages/execution-gateway, or packages/runtime imports this class
 * (verified 2026-09-07 audit), and its ledger (AppendOnlyLedger) is an
 * in-memory array with no persistence -- it does not survive a
 * process restart. Do not mistake this for Parmana's audit trail; the
 * durable, signed record of a policy-governance decision is
 * PolicyChangeApprovalRecord (@parmana/shared,
 * PolicyChangeApprovalRecordRepository), and execution evidence lives
 * in ExecutionTrustRecord, neither of which route through here.
 */
export class StorageEngine {
  private readonly ledger: AppendOnlyLedger;
  private readonly executionRepo: ExecutionRepository;
  private readonly verificationRepo: VerificationRepository;
  private readonly cryptoRepo: CryptoProofRepository;

  constructor() {
    this.ledger = new AppendOnlyLedger();
    this.executionRepo = new ExecutionRepository();
    this.verificationRepo = new VerificationRepository();
    this.cryptoRepo = new CryptoProofRepository();
  }

  /**
   * Record execution event
   */
  public recordExecution(entry: LedgerEntry): void {
    this.ledger.append(entry);
    this.executionRepo.save(entry);
  }

  /**
   * Record verification event
   */
  public recordVerification(entry: LedgerEntry): void {
    this.ledger.append(entry);
    this.verificationRepo.save(entry);
  }

  /**
   * Record cryptographic proof event
   */
  public recordCryptoProof(entry: LedgerEntry): void {
    this.ledger.append(entry);
    this.cryptoRepo.save(entry);
  }

  /**
   * Read full immutable ledger
   */
  public getLedger(): readonly LedgerEntry[] {
    return this.ledger.all();
  }

  /**
   * Integrity check of full system
   */
  public verifyIntegrity(): boolean {
    return this.ledger.verifyIntegrity();
  }

  /**
   * Get latest execution entry
   */
  public lastExecution(): LedgerEntry | null {
    return this.executionRepo.last();
  }

  /**
   * Get latest verification entry
   */
  public lastVerification(): LedgerEntry | null {
    return this.verificationRepo.last();
  }

  /**
   * Get latest crypto proof entry
   */
  public lastCryptoProof(): LedgerEntry | null {
    return this.cryptoRepo.last();
  }
}
