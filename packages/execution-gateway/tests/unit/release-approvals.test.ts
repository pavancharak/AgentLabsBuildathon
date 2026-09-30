import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  AuthorizationSigner,
  CryptoBootstrap,
  TrustRecordHasher,
} from "@parmana/crypto";
import { MemoryNonceStore } from "@parmana/envelope-verifier";
import type {
  ExecutionControl,
  ExecutionRelease,
} from "@parmana/execution-control";
import type { ExecutionRequest } from "@parmana/execution-system";
import type {
  PolicySignals,
  SignalStateVerificationRequest,
  SignalStateVerifier,
  SignalStateViolation,
} from "@parmana/policy";
import type {
  ExecutableContent,
  ExecutionResult,
  SignedExecutionAuthorization,
} from "@parmana/shared";

import { ExecutionGateway } from "../../src/index.js";

/**
 * The approvals the Gateway hands to Execution Control with a release
 * (ADR-0013): read from the request's signals, and only once those
 * signals were checked against the authorization's signed signalsHash.
 */

const crypto = CryptoBootstrap.create();
const signalsHasher = new TrustRecordHasher(crypto);

const CONTENT: ExecutableContent = {
  businessTransactionId: "txn-approvals",
  action: "erp:create-invoice",
  target: "customer-42",
  parameters: { amount: 1200 },
};

const SIGNALS: PolicySignals = {
  managerApproval: {
    payload: {
      version: 1,
      approvalId: "ap-1",
      issuer: { approverId: "manager-x", keyId: "manager-x-key-1" },
      capability: "erp:create-invoice",
    },
    signature: { algorithm: "ed25519", value: "sig" },
  },
  riskScore: 10,
  note: { payload: { approvalId: "not-an-approval" } },
} as unknown as PolicySignals;

class FixedSignalStateVerifier implements SignalStateVerifier {
  constructor(private readonly violations: readonly SignalStateViolation[]) {}

  async findViolations(
    _request: SignalStateVerificationRequest,
    _signals: PolicySignals,
  ): Promise<readonly SignalStateViolation[]> {
    return this.violations;
  }
}

class RecordingExecutionControl implements ExecutionControl {
  releases: ExecutionRelease[] = [];

  async execute(release: ExecutionRelease): Promise<ExecutionResult> {
    this.releases.push(release);

    return {
      ...CONTENT,
      success: true,
      executedAt: new Date(),
      metadata: {},
    };
  }
}

async function run(options: {
  signalsHash: "match" | "none";
  signals?: PolicySignals;
  verifier?: SignalStateVerifier;
}): Promise<ExecutionRelease> {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const control = new RecordingExecutionControl();
  const authorization: SignedExecutionAuthorization =
    await new AuthorizationSigner(crypto).sign(
      {
        decisionId: "decision-1",
        businessTransactionId: CONTENT.businessTransactionId,
        policyName: "erp-invoice",
        policyVersion: "1.0.0",
        ...(options.signalsHash === "match"
          ? { signalsHash: await signalsHasher.hash(SIGNALS) }
          : {}),
        executableContent: CONTENT,
      },
      privateKey,
      "key-1",
      60,
    );

  const gateway = new ExecutionGateway({
    // Legacy fixture: predates fail-closed policy binding.
    allowUnverifiedPolicy: true,
    publicKey,
    nonceStore: new MemoryNonceStore(),
    ...(options.verifier !== undefined
      ? { signalStateVerifier: options.verifier }
      : {}),
    executionControl: {
      service: control,
      gatewayAuthentication: "test",
      route: () => "ext-erp:create-invoice",
    },
  });

  const request: ExecutionRequest = {
    ...CONTENT,
    ...(options.signals !== undefined ? { signals: options.signals } : {}),
    authorization,
  };

  await gateway.execute(request);

  expect(control.releases).toHaveLength(1);
  return control.releases[0]!;
}

describe("ExecutionGateway release approvals", () => {
  it("lists every signed approval among the signals once they match the signed signalsHash", async () => {
    const release = await run({
      signalsHash: "match",
      signals: SIGNALS,
      verifier: new FixedSignalStateVerifier([]),
    });

    expect(release.approvals).toEqual([
      { approverId: "manager-x", keyId: "manager-x-key-1", approvalId: "ap-1" },
    ]);
  });

  it("lists none when the signals were not checked: no signalsHash in the authorization", async () => {
    const release = await run({
      signalsHash: "none",
      signals: SIGNALS,
      verifier: new FixedSignalStateVerifier([]),
    });

    expect(release.approvals).toEqual([]);
  });

  it("lists none when no signal verifier is configured, so nothing checked the signals", async () => {
    const release = await run({ signalsHash: "match", signals: SIGNALS });

    expect(release.approvals).toEqual([]);
  });
});
