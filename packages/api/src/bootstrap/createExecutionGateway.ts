import { ExecutionGateway } from "@parmana/execution-gateway";

import {
  FileKeyExpiryStore,
  SignerBootstrap,
  SignerKeyProviderAdapter,
} from "@parmana/crypto";

import {
  GatewayAttestationSigner,
  RandomIdGenerator,
  SystemClock,
} from "@parmana/execution-control";

import type { ExecutionSystem } from "@parmana/execution-system";

import { policyRepository } from "../application.js";

import { createExecutionControl } from "./createExecutionControl.js";
import { createGatewayIdentity } from "./createGatewayIdentity.js";
import { createGatewayKeyPair } from "./createGatewayKeyPair.js";
import { createGatewayPublicKey } from "./createGatewayPublicKey.js";
import { createNonceStore } from "./createNonceStore.js";
import { createPolicyExecutionVerifier } from "./createPolicyExecutionVerifier.js";
import { createConnectorRoute } from "./createConnectorRoute.js";
import { executionGatewaySignalStateVerifier } from "./executionGatewaySignalStateVerifier.js";

/**
 * Constructs the production Execution Gateway.
 *
 * Wires two additive verification checks beyond the envelope's own
 * signature/expiry/TTL/nonce checks:
 *
 * - keyProvider/keyExpiryStore (Gap 2A): authorizations are verified
 *   against the specific keyId they were signed with (via the same
 *   Signer -- wrapped in SignerKeyProviderAdapter, see that file --
 *   this function's own publicKey below resolves through), not only
 *   the one static gateway public key -- enabling verification against
 *   a rotated or additional key without a restart. keyExpiryStore is
 *   additive on top: a keyId with no key-expiry.json entry is always
 *   valid.
 *
 *   Root-cause fix (2026-09-16): keyProvider used to be an
 *   unconditional `new FileKeyProvider()`, regardless of KEY_PROVIDER
 *   -- EnvelopeVerifier.resolveKey() uses keyProvider (when supplied at
 *   all) for EVERY authorization it verifies, not only tenant-scoped
 *   ones, so under KEY_PROVIDER=aws-kms this resolved every
 *   authorization's verification key from a stale local
 *   default.public.pem while the authorization was actually signed by
 *   the real KMS key -- signatures silently, permanently failed to
 *   verify in production. publicKey and keyProvider now share one
 *   Signer instance, so signing and per-authorization verification are
 *   guaranteed to agree on the same backend.
 * - policyRepository (Gap 1B): reuses application.ts's own
 *   `policyRepository` singleton -- the same FilePolicyRepository
 *   instance (and therefore the same PARMANA_POLICY_DIR) governance
 *   writes through -- so ExecutionGateway can recompute the current
 *   content hash of the policy an authorization was signed under and
 *   refuse execution if it no longer matches.
 * - signalStateVerifier (G-31): wires the shared
 *   executionGatewaySignalStateVerifier late-binding singleton (see its
 *   own doc comment for why this is late-bound rather than constructed
 *   directly here) so the Gateway can independently re-verify, at the
 *   execution boundary, that the runtime signals an authorization was
 *   signed under still match real-world state.
 */
export async function createExecutionGateway(): Promise<ExecutionSystem> {
  const signer = await SignerBootstrap.create();

  const publicKey = await createGatewayPublicKey(signer);

  const keyProvider = new SignerKeyProviderAdapter(signer);

  const keyExpiryStore = new FileKeyExpiryStore();

  const nonceStore = createNonceStore();

  const executionControl = createExecutionControl();

  const route = createConnectorRoute();

  const gatewayIdentity = createGatewayIdentity();

  const { privateKey: gatewayPrivateKey } = createGatewayKeyPair();

  const attestationSigner = new GatewayAttestationSigner(
    new SystemClock(),
    new RandomIdGenerator(),
  );

  //
  // Fail-closed policy binding: undefined only in NODE_ENV test or
  // development (see createPolicyExecutionVerifier.ts). Everywhere else
  // the gateway is constructed without allowUnverifiedPolicy, so it
  // requires the repository and the approval verifier, rejects an
  // authorization with no policyContentHash, and requires the approval
  // record's hash to equal the authorization's and the live hash.
  //
  const policyApprovalVerifier = createPolicyExecutionVerifier();

  return new ExecutionGateway({
    publicKey,
    keyProvider,
    keyExpiryStore,
    nonceStore,
    policyRepository,
    ...(policyApprovalVerifier === undefined
      ? { allowUnverifiedPolicy: true }
      : { policyApprovalVerifier }),
    signalStateVerifier: executionGatewaySignalStateVerifier,

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
