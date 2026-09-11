/**
 * @parmana/connector-paytm
 *
 * Paytm refund capability definitions, schemas, and mock connector
 * service support for Parmana: forwarding an already-authorized
 * paytm:refund execution to the trusted, out-of-process Paytm connector
 * service (parmana-paytm-agent) -- this milestone's scope (see
 * docs/connectors/PAYTM_CONNECTOR.md). Passive by design -- the
 * executable connector (GatewayPaytmAdapter) is owned by
 * @parmana/execution-gateway (Phase 1C).
 */

export {
  PAYTM_REFUND_CAPABILITY,
  type PaytmConnectorOptions,
  type PaytmRefundParameters,
} from "./PaytmCapabilities.js";

export { PaytmMetadata } from "./PaytmMetadata.js";

export {
  MockPaytmConnectorServer,
  type MockPaytmConnectorServerOptions,
} from "./MockPaytmConnectorServer.js";

export {
  PAYTM_ALLOWED_REFUND_PARAMETERS,
  PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET,
  isPaytmConnectorCredentialValue,
  isPaytmRefundExecutionResult,
  redactPaytmConnectorSecret,
  type PaytmAllowedRefundParameter,
  type PaytmConnectorCredentialValue,
  type PaytmRefundExecutionResult,
  type PaytmRefundExecutionStatus,
} from "./PaytmTypes.js";
