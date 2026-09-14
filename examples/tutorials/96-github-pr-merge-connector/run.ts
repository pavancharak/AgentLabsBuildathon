import crypto from "node:crypto";

import type { BusinessTransaction } from "@parmana/shared";
import { MockGitHubServer } from "@parmana/connector-github";

//
// The GitHub sibling of Tutorial 69: approve + execute a real PR merge
// through the same production composition (createExecutionSystem +
// createApplication), pointed at a hermetic MockGitHubServer via the
// GITHUB_BASE_URL test seam instead of GitHub's live API.
//
process.env.NODE_ENV = "test";

const INSTALLATION_TOKEN = "test-mock-installation-token-a1b2c3d4e5f6";

const mockServer = new MockGitHubServer({
  installationToken: INSTALLATION_TOKEN,
});
await mockServer.listen();

process.env.GITHUB_BASE_URL = mockServer.baseUrl;
// Unlike HubSpot's single static token, GitHub's credential is ephemeral:
// every resolve() signs a JWT and exchanges it for a short-lived
// installation token. With TEST_GITHUB_APP_ID/TEST_GITHUB_INSTALLATION_ID/
// TEST_GITHUB_APP_PRIVATE_KEY left unset (the default), NODE_ENV=test
// alone makes createGitHubCredentialProvider.ts generate a fresh,
// never-real RSA keypair and harmless placeholder ids -- MockGitHubServer
// never verifies the JWT's signature, so no further env overrides are
// needed here the way Tutorial 69 needs for HubSpot's empty-string gotcha.

const { createExecutionSystem } =
  await import("../../../packages/api/src/bootstrap/createExecutionSystem.js");
const { createApplication } =
  await import("../../../packages/api/src/application.js");

function prMergeTransaction(overrides: {
  owner: string;
  repo: string;
  pullNumber: number;
  mergeMethod?: string;
  signals: Record<string, unknown>;
}): BusinessTransaction {
  const businessTransactionId = crypto.randomUUID();
  const authorityId = crypto.randomUUID();
  const authorizationId = crypto.randomUUID();
  const intentId = crypto.randomUUID();
  const now = new Date();

  return {
    businessTransactionId,
    metadata: {
      businessTransactionId,
      correlationId: crypto.randomUUID(),
      createdBy: "tutorial-96",
      createdAt: now,
    },
    authority: {
      authorityId,
      authorityType: "SERVICE",
      principalId: "tutorial-96",
      displayName: "Tutorial 96",
      issuedAt: now,
    },
    authorization: {
      authorizationId,
      authorityId,
      purpose: "Tutorial",
      authorizedAt: now,
    },
    intent: {
      intentId,
      authorizationId,
      action: "github:pr-merge",
      target: `${overrides.owner}/${overrides.repo}#${overrides.pullNumber}`,
      parameters: Object.freeze({
        mergeMethod: overrides.mergeMethod ?? "squash",
      }),
      createdAt: now,
    },
    policy: {
      name: "github-pr-approval",
      version: "1.0.0",
      schemaVersion: "1.0.0",
    },
    signals: overrides.signals,
    status: "RECEIVED",
    createdAt: now,
  } as unknown as BusinessTransaction;
}

console.log();
console.log("==================================================");
console.log("Tutorial 96 - GitHub PR Merge Connector");
console.log("==================================================");
console.log();

try {
  mockServer.setPullRequest("acme", "widgets", {
    number: 42,
    mergeable: true,
    mergedAt: null,
    headSha: "abc123",
    baseRef: "main",
  });

  const executionSystem = createExecutionSystem();
  const application = createApplication(executionSystem);

  const transaction = prMergeTransaction({
    owner: "acme",
    repo: "widgets",
    pullNumber: 42,
    signals: {
      repositoryAuthorized: true,
      requiredReviewsCompleted: true,
      statusChecksPassed: true,
      branchProtected: true,
      riskScore: 5,
    },
  });

  const trustRecord = await application.execute(transaction);
  const decision = trustRecord.executions.at(-1)?.decision;

  console.log("Decision");
  console.log("--------------------------------------------------");
  console.log(`Outcome : ${decision?.outcome}`);
  console.log(`Reason  : ${decision?.reason}`);
  console.log();

  // The strongest proof this went through the real connector end to
  // end: the PR actually merged on the (mock) GitHub server.
  const pr = mockServer.getPullRequest("acme", "widgets", 42);

  console.log("GitHub Mock Server State");
  console.log("--------------------------------------------------");
  console.log(`PR #42 mergedAt : ${pr?.mergedAt}`);
  console.log(`Merge calls     : ${mockServer.mergeCalls}`);
  console.log();

  if (decision?.outcome === "APPROVED" && pr?.mergedAt !== null) {
    console.log(
      "✓ PR merge authorized and executed against the real connector.",
    );
  } else {
    console.log("✗ Expected an approved decision with the PR merged.");
  }

  console.log();
  console.log("Tutorial Complete");
  console.log("Next: Tutorial 97 - Execution Chain Integrity");
} finally {
  await mockServer.close();
}
