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
}
