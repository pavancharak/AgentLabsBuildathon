import {
  ExecutionGateway,
} from "@parmana/execution-gateway";

import {
  FileKeyExpiryStore,
  FileKeyProvider,
} from "@parmana/crypto";

import {
  GatewayAttestationSigner,
  RandomIdGenerator,
  SystemClock,
} from "@parmana/execution-control";

import type {
  ExecutionSystem,
} from "@parmana/execution-system";

import { policyRepository } from "../application.js";

import { createExecutionControl } from "./createExecutionControl.js";
import { createGatewayIdentity } from "./createGatewayIdentity.js";
import { createGatewayKeyPair } from "./createGatewayKeyPair.js";
import { createGatewayPublicKey } from "./createGatewayPublicKey.js";
import { createNonceStore } from "./createNonceStore.js";
import { createConnectorRoute } from "./createConnectorRoute.js";

/**
 * Constructs the production Execution Gateway.
 *
 * Wires two additive verification checks beyond the envelope's own
 * signature/expiry/TTL/nonce checks:
 *
 * - keyProvider/keyExpiryStore (Gap 2A): authorizations are verified
 *   against the specific keyId they were signed with (via the same
 *   FileKeyProvider FileKeyProvider.getPublicKey already supports
 *   arbitrary keyId lookup for), not only the one static gateway
 *   public key -- enabling verification against a rotated or
 *   additional key without a restart. keyExpiryStore is additive on
 *   top: a keyId with no key-expiry.json entry is always valid.
 * - policyRepository (Gap 1B): reuses application.ts's own
 *   `policyRepository` singleton -- the same FilePolicyRepository
 *   instance (and therefore the same PARMANA_POLICY_DIR) governance
 *   writes through -- so ExecutionGateway can recompute the current
 *   content hash of the policy an authorization was signed under and
 *   refuse execution if it no longer matches.
 */
export function createExecutionGateway(): ExecutionSystem {
  const publicKey =
    createGatewayPublicKey();

  const keyProvider =
    new FileKeyProvider();

  const keyExpiryStore =
    new FileKeyExpiryStore();

  const nonceStore =
    createNonceStore();

  const executionControl =
    createExecutionControl();

  const route =
    createConnectorRoute();

  const gatewayIdentity =
    createGatewayIdentity();

  const { privateKey: gatewayPrivateKey } =
    createGatewayKeyPair();

  const attestationSigner =
    new GatewayAttestationSigner(new SystemClock(), new RandomIdGenerator());

  return new ExecutionGateway({
    publicKey,
    keyProvider,
    keyExpiryStore,
    nonceStore,
    policyRepository,

    executionControl: {
      service: executionControl,

      //
      // Mints a fresh, request-bound attestation per call — see
      // ExecutionControlOptions.mintGatewayAuthentication.
      //
      mintGatewayAuthentication: (authorizationId) =>
        attestationSigner.sign(
          gatewayIdentity.gatewayId,
          authorizationId,
          gatewayPrivateKey,
        ),

      route,
    },
  });
}