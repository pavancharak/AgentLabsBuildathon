[← Book Index](README.md) · [← Previous: Chapter 7, The Execution Authorization Envelope](07-execution-authorization-envelope.md)

# Chapter 8: The Execution Gateway

`packages/execution-gateway/src/ExecutionGateway.ts`, `packages/execution-system/src/{ExecutionSystem,ExecutionRequest,HttpExecutionSystem,DefaultExecutionSystem}.ts`.

## The sole release boundary

`ExecutionGateway` is where a signed authorization actually results in something running. It
implements `@parmana/execution-system`'s `ExecutionSystem` interface, one method,
`execute(request: ExecutionRequest): Promise<ExecutionResult>`, so it plugs into
`RuntimeFactory.create()`'s existing seam exactly like `DefaultExecutionSystem` (a trivial
always-succeeds placeholder) or `HttpExecutionSystem` (forwards the request as JSON to a
remote `/execute` endpoint) would. No change to `RuntimeEngine` or `RuntimePipeline` is
required to swap one for another; the whole point of Chapter 5's `RuntimeEngine` never
importing `ExecutionGateway` directly is that this substitution is possible at all.

The class's own doc comment states the thesis plainly: an authorization envelope proves
Parmana _decided_ to approve something; it doesn't by itself stop a receiving system from
executing something else under that approval, or from skipping verification altogether. The
Gateway is "the one place designed to say no even if every earlier stage said yes: the last
point before a real system state changes."

## The full check order, and why it's ordered this way

```
version → signature → expiry → TTL policy
  → businessTransactionHash recompute-and-compare
    → policyStillCurrent recompute-and-compare (required, fails closed)
  → policyGovernanceVerified approval record check (required, fails closed)
  → signalsStillCurrent recompute-and-verify (when wired)
  → nonce
```

The first four are `EnvelopeVerifier.verifyChecks()` (Chapter 7), composed rather than
reimplemented. Everything after that is additive, each one gated on every prior check having
already passed. Since 2026-09-20 the two policy checks are required and fail closed, while the
signal check stays optional.

**`businessTransactionHash`**: always attempted when the prior checks passed. Recomputes
the hash of the exact content about to be forwarded and compares it to the signed value.

**`policyStillCurrent`** (Gap 1B): required. A gateway with no `PolicyRepository` and
`policyApprovalVerifier` refuses to construct unless the explicit `allowUnverifiedPolicy` option
is set (never in production), and an authorization with no `policyContentHash` is rejected
instead of skipped. Reloads the policy at the authorization's own
`(policyName, policyVersion)` and recomputes its current content hash. A mismatch, whether
from the policy's content changing in place, or the policy no longer existing at that
name/version at all, sets this check `false` and reports both hashes in
`policyContentMismatch`, closing the gap "an authorization signed under a policy that's since
changed can still execute."

**`policyGovernanceVerified`** (2026-09-20): required. When the live hash equals the signed
hash, the gateway hands it to the policy approval verifier, which checks that the policy's most
recent signed `PolicyChangeApprovalRecord` exists, verifies, and has a `contentHashAfter`
equal to that hash. The approved hash, the signed hash and the live hash must all agree. A
missing record, invalid signature, differing hash or verifier error rejects the request with
the reason in `policyGovernanceViolation`.

**`signalsStillCurrent`** (G-31, the newest check, added the same session as this book): only
when a `SignalStateVerifier` is supplied _and_ the authorization carries a `signalsHash`
_and_ the incoming request carries `signals`. This is the execution-boundary analogue of
Chapter 3's decision-time signal verification, reusing the _same_ `SignalStateVerifier` port
rather than a new interface. Two sub-checks, in order:

```typescript
// packages/execution-gateway/src/ExecutionGateway.ts (verify(), abridged)
const currentSignalsHash = await this.signalsHasher.hash(request.signals);

if (currentSignalsHash !== signalsHash) {
  signalsStillCurrent = false;
  signalsHashMismatch = { expected: signalsHash, actual: currentSignalsHash };
} else {
  const violations = await this.signalStateVerifier.findViolations(
    { action, businessTransactionId, intentParameters },
    request.signals as PolicySignals,
  );
  signalsStillCurrent = violations.length === 0;
  if (violations.length > 0) signalDivergence = violations;
}
```

First, a tamper check: do the signals accompanying this request still hash to what was
signed? Only if they match does the _second_, more interesting check run: an independent
re-derivation of whether those declared signals are still true, right now, via the same
verifier port used at decision time. Two receiving systems can hold the exact same
authorization, the exact same declared signals, and the exact same `signalsHash`, and still
reach different outcomes, because what differs is what each one's own live check finds at
the moment it checks. This is deliberately a _freshness_ check, not a tamper check. Tutorial
98 (`examples/tutorials/98-signal-freshness-enforcement/run.ts`) demonstrates exactly this:
one authorization, two independent "receiving systems," one whose live re-check finds nothing
changed and executes normally, one that finds the vendor has since been blocked and is
rejected before its connector is ever invoked, with the divergence named.

**Scope, honestly stated:** this check only has teeth for a capability with a
`SignalStateVerifier` actually configured (today, `hubspot-deal-update`), and it only matters
when decision and execution are genuinely separated in time. In this codebase's own default
wiring, `RuntimeEngine.execute()` and `ExecutionGateway.execute()` run synchronously, in the
same call stack, in the same process, so in practice the signals a verifier would re-check
are the same instant already checked moments earlier. The real exposure this closes is a
`SignedExecutionAuthorization` handed to a decoupled downstream receiver, an
`HttpExecutionSystem`-based deployment, or any third party independently verifying the
envelope up to its `maxTtlSeconds` later, exactly the "receiving systems" scenario Chapter
7's envelope doc comment describes as supported.

**`nonce`**: last, always, and only attempted if every prior check passed.
`isSoleFailureNonceReplay()` classifies a failure as "this is specifically a replay, not a
forgery" only when every other check passed and nonce consumption alone failed. This is what
lets the HTTP layer (Chapter 12) return a distinguishable `409 NONCE_ALREADY_CONSUMED`
instead of a generic `500` for that one specific case.

## Release, once verified

Once every check passes, `execute()` deep-freezes the verified content and forwards it either
to a plain `Connector` or, when `executionControl` options are supplied, into
`execution-control`'s `ExecutionControl.execute()`, the bridge into Chapter 9's credential
isolation machinery, using a freshly minted `GatewayAttestation` per call
(`mintGatewayAuthentication`) rather than a static, reused one.

## Stateless by design

The class's own doc comment closes with a line worth repeating exactly: "Stateless and
deterministic: there is no pause/resume state. A mismatch is a rejection naming the mismatch;
a new authorization is simply a new proposal through the runtime." There is no retry queue, no
partial-verification checkpoint to resume from. A rejected request is fully and finally
rejected, and the only way forward is a fresh `BusinessTransaction` through `RuntimeEngine`
from the top.

---

[← Book Index](README.md) · [← Previous: Chapter 7, The Execution Authorization Envelope](07-execution-authorization-envelope.md) · [Next: Chapter 9, Credential Isolation →](09-credential-isolation.md)
