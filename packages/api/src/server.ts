import "dotenv/config";

import { loadConfig } from "@parmana/shared";

import { assertStorageConfigured } from "./bootstrap/assertStorageConfigured.js";
import {
  assertKmsSigningKeyReachable,
  assertSigningKeyMaterialConfigured,
} from "./bootstrap/assertSigningKeyMaterialConfigured.js";
import { assertPaytmConnectorConfigured } from "./bootstrap/assertPaytmConnectorConfigured.js";
import { createGracefulShutdown } from "./bootstrap/createGracefulShutdown.js";
import { createExecutionSystem } from "./bootstrap/createExecutionSystem.js";
import { createApplication } from "./application.js";
import { createCallerAuthenticator } from "./bootstrap/createCallerAuthenticator.js";
import { createPolicyChangeStepUpVerifier } from "./bootstrap/createPolicyChangeStepUpVerifier.js";
import { createPolicyChangeApprovalService } from "./bootstrap/createPolicyChangeApprovalService.js";
import { runPolicyGovernanceIntegrityCheckAtStartup } from "./bootstrap/runPolicyGovernanceIntegrityCheckAtStartup.js";
import { schedulePolicyGovernanceIntegrityCheck } from "./bootstrap/schedulePolicyGovernanceIntegrityCheck.js";
import { createRateLimitStore } from "./bootstrap/createRateLimitStore.js";
import { createApp } from "./app.js";

/**
 * Fail-closed startup validation, before any other bootstrap runs and
 * before the port is ever bound. Everything else this module calls
 * below already fails closed once invoked (createNonceStore,
 * createCallerAuditSink, createCallerAuthenticator, ...) — these two
 * run first specifically because nothing else in this codebase
 * validates them eagerly: durable storage is normally validated
 * lazily (repositories.ts's Proxy, deliberately, so test collection on
 * a machine with no credentials doesn't construct a live Supabase
 * client — see assertStorageConfigured.ts), and signing key material
 * is normally validated lazily too (FileKeyProvider, only on the first
 * sign/verify call — see assertSigningKeyMaterialConfigured.ts).
 * assertPaytmConnectorConfigured() closes a narrower gap: not "is the
 * Paytm connector configured at all" (it's optional, like HubSpot/
 * GitHub — createConnectorRegistry.ts simply doesn't register it when
 * unset), but "is it configured consistently" — refusing to start with
 * only one of PAYTM_CONNECTOR_URL/PAYTM_CONNECTOR_SHARED_SECRET set,
 * which would otherwise surface later as a connector that "registered"
 * but can never authenticate to or reach the remote Paytm connector
 * service.
 * Without these, a misconfigured process could bind the port, pass
 * /health, and only fail on its first real request.
 */
assertStorageConfigured();
assertSigningKeyMaterialConfigured();
await assertKmsSigningKeyReachable();
assertPaytmConnectorConfigured();

const executionSystem = createExecutionSystem();

const application = createApplication(executionSystem);

const callerAuth = createCallerAuthenticator();

const rateLimitStore = createRateLimitStore();

const app = createApp(application, {
  callerAuth: callerAuth.disabled
    ? "disabled"
    : {
        authenticator: callerAuth.authenticator,
        auditSink: callerAuth.auditSink,
      },
  rateLimit: {
    ...loadConfig().rateLimit,
    ...(rateLimitStore ? { store: rateLimitStore } : {}),
  },
  ...(callerAuth.disabled
    ? {}
    : {
        stepUpVerifier: createPolicyChangeStepUpVerifier(),
        policyChangeApprovalService: createPolicyChangeApprovalService(),
      }),
});

// PaaS platforms (Railway, Render, Fly, etc.) commonly inject PORT
// dynamically at deploy time and expect the process to bind to
// whatever value they provide, not a hardcoded default — Config.ts's
// api.port already reads process.env.PORT with a 3000 fallback for
// local development, so this is the only place that needs to change to
// stop hardcoding it.
const PORT = loadConfig().api.port;
const HOST = process.env.HOST ?? "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`API running on http://${HOST}:${PORT}`);
});

/**
 * Policy Governance deploy/startup integrity check (G-24) -- fired
 * here, not awaited above the port bind, and not gated on
 * callerAuth: unlike assertStorageConfigured/
 * assertSigningKeyMaterialConfigured above, this check is fail-open
 * by design (see its own doc comment) and must never delay the
 * server from accepting traffic. It runs regardless of whether
 * caller-auth is enabled -- it verifies live-file-vs-approval-record
 * consistency in durable storage, a concern orthogonal to whether
 * this process happens to have caller identity wiring turned on.
 */
runPolicyGovernanceIntegrityCheckAtStartup();

/**
 * ...and again on a fixed interval for the rest of this process's
 * uptime -- see schedulePolicyGovernanceIntegrityCheck.ts for why the
 * startup-only run above leaves a gap between deploys.
 */
schedulePolicyGovernanceIntegrityCheck();

// Graceful shutdown on SIGTERM/SIGINT — see createGracefulShutdown.ts
// for the full reasoning and what it guards against.
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 10_000);
const shutdown = createGracefulShutdown({
  server,
  timeoutMs: SHUTDOWN_TIMEOUT_MS,
});

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
