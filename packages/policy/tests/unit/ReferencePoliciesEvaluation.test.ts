import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import path from "node:path";

import { PolicyEngine } from "../../src/PolicyEngine.js";

import { PolicyValidator } from "../../src/PolicyValidator.js";

import type { Policy } from "../../src/types/Policy.js";

import type { PolicySignals } from "../../src/types/PolicySignals.js";

describe("Reference Policy Evaluation", () => {
  const validator = new PolicyValidator();

  const engine = new PolicyEngine();

  interface TestCase {
    name: string;
    file: string;
    signals: PolicySignals;
  }

  const cases: TestCase[] = [
    {
      name: "access-control",
      file: "access-control/1.0.0/policy.json",
      signals: {
        userAuthenticated: true,
        userAuthorized: true,
        mfaVerified: true,
        deviceTrusted: true,
        sessionRiskScore: 10,
      },
    },
    {
      name: "customer-refund",
      file: "customer-refund/1.0.0/policy.json",
      signals: {
        refundEligible: true,
        managerApproved: true,
        fraudCheckPassed: true,
        refundAmount: 5000,
      },
    },
    {
      name: "database-change",
      file: "database-change/3.0.0/policy.json",
      signals: {
        changeApproved: true,
        migrationValidated: true,
        backupAvailable: true,
        maintenanceWindow: true,
        riskScore: 10,
      },
    },
    {
      name: "github-pr-approval",
      file: "github-pr-approval/1.0.0/policy.json",
      signals: {
        repositoryAuthorized: true,
        requiredReviewsCompleted: true,
        statusChecksPassed: true,
        branchProtected: true,
        riskScore: 10,
      },
    },
    {
      name: "llm-tool-call",
      file: "llm-tool-call/1.0.0/policy.json",
      signals: {
        toolAllowed: true,
        resourceAuthorized: true,
        humanApproval: true,
        executionEnvironment: "production",
        riskScore: 10,
      },
    },
    {
      name: "production-deployment",
      file: "production-deployment/1.0.0/policy.json",
      signals: {
        deploymentApproved: true,
        changeVerified: true,
        rollbackReady: true,
        maintenanceWindow: true,
        riskScore: 10,
      },
    },
    {
      name: "rag-document-access",
      file: "rag-document-access/1.0.0/policy.json",
      signals: {
        requesterAuthenticated: true,
        requesterAuthorized: true,
        documentAccessible: true,
        classificationPermitted: true,
        riskScore: 10,
      },
    },
    {
      name: "vendor-payment",
      file: "vendor-payment/2.0.0/policy.json",
      signals: {
        vendorVerified: true,
        invoiceVerified: true,
        paymentApproved: true,
        sufficientFunds: true,
        paymentAmount: 1000,
        riskScore: 10,
      },
    },
  ];

  for (const testCase of cases) {
    it(`evaluates ${testCase.name}`, () => {
      const policy = JSON.parse(
        readFileSync(
          path.resolve(
            import.meta.dirname,
            "../../../../policies",
            testCase.file,
          ),
          "utf8",
        ),
      ) as Policy;

      expect(() => validator.validate(policy)).not.toThrow();

      const decision = engine.evaluate(policy, testCase.signals);

      expect(decision.policyId).toBe(policy.policyId);

      expect(decision.policyVersion).toBe(policy.policyVersion);

      expect(decision.matchedRuleId).not.toBe("");

      expect(decision.reason).not.toBe("");

      expect(decision.evaluatedRules).toBeGreaterThan(0);
    });
  }
});
