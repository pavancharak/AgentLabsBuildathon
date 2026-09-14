import {
  PolicyChangeApprovalRecord,
  PolicyChangeApprovalRecordRepository,
} from "@parmana/shared";

/**
 * In-memory Policy Change Approval Record repository (Policy
 * Governance, maker-checker). Append-only: create() always inserts,
 * never overwrites -- there is no update path in the interface.
 */
export class MemoryPolicyChangeApprovalRecordRepository implements PolicyChangeApprovalRecordRepository {
  private readonly records = new Map<string, PolicyChangeApprovalRecord>();

  async create(
    record: PolicyChangeApprovalRecord,
  ): Promise<PolicyChangeApprovalRecord> {
    this.records.set(record.policyChangeApprovalRecordId, record);

    return record;
  }

  async findById(
    policyChangeApprovalRecordId: string,
  ): Promise<PolicyChangeApprovalRecord | null> {
    return this.records.get(policyChangeApprovalRecordId) ?? null;
  }

  async list(): Promise<readonly PolicyChangeApprovalRecord[]> {
    return [...this.records.values()];
  }

  async findMostRecentFor(
    policyName: string,
    policyVersion: string,
  ): Promise<PolicyChangeApprovalRecord | null> {
    const matches = [...this.records.values()].filter(
      (record) =>
        record.policyName === policyName &&
        record.policyVersion === policyVersion,
    );

    if (matches.length === 0) {
      return null;
    }

    return matches.reduce((mostRecent, candidate) =>
      candidate.approvedAt > mostRecent.approvedAt ? candidate : mostRecent,
    );
  }
}
