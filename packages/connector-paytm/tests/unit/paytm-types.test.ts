import { describe, expect, it } from "vitest";

import {
  PAYTM_ALLOWED_REFUND_PARAMETERS,
  PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET,
  isPaytmConnectorCredentialValue,
  isPaytmRefundExecutionResult,
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

describe("isPaytmRefundExecutionResult", () => {
  const valid = {
    success: true,
    status: "completed",
    refId: "refid_abc123",
    businessTransactionId: "btx-1",
    capability: "paytm:refund",
    orderId: "order-1",
    transactionId: "txn-1",
  };

  it("accepts a well-formed result", () => {
    expect(isPaytmRefundExecutionResult(valid)).toBe(true);
  });

  it("accepts every documented status", () => {
    for (const status of ["completed", "ambiguous", "failed"]) {
      expect(isPaytmRefundExecutionResult({ ...valid, status })).toBe(true);
    }
  });

  it.each([
    ["missing refId", { ...valid, refId: undefined }],
    ["empty refId", { ...valid, refId: "" }],
    ["unknown status", { ...valid, status: "processing" }],
    [
      "missing businessTransactionId",
      { ...valid, businessTransactionId: undefined },
    ],
    ["missing capability", { ...valid, capability: undefined }],
    ["missing orderId", { ...valid, orderId: undefined }],
    ["missing transactionId", { ...valid, transactionId: undefined }],
    ["non-boolean success", { ...valid, success: "true" }],
    ["null", null],
    ["a string", "not an object"],
  ])("rejects %s", (_label, value) => {
    expect(isPaytmRefundExecutionResult(value)).toBe(false);
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
