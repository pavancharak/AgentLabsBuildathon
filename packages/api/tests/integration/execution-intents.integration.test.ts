import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { FilePolicyRepository } from "@parmana/policy";
import { RuntimeFactory } from "@parmana/runtime";
import {
  AuthorityType,
  type ExecutionResult,
  type ExecutionTrustRecord,
} from "@parmana/shared";
import {
  MemoryBusinessTransactionRepository,
  MemoryExecutionIntentRepository,
  MemoryExecutionTrustRecordRepository,
  MemoryRefusalRecordRepository,
} from "@parmana/storage";

import { createApplication } from "../../src/application.js";
import { createApp } from "../../src/app.js";

import { hashApiKey } from "../../src/auth/hashApiKey.js";
import { InMemoryCallerAuditSink } from "../../src/auth/InMemoryCallerAuditSink.js";
import { StaticKeyAuthenticator } from "../../src/auth/StaticKeyAuthenticator.js";

import { createBusinessTransaction } from "../fixtures/business-transaction.js";
import { createInspectableExecutionSystem } from "../bootstrap/createInspectableExecutionSystem.js";

/**
 * HTTP-level proof of ADR-0012 through the real Express app: an Execution
 * Intent is signed and stored before release, it can be read and verified, and
 * a released action whose Trust Record was never produced can be repaired
 * without calling the connector again.
 */

const HUMAN_KEY = "human-operator-key";
const SERVICE_KEY = "service-caller-key";

let previousIntentsCheck: string | undefined;

beforeAll(() => {
  previousIntentsCheck = process.env.EXECUTION_INTENTS_CHECK;
  process.env.EXECUTION_INTENTS_CHECK = "true";
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterAll(() => {
  vi.restoreAllMocks();

  if (previousIntentsCheck === undefined) {
    delete process.env.EXECUTION_INTENTS_CHECK;
  } else {
    process.env.EXECUTION_INTENTS_CHECK = previousIntentsCheck;
  }
});

function authenticator() {
  return new StaticKeyAuthenticator([
    {
      callerId: "human-operator",
      keyHash: hashApiKey(HUMAN_KEY),
      credentialHolderType: AuthorityType.USER,
      allowedPrincipalIds: ["integration-test"],
      allowedCapabilities: ["*"],
    },
    {
      callerId: "service-caller",
      keyHash: hashApiKey(SERVICE_KEY),
      credentialHolderType: AuthorityType.SERVICE,
      allowedPrincipalIds: ["integration-test"],
      allowedCapabilities: ["*"],
    },
  ]);
}

describe("Execution Intents (ADR-0012, HTTP boundary): normal execution", () => {
  function buildApp() {
    const { executionSystem } = createInspectableExecutionSystem();
    const application = createApplication(executionSystem);

    return createApp(application, { callerAuth: "disabled" });
  }

  it("stores a signed intent that ends FINALIZED, and never exposes the saved release context", async () => {
    const app = buildApp();
    const transaction = createBusinessTransaction();

    const executed = await request(app).post("/execute").send(transaction);

    expect(executed.status).toBe(200);

    const response = await request(app).get(
      `/execution-intents/${transaction.businessTransactionId}`,
    );

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(["intent", "status"]);
    expect(response.body.intent.businessTransactionId).toBe(
      transaction.businessTransactionId,
    );
    expect(response.body.intent.authorizationId).toBe(
      executed.body.authorization.payload.authorizationId,
    );
    expect(response.body.status.state).toBe("FINALIZED");
    expect(response.body.status.finalizationMode).toBe("INLINE");
    expect(response.body.status.trustRecordId).toBe(
      executed.body.trustRecordId,
    );
    expect(JSON.stringify(response.body)).not.toContain("releasedContext");
  });

  it("verifies the intent with no authentication, and rejects a tampered one", async () => {
    const app = buildApp();
    const transaction = createBusinessTransaction();

    await request(app).post("/execute").send(transaction);

    const { body } = await request(app).get(
      `/execution-intents/${transaction.businessTransactionId}`,
    );

    const valid = await request(app)
      .post("/execution-intents/verify")
      .send(body.intent);

    expect(valid.status).toBe(200);
    expect(valid.body).toEqual({ valid: true });

    const tampered = await request(app)
      .post("/execution-intents/verify")
      .send({ ...body.intent, target: "ATTACKER-CONTROLLED-ACCOUNT" });

    expect(tampered.status).toBe(200);
    expect(tampered.body).toEqual({ valid: false });

    const malformed = await request(app)
      .post("/execution-intents/verify")
      .send({ hello: "world" });

    expect(malformed.status).toBe(400);
  });

  it("answers 404 for a transaction with no intent", async () => {
    const app = buildApp();

    const response = await request(app).get(
      "/execution-intents/does-not-exist",
    );

    expect(response.status).toBe(404);
  });
});

describe("Execution Intents (ADR-0012, HTTP boundary): who may do what", () => {
  function buildAuthenticatedApp() {
    const { executionSystem } = createInspectableExecutionSystem();
    const application = createApplication(executionSystem);

    return createApp(application, {
      callerAuth: {
        authenticator: authenticator(),
        auditSink: new InMemoryCallerAuditSink(),
      },
    });
  }

  it("requires authentication for the data routes, but not for verification", async () => {
    const app = buildAuthenticatedApp();

    expect((await request(app).get("/execution-intents/x")).status).toBe(401);
    expect(
      (await request(app).get("/execution-intents/unfinalized")).status,
    ).toBe(401);
    expect(
      (await request(app).post("/execution-intents/x/finalize")).status,
    ).toBe(401);
    expect(
      (await request(app).post("/execution-intents/verify").send({})).status,
    ).toBe(400);
  });

  it("denies finalize and the unfinalized list to a caller that is not a verified human", async () => {
    const app = buildAuthenticatedApp();

    const finalize = await request(app)
      .post("/execution-intents/x/finalize")
      .set("Authorization", `Bearer ${SERVICE_KEY}`);

    const list = await request(app)
      .get("/execution-intents/unfinalized")
      .set("Authorization", `Bearer ${SERVICE_KEY}`);

    expect(finalize.status).toBe(403);
    expect(list.status).toBe(403);
  });

  it("lets a verified human list unfinalized intents", async () => {
    const app = buildAuthenticatedApp();

    const list = await request(app)
      .get("/execution-intents/unfinalized")
      .set("Authorization", `Bearer ${HUMAN_KEY}`);

    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.intents)).toBe(true);
  });

  it("answers 404 EXECUTION_INTENT_NOT_FOUND when a human finalizes an unknown transaction", async () => {
    const app = buildAuthenticatedApp();

    const response = await request(app)
      .post("/execution-intents/unknown-transaction/finalize")
      .set("Authorization", `Bearer ${HUMAN_KEY}`);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("EXECUTION_INTENT_NOT_FOUND");
  });
});

describe("Execution Intents (ADR-0012, HTTP boundary): repair after a released action has no record", () => {
  class FlakyTrustRecords extends MemoryExecutionTrustRecordRepository {
    failCreate = true;

    override async create(
      record: ExecutionTrustRecord,
    ): Promise<ExecutionTrustRecord> {
      if (this.failCreate) {
        throw new Error("database unavailable");
      }

      return super.create(record);
    }
  }

  function buildRepairApp() {
    let connectorCalls = 0;

    const { executionSystem } = createInspectableExecutionSystem({
      executor: {
        async execute(executableContent): Promise<ExecutionResult> {
          connectorCalls += 1;

          return {
            ...executableContent,
            success: true,
            executedAt: new Date(),
            metadata: {},
          };
        },
      },
    });

    const trustRecords = new FlakyTrustRecords();
    const intents = new MemoryExecutionIntentRepository();

    const application = RuntimeFactory.create(
      new MemoryBusinessTransactionRepository(),
      trustRecords,
      new FilePolicyRepository(
        path.resolve(import.meta.dirname, "../../../../policies"),
      ),
      executionSystem,
      new MemoryRefusalRecordRepository(),
      undefined,
      undefined,
      undefined,
      undefined,
      intents,
    );

    const app = createApp(application, {
      callerAuth: {
        authenticator: authenticator(),
        auditSink: new InMemoryCallerAuditSink(),
      },
    });

    return { app, trustRecords, calls: () => connectorCalls };
  }

  it("keeps a signed intent, lists it, rebuilds the record without a second release, and is idempotent", async () => {
    const { app, trustRecords, calls } = buildRepairApp();
    const transaction = createBusinessTransaction();

    //
    // The action is released, the record cannot be stored.
    //
    const executed = await request(app)
      .post("/execute")
      .set("Authorization", `Bearer ${HUMAN_KEY}`)
      .send(transaction);

    expect(executed.status, JSON.stringify(executed.body)).toBe(500);
    expect(executed.body.code).toBe("EXECUTION_RECORD_INCOMPLETE");
    expect(calls()).toBe(1);

    //
    // The signed intent survived and says so.
    //
    const intent = await request(app)
      .get(`/execution-intents/${transaction.businessTransactionId}`)
      .set("Authorization", `Bearer ${HUMAN_KEY}`);

    expect(intent.status).toBe(200);
    expect(intent.body.status.state).toBe("RELEASED");

    const verified = await request(app)
      .post("/execution-intents/verify")
      .send(intent.body.intent);

    expect(verified.body).toEqual({ valid: true });

    const unfinalized = await request(app)
      .get("/execution-intents/unfinalized")
      .set("Authorization", `Bearer ${HUMAN_KEY}`);

    expect(
      unfinalized.body.intents.map(
        (stored: { intent: { businessTransactionId: string } }) =>
          stored.intent.businessTransactionId,
      ),
    ).toContain(transaction.businessTransactionId);

    //
    // Storage recovers. Finalize rebuilds the record.
    //
    trustRecords.failCreate = false;

    const first = await request(app)
      .post(`/execution-intents/${transaction.businessTransactionId}/finalize`)
      .set("Authorization", `Bearer ${HUMAN_KEY}`);

    expect(first.status).toBe(200);
    expect(first.body.outcome).toBe("FINALIZED");
    expect(first.body.trustRecordId).toBe(first.body.trustRecord.trustRecordId);
    expect(first.body.trustRecord.verifications.at(-1).status).toBe("VERIFIED");
    expect(first.body.trustRecord.receipts.length).toBeGreaterThan(0);
    expect(calls()).toBe(1);

    const finalized = await request(app)
      .get(`/execution-intents/${transaction.businessTransactionId}`)
      .set("Authorization", `Bearer ${HUMAN_KEY}`);

    expect(finalized.body.status).toMatchObject({
      state: "FINALIZED",
      finalizationMode: "REPAIRED",
      trustRecordId: first.body.trustRecordId,
    });

    //
    // The rebuilt record is now the normal signed record.
    //
    const record = await request(app)
      .get(`/trust-records/${transaction.businessTransactionId}`)
      .set("Authorization", `Bearer ${HUMAN_KEY}`);

    expect(record.status).toBe(200);
    expect(record.body.trustRecordId).toBe(first.body.trustRecordId);

    //
    // A second finalize changes nothing and never calls the connector.
    //
    const second = await request(app)
      .post(`/execution-intents/${transaction.businessTransactionId}/finalize`)
      .set("Authorization", `Bearer ${HUMAN_KEY}`);

    expect(second.status).toBe(200);
    expect(second.body.outcome).toBe("ALREADY_FINALIZED");
    expect(second.body.trustRecordId).toBe(first.body.trustRecordId);
    expect(calls()).toBe(1);

    const after = await request(app)
      .get("/execution-intents/unfinalized")
      .set("Authorization", `Bearer ${HUMAN_KEY}`);

    expect(
      after.body.intents.map(
        (stored: { intent: { businessTransactionId: string } }) =>
          stored.intent.businessTransactionId,
      ),
    ).not.toContain(transaction.businessTransactionId);
  });
});
