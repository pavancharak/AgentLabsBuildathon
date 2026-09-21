import type {
  BusinessTransactionRepository,
  ExecutionIntentRepository,
  ExecutionTrustRecordRepository,
  HandbookDownloadLeadRepository,
  PendingPolicyChangeRepository,
  PolicyChangeApprovalRecordRepository,
  RefusalRecordRepository,
} from "@parmana/shared";

import type { StorageProvider } from "../StorageProvider.js";

import { MemoryBusinessTransactionRepository } from "./MemoryBusinessTransactionRepository.js";

import { MemoryExecutionTrustRecordRepository } from "./MemoryExecutionTrustRecordRepository.js";

import { MemoryExecutionIntentRepository } from "./MemoryExecutionIntentRepository.js";
import { MemoryRefusalRecordRepository } from "./MemoryRefusalRecordRepository.js";

import { MemoryPendingPolicyChangeRepository } from "./MemoryPendingPolicyChangeRepository.js";

import { MemoryPolicyChangeApprovalRecordRepository } from "./MemoryPolicyChangeApprovalRecordRepository.js";

import { MemoryHandbookDownloadLeadRepository } from "./MemoryHandbookDownloadLeadRepository.js";

/**
 * Memory Storage Provider.
 *
 * Provides in-memory repository implementations
 * for development, testing, and local execution.
 */
export class MemoryStorageProvider implements StorageProvider {
  readonly businessTransactions: BusinessTransactionRepository;

  readonly trustRecords: ExecutionTrustRecordRepository;

  readonly refusalRecords: RefusalRecordRepository;

  readonly executionIntents: ExecutionIntentRepository;

  readonly pendingPolicyChanges: PendingPolicyChangeRepository;

  readonly policyChangeApprovalRecords: PolicyChangeApprovalRecordRepository;

  readonly handbookDownloadLeads: HandbookDownloadLeadRepository;

  constructor() {
    this.businessTransactions = new MemoryBusinessTransactionRepository();

    this.trustRecords = new MemoryExecutionTrustRecordRepository();

    this.refusalRecords = new MemoryRefusalRecordRepository();

    this.executionIntents = new MemoryExecutionIntentRepository();

    this.pendingPolicyChanges = new MemoryPendingPolicyChangeRepository();

    this.policyChangeApprovalRecords =
      new MemoryPolicyChangeApprovalRecordRepository();

    this.handbookDownloadLeads = new MemoryHandbookDownloadLeadRepository();

    Object.freeze(this);
  }
}
