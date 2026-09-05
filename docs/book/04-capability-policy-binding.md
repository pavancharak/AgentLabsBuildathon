[← Book Index](README.md) · [← Previous: Chapter 3, Signal-State Verification](03-signal-state-verification.md)

# Chapter 4: Capability/Policy Binding

`packages/capability-registry/src/CapabilityPolicyBinding.ts`.

## The gap this closes

`boundSignals` (Chapter 2) and `SignalStateVerifier` (Chapter 3) both protect specific
signals *within* a policy evaluation. Neither of them protects something one level up:
nothing stops a caller from pairing a real, fund-moving or CRM-mutating capability with an
entirely unrelated, weaker policy. `PolicyEngine.evaluate` "takes no `action` parameter at
all." It evaluates whatever policy it's handed against whatever signals it's handed, with no
concept of which capability the caller claims to be invoking. A caller could declare
`hubspot:deal-update` (protected, when evaluated under its own policy, by that policy's
`boundSignals`) but pair it with `vendor-payment/2.0.0` instead: a real, loadable policy
that declares no `boundSignals` for `hubspot:deal-update` at all, and is trivially
satisfiable by caller-declared signals alone. This is TD-22, found during Phase 2K's
independent verification and closed by `CapabilityPolicyBinder`.

## The canonical binding table

```typescript
// packages/capability-registry/src/CapabilityPolicyBinding.ts (current bindings)
CANONICAL_CAPABILITY_POLICY_BINDINGS = {
  "hubspot:deal-fetch":  { name: "hubspot-deal-update", version: "1.0.0" },
  "hubspot:deal-update": { name: "hubspot-deal-update", version: "1.0.0" },
  "github:pr-fetch":     { name: "github-pr-approval",  version: "1.0.0" },
  "github:pr-merge":     { name: "github-pr-approval",  version: "1.0.0" },
}
```

`CapabilityPolicyBinder.findViolation(action, declaredPolicy)` checks a request's declared
`(policyName, policyVersion)` against this table for the capability it names, rejecting the
pairing if a canonical binding exists and the declared policy doesn't match it exactly, not
just by name. `RuntimeEngine` (Chapter 5) runs this check before `SignalIntentBinder`, for
the same reason `SignalIntentBinder` runs before `PolicyEngine.evaluate`: checking a
narrower guarantee against an already-wrong policy is meaningless. A violation is an ordinary
policy rejection: no rule evaluated, no authorization generated. Capabilities with no
canonical entry (every test/tutorial-only action) are unaffected; this is opt-in per
capability, not a blanket requirement.

## Why this is its own package, not inside `@parmana/policy`

The binding table and its binder used to live inside `@parmana/policy` itself. They were
extracted into a new, deliberately minimal leaf package. `CANONICAL_CAPABILITY_POLICY_BINDINGS`
and `CapabilityPolicyBinder` are its only exports, depending on nothing but `@parmana/shared`.
The reason, straight from the source comment: this closes a real dependency-graph problem,
not a stylistic one. `@parmana/connector-hubspot` and `@parmana/connector-github` both
already depend on `@parmana/policy`. If the capability-identifier constants they define lived
in `@parmana/policy` and `@parmana/policy` needed to read them back (to validate its own
binding table against what connectors actually register), that would be a dependency cycle
back through the exact package the extraction exists to be depended on by. Keeping
`@parmana/capability-registry` a true leaf, depending on nothing connector-specific and
depended on by both `@parmana/policy` and, eventually, anything that needs to read the
canonical bindings, avoids that cycle entirely. `packages/policy/src/index.ts` re-exports
both symbols unchanged, so every one of the roughly ten existing consumers that imports them
via `@parmana/policy` needed zero code changes when the move happened.

## What this doesn't close, and how that was found

The coverage test asserting "every capability the production connector registry actually
registers is bound" (`packages/capability-registry/tests/unit/CapabilityPolicyBinder.test.ts`)
does not, itself, read `createConnectorRegistry.ts`. It asserts against a hand-maintained
literal set of expected capability strings. This is precisely the mechanism that let a real
gap (G-30) go undetected for six days in production: the GitHub connector was wired into
`createConnectorRegistry.ts` on one date, and the coverage test's literal wasn't updated to
match until an unrelated documentation-audit pass noticed the registry actually registers
three connectors, not the two both the original audit and its own follow-up fix had assumed.
`docs/VERIFICATION-GAPS.md` G-30 has the full account, including the fix (adding
`github:pr-fetch`/`github:pr-merge` to the table, same-day) and the honest note that the fix
reduces the gap without closing the underlying mechanism: the coverage test's expected set is
still a hand-maintained literal today, not a live read of the registry, so a fourth connector
added without also updating this test's literal (and the binding table itself) would recur
silently, exactly as this gap recurred once already. Deriving the expected set from
`createConnectorRegistry.ts` directly remains open follow-on work, not done, because it would
require either a `packages/policy → packages/api` dependency edge or an equivalent shared
single source of truth, a bigger decision than the immediate fix warranted. This is a small,
concrete example of a pattern worth internalizing about this codebase generally: a coverage
test that asserts against a literal instead of reading the thing it's meant to cover is a
latent gap, even when it's green today.

---

[← Book Index](README.md) · [← Previous: Chapter 3, Signal-State Verification](03-signal-state-verification.md) · [Next: Chapter 5, The Runtime Pipeline →](05-runtime-pipeline.md)
