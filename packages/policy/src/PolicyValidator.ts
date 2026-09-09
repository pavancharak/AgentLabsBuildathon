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

    //
    // unboundSignalReasons
    //

    if (policy.unboundSignalReasons !== undefined) {

      if (
        typeof policy.unboundSignalReasons !== "object" ||
        policy.unboundSignalReasons === null ||
        Array.isArray(policy.unboundSignalReasons)
      ) {
        throw new PolicyValidationError(
          "Policy unboundSignalReasons must be an object.",
        );
      }

      for (const [fact, reasonText] of Object.entries(policy.unboundSignalReasons)) {

        if (!fact.trim()) {
          throw new PolicyValidationError(
            "Policy unboundSignalReasons keys cannot be empty.",
          );
        }

        if (typeof reasonText !== "string" || !reasonText.trim()) {
          throw new PolicyValidationError(
            `Policy unboundSignalReasons['${fact}'] must be a non-empty reason string.`,
          );
        }

        if (
          policy.boundSignals !== undefined &&
          Object.prototype.hasOwnProperty.call(policy.boundSignals, fact)
        ) {
          throw new PolicyValidationError(
            `Policy unboundSignalReasons['${fact}'] is contradictory: '${fact}' ` +
            "already has a boundSignals entry -- a bound fact needs no " +
            "reason for being unbound.",
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

    //
    // Fail-closed boundSignals coverage: every rule-referenced fact
    // must be either bound (boundSignals) or explicitly acknowledged
    // (unboundSignalReasons) -- see findUncoveredFacts' own doc
    // comment. Run last, once rules are known to be structurally
    // valid, so the facts it walks come from conditions already
    // confirmed well-formed above.
    //

    const stillUncoveredFacts =
      this.findUncoveredFacts(
        policy,
      );

    if (stillUncoveredFacts.length > 0) {
      throw new PolicyValidationError(
        `Policy references fact(s) ${stillUncoveredFacts.map((f) => `'${f}'`).join(", ")} ` +
        "with no boundSignals entry and no unboundSignalReasons entry. Add " +
        "one of:\n" +
        "  1. A boundSignals entry, if the fact has a genuine Intent-side " +
        "equivalent (e.g. an amount or target identifier).\n" +
        "  2. An unboundSignalReasons entry with a documented reason, if " +
        "leaving it unbound is a deliberate decision.",
      );
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
   * Maximum length accepted for a 'matches' pattern. Not a
   * correctness bound -- purely a cap on how much text an attacker
   * (or a careless policy author) can put in front of the regex
   * engine at all.
   */
  private static readonly MAX_PATTERN_LENGTH = 200;

  /**
   * One parenthesized group, immediately followed by a quantifier,
   * captured so its own contents can be inspected for a quantifier of
   * their own. Deliberately does not match nested parentheses inside
   * the group ([^()]*) -- this catches the textbook single-level
   * cases ('(a+)+', '(a*)*', '(a+){2,}'), not every possible
   * catastrophic pattern. See validateRegex's own doc comment.
   */
  private static readonly GROUP_THEN_QUANTIFIER =
    /\(([^()]*)\)(?:[*+]|\{\d+,?\d*\})/g;

  private static readonly CONTAINS_QUANTIFIER = /[*+]|\{\d+,?\d*\}/;

  /**
   * Validates a regular expression before it is accepted into a
   * Policy that will later be evaluated (via the 'matches' operator)
   * against live, potentially attacker-influenced signal values.
   *
   * This is a heuristic, not a proof of linear-time behavior: it
   * rejects a quantified group whose own contents are themselves
   * quantified (e.g. '(a+)+', a classic source of catastrophic
   * backtracking), and caps pattern length outright, but it cannot
   * detect every pattern capable of exponential-time backtracking --
   * only a linear-time engine (e.g. RE2) or an execution timeout at
   * evaluation time closes that gap completely. Flagged here as a
   * deliberate, bounded improvement over no check at all, not as a
   * ReDoS-proof guarantee.
   */
  private validateRegex(
    pattern: string,
  ): void {

    if (pattern.length > PolicyValidator.MAX_PATTERN_LENGTH) {
      throw new PolicyValidationError(
        `'matches' pattern exceeds the maximum length of ` +
        `${PolicyValidator.MAX_PATTERN_LENGTH} characters.`,
      );
    }

    for (const match of pattern.matchAll(PolicyValidator.GROUP_THEN_QUANTIFIER)) {
      if (PolicyValidator.CONTAINS_QUANTIFIER.test(match[1] ?? "")) {
        throw new PolicyValidationError(
          `'matches' pattern '${pattern}' contains a nested quantifier ` +
          "(a quantified group whose own contents are themselves " +
          "quantified, e.g. '(a+)+') -- a common source of catastrophic " +
          "backtracking (ReDoS) once evaluated against live signal values. " +
          "Rewrite the pattern to avoid quantifying a group that already " +
          "contains a quantifier.",
        );
      }
    }

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
   * Returns every fact referenced by a rule condition that is neither
   * declared in the policy's boundSignals nor acknowledged in its
   * unboundSignalReasons. An empty array means every rule-referenced
   * fact is either bound or has a documented reason for being unbound.
   *
   * Not every fact belongs in boundSignals -- per boundSignals' own
   * doc comment, a fact with no genuine Intent-side equivalent (e.g.
   * vendorVerified, riskScore) is legitimately excluded, provided it
   * is acknowledged in unboundSignalReasons instead. validate() treats
   * a non-empty result from this method as a fail-closed rejection,
   * not merely a warning -- an uncovered, unacknowledged fact must
   * never simply go unmentioned.
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

    const acknowledgedKeys =
      new Set(
        Object.keys(
          policy.unboundSignalReasons ?? {},
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
      (fact) => !boundKeys.has(fact) && !acknowledgedKeys.has(fact),
    );
  }
}