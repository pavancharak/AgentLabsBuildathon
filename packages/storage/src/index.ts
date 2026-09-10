/**
 * @parmana/storage
 *
 * Canonical public API.
 */

// -----------------------------------------------------------------------------
// Storage Abstraction
// -----------------------------------------------------------------------------

export * from "./StorageProvider.js";
export * from "./StorageFactory.js";
export * from "./StorageConfiguration.js";

// -----------------------------------------------------------------------------
// Built-in Providers
// -----------------------------------------------------------------------------

export * from "./memory/MemoryStorageProvider.js";

export * from "./memory/MemoryBusinessTransactionRepository.js";
export * from "./memory/MemoryExecutionTrustRecordRepository.js";
export * from "./memory/MemoryRefusalRecordRepository.js";
export * from "./memory/MemoryChallengeRecordRepository.js";
export * from "./memory/MemoryPolicyRepository.js";
export * from "./memory/MemoryPendingPolicyChangeRepository.js";
export * from "./memory/MemoryPolicyChangeApprovalRecordRepository.js";

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

export * from "./errors/StorageError.js";
export * from "./errors/PostgresErrorCodes.js";

export * from "./supabase/SupabaseStorageProvider.js";
export * from "./supabase/SupabaseBusinessTransactionRepository.js";
export * from "./supabase/SupabaseExecutionTrustRecordRepository.js";
export * from "./supabase/SupabaseRefusalRecordRepository.js";
export * from "./supabase/SupabasePendingPolicyChangeRepository.js";
export * from "./supabase/SupabasePolicyChangeApprovalRecordRepository.js";
export * from "./supabase/SupabaseNonceStore.js";
export * from "./supabase/SupabaseApprovalNonceStore.js";
export * from "./supabase/SupabasePolicyChangeStepUpNonceStore.js";

// -----------------------------------------------------------------------------
// Postgres (direct connection, bypassing PostgREST)
// -----------------------------------------------------------------------------

export * from "./postgres/PostgresPoolFactory.js";
export * from "./postgres/PostgresChallengeRecordRepository.js";
export * from "./postgres/PostgresRateLimitStore.js";
