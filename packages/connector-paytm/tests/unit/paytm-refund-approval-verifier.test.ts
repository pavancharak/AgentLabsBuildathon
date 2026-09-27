import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  ApprovalVerifier,
  StaticApprovalIssuerRegistry,
} from "@parmana/approval";
import {
  APPROVAL_ARTIFACT_CRYPTO_PROVIDER,
  ApprovalArtifactSigner,
} from "@parmana/crypto";
import { MemoryNonceStore } from "@parmana/envelope-verifier";
import type {
  PolicySignals,
  SignalStateVerificationRequest,
} from "@parmana/policy";
import type { SignedApproval } from "@parmana/shared";

import { PaytmRefundApprovalVerifier } from "../../src/PaytmRefundApprovalVerifier.js";

const approverKeys = generateKeyPairSync("ed25519");

function approvalVerifier(): ApprovalVerifier {
  return new ApprovalVerifier({
    crypto: APPROVAL_ARTIFACT_CRYPTO_PROVIDER,
    issuerRegistry: new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-priya",
        keyId: "manager-priya-key-1",
        publicKey: approverKeys.publicKey,
        revoked: false,
      },
    ]),
    nonceStore: new MemoryNonceStore(),
  });
}

function sign(orderId: string, maxAmount: number): Promise<SignedApproval> {
  return new ApprovalArtifactSigner().sign(
    {
      approverId: "manager-priya",
      keyId: "manager-priya-key-1",
      capability: "paytm:refund",
      resourceId: orderId,
      scope: { field: "amount", comparator: "lte", value: maxAmount },
      ttlSeconds: 900,
    },
    approverKeys.privateKey,
  );
}

function refundRequest(
  overrides: Partial<SignalStateVerificationRequest> = {},
): SignalStateVerificationRequest {
  return {
    action: "paytm:refund",
    businessTransactionId: "bt-1",
    intentParameters: { orderId: "order-1", amount: 75_000 },
    ...overrides,
  };
}

function signals(overrides: Partial<PolicySignals> = {}): PolicySignals {
  return {
    refundEligible: true,
    managerApproved: true,
    fraudCheckPassed: true,
    refundAmount: 75_000,
    ...overrides,
  };
}

// The artifact arrives over HTTP as JSON, never as an in memory object.
function asJson(approval: SignedApproval): PolicySignals["approvalArtifact"] {
  return JSON.parse(JSON.stringify(approval));
}

describe("PaytmRefundApprovalVerifier", () => {
  it("ignores every action other than paytm:refund", async () => {
    const verifier = new PaytmRefundApprovalVerifier(approvalVerifier());

    expect(
      await verifier.findViolations(
        refundRequest({ action: "hubspot:deal-update" }),
        signals(),
      ),
    ).toEqual([]);
  });

  it("has nothing to verify when managerApproved is not true, and does not call the approval verifier", async () => {
    const inner = approvalVerifier();
    const spy = vi.spyOn(inner, "verify");
    const verifier = new PaytmRefundApprovalVerifier(inner);

    expect(
      await verifier.findViolations(
        refundRequest(),
        signals({ managerApproved: false }),
      ),
    ).toEqual([]);
    expect(
      await verifier.findViolations(
        refundRequest(),
        signals({ managerApproved: undefined }),
      ),
    ).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("accepts managerApproved: true backed by a valid approval for this order and amount", async () => {
    const verifier = new PaytmRefundApprovalVerifier(approvalVerifier());

    expect(
      await verifier.findViolations(
        refundRequest(),
        signals({ approvalArtifact: asJson(await sign("order-1", 75_000)) }),
      ),
    ).toEqual([]);
  });

  it("rejects managerApproved: true with no approval", async () => {
    const verifier = new PaytmRefundApprovalVerifier(approvalVerifier());

    expect(await verifier.findViolations(refundRequest(), signals())).toEqual([
      { signalKey: "managerApproved", declaredValue: true, actualValue: false },
    ]);
  });

  it("rejects a malformed approval", async () => {
    const verifier = new PaytmRefundApprovalVerifier(approvalVerifier());

    expect(
      await verifier.findViolations(
        refundRequest(),
        signals({ approvalArtifact: { payload: "nope" } }),
      ),
    ).toEqual([
      { signalKey: "managerApproved", declaredValue: true, actualValue: false },
    ]);
  });

  it("checks the order and amount from the Intent, not from the caller's signals", async () => {
    const verifier = new PaytmRefundApprovalVerifier(approvalVerifier());
    const approval = asJson(await sign("order-1", 20_000));

    // The caller claims a smaller refundAmount, but the Intent executes
    // 75000, which the approval does not cover.
    expect(
      await verifier.findViolations(
        refundRequest(),
        signals({ refundAmount: 20_000, approvalArtifact: approval }),
      ),
    ).toEqual([
      { signalKey: "managerApproved", declaredValue: true, actualValue: false },
    ]);
  });

  it("rejects an approval for a different order", async () => {
    const verifier = new PaytmRefundApprovalVerifier(approvalVerifier());

    expect(
      await verifier.findViolations(
        refundRequest(),
        signals({ approvalArtifact: asJson(await sign("order-2", 75_000)) }),
      ),
    ).toHaveLength(1);
  });

  it.each([
    ["no orderId", { amount: 75_000 }, "parameters.orderId"],
    ["an empty orderId", { orderId: "", amount: 75_000 }, "parameters.orderId"],
    ["no amount", { orderId: "order-1" }, "parameters.amount"],
    [
      "a string amount",
      { orderId: "order-1", amount: "75000" },
      "parameters.amount",
    ],
  ])("fails closed with %s", async (_name, intentParameters, missing) => {
    const verifier = new PaytmRefundApprovalVerifier(approvalVerifier());

    const violations = await verifier.findViolations(
      refundRequest({ intentParameters }),
      signals({ approvalArtifact: asJson(await sign("order-1", 75_000)) }),
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].signalKey).toBe("managerApproved");
    expect(String(violations[0].actualValue)).toContain(missing);
  });

  it("consumes the approval at authorization, accepts it again at release for the same transaction, and rejects it on a new authorization", async () => {
    const verifier = new PaytmRefundApprovalVerifier(approvalVerifier());
    const approved = signals({
      approvalArtifact: asJson(await sign("order-1", 75_000)),
    });

    expect(
      await verifier.findViolations(
        refundRequest({ stage: "authorize" }),
        approved,
      ),
    ).toEqual([]);
    expect(
      await verifier.findViolations(
        refundRequest({ stage: "release" }),
        approved,
      ),
    ).toEqual([]);
    expect(
      await verifier.findViolations(
        refundRequest({ businessTransactionId: "bt-2" }),
        approved,
      ),
    ).toEqual([
      { signalKey: "managerApproved", declaredValue: true, actualValue: false },
    ]);
  });
});
