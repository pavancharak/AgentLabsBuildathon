/**
 * Vendored from packages/policy/src/types/{Policy,PolicySignals,PolicyAction,
 * PolicyOutcome,PolicyDecision}.ts, unmodified except: merged into one file
 * and the `@parmana/shared` JsonValue import is inlined (it is a pure type
 * with no runtime code) so this directory has zero dependency on the rest
 * of the monorepo and can deploy standalone.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Runtime signals evaluated by the policy engine. */
export interface PolicySignals {
  [key: string]: JsonValue;
}

/**
 * Canonical actions defined by policy rules.
 */
export enum PolicyAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

/**
 * Canonical outcomes produced by PolicyEngine.
 */
export enum PolicyOutcome {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export interface PolicyRuleOutcome {
  action: PolicyAction;
  reason: string;
}

export type PolicyOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'contains_all'
  | 'contains_any'
  | 'starts_with'
  | 'ends_with'
  | 'matches'
  | 'exists'
  | 'not_exists'
  | 'is_true'
  | 'is_false'
  | 'is_null'
  | 'is_not_null'
  | 'length_eq'
  | 'length_gt'
  | 'length_gte'
  | 'length_lt'
  | 'length_lte'
  | 'type_is';

export interface PolicyLeafCondition {
  fact: string;
  operator: PolicyOperator;
  value?: JsonValue;
}

export interface PolicyAllCondition {
  all: PolicyCondition[];
}

export interface PolicyAnyCondition {
  any: PolicyCondition[];
}

export interface PolicyAlwaysCondition {
  always: true;
}

export type PolicyCondition =
  | PolicyLeafCondition
  | PolicyAllCondition
  | PolicyAnyCondition
  | PolicyAlwaysCondition;

export interface PolicyRule {
  id: string;
  condition: PolicyCondition;
  outcome: PolicyRuleOutcome;
}

export interface Policy {
  policyId: string;
  policyVersion: string;
  schemaVersion: string;
  description?: string;
  signalsSchema?: Record<string, string>;
  boundSignals?: Record<string, string>;
  unboundSignalReasons?: Record<string, string>;
  rules: PolicyRule[];
}

/**
 * Deterministic result returned by PolicyEngine.
 */
export interface PolicyDecision {
  policyId: string;
  policyVersion: string;
  outcome: PolicyOutcome;
  reason: string;
  matchedRuleId: string;
  evaluatedRules: number;
  matchedPath: string[];
}
