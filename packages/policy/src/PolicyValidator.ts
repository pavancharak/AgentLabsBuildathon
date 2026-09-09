import type {
  Policy,
  PolicyCondition,
  PolicyOperator,
} from "./types/Policy.js";

import {
  PolicyValidationError,
} from "./errors/PolicyValidationError.js";

/**
 * One pair of rules whose conditions can be simultaneously true (or, for
 * "always", one rule that is not the final one). Advisory only -- see
 * PolicyValidator.findRuleConflicts' own doc comment for why this is
 * never wired into validate()'s fail-closed throw.
 */
export interface RuleConflictWarning {
  readonly level: "WARNING" | "INFO";
  readonly ruleId: string;
  readonly conflictingRuleId: string;
  readonly message: string;
}

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

  /**
   * Returns every pair of rules whose conditions can be true at the same
   * time -- first-match-wins means the earlier rule in `policy.rules`
   * always decides the outcome for any input that satisfies both, so an
   * unintended overlap silently shadows the later rule rather than
   * failing loudly.
   *
   * Deliberately advisory, like findUncoveredFacts() used to be before
   * G-33 made *that* fail-closed: unlike a missing boundSignals entry
   * (which has an unambiguous fix -- bind it or acknowledge it), a
   * flagged overlap is a heuristic judgment about two conditions that
   * might be a real bug or might be exactly the intended shape (a
   * specific rule followed by a narrower or broader one). Throwing on
   * it from validate() would make every policy load conditional on this
   * heuristic being bug-free for every condition shape it's ever asked
   * to compare -- a correctness bar this method does not claim to meet
   * (see the operator-overlap and nested-condition notes below). Callers
   * decide what to do with the result, the same as findUncoveredFacts.
   *
   * What this does NOT do: it is not a general rule-subsumption or
   * boolean-satisfiability solver. It only reasons about pairs of rules
   * where both conditions are single, non-nested facts (or one/both are
   * `always`) -- anything involving `all`/`any` is reported as
   * NEEDS_REVIEW (level "INFO"), not analyzed further.
   */
  public findRuleConflicts(
    policy: Policy,
  ): RuleConflictWarning[] {

    const warnings: RuleConflictWarning[] = [];
    const rules = policy.rules;

    for (let i = 0; i < rules.length; i++) {
      const ruleA = rules[i]!;

      //
      // An `always: true` rule that is not the LAST rule makes every
      // rule after it unreachable -- this is the one case worth a hard
      // WARNING regardless of what follows, since it's never the
      // intended shape (the idiomatic fail-closed catch-all is always
      // written last). An `always` rule that IS last is the expected,
      // harmless catch-all and is not compared against anything.
      //
      if (this.isAlways(ruleA.condition) && i !== rules.length - 1) {
        const shadowed = rules[i + 1]!;
        warnings.push({
          level: "WARNING",
          ruleId: ruleA.id,
          conflictingRuleId: shadowed.id,
          message:
            `Rule '${ruleA.id}' has an 'always: true' condition but is not ` +
            "the last rule -- every rule after it, starting with " +
            `'${shadowed.id}', can never be reached.`,
        });
        continue;
      }

      if (this.isAlways(ruleA.condition)) {
        continue;
      }

      for (let j = i + 1; j < rules.length; j++) {
        const ruleB = rules[j]!;

        if (this.isAlways(ruleB.condition)) {
          continue;
        }

        const overlap = this.conditionsOverlap(ruleA.condition, ruleB.condition);

        if (overlap === "DEFINITE_OVERLAP") {
          warnings.push({
            level: "WARNING",
            ruleId: ruleA.id,
            conflictingRuleId: ruleB.id,
            message:
              `Rule '${ruleA.id}' and rule '${ruleB.id}' have overlapping ` +
              `conditions on the same fact. First-match-wins means '${ruleA.id}' ` +
              `takes precedence for any input that satisfies both; if that is ` +
              "not intended, reorder or refine the conditions.",
          });
        } else if (overlap === "NEEDS_REVIEW") {
          warnings.push({
            level: "INFO",
            ruleId: ruleA.id,
            conflictingRuleId: ruleB.id,
            message:
              `Rule '${ruleA.id}' and rule '${ruleB.id}' both reference ` +
              "conditions this checker does not fully analyze (a nested " +
              "'all'/'any', or an operator pairing it does not model) -- " +
              "manual review recommended to confirm no unintended overlap.",
          });
        }
      }
    }

    return warnings;
  }

  private isAlways(
    condition: PolicyCondition,
  ): boolean {
    return "always" in condition;
  }

  /**
   * Compares two conditions for possible simultaneous truth. Only
   * simple, single-fact leaf conditions are analyzed to completion;
   * anything nested (`all`/`any`) is NEEDS_REVIEW rather than guessed
   * at, and a leaf-vs-leaf pair is NEEDS_REVIEW rather than a false
   * DEFINITE_OVERLAP/NO_OVERLAP whenever the operator combination isn't
   * one this method models precisely (see operatorOverlap).
   */
  private conditionsOverlap(
    condA: PolicyCondition,
    condB: PolicyCondition,
  ): "NO_OVERLAP" | "DEFINITE_OVERLAP" | "NEEDS_REVIEW" {

    if ("fact" in condA && "fact" in condB) {
      if (condA.fact !== condB.fact) {
        return "NO_OVERLAP";
      }
      return this.operatorOverlap(
        condA.operator,
        condA.value,
        condB.operator,
        condB.value,
      );
    }

    //
    // One side is a leaf, the other is `all` (a conjunction): the
    // overall "all" can be PROVEN not to overlap with the leaf if any
    // single conjunct inside it is itself provably disjoint from the
    // leaf -- one false conjunct makes the whole conjunction false,
    // regardless of the rest. This is what resolves the extremely
    // common real shape (an `approve` rule requiring `riskScore <= 20`
    // among several ANDed conditions, alongside a `reject-high-risk`
    // rule requiring `riskScore > 20`) to NO_OVERLAP instead of a
    // NEEDS_REVIEW notice on every single approve/reject pair in every
    // real policy in this repo. It never claims DEFINITE_OVERLAP for a
    // conjunction this way -- proving a conjunction true requires every
    // conjunct to hold, a much stronger claim this method does not
    // attempt -- only NO_OVERLAP (proven) or NEEDS_REVIEW (not proven
    // either way).
    //
    if ("fact" in condA && "all" in condB) {
      return this.leafVersusAllOverlap(condA, condB.all);
    }
    if ("fact" in condB && "all" in condA) {
      return this.leafVersusAllOverlap(condB, condA.all);
    }

    //
    // Both sides are `all` conjunctions: the same one-false-conjunct
    // argument generalizes -- if ANY conjunct of A is provably disjoint
    // from ANY conjunct of B (on the same fact), then at every possible
    // input at least one of those two conjuncts is false, so at least
    // one of the two whole conjunctions is false, so A and B can never
    // both hold. Only checks conjunct-vs-conjunct at this one level
    // (does not recurse into a conjunct that is itself nested); no
    // match found among the pairs means NEEDS_REVIEW, not a guess.
    //
    if ("all" in condA && "all" in condB) {
      for (const conjunctA of condA.all) {
        if (!("fact" in conjunctA)) {
          continue;
        }
        for (const conjunctB of condB.all) {
          if (!("fact" in conjunctB) || conjunctA.fact !== conjunctB.fact) {
            continue;
          }
          if (
            this.operatorOverlap(
              conjunctA.operator,
              conjunctA.value,
              conjunctB.operator,
              conjunctB.value,
            ) === "NO_OVERLAP"
          ) {
            return "NO_OVERLAP";
          }
        }
      }
      return "NEEDS_REVIEW";
    }

    return "NEEDS_REVIEW";
  }

  private leafVersusAllOverlap(
    leaf: Extract<PolicyCondition, { fact: string }>,
    conjuncts: readonly PolicyCondition[],
  ): "NO_OVERLAP" | "NEEDS_REVIEW" {

    for (const conjunct of conjuncts) {
      if (!("fact" in conjunct) || conjunct.fact !== leaf.fact) {
        continue;
      }

      const overlap = this.operatorOverlap(
        conjunct.operator,
        conjunct.value,
        leaf.operator,
        leaf.value,
      );

      if (overlap === "NO_OVERLAP") {
        return "NO_OVERLAP";
      }
    }

    return "NEEDS_REVIEW";
  }

  /**
   * Correctly overlap-checks the operator pairings real policies in
   * this repo actually use on a shared fact (eq/neq and the four
   * numeric comparisons, including asymmetric thresholds like
   * `lte 10` vs `gt 20`, which do NOT overlap). `is_true`/`is_false`
   * are normalized to `eq true`/`eq false` first. Any operator this
   * method doesn't model (between, in, not_in, contains*, matches,
   * exists, is_null, length_*, type_is, or a numeric operator paired
   * with a non-numeric value) returns NEEDS_REVIEW, never a guessed
   * DEFINITE_OVERLAP or NO_OVERLAP.
   */
  private operatorOverlap(
    opA: PolicyOperator,
    valA: unknown,
    opB: PolicyOperator,
    valB: unknown,
  ): "NO_OVERLAP" | "DEFINITE_OVERLAP" | "NEEDS_REVIEW" {

    const [normOpA, normValA] = this.normalizeBooleanOperator(opA, valA);
    const [normOpB, normValB] = this.normalizeBooleanOperator(opB, valB);

    const POINT_OPS = new Set(["eq", "neq"]);
    const RANGE_OPS = new Set(["gt", "gte", "lt", "lte"]);

    if (POINT_OPS.has(normOpA) && POINT_OPS.has(normOpB)) {
      if (normOpA === "eq" && normOpB === "eq") {
        return normValA === normValB ? "DEFINITE_OVERLAP" : "NO_OVERLAP";
      }
      if (normOpA === "neq" && normOpB === "neq") {
        // Two different-valued exclusions almost always still share a
        // third value; only genuinely provable as NO_OVERLAP for a
        // two-value domain (e.g. booleans), which this method does not
        // attempt to detect -- conservative DEFINITE_OVERLAP is correct
        // far more often than not for an arbitrary fact.
        return "DEFINITE_OVERLAP";
      }
      // One eq, one neq, same fact.
      const eqValue = normOpA === "eq" ? normValA : normValB;
      const neqValue = normOpA === "neq" ? normValA : normValB;
      return eqValue === neqValue ? "NO_OVERLAP" : "DEFINITE_OVERLAP";
    }

    if (RANGE_OPS.has(normOpA) && RANGE_OPS.has(normOpB)) {
      const rayA = this.toRay(normOpA, normValA);
      const rayB = this.toRay(normOpB, normValB);
      if (rayA === undefined || rayB === undefined) {
        return "NEEDS_REVIEW";
      }
      return this.raysOverlap(rayA, rayB) ? "DEFINITE_OVERLAP" : "NO_OVERLAP";
    }

    if (
      (normOpA === "eq" && RANGE_OPS.has(normOpB)) ||
      (normOpB === "eq" && RANGE_OPS.has(normOpA))
    ) {
      const eqValue = normOpA === "eq" ? normValA : normValB;
      const rangeOp = normOpA === "eq" ? normOpB : normOpA;
      const rangeValue = normOpA === "eq" ? normValB : normValA;

      if (typeof eqValue !== "number" || typeof rangeValue !== "number") {
        return "NEEDS_REVIEW";
      }

      const satisfies =
        (rangeOp === "gt" && eqValue > rangeValue) ||
        (rangeOp === "gte" && eqValue >= rangeValue) ||
        (rangeOp === "lt" && eqValue < rangeValue) ||
        (rangeOp === "lte" && eqValue <= rangeValue);

      return satisfies ? "DEFINITE_OVERLAP" : "NO_OVERLAP";
    }

    return "NEEDS_REVIEW";
  }

  /**
   * is_true/is_false carry no explicit value in a policy condition --
   * modeled here as eq true/eq false purely for overlap comparison,
   * matching OperatorEvaluator's own semantics for those operators.
   */
  private normalizeBooleanOperator(
    operator: PolicyOperator,
    value: unknown,
  ): [string, unknown] {
    if (operator === "is_true") {
      return ["eq", true];
    }
    if (operator === "is_false") {
      return ["eq", false];
    }
    return [operator, value];
  }

  private toRay(
    operator: string,
    value: unknown,
  ): { readonly direction: "upper" | "lower"; readonly bound: number; readonly inclusive: boolean } | undefined {
    if (typeof value !== "number") {
      return undefined;
    }
    switch (operator) {
      case "lt":
        return { direction: "upper", bound: value, inclusive: false };
      case "lte":
        return { direction: "upper", bound: value, inclusive: true };
      case "gt":
        return { direction: "lower", bound: value, inclusive: false };
      case "gte":
        return { direction: "lower", bound: value, inclusive: true };
      default:
        return undefined;
    }
  }

  /**
   * Two rays pointing the same direction always share values (e.g.
   * `x < 10` and `x < 20` are both true for x=5). Opposite-direction
   * rays overlap only in the region between their bounds, inclusive
   * only where both bounds are themselves inclusive at an equal value
   * -- this is what makes `lte 20` + `gt 20` correctly NO_OVERLAP while
   * `lte 20` + `gte 20` is correctly DEFINITE_OVERLAP (both include 20),
   * and what makes `lte 10` + `gt 20` correctly NO_OVERLAP even though
   * neither bound is exactly equal to the other -- a case the naive
   * "check exact equal thresholds only" heuristic gets wrong.
   */
  private raysOverlap(
    a: { readonly direction: "upper" | "lower"; readonly bound: number; readonly inclusive: boolean },
    b: { readonly direction: "upper" | "lower"; readonly bound: number; readonly inclusive: boolean },
  ): boolean {
    if (a.direction === b.direction) {
      return true;
    }
    const upper = a.direction === "upper" ? a : b;
    const lower = a.direction === "lower" ? a : b;

    if (upper.bound > lower.bound) {
      return true;
    }
    if (upper.bound < lower.bound) {
      return false;
    }
    return upper.inclusive && lower.inclusive;
  }
}