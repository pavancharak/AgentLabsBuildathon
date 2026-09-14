import type { JsonValue } from "@parmana/shared";

import type { PolicySignals } from "./PolicySignals.js";

import { PolicyAction } from "./PolicyAction.js";

/**
 * Canonical input to the Policy Engine.
 */
export type PolicyInput = PolicySignals;

/**
 * Canonical rule outcome.
 */
export interface PolicyRuleOutcome {
  /**
   * Action produced by the matching rule.
   */
  action: PolicyAction;

  /**
   * Human-readable explanation.
   */
  reason: string;
}

/**
 * Canonical deterministic policy operators.
 *
 * Every operator SHALL:
 * - be deterministic
 * - be side-effect free
 * - operate only on supplied runtime signals
 *
 * Operators SHALL NOT:
 * - access external systems
 * - call LLMs
 * - access databases
 * - perform network requests
 * - use clocks
 * - generate randomness
 */
export type PolicyOperator =
  //
  // Equality
  //
  | "eq"
  | "neq"

  //
  // Numeric
  //
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"

  //
  // Collection
  //
  | "in"
  | "not_in"
  | "contains"
  | "not_contains"
  | "contains_all"
  | "contains_any"

  //
  // String
  //
  | "starts_with"
  | "ends_with"
  | "matches"

  //
  // Existence
  //
  | "exists"
  | "not_exists"

  //
  // Boolean
  //
  | "is_true"
  | "is_false"

  //
  // Null
  //
  | "is_null"
  | "is_not_null"

  //
  // Length
  //
  | "length_eq"
  | "length_gt"
  | "length_gte"
  | "length_lt"
  | "length_lte"

  //
  // Type
  //
  | "type_is";

/**
 * Leaf condition.
 *
 * Example:
 *
 * {
 *   "fact": "amount",
 *   "operator": "lte",
 *   "value": 1000
 * }
 */
export interface PolicyLeafCondition {
  /**
   * Runtime signal name.
   */
  fact: string;

  /**
   * Comparison operator.
   */
  operator: PolicyOperator;

  /**
   * Expected value.
   */
  value?: JsonValue;
}

/**
 * Logical AND.
 *
 * Every child condition must evaluate to true.
 */
export interface PolicyAllCondition {
  all: PolicyCondition[];
}

/**
 * Logical OR.
 *
 * At least one child condition must evaluate to true.
 */
export interface PolicyAnyCondition {
  any: PolicyCondition[];
}

/**
 * Unconditional condition.
 *
 * Always evaluates to true.
 * Typically used as the final fallback rule.
 */
export interface PolicyAlwaysCondition {
  always: true;
}

/**
 * Canonical policy condition.
 *
 * Conditions are recursively composable.
 */
export type PolicyCondition =
  | PolicyLeafCondition
  | PolicyAllCondition
  | PolicyAnyCondition
  | PolicyAlwaysCondition;

/**
 * Single policy rule.
 */
export interface PolicyRule {
  /**
   * Unique rule identifier.
   */
  id: string;

  /**
   * Rule condition.
   */
  condition: PolicyCondition;

  /**
   * Rule outcome.
   */
  outcome: PolicyRuleOutcome;
}

/**
 * Canonical Policy Document.
 */
export interface Policy {
  /**
   * Unique policy identifier.
   */
  policyId: string;

  /**
   * Business policy version.
   */
  policyVersion: string;

  /**
   * Policy language schema version.
   */
  schemaVersion: string;

  /**
   * Human-readable description.
   */
  description?: string;

  /**
   * Declares the runtime signals expected by the policy.
   *
   * Example:
   *
   * {
   *   "amount": "number",
   *   "currency": "string",
   *   "vendorVerified": "boolean"
   * }
   */
  signalsSchema?: Record<string, string>;

  /**
   * Declares signals that MUST equal a specific field of the
   * Business Transaction's Intent (the same intent whose
   * action/target/parameters become the ExecutableContent that
   * actually executes).
   *
   * Signals are caller-declared and are what PolicyEngine.evaluate
   * decides approval on; Intent is what ExecutionGateway actually
   * signs and executes. Nothing else in the system requires these
   * two to describe the same real-world action — a caller could
   * otherwise declare a small, fully-verified signals payload while
   * Intent silently targets something else entirely, and receive a
   * signed APPROVED trust record for it. boundSignals closes that
   * gap for exactly the signals a policy author designates: before
   * PolicyEngine.evaluate ever runs, every entry here must match the
   * value at the given dot-path into { target, parameters } read
   * from the real Intent, or the transaction is rejected outright,
   * before any authorization is generated.
   *
   * Only signals with a genuine Intent-side equivalent belong here
   * (e.g. an amount or a target/vendor identifier). Signals that
   * represent an external fact with no Intent-side equivalent (for
   * example vendorVerified or riskScore) are not expressible as a
   * binding and remain ordinary caller-declared signals — binding
   * them is a separate, larger problem (deriving them from an
   * independently verified source) than this mechanism solves.
   *
   * Example:
   *
   * {
   *   "paymentAmount": "parameters.amount",
   *   "vendorId": "target"
   * }
   */
  boundSignals?: Record<string, string>;

  /**
   * Documents, per rule-referenced fact with no boundSignals entry, why
   * leaving it unbound is a deliberate, reviewed decision rather than an
   * oversight -- the same "reviewed exemption, not a silent gap" idea as
   * @parmana/capability-registry's INTENTIONALLY_UNBOUND_CAPABILITIES, but
   * scoped per-policy rather than centralized, since a fact (unlike a
   * capability) only ever means something in the context of the one
   * policy that references it.
   *
   * PolicyValidator.validate() fails closed on any rule-referenced fact
   * that is neither in boundSignals nor here: an uncovered fact must be
   * either bound or explicitly acknowledged with a reason, never merely
   * unmentioned. An entry naming a fact that boundSignals already covers
   * is rejected as contradictory.
   *
   * Example:
   *
   * {
   *   "vendorVerified": "Independently attested by upstream vendor
   *     verification; no Intent-side equivalent field exists to bind
   *     against."
   * }
   */
  unboundSignalReasons?: Record<string, string>;

  /**
   * Ordered evaluation rules.
   *
   * Rules are evaluated sequentially.
   * The first matching rule wins.
   */
  rules: PolicyRule[];
}
