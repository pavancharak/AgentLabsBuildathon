import {
  ExecutionControlService,
  GatewayAttestationSigner,
  RandomIdGenerator,
  SessionCredentialExecutionControl,
  SystemClock,
  type ExecutionControl,
} from "@parmana/execution-control";
import {
  createSessionStore,
  gatewaySessionIssuanceAuthentication,
} from "./createSessionStore.js";
import { createGatewayIdentity } from "./createGatewayIdentity.js";
import { createGatewayKeyPair } from "./createGatewayKeyPair.js";
import { createConnectorAuthenticator } from "./createConnectorAuthenticator.js";
import { createConnectorRegistry } from "./createConnectorRegistry.js";

import { createExecutionAuditSink } from "./createExecutionAuditSink.js";

/**
 * Constructs the production ExecutionControlService, wrapped in
 * SessionCredentialExecutionControl so no GatewaySession can be created
 * without first passing a request-bound Gateway attestation check.
 */
export function createExecutionControl(): ExecutionControl {
  const gatewayIdentity = createGatewayIdentity();

  const authenticator = createConnectorAuthenticator();

  const sessions = createSessionStore();

  const audit = createExecutionAuditSink();

  //
  // Static, registration-time attestation for each connector's own
  // defense-in-depth check (see createConnectorRegistry.ts). Not
  // request-bound — the request-bound check happens below, at
  // SessionCredentialExecutionControl.
  //
  const { privateKey: gatewayPrivateKey } = createGatewayKeyPair();

  const attestationSigner = new GatewayAttestationSigner(
    new SystemClock(),
    new RandomIdGenerator(),
  );

  const registrationAttestation = attestationSigner.sign(
    gatewayIdentity.gatewayId,
    "registration",
    gatewayPrivateKey,
  );

  const registry = createConnectorRegistry(
    authenticator,
    sessions,
    audit,
    registrationAttestation,
  );

  const inner = new ExecutionControlService({
    gatewayIdentity,
    authenticator,
    registry,
    sessions,

    //
    // Governs GatewaySession issuance calls within this same process
    // (ExecutionControlService <-> InMemoryGatewaySessionStore), a
    // separate, narrower trust boundary from gatewayAuthentication
    // above. Tracked in the notes list as a same-process-only check.
    //
    sessionIssuanceAuthentication: gatewaySessionIssuanceAuthentication,

    audit,
  });

  return new SessionCredentialExecutionControl({
    gatewayIdentity,
    authenticator,
    inner,
  });
}
