/**
 * @parmana/policy
 *
 * Canonical public API.
 */

// -----------------------------------------------------------------------------
// Engine
// -----------------------------------------------------------------------------

export { PolicyEngine } from "./PolicyEngine.js";
export { SignalIntentBinder } from "./SignalIntentBinder.js";
export type {
  IntentSnapshot,
  SignalIntentBindingViolation,
} from "./SignalIntentBinder.js";

export type {
  SignalStateVerificationRequest,
  SignalStateVerifier,
  SignalStateViolation,
} from "./types/SignalStateVerifier.js";

export { CompositeSignalStateVerifier } from "./CompositeSignalStateVerifier.js";

export type {
  PolicyExecutionVerifier,
  PolicyExecutionViolation,
} from "./types/PolicyExecutionVerifier.js";

export {
  CANONICAL_CAPABILITY_POLICY_BINDINGS,
  CapabilityPolicyBinder,
} from "@parmana/capability-registry";
export type { CapabilityPolicyBindingViolation } from "@parmana/capability-registry";

// -----------------------------------------------------------------------------
// Routing & Registry
// -----------------------------------------------------------------------------

export { PolicyRegistry } from "./PolicyRegistry.js";
export { PolicyRouter } from "./PolicyRouter.js";

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

export { PolicyValidator } from "./PolicyValidator.js";
export type { RuleConflictWarning } from "./PolicyValidator.js";

// -----------------------------------------------------------------------------
// Repositories
// -----------------------------------------------------------------------------

export type { PolicyRepository } from "./PolicyRepository.js";
export { FilePolicyRepository } from "./FilePolicyRepository.js";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type {
  Policy,
  PolicyCondition,
  PolicyInput,
  PolicyRule,
  PolicyRuleOutcome,
} from "./types/Policy.js";

export type { PolicySignals } from "./types/PolicySignals.js";

export type { PolicyDecision } from "./types/PolicyDecision.js";

export { PolicyAction } from "./types/PolicyAction.js";

export { PolicyOutcome } from "./types/PolicyOutcome.js";

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

export * from "./errors/index.js";
