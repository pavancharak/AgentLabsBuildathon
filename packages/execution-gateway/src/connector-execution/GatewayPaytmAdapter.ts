import type {
  Connector,
  ConnectorCapabilities,
  ConnectorExecutionContext,
  ConnectorRequest,
  ConnectorResponse,
} from "@parmana/connector-sdk";

import {
  PAYTM_REFUND_CAPABILITY,
  type PaytmConnectorOptions,
} from "@parmana/connector-paytm";

import {
  PAYTM_ALLOWED_REFUND_PARAMETERS,
  PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET,
  isPaytmConnectorCredentialValue,
  isPaytmRefundExecutionResult,
  redactPaytmConnectorSecret,
} from "@parmana/connector-paytm";

const PAYTM_REFUND_PATH = "/connector/paytm-refund";

/**
 * Paytm connector: forwards an already Parmana-authorized paytm:refund
 * ConnectorRequest to the trusted, out-of-process Paytm connector
 * service (parmana-paytm-agent) over HTTPS, and validates what comes
 * back before trusting it as execution evidence.
 *
 * This is a REMOTE connector, unlike GatewayHubSpotAdapter/
 * GatewayGitHubAdapter which call the vendor's real API in-process:
 *
 *   Parmana Execution Gateway -> RemotePaytmConnector (this class)
 *     -> HTTPS -> PAYTM_CONNECTOR_URL/connector/paytm-refund
 *     -> (a separate, trusted service) -> Paytm /refund/apply
 *
 * This connector never calls Paytm's own API, never holds
 * PAYTM_MERCHANT_KEY, and never re-runs authorization -- the request it
 * forwards is exactly the ConnectorRequest the Gateway already verified
 * against the signed, policy-approved envelope. Paytm's own merchant
 * key and checksum verification live exclusively inside the connector
 * service; the shared secret this class sends is transport
 * authentication between Parmana and its own connector service, not a
 * substitute for Parmana's policy authorization and not Paytm
 * authentication itself. See docs/connectors/PAYTM_CONNECTOR.md.
 *
 * Deny-by-default, structurally: PAYTM_ALLOWED_REFUND_PARAMETERS is the
 * only set of parameter names this connector will ever forward. A
 * request naming any other parameter is refused before any network
 * call, not silently dropped.
 *
 * Response-validation, structurally: the connector service's response
 * must echo back businessTransactionId, capability, orderId, and
 * transactionId exactly as sent. Any mismatch is refused -- this
 * connector never accepts a response at face value as proof it
 * corresponds to the request that produced it (defends against a
 * misrouted, replayed, or malicious response).
 */
export class GatewayPaytmAdapter implements Connector {
  readonly connectorId: string;
  readonly capabilities: ConnectorCapabilities;
  private readonly baseUrl: string;

  constructor(private readonly options: PaytmConnectorOptions) {
    this.connectorId = options.connectorId;
    this.capabilities = options.capabilities;
    this.baseUrl = options.baseUrl;

    // Fail closed at construction, not per-request: a production
    // process must never even register a Paytm connector pointed at a
    // plaintext endpoint. NODE_ENV=test is exempt so the hermetic mock
    // server (http://127.0.0.1:<port>) keeps working.
    if (
      process.env.NODE_ENV !== "test" &&
      !this.baseUrl.startsWith("https://")
    ) {
      throw new Error(
        `PaytmConnector "${this.connectorId}" requires an HTTPS PAYTM_CONNECTOR_URL in production; ` +
          `received "${this.baseUrl}". Refusing to register a connector that would send a governed ` +
          "refund request over plaintext HTTP.",
      );
    }

    Object.freeze(this);
  }

  async execute(
    request: ConnectorRequest,
    context: ConnectorExecutionContext,
  ): Promise<ConnectorResponse> {
    if (!this.capabilities.includes(request.capability)) {
      throw new Error(
        `PaytmConnector "${this.connectorId}" does not declare capability "${request.capability}".`,
      );
    }

    if (request.capability !== PAYTM_REFUND_CAPABILITY) {
      throw new Error(
        `PaytmConnector "${this.connectorId}" has no handler for capability "${request.capability}".`,
      );
    }

    if (!isPaytmConnectorCredentialValue(context.credential.value)) {
      throw new Error(
        `PaytmConnector "${this.connectorId}" received a credential that is not a resolved connector shared secret.`,
      );
    }
    const { sharedSecret } = context.credential.value;

    // Never rely on the far side happening to reject a test-mode
    // placeholder -- refuse outright unless the target is plainly local
    // (a hermetic mock server). See PaytmTypes.ts's comment on
    // PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET.
    const isLocalTarget =
      this.baseUrl.startsWith("http://127.0.0.1") ||
      this.baseUrl.startsWith("http://localhost");
    if (
      !isLocalTarget &&
      sharedSecret === PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET
    ) {
      throw new Error(
        `PaytmConnector "${this.connectorId}" refuses to send the built-in test-mode placeholder shared ` +
          `secret to a non-local endpoint (${this.baseUrl}). Configure TEST_PAYTM_CONNECTOR_SHARED_SECRET ` +
          "(or PAYTM_CONNECTOR_SHARED_SECRET in production) with a real shared secret, or point " +
          "PAYTM_CONNECTOR_URL at a local mock server.",
      );
    }

    const disallowedKeys = Object.keys(request.parameters).filter(
      (key) =>
        !(PAYTM_ALLOWED_REFUND_PARAMETERS as readonly string[]).includes(key),
    );
    if (disallowedKeys.length > 0) {
      throw new Error(
        `PaytmConnector "${this.connectorId}" refuses to forward unsupported refund ` +
          `parameter${disallowedKeys.length === 1 ? "" : "s"} ${disallowedKeys.map((key) => `"${key}"`).join(", ")}. ` +
          `Only ${PAYTM_ALLOWED_REFUND_PARAMETERS.join(", ")} are forwarded this milestone.`,
      );
    }

    const orderId = requireString(
      request.parameters.orderId,
      "parameters.orderId",
    );
    const transactionId = requireString(
      request.parameters.transactionId,
      "parameters.transactionId",
    );
    requireNumber(request.parameters.amount, "parameters.amount");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), context.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${PAYTM_REFUND_PATH}`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sharedSecret}`,
        },
        body: JSON.stringify({
          businessTransactionId: request.businessTransactionId,
          capability: request.capability,
          action: request.action,
          target: request.target,
          parameters: request.parameters,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `PaytmConnector "${this.connectorId}" request to the Paytm connector service failed with HTTP ${response.status}.`,
        );
      }

      const body: unknown = await response.json().catch(() => undefined);

      if (!isPaytmRefundExecutionResult(body)) {
        throw new Error(
          `PaytmConnector "${this.connectorId}" received a malformed response from the Paytm connector ` +
            "service -- missing or invalid required fields.",
        );
      }

      // Never accept the response at face value as proof it corresponds
      // to this request -- every identifying field must echo back
      // exactly, or this is refused as a binding-validation failure.
      const mismatches: string[] = [];
      if (body.businessTransactionId !== request.businessTransactionId)
        mismatches.push("businessTransactionId");
      if (body.capability !== request.capability) mismatches.push("capability");
      if (body.orderId !== orderId) mismatches.push("orderId");
      if (body.transactionId !== transactionId)
        mismatches.push("transactionId");

      if (mismatches.length > 0) {
        throw new Error(
          `PaytmConnector "${this.connectorId}" refuses a connector-service response whose ` +
            `${mismatches.join(", ")} did not match the request that was sent -- binding validation failed.`,
        );
      }

      const sharedSecretRedacted = redactPaytmConnectorSecret(sharedSecret);

      if (body.status === "completed" && body.success) {
        return {
          success: true,
          metadata: {
            refId: body.refId,
            status: body.status,
            orderId: body.orderId,
            transactionId: body.transactionId,
            sharedSecretRedacted,
          },
        };
      }

      // "ambiguous": Paytm's own execution outcome could not be
      // determined by the connector service. This is deliberately NOT
      // thrown -- throwing here would look like a transient
      // infrastructure error to anything upstream that retries on
      // exception, which is exactly the dangerous behavior that could
      // mint a second refId for the same logical refund. Returned as a
      // clean, non-throwing ConnectorResponse instead, so it is
      // recorded as execution evidence and requires deliberate
      // reconciliation rather than an automatic retry. See
      // docs/connectors/PAYTM_CONNECTOR.md.
      return {
        success: false,
        metadata: {
          refId: body.refId,
          status: body.status,
          orderId: body.orderId,
          transactionId: body.transactionId,
          requiresReconciliation: body.status === "ambiguous",
          sharedSecretRedacted,
        },
      };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(
          `PaytmConnector "${this.connectorId}" request to capability "${request.capability}" ` +
            `timed out after ${context.timeoutMs}ms.`,
          { cause: error },
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `PaytmConnector request is missing required field "${field}".`,
    );
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `PaytmConnector request field "${field}" must be a finite number.`,
    );
  }
  return value;
}
