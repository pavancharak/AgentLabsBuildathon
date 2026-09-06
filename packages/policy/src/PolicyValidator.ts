import type {
  Policy,
  PolicyCondition,
  PolicyOperator,
} from "./types/Policy.js";

import {
  PolicyValidationError,
} from "./errors/PolicyValidationError.js";

/**
 * Canonical Policy Validator.
 *
 * Validates the structural integrity of a Policy
 * before it is evaluated.
 */
export class PolicyValidator {

  /**
   * Supported operators.
   */
  private static readonly OPERATORS = new Set<PolicyOperator>([
    "eq",
    "neq",

    "gt",
    "gte",
    "lt",
    "lte",
    "between",

    "in",
    "not_in",

    "contains",
    "not_contains",

    "contains_all",
    "contains_any",

    "starts_with",
    "ends_with",
    "matches",

    "exists",
    "not_exists",

    "is_true",
    "is_false",

    "is_null",
    "is_not_null",

    "length_eq",
    "length_gt",
    "length_gte",
    "length_lt",
    "length_lte",

    "type_is",
  ]);

  /**
   * Validate a Policy.
   */
  public validate(
    policy: Policy,
  ): void {

    if (!policy) {
      throw new PolicyValidationError(
        "Policy is required.",
      );
    }

    //
    // Identity
    //

    if (!policy.policyId?.trim()) {
      throw new PolicyValidationError(
        "policyId is required.",
      );
    }

    if (!policy.policyVersion?.trim()) {
      throw new PolicyValidationError(
        "policyVersion is required.",
      );
    }

    if (!policy.schemaVersion?.trim()) {
      throw new PolicyValidationError(
        "schemaVersion is required.",
      );
    }

    //
    // Rules
    //

    if (!Array.isArray(policy.rules)) {
      throw new PolicyValidationError(
        "Policy rules must be an array.",
      );
    }

    if (policy.rules.length === 0) {
      throw new PolicyValidationError(
        "Policy must contain at least one rule.",
      );
    }

    //
    // boundSignals
    //

    if (policy.boundSignals !== undefined) {

      if (
        typeof policy.boundSignals !== "object" ||
        policy.boundSignals === null ||
        Array.isArray(policy.boundSignals)
      ) {
        throw new PolicyValidationError(
          "Policy boundSignals must be an object.",
        );
      }

      for (const [signalKey, intentPath] of Object.entries(policy.boundSignals)) {

        if (!signalKey.trim()) {
          throw new PolicyValidationError(
            "Policy boundSignals keys cannot be empty.",
          );
        }

        if (typeof intentPath !== "string" || !intentPath.trim()) {
          throw new PolicyValidationError(
            `Policy boundSignals['${signalKey}'] must be a non-empty string dot-path.`,
          );
        }
      }
    }

    const ruleIds = new Set<string>();

    for (const rule of policy.rules) {

      if (!rule.id?.trim()) {
        throw new PolicyValidationError(
          "Policy rule id is required.",
        );
      }

      if (ruleIds.has(rule.id)) {
        throw new PolicyValidationError(
          `Duplicate policy rule id '${rule.id}'.`,
        );
      }

      ruleIds.add(rule.id);

      this.validateCondition(
        rule.condition,
      );

      if (!rule.outcome) {
        throw new PolicyValidationError(
          `Policy rule '${rule.id}' is missing an outcome.`,
        );
      }

      if (!rule.outcome.action) {
        throw new PolicyValidationError(
          `Policy rule '${rule.id}' is missing an outcome action.`,
        );
      }

      if (!rule.outcome.reason?.trim()) {
        throw new PolicyValidationError(
          `Policy rule '${rule.id}' is missing an outcome reason.`,
        );
      }
    }
  }

  /**
   * Recursively validates a condition.
   */
  private validateCondition(
    condition: PolicyCondition,
  ): void {

    //
    // Leaf
    //

    if ("fact" in condition) {

      if (!condition.fact.trim()) {
        throw new PolicyValidationError(
          "Policy condition fact is required.",
        );
      }

      if (
        !PolicyValidator.OPERATORS.has(
          condition.operator,
        )
      ) {
        throw new PolicyValidationError(
          `Unsupported operator '${condition.operator}'.`,
        );
      }

      if (
        condition.operator === "matches"
      ) {

        if (
          typeof condition.value !== "string"
        ) {
          throw new PolicyValidationError(
            "'matches' requires a regex string.",
          );
        }

        this.validateRegex(
          condition.value,
        );
      }

      return;
    }

    //
    // Logical AND
    //

    if ("all" in condition) {

      if (
        !Array.isArray(condition.all) ||
        condition.all.length === 0
      ) {
        throw new PolicyValidationError(
          "'all' must contain at least one condition.",
        );
      }

      for (const child of condition.all) {
        this.validateCondition(
          child,
        );
      }

      return;
    }

    //
// Logical OR
//

if ("any" in condition) {

  if (
    !Array.isArray(condition.any) ||
    condition.any.length === 0
  ) {
    throw new PolicyValidationError(
      "'any' must contain at least one condition.",
    );
  }

  for (const child of condition.any) {
    this.validateCondition(
      child,
    );
  }

  return;
}

//
// Always
//

if ("always" in condition) {

  if (condition.always !== true) {
    throw new PolicyValidationError(
      "'always' must be true.",
    );
  }

  return;
}

throw new PolicyValidationError(
  "Invalid policy condition.",
);
  }

  /**
   * Validates a regular expression.
   */
  private validateRegex(
    pattern: string,
  ): void {

    try {
      new RegExp(pattern);
    }
    catch {
      throw new PolicyValidationError(
        `Invalid regular expression '${pattern}'.`,
      );
    }
  }

  /**
   * Returns every fact referenced by a rule condition that is not
   * declared in the policy's boundSignals. An empty array means every
   * rule-referenced fact either has a boundSignals entry, or the
   * policy declares no rules that reference facts at all.
   *
   * Not every fact belongs in boundSignals -- per boundSignals' own
   * doc comment, a fact with no genuine Intent-side equivalent (e.g.
   * vendorVerified, riskScore) is legitimately excluded. This is
   * therefore advisory, not an error: callers should warn, not
   * reject, so that a considered decision to leave a fact unbound
   * isn't blocked from deploying.
   */
  public findUncoveredFacts(
    policy: Policy,
  ): string[] {

    const boundKeys =
      new Set(
        Object.keys(
          policy.boundSignals ?? {},
        ),
      );

    const referenced =
      new Set<string>();

    const walk = (
      condition: PolicyCondition,
    ): void => {

      if ("fact" in condition) {
        referenced.add(condition.fact);
        return;
      }

      if ("all" in condition) {
        condition.all.forEach(walk);
        return;
      }

      if ("any" in condition) {
        condition.any.forEach(walk);
        return;
      }
    };

    for (const rule of policy.rules) {
      walk(rule.condition);
    }

    return Array.from(referenced).filter(
      (fact) => !boundKeys.has(fact),
    );
  }
}