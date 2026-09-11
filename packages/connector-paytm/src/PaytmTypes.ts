/**
 * Paytm domain types.
 *
 * Scoped narrowly to this milestone: forwarding a governed refund
 * request to the trusted, out-of-process Paytm connector service
 * (parmana-paytm-agent) and validating what it returns. This package
 * never models Paytm's own /refund/apply wire shape -- that shape,
 * Paytm's merchant key, and Paytm's own checksum verification live
 * exclusively inside the connector service, never inside Parmana.
 */

import { createHash } from "node:crypto";

/**
 * Deny-by-default: the only paytm:refund parameter names this
 * connector will ever forward in a request body. Any other parameter
 * name present in a request's parameters is refused before any network
 * call -- see GatewayPaytmAdapter.execute.
 */
export const PAYTM_ALLOWED_REFUND_PARAMETERS = Object.freeze([
  "orderId",
  "transactionId",
  "amount",
  "refundReason",
] as const);

export type PaytmAllowedRefundParameter =
  (typeof PAYTM_ALLOWED_REFUND_PARAMETERS)[number];

/**
 * The built-in test-mode placeholder shared secret
 * (createPaytmCredentialProvider.ts's fallback when no real test-mode
 * secret is configured). Exported here, shared by both that fallback
 * and GatewayPaytmAdapter's own fail-closed guard against sending it to
 * a non-local endpoint, so the two sides can never drift apart into
 * comparing different literals.
 *
 * This guard exists for the same reason HubSpotTypes.ts's
 * HUBSPOT_TEST_MODE_PLACEHOLDER_TOKEN does (see that file's comment,
 * and docs/CLAIMS.md 3.4 on the Razorpay incident this pattern closes):
 * never rely on the far side happening to reject a test-mode
 * placeholder -- refuse to send it outright to anything that isn't
 * plainly a local/mock endpoint.
 */
export const PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET =
  "paytm-connector-test-mode-placeholder";

export interface PaytmConnectorCredentialValue {
  /**
   * The shared secret Parmana's gateway authenticates itself to the
   * remote Paytm connector service with (PAYTM_CONNECTOR_SHARED_SECRET).
   * This is transport authentication between Parmana and its own
   * connector service -- it is never Paytm's merchant key, and it never
   * substitutes for Parmana's own policy authorization.
   */
  readonly sharedSecret: string;
}

export function isPaytmConnectorCredentialValue(
  value: unknown,
): value is PaytmConnectorCredentialValue {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sharedSecret === "string" &&
    candidate.sharedSecret.length > 0
  );
}

/**
 * One-way fingerprint of the connector shared secret, safe to place in
 * receipts and caller-visible execution evidence: a truncated SHA-256
 * digest, never a literal substring of the secret. Mirrors
 * redactHubSpotToken's fix (Phase 3D certification) from this
 * connector's first version -- never a truncated-but-literal prefix.
 */
export function redactPaytmConnectorSecret(secret: string): string {
  return `fp_${createHash("sha256").update(secret).digest("hex").slice(0, 12)}`;
}

/**
 * The three Paytm-execution outcomes the connector service reports.
 * "ambiguous" is not an error -- it means Paytm's own execution status
 * could not be determined (e.g. a timeout on the connector-service ->
 * Paytm leg, or a checksum mismatch on Paytm's response). It must never
 * be treated as either success or a transient failure safe to retry --
 * see GatewayPaytmAdapter.execute and docs/connectors/PAYTM_CONNECTOR.md.
 */
export type PaytmRefundExecutionStatus = "completed" | "ambiguous" | "failed";

/**
 * The response body the trusted Paytm connector service returns from
 * POST /connector/paytm-refund. Every identifying field here is
 * expected to echo the exact request this connector sent -- see
 * PAYTM_RESPONSE_ECHOED_FIELDS and GatewayPaytmAdapter's response
 * validation, which fails closed on any mismatch instead of trusting
 * the response as proof it corresponds to this request.
 */
export interface PaytmRefundExecutionResult {
  readonly success: boolean;
  readonly status: PaytmRefundExecutionStatus;
  /**
   * Paytm's refId for this logical refund. Deterministically derived by
   * the connector service from (orderId, transactionId) -- a retry of
   * the same logical refund must receive the SAME refId back, never a
   * newly minted one. This connector never generates a refId itself.
   */
  readonly refId: string;
  readonly businessTransactionId: string;
  readonly capability: string;
  readonly orderId: string;
  readonly transactionId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

const REFUND_EXECUTION_STATUSES: readonly PaytmRefundExecutionStatus[] = [
  "completed",
  "ambiguous",
  "failed",
];

export function isPaytmRefundExecutionResult(
  value: unknown,
): value is PaytmRefundExecutionResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.success === "boolean" &&
    typeof candidate.status === "string" &&
    REFUND_EXECUTION_STATUSES.includes(
      candidate.status as PaytmRefundExecutionStatus,
    ) &&
    typeof candidate.refId === "string" &&
    candidate.refId.length > 0 &&
    typeof candidate.businessTransactionId === "string" &&
    typeof candidate.capability === "string" &&
    typeof candidate.orderId === "string" &&
    typeof candidate.transactionId === "string"
  );
}
