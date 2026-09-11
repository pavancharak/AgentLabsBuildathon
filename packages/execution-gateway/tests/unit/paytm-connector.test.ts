import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MockPaytmConnectorServer,
  PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET,
  PAYTM_REFUND_CAPABILITY,
  redactPaytmConnectorSecret,
} from "@parmana/connector-paytm";
import {
  brandCredentialHandle,
  connectorCapabilities,
  type ConnectorExecutionContext,
} from "@parmana/connector-sdk";

import { GatewayPaytmAdapter } from "../../src/connector-execution/index.js";

const SECRET = PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET;

let server: MockPaytmConnectorServer;

beforeEach(async () => {
  server = new MockPaytmConnectorServer({ sharedSecret: SECRET });
  await server.listen();
});

afterEach(async () => {
  await server.close();
});

function context(
  overrides: Partial<ConnectorExecutionContext> = {},
): ConnectorExecutionContext {
  return {
    credential: brandCredentialHandle({
      providerId: "static",
      credentialId: "paytm",
      value: { sharedSecret: SECRET },
    }),
    timeoutMs: 2_000,
    requestedAt: new Date(),
    ...overrides,
  };
}

function connector(baseUrl: string = server.baseUrl): GatewayPaytmAdapter {
  return new GatewayPaytmAdapter({
    connectorId: "paytm",
    capabilities: connectorCapabilities([PAYTM_REFUND_CAPABILITY]),
    baseUrl,
  });
}

function refundRequest(
  overrides: Partial<{
    businessTransactionId: string;
    orderId: string;
    transactionId: string;
    amount: number;
  }> = {},
) {
  return {
    capability: PAYTM_REFUND_CAPABILITY,
    businessTransactionId: overrides.businessTransactionId ?? "btx-1",
    action: PAYTM_REFUND_CAPABILITY,
    target: `paytm://orders/${overrides.orderId ?? "order-1"}`,
    parameters: {
      orderId: overrides.orderId ?? "order-1",
      transactionId: overrides.transactionId ?? "txn-1",
      amount: overrides.amount ?? 500,
    },
  };
}

describe("GatewayPaytmAdapter", () => {
  it("forwards an approved refund to the Paytm connector service exactly once, and the mock forwards to Paytm exactly once", async () => {
    const result = await connector().execute(refundRequest(), context());

    expect(result.success).toBe(true);
    expect(result.metadata?.status).toBe("completed");
    expect(typeof result.metadata?.refId).toBe("string");
    expect(server.calls).toHaveLength(1);
    expect(server.paytmInvocationCount).toBe(1);
  });

  it("sends exactly the authorized parameters, nothing more", async () => {
    await connector().execute(
      refundRequest({
        orderId: "order-42",
        transactionId: "txn-42",
        amount: 750,
      }),
      context(),
    );

    expect(server.calls[0]?.businessTransactionId).toBe("btx-1");
    expect(server.calls[0]?.capability).toBe(PAYTM_REFUND_CAPABILITY);
    expect(server.calls[0]?.parameters).toEqual({
      orderId: "order-42",
      transactionId: "txn-42",
      amount: 750,
    });
  });

  it("deny-by-default: refuses an unsupported parameter before any network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      connector().execute(
        {
          ...refundRequest(),
          parameters: {
            orderId: "order-1",
            transactionId: "txn-1",
            amount: 500,
            merchantOverride: "evil",
          },
        },
        context(),
      ),
    ).rejects.toThrow(/merchantOverride/);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(server.calls).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it("rejects a request for a capability the connector does not declare, before any network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      connector().execute(
        {
          ...refundRequest(),
          capability: "paytm:charge",
          action: "paytm:charge",
        },
        context(),
      ),
    ).rejects.toThrow(/does not declare capability/);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects a credential that is not a resolved connector shared secret", async () => {
    await expect(
      connector().execute(
        refundRequest(),
        context({
          credential: brandCredentialHandle({
            providerId: "static",
            credentialId: "paytm",
            value: { token: "wrong-shape" },
          }),
        }),
      ),
    ).rejects.toThrow(/resolved connector shared secret/);
  });

  it("fails closed when the connector service returns 401 (invalid connector authentication) -- Paytm is never invoked", async () => {
    await expect(
      connector().execute(
        refundRequest(),
        context({
          credential: brandCredentialHandle({
            providerId: "static",
            credentialId: "paytm",
            value: { sharedSecret: "wrong-secret" },
          }),
        }),
      ),
    ).rejects.toThrow(/HTTP 401/);

    expect(server.paytmInvocationCount).toBe(0);
  });

  it("fails closed on a non-2xx response from the connector service", async () => {
    server.setForcedHttpStatus(500);

    await expect(
      connector().execute(refundRequest(), context()),
    ).rejects.toThrow(/HTTP 500/);
    expect(server.paytmInvocationCount).toBe(0);
  });

  it("fails closed on a malformed connector-service response", async () => {
    server.setMalformedResponse(true);

    await expect(
      connector().execute(refundRequest(), context()),
    ).rejects.toThrow(/malformed response/);
  });

  it("fails closed on a timeout, never returning a partial success", async () => {
    server.setResponseDelayMs(200);

    await expect(
      connector().execute(refundRequest(), context({ timeoutMs: 20 })),
    ).rejects.toThrow(/timed out after 20ms/);
  });

  it.each([
    ["orderId", { orderId: "some-other-order" }],
    ["transactionId", { transactionId: "some-other-txn" }],
    ["businessTransactionId", { businessTransactionId: "some-other-btx" }],
    ["capability", { capability: "paytm:refund-v2" }],
  ])(
    "binding validation: rejects a connector-service response with a mismatched %s",
    async (field, override) => {
      server.setResponseFieldOverride(override);

      await expect(
        connector().execute(refundRequest(), context()),
      ).rejects.toThrow(new RegExp(field));
      // The mismatched response must never be trusted as a completed refund.
      expect(server.paytmInvocationCount).toBe(1); // the mock still "completed" internally...
      // ...but GatewayPaytmAdapter must have thrown rather than reporting success.
    },
  );

  it("returns a non-throwing, non-success result for an ambiguous Paytm execution status, without retrying", async () => {
    server.setForcedStatus("ambiguous");

    const result = await connector().execute(refundRequest(), context());

    expect(result.success).toBe(false);
    expect(result.metadata?.status).toBe("ambiguous");
    expect(result.metadata?.requiresReconciliation).toBe(true);
    // Exactly one attempt was made -- no internal retry loop.
    expect(server.calls).toHaveLength(1);
  });

  it("returns a non-throwing, non-success result when Paytm declines the refund (status: failed)", async () => {
    server.setForcedStatus("failed");

    const result = await connector().execute(refundRequest(), context());

    expect(result.success).toBe(false);
    expect(result.metadata?.status).toBe("failed");
  });

  it("idempotency: a retried request for the same logical refund (orderId, transactionId) receives the same refId", async () => {
    const first = await connector().execute(
      refundRequest({ businessTransactionId: "btx-attempt-1" }),
      context(),
    );
    const second = await connector().execute(
      refundRequest({ businessTransactionId: "btx-attempt-2" }),
      context(),
    );

    expect(first.metadata?.refId).toBe(second.metadata?.refId);
  });

  it("never places the shared secret or any substring of it in connector response metadata, only a one-way fingerprint", async () => {
    const result = await connector().execute(refundRequest(), context());

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET);
    expect(result.metadata?.sharedSecretRedacted).toBe(
      redactPaytmConnectorSecret(SECRET),
    );
    expect(result.metadata?.sharedSecretRedacted).toMatch(/^fp_[0-9a-f]{12}$/);
  });

  it("never leaks the shared secret into a thrown error, even on an authentication failure against the mock server", async () => {
    let caught: unknown;
    try {
      await connector().execute(
        refundRequest(),
        context({
          credential: brandCredentialHandle({
            providerId: "static",
            credentialId: "paytm",
            value: { sharedSecret: "wrong-secret-value" },
          }),
        }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toContain(SECRET);
    expect((caught as Error).message).not.toContain("wrong-secret-value");
  });

  it("refuses to send the built-in test-mode placeholder secret to a non-local endpoint, before any network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const remoteConnector = new GatewayPaytmAdapter({
      connectorId: "paytm",
      capabilities: connectorCapabilities([PAYTM_REFUND_CAPABILITY]),
      baseUrl: "https://paytm-connector.internal.example.com",
    });

    await expect(
      remoteConnector.execute(refundRequest(), context()),
    ).rejects.toThrow(/refuses to send/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("requires HTTPS outside NODE_ENV=test", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(
        () =>
          new GatewayPaytmAdapter({
            connectorId: "paytm",
            capabilities: connectorCapabilities([PAYTM_REFUND_CAPABILITY]),
            baseUrl: "http://paytm-connector.internal.example.com",
          }),
      ).toThrow(/HTTPS/);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
