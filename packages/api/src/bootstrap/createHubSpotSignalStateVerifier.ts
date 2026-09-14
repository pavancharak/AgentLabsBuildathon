import { ApprovalVerifier } from "@parmana/approval";
import {
  CryptoBootstrap,
  DEFAULT_KEY_ID,
  FileKeyProvider,
} from "@parmana/crypto";
import { HubSpotSignalStateVerifier } from "@parmana/connector-hubspot";
import type { SignalStateVerifier } from "@parmana/policy";
import type { ExecutionSystem } from "@parmana/execution-system";

import { loadConfig } from "@parmana/shared";

import { createApprovalIssuerRegistry } from "./createApprovalIssuerRegistry.js";
import { createApprovalNonceStore } from "./createApprovalNonceStore.js";

/**
 * Creates the production Signal/State Verifier for the
 * hubspot-deal-update capability (G-24 residual closure, RFC-0022;
 * TD-23 preAuthorizedForAmountChange closure, Phase 3C). Signs its own
 * independent verification fetches with the same signing key and
 * key-loading mechanism RuntimeAuthorizationSigner already uses
 * (FileKeyProvider, keyId "default") -- lazily, on each call -- so
 * this stays a plain, synchronous constructor with no new async
 * wiring at startup.
 *
 * approvalVerifier is always supplied here (never omitted) -- the
 * production wiring path is where independent verification of
 * preAuthorizedForAmountChange becomes a structural invariant rather
 * than an optional, caller-declared signal; omitting it is only ever
 * done by tests that construct HubSpotSignalStateVerifier directly.
 */
export function createHubSpotSignalStateVerifier(
  executionSystem: ExecutionSystem,
): SignalStateVerifier {
  const { ttlSeconds: authorizationTtlSeconds } = loadConfig().authorization;

  const crypto = CryptoBootstrap.create();

  return new HubSpotSignalStateVerifier({
    gateway: executionSystem,
    keys: new FileKeyProvider(),
    signerKeyId: DEFAULT_KEY_ID,
    policyName: "hubspot-deal-update",
    policyVersion: "1.0.0",
    crypto,
    authorizationTtlSeconds,
    approvalVerifier: new ApprovalVerifier({
      crypto,
      issuerRegistry: createApprovalIssuerRegistry(),
      nonceStore: createApprovalNonceStore(),
    }),
  });
}
