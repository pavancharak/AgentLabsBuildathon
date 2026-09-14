import type { PolicyExecutionVerifier } from "@parmana/policy";
import { PolicyChangeCrypto } from "@parmana/crypto";

import { policyChangeApprovalRecordRepository } from "../repositories.js";
import { PolicyGovernanceExecutionVerifier } from "../governance/PolicyGovernanceExecutionVerifier.js";

/**
 * Policy Governance execution-time verification is OFF by default:
 * as of 2026-09-07 every real production policy in this system is
 * still PENDING_APPROVAL (see docs/CLAIMS.md §2.26's "Legacy-policy
 * backfill" entry -- ten policies, proposed 2026-08-19, awaiting a
 * genuine human checker) -- turning this on unconditionally would
 * refuse every execution in the system today, not just a genuine
 * bypass. Set POLICY_EXECUTION_VERIFICATION_ENFORCED=true only once
 * every policy this deployment actually executes against has a real,
 * signed PolicyChangeApprovalRecord -- via real maker-checker
 * approval, or (for a policy that never needed content review, only a
 * governance record) scripts/backfill-legacy-policy-approvals.ts
 * --apply. Enabling it before that point is not a stricter security
 * posture, it is an outage.
 *
 * Returns undefined (verification unconfigured, current behavior) as
 * the safe default; RuntimeEngine's own doc comment on
 * policyExecutionVerifier describes exactly what changes once this
 * returns a real verifier instead.
 */
export function createPolicyExecutionVerifier():
  PolicyExecutionVerifier | undefined {
  if (process.env.POLICY_EXECUTION_VERIFICATION_ENFORCED !== "true") {
    return undefined;
  }

  return new PolicyGovernanceExecutionVerifier(
    policyChangeApprovalRecordRepository,
    new PolicyChangeCrypto(),
  );
}
