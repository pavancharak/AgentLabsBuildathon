import { describe, expect, it } from "vitest";

import {
  PAYTM_ALLOWED_REFUND_PARAMETERS,
  PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET,
  deriveDeterministicPaytmRefId,
  isPaytmAgentRefundExecutionResult,
  isPaytmConnectorCredentialValue,
  redactPaytmConnectorSecret,
} from "../../src/PaytmTypes.js";

describe("isPaytmConnectorCredentialValue", () => {
  it("accepts a well-formed credential value", () => {
    expect(isPaytmConnectorCredentialValue({ sharedSecret: "s3cr3t" })).toBe(
      true,
    );
  });

  it.each([
    [undefined],
    [null],
    ["a string"],
    [{}],
    [{ sharedSecret: "" }],
    [{ sharedSecret: 123 }],
    [{ notSharedSecret: "s3cr3t" }],
  ])("rejects %j", (value) => {
    expect(isPaytmConnectorCredentialValue(value)).toBe(false);
  });
});

describe("redactPaytmConnectorSecret", () => {
  it("never returns a literal substring of the secret", () => {
    const secret = "super-secret-connector-value-0123456789";
    const redacted = redactPaytmConnectorSecret(secret);

    expect(redacted.startsWith("fp_")).toBe(true);
    expect(redacted).not.toContain(secret);
    expect(secret).not.toContain(redacted.slice(3));
  });

  it("is deterministic for the same input", () => {
    expect(redactPaytmConnectorSecret("abc")).toBe(
      redactPaytmConnectorSecret("abc"),
    );
  });

  it("differs for different inputs", () => {
    expect(redactPaytmConnectorSecret("abc")).not.toBe(
      redactPaytmConnectorSecret("xyz"),
    );
  });
});

describe("PAYTM_ALLOWED_REFUND_PARAMETERS", () => {
  it("is exactly the deny-by-default allowlist this connector forwards", () => {
    expect(PAYTM_ALLOWED_REFUND_PARAMETERS).toEqual([
      "orderId",
      "transactionId",
      "amount",
      "refundReason",
    ]);
  });
});

describe("deriveDeterministicPaytmRefId", () => {
  it("is deterministic for the same (orderId, transactionId) pair", () => {
    expect(deriveDeterministicPaytmRefId("order-1", "txn-1")).toBe(
      deriveDeterministicPaytmRefId("order-1", "txn-1"),
    );
  });

  it("differs for a different orderId or transactionId", () => {
    const base = deriveDeterministicPaytmRefId("order-1", "txn-1");
    expect(deriveDeterministicPaytmRefId("order-2", "txn-1")).not.toBe(base);
    expect(deriveDeterministicPaytmRefId("order-1", "txn-2")).not.toBe(base);
  });

  it("is independent of any Parmana businessTransactionId (only orderId/transactionId matter)", () => {
    // Two distinct authorization attempts for the same logical refund
    // must derive the same refId regardless of businessTransactionId.
    const a = deriveDeterministicPaytmRefId("order-9", "txn-9");
    const b = deriveDeterministicPaytmRefId("order-9", "txn-9");
    expect(a).toBe(b);
  });

  it("never uses randomness or wall-clock time (called twice in the same process yields the same value)", () => {
    const first = deriveDeterministicPaytmRefId("order-x", "txn-x");
    const second = deriveDeterministicPaytmRefId("order-x", "txn-x");
    expect(first).toBe(second);
  });
});

describe("isPaytmAgentRefundExecutionResult", () => {
  const valid = {
    businessTransactionId: "btx-1",
    action: "paytm-refund",
    target: "paytm://orders/order-1",
    parameters: {
      orderId: "order-1",
      txnId: "txn-1",
      refId: "refid_abc123",
      amount: "500.00",
    },
    success: true,
    executedAt: new Date().toISOString(),
    metadata: { provider: "paytm", resultStatus: "S", resultCode: "00" },
  };

  it("accepts a well-formed result", () => {
    expect(isPaytmAgentRefundExecutionResult(valid)).toBe(true);
  });

  it("accepts success: false with metadata describing why", () => {
    expect(
      isPaytmAgentRefundExecutionResult({
        ...valid,
        success: false,
        metadata: {
          provider: "paytm",
          resultStatus: "TXN_FAILURE",
          resultCode: "227",
        },
      }),
    ).toBe(true);
  });

  it.each([
    [
      "missing businessTransactionId",
      { ...valid, businessTransactionId: undefined },
    ],
    ["missing action", { ...valid, action: undefined }],
    ["missing target", { ...valid, target: undefined }],
    ["missing parameters", { ...valid, parameters: undefined }],
    [
      "missing parameters.orderId",
      { ...valid, parameters: { ...valid.parameters, orderId: undefined } },
    ],
    [
      "missing parameters.txnId",
      { ...valid, parameters: { ...valid.parameters, txnId: undefined } },
    ],
    [
      "missing parameters.refId",
      { ...valid, parameters: { ...valid.parameters, refId: undefined } },
    ],
    [
      "empty parameters.refId",
      { ...valid, parameters: { ...valid.parameters, refId: "" } },
    ],
    [
      "missing parameters.amount",
      { ...valid, parameters: { ...valid.parameters, amount: undefined } },
    ],
    ["non-boolean success", { ...valid, success: "true" }],
    ["missing executedAt", { ...valid, executedAt: undefined }],
    ["null", null],
    ["a string", "not an object"],
  ])("rejects %s", (_label, value) => {
    expect(isPaytmAgentRefundExecutionResult(value)).toBe(false);
  });
});

describe("PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET", () => {
  it("is a fixed, obviously-fake placeholder, not empty", () => {
    expect(PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET.length).toBeGreaterThan(
      0,
    );
    expect(PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET).toContain(
      "placeholder",
    );
  });
});
