/**
 * Vendored verbatim (logic unchanged) from packages/policy/src/PolicyEngine.ts
 * for standalone deployment in the buildathon demo. This is the real,
 * production Parmana policy engine: deterministic, side-effect free,
 * first-match-wins rule evaluation.
 */
import { OperatorEvaluator } from './OperatorEvaluator';
import type {
  Policy,
  PolicyCondition,
  PolicyRule,
  PolicySignals,
  PolicyDecision,
} from './types';
import { PolicyAction, PolicyOutcome } from './types';

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

  public evaluate(policy: Policy, signals: PolicySignals): PolicyDecision {
    const trace: string[] = [];

    const rule = this.findFirstMatch(policy.rules, signals, trace);

    return {
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      outcome: this.toOutcome(rule?.outcome.action),
      reason: rule?.outcome.reason ?? 'no_rule_matched',
      matchedRuleId: rule?.id ?? 'none',
      evaluatedRules: trace.length,
      matchedPath: trace,
    };
  }

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

  private evaluateCondition(condition: PolicyCondition, signals: PolicySignals): boolean {
    if ('fact' in condition) {
      const signal = signals[condition.fact];

      if (signal === undefined) {
        return false;
      }

      return this.operatorEvaluator.evaluate(signal, condition.operator, condition.value);
    }

    if ('always' in condition) {
      return true;
    }

    if ('all' in condition) {
      return condition.all.every((child) => this.evaluateCondition(child, signals));
    }

    if ('any' in condition) {
      return condition.any.some((child) => this.evaluateCondition(child, signals));
    }

    return false;
  }

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
