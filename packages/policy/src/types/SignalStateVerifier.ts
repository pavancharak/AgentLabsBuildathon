import type { PolicySignals } from "./PolicySignals.js";

/**
 * The subset of a Business Transaction's Intent a SignalStateVerifier
 * needs to decide whether, and how, to independently verify the
 * declared signals for this specific action.
 */
export interface SignalStateVerificationRequest {
  readonly action: string;
  readonly businessTransactionId: string;
  readonly intentParameters?: Readonly<Record<string, unknown>>;

  /**
   * Where the check runs. "authorize" (the default when absent) is
   * RuntimeEngine, before an authorization is signed. "release" is the
   * Execution Gateway checking the same signals again just before it
   * releases the request (G-31).
   *
   * A verifier that consumes something single use, such as an Approval
   * Artifact's nonce, must consume it only at "authorize". At "release"
   * the same artifact was already consumed for this transaction, and the
   * signed execution authorization, itself single use and bound to these
   * signals by signalsHash, prevents it being used for another one.
   */
  readonly stage?: "authorize" | "release";
}

/**
 * One signal whose caller-declared value did not match the value
 * independently verified against real, external state.
 */
export interface SignalStateViolation {
  readonly signalKey: string;
  readonly declaredValue: unknown;
  readonly actualValue: unknown;
}

/**
 * Signal/State Verifier port (RFC-0022, G-24 residual closure).
 *
 * SignalIntentBinder proves a policy's signals describe the same
 * action as Intent; it never proves those signals are *true*. This
 * port is the deliberately separate, additive check for that: given
 * an action and the signals a policy is about to evaluate, an
 * implementation may independently re-derive the relevant facts from
 * a real external source (e.g. a live payment provider) and report
 * any mismatch as a violation.
 *
 * Optional and capability-scoped by design: an implementation that
 * does not know how to verify a given action returns an empty array,
 * the same "nothing to check" shape SignalIntentBinder uses when a
 * policy declares no boundSignals. RuntimeEngine treats any violation
 * as an ordinary policy REJECT -- no authorization is ever generated
 * for a request whose declared signals do not match verified reality.
 */
export interface SignalStateVerifier {
  findViolations(
    request: SignalStateVerificationRequest,
    signals: PolicySignals,
  ): Promise<readonly SignalStateViolation[]>;
}
