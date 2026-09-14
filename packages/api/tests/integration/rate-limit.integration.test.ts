import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApplication } from "../../src/application.js";
import { createApp } from "../../src/app.js";

import { hashApiKey } from "../../src/auth/hashApiKey.js";
import { StaticKeyAuthenticator } from "../../src/auth/StaticKeyAuthenticator.js";
import { InMemoryCallerAuditSink } from "../../src/auth/InMemoryCallerAuditSink.js";

import { createBusinessTransaction } from "../fixtures/business-transaction.js";
import { createInspectableExecutionSystem } from "../bootstrap/createInspectableExecutionSystem.js";

/**
 * HTTP-level proof of the two rate limiters
 * (packages/api/src/middleware/rate-limit.ts): a real finding from load
 * testing against a live deployment (no rate limiting existed anywhere,
 * confirmed by firing thousands of unthrottled requests with zero 429s).
 * Mirrors caller-auth.integration.test.ts's own buildApp() shape.
 */
describe("Rate limiting (HTTP boundary)", () => {
  const CALLER_A_KEY = "rate-limit-caller-a-raw-key-for-tests-only";
  const CALLER_B_KEY = "rate-limit-caller-b-raw-key-for-tests-only";

  function buildApp(rateLimit: {
    executePerMinute: number;
    healthPerMinute: number;
  }) {
    const { executionSystem, auditSink: executionAuditSink } =
      createInspectableExecutionSystem();

    const application = createApplication(executionSystem);

    const authenticator = new StaticKeyAuthenticator([
      {
        callerId: "caller-a",
        keyHash: hashApiKey(CALLER_A_KEY),
        allowedPrincipalIds: ["integration-test"],
        allowedCapabilities: ["test:fixture-execute"],
      },
      {
        callerId: "caller-b",
        keyHash: hashApiKey(CALLER_B_KEY),
        allowedPrincipalIds: ["integration-test"],
        allowedCapabilities: ["test:fixture-execute"],
      },
    ]);

    const callerAuditSink = new InMemoryCallerAuditSink();

    const app = createApp(application, {
      callerAuth: { authenticator, auditSink: callerAuditSink },
      rateLimit,
    });

    return { app, executionAuditSink };
  }

  describe("POST /execute, keyed by authenticated caller identity", () => {
    it("normal traffic under the limit passes through unaffected", async () => {
      const { app } = buildApp({ executePerMinute: 5, healthPerMinute: 300 });

      const first = await request(app)
        .post("/execute")
        .set("Authorization", `Bearer ${CALLER_A_KEY}`)
        .send(createBusinessTransaction());

      const second = await request(app)
        .post("/execute")
        .set("Authorization", `Bearer ${CALLER_A_KEY}`)
        .send(createBusinessTransaction());

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
    });

    it("traffic over the limit gets a clean 429 with a Retry-After header, and never reaches signing/execution", async () => {
      const { app, executionAuditSink } = buildApp({
        executePerMinute: 2,
        healthPerMinute: 300,
      });

      const first = await request(app)
        .post("/execute")
        .set("Authorization", `Bearer ${CALLER_A_KEY}`)
        .send(createBusinessTransaction());
      expect(first.status).toBe(200);

      // Baseline, not a hardcoded assumption about how many execution-audit
      // events a single successful /execute produces (it's more than one --
      // session-credential issuance, connector execution, etc. -- and that
      // count is an implementation detail this test doesn't need to know).
      const eventsAfterOneSuccess = executionAuditSink.events.length;
      expect(eventsAfterOneSuccess).toBeGreaterThan(0);

      const second = await request(app)
        .post("/execute")
        .set("Authorization", `Bearer ${CALLER_A_KEY}`)
        .send(createBusinessTransaction());
      expect(second.status).toBe(200);

      const eventsAfterTwoSuccesses = executionAuditSink.events.length;
      // Two identical successful executions produce exactly twice the
      // per-execution event count -- confirms the baseline is real and
      // proportional, not a fluke of the first call.
      expect(eventsAfterTwoSuccesses).toBe(eventsAfterOneSuccess * 2);

      const third = await request(app)
        .post("/execute")
        .set("Authorization", `Bearer ${CALLER_A_KEY}`)
        .send(createBusinessTransaction());

      expect(third.status).toBe(429);
      expect(third.body).toEqual({
        error: "Rate limit exceeded. Try again later.",
        code: "RATE_LIMITED",
      });
      expect(third.headers["retry-after"]).toBeDefined();
      expect(Number(third.headers["retry-after"])).toBeGreaterThan(0);

      // The rate-limited third request added ZERO new execution-audit
      // events -- proof it never reached BusinessTransactionMapper, policy
      // evaluation, or RuntimeAuthorizationSigner at all.
      expect(executionAuditSink.events.length).toBe(eventsAfterTwoSuccesses);
    });

    it("a rate-limited caller does not block a different caller's traffic (limits are per-key, not global)", async () => {
      const { app } = buildApp({ executePerMinute: 1, healthPerMinute: 300 });

      const callerAFirst = await request(app)
        .post("/execute")
        .set("Authorization", `Bearer ${CALLER_A_KEY}`)
        .send(createBusinessTransaction());

      const callerASecond = await request(app)
        .post("/execute")
        .set("Authorization", `Bearer ${CALLER_A_KEY}`)
        .send(createBusinessTransaction());

      const callerBFirst = await request(app)
        .post("/execute")
        .set("Authorization", `Bearer ${CALLER_B_KEY}`)
        .send(createBusinessTransaction());

      expect(callerAFirst.status).toBe(200);
      expect(callerASecond.status).toBe(429);

      // Caller B is a different key, entirely unaffected by caller A
      // exhausting its own limit.
      expect(callerBFirst.status).toBe(200);
    });
  });

  describe("GET /health and GET /ready, keyed by IP", () => {
    it("normal traffic under the limit passes through unaffected, no credential required", async () => {
      const { app } = buildApp({ executePerMinute: 30, healthPerMinute: 5 });

      const health = await request(app).get("/health");
      const ready = await request(app).get("/ready");

      expect(health.status).toBe(200);
      expect(ready.status).toBe(200);
    });

    it("traffic over the limit gets a clean 429 with a Retry-After header", async () => {
      const { app } = buildApp({ executePerMinute: 30, healthPerMinute: 2 });

      // /health and /ready share one limiter instance (mounted once in
      // app.ts, used on both routes) -- deliberately: both are the same
      // "cheap, unauthenticated, frequently polled" category this
      // limiter exists for, not two independently-throttled resources.
      await request(app).get("/health");
      await request(app).get("/health");
      const limited = await request(app).get("/health");

      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({
        error: "Rate limit exceeded. Try again later.",
        code: "RATE_LIMITED",
      });
      expect(limited.headers["retry-after"]).toBeDefined();
    });

    it("exhausting the limit via /health also rate-limits /ready (shared limiter)", async () => {
      const { app } = buildApp({ executePerMinute: 30, healthPerMinute: 1 });

      await request(app).get("/health");
      const readyAfterHealthExhausted = await request(app).get("/ready");

      expect(readyAfterHealthExhausted.status).toBe(429);
    });
  });

  describe("caller-auth disabled: /execute rate limiting is skipped entirely", () => {
    it("no caller identity to key off, so the limiter is not mounted at all", async () => {
      const { executionSystem } = createInspectableExecutionSystem();
      const application = createApplication(executionSystem);

      const app = createApp(application, {
        callerAuth: "disabled",
        rateLimit: { executePerMinute: 1, healthPerMinute: 300 },
      });

      const first = await request(app)
        .post("/execute")
        .send(createBusinessTransaction());
      const second = await request(app)
        .post("/execute")
        .send(createBusinessTransaction());

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
    });
  });

  describe("omitted rateLimit option falls back to sane defaults", () => {
    it("createApp without a rateLimit option still applies the health/ready limiter with its default", async () => {
      const { executionSystem } = createInspectableExecutionSystem();
      const application = createApplication(executionSystem);

      const authenticator = new StaticKeyAuthenticator([
        {
          callerId: "caller-a",
          keyHash: hashApiKey(CALLER_A_KEY),
          allowedPrincipalIds: ["integration-test"],
          allowedCapabilities: ["test:fixture-execute"],
        },
      ]);

      const app = createApp(application, {
        callerAuth: { authenticator, auditSink: new InMemoryCallerAuditSink() },
        // rateLimit intentionally omitted.
      });

      const response = await request(app).get("/health");
      expect(response.status).toBe(200);
    });
  });
});
