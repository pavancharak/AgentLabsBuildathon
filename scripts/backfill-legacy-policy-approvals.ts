import "dotenv/config";

import crypto from "node:crypto";

import { loadConfig } from "@parmana/shared";
import type { PendingPolicyChange, PolicyChangeApprovalRecord } from "@parmana/shared";
import { PendingPolicyChangeStatus } from "@parmana/shared";
import { PolicyChangeCrypto } from "@parmana/crypto";
import { FilePolicyRepository } from "@parmana/policy";
import { StorageFactory } from "@parmana/storage";
import type { StorageProvider } from "@parmana/storage";

/**
 * One-time, manually-invoked backfill: every (policyName, policyVersion)
 * with a live policy.json but no PolicyChangeApprovalRecord --
 * i.e. every policy that predates Policy Governance (maker-checker),
 * seeded onto disk before the maker-checker approval flow existed --
 * gets exactly one synthetic PendingPolicyChange (proposed and
 * resolved by a fixed system identity, never a real human) and its
 * corresponding signed PolicyChangeApprovalRecord, content unchanged.
 *
 * Why this exists: verifyPolicyGovernanceIntegrityAtStartup.ts and
 * scripts/verify-policy-changes-approved.ts (its own doc comment,
 * "--full-scan will report every policy version that predates Policy
 * Governance ... as unapproved -- expected, not a false positive")
 * both treat "no approval record at all" as permanently out of scope,
 * not as a mismatch to fix -- there is nothing for a legacy policy's
 * live content to be consistent *with*. This script closes that gap
 * once, deliberately, rather than leaving it open indefinitely: after
 * running with --apply, every live policy has an approval record, and
 * both of those checks actually cover the full set of live policies
 * from then on.
 *
 * Deliberately NOT wired into server startup: this mutates the
 * durable approval-record audit trail (and, transitively, the
 * pending-policy-change history), which is exactly the kind of
 * consequential, hard-to-reverse action that should be a deliberate,
 * reviewed, one-time operation -- not implicit background magic that
 * reruns on every boot. Defaults to a dry run; pass --apply to
 * actually write.
 *
 * Never touches the live policy.json itself -- there is nothing to
 * write, since the content a legacy policy already has on disk *is*
 * the content this script attests to. contentHashBefore is
 * deliberately omitted (there is no prior *governed* state to name),
 * and contentHashAfter is the hash of that unchanged content.
 */

const SYSTEM_ACTOR = "system:legacy-policy-backfill";

const BACKFILL_REASON =
  "Legacy policy backfill into Policy Governance -- content unchanged; " +
  "this policy predates the maker-checker approval flow and had no " +
  "PolicyChangeApprovalRecord until this script ran.";

interface BackfillPlanItem {
  readonly policyName: string;
  readonly policyVersion: string;
}

interface BackfillOutcome extends BackfillPlanItem {
  readonly policyChangeApprovalRecordId: string;
  readonly pendingPolicyChangeId: string;
}

async function planBackfill(
  policyRepository: FilePolicyRepository,
  storage: StorageProvider,
): Promise<readonly BackfillPlanItem[]> {
  const allVersions = await policyRepository.listAll();
  const plan: BackfillPlanItem[] = [];

  for (const { name, version } of allVersions) {
    const existing = await storage.policyChangeApprovalRecords.findMostRecentFor(
      name,
      version,
    );

    if (existing === null) {
      plan.push({ policyName: name, policyVersion: version });
    }
  }

  return plan;
}

async function backfillOne(
  item: BackfillPlanItem,
  policyRepository: FilePolicyRepository,
  storage: StorageProvider,
  policyChangeCrypto: PolicyChangeCrypto,
): Promise<BackfillOutcome> {
  const content = await policyRepository.load(item.policyName, item.policyVersion);
  const now = new Date();

  const pendingChange: PendingPolicyChange = {
    pendingPolicyChangeId: crypto.randomUUID(),
    policyName: item.policyName,
    policyVersion: item.policyVersion,
    proposedContent: content as unknown as PendingPolicyChange["proposedContent"],
    proposedBy: SYSTEM_ACTOR,
    proposedAt: now,
    status: PendingPolicyChangeStatus.PENDING_APPROVAL,
    reason: BACKFILL_REASON,
  };

  await storage.pendingPolicyChanges.create(pendingChange);

  const resolved = await storage.pendingPolicyChanges.resolve(
    pendingChange.pendingPolicyChangeId,
    { outcome: "approved", resolvedBy: SYSTEM_ACTOR },
  );

  const contentHashAfter = await policyChangeCrypto.hashPolicyContent(content);

  const draft: Omit<PolicyChangeApprovalRecord, "signature"> = {
    policyChangeApprovalRecordId: crypto.randomUUID(),
    pendingPolicyChangeId: resolved.pendingPolicyChangeId,
    policyName: item.policyName,
    policyVersion: item.policyVersion,
    proposedBy: SYSTEM_ACTOR,
    approvedBy: SYSTEM_ACTOR,
    proposedAt: now,
    approvedAt: now,
    contentHashAfter,
  };

  const signature = await policyChangeCrypto.sign(draft as PolicyChangeApprovalRecord);
  const record: PolicyChangeApprovalRecord = { ...draft, signature };

  const created = await storage.policyChangeApprovalRecords.create(record);

  return {
    ...item,
    policyChangeApprovalRecordId: created.policyChangeApprovalRecordId,
    pendingPolicyChangeId: resolved.pendingPolicyChangeId,
  };
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const apply = argv.includes("--apply");

  const config = loadConfig();
  const policyRepository = new FilePolicyRepository(config.policy.directory);
  const storage = StorageFactory.createFromEnvironment();
  const policyChangeCrypto = new PolicyChangeCrypto();

  const plan = await planBackfill(policyRepository, storage);

  if (plan.length === 0) {
    console.log("No legacy policies found -- every live policy already has an approval record.");
    return;
  }

  console.log(
    `${plan.length} legacy polic${plan.length === 1 ? "y" : "ies"} with no approval record:`,
  );

  for (const item of plan) {
    console.log(`  - ${item.policyName}@${item.policyVersion}`);
  }

  if (!apply) {
    console.log(
      "\nDry run (default) -- no records written. Re-run with --apply to create the " +
        `synthetic PendingPolicyChange + PolicyChangeApprovalRecord (proposedBy/approvedBy ` +
        `'${SYSTEM_ACTOR}') for each policy listed above.`,
    );
    return;
  }

  for (const item of plan) {
    const outcome = await backfillOne(item, policyRepository, storage, policyChangeCrypto);

    console.log(
      `  backfilled ${outcome.policyName}@${outcome.policyVersion} ` +
        `(approval record ${outcome.policyChangeApprovalRecordId})`,
    );
  }

  console.log(`\nDone. ${plan.length} polic${plan.length === 1 ? "y" : "ies"} backfilled.`);
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export { main, planBackfill, backfillOne };
