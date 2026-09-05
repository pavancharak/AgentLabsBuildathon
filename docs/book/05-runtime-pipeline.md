# Chapter 5 — The Runtime Pipeline

`packages/runtime/src/RuntimeEngine.ts`, `RuntimePipeline.ts`, `ExecutionGate.ts`,
`DecisionBuilder.ts`, `ExecutionBuilder.ts`, `RuntimeAuthorizationSigner.ts`.

`RuntimeEngine.execute(transaction)` is the single method that turns a caller-submitted
`BusinessTransaction` into a signed `ExecutionAuthorization`, an `Execution`, and eventually
an `ExecutionTrustRecord`. Its own class doc comment lists five responsibilities in order:
load the policy, evaluate it deterministically, create the `Decision`, create the initial
`Execution`, run the pipeline, produce the trust record. What follows is what actually
happens inside `execute()`, in the order it happens — because the order is where most of
this codebase's security properties live.

## Step by step

**1. Signals are resolved once.** `transaction.signals ?? {}` becomes the one signals object
every subsequent check reads from — no re-fetching, no re-deriving, so nothing downstream can
observe a different value than what the policy actually evaluated against.

**2. The policy is loaded, then hashed.** `PolicyRouter.load(name, version)` resolves the
real on-disk policy; `policyContentHasher.hash(policy)` (a `TrustRecordHasher`, Chapter 6)
computes a canonical hash of the *actual loaded document*, not the caller's declared
`(name, version)` string pair. This distinction matters because policy governance (Chapter
14) permits in-place content edits to an existing version string — a version-string
comparison alone can't detect every real change, but this hash can, and it's what the
execution-boundary `policyStillCurrent` check (Chapter 8) later recomputes and compares
against.

**3. Capability/policy binding, then signal/intent binding — in that order.**
`CapabilityPolicyBinder.findViolation()` (Chapter 4) runs first; only if it finds *no*
violation does `SignalIntentBinder.findViolations()` (Chapter 2) run at all. The comment at
this call site is explicit about why: "checking a narrower guarantee against an already-wrong
policy is meaningless." Either violation is built into a `PolicyDecision` shaped exactly like
an ordinary rule rejection (`matchedRuleId: "capability-policy-binding-violation"` or
`"signal-intent-binding-violation"`, `evaluatedRules: 0`) — from every downstream
consumer's perspective, these are indistinguishable from a policy author's own `REJECT` rule
firing.

**4. `PolicyEngine.evaluate()` runs only if neither binding check found a violation.** This
produces the provisional `PolicyDecision` (Chapter 2).

**5. `SignalStateVerifier.findViolations()` runs only if the provisional decision is
`APPROVE`.** This is the one place order is chosen for a performance/security tradeoff
explicitly, not just a dependency ordering: "a policy denial makes zero calls to the external
system" is preserved for every `REJECT` that isn't itself a signal-state mismatch, by
skipping the fetch entirely when the provisional decision was already going to fail. A
violation here overrides the decision to `REJECT` — no authorization is ever generated for an
approval resting on a signal verified state contradicts.

**6. The final `Decision` is built**, and if its outcome isn't `APPROVED`, a `RefusalRecord`
is attempted (Chapter 15) — deliberately as a best-effort side channel: a refusal-record
write failure is logged and swallowed, never allowed to change the enforcement outcome
itself, because "evidence depends on the refusal, never the other way around."

**7. `ExecutionGate.enforce(decision)` is the actual enforcement point.** If the decision
isn't approved, this throws a `RuntimeError` with `status: 403, code: "POLICY_DENIED"` and
returns nothing further — everything after this line in `execute()` only runs for an
approved decision. `ExecutionGate` is a two-line class on purpose: `canExecute()` is a pure
predicate, `enforce()` either returns or throws. Splitting the predicate out lets other code
ask "would this be allowed" without triggering the throw path.

**8. `ExecutableContent` is derived from the transaction's Intent** — `businessTransactionId`,
`action`, `target`, `parameters`, via the single shared `toExecutableContent()` helper every
other consumer of this shape (the Execution Gateway included) also uses, "so this builder's
output can never silently diverge from what was actually authorized."

**9. The authorization is signed.** `signalsHash` — a canonical hash of the same `signals`
object resolved in step 1 — is computed by a dedicated `signalsHasher` (a second
`TrustRecordHasher` instance, mirroring `policyContentHasher` exactly) and passed into
`RuntimeAuthorizationSigner.sign()` alongside `policyContentHash`, `decisionId`,
`businessTransactionId`, `policyName`/`policyVersion`, and `executableContent`. This is the
newest field in the payload (G-31, added the same session this book was written) and Chapter
7 covers the full envelope shape and why each field exists.

**10. The `Execution` and `RuntimeContext` are built**, the runtime pipeline
(`RuntimePipeline.execute()`) runs — this is where `ExecutionComponent` (Chapter 8) actually
forwards the signed authorization to whatever `ExecutionSystem` is configured — and finally
`BusinessTrustPipeline.execute()` produces the signed `ExecutionTrustRecord` (Chapter 1)
returned to the caller.

## Hooks: an escape hatch that doesn't touch the spine

`RuntimeHookRunner` fires named lifecycle callbacks (`beforePolicyLoad`, `afterPolicyEvaluation`,
`beforeAuthorization`, `afterExecution`, `onRuntimeError`, and others) around the steps above,
constructed once from an ordered `RuntimeHook[]` array passed into `RuntimeEngine`'s
constructor. Nothing in the core `execute()` logic depends on any hook running or not — hooks
observe, they don't gate. This is how this codebase adds cross-cutting instrumentation
(tutorials frequently register a hook purely to print intermediate state) without ever
needing to modify `RuntimeEngine.execute()` itself for a new concern.

## Backward compatibility as a constructor discipline

`RuntimeEngine`'s constructor takes ten required positional arguments, then a strictly
trailing, strictly optional sequence: `hooks`, then the RFC-0021 refusal-record pair
(`refusalRecordBuilder`, `refusalRecordRepository`), then the G-24 `signalStateVerifier`,
then the TD-22 `capabilityPolicyBinder`. Every one of these additions is documented, at the
constructor parameter itself, with the exact same justification: "every pre-existing call
site... must keep compiling and behaving identically... when omitted, [feature] is skipped —
current behavior, unchanged." This is the same discipline Chapter 7 shows again at the
payload level (`policyContentHash`, then `signalsHash`, both optional) and Chapter 8 shows a
third time at the Gateway level (`policyRepository`, then `signalStateVerifier`, both
optional dependencies) — a consistent, repo-wide convention for adding a real security
property without a breaking change or a version bump, verified by keeping every pre-existing
test passing unmodified rather than asserted as a style preference.
