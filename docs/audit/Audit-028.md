AUDIT-028

Title:

Remove legacy TransactionService

Reason:

TransactionService is not referenced by RuntimeFactory,

ExecutionTrustApplication, tests, or any runtime component.

It duplicates responsibilities already handled by:

\- BusinessTransactionService

\- ExecutionTrustPipeline

\- ExecutionTrustRecordBuilder

Status:

Candidate for removal after one final verification.
