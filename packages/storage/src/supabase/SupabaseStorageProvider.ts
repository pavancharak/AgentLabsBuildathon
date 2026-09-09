import type {
  BusinessTransactionRepository,
  ExecutionTrustRecordRepository,
  PendingPolicyChangeRepository,
  PolicyChangeApprovalRecordRepository,
  RefusalRecordRepository,
} from "@parmana/shared";

import type { StorageProvider } from "../StorageProvider.js";

import { PostgresPoolFactory } from "../postgres/PostgresPoolFactory.js";

import { SupabaseBusinessTransactionRepository } from "./SupabaseBusinessTransactionRepository.js";

import { SupabaseExecutionTrustRecordRepository } from "./SupabaseExecutionTrustRecordRepository.js";

import { SupabaseRefusalRecordRepository } from "./SupabaseRefusalRecordRepository.js";

import { SupabasePendingPolicyChangeRepository } from "./SupabasePendingPolicyChangeRepository.js";

import { SupabasePolicyChangeApprovalRecordRepository } from "./SupabasePolicyChangeApprovalRecordRepository.js";

/**
 * Supabase Storage Provider.
 *
 * Wires all three repositories to a single, shared PostgresPoolFactory
 * pool (DATABASE_URL) — a direct Postgres connection, not a
 * supabase-js/PostgREST client. This removes PostgREST from the
 * failure modes of every table this provider touches (business
 * transactions, execution trust records and their sub-collections,
 * refusal records), not just the audit sinks that broke first (see
 * SupabaseCallerAuditSink for the originating incident).
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly businessTransactions: BusinessTransactionRepository;
  readonly trustRecords: ExecutionTrustRecordRepository;
  readonly refusalRecords: RefusalRecordRepository;
  readonly pendingPolicyChanges: PendingPolicyChangeRepository;
  readonly policyChangeApprovalRecords: PolicyChangeApprovalRecordRepository;

  constructor() {
    const pool = PostgresPoolFactory.create();

    this.businessTransactions =
      new SupabaseBusinessTransactionRepository(pool);

    this.trustRecords =
      new SupabaseExecutionTrustRecordRepository(pool);

    this.refusalRecords =
      new SupabaseRefusalRecordRepository(pool);

    this.pendingPolicyChanges =
      new SupabasePendingPolicyChangeRepository(pool);

    this.policyChangeApprovalRecords =
      new SupabasePolicyChangeApprovalRecordRepository(pool);

    Object.freeze(this);
  }
}