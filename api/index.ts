import "dotenv/config";

import type { IncomingMessage, ServerResponse } from "node:http";

import { loadConfig } from "@parmana/shared";

import { assertStorageConfigured } from "../packages/api/dist/bootstrap/assertStorageConfigured.js";
import {
  assertKmsSigningKeyReachable,
  assertSigningKeyMaterialConfigured,
} from "../packages/api/dist/bootstrap/assertSigningKeyMaterialConfigured.js";
import { createExecutionSystem } from "../packages/api/dist/bootstrap/createExecutionSystem.js";
import { createApplication } from "../packages/api/dist/application.js";
import { createCallerAuthenticator } from "../packages/api/dist/bootstrap/createCallerAuthenticator.js";
import { createPolicyChangeStepUpVerifier } from "../packages/api/dist/bootstrap/createPolicyChangeStepUpVerifier.js";
import { createPolicyChangeApprovalService } from "../packages/api/dist/bootstrap/createPolicyChangeApprovalService.js";
import { runPolicyGovernanceIntegrityCheckAtStartup } from "../packages/api/dist/bootstrap/runPolicyGovernanceIntegrityCheckAtStartup.js";
import { createRateLimitStore } from "../packages/api/dist/bootstrap/createRateLimitStore.js";
import { createApp } from "../packages/api/dist/app.js";

/**
 * Vercel serverless entry for the real Parmana API.
 *
 * Mirrors packages/api/src/server.ts's bootstrap exactly, minus
 * app.listen()/graceful-shutdown (Vercel's runtime owns the process
 * lifecycle, not this module) and minus
 * schedulePolicyGovernanceIntegrityCheck() (a five-minute setInterval
 * has no place in a serverless function that may cold-start per
 * invocation; runPolicyGovernanceIntegrityCheckAtStartup() below still
 * runs once per cold start, same fail-open behavior as production).
 *
 * KEY_PROVIDER=aws-kms deferred-init note (found 2026-09-15): when the
 * gateway signing key is AWS KMS via Vercel's OIDC federation
 * (@vercel/oidc-aws-credentials-provider), the AWS credential exchange
 * needs the current request's `x-vercel-oidc-token` header --
 * @vercel/oidc's own docs are explicit that this is unavailable at
 * module evaluation time, only inside a Function's actual request
 * handling. Building the app (assertKmsSigningKeyReachable,
 * createExecutionSystem -> createGatewayPublicKey's KMS GetPublicKey
 * call) eagerly at module top level -- as this file did before this
 * note, and as packages/api/src/server.ts still does for its own,
 * non-serverless runtime -- crashed every request in production the
 * moment KEY_PROVIDER=aws-kms was set. bootstrapApp() below is
 * memoized and only invoked from inside the exported handler, once an
 * actual request (with its OIDC header) is in flight; a synchronous
 * check with no AWS dependency (assertStorageConfigured,
 * assertSigningKeyMaterialConfigured's local-file branch) still runs
 * eagerly below, unchanged.
 */
assertStorageConfigured();
assertSigningKeyMaterialConfigured();

type App = Awaited<ReturnType<typeof buildApp>>;

let appPromise: Promise<App> | undefined;

async function buildApp() {
  await assertKmsSigningKeyReachable();

  const executionSystem = await createExecutionSystem();
  const application = createApplication(executionSystem);
  const callerAuth = createCallerAuthenticator();
  const executeRateLimitStore = createRateLimitStore("execute:");
  const healthRateLimitStore = createRateLimitStore("health:");

  const app = createApp(application, {
    callerAuth: callerAuth.disabled
      ? "disabled"
      : {
          authenticator: callerAuth.authenticator,
          auditSink: callerAuth.auditSink,
        },
    rateLimit: {
      ...loadConfig().rateLimit,
      ...(executeRateLimitStore ? { executeStore: executeRateLimitStore } : {}),
      ...(healthRateLimitStore ? { healthStore: healthRateLimitStore } : {}),
    },
    ...(callerAuth.disabled
      ? {}
      : {
          stepUpVerifier: createPolicyChangeStepUpVerifier(),
          policyChangeApprovalService: createPolicyChangeApprovalService(),
        }),
  });

  runPolicyGovernanceIntegrityCheckAtStartup();

  return app;
}

/**
 * getApp() memoizes the in-flight/completed build so concurrent
 * requests hitting a cold container don't each trigger their own
 * full bootstrap (and, if the build ever throws, the next request
 * gets a fresh attempt rather than a permanently-poisoned rejected
 * promise cached for the lifetime of the container).
 */
function getApp(): Promise<App> {
  if (appPromise === undefined) {
    appPromise = buildApp().catch((error: unknown) => {
      appPromise = undefined;
      throw error;
    });
  }

  return appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await getApp();

  app(req, res);
}
