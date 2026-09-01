> **STATUS: DRAFTING AID FOR ATTORNEY REVIEW — NOT A FILED OR FILING-READY APPLICATION.**
> Written 2026-09-01, drafted for the first time in this session directly from this repository's
> current source (`packages/policy/src/SignalIntentBinder.ts`,
> `packages/capability-registry/src/CapabilityPolicyBinding.ts`,
> `packages/capability-registry/tests/unit/CapabilityPolicyBinder.test.ts`) and its documented
> discovery narrative (`docs/deep-tech/01-INNOVATION-NARRATIVE.md`,
> `docs/deep-tech/04-IP-PATENT-SUMMARY.md`). This is "Candidate D" from
> [`PATENT_FILING_REGISTER.md`](./PATENT_FILING_REGISTER.md) ("Signal/Intent Binding — candidate,
> not yet drafted") and the mechanism `04-IP-PATENT-SUMMARY.md` independently assessed as "the
> single strongest patent candidate in this codebase," now drafted as its own application rather
> than left undrafted. No patent attorney, patent agent, or prior-art search has reviewed this
> document. Do not submit this to the Indian Patent Office, the USPTO, or any other patent office
> in its current form. See [`PATENT_FILING_REGISTER.md`](./PATENT_FILING_REGISTER.md) for real
> filing status (currently: nothing filed, nothing attorney-reviewed) — this document should be
> added to that register as Candidate D once reviewed.

# Patent Application (Draft) — Method and System for Structurally Binding Policy-Evaluation Signals and Capability Selection to the Literal Executed Action

## Title

Method and System for Preventing Declared-Action / Executed-Action Substitution in Automated
Policy-Gated Execution, by Structurally Binding Both the Evaluated Signals and the Governing
Policy Reference to the Action That Will Actually Execute

## Field of the Invention

[0001] This invention relates to policy-gated authorization of automated execution — including but
not limited to execution initiated by an AI agent — and specifically to two structurally related
mechanisms that close a class of vulnerability in which a request that is fully verified and
approved *as declared* is used to execute a materially *different* action or is evaluated against
a policy other than the one specifically designed to govern it.

## Background

[0002] In a policy-gated execution architecture, a request typically declares (a) an intended
action or capability, (b) a set of signals or facts the policy evaluates, and (c) a reference to
the specific policy that should govern it. A policy engine evaluates the declared signals against
the declared policy and produces an approval or rejection; if approved, a separate execution
component performs the action using a separately-carried "intent" — the actual parameters and
target of what will be executed.

[0003] This creates two related structural gaps, each independently discovered and independently
fixed in this system's own development history (`docs/deep-tech/01-INNOVATION-NARRATIVE.md`):

[0004] **Gap 1 — Signal/Intent divergence.** Nothing inherently guarantees that the signal values
the policy evaluated are the same values that describe the action actually executed. A caller
could declare a small, fully-verifiable, policy-approved action (small signal values, low risk)
while the intent actually carried forward to execution names a different target or different
parameters — for example, declaring a signal set consistent with a low-value transaction while the
intent that will actually execute names a materially different, higher-value target. The policy
approved what was *declared*; nothing checked that what was declared matches what will *execute*.

[0005] **Gap 2 — Capability/policy substitution.** Independently, nothing inherently guarantees
that a given capability (a specific executable action type, e.g., "update a CRM deal record") is
evaluated against the *specific* policy purpose-built to protect it. A caller could pair a real,
sensitive capability with an unrelated, less-restrictive policy that declares no protective
bindings for that capability at all, have that unrelated policy's own (looser) rules evaluated
against self-declared signals, and have the real, sensitive capability's actual parameters executed
— bypassing the capability's intended protections entirely rather than merely weakening them.
Nothing upstream of capability dispatch enforces that a specific capability can only be evaluated
under its one designated policy.

[0006] Both gaps share a common structural signature: an approval is obtained against a *declared*
value (a signal set, a policy reference) that is not structurally forced to correspond to the
value that will actually govern or describe execution. Access-control and role-based schemes that
check "is this caller allowed to invoke this class of action" do not address either gap, because
both gaps exist even when the caller is fully entitled to invoke the action class in question — the
vulnerability is in the correspondence between what was checked and what will run, not in whether
the checking itself was authorized.

## Summary of the Invention

[0007] The invention comprises two structurally related, independently applicable binding
mechanisms, each inserted into the request path *before* policy evaluation or capability dispatch
occurs, and each acting only on the two specific values it is given rather than evaluating policy
rules or performing execution itself:

[0008] **Mechanism A (Signal/Intent Binder).** A policy declares an explicit set of dot-path
bindings, each naming a signal key and the corresponding path into the Intent structure that
signal must equal. Before policy evaluation, every declared binding is checked: the signal value
actually being evaluated must strictly equal the value found at its declared path in the Intent
that will actually be executed if the request is approved. Any mismatch is reported as a named
violation, over the exact signals the policy engine would otherwise evaluate and the exact intent
the execution component will sign and execute — closing Gap 1 without the policy engine itself
needing to know anything about intent structure.

[0009] **Mechanism B (Capability/Policy Binder).** A single authoritative table maps each
production capability to the one policy canonically designated to govern it. Before a declared
policy reference is used to select which policy file to load and evaluate, the declared reference
is checked against this table for the capability in question; a capability present in the table
whose declared policy reference does not match the canonical entry is rejected before any policy
file is even loaded — closing Gap 2 by making the capability-to-policy pairing a structural
invariant rather than a caller-declared, and therefore caller-substitutable, choice.

## Detailed Description

### Mechanism A — Signal/Intent Binder

[0010] `SignalIntentBinder.findViolations(policy, signals, intent)`
(`packages/policy/src/SignalIntentBinder.ts`) reads a policy's `boundSignals` map — an object whose
keys are signal names and whose values are dot-paths into an `IntentSnapshot` (comprising, at
minimum, `target` and `parameters`). For each declared binding, it resolves the corresponding path
against the intent via a null-safe recursive path-walker (`resolveIntentPath`) that returns
`undefined` for any missing segment rather than throwing — treating an absent intent field as a
reportable mismatch rather than a crash, since `undefined` almost never legitimately equals a
declared signal value. It then compares the signal's actual value, by strict equality, against the
resolved intent value, collecting every mismatch as a `SignalIntentBindingViolation` naming the
signal key, the intent path, and both values. An empty result means either the policy declares no
bindings at all, or every declared binding held.

[0011] The binder's own governing documentation states it is run "before `PolicyEngine.evaluate`,
over the exact signals `PolicyEngine` would otherwise evaluate and the exact Intent that
[the execution component] will sign and execute if the transaction is approved" — meaning the
comparison is not against a copy or a summary of the intent, but the literal structure that
becomes the executed action. The class is deliberately scoped, by its own documentation, to
"evaluate policy rules, execute actions, or access anything beyond the two values it is given" —
the same evaluation-only discipline `PolicyEngine` itself follows (see Patent Application 3 of
this batch, paragraph [0010]).

### Mechanism B — Capability/Policy Binder

[0012] `CANONICAL_CAPABILITY_POLICY_BINDINGS`
(`packages/capability-registry/src/CapabilityPolicyBinding.ts`) is a single, authoritative
`Map<string, PolicyReference>` from a capability's action identifier (e.g. `hubspot:deal-update`)
to the exactly one `{name, version, schemaVersion}` policy reference that governs it — populated
only for capabilities actually registered in production bootstrap and paired with the one policy
file purpose-built to authorize each. The class's own governing documentation states the
vulnerability it closes directly: "`PolicyRouter`/`FilePolicyRepository` load whatever
`policy.name`/`policy.version` the caller declares, `PolicyEngine.evaluate` takes no `action`
parameter at all, and [the default connector policy] checks only that the resolved connector
declares the capability, never which policy authorized it" — meaning, absent this binder, "a
caller could... pair a real capability... with an unrelated, unprotected policy that has no
`boundSignals` for it, evaluate that policy's own (looser) rules against self-declared signals, and
have the real, unrelated `intent.parameters` executed — bypassing the capability's intended
protections entirely, not merely weakening them."

[0013] `CapabilityPolicyBinder.findViolation(action, declared)` looks up `action` in the canonical
table; if the action has no canonical entry, the binder reports no violation and caller-declared
policy selection proceeds unchanged for that action — the mechanism is additive and does not alter
behavior for capabilities not yet given a canonical binding. If an entry exists, the declared
policy reference's `name` and `version` must both match the canonical entry exactly, or a
`CapabilityPolicyBindingViolation` is returned naming the action, the expected reference, and the
declared reference — and, per the class's governing documentation, this rejection occurs "before a
policy file is even evaluated against it," meaning the substitution attempt of Gap 2 never reaches
the point of being evaluated under the wrong, weaker policy at all.

### Why the two mechanisms are one invention

[0014] Mechanisms A and B address structurally parallel instances of the same underlying defect —
an approval obtained against a declared value that is not forced to correspond to what will
actually govern or describe execution — at two different points in the same request path: A binds
the *evaluated signals* to the *executed intent*; B binds the *declared policy* to the *invoked
capability*. Each is independently applicable (a system could adopt one without the other), but
together they close the full class: A prevents "approved-as-declared, executed-as-different"
within a single, correctly-selected policy; B prevents the correctly-selected policy itself from
being swapped for a weaker one in the first place. Both share the identical implementation
discipline — a small, side-effect-free, execution-inert comparator invoked strictly *before* the
mechanism it protects (policy evaluation for A, policy-file loading for B) is allowed to proceed —
which is itself a distinguishing structural property relative to access-control schemes that check
authorization only once, upstream of both.

## Independent Claims (informal — for attorney refinement)

**Claim 1.** A computer-implemented method for preventing a declared action from diverging from an
executed action in a policy-gated automated execution system, comprising:

(a) receiving a policy that declares a plurality of bindings, each binding associating a named
signal to a path within a structure describing the action that will be executed if the request is
approved;

(b) receiving a set of signal values that a policy-evaluation component will evaluate against the
policy of step (a), and receiving the structure describing the action that will actually be
executed if the request is approved;

(c) for each binding declared in step (a), resolving the value at the binding's declared path
within the structure of step (b), and comparing that resolved value against the corresponding
signal value of step (b); and

(d) reporting, for each comparison of step (c) that does not match, a named violation identifying
the binding, the signal value, and the resolved value, prior to any evaluation of the policy of
step (a) by the policy-evaluation component,

such that a signal value evaluated by the policy-evaluation component is verified to correspond to
the value that will actually describe the executed action, before that evaluation occurs.

**Claim 2.** The method of claim 1, wherein resolving the value at a declared path within the
structure of step (b) returns an absent-value indication, rather than raising an error, when any
segment of the path is not present within the structure, and wherein such an absent-value
indication is treated as a mismatch for the purpose of step (d) rather than suppressing the
comparison.

**Claim 3.** A computer-implemented method for preventing a governed capability from being
evaluated under a policy other than the one designated to govern it, comprising:

(a) maintaining an authoritative mapping from each of a plurality of capability identifiers to a
single, respectively-designated policy reference for that capability;

(b) receiving a request identifying a capability identifier and a declared policy reference to be
used for evaluating that request;

(c) determining whether the capability identifier of step (b) is present in the mapping of step
(a); and

(d) responsive to the capability identifier being present in the mapping, comparing the declared
policy reference of step (b) against the mapping's designated policy reference for that
capability, and rejecting the request, prior to any loading or evaluation of a policy file
corresponding to the declared policy reference, if the two do not match,

such that a capability having a designated policy under step (a) cannot be evaluated under a
substituted, non-designated policy reference.

**Claim 4.** The method of claim 3, wherein a capability identifier absent from the mapping of step
(a) is unaffected by steps (c)–(d), such that the method of claim 3 applies additively to a subset
of capabilities without altering handling of capabilities outside that subset.

## Dependent Claims (informal)

**Claim 5.** The method of claim 1, wherein the comparisons of step (c) use strict equality between
the signal value and the resolved path value, and an empty result of no reported violations for a
given policy indicates either that the policy of step (a) declares no bindings, or that every
declared binding's comparison matched.

**Claim 6.** The method of claim 1, wherein the component performing steps (a)–(d) is prevented, by
its own implementation, from evaluating any rule of the policy of step (a), executing any action,
or accessing any value beyond the signal values and structure of step (b).

**Claim 7.** A system comprising both the method of claim 1 and the method of claim 3, applied to
the same automated execution request in sequence, such that a request is rejected under claim 3 if
its declared policy reference does not match the capability's designated policy, and, only if it
passes claim 3, is further checked under claim 1 for correspondence between the signals to be
evaluated and the action to be executed under whichever policy claim 3 confirmed was correctly
designated.

**Claim 8.** The method of claim 1 or claim 3, wherein the automated execution request originates
from an artificial-intelligence agent, and the method is applied to prevent the agent's declared,
policy-approved action from being executed as a materially different action, or evaluated under a
materially different and less restrictive policy, than the one actually approved.

## What would need attorney/prior-art input before this is filing-ready

- This is, per this repository's own internal assessment (`docs/deep-tech/04-IP-PATENT-SUMMARY.md`),
  the strongest candidate in the batch specifically because it has a documented "a real,
  self-discovered and self-fixed vulnerability" narrative
  (`docs/deep-tech/01-INNOVATION-NARRATIVE.md`) rather than a defensively-designed-in-the-abstract
  mechanism — the attorney should be given that narrative directly, as it materially strengthens a
  non-obviousness argument (the gap was not hypothesized in advance; it was found in a working
  system and required a structural fix, which is evidence the gap was not obvious to the system's
  own designers until it manifested).
- Whether Mechanisms A and B should be filed as one application (as drafted here, Claims 1–8) or
  split into two, since each is independently applicable without the other (see paragraph [0014]).
  The register (`PATENT_FILING_REGISTER.md`) lists this as a single "Candidate D"; splitting is a
  prosecution-strategy decision for counsel, not a technical one.
- Binding a declared value to an executed value, and binding a resource type to a designated
  policy, both have analogues in other domains (e.g., CSRF token binding, RBAC resource-type
  scoping) — the attorney will need to confirm the specific novelty is the *pre-evaluation,
  execution-inert comparator pattern applied to policy-gated AI-agent execution specifically*,
  not the general concept of binding a declared value to an enforced one.
- Formal drawings: a request-path sequence diagram showing where Mechanism A and Mechanism B each
  intercept the request relative to `PolicyEngine.evaluate` and policy-file loading.
- Confirm with the founder whether this should be filed as "Candidate D" in
  `PATENT_FILING_REGISTER.md` and prioritized ahead of, or alongside, Patents 1–3 in this batch,
  consistent with `docs/deep-tech/04-IP-PATENT-SUMMARY.md`'s recommendation to prioritize this
  mechanism if any provisional filing is feasible on a near-term timeline.

## Source Code Reference (verified against working tree on 2026-09-01)

- `packages/policy/src/SignalIntentBinder.ts` — `SignalIntentBinder.findViolations`,
  `IntentSnapshot`, `SignalIntentBindingViolation`, `resolveIntentPath` (paragraphs [0010]–[0011]).
- `packages/capability-registry/src/CapabilityPolicyBinding.ts` —
  `CANONICAL_CAPABILITY_POLICY_BINDINGS`, `CapabilityPolicyBinder.findViolation`,
  `CapabilityPolicyBindingViolation` (paragraphs [0012]–[0013]).
- `packages/capability-registry/tests/unit/CapabilityPolicyBinder.test.ts` — unit coverage of
  Mechanism B.
- `docs/deep-tech/01-INNOVATION-NARRATIVE.md` — the documented discovery-and-fix narrative for
  Mechanism A, cited as corroborating provenance evidence, not independently re-verified against a
  raw incident log (none was located in this repository under that description).
- `docs/deep-tech/04-IP-PATENT-SUMMARY.md` — this repository's own prior assessment ranking this
  mechanism as the strongest patent candidate, and the source of "Candidate D" in
  `PATENT_FILING_REGISTER.md`.
- `packages/policy/src/PolicyEngine.ts` — confirmed, per Patent Application 3 of this batch, to
  take no `action` parameter and to be structurally execution-inert, corroborating paragraph
  [0012]'s quoted rationale for why Mechanism B is needed at all.
