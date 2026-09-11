import "dotenv/config";

import { loadConfig } from "@parmana/shared";

import { assertStorageConfigured } from "../packages/api/dist/bootstrap/assertStorageConfigured.js";
import { assertSigningKeyMaterialConfigured } from "../packages/api/dist/bootstrap/assertSigningKeyMaterialConfigured.js";
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
 */
assertStorageConfigured();
assertSigningKeyMaterialConfigured();

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

runPolicyGovernanceIntegrityCheckAtStartup();

export default app;
