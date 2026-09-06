import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PolicyRouter } from "../../src/PolicyRouter.js";
import type { PolicyRepository } from "../../src/PolicyRepository.js";
import type { Policy } from "../../src/types/Policy.js";

/**
 * Gap #2 (part of the same coverage gap as PolicyValidator.test.ts):
 * PolicyRouter.load() is the actual policy-load entry point RuntimeEngine
 * calls, so the boundSignals-coverage warning must be observable from
 * here, not just from PolicyValidator directly.
 */
class FakePolicyRepository implements PolicyRepository {
  constructor(private readonly policy: Policy) {}

  async load(): Promise<Policy> {
    return this.policy;
  }

  async save(): Promise<void> {
    throw new Error("not implemented");
  }
}

describe("PolicyRouter boundSignals coverage warning", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("does not warn when every rule fact is bound", async () => {
    const router = new PolicyRouter(
      new FakePolicyRepository({
        policyId: "vendor-payment",
        policyVersion: "2.0.0",
        schemaVersion: "1.0.0",
        boundSignals: { amount: "parameters.amount" },
        rules: [
          {
            id: "reject-large",
            condition: { fact: "amount", operator: "gt", value: 500 },
            outcome: { action: "reject" as never, reason: "too large" },
          },
        ],
      }),
    );

    await router.load("vendor-payment", "2.0.0");

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns with the policy id/version and the uncovered facts when coverage is incomplete", async () => {
    const router = new PolicyRouter(
      new FakePolicyRepository({
        policyId: "vendor-payment",
        policyVersion: "2.0.0",
        schemaVersion: "1.0.0",
        rules: [
          {
            id: "reject-large",
            condition: { fact: "amount", operator: "gt", value: 500 },
            outcome: { action: "reject" as never, reason: "too large" },
          },
        ],
      }),
    );

    await router.load("vendor-payment", "2.0.0");

    expect(warnSpy).toHaveBeenCalledTimes(1);

    const [payload] = warnSpy.mock.calls[0];

    expect(payload).toMatchObject({
      event: "policy_boundSignals_coverage_incomplete",
      policyId: "vendor-payment",
      policyVersion: "2.0.0",
      uncoveredFacts: ["amount"],
    });
  });
});
