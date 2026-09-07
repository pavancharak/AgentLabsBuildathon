import path from "node:path";
import { DecisionBuilder } from "../../src/DecisionBuilder.js";
import { ExecutionBuilder } from "../../src/ExecutionBuilder.js";
import { ExecutionGate } from "../../src/ExecutionGate.js";
import { describe, expect, it } from "vitest";

import { CryptoBootstrap, TrustRecordHasher } from "@parmana/crypto";

import {
  Authority,
  Authorization,
  BusinessTransaction,
  BusinessTransactionStatus,
  TransactionMetadata,
} from "@parmana/shared";

import {
  FilePolicyRepository,
  PolicyEngine,
  PolicyRouter,
  SignalIntentBinder,
} from "@parmana/policy";

import { RuntimeEngine } from "../../src/RuntimeEngine.js";
import { RuntimePipeline } from "../../src/RuntimePipeline.js";
import { BusinessTrustPipeline } from "../../src/BusinessTrustPipeline.js";
import { RuntimeAuthorizationSigner } from "../../src/RuntimeAuthorizationSigner.js";

/**
 * RuntimeEngine End-to-End tests.
 */
describe("RuntimeEngine E2E", () => {
  const policyRepository = new FilePolicyRepository(
    path.resolve(import.meta.dirname, "../../../../policies"),
  );

  const router = new PolicyRouter(
  policyRepository,
);
const pipeline = new RuntimePipeline([]);

  const policyEngine = new PolicyEngine();

  const signalIntentBinder = new SignalIntentBinder();

  const trustPipeline =
    new BusinessTrustPipeline();

  const authorizationSigner =
    new RuntimeAuthorizationSigner();

  it(
    "executes full trust pipeline deterministically",
    async () => {
      const transaction: BusinessTransaction = {
        businessTransactionId: "tx-1",

        //
        // executionMode is not a TransactionMetadata field;
        // this fixture is deliberately loose and never read
        // by the code under test, hence the unknown cast.
        //
        metadata: {
          executionMode: "SYNC",
        } as unknown as TransactionMetadata,

        authority: {} as Authority,

        authorization: {} as Authorization,

      intent: {
  intentId: "intent-1",
  authorizationId: "authorization-1",
  action: "payments:execute",
  target: "vendor://payments",
  parameters: {
    amount: 100,
  },
  createdAt: new Date(),
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
  paymentAmount: 100,
  riskScore: 10,
  // Must match intent.target exactly: vendor-payment/2.0.0 now
  // declares boundSignals requiring vendorId === intent.target.
  vendorId: "vendor://payments",
},

        status:
          BusinessTransactionStatus.RECEIVED,

        createdAt: new Date(),
      };

      const runtime = new RuntimeEngine(
  pipeline,
  router,
  policyEngine,
  signalIntentBinder,
  new DecisionBuilder(),
  new ExecutionGate(),
  new ExecutionBuilder(),
  trustPipeline,
  authorizationSigner,
  120,
);

      const result =
        await runtime.execute(transaction);

      expect(result.transaction).toBeDefined();
      expect(result.context).toBeDefined();
      expect(result.trustRecord).toBeDefined();

      expect(
        result.trustRecord.businessTransactionId,
      ).toBe(
        transaction.businessTransactionId,
      );
    },
  );

  it(
    "stamps transaction.policy.contentHash on the Execution Trust Record with a hash of the real loaded policy content (G-24, policy-governance milestone)",
    async () => {
      const runtime = new RuntimeEngine(
        pipeline,
        router,
        policyEngine,
        signalIntentBinder,
        new DecisionBuilder(),
        new ExecutionGate(),
        new ExecutionBuilder(),
        trustPipeline,
        authorizationSigner,
        120,
      );

      const transaction: BusinessTransaction = {
        businessTransactionId: "tx-content-hash",

        metadata: {
          executionMode: "SYNC",
        } as unknown as TransactionMetadata,

        authority: {} as Authority,

        authorization: {} as Authorization,

        intent: {
          intentId: "intent-content-hash",
          authorizationId: "authorization-content-hash",
          action: "payments:execute",
          target: "vendor://payments",
          parameters: {
            amount: 100,
          },
          createdAt: new Date(),
        },

        // Caller-declared PolicyReference never carries contentHash --
        // proof it's computed server-side, not merely passed through.
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
          paymentAmount: 100,
          riskScore: 10,
          vendorId: "vendor://payments",
        },

        status: BusinessTransactionStatus.RECEIVED,

        createdAt: new Date(),
      };

      const result = await runtime.execute(transaction);

      const loadedPolicy = await policyRepository.load(
        "vendor-payment",
        "2.0.0",
      );

      const expectedContentHash = await new TrustRecordHasher(
        CryptoBootstrap.create(),
      ).hash(loadedPolicy);

      expect(result.trustRecord.transaction.policy.contentHash).toBe(
        expectedContentHash,
      );

      // Not a degenerate constant: different content hashes differently.
      const differentContentHash = await new TrustRecordHasher(
        CryptoBootstrap.create(),
      ).hash({ ...loadedPolicy, policyVersion: "9.9.9" });

      expect(result.trustRecord.transaction.policy.contentHash).not.toBe(
        differentContentHash,
      );
    },
  );

  it(
    "blocks the exact live exploit: signals describe a small verified payment, intent executes a different amount to a different target",
    async () => {
      const runtime = new RuntimeEngine(
        pipeline,
        router,
        policyEngine,
        signalIntentBinder,
        new DecisionBuilder(),
        new ExecutionGate(),
        new ExecutionBuilder(),
        trustPipeline,
        authorizationSigner,
        120,
      );

      const exploitTransaction: BusinessTransaction = {
        businessTransactionId: "tx-exploit",

        metadata: {
          executionMode: "SYNC",
        } as unknown as TransactionMetadata,

        authority: {} as Authority,

        authorization: {} as Authorization,

        intent: {
          intentId: "intent-exploit",
          authorizationId: "authorization-exploit",
          action: "payments:execute",
          // What actually executes: an attacker-controlled account
          // for $999,999,999.
          target: "ATTACKER-CONTROLLED-ACCOUNT-9999",
          parameters: {
            amount: 999999999,
          },
          createdAt: new Date(),
        },

        policy: {
          name: "vendor-payment",
          version: "2.0.0",
          schemaVersion: "1.0.0",
        },

        signals: {
          // What is declared to the policy engine: a small,
          // fully-verified payment to a known, verified vendor.
          vendorVerified: true,
          invoiceVerified: true,
          paymentApproved: true,
          sufficientFunds: true,
          paymentAmount: 5000,
          riskScore: 10,
          vendorId: "VENDOR-1001",
        },

        status: BusinessTransactionStatus.RECEIVED,

        createdAt: new Date(),
      };

      await expect(
        runtime.execute(exploitTransaction),
      ).rejects.toThrow("do not match the executed intent");
    },
  );

  it(
    "refuses execution when the configured PolicyExecutionVerifier finds a violation (2026-09-07 hardening pass), before PolicyEngine ever evaluates a rule",
    async () => {
      const policyExecutionVerifier = {
        verify: async () => ({
          reason: "has no PolicyChangeApprovalRecord -- test double",
        }),
      };

      const runtime = new RuntimeEngine(
        pipeline,
        router,
        policyEngine,
        signalIntentBinder,
        new DecisionBuilder(),
        new ExecutionGate(),
        new ExecutionBuilder(),
        trustPipeline,
        authorizationSigner,
        120,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        policyExecutionVerifier,
      );

      // Otherwise a fully valid, approving transaction -- same fixture
      // as "executes full trust pipeline deterministically" above.
      const transaction: BusinessTransaction = {
        businessTransactionId: "tx-governance-violation",

        metadata: {
          executionMode: "SYNC",
        } as unknown as TransactionMetadata,

        authority: {} as Authority,

        authorization: {} as Authorization,

        intent: {
          intentId: "intent-governance-violation",
          authorizationId: "authorization-governance-violation",
          action: "payments:execute",
          target: "vendor://payments",
          parameters: {
            amount: 100,
          },
          createdAt: new Date(),
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
          paymentAmount: 100,
          riskScore: 10,
          vendorId: "vendor://payments",
        },

        status: BusinessTransactionStatus.RECEIVED,

        createdAt: new Date(),
      };

      await expect(
        runtime.execute(transaction),
      ).rejects.toThrow("has no PolicyChangeApprovalRecord -- test double");
    },
  );

  it(
    "leaves execution unaffected when the configured PolicyExecutionVerifier finds no violation",
    async () => {
      const policyExecutionVerifier = {
        verify: async () => undefined,
      };

      const runtime = new RuntimeEngine(
        pipeline,
        router,
        policyEngine,
        signalIntentBinder,
        new DecisionBuilder(),
        new ExecutionGate(),
        new ExecutionBuilder(),
        trustPipeline,
        authorizationSigner,
        120,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        policyExecutionVerifier,
      );

      const transaction: BusinessTransaction = {
        businessTransactionId: "tx-governance-clean",

        metadata: {
          executionMode: "SYNC",
        } as unknown as TransactionMetadata,

        authority: {} as Authority,

        authorization: {} as Authorization,

        intent: {
          intentId: "intent-governance-clean",
          authorizationId: "authorization-governance-clean",
          action: "payments:execute",
          target: "vendor://payments",
          parameters: {
            amount: 100,
          },
          createdAt: new Date(),
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
          paymentAmount: 100,
          riskScore: 10,
          vendorId: "vendor://payments",
        },

        status: BusinessTransactionStatus.RECEIVED,

        createdAt: new Date(),
      };

      const result = await runtime.execute(transaction);

      expect(result.trustRecord).toBeDefined();
      expect(result.trustRecord.businessTransactionId).toBe(
        transaction.businessTransactionId,
      );
    },
  );

  it(
    "fails safely on invalid transaction",
    async () => {
const runtime = new RuntimeEngine(
  pipeline,
  router,
  policyEngine,
  signalIntentBinder,
  new DecisionBuilder(),
  new ExecutionGate(),
  new ExecutionBuilder(),
  trustPipeline,
  authorizationSigner,
  120,
);
      await expect(
        runtime.execute(
          {} as BusinessTransaction,
        ),
      ).rejects.toThrow();
    },
  );
});

