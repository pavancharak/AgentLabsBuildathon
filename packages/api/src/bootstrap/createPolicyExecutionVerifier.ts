import type { PolicyExecutionVerifier } from "@parmana/policy";
import { PolicyChangeCrypto } from "@parmana/crypto";

import { policyChangeApprovalRecordRepository } from "../repositories.js";
import { PolicyGovernanceExecutionVerifier } from "../governance/PolicyGovernanceExecutionVerifier.js";

/**
 * Policy Governance execution-time verification is ON by default and
 * fails closed: no policy authorizes or releases an execution without a
 * PolicyChangeApprovalRecord whose signature verifies and whose
 * contentHashAfter equals the live policy content hash.
 *
 * It is relaxed only when NODE_ENV is exactly "test" or "development",
 * where it stays off unless POLICY_EXECUTION_VERIFICATION_ENFORCED is
 * the exact string "true". In every other environment, including an
 * unset or unrecognized NODE_ENV, it is enforced and no environment
 * variable can turn it off: a deployment must not be able to silently
 * regress to "unapproved policy still executes".
 *
 * Every policy a deployment executes against must therefore have a
 * real, signed approval record (maker-checker approval, or
 * scripts/backfill-legacy-policy-approvals.ts --apply) before that
 * deployment goes live, or executions under it are refused.
 */
export function createPolicyExecutionVerifier():
  PolicyExecutionVerifier | undefined {
  const env = process.env.NODE_ENV;
  const relaxed = env === "test" || env === "development";

  if (
    relaxed &&
    process.env.POLICY_EXECUTION_VERIFICATION_ENFORCED !== "true"
  ) {
    return undefined;
  }

  return new PolicyGovernanceExecutionVerifier(
    policyChangeApprovalRecordRepository,
    new PolicyChangeCrypto(),
  );
}
