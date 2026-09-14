import { OperatorEvaluator } from "./OperatorEvaluator.js";

import type { Policy, PolicyCondition, PolicyRule } from "./types/Policy.js";

import type { PolicySignals } from "./types/PolicySignals.js";

import type { PolicyDecision } from "./types/PolicyDecision.js";

import { PolicyAction } from "./types/PolicyAction.js";

import { PolicyOutcome } from "./types/PolicyOutcome.js";

/**
 * Canonical Policy Engine.
 *
 * Responsibilities
 * ----------------
 * - Evaluate exactly one policy.
 * - Return a deterministic PolicyDecision.
 *
 * This engine SHALL NOT:
 * - authorize execution
 * - execute business actions
 * - access external systems
 * - create trust records
 * - perform replay
 * - generate timestamps
 */
export class PolicyEngine {
  private readonly operatorEvaluator = new OperatorEvaluator();

  /**
   * Evaluate exactly one policy.
   */
  public evaluate(policy: Policy, signals: PolicySignals): PolicyDecision {
    const trace: string[] = [];

    const rule = this.findFirstMatch(policy.rules, signals, trace);

    return {
      policyId: policy.policyId,

      policyVersion: policy.policyVersion,

      outcome: this.toOutcome(rule?.outcome.action),

      reason: rule?.outcome.reason ?? "no_rule_matched",

      matchedRuleId: rule?.id ?? "none",

      evaluatedRules: trace.length,

      matchedPath: trace,
    };
  }

  /**
   * Deterministic first-match-wins evaluation.
   */
  private findFirstMatch(
    rules: PolicyRule[],
    signals: PolicySignals,
    trace: string[],
  ): PolicyRule | null {
    for (const rule of rules) {
      trace.push(rule.id);

      if (this.evaluateCondition(rule.condition, signals)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Recursively evaluates a policy condition.
   */
  private evaluateCondition(
    condition: PolicyCondition,
    signals: PolicySignals,
  ): boolean {
    //
    // Leaf condition
    //
    if ("fact" in condition) {
      const signal = signals[condition.fact];

      //
      // Missing facts never satisfy
      // a policy condition.
      //
      if (signal === undefined) {
        return false;
      }

      return this.operatorEvaluator.evaluate(
        signal,
        condition.operator,
        condition.value,
      );
    }

    //
    // Always
    //
    if ("always" in condition) {
      return true;
    }

    //
    // Logical AND
    //
    if ("all" in condition) {
      return condition.all.every((child) =>
        this.evaluateCondition(child, signals),
      );
    }

    //
    // Logical OR
    //
    if ("any" in condition) {
      return condition.any.some((child) =>
        this.evaluateCondition(child, signals),
      );
    }

    return false;
  }

  /**
   * Maps PolicyAction to PolicyOutcome.
   */
  private toOutcome(action?: PolicyAction): PolicyOutcome {
    switch (action) {
      case PolicyAction.APPROVE:
        return PolicyOutcome.APPROVE;

      case PolicyAction.REJECT:
      default:
        return PolicyOutcome.REJECT;
    }
  }
}
