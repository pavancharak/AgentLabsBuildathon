import express from "express";
import documentationRoutes from "./routes/documentation.js";
import referenceRoutes from "./routes/reference.js";

import { createErrorHandler } from "./middleware/error-handler.js";
import { createCallerAuthMiddleware } from "./middleware/caller-auth.js";
import {
  createExecuteRateLimiter,
  createHealthReadyRateLimiter,
} from "./middleware/rate-limit.js";
import type { Store } from "express-rate-limit";

import policyRoutes from "./routes/policies.js";
import { createPendingPolicyChangesRouter } from "./routes/pending-policy-changes.js";
import type { ExecutionTrustApplication } from "@parmana/runtime";

import { createExecuteRouter } from "./routes/execute.js";
import healthRoutes from "./routes/health.js";
import openapiRoutes from "./routes/openapi.js";
import { createReceiptRouter } from "./routes/receipt.js";

import { createReplayRouter } from "./routes/replay.js";
import { createReceiptGetRouter } from "./routes/receipt-get.js";
import { createTransactionsRouter } from "./routes/transactions.js";
import { createCallersMeRouter } from "./routes/callers-me.js";
import { createTrustRecordsRouter } from "./routes/trust-records.js";
import { createVerifyGetRouter } from "./routes/verify-get.js";
import { createVerifyRouter } from "./routes/verify.js";
import { createRefusalVerifyRouter } from "./routes/refusal-verify.js";
import { createRefusalGetRouter } from "./routes/refusal-get.js";
import { createAuditVerifyRouter } from "./routes/audit-verify.js";
import { createReadyRouter } from "./routes/ready.js";
import { createKeysRouter } from "./routes/keys.js";

import versionRoutes from "./routes/version.js";

import type { CallerAuthenticator } from "./auth/CallerAuthenticator.js";
import type { CallerAuditSink } from "./auth/CallerAuditSink.js";
import type { PolicyChangeStepUpVerifier } from "./auth/PolicyChangeStepUpVerifier.js";
import type { PolicyChangeApprovalService } from "./governance/PolicyChangeApprovalService.js";

/**
 * Every call site must state its caller-auth choice explicitly:
 * either a real authenticator/auditSink pair, or the literal
 * string "disabled" to mount the app with no caller-auth
 * middleware at all. There is no default: silently omitting
 * this option is exactly the failure mode this type exists to
 * rule out (see docs/CLAIMS.md and the July 2026 audit closeout).
 */
export type CallerAuthOption =
  | "disabled"
  | {
      readonly authenticator: CallerAuthenticator;
      readonly auditSink: CallerAuditSink;
    };

/**
 * Optional, unlike callerAuth: every existing call site (roughly twenty
 * test files, plus server.ts) predates rate limiting, and requiring
 * this field would force every one of them to state a value it has no
 * opinion about. Omitted entirely, this deployment gets
 * DEFAULT_EXECUTE_PER_MINUTE/DEFAULT_HEALTH_PER_MINUTE below -- the same
 * numbers packages/shared/src/config/Config.ts falls back to when
 * RATE_LIMIT_EXECUTE_PER_MINUTE/RATE_LIMIT_HEALTH_PER_MINUTE are unset,
 * so server.ts's real wiring and a bare createApp(application, {
 * callerAuth }) call behave identically unless a test deliberately
 * overrides one to exercise 429 behavior.
 */
export interface RateLimitOption {
  readonly executePerMinute: number;
  readonly healthPerMinute: number;

  /**
   * Shared Store backing both limiters below (see
   * createRateLimitStore.ts). Optional: omitted, each limiter falls
   * back to express-rate-limit's own in-process MemoryStore, exactly
   * the behavior every existing call site had before this field
   * existed.
   */
  readonly store?: Store;
}

const DEFAULT_EXECUTE_PER_MINUTE = 30;
const DEFAULT_HEALTH_PER_MINUTE = 300;

export interface CreateAppOptions {
  readonly callerAuth: CallerAuthOption;
  readonly rateLimit?: RateLimitOption;

  /**
   * Verifies the step-up authorization envelope required on POST
   * /policies/pending-changes/:id/approve and .../reject (Policy
   * Governance, maker-checker, Layer 4) -- see
   * PolicyChangeStepUpVerifier and requireStepUpAuthorization in
   * pending-policy-changes.ts. Optional at this type's level, the same
   * way auditSink threading elsewhere in this file is conditional on
   * callerAuth, but NOT optional in effect once callerAuth is enabled:
   * approve/reject fail closed (StepUpAuthorizationInvalidError) when
   * this is undefined, exactly as when it is provided but the
   * envelope itself is missing or invalid. Omitted in the
   * callerAuth-disabled case (local development/tutorials only) since
   * neither endpoint is reachable without a caller identity there.
   */
  readonly stepUpVerifier?: PolicyChangeStepUpVerifier;

  /**
   * Resolves an approved pending policy change into its live
   * policies/{name}/{version}/policy.json write and signed
   * PolicyChangeApprovalRecord (Policy Governance, maker-checker) --
   * see PolicyChangeApprovalService and pending-policy-changes.ts's
   * approve handler. Optional at this type's level for the same
   * reason stepUpVerifier is: omitted entirely in the
   * callerAuth-disabled case, where the endpoint is unreachable
   * anyway. NOT optional in effect once callerAuth is enabled --
   * approve fails closed (a plain thrown Error, surfaced as a 500 by
   * the global error handler) when this is undefined but an approval
   * is actually attempted, rather than silently resolving the pending
   * change with no corresponding live effect.
   */
  readonly policyChangeApprovalService?: PolicyChangeApprovalService;
}

export function createApp(
  application: ExecutionTrustApplication,
  options: CreateAppOptions,
) {
  const app = express();

  /**
   * Trust exactly one proxy hop: Fly.io's edge (fly.toml sets
   * force_https there), the only reverse proxy in front of this app.
   * Without this, Express ignores X-Forwarded-For and ignores
   * X-Forwarded-Proto, so req.ip and req.protocol/req.secure both
   * reflect the proxy's own connection to this process rather than the
   * original client's.
   */
  app.set("trust proxy", 1);

  const executePerMinute =
    options.rateLimit?.executePerMinute ?? DEFAULT_EXECUTE_PER_MINUTE;
  const healthPerMinute =
    options.rateLimit?.healthPerMinute ?? DEFAULT_HEALTH_PER_MINUTE;

  app.use(express.json());

  /**
   * System
   *
   * /health, /ready, /openapi.yaml, /documentation, and /reference are
   * the routes exempt from caller authentication: liveness/readiness
   * probes and API documentation consumers must be able to reach them
   * with no credential (a caller cannot discover how to get a key from a
   * spec it is not allowed to read, and a PaaS orchestrator has no API
   * key at all). Everything below this line, including "/" and
   * "/version", sits behind the middleware when it is provided.
   */
  const healthReadyRateLimiter = createHealthReadyRateLimiter(
    healthPerMinute,
    options.rateLimit?.store,
  );

  app.use("/health", healthReadyRateLimiter, healthRoutes);
  app.use(
    "/ready",
    healthReadyRateLimiter,
    createReadyRouter({ authDisabled: options.callerAuth === "disabled" }),
  );
  app.use("/openapi.yaml", openapiRoutes);
  app.use("/documentation", documentationRoutes);
  app.use("/reference", referenceRoutes);

  /**
   * RFC-0021: deliberately exempt from caller-auth, alongside the
   * system routes above -- this is the unauthenticated, third-party
   * signature-verification capability, not a data-access route. Its
   * ownership-scoped counterpart, GET /refusal/:businessTransactionId,
   * is mounted below the middleware with everything else.
   */
  app.use("/refusal/verify", createRefusalVerifyRouter(application));

  /**
   * Audit-sink signing milestone: the same unauthenticated,
   * third-party-verifiable capability as POST /refusal/verify above,
   * over the durable caller_audit_events audit trail instead of Refusal
   * Records. No ExecutionTrustApplication dependency -- verification
   * here is pure signature-over-bytes, with no database lookup
   * involved.
   */
  app.use("/audit/verify", createAuditVerifyRouter());

  /**
   * PQC audit RED-2 (docs/VERIFICATION-GAPS.md): public-key discovery,
   * the same unauthenticated-by-necessity category as
   * /refusal/verify and /audit/verify above -- a third party fetching
   * the key it needs to independently verify a signature cannot be
   * required to already hold a Parmana credential to reach it.
   * Defines its own full paths (/keys/:keyId and
   * /.well-known/jwks.json) rather than being mounted at a prefix; see
   * keys.ts's own comment for why.
   */
  app.use(createKeysRouter());

  if (options.callerAuth !== "disabled") {
    app.use(
      createCallerAuthMiddleware(
        options.callerAuth.authenticator,
        options.callerAuth.auditSink,
      ),
    );
  }
  app.get("/", (_req, res) => {
    res.json({
      name: "Parmana",
      status: "UP",
    });
  });

  app.use("/version", versionRoutes);

  /**
   * Caller identity/scope self-lookup ("show me this agent's identity
   * and exactly what it's authorized to do").
   */
  app.use("/callers/me", createCallersMeRouter());

  /**
   * Rate limiting on /execute is keyed by authenticated caller identity
   * (req.callerId), so it is only meaningful -- and only mounted -- when
   * caller-auth itself is enabled. When callerAuth is "disabled" (local
   * development/tutorials only, never a real deployment), there is no
   * caller identity to key off, so this is skipped entirely rather than
   * silently falling back to an IP-keyed limit that would defeat the
   * whole point of keying by caller in the first place.
   */
  app.use(
    "/execute",
    ...(options.callerAuth !== "disabled"
      ? [createExecuteRateLimiter(executePerMinute, options.rateLimit?.store)]
      : []),
    createExecuteRouter(
      application,
      options.callerAuth !== "disabled"
        ? options.callerAuth.auditSink
        : undefined,
    ),
  );

  /**
   * Verification
   */
  app.use("/verify", createVerifyRouter(application));

  app.use("/verification", createVerifyGetRouter(application));

  /**
   * Refusal Records (RFC-0021)
   *
   * Ownership-scoped lookup by ID -- the unauthenticated verification
   * route (POST /refusal/verify) is mounted above, before caller-auth.
   */
  app.use("/refusal", createRefusalGetRouter(application));
  /**
   * Receipts
   */
  app.use("/receipt", createReceiptRouter(application));
  app.use("/receipt/latest", createReceiptGetRouter(application));

  /**
   * Business Transactions
   */
  app.use(
    "/transactions",
    createTransactionsRouter(
      application,
      options.callerAuth !== "disabled"
        ? options.callerAuth.auditSink
        : undefined,
    ),
  );

  /**
   * Policies
   */
  app.use("/policies", policyRoutes);

  /**
   * Policy Governance (maker-checker). Mounted at the same /policies
   * prefix as the router above -- path shapes don't collide (see
   * pending-policy-changes.ts's own routes).
   */
  app.use(
    "/policies",
    createPendingPolicyChangesRouter(
      options.callerAuth !== "disabled"
        ? options.callerAuth.auditSink
        : undefined,
      options.stepUpVerifier,
      options.policyChangeApprovalService,
    ),
  );

  /**
   * Execution Trust Records
   */
  app.use("/trust-records", createTrustRecordsRouter(application));

  /**
   * Replay
   */
  app.use("/replay", createReplayRouter(application));

  /**
   * Error handling
   *
   * Must be registered after all routes. Threaded with the same
   * auditSink every other caller-facing route uses (G-29,
   * docs/VERIFICATION-GAPS.md) so the one rejection category this file
   * itself fully handles -- a malformed/oversized request body, rejected
   * by express.json() before caller-auth middleware or any route handler
   * ever runs -- gets a best-effort audit record too, not only the
   * correct HTTP response.
   */
  app.use(
    createErrorHandler(
      options.callerAuth !== "disabled"
        ? options.callerAuth.auditSink
        : undefined,
    ),
  );

  return app;
}
