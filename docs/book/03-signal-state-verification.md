[← Book Index](README.md) · [← Previous: Chapter 2, Policy Engine and Evaluation](02-policy-engine-and-evaluation.md)

# Chapter 3: Signal-State Verification

`packages/policy/src/types/SignalStateVerifier.ts`, `packages/policy/src/CompositeSignalStateVerifier.ts`,
`packages/connector-hubspot/src/HubSpotSignalStateVerifier.ts`.

## The gap `boundSignals` leaves open

Chapter 2 ended on this sentence from `SignalIntentBinder`'s own doc comment: it "proves a
policy's signals describe the same action as Intent; it never proves those signals are
*true*." A caller can declare `vendorVerified: true` and nothing in `boundSignals` or
`SignalIntentBinder` checks whether that's actually the case. There's no Intent-side
equivalent for "is this vendor really KYC-verified" to bind against. That's the residual gap
`SignalStateVerifier` exists to close, for the signals a policy author chooses to wire it up
for.

```typescript
// packages/policy/src/types/SignalStateVerifier.ts:24-47 (abridged)
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
 * policy declares no boundSignals.
 */
export interface SignalStateVerifier {
  findViolations(
    request: SignalStateVerificationRequest,
    signals: PolicySignals,
  ): Promise<readonly SignalStateViolation[]>;
}
```

This is a port, not a mandate. A capability with no verifier wired up simply isn't checked
this way, and that absence is itself visible and documented (`docs/CLAIMS.md`'s roadmap
entry on "fetch-verification of unbound policy signals" says so directly, Chapter 18). It
runs inside `RuntimeEngine.execute()` (Chapter 5), and only once the provisional decision is
already `APPROVE`. A request already rejected by an ordinary policy rule needs no
independent re-fetch, which also means "a policy denial makes zero external calls" stays
true even with a verifier wired in.

## Composing more than one, without cross-contamination

A real deployment can have one independent, capability-scoped verifier per connector.
`RuntimeEngine` accepts exactly one `SignalStateVerifier`, so multiple real verifiers compose
through `CompositeSignalStateVerifier`:

```typescript
// packages/policy/src/CompositeSignalStateVerifier.ts:8-38 (abridged)
/**
 * Each SignalStateVerifier implementation is expected to recognize only
 * the action(s) it knows how to independently verify and return an
 * empty array for anything else... This composite queries each in the
 * order supplied and returns the first non-empty result.
 */
export class CompositeSignalStateVerifier implements SignalStateVerifier {
  constructor(private readonly verifiers: readonly SignalStateVerifier[]) {}

  async findViolations(request, signals) {
    for (const verifier of this.verifiers) {
      const violations = await verifier.findViolations(request, signals);
      if (violations.length > 0) return violations;
    }
    return [];
  }
}
```

Discipline, not enforcement, keeps this safe. Each verifier is *expected* to recognize only
its own action(s) and return `[]` for everything else. Tutorial 82
(`examples/tutorials/82-composite-signal-state-verification/run.ts`) exists specifically to
prove this holds. It pairs the real `HubSpotSignalStateVerifier` with a second, illustrative
verifier for a fictional capability and shows a mismatched signal on the "wrong" verifier's
action is silently ignored by that verifier, not misreported, and an action neither verifier
recognizes produces no false positives at all.

## The real example: HubSpot

`HubSpotSignalStateVerifier` fetches the real deal (`hubspot:deal-fetch`) and compares it
against every verified signal key before policy evaluation runs. A single false signal,
`currentDealStage` declared as an early pipeline stage when the real deal is already
`closedlost`, is caught, and because `dealStageTransitionAllowed` is *derived* from
`currentDealStage`, both come back mismatched in the same rejection, not just the first one
found. Tutorial 71 (`examples/tutorials/71-hubspot-signal-state-verification/run.ts`)
demonstrates exactly this: a caller declares `currentDealStage: "appointmentscheduled"`
against a mock server whose real deal is `closedlost`, and the request is rejected naming the
mismatch, with the deal itself left completely untouched. The independently fetched real
state overrides the caller's claim; it doesn't merely flag a discrepancy.

## The historical counterpart, and what it teaches

The Razorpay connector had its own `RazorpaySignalStateVerifier`, mirroring HubSpot's
pattern exactly, before the connector was removed in full on 2026-08-12 (Chapter 10 covers
why). Its removal is the reason `docs/CLAIMS.md`'s open roadmap item on fetch-verifying
*unbound* signals generally no longer has a second live example to point at. The general
gap ("a policy can still evaluate signals no verifier covers") is unchanged, but the
concrete illustration of it is gone along with the connector. This is a small but real
instance of a larger pattern worth naming: removing a feature for good reasons (Chapter 10)
doesn't just delete code, it can quietly delete the *evidence* an unrelated claim was leaning
on. That's exactly what the Razorpay-staleness documentation audit earlier in this
session had to go hunting for, file by file, months after the fact.

## Where this sits relative to G-31

It's worth being precise about the difference between this chapter and Chapter 8's
execution-boundary signal-freshness check (G-31), since both involve "are the signals still
true." `SignalStateVerifier` runs once, at decision time, before an authorization is ever
signed. G-31's `signalsStillCurrent` check runs again, independently, at the execution
boundary, for a `SignedExecutionAuthorization` that might be verified and executed by a
different process, possibly much later, up to its TTL. They're the same kind of check
(independent re-derivation of real-world facts) applied at two different moments for two
different reasons, and this codebase deliberately reuses the *same* `SignalStateVerifier`
port for both rather than inventing a second interface. See Chapter 8 for exactly how.

---

[← Book Index](README.md) · [← Previous: Chapter 2, Policy Engine and Evaluation](02-policy-engine-and-evaluation.md) · [Next: Chapter 4, Capability/Policy Binding →](04-capability-policy-binding.md)
