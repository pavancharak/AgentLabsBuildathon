import { describe, expect, it } from "vitest";

import { PolicyValidator } from "../../src/PolicyValidator.js";
import type { Policy } from "../../src/types/Policy.js";

/**
 * Gap #1 (boundSignals coverage): PolicyValidator validates boundSignals
 * shape and rule-condition shape independently, but never related them
 * -- a rule could approve on a fact with no boundSignals entry, silently
 * forfeiting SignalIntentBinder's protection for that fact. This started
 * as an additive, warn-only cross-check; G-32 [policy-authoring audit,
 * 2026-09-09] made it fail-closed via validate() (see the second describe
 * block below) once unboundSignalReasons gave policy authors a way to
 * explicitly acknowledge a genuinely unbindable fact instead of silently
 * leaving it unmentioned.
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

  it("excludes a fact acknowledged in unboundSignalReasons", () => {
    const policy: Policy = {
      ...basePolicy,
      rules: [
        {
          id: "reject-unverified",
          condition: { fact: "vendorVerified", operator: "is_false", value: true },
          outcome: { action: "reject" as never, reason: "unverified" },
        },
      ],
      unboundSignalReasons: {
        vendorVerified: "No genuine Intent-side equivalent.",
      },
    };

    expect(validator.findUncoveredFacts(policy)).toEqual([]);
  });
});

describe("PolicyValidator.validate -- unboundSignalReasons", () => {
  const validator = new PolicyValidator();

  const basePolicy: Policy = {
    policyId: "test-policy",
    policyVersion: "1.0.0",
    schemaVersion: "1.0.0",
    rules: [
      {
        id: "reject-unverified",
        condition: { fact: "vendorVerified", operator: "is_false", value: true },
        outcome: { action: "reject" as never, reason: "unverified" },
      },
    ],
  };

  it("passes when the only uncovered fact is acknowledged with a reason", () => {
    expect(() =>
      validator.validate({
        ...basePolicy,
        unboundSignalReasons: {
          vendorVerified: "No genuine Intent-side equivalent.",
        },
      }),
    ).not.toThrow();
  });

  it("fails closed -- throws naming the fact -- when a rule-referenced fact is neither bound nor acknowledged", () => {
    expect(() => validator.validate(basePolicy)).toThrow(
      /'vendorVerified'/,
    );
  });

  it("passes when the only uncovered fact is instead bound via boundSignals", () => {
    expect(() =>
      validator.validate({
        ...basePolicy,
        rules: [
          {
            id: "reject-large",
            condition: { fact: "amount", operator: "gt", value: 500 },
            outcome: { action: "reject" as never, reason: "too large" },
          },
        ],
        boundSignals: { amount: "parameters.amount" },
      }),
    ).not.toThrow();
  });

  it("rejects a non-object unboundSignalReasons", () => {
    expect(() =>
      validator.validate({
        ...basePolicy,
        unboundSignalReasons: "vendorVerified" as never,
      }),
    ).toThrow(/unboundSignalReasons must be an object/);
  });

  it("rejects an empty reason string", () => {
    expect(() =>
      validator.validate({
        ...basePolicy,
        unboundSignalReasons: { vendorVerified: "   " },
      }),
    ).toThrow(/must be a non-empty reason string/);
  });

  it("rejects a fact acknowledged in unboundSignalReasons that is also bound in boundSignals, as contradictory", () => {
    expect(() =>
      validator.validate({
        ...basePolicy,
        rules: [
          {
            id: "reject-large",
            condition: { fact: "amount", operator: "gt", value: 500 },
            outcome: { action: "reject" as never, reason: "too large" },
          },
        ],
        boundSignals: { amount: "parameters.amount" },
        unboundSignalReasons: { amount: "contradiction" },
      }),
    ).toThrow(/contradictory/);
  });
});
