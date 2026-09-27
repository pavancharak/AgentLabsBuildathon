/**
 * @parmana/approval
 *
 * Canonical public API.
 */

export {
  ApprovalVerifier,
  type ApprovalVerificationRequest,
  type ApprovalVerificationResult,
} from "./ApprovalVerifier.js";

export {
  StaticApprovalIssuerRegistry,
  type ApprovalIssuerRegistry,
  type TrustedApprovalIssuer,
  type ResolvedApprovalIssuer,
} from "./ApprovalIssuerRegistry.js";

export { evaluateApprovalScope } from "./ApprovalScopeEvaluator.js";

export { isSignedApprovalShape } from "./SignedApprovalGuard.js";
export { ApprovalSignalVerifier } from "./ApprovalSignalVerifier.js";
