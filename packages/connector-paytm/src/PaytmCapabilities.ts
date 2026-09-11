import type { ConnectorCapabilities } from "@parmana/connector-sdk";

/**
 * Paytm capability identifiers and connector-configuration/parameter
 * DTOs. Pure metadata -- no execution logic. The executable connector
 * (GatewayPaytmAdapter) lives in @parmana/execution-gateway and imports
 * these back from here (Phase 1C, mirrors @parmana/connector-hubspot).
 *
 * Exactly one capability is declared, matching exactly what the
 * connector implements -- refunding a specific, already-charged Paytm
 * order/transaction. There is no "paytm:*" wildcard and no additional
 * Paytm capability (charge, payout, settlement query, ...) declared
 * here; adding one is a deliberate, separate milestone, not an
 * incidental side effect of this one.
 */
export const PAYTM_REFUND_CAPABILITY = "paytm:refund";

export interface PaytmConnectorOptions {
  readonly connectorId: string;
  readonly capabilities: ConnectorCapabilities;

  /**
   * Base URL of the trusted, out-of-process Paytm connector service
   * (parmana-paytm-agent), e.g. https://paytm-connector.internal.example.com.
   * Required -- unlike HubSpot/GitHub there is no real-vendor default:
   * this connector never talks to Paytm's own API directly, only to
   * Parmana's own connector service, which is the only thing that ever
   * holds a real Paytm merchant key.
   */
  readonly baseUrl: string;
}

export interface PaytmRefundParameters {
  /** The Paytm Order ID the original transaction belongs to. */
  readonly orderId: string;
  /** The original Paytm transaction id being refunded. */
  readonly transactionId: string;
  /** Refund amount, in the same currency unit customer-refund's policy evaluates (boundSignals: parameters.amount). */
  readonly amount: number;
  /** Optional, human-readable refund reason forwarded for the connector service's own audit trail. */
  readonly refundReason?: string;
}
