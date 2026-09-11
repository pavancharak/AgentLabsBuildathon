/**
 * @parmana/execution-gateway
 *
 * Canonical public API.
 *
 * The Execution Gateway is the sole boundary through which
 * Parmana releases approved execution requests to Connectors,
 * within Parmana-mediated execution for systems integrated
 * behind it (see docs/CLAIMS.md for the exact scope of this
 * claim). It is a new execution boundary built around the
 * existing @parmana/envelope-verifier machinery — it does not
 * modify RuntimeEngine, RuntimePipeline, or any other core
 * decision-flow component. It plugs into the existing
 * ExecutionSystem seam (see @parmana/execution-system) exactly
 * like any other ExecutionSystem implementation.
 */

export * from "./GatewayVerificationResult.js";
export * from "./ConnectorRequest.js";
export * from "./Connector.js";
export * from "./ExecutionGateway.js";
export * from "./HttpConnector.js";
export * from "./deepFreeze.js";
export * from "./connector-runtime/index.js";

/**
 * Connector-execution public surface (Phase 1D).
 *
 * Deliberately NOT `export * from "./connector-execution/index.js"` —
 * that internal barrel also carries GatewayConnectorRegistry,
 * GatewayCapabilityConnectorPolicy, SdkConnectorExecutor,
 * CredentialVaultAdapter, ConnectorEvidence, GatewayHubSpotAdapter, and
 * GatewayHttpAdapter — implementation classes bootstrap composition
 * constructs internally. Only the factory functions and the DTO callers
 * need to build a registration are public.
 */
export {
  createGatewayConnectorRegistry,
  type GatewayConnectorRegistration,
} from "./connector-execution/createGatewayConnectorRegistry.js";
export { createGatewayHubSpotConnector } from "./connector-execution/createGatewayHubSpotConnector.js";
export { createGatewayGitHubConnector } from "./connector-execution/createGatewayGitHubConnector.js";
export {
  createGatewayGitHubCredentialProvider,
} from "./connector-execution/createGatewayGitHubCredentialProvider.js";
export { createGatewayPaytmConnector } from "./connector-execution/createGatewayPaytmConnector.js";
