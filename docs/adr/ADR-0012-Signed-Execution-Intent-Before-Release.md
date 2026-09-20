# ADR-0012: Signed Execution Intent Before Release (proposed)

**Status:** Proposed. Not implemented. It needs a decision before any code is written.

**Date:** 2026-09-20

**Relates to:** `docs/VERIFICATION-GAPS.md` G-52 (the ordering gap this would close) and G-53 (no way to rebuild a missing record), ADR-0011 (the mitigation already in place), `docs/CLAIMS.md` section 2.38.

## Context

The runtime processes a request in this order: decide, authorize, release the action to the connector through the Execution Gateway, then build, sign and persist the Execution Trust Record. The record contains the result of the execution, which is why it is built last.

ADR-0011 added two things. Before release, the engine proves the evidence signing path works and refuses with `503 SIGNING_UNAVAILABLE` if it does not. After release, a failure to produce or persist the record is `500 EXECUTION_RECORD_INCOMPLETE`, with the identifiers and a critical log.

That leaves two facts, recorded as G-52 (still open) and G-53:

1. A transient failure between the readiness check and the real signing, or a database failure after release, can still leave an executed action with no signed record.
2. When that happens, the context needed to build the record (the decision, the authorization and the execution result) exists only in the memory of the failed request and in the connector's response. It is not persisted before the record is built, so the record cannot be finalized later. An operator can reconcile against the connector and the `execution_audit_events` rows for the `businessTransactionId`, but the signed record cannot be recreated.

## Options

**A. Persist the released context, add a finalize operation.** Before building the record, store the decision, the authorization and the execution result. Expose an operation that rebuilds and signs the record from that stored context. It repairs the gap after the fact, and it depends on storage being available at the moment it is needed.

**B. Persist a signed execution intent before release, finalize after.** Before the connector is called, sign and persist a record of what is about to be released. After the connector answers, finalize the record with the result. An executed action then always has a signed record, even if finalization fails. This is the option `docs/VERIFICATION-GAPS.md` G-52 calls the complete answer.

**C. Both.** B for the guarantee, and A's finalize operation to complete an intent whose finalization failed.

## Recommendation

Choose B, and include a finalize operation for an intent that was never finalized, which is the useful part of A. Build it in that order, so the guarantee comes first and the repair tool second.

Reasons:

1. B is the only option that gives the guarantee "every released action has a signed record". A repairs after the fact and still fails if storage is down at repair time.
2. The failure ordering is easy to state and to test: if the intent cannot be signed and persisted, nothing is released and the caller gets `503`, the same fail closed shape as `SIGNING_UNAVAILABLE`.

## What must be decided before implementation

This ADR does not answer these. Each needs a decision.

1. **What the intent contains and what is signed.** The decision, the authorization identifiers and the policy hash are candidates. The execution result cannot be in it, because it does not exist yet.
2. **How finalization relates to the existing record.** One record with an intent section that is later completed, or an intent record linked to a separate final record. The record is hashed and signed today, so completing it after signing needs a defined rule, and the record must continue to verify offline.
3. **The schema and migration.** A new table or new columns, a migration for a database that already has records, and how old records without an intent verify.
4. **Idempotency.** A finalize operation must be safe to run twice, and must never call the connector again.
5. **What a verifier reports for an intent that was never finalized.** It must be distinguishable from a complete record, so an auditor sees that an action was released and its result is unrecorded.
6. **The cost.** One more signing operation and one more write before every release, which is added latency on the request path and one more `kms:Sign` under KMS.

## Consequences if accepted

1. Positive: closes G-52 and makes G-53 a repair procedure and no longer a data loss.
2. Negative: a new record type, a migration, a change to the offline verifiers in both SDKs, and a change to the documented Execution Trust Record. Every one of those needs its own review.
3. `docs/CLAIMS.md` section 2.38 must be rewritten from "mitigated" to the new guarantee, only after the tests and a live check below pass.

## Verification plan

Nothing here is verified. Before accepting, the implementation would need:

1. A test that forces a failure between release and finalization and shows the intent exists, is signed, and is reported as unfinalized.
2. A test that forces intent persistence to fail and shows nothing is released.
3. A test that finalizes twice and shows the connector is called once.
4. Offline verification of an intent record and of a finalized record with both SDKs.
5. A live run against a real database and a real KMS key, as in `docs/site/deployment/aws-kms-signing.mdx`.
