import type { ApprovalVerifier } from "@parmana/approval";
import { PaytmRefundApprovalVerifier } from "@parmana/connector-paytm";
import type { SignalStateVerifier } from "@parmana/policy";

import { createApprovalVerifier } from "./createApprovalVerifier.js";

/**
 * Creates the production Signal/State Verifier for paytm:refund
 * (G-65): a refund whose signals declare managerApproved: true runs
 * only with a signed Approval Artifact from a trusted approver
 * (TRUSTED_APPROVAL_ISSUERS, createApprovalIssuerRegistry.ts) for that
 * order and amount.
 */
export function createPaytmRefundApprovalVerifier(
  approvalVerifier: ApprovalVerifier = createApprovalVerifier(),
): SignalStateVerifier {
  return new PaytmRefundApprovalVerifier(approvalVerifier);
}
