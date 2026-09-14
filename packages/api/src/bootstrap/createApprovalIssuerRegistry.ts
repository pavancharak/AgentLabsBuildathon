import { createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { StaticApprovalIssuerRegistry } from "@parmana/approval";
import type {
  ApprovalIssuerRegistry,
  TrustedApprovalIssuer,
} from "@parmana/approval";
import { loadConfig } from "@parmana/shared";

interface ConfiguredApprovalIssuer {
  readonly approverId: string;
  readonly keyId: string;
  readonly revoked: boolean;
}

/**
 * Trusted Approval Artifact issuers (TD-23 closure, Phase 3C).
 *
 * Configured here, mirroring createConnectorAuthenticator.ts's own
 * hardcoded trusted-connector-identity list exactly: provisioning a
 * new approver, or revoking/rotating an existing one's key, means
 * adding or editing an entry here and deploying -- the same
 * operational model already established for trusted connector
 * identities. A self-service onboarding flow for approvers is
 * deliberately out of scope (see
 * docs/architecture/phase3a-authorization-artifact-design.md §17,
 * Open Question #1) -- this list only verifies against whatever
 * entries it is deployed with.
 *
 * Empty by default: no real business-approver key has been
 * provisioned yet. This is the correct fail-closed starting state --
 * every preAuthorizedForAmountChange claim is rejected
 * (ApprovalVerifier.verify's issuerKnown check fails for every
 * artifact) until an operator adds a real entry here and provisions
 * the matching public key file below, rather than silently trusting
 * an unconfigured default.
 */
const TRUSTED_APPROVAL_ISSUERS: readonly ConfiguredApprovalIssuer[] = [];

/**
 * Creates the ApprovalIssuerRegistry used by the ApprovalVerifier
 * wired into HubSpotSignalStateVerifier.
 *
 * Each configured issuer's public key is loaded the same way
 * createGatewayKeyPair.ts loads the Gateway's own keypair: a PEM file
 * under PARMANA_KEY_DIR, generated out-of-band (never generated
 * automatically). Scoped to its own approval-issuers/ subdirectory,
 * distinct from the Gateway's and RuntimeAuthorizationSigner's own
 * key files, since these are a different trust domain entirely (an
 * external business approver's key, never Parmana's own runtime key).
 */
export function createApprovalIssuerRegistry(): ApprovalIssuerRegistry {
  if (TRUSTED_APPROVAL_ISSUERS.length === 0) {
    return new StaticApprovalIssuerRegistry([]);
  }

  const config = loadConfig();

  if (!config.keys.keyDirectory) {
    throw new Error("PARMANA_KEY_DIR is not configured.");
  }

  const issuers: TrustedApprovalIssuer[] = TRUSTED_APPROVAL_ISSUERS.map(
    ({ approverId, keyId, revoked }) => {
      const publicKeyPath = join(
        config.keys.keyDirectory as string,
        "approval-issuers",
        `${approverId}__${keyId}.public.pem`,
      );

      if (!existsSync(publicKeyPath)) {
        throw new Error(
          `Approval issuer public key not found: ${publicKeyPath}. Provision it before starting -- ` +
            "no key is generated automatically.",
        );
      }

      return {
        approverId,
        keyId,
        publicKey: createPublicKey(readFileSync(publicKeyPath, "utf8")),
        revoked,
      };
    },
  );

  return new StaticApprovalIssuerRegistry(issuers);
}
