import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BusinessTransaction } from "@parmana/shared";
import {
  MockPaytmConnectorServer,
  PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET,
} from "@parmana/connector-paytm";

import { createApplication } from "../../src/application.js";
import { createApp } from "../../src/app.js";
import { createExecutionSystem } from "../../src/bootstrap/createExecutionSystem.js";

/**
 * HTTP-level proof of the full governed Paytm refund path:
 *
 *   AI Agent -> POST /execute -> customer-refund@1.0.0 policy -> decision
 *     -> (APPROVED) -> Execution Gateway -> RemotePaytmConnector
 *     -> POST /connector/paytm-refund (a hermetic MockPaytmConnectorServer
 *        standing in for the trusted, out-of-process parmana-paytm-agent
 *        service) -> "Paytm"
 *
 * Uses the same real production bootstrap chain server.ts calls
 * (createExecutionSystem -> createExecutionGateway -> createExecutionControl
 * -> createConnectorRegistry), pointed at the mock connector service via
 * the PAYTM_CONNECTOR_URL test seam (see createPaytmConnector.ts) instead
 * of a hand-rolled recomposition -- this proves the actual production
 * wiring, not a look-alike of it. Both scenarios below use the exact same
 * policy (customer-refund/1.0.0); the different outcome comes entirely
 * from the payload/signals, per this milestone's own requirement.
 */
describe("Paytm refund (HTTP boundary)", () => {
  let server: MockPaytmConnectorServer | undefined;
  const originalPaytmBaseUrl = process.env.PAYTM_CONNECTOR_URL;
  const originalTestSecret = process.env.TEST_PAYTM_CONNECTOR_SHARED_SECRET;

  afterEach(async () => {
    if (server !== undefined) {
      await server.close();
      server = undefined;
    }
    if (originalPaytmBaseUrl === undefined) {
      delete process.env.PAYTM_CONNECTOR_URL;
    } else {
      process.env.PAYTM_CONNECTOR_URL = originalPaytmBaseUrl;
    }
    if (originalTestSecret === undefined) {
      delete process.env.TEST_PAYTM_CONNECTOR_SHARED_SECRET;
    } else {
      process.env.TEST_PAYTM_CONNECTOR_SHARED_SECRET = originalTestSecret;
    }
  });

  const SECRET = PAYTM_CONNECTOR_TEST_MODE_PLACEHOLDER_SECRET;

  async function buildApp(): Promise<{
    app: ReturnType<typeof createApp>;
    server: MockPaytmConnectorServer;
  }> {
    const mockServer = new MockPaytmConnectorServer({ sharedSecret: SECRET });
    await mockServer.listen();
    server = mockServer;

    process.env.PAYTM_CONNECTOR_URL = mockServer.baseUrl;

    // Hermetic regardless of the ambient environment, matching
    // hubspot-deal-update.integration.test.ts's own reasoning: this
    // mock server only recognizes the built-in placeholder secret, so
    // it must not depend on TEST_PAYTM_CONNECTOR_SHARED_SECRET being
    // ambiently absent.
    process.env.TEST_PAYTM_CONNECTOR_SHARED_SECRET = SECRET;

    const executionSystem = createExecutionSystem();
    const application = createApplication(executionSystem);
    const app = createApp(application, { callerAuth: "disabled" });

    return { app, server: mockServer };
  }

  function refundTransaction(overrides: {
    orderId: string;
    transactionId: string;
    amount: number;
    signals: BusinessTransaction["signals"];
    policy?: BusinessTransaction["policy"];
  }): BusinessTransaction {
    const businessTransactionId = crypto.randomUUID();
    const authorityId = crypto.randomUUID();
    const authorizationId = crypto.randomUUID();
    const intentId = crypto.randomUUID();

    return {
      businessTransactionId,

      metadata: {
        businessTransactionId,
        correlationId: crypto.randomUUID(),
        createdBy: "integration-test",
        createdAt: new Date(),
      },

      authority: {
        authorityId,
        authorityType: "USER",
        principalId: "integration-test",
        displayName: "Integration Test",
        issuedAt: new Date(),
      },

      authorization: {
        authorizationId,
        authorityId,
        purpose: "Integration Test",
        authorizedAt: new Date(),
      },

      intent: {
        intentId,
        authorizationId,
        action: "paytm:refund",
        target: `paytm://orders/${overrides.orderId}`,
        parameters: Object.freeze({
          orderId: overrides.orderId,
          transactionId: overrides.transactionId,
          amount: overrides.amount,
        }),
        createdAt: new Date(),
      },

      policy: overrides.policy ?? {
        name: "customer-refund",
        version: "1.0.0",
        schemaVersion: "1.0.0",
      },

      signals: overrides.signals,

      decision: { outcome: "APPROVED" },
      status: "APPROVED",
      createdAt: new Date(),
    } as unknown as BusinessTransaction;
  }

  it("Scenario B: authorizes and executes a real refund through POST /execute, landing on the mock Paytm connector service exactly once", async () => {
    const { app, server: mockServer } = await buildApp();

    const transaction = refundTransaction({
      orderId: "order-approved-1",
      transactionId: "txn-approved-1",
      amount: 500,
      signals: {
        refundEligible: true,
        managerApproved: true,
        fraudCheckPassed: true,
        refundAmount: 500,
      },
    });

    const response = await request(app).post("/execute").send(transaction);

    expect(response.status).toBe(200);
    expect(mockServer.calls).toHaveLength(1);
    expect(mockServer.paytmInvocationCount).toBe(1);
  });

  it("Scenario A: rejects by policy through POST /execute and never calls the Paytm connector when not manager-approved", async () => {
    const { app, server: mockServer } = await buildApp();

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const transaction = refundTransaction({
      orderId: "order-denied-1",
      transactionId: "txn-denied-1",
      amount: 50_000,
      signals: {
        refundEligible: true,
        managerApproved: false,
        fraudCheckPassed: true,
        refundAmount: 50_000,
      },
    });

    const response = await request(app).post("/execute").send(transaction);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("POLICY_DENIED");

    const paytmCalls = fetchSpy.mock.calls.filter((call) =>
      String(call[0]).startsWith(mockServer.baseUrl),
    );
    expect(paytmCalls).toHaveLength(0);
    expect(mockServer.calls).toHaveLength(0);
    expect(mockServer.paytmInvocationCount).toBe(0);

    fetchSpy.mockRestore();
  });

  it("rejects by policy through POST /execute and never calls the Paytm connector when the refund amount exceeds the policy threshold", async () => {
    const { app, server: mockServer } = await buildApp();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const transaction = refundTransaction({
      orderId: "order-excessive-1",
      transactionId: "txn-excessive-1",
      amount: 50_000,
      signals: {
        refundEligible: true,
        managerApproved: true,
        fraudCheckPassed: true,
        refundAmount: 50_000,
      },
    });

    const response = await request(app).post("/execute").send(transaction);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("POLICY_DENIED");
    expect(mockServer.paytmInvocationCount).toBe(0);

    const paytmCalls = fetchSpy.mock.calls.filter((call) =>
      String(call[0]).startsWith(mockServer.baseUrl),
    );
    expect(paytmCalls).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it("binding validation: rejects through POST /execute when the declared refund amount does not match the authorized execution amount, and never calls the Paytm connector", async () => {
    const { app, server: mockServer } = await buildApp();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // The Intent that would actually execute carries amount: 50000, but
    // the caller declares (a smaller, policy-satisfying) refundAmount:
    // 500 -- exactly the "authorized amount = 500, actual execution
    // amount = 50000" tamper scenario. SignalIntentBinder's boundSignals
    // enforcement (refundAmount -> parameters.amount) must catch this
    // before PolicyEngine.evaluate ever sees a self-consistent, trivially
    // approvable signal set.
    const transaction = {
      ...refundTransaction({
        orderId: "order-tamper-1",
        transactionId: "txn-tamper-1",
        amount: 50_000,
        signals: {
          refundEligible: true,
          managerApproved: true,
          fraudCheckPassed: true,
          refundAmount: 500,
        },
      }),
    };

    const response = await request(app).post("/execute").send(transaction);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("POLICY_DENIED");
    expect(mockServer.paytmInvocationCount).toBe(0);

    const paytmCalls = fetchSpy.mock.calls.filter((call) =>
      String(call[0]).startsWith(mockServer.baseUrl),
    );
    expect(paytmCalls).toHaveLength(0);
    fetchSpy.mockRestore();
  });

  it("capability/policy binding: rejects through POST /execute when paytm:refund is paired with an unrelated, unprotected policy", async () => {
    const { app, server: mockServer } = await buildApp();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const transaction = refundTransaction({
      orderId: "order-mismatch-1",
      transactionId: "txn-mismatch-1",
      amount: 500,
      signals: {
        refundEligible: true,
        managerApproved: true,
        fraudCheckPassed: true,
        refundAmount: 500,
      },
      policy: {
        name: "hubspot-deal-update",
        version: "1.0.0",
        schemaVersion: "1.0.0",
      },
    });

    const response = await request(app).post("/execute").send(transaction);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("POLICY_DENIED");
    expect(response.body.error).toContain("paytm:refund");
    expect(response.body.error).toContain("customer-refund");

    const paytmCalls = fetchSpy.mock.calls.filter((call) =>
      String(call[0]).startsWith(mockServer.baseUrl),
    );
    expect(paytmCalls).toHaveLength(0);
    expect(mockServer.paytmInvocationCount).toBe(0);
    fetchSpy.mockRestore();
  });

  it("rejects by policy through POST /execute and never calls the Paytm connector when the refund did not pass fraud assessment", async () => {
    const { app, server: mockServer } = await buildApp();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const transaction = refundTransaction({
      orderId: "order-fraud-1",
      transactionId: "txn-fraud-1",
      amount: 500,
      signals: {
        refundEligible: true,
        managerApproved: true,
        fraudCheckPassed: false,
        refundAmount: 500,
      },
    });

    const response = await request(app).post("/execute").send(transaction);

    expect(response.status).toBe(403);
    expect(mockServer.paytmInvocationCount).toBe(0);

    const paytmCalls = fetchSpy.mock.calls.filter((call) =>
      String(call[0]).startsWith(mockServer.baseUrl),
    );
    expect(paytmCalls).toHaveLength(0);
    fetchSpy.mockRestore();
  });
});
