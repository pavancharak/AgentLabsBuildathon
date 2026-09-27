import { createPublicKey, type KeyObject } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { StaticApprovalIssuerRegistry } from "@parmana/approval";
import type {
  ApprovalIssuerRegistry,
  TrustedApprovalIssuer,
} from "@parmana/approval";
import { loadConfig } from "@parmana/shared";

export interface ConfiguredApprovalIssuer {
  readonly approverId: string;
  readonly keyId: string;
  readonly revoked: boolean;

  /**
   * The approver's Ed25519 public key as PEM, written here in the entry.
   * Public keys are not secret, and this list is reviewed code. This is
   * the way to provision an approver where the server cannot read
   * files you add, such as on Vercel. When absent, the key is read from
   * $PARMANA_KEY_DIR/approval-issuers/<approverId>__<keyId>.public.pem.
   */
  readonly publicKeyPem?: string;
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
 * the matching public key (inline as publicKeyPem, or as a file
 * below), rather than silently trusting an unconfigured default.
 *
 * To add an approver: they run scripts/generate-approver-key.ts on their
 * own machine and send the .public.pem file; paste its contents into
 * publicKeyPem, open a pull request, deploy. To revoke: revoked: true.
 */
const TRUSTED_APPROVAL_ISSUERS: readonly ConfiguredApprovalIssuer[] = [];

/**
 * Creates the ApprovalIssuerRegistry used by the ApprovalVerifier every
 * approval check shares (createApprovalVerifier.ts).
 */
export function createApprovalIssuerRegistry(): ApprovalIssuerRegistry {
  return buildApprovalIssuerRegistry(TRUSTED_APPROVAL_ISSUERS, () => {
    const config = loadConfig();

    if (!config.keys.keyDirectory) {
      throw new Error("PARMANA_KEY_DIR is not configured.");
    }

    return config.keys.keyDirectory;
  });
}

/**
 * Builds the registry from configured entries. A key is taken from the
 * entry's publicKeyPem when present, otherwise from its file under
 * approval-issuers/ in the key directory, which is looked up only when
 * a file is needed. Fails closed at startup: a missing file, an
 * unparseable key, a key that is not Ed25519 (approvals are verified
 * with Ed25519 only, APPROVAL_ARTIFACT_CRYPTO_PROVIDER), or the same
 * approver and key id twice stops the server.
 */
export function buildApprovalIssuerRegistry(
  entries: readonly ConfiguredApprovalIssuer[],
  keyDirectory: () => string,
): ApprovalIssuerRegistry {
  const seen = new Set<string>();

  const issuers: TrustedApprovalIssuer[] = entries.map(
    ({ approverId, keyId, revoked, publicKeyPem }) => {
      const label = `${approverId}__${keyId}`;

      if (seen.has(label)) {
        throw new Error(
          `Approval issuer ${approverId} with key ${keyId} is listed twice.`,
        );
      }

      seen.add(label);

      let pem = publicKeyPem;

      if (pem === undefined) {
        const publicKeyPath = join(
          keyDirectory(),
          "approval-issuers",
          `${label}.public.pem`,
        );

        if (!existsSync(publicKeyPath)) {
          throw new Error(
            `Approval issuer public key not found: ${publicKeyPath}. Provision it, or put it in the entry as publicKeyPem, before starting -- ` +
              "no key is generated automatically.",
          );
        }

        pem = readFileSync(publicKeyPath, "utf8");
      }

      let publicKey: KeyObject;

      try {
        publicKey = createPublicKey(pem);
      } catch (error) {
        throw new Error(
          `Approval issuer ${approverId} key ${keyId}: the public key is not a valid PEM public key (${error instanceof Error ? error.message : String(error)}).`,
          { cause: error },
        );
      }

      if (publicKey.asymmetricKeyType !== "ed25519") {
        throw new Error(
          `Approval issuer ${approverId} key ${keyId}: the public key is ${publicKey.asymmetricKeyType}, but approval keys must be Ed25519.`,
        );
      }

      return { approverId, keyId, publicKey, revoked };
    },
  );

  return new StaticApprovalIssuerRegistry(issuers);
}
