import { describe, expect, it } from "vitest";

import { PolicyValidator } from "../../src/PolicyValidator.js";
import type { Policy } from "../../src/types/Policy.js";

/**
 * Gap #1 (boundSignals coverage): PolicyValidator validates boundSignals
 * shape and rule-condition shape independently, but never related them
 * -- a rule could approve on a fact with no boundSignals entry, silently
 * forfeiting SignalIntentBinder's protection for that fact. This is the
 * additive, warn-only cross-check.
 */
describe("PolicyValidator.findUncoveredFacts", () => {
  const validator = new PolicyValidator();

  const basePolicy: Policy = {
    policyId: "test-policy",
    policyVersion: "1.0.0",
    schemaVersion: "1.0.0",
    rules: [
      {
        id: "approve",
        condition: { always: true },
        outcome: { action: "approve" as never, reason: "always approves" },
      },
    ],
  };

  it("returns no uncovered facts when every rule fact is bound", () => {
    const policy: Policy = {
      ...basePolicy,
      boundSignals: { amount: "parameters.amount" },
      rules: [
        {
          id: "reject-large",
          condition: { fact: "amount", operator: "gt", value: 500 },
          outcome: { action: "reject" as never, reason: "too large" },
        },
      ],
    };

    expect(validator.findUncoveredFacts(policy)).toEqual([]);
  });

  it("returns no uncovered facts when a policy uses no rule facts at all", () => {
    expect(validator.findUncoveredFacts(basePolicy)).toEqual([]);
  });

  it("reports a fact used in a rule but absent from boundSignals", () => {
    const policy: Policy = {
      ...basePolicy,
      boundSignals: undefined,
      rules: [
        {
          id: "reject-large",
          condition: { fact: "amount", operator: "gt", value: 500 },
          outcome: { action: "reject" as never, reason: "too large" },
        },
      ],
    };

    expect(validator.findUncoveredFacts(policy)).toEqual(["amount"]);
  });

  it("reports each uncovered fact across nested all/any conditions, leaving bound facts out", () => {
    const policy: Policy = {
      ...basePolicy,
      boundSignals: { amount: "parameters.amount" },
      rules: [
        {
          id: "reject-risky",
          condition: {
            all: [
              { fact: "amount", operator: "gt", value: 500 },
              {
                any: [
                  { fact: "vendorVerified", operator: "is_false", value: true },
                  { fact: "riskScore", operator: "gt", value: 80 },
                ],
              },
            ],
          },
          outcome: { action: "reject" as never, reason: "risky" },
        },
      ],
    };

    expect(validator.findUncoveredFacts(policy).sort()).toEqual(
      ["riskScore", "vendorVerified"].sort(),
    );
  });
});
