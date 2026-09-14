[← Book Index](README.md) · [← Previous: Chapter 1, Mission and the Domain Model](01-mission-and-domain-model.md)

# Chapter 2: Policy Engine and Evaluation

`packages/policy/src/PolicyEngine.ts`, `packages/policy/src/types/Policy.ts`,
`packages/policy/src/SignalIntentBinder.ts`, `packages/policy/src/PolicyRouter.ts`,
`packages/policy/src/FilePolicyRepository.ts`.

## A policy engine that refuses to do almost everything

`PolicyEngine`'s class doc comment is unusually blunt about its own limits:

```typescript
// packages/policy/src/PolicyEngine.ts:27-42
/**
 * Canonical Policy Engine.
 *
 * Responsibilities
 * ----------------
 * - Evaluate exactly one policy.
 * - Return a deterministic PolicyDecision.
 *
 * This engine SHALL NOT:
 * - authorize execution
 * - execute business actions
 * - access external systems
 * - create trust records
 * - perform replay
 * - generate timestamps
 */
```

`evaluate(policy, signals): PolicyDecision` (line 51) is first-match-wins over an ordered
rule list (`findFirstMatch`, lines 96 through 117): each rule's `PolicyCondition` is
evaluated recursively (leaf `fact`/`operator`/`value`, `all`, `any`, or unconditional
`always` combinators, lines 122 through 186), and the first rule whose condition is true
wins. A **missing** fact never satisfies a leaf condition (line 139: `if (signal ===
undefined) return false`). There is no implicit "treat absent as false" vs. "treat absent as
true" ambiguity to get wrong; it's uniformly "absent never matches." `PolicyOperator`
(`types/Policy.ts:49-115`) lists every comparison this engine can express: equality,
numeric, collection, string, existence, boolean, null, length, type. Its own doc comment is
exactly as restrictive as the engine's: "SHALL NOT access external systems, call LLMs,
access databases, perform network requests, use clocks, generate randomness." A policy
condition is a pure function of the signals it's handed, full stop.

The output, `PolicyDecision` (`packages/policy/src/types/PolicyDecision.ts`), has its own
matching restraint, quoted in full because it's short and load-bearing:

```typescript
// packages/policy/src/types/PolicyDecision.ts:5-19
/**
 * Deterministic result returned by PolicyEngine.
 *
 * A PolicyDecision is a pure function of:
 *
 * - Policy
 * - Runtime Signals
 *
 * It intentionally contains no runtime metadata
 * such as timestamps, execution identifiers,
 * trust records or execution status.
 *
 * Runtime metadata belongs to the Execution Runtime,
 * not the Policy Engine.
 */
```

This single sentence, "runtime metadata belongs to the Execution Runtime, not the Policy
Engine," is why, when this session added the G-31 signal-freshness check (Chapter 8), the
new `signalsStillCurrent` check went into `ExecutionGateway`, not into `PolicyEngine`. The
temptation with a "did the signals change?" check is to put it next to the thing that reads
signals; the codebase's own architectural line says otherwise, and holding that line is what
keeps `PolicyEngine.evaluate()` a pure, five-minute-to-audit function years into the
project's life.

## The Policy document

```typescript
// packages/policy/src/types/Policy.ts:209-287 (abridged)
export interface Policy {
  policyId: string;
  policyVersion: string;
  schemaVersion: string;
  description?: string;
  signalsSchema?: Record<string, string>;
  boundSignals?: Record<string, string>;
  rules: PolicyRule[];
}
```

Policies are JSON files on disk (`policies/{name}/{version}/policy.json`), loaded by
`FilePolicyRepository` and resolved by `PolicyRouter`/`PolicyRegistry` from the
`(name, version)` pair a `BusinessTransaction.policy` names. There is no policy compiler, no
DSL beyond the recursive condition shape above. This is a deliberate ceiling on
expressiveness, traded for every rule being staticly readable and side-effect-free by
construction.

## `boundSignals`: closing the "signals lie about what Intent actually is" gap

A caller declares two things in one request: `signals` (what `PolicyEngine.evaluate`
decides approval on) and `intent` (`action`/`target`/`parameters`, what actually gets signed
and executed, via `ExecutableContent`, Chapter 7). Nothing structurally requires these to
describe the same real-world action. A caller could declare a small, fully-verified,
policy-satisfying `signals` payload while `intent` silently targets something else, and
receive a signed `APPROVED` trust record for it. `boundSignals` is the declared,
per-policy-author fix: an entry like `{"paymentAmount": "parameters.amount", "vendorId":
"target"}` means those two signal keys **must** equal the value found at the given dot-path
into the real `Intent`, checked by `SignalIntentBinder.findViolations()`
(`packages/policy/src/SignalIntentBinder.ts:65-93`) before `PolicyEngine.evaluate` ever
runs. A violation is treated as an ordinary policy `REJECT`. No rule is evaluated, no
authorization is ever generated (see `RuntimeEngine`, Chapter 5).

`Policy.boundSignals`'s own doc comment (`types/Policy.ts:244-278`, worth reading directly)
is explicit about the boundary this mechanism does and doesn't cover: "Only signals with a
genuine Intent-side equivalent belong here... Signals that represent an external fact with
no Intent-side equivalent (for example `vendorVerified` or `riskScore`) are not expressible
as a binding and remain ordinary caller-declared signals: binding them is a separate, larger
problem (deriving them from an independently verified source) than this mechanism solves."
That separate, larger problem is Chapter 3's entire subject. `SignalIntentBinder` proves a
declared signal describes the same _action_ as Intent; it never proves the signal is _true_.

## Routing and loading

`PolicyRouter.load(name, version)` resolves a policy reference to a loaded `Policy` document
via `PolicyRegistry`, which in turn asks a `PolicyRepository` implementation.
`FilePolicyRepository`, in every deployment today, reads `policies/{name}/{version}/policy.json`
off disk, with a write-side path-traversal guard on `save()` added alongside the policy
governance milestone (Chapter 14). There is no compiled-policy cache invalidation problem to
worry about: `RuntimeEngine.execute()` (Chapter 5) reloads and re-hashes the policy content
on every single evaluation, which is also what makes the execution-boundary policy-freshness
check (`policyStillCurrent`, Chapter 8) possible. The hash it compares against is computed
from the same on-disk read path a decision used, not a cached copy that could itself have
gone stale.

---

[← Book Index](README.md) · [← Previous: Chapter 1, Mission and the Domain Model](01-mission-and-domain-model.md) · [Next: Chapter 3, Signal-State Verification →](03-signal-state-verification.md)
