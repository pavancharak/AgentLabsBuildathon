import { PolicyReference } from "./policy-reference.js";

import type { JsonValue } from "../types/Json.js";

/**
 * Parmana Trust Core
 *
 * Decision
 *
 * Immutable result produced by evaluating an
 * Intent against a Policy.
 *
 * Decision does not create authority.
 * Decision does not grant authorization.
 * Decision does not modify intent.
 *
 * Decision records only the outcome of
 * deterministic Policy evaluation.
 */
export interface Decision {
  /**
   * Unique Decision identifier.
   */
  readonly decisionId: string;

  /**
   * Intent evaluated by this Decision.
   */
  readonly intentId: string;

  /**
   * Exact Policy used.
   */
  readonly policy: PolicyReference;

  /**
   * Runtime signals evaluated by the policy.
   *
   * These are captured to support deterministic
   * replay and independent verification.
   */
  readonly signals: Record<string, JsonValue>;

  /**
   * Policy evaluation outcome.
   */
  readonly outcome: DecisionOutcome;

  /**
   * Optional explanation.
   */
  readonly reason?: string;

  /**
   * UTC timestamp when evaluation completed.
   */
  readonly evaluatedAt: Date;
}

/**
 * Canonical Decision outcomes.
 */
export enum DecisionOutcome {
  APPROVED = "APPROVED",

  REJECTED = "REJECTED",
}
