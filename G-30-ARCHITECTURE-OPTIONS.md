# G-30 Architecture Options

**Status:** decision document only — nothing below has been implemented. G-30 itself (the
missing `github:pr-fetch`/`github:pr-merge` policy bindings) is already fixed and committed
(`92d7aa6`); what remains open is the *root cause* — a hand-maintained test literal that can
silently diverge from what's actually registered in production — and which of three ways to
close that root cause Pavan wants to take.

**Verification note on this document's own content:** the original prompt this document was
drafted from included a code sample for Option B (`registry.getCapabilityBindings()`,
`createConnectorRegistry()` called with no arguments) that does not match this codebase.
Checked directly against `packages/execution-control/src/ConnectorRegistry.ts` and
`packages/api/src/bootstrap/createConnectorRegistry.ts` before writing this: `ConnectorRegistry`
has no `getCapabilityBindings()` method (its real methods are `register`, `get`,
`resolveCapability`, `unregister`, `list`), and `createConnectorRegistry` requires four
arguments (`authenticator`, `sessions`, `audit`, `gatewayAuthentication`), not zero. Option B
below describes what a live-read implementation would actually have to do, not the original
sketch.

---

## Background

`CANONICAL_CAPABILITY_POLICY_BINDINGS` (`packages/policy/src/CapabilityPolicyBinding.ts`) is a
hand-written map from capability identifier to the one policy that governs it.
`CapabilityPolicyBinder.test.ts` has a regression test asserting this map covers every
capability actually registered in production — but that assertion is itself a second,
independently hand-maintained literal (a `Set` of string literals), not a live read of
`packages/api/src/bootstrap/createConnectorRegistry.ts`. When GitHub's two capabilities were
wired into the registry (commit `38658c0`, 2026-08-19) without a corresponding update to
either literal, both lists still agreed with each other — they just both omitted GitHub — so
the test kept passing while the real registry and the real binding map had silently diverged
from each other for six days, until this was caught by a documentation audit unrelated to
capability coverage.

**The actual failure mode is two independent lists that only self-check against each other,
never against the thing they're both supposed to describe.** Any fix needs to either (a) make
one of the two lists read from the other's real source of truth, or (b) eliminate the second
list by deriving it.

---

## Option A — Accept as documented debt, revisit later

**What changes today:** nothing in code. `docs/VERIFICATION-GAPS.md`'s G-30 entry already
documents the root cause (this document elaborates on it, doesn't replace it). No new
dependency, no new package, no test rewrite.

**Effort:** ~30 minutes (this document plus a VERIFICATION-GAPS.md cross-link — already most
of what's been spent writing this).

**Risk carried forward:** a third connector (or a HubSpot capability added later) can recur
this exact gap — hand-edit `createConnectorRegistry.ts`, forget the binding map, forget the
test literal, both still agree with each other, `npm test` stays green. Nothing structural
prevents that from happening again before whichever future session picks this up.

**Trade-offs:**

| | |
|---|---|
| Pro | Ships now, zero code risk, zero new coupling |
| Pro | Defers the coupling decision (B vs. C) to whenever there's time to do it properly |
| Con | The exact mechanism that caused G-30 is still live in the codebase |
| Con | Depends on someone remembering to revisit it — the same failure mode as G-30 itself (a thing nobody's watching) |

---

## Option B — `packages/policy`'s coverage test reads live from the registry

**What this actually requires**, corrected against the real APIs:

`createConnectorRegistry()` isn't a zero-argument static lookup — it's a factory that
constructs the *executable* production registry, requiring a `ConnectorAuthenticator`,
`InMemoryGatewaySessionStore`, an `ExecutionAuditSink`, and a `gatewayAuthentication` value, and
internally calls `CryptoBootstrap.create()` and the two connector-credential factories. Getting
a real registry instance means building all of that in the test, the same way
`packages/api/tests/unit/bootstrap/create-connector-registry.test.ts` already does. And once
built, `ConnectorRegistry` (`packages/execution-control/src/ConnectorRegistry.ts`) has no
concept of policy bindings at all — its `list()` method returns each registered connector and
its `capabilities: string[]`, nothing about which policy governs them. So the real
implementation is:

```typescript
// packages/policy doesn't have createConnectorRegistry — it lives in packages/api.
// This snippet is illustrative of what Option B requires, not a claim it exists today.
import { createConnectorRegistry } from "@parmana/api/bootstrap/createConnectorRegistry";
// ...plus everything createConnectorRegistry needs to construct: an authenticator,
// a session store, an audit sink, and a gatewayAuthentication value.

const registry = createConnectorRegistry(authenticator, sessions, audit, gatewayAuth);

const registeredCapabilities = new Set(
  registry.list().flatMap((connector) => connector.capabilities),
);

// Then: registeredCapabilities must be a subset of
// CANONICAL_CAPABILITY_POLICY_BINDINGS.keys() (test-fixture's own capability,
// deliberately unbound, is the one expected exception).
```

**This requires `packages/policy` to add a dependency on `packages/api`** (currently zero
dependency edge exists in that direction — `packages/api` depends on `packages/policy`, not the
reverse), and pulls in everything `createConnectorRegistry` transitively touches
(`@parmana/execution-gateway`, `@parmana/connector-sdk`, `@parmana/crypto`,
`@parmana/execution-control`) into `packages/policy`'s test dependency graph. It also means
GitHub/HubSpot credential-gated conditional registration (env-var dependent) now affects what a
`packages/policy` test asserts — the registered-capability set is genuinely different between
`NODE_ENV=test` and a real deployment with GitHub credentials configured, so the test would need
to force `NODE_ENV=test` explicitly to get a deterministic set, the same way
`create-connector-registry.test.ts` already has to.

**Revised effort estimate:** closer to 2–3 hours than the original 1-hour estimate, once the
constructor dependencies and env-sensitivity above are accounted for — not 5 minutes of import
plus a 30-minute test rewrite.

**Trade-offs:**

| | |
|---|---|
| Pro | Closes the specific divergence that caused G-30 — the coverage test would now fail immediately if a connector's capability isn't bound |
| Pro | No new package to create or version |
| Con | Adds a real dependency edge (`packages/policy` → `packages/api`) in the direction the current architecture doesn't have; `packages/policy` currently has zero workspace dependencies at all (checked: only `@supabase/supabase-js`, `express`, `vitest`) |
| Con | Test now depends on constructing the full production registry (credentials, session store, audit sink), which is meaningfully more test setup than today's plain map comparison |
| Con | Only closes the gap for *this one test* — the production map (`CANONICAL_CAPABILITY_POLICY_BINDINGS` itself) is still hand-written; a missing binding still ships to `main`, just gets caught by CI instead of silently passing |

---

## Option C — Shared `@parmana/capability-registry` package

**What this actually requires**, thought through past the prompt's package-tree sketch:

The two things currently out of sync are (1) *which capability identifiers exist* (currently:
string literals scattered across `GitHubCapabilities.ts`, `HubSpotCapabilities.ts`,
`CANONICAL_CAPABILITY_POLICY_BINDINGS`, and the coverage test) and (2) *which of those are
actually wired into the production registry*, which is inherently a runtime fact (credential
availability, `NODE_ENV`), not something a static shared package can fully capture on its own.
A shared package can cleanly solve (1) — both `packages/connector-github` and
`packages/connector-hubspot` already export capability-identifier constants
(`GITHUB_PR_FETCH_CAPABILITY` etc.); `CANONICAL_CAPABILITY_POLICY_BINDINGS` and the coverage
test could both import those constants instead of retyping the strings, removing one class of
typo-divergence. It does **not**, by itself, solve (2): `createConnectorRegistry.ts`'s
conditional registration (only registers GitHub if `GITHUB_APP_ID`/etc. are set) would still
need to be the thing that ultimately decides what's "actually reachable," and nothing about a
new package changes that unless `createConnectorRegistry.ts` itself is rewritten to iterate a
declarative list from the shared package rather than hand-calling `registrations.push(...)` per
connector as it does today.

**Realistic scope, if pursued:**
1. New `packages/capability-registry` package holding capability-identifier constants
   (re-exported, not duplicated, from what `connector-github`/`connector-hubspot` already
   define) and `CANONICAL_CAPABILITY_POLICY_BINDINGS` itself.
2. `packages/policy` depends on it (replacing its current in-package
   `CapabilityPolicyBinding.ts`); `packages/policy/src/index.ts`'s existing re-export means the
   ~10 downstream files that import via `@parmana/policy` (not the internal file path directly
   — confirmed: `RuntimeEngine.ts`, `RuntimeBuilder.ts`, `execute.ts`, and others all import
   from the package root) need **no changes at all**; only `packages/policy/src/index.ts`
   itself needs its re-export source updated.
3. `packages/api`'s connector-creation files (`createGitHubConnector.ts`,
   `createHubSpotConnector.ts`) import the same capability constants instead of whatever they
   use today, so there is exactly one place each capability identifier is spelled.
4. `createConnectorRegistry.ts`'s own registration logic is **not** changed by this pass unless
   explicitly scoped in — meaning the coverage-test divergence risk (a connector registered
   without its capability declared in the shared package) is reduced, not eliminated, by step 1
   alone. Fully eliminating it needs `createConnectorRegistry.ts` to be restructured around a
   declarative connector list, which is a larger, separate refactor than "create a package and
   move a file."

**Revised effort estimate:** the package scaffolding, moving the binding map, and updating the
one re-export point is genuinely close to the original 2-hour estimate. Fully closing the
runtime-registration side of the gap (step 4) is materially more — a full day, not part of this
estimate, and arguably its own decision rather than bundled into "Option C."

**Trade-offs:**

| | |
|---|---|
| Pro | Single place capability identifiers are defined; removes one real source of typo-level drift |
| Pro | `packages/policy` → `packages/api` coupling from Option B is avoided entirely |
| Pro | Downstream import churn is close to zero (re-export point absorbs it) |
| Con | New package to build, version, and maintain in the monorepo |
| Con | Does not, by itself, close the runtime-registration half of the gap (see step 4) — a connector could still be registered without updating the shared package, unless `createConnectorRegistry.ts` is separately restructured |
| Con | Larger surface change for a security-adjacent path right before a submission checkpoint |

---

## Decision Matrix

| Criterion | Option A | Option B | Option C |
|---|---|---|---|
| Time to implement | ~30 min (docs only) | ~2–3 hrs (revised) | ~2 hrs for scaffolding; step 4 (full closure) is a separate day-sized effort |
| New dependency edge | None | `packages/policy` → `packages/api` | None (new leaf package instead) |
| Closes identifier-typo drift | No | No (test-only check) | Yes |
| Closes runtime-registration drift | No | Yes, for the one test | No, unless step 4 is also done |
| Downstream import churn | None | None | Near-zero (one re-export point) |
| Code risk before a submission checkpoint | None | Low-moderate | Moderate |

---

## Recommendation

**Option A now — ship the security fix as already committed, document the root cause (this
document + the VERIFICATION-GAPS.md G-30 entry), and treat B vs. C as a scheduling decision, not
a today decision.**

Reasoning, precisely:

- The security-relevant part of G-30 — the missing policy binding — is already fixed and
  verified (`92d7aa6`, full suite green). Nothing about this decision reopens that.
- Between B and C: **C is the architecturally cleaner target if this gets built at all** — it
  avoids the backwards dependency edge B introduces and centralizes capability identifiers
  properly — but neither B nor C, as scoped above, fully eliminates the underlying risk (a
  connector registered without a matching binding) without also touching
  `createConnectorRegistry.ts`'s registration logic itself, which is a bigger, separate change
  than either estimate above includes.
- Given that, doing B now as a stopgap just to "do something" trades a real, if narrow,
  architectural regression (the backwards dependency) for a partial fix. If the real fix is
  wanted, it's worth scoping properly (including step 4) rather than doing a rushed version of
  it under time pressure.

This recommendation matches the original prompt's own conclusion (Option A now, revisit C
later) — reached independently here by working through what B and C actually require, not by
assuming the prompt's estimates were accurate.

**This is a recommendation, not a decision.** Proceeding with B or C instead is Pavan's call;
nothing here should be read as blocking either.
