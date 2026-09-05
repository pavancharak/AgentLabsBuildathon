import { describe, expect, it } from "vitest";

import {
  AuthorityType,
  BusinessTransactionStatus,
  type BusinessTransaction,
  type BusinessTransactionRepository,
  type Execution,
  type ExecutionTrustRecord,
  type ExecutionTrustRecordRepository,
  type Override,
  type Receipt,
  type Verification,
} from "@parmana/shared";

import {
  PolicyAction,
  type Policy,
  type PolicyRepository,
} from "@parmana/policy";

import {
  DefaultExecutionSystem,
  type ExecutionRequest,
  type ExecutionResult,
  type ExecutionSystem,
} from "@parmana/execution-system";

import {
  AuthorizationVerifier,
  CryptoBootstrap,
  FileKeyProvider,
  TrustRecordHasher,
  VerificationCrypto,
} from "@parmana/crypto";

import { RuntimeBuilder } from "../../src/RuntimeBuilder.js";
import { RuntimeError } from "../../src/errors/RuntimeError.js";
import { ExecutionRequestBuilder } from "../../src/ExecutionRequestBuilder.js";
import { ExecutionEvidenceBuilder } from "../../src/ExecutionEvidenceBuilder.js";
import { ExecutionService } from "../../src/services/execution-service.js";
import { ExecutionComponent } from "../../src/components/ExecutionComponent.js";
import { TrustChainValidationComponent } from "../../src/components/TrustChainValidationComponent.js";

//
// In-memory test doubles.
//
// These exist only to exercise the real RuntimeBuilder /
// RuntimeEngine / ExecutionComponent wiring end-to-end,
// without depending on a filesystem-backed PolicyRepository
// or a real database.
//

class InMemoryBusinessTransactionRepository
  implements BusinessTransactionRepository
{
  private readonly store = new Map<string, BusinessTransaction>();

  async create(
    transaction: BusinessTransaction,
  ): Promise<BusinessTransaction> {
    this.store.set(transaction.businessTransactionId, transaction);
    return transaction;
  }

  async findById(
    businessTransactionId: string,
  ): Promise<BusinessTransaction | null> {
    return this.store.get(businessTransactionId) ?? null;
  }

  async exists(businessTransactionId: string): Promise<boolean> {
    return this.store.has(businessTransactionId);
  }

  async list(): Promise<readonly BusinessTransaction[]> {
    return [...this.store.values()];
  }
}

class InMemoryExecutionTrustRecordRepository
  implements ExecutionTrustRecordRepository
{
  private readonly store = new Map<string, ExecutionTrustRecord>();

  async create(
    record: ExecutionTrustRecord,
  ): Promise<ExecutionTrustRecord> {
    this.store.set(record.businessTransactionId, record);
    return record;
  }

  async findByTransactionId(
    businessTransactionId: string,
  ): Promise<ExecutionTrustRecord | null> {
    return this.store.get(businessTransactionId) ?? null;
  }

  async appendExecution(
    _businessTransactionId: string,
    _execution: Execution,
  ): Promise<void> {}

  async replaceExecution(_execution: Execution): Promise<void> {}

  async appendOverride(
    _businessTransactionId: string,
    _override: Override,
  ): Promise<void> {}

  async appendVerification(
    _businessTransactionId: string,
    _verification: Verification,
  ): Promise<void> {}

  async appendReceipt(
    _businessTransactionId: string,
    _receipt: Receipt,
  ): Promise<void> {}
}

class FixedPolicyRepository implements PolicyRepository {
  constructor(private readonly policy: Policy) {}

  async load(_name: string, _version: string): Promise<Policy> {
    return this.policy;
  }

  async save(): Promise<void> {
    throw new Error("not used by these tests");
  }
}

/**
 * Records the last ExecutionRequest forwarded downstream,
 * then delegates to DefaultExecutionSystem so the runtime
 * pipeline completes normally.
 */
class RecordingExecutionSystem implements ExecutionSystem {
  public lastRequest: ExecutionRequest | undefined;

  private readonly delegate = new DefaultExecutionSystem();

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    this.lastRequest = request;
    return this.delegate.execute(request);
  }
}

const APPROVE_POLICY: Policy = {
  policyId: "payment-approval",
  policyVersion: "1.0.0",
  schemaVersion: "1.0.0",
  rules: [
    {
      id: "approve-all",
      condition: { always: true },
      outcome: {
        action: PolicyAction.APPROVE,
        reason: "approved for test",
      },
    },
  ],
};

const REJECT_POLICY: Policy = {
  policyId: "payment-approval",
  policyVersion: "1.0.0",
  schemaVersion: "1.0.0",
  rules: [
    {
      id: "reject-all",
      condition: { always: true },
      outcome: {
        action: PolicyAction.REJECT,
        reason: "rejected for test",
      },
    },
  ],
};

function createTransaction(
  businessTransactionId: string,
): BusinessTransaction {
  const authorityId = "authority-1";
  const authorizationId = "authorization-1";
  const fixedDate = new Date("2026-01-01T00:00:00Z");

  return {
    businessTransactionId,

    metadata: {
      businessTransactionId,
    },

    authority: {
      authorityId,
      authorityType: AuthorityType.SERVICE,
      principalId: "svc-1",
      issuedAt: fixedDate,
    },

    authorization: {
      authorizationId,
      authorityId,
      purpose: "test",
      issuedAt: fixedDate,
    },

    intent: {
      intentId: "intent-1",
      authorizationId,
      action: "PAY",
      target: "vendor/1",
      parameters: { amount: 100 },
      createdAt: fixedDate,
    },

    policy: {
      name: "payment-approval",
      version: "1.0.0",
      schemaVersion: "1.0.0",
    },

    signals: { amount: 100 },

    status: BusinessTransactionStatus.RECEIVED,

    createdAt: fixedDate,
  };
}

function createRuntime(policy: Policy) {
  const transactions = new InMemoryBusinessTransactionRepository();
  const trustRecords = new InMemoryExecutionTrustRecordRepository();
  const executionSystem = new RecordingExecutionSystem();

  const runtime = new RuntimeBuilder()
    .withPolicyRepository(new FixedPolicyRepository(policy))
    .addStage(new TrustChainValidationComponent())
    .addStage(
      new ExecutionComponent(
        new ExecutionService(transactions, trustRecords),
        new ExecutionRequestBuilder(),
        executionSystem,
        new ExecutionEvidenceBuilder(),
      ),
    )
    .build(trustRecords);

  return { runtime, transactions, trustRecords, executionSystem };
}

describe("Execution Authorization Wiring", () => {
  it("approved transaction produces a signed authorization", async () => {
    const { runtime, transactions, executionSystem } =
      createRuntime(APPROVE_POLICY);

    const transaction = createTransaction("txn-approved-1");
    await transactions.create(transaction);

    const { trustRecord } = await runtime.execute(transaction);

    expect(executionSystem.lastRequest).toBeDefined();

    const authorization = executionSystem.lastRequest!.authorization;

    expect(authorization.payload.businessTransactionId).toBe(
      transaction.businessTransactionId,
    );

    expect(authorization.payload.decisionId).toBe(
      trustRecord.executions[0]!.decision.decisionId,
    );

    const crypto = CryptoBootstrap.create();
    const verifier = new AuthorizationVerifier(crypto);
    const publicKey = await new FileKeyProvider().getPublicKey("default");

    const result = await verifier.verify(authorization, publicKey);

    expect(result.valid).toBe(true);
    expect(result.checks.signatureVerified).toBe(true);
    expect(result.checks.notExpired).toBe(true);
  });

  it("rejected transaction produces no authorization", async () => {
    const { runtime, transactions, trustRecords, executionSystem } =
      createRuntime(REJECT_POLICY);

    const transaction = createTransaction("txn-rejected-1");
    await transactions.create(transaction);

    let caught: unknown;

    try {
      await runtime.execute(transaction);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RuntimeError);
    expect((caught as RuntimeError).message).toContain(
      "rejected for test",
    );

    // A policy denial is a deliberate, correct rejection, not a server
    // error — distinguishable from a genuine 500 (and from a replayed
    // authorization, which is a distinct 409 NonceAlreadyConsumedError).
    expect((caught as RuntimeError).status).toBe(403);
    expect((caught as RuntimeError).code).toBe("POLICY_DENIED");

    expect(executionSystem.lastRequest).toBeUndefined();

    expect(
      await trustRecords.findByTransactionId(
        transaction.businessTransactionId,
      ),
    ).toBeNull();
  });

  it("authorization expiry honors configured TTL", async () => {
    const previous =
      process.env.EXECUTION_AUTHORIZATION_TTL_SECONDS;

    process.env.EXECUTION_AUTHORIZATION_TTL_SECONDS = "120";

    try {
      const { runtime, transactions, executionSystem } =
        createRuntime(APPROVE_POLICY);

      const transaction = createTransaction("txn-ttl-1");
      await transactions.create(transaction);

      await runtime.execute(transaction);

      const { payload } = executionSystem.lastRequest!.authorization;

      const deltaMs =
        Date.parse(payload.expiresAt) -
        Date.parse(payload.authorizedAt);

      expect(deltaMs).toBe(120_000);
    } finally {
      if (previous === undefined) {
        delete process.env.EXECUTION_AUTHORIZATION_TTL_SECONDS;
      } else {
        process.env.EXECUTION_AUTHORIZATION_TTL_SECONDS = previous;
      }
    }
  });

  it("trust record references the authorization", async () => {
    const { runtime, transactions, executionSystem } =
      createRuntime(APPROVE_POLICY);

    const transaction = createTransaction("txn-trust-ref-1");
    await transactions.create(transaction);

    const { trustRecord } = await runtime.execute(transaction);
    const authorization = executionSystem.lastRequest!.authorization;

    expect(trustRecord.executions[0]!.metadata?.authorizationId).toBe(
      authorization.payload.authorizationId,
    );

    //
    // Extra assertion (required): the authorizationId must be
    // part of the canonical content that gets hashed/signed,
    // not merely attached outside it. Prove this by showing
    // that tampering with it changes the recomputed hash.
    //
    const verificationCrypto = new VerificationCrypto();

    const recomputedHash = await verificationCrypto.hash(trustRecord);

    expect(trustRecord.trustRecordHash).toBe(recomputedHash);

    const tamperedRecord: ExecutionTrustRecord = {
      ...trustRecord,
      executions: [
        {
          ...trustRecord.executions[0]!,
          metadata: {
            ...trustRecord.executions[0]!.metadata,
            authorizationId: "tampered-authorization-id",
          },
        },
      ],
    };

    const tamperedHash = await verificationCrypto.hash(tamperedRecord);

    expect(tamperedHash).not.toBe(trustRecord.trustRecordHash);
  });

  it("authorization carries a signalsHash over the transaction's runtime signals, and the ExecutionRequest carries the signals themselves (G-31)", async () => {
    const { runtime, transactions, executionSystem } =
      createRuntime(APPROVE_POLICY);

    const transaction = createTransaction("txn-signals-hash-1");
    await transactions.create(transaction);

    await runtime.execute(transaction);

    const { authorization, signals } = executionSystem.lastRequest!;

    expect(signals).toEqual(transaction.signals);

    const signalsHasher = new TrustRecordHasher(CryptoBootstrap.create());
    const expectedHash = await signalsHasher.hash(transaction.signals);

    expect(authorization.payload.signalsHash).toBe(expectedHash);
  });
});

