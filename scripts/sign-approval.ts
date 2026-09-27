import { readFileSync, writeFileSync } from "node:fs";
import { createPrivateKey } from "node:crypto";

import { ApprovalArtifactSigner } from "@parmana/crypto";
import type { ApprovalScope, SignedApproval } from "@parmana/shared";

/**
 * Signs an Approval Artifact: one approver approving one action on one
 * resource, up to an amount, for a limited time, once.
 *
 * Run by the approver on their own machine, against the private key
 * from scripts/generate-approver-key.ts. It never talks to the API. It
 * prints the approval as JSON, or with --out writes only the JSON to a
 * file; the agent sends it as signals.approvalArtifact on a new request,
 * with managerApproved: true for a refund.
 *
 * Usage, approving a refund of up to 75000 on order ORD-1042:
 *   npx tsx scripts/sign-approval.ts \
 *     --private-key-file ~/.parmana/manager-priya__manager-priya-key-1.private.pem \
 *     --approver-id manager-priya \
 *     --key-id manager-priya-key-1 \
 *     --capability paytm:refund \
 *     --resource-id ORD-1042 \
 *     --max-amount 75000  *     --out approval.json
 *
 * The resource is the order id for paytm:refund and the deal id for
 * hubspot:deal-update. --max-amount is compared with the refund amount
 * for paytm:refund and with the absolute amount change for
 * hubspot:deal-update.
 */

export const DEFAULT_TTL_SECONDS = 900;
export const MAX_TTL_SECONDS = 86_400;

const SCOPE_FIELD_BY_CAPABILITY: Readonly<Record<string, string>> = {
  "paytm:refund": "amount",
  "hubspot:deal-update": "amountDeltaAbs",
};

export interface SignApprovalArguments {
  readonly privateKeyFile: string;
  readonly approverId: string;
  readonly keyId: string;
  readonly capability: string;
  readonly resourceId: string;
  readonly maxAmount: number;
  readonly ttlSeconds: number;
  readonly out?: string;
}

function argument(args: string[], name: string): string {
  const index = args.indexOf(name);

  if (index === -1 || index + 1 >= args.length) {
    throw new Error(`Missing argument: ${name}`);
  }

  return args[index + 1];
}

export function parseSignApprovalArguments(
  args: string[],
): SignApprovalArguments {
  const capability = argument(args, "--capability");

  if (SCOPE_FIELD_BY_CAPABILITY[capability] === undefined) {
    throw new Error(
      `--capability must be one of: ${Object.keys(SCOPE_FIELD_BY_CAPABILITY).join(", ")}`,
    );
  }

  const maxAmount = Number(argument(args, "--max-amount"));

  if (!Number.isFinite(maxAmount) || maxAmount <= 0) {
    throw new Error("--max-amount must be a positive number.");
  }

  const ttlSeconds = args.includes("--ttl-seconds")
    ? Number(argument(args, "--ttl-seconds"))
    : DEFAULT_TTL_SECONDS;

  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds <= 0 ||
    ttlSeconds > MAX_TTL_SECONDS
  ) {
    throw new Error(
      `--ttl-seconds must be a whole number from 1 to ${MAX_TTL_SECONDS}.`,
    );
  }

  const resourceId = argument(args, "--resource-id");

  if (resourceId.length === 0) {
    throw new Error("--resource-id must not be empty.");
  }

  return {
    privateKeyFile: argument(args, "--private-key-file"),
    approverId: argument(args, "--approver-id"),
    keyId: argument(args, "--key-id"),
    capability,
    resourceId,
    maxAmount,
    ttlSeconds,
    ...(args.includes("--out") ? { out: argument(args, "--out") } : {}),
  };
}

export function approvalScope(
  capability: string,
  maxAmount: number,
): ApprovalScope {
  return {
    field: SCOPE_FIELD_BY_CAPABILITY[capability],
    comparator: "lte",
    value: maxAmount,
  };
}

export async function signApproval(
  parsed: SignApprovalArguments,
): Promise<SignedApproval> {
  const privateKey = createPrivateKey(
    readFileSync(parsed.privateKeyFile, "utf8"),
  );

  return new ApprovalArtifactSigner().sign(
    {
      approverId: parsed.approverId,
      keyId: parsed.keyId,
      capability: parsed.capability,
      resourceId: parsed.resourceId,
      scope: approvalScope(parsed.capability, parsed.maxAmount),
      ttlSeconds: parsed.ttlSeconds,
    },
    privateKey,
  );
}

async function main(args = process.argv.slice(2)): Promise<void> {
  try {
    const parsed = parseSignApprovalArguments(args);
    const approval = await signApproval(parsed);

    console.log();
    console.log(
      `Signed approval for ${parsed.capability} on ${parsed.resourceId}, up to ${parsed.maxAmount}, ` +
        `expires ${approval.payload.expiresAt}, usable once.`,
    );
    if (parsed.out !== undefined) {
      writeFileSync(
        parsed.out,
        `${JSON.stringify(approval)}
`,
      );
      console.log(`Written to ${parsed.out}.`);
    } else {
      console.log("--------------------------------");
      console.log('Send this as "approvalArtifact" in the request signals:');
      console.log(JSON.stringify(approval));
    }
    console.log();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.env.NODE_ENV !== "test") {
  void main();
}

export { main };
