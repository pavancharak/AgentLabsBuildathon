/**
 * Load test for POST /execute (policy evaluation + signing + connector
 * execution) and GET /health, /ready (PaaS-polled liveness/readiness).
 *
 * Closes the "no load testing exists anywhere in the repo" production-
 * readiness gap: this exercises the real HTTP surface (a real server
 * process, real policy evaluation against policies/vendor-payment, real
 * Ed25519 signing, the real test-fixture connector) rather than a unit
 * benchmark of one function in isolation.
 *
 * Scope, stated plainly rather than assumed: runs with
 * PARMANA_AUTH_DISABLED=true and in-memory storage (NODE_ENV=test), so
 * this measures policy/signing/connector overhead under concurrency,
 * NOT the caller-auth or /execute-rate-limiter middleware layers (rate
 * limiting is only mounted when caller-auth is enabled — see
 * packages/api/src/app.ts) and not a durable-storage-backed deployment.
 * Extend this script (a real PARMANA_API_KEYS entry, PARMANA_STORAGE=
 * supabase against a real database) before treating its numbers as
 * representative of the actual production deployment shape.
 *
 * Usage: npm run loadtest [-- --connections 20 --duration 15]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import autocannon from "autocannon";
import getPort from "get-port";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

interface CliOptions {
  readonly connections: number;
  readonly duration: number;
}

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: number): number => {
    const index = args.indexOf(flag);
    if (index === -1 || index === args.length - 1) return fallback;
    const parsed = Number(args[index + 1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    connections: get("--connections", 20),
    duration: get("--duration", 15),
  };
}

function businessTransactionBody(): Record<string, unknown> {
  const businessTransactionId = randomUUID();
  const authorityId = randomUUID();
  const authorizationId = randomUUID();
  const intentId = randomUUID();

  return {
    businessTransactionId,
    metadata: {
      businessTransactionId,
      correlationId: randomUUID(),
      createdBy: "load-test",
      createdAt: new Date().toISOString(),
    },
    authority: {
      authorityId,
      authorityType: "USER",
      principalId: "load-test",
      displayName: "Load Test",
      issuedAt: new Date().toISOString(),
    },
    authorization: {
      authorizationId,
      authorityId,
      purpose: "Load Test",
      authorizedAt: new Date().toISOString(),
    },
    intent: {
      intentId,
      authorizationId,
      action: "test:fixture-execute",
      target: "vendor://payments",
      parameters: { paymentId: "payment-001", amount: 1000 },
      createdAt: new Date().toISOString(),
    },
    policy: {
      name: "vendor-payment",
      version: "2.0.0",
      schemaVersion: "1.0.0",
    },
    signals: {
      vendorVerified: true,
      invoiceVerified: true,
      paymentApproved: true,
      sufficientFunds: true,
      paymentAmount: 1000,
      riskScore: 10,
      vendorId: "vendor://payments",
    },
    decision: { outcome: "APPROVED" },
    status: "APPROVED",
    createdAt: new Date().toISOString(),
  };
}

async function waitForHealth(
  baseUrl: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Server did not become healthy within ${timeoutMs}ms.`);
}

function startServer(port: number): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "./node_modules/tsx/dist/cli.mjs",
        path.join(root, "packages/api/src/server.ts"),
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          NODE_ENV: "test",
          PORT: String(port),
          PARMANA_AUTH_DISABLED: "true",

          // Deliberately uncapped for this run: RATE_LIMIT_HEALTH_PER_
          // MINUTE's real default (300) exists for PaaS polling every
          // ~30s, not for measuring this endpoint's own raw request
          // capacity -- left at its default, a load test at any
          // meaningful concurrency immediately saturates it and every
          // subsequent request reports 429, measuring the rate limiter
          // instead of the endpoint. POST /execute is unaffected either
          // way (that limiter only mounts when caller-auth is enabled;
          // this run disables it above).
          RATE_LIMIT_HEALTH_PER_MINUTE: "10000000",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`Server process exited early with code ${code}.`));
      }
    });

    resolve(child);
  });
}

function summarize(label: string, result: autocannon.Result): void {
  console.log(`\n--- ${label} ---`);
  console.log(
    `requests: ${result.requests.total} (${result.requests.average.toFixed(1)}/s avg)`,
  );
  console.log(
    `latency (ms): p50=${result.latency.p50} p95=${result.latency.p97_5} p99=${result.latency.p99} max=${result.latency.max}`,
  );
  console.log(
    `errors: ${result.errors}, timeouts: ${result.timeouts}, non-2xx: ${result.non2xx}`,
  );
}

async function main(): Promise<void> {
  const { connections, duration } = parseCliOptions();
  const port = await getPort();
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(
    `Starting server on ${baseUrl} (NODE_ENV=test, in-memory storage, auth disabled)...`,
  );
  const server = await startServer(port);

  try {
    await waitForHealth(baseUrl, 15_000);
    console.log("Server is healthy. Running load test...\n");

    const healthResult = await autocannon({
      url: `${baseUrl}/health`,
      connections,
      duration,
    });
    summarize("GET /health", healthResult);

    const readyResult = await autocannon({
      url: `${baseUrl}/ready`,
      connections,
      duration,
    });
    summarize("GET /ready", readyResult);

    const executeResult = await autocannon({
      url: `${baseUrl}/execute`,
      connections,
      duration,
      requests: [
        {
          method: "POST",
          path: "/execute",
          headers: { "content-type": "application/json" },
          setupRequest: (request) => ({
            ...request,
            body: JSON.stringify(businessTransactionBody()),
          }),
        },
      ],
    });
    summarize(
      "POST /execute (policy eval + sign + connector execute)",
      executeResult,
    );
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
