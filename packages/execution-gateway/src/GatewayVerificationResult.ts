import type { SignalStateViolation } from "@parmana/policy";

/**
 * Result of the Execution Gateway's verification
 * sequence.
 *
 * Every check runs and is named individually. The
 * side-effect-free checks (version, signature,
 * expiry, TTL policy, content hash) always run,
 * in that order. The nonce is consumed last, and
 * only when every side-effect-free check passed —
 * see ExecutionGateway.verify for why.
 */
export interface GatewayVerificationResult {
  readonly valid: boolean;

  readonly checks: {
    readonly versionSupported: boolean;
    readonly signatureVerified: boolean;
    readonly notExpired: boolean;
    readonly ttlWithinPolicy: boolean;
    readonly businessTransactionHashMatches: boolean;

    /**
     * Present only when a PolicyRepository was supplied to the
     * Gateway AND the authorization carries a policyContentHash --
     * absent (not false) otherwise, meaning the check was skipped
     * rather than failed. See ExecutionGateway's class doc comment.
     */
    readonly policyStillCurrent?: boolean;

    /**
     * Present only when a SignalStateVerifier was supplied to the
     * Gateway AND the authorization carries a signalsHash AND the
     * request carries signals -- absent (not false) otherwise, meaning
     * the check was skipped rather than failed. False covers two
     * distinct causes, both surfaced via the detail fields below:
     * the request's signals no longer hash-match the authorization's
     * signalsHash (tamper/mismatch), or they hash-match but the
     * SignalStateVerifier independently found the underlying real-world
     * conditions have since diverged (drift). See ExecutionGateway's
     * class doc comment.
     */
    readonly signalsStillCurrent?: boolean;

    readonly nonceUnseen: boolean;
  };

  /**
   * Present only when businessTransactionHashMatches
   * is false. Names both hashes so a mismatch is
   * diagnosable without re-deriving either value.
   */
  readonly hashMismatch?: {
    readonly expected: string;
    readonly actual: string;
  };

  /**
   * Present only when policyStillCurrent is false. Names both
   * hashes so a mismatch is diagnosable without re-deriving either
   * value.
   */
  readonly policyContentMismatch?: {
    readonly expected: string;
    readonly actual: string;
  };

  /**
   * Present only when signalsStillCurrent is false because the
   * request's signals no longer hash-match the authorization's
   * signalsHash. Names both hashes, same shape as policyContentMismatch.
   */
  readonly signalsHashMismatch?: {
    readonly expected: string;
    readonly actual: string;
  };

  /**
   * Present only when signalsStillCurrent is false because a
   * SignalStateVerifier found the declared signals no longer match
   * independently verified real-world state. Empty/absent whenever
   * signalsStillCurrent is true or undefined.
   */
  readonly signalDivergence?: readonly SignalStateViolation[];
}
