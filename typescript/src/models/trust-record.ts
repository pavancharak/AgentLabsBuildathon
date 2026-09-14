import type { BusinessTransaction } from "./business-transaction.js";
import type { Execution } from "./execution.js";
import type { Override } from "./override.js";
import type { Receipt } from "./receipt.js";
import type { Signature } from "./signature.js";
import type { Verification } from "./verification.js";

export interface ExecutionTrustRecord {
  readonly trustRecordId: string;
  readonly businessTransactionId: string;
  readonly transaction: BusinessTransaction;
  readonly overrides: Override[];
  readonly executions: Execution[];
  readonly verifications: Verification[];
  readonly receipts: Receipt[];
  readonly trustRecordHash: string;
  readonly signature: Signature;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
