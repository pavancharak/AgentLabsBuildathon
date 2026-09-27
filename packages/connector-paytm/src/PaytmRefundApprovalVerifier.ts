import { isSignedApprovalShape } from "@parmana/approval";
import type { ApprovalVerifier } from "@parmana/approval";
import type {
  PolicySignals,
  SignalStateVerificationRequest,
  SignalStateVerifier,
  SignalStateViolation,
} from "@parmana/policy";

import { PAYTM_REFUND_CAPABILITY } from "./PaytmCapabilities.js";

/**
 * Verifies the managerApproved signal of a paytm:refund request
 * against a signed Approval Artifact (G-65, G-51), instead of trusting
 * the caller's own true.
 *
 * When the caller declares managerApproved: true, signals.approvalArtifact
 * must hold a SignedApproval that ApprovalVerifier accepts for
 * paytm:refund, for this order (parameters.orderId), with a scope that
 * covers this amount (parameters.amount). Both values come from the
 * Intent, never from the caller's signals, so an approval for a small
 * refund, or for another order, cannot authorize this one. Anything
 * else is a violation, and RuntimeEngine refuses the request.
 *
 * When managerApproved is not true there is nothing to verify: the
 * customer-refund policy decides whether the refund needs an approval.
 *
 * Fails closed: a missing order id or amount, a malformed artifact, or
 * any failed check is a violation.
 */
export class PaytmRefundApprovalVerifier implements SignalStateVerifier {
  constructor(private readonly approvalVerifier: ApprovalVerifier) {}

  async findViolations(
    request: SignalStateVerificationRequest,
    signals: PolicySignals,
  ): Promise<readonly SignalStateViolation[]> {
    if (request.action !== PAYTM_REFUND_CAPABILITY) {
      return [];
    }

    const declaredValue = signals.managerApproved;

    if (declaredValue !== true) {
      return [];
    }

    const orderId = request.intentParameters?.orderId;
    const amount = request.intentParameters?.amount;

    if (typeof orderId !== "string" || orderId.length === 0) {
      return [
        {
          signalKey: "managerApproved",
          declaredValue,
          actualValue:
            "<missing: parameters.orderId is required to verify an approval>",
        },
      ];
    }

    if (typeof amount !== "number") {
      return [
        {
          signalKey: "managerApproved",
          declaredValue,
          actualValue:
            "<missing: parameters.amount is required to verify an approval>",
        },
      ];
    }

    const artifact = signals.approvalArtifact;

    const actualValue = isSignedApprovalShape(artifact)
      ? (
          await this.approvalVerifier.verify(artifact, {
            action: PAYTM_REFUND_CAPABILITY,
            resourceId: orderId,
            requestedValue: amount,
            // Consumed once, at authorization. See
            // SignalStateVerificationRequest.stage.
            consumeNonce: request.stage !== "release",
          })
        ).valid
      : false;

    if (actualValue !== declaredValue) {
      return [{ signalKey: "managerApproved", declaredValue, actualValue }];
    }

    return [];
  }
}
