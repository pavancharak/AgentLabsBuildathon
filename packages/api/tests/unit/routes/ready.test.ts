import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApplication } from "../../../src/application.js";
import { createApp } from "../../../src/app.js";
import { createExecutionSystem } from "../../../src/bootstrap/createExecutionSystem.js";

const ENV_KEYS = ["NODE_ENV", "PARMANA_STORAGE", "DATABASE_URL"] as const;

function buildApp(
  callerAuth: Parameters<typeof createApp>[1]["callerAuth"] = "disabled",
) {
  const executionSystem = createExecutionSystem();
  const application = createApplication(executionSystem);
  return createApp(application, { callerAuth });
}

describe("GET /ready", () => {
  const original = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });

  it("reports READY without touching Supabase when NODE_ENV=test", async () => {
    const response = await request(buildApp()).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("READY");
    expect(response.body.storage).toBe("not-supabase-backed");
  });

  it("surfaces authDisabled:true and a warning when callerAuth is disabled", async () => {
    const response = await request(buildApp("disabled")).get("/ready");

    expect(response.body.authDisabled).toBe(true);
    expect(typeof response.body.warning).toBe("string");
  });

  it("surfaces authDisabled:false when caller auth is enabled", async () => {
    const app = buildApp({
      authenticator: { authenticate: () => undefined },
      auditSink: { record: async () => {} },
    });

    const response = await request(app).get("/ready");

    expect(response.body.authDisabled).toBe(false);
    expect(response.body.warning).toBeUndefined();
  });

  it("reports READY without touching Supabase when storage is memory-backed outside test", async () => {
    // Built under NODE_ENV=test (see the next test's comment for why:
    // createNonceStore.ts's own eager check always requires DATABASE_URL
    // outside NODE_ENV=test, by design, independent of PARMANA_STORAGE
    // -- so flipping env before buildApp() would throw for a reason
    // unrelated to what this test exercises).
    const app = buildApp();

    process.env.NODE_ENV = "production";
    process.env.PARMANA_STORAGE = "memory";

    const response = await request(app).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("READY");
  });

  it("reports NOT_READY (503) with a reason when Supabase-backed and the connection fails", async () => {
    // Built under NODE_ENV=test (so app construction's own eager
    // assertStorageConfigured/createNonceStore checks don't themselves
    // throw on the bad DATABASE_URL below) -- the route handler
    // reads process.env fresh per request, independent of how the app
    // was constructed, so flipping env only around the request itself
    // still exercises the live-storage branch faithfully.
    const app = buildApp();

    process.env.NODE_ENV = "production";
    process.env.PARMANA_STORAGE = "supabase";
    process.env.DATABASE_URL =
      "postgresql://unreachable:unreachable@127.0.0.1:1/postgres";

    const response = await request(app).get("/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("NOT_READY");
    expect(typeof response.body.reason).toBe("string");
  });
});
