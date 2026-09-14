\# PATENT-4: Method and System for Structurally Binding Policy-Evaluated Signals and Capability Selection to Executed Actions

\*\*STATUS:\*\* Drafting aid for attorney review — NOT a filed or filing-ready application.

\*\*Written:\*\* September 1, 2026

\*\*Verified against:\*\* Source code line-by-line and documentation

\*\*Filing Status:\*\* Nothing filed yet. No patent attorney or prior-art search has reviewed this document. Do not submit to any patent office in current form.

\*\*PRIORITY NOTE:\*\* Repository's own assessment ranks this as the strongest patent candidate in the system, based on documented self-discovered vulnerability and structural fix. Consider filing this as highest priority if filing timeline permits.

\---

\## TITLE

Method and System for Preventing Declared-Action/Executed-Action Substitution in Automated Policy-Gated Execution by Structurally Binding Both Policy-Evaluated Signals and Capability Selection to the Action That Will Actually Execute

\---

\## FIELD OF THE INVENTION

\[0001] This invention relates to policy-gated authorization of automated execution, including but not limited to execution initiated by AI agents. Specifically, this invention relates to two structurally related mechanisms that close a class of vulnerability in which a request that is fully verified and approved \*as declared\* is used to execute a materially \*different\* action or is evaluated against a policy other than the one specifically designed to govern it.

\---

\## BACKGROUND OF THE INVENTION

\[0002] In a policy-gated execution architecture, a request typically declares: (a) an intended action or capability, (b) a set of signals or facts the policy evaluates, and (c) a reference to the specific policy that should govern it.

\[0003] A policy engine evaluates the declared signals against the declared policy and produces an approval or rejection. If approved, a separate execution component performs the action using separately-carried intent — the actual parameters and target of what will be executed.

\[0004] This architecture creates two related structural gaps, each independently discovered and independently fixed in this system's own development history:

\*\*Gap 1 — Signal/Intent Divergence:\*\* Nothing inherently guarantees that the signal values the policy evaluated are the same values that describe the action actually executed. A caller could declare a small, fully-verifiable, policy-approved action (small signal values, low risk) while carrying forward an intent that names a different target or different parameters. The policy approves what was \*declared\* while nothing checks that what was declared matches what will \*execute\*. For example, a caller could declare signal values consistent with a low-value transaction while the intent that will actually execute names a materially different, higher-value target.

\*\*Gap 2 — Capability/Policy Substitution:\*\* Independently, nothing inherently guarantees that a given capability (a specific executable action type, e.g., "update a CRM deal record") is evaluated against the \*specific\* policy purpose-built to protect it. A caller could pair a real, sensitive capability with an unrelated, less-restrictive policy, have that unrelated policy's own looser rules evaluated against self-declared signals, and have the real, sensitive capability's actual parameters executed, bypassing its intended protections entirely. Nothing upstream of capability dispatch enforces that a specific capability can only be evaluated under its one designated policy.

\[0005] Both gaps share a common structural signature: an approval is obtained against a \*declared\* value (a signal set, a policy reference) that is not structurally forced to correspond to the value that will actually govern or describe execution.

\[0006] Conventional access-control and role-based schemes that check "is this caller allowed to invoke this class of action" do not address either gap, because both gaps exist even when the caller is fully entitled to invoke the action class in question. The vulnerability is in the correspondence between what was checked and what will run, not in whether the checking itself was authorized.

\---

\## SUMMARY OF THE INVENTION

\[0007] The invention comprises two structurally related, independently applicable binding mechanisms, each inserted into the request path \*before\* policy evaluation or capability dispatch occurs. Each acts only on the two specific values it is given rather than evaluating policy rules or performing execution itself.

\*\*Mechanism A (Signal/Intent Binder):\*\* A policy declares an explicit set of dot-path bindings, each naming a signal key and the corresponding path into the Intent structure that signal must equal. Before policy evaluation, every declared binding is checked: the signal value actually being evaluated must strictly equal the value found at its declared path in the Intent that will actually be executed if the request is approved. Any mismatch is reported as a named violation, closing Gap 1 without the policy engine itself needing to know anything about intent structure.

\*\*Mechanism B (Capability/Policy Binder):\*\* A single authoritative table maps each production capability to the one policy canonically designated to govern it. Before a declared policy reference is used to select which policy file to load and evaluate, the declared reference is checked against this table for the capability in question. A capability present in the table whose declared policy reference does not match the canonical entry is rejected before any policy file is even loaded, closing Gap 2 by making the capability-to-policy pairing a structural invariant.

\---

\## DETAILED DESCRIPTION OF THE INVENTION

\### Mechanism A: Signal/Intent Binder

\[0008] `SignalIntentBinder.findViolations(policy, signals, intent)` reads a policy's `boundSignals` map — an object whose keys are signal names and whose values are dot-paths into an `IntentSnapshot` (comprising, at minimum, `target` and `parameters`).

\[0009] For each declared binding, the binder:

(a) Resolves the corresponding path against the intent via a null-safe recursive path-walker (`resolveIntentPath`) that returns `undefined` for any missing segment rather than throwing.

(b) Treats an absent intent field as a reportable mismatch rather than a crash, since `undefined` almost never legitimately equals a declared signal value.

(c) Compares the signal's actual value, by strict equality, against the resolved intent value.

(d) Collects every mismatch as a `SignalIntentBindingViolation` naming the signal key, the intent path, and both values.

\[0010] An empty result means either the policy declares no bindings at all, or every declared binding held.

\[0011] The binder's own governing documentation states it is run "before `PolicyEngine.evaluate`, over the exact signals `PolicyEngine` would otherwise evaluate and the exact Intent that \[the execution component] will sign and execute if the transaction is approved." This means the comparison is not against a copy or a summary of the intent, but the literal structure that becomes the executed action.

\[0012] The class is deliberately scoped, by its own documentation, to never "evaluate policy rules, execute actions, or access anything beyond the two values it is given" — the same evaluation-only discipline `PolicyEngine` itself follows.

\### Mechanism B: Capability/Policy Binder

\[0013] `CANONICAL\_CAPABILITY\_POLICY\_BINDINGS` is a single, authoritative `Map<string, PolicyReference>` from a capability's action identifier (e.g., `hubspot:deal-update`) to the exactly one `{name, version, schemaVersion}` policy reference that governs it.

\[0014] The map is populated only for capabilities actually registered in production bootstrap and paired with the one policy file purpose-built to authorize each.

\[0015] The class's governing documentation states the vulnerability it closes directly: "`PolicyRouter`/`FilePolicyRepository` load whatever `policy.name`/`policy.version` the caller declares. `PolicyEngine.evaluate` takes no `action` parameter at all. \[The default connector policy] checks only that the resolved connector declares the capability, never which policy authorized it. A caller could therefore pair a real capability with an unrelated, unprotected policy that has no `boundSignals` for it, evaluate that policy's own (looser) rules against self-declared signals, and have the real, unrelated `intent.parameters` executed — bypassing the capability's intended protections entirely."

\[0016] `CapabilityPolicyBinder.findViolation(action, declared)` operates as follows:

(a) Look up `action` in the canonical table.

(b) If the action has no canonical entry, report no violation and allow caller-declared policy selection to proceed unchanged for that action.

(c) The mechanism is additive and does not alter behavior for capabilities not yet given a canonical binding.

(d) If an entry exists, compare the declared policy reference's `name` and `version` against the canonical entry.

(e) Both must match exactly, or return a `CapabilityPolicyBindingViolation` naming the action, the expected reference, and the declared reference.

\[0017] This rejection occurs "before a policy file is even evaluated against it," meaning the substitution attempt of Gap 2 never reaches the point of being evaluated under the wrong, weaker policy at all.

\### Why the Two Mechanisms Are One Invention

\[0018] Mechanisms A and B address structurally parallel instances of the same underlying defect — an approval obtained against a declared value that is not forced to correspond to what will actually govern or describe execution — at two different points in the same request path:

(a) Mechanism A binds the \*evaluated signals\* to the \*executed intent\*.

(b) Mechanism B binds the \*declared policy\* to the \*invoked capability\*.

\[0019] Each is independently applicable (a system could adopt one without the other), but together they close the full class:

(a) Mechanism A prevents "approved-as-declared, executed-as-different" within a single, correctly-selected policy.

(b) Mechanism B prevents the correctly-selected policy itself from being swapped for a weaker one in the first place.

\[0020] Both share the identical implementation discipline: a small, side-effect-free, execution-inert comparator invoked strictly \*before\* the mechanism it protects (policy evaluation for A, policy-file loading for B) is allowed to proceed.

\[0021] This is a distinguishing structural property relative to access-control schemes that check authorization only once, upstream of both gaps.

\---

\## CLAIMS

\### Independent Claims

\*\*Claim 1 (Signal/Intent Binding Claim):\*\* A computer-implemented method for preventing a declared action from diverging from an executed action in a policy-gated automated execution system, comprising:

(a) receiving a policy that declares a plurality of bindings, each binding associating a named signal to a dot-path within a structure describing the action that will be executed if the request is approved;

(b) receiving a set of signal values that a policy-evaluation component will evaluate against the policy of step (a), and receiving the structure describing the action that will actually be executed if the request is approved;

(c) for each binding declared in step (a), resolving the value at the binding's declared path within the structure of step (b), and comparing that resolved value against the corresponding signal value of step (b); and

(d) reporting, for each comparison of step (c) that does not match, a named violation identifying the binding, the signal value, and the resolved value, prior to any evaluation of the policy of step (a) by the policy-evaluation component,

such that a signal value evaluated by the policy-evaluation component is verified to correspond to the value that will actually describe the executed action, before that evaluation occurs.

\*\*Claim 2 (Capability/Policy Binding Claim):\*\* A computer-implemented method for preventing a governed capability from being evaluated under a policy other than the one designated to govern it, comprising:

(a) maintaining an authoritative mapping from each of a plurality of capability identifiers to a single, respectively-designated policy reference for that capability;

(b) receiving a request identifying a capability identifier and a declared policy reference to be used for evaluating that request;

(c) determining whether the capability identifier of step (b) is present in the mapping of step (a); and

(d) responsive to the capability identifier being present in the mapping, comparing the declared policy reference of step (b) against the mapping's designated policy reference for that capability, and rejecting the request, prior to any loading or evaluation of a policy file corresponding to the declared policy reference, if the two do not match,

such that a capability having a designated policy under step (a) cannot be evaluated under a substituted, non-designated policy reference.

\*\*Claim 3 (Combined Mechanisms Claim):\*\* A system comprising both the method of Claim 1 and the method of Claim 2, applied to the same automated execution request in sequence, such that a request is first checked under Claim 2 — if its declared policy reference does not match the capability's designated policy, the request is rejected before any policy evaluation occurs — and only if the request passes Claim 2 is it further checked under Claim 1 for correspondence between the signals to be evaluated and the action to be executed under whichever policy Claim 2 confirmed was correctly designated.

\### Dependent Claims

\*\*Claim 4:\*\* The method of Claim 1, wherein resolving the value at a declared path within the structure of step (b) returns an absent-value indication, rather than raising an error, when any segment of the path is not present within the structure, and wherein such an absent-value indication is treated as a mismatch for the purpose of step (d) rather than suppressing the comparison.

\*\*Claim 5:\*\* The method of Claim 1, wherein the comparisons of step (c) use strict equality between the signal value and the resolved path value, and an empty result of no reported violations for a given policy indicates either that the policy of step (a) declares no bindings, or that every declared binding's comparison matched.

\*\*Claim 6:\*\* The method of Claim 1, wherein the component performing steps (a)–(d) is prevented, by its own implementation, from evaluating any rule of the policy of step (a), executing any action, or accessing any value beyond the signal values and structure of step (b).

\*\*Claim 7:\*\* The method of Claim 2, wherein a capability identifier absent from the mapping of step (a) is unaffected by steps (c)–(d), such that the method of Claim 2 applies additively to a subset of capabilities without altering handling of capabilities outside that subset.

\*\*Claim 8:\*\* The method of Claim 2, wherein the mapping of step (a) is configured at system initialization time, populated from a canonical registry of production capabilities and their designated policies, and remains immutable throughout process runtime.

\*\*Claim 9:\*\* The method of Claim 1 or Claim 2, wherein the automated execution request originates from an artificial-intelligence agent, and the method is applied to prevent the agent's declared, policy-approved action from being executed as a materially different action, or evaluated under a materially different and less restrictive policy, than the one actually approved.

\*\*Claim 10:\*\* The method of Claim 1, wherein the policy declaring bindings in step (a) is evaluated by a structurally separate policy-evaluation component that takes no action or capability parameter and performs no execution itself, such that the policy engine is unaware of the intent structure and bindings are verified independently of policy evaluation.

\*\*Claim 11:\*\* The method of Claim 1 or Claim 2, wherein the checks of steps (c)–(d) are performed on every execution request independent of the caller's identity or prior authorizations, such that even a fully-authorized caller cannot substitute a declared action for an executed one or pair a capability with a non-designated policy.

\*\*Claim 12:\*\* The method of Claim 1, wherein the dot-path bindings declared in step (a) map signal names to nested paths within the intent structure, allowing a single policy to bind multiple signals to different fields within the same intent, or to deeply nested fields accessible by path traversal.

\---

\## ATTORNEY REVIEW REQUIRED

1\. \*\*Prior-art search:\*\* CSRF token binding, RBAC resource-type scoping, capability-delegation systems (OCAP, object-capability model), parameter validation in automated APIs.

2\. \*\*Novelty clarification:\*\* The attorney must confirm the specific novelty is the \*pre-evaluation, execution-inert comparator pattern applied to policy-gated AI-agent execution specifically\*, not the general concept of binding a declared value to an enforced one.

3\. \*\*Claim independence:\*\* Determine whether Claims 1 and 2 should be kept as independent claims, merged into a single unified claim, or filed as separate applications.

4\. \*\*Vulnerability narrative:\*\* The repository's own assessment documents this as the strongest candidate because it has a real, self-discovered vulnerability narrative. The attorney should be given that narrative directly — it materially strengthens a non-obviousness argument.

5\. \*\*Formal drawings:\*\* Request-path sequence diagram, component diagram, state diagram showing two-stage checking process.

6\. \*\*Relationship to PATENT-1, PATENT-2, PATENT-3:\*\* Clarify whether this patent is independent, foundational, or part of a divisional/continuation strategy.

7\. \*\*International filing strategy:\*\* India only or PCT/US/EU? Repository assessment recommends filing this first if timing permits.

\---

\## SOURCE CODE REFERENCE (Verified Against Working Tree, September 1, 2026)

\*\*File: `packages/policy/src/SignalIntentBinder.ts`\*\*

\- Class `SignalIntentBinder`

\- Method `findViolations(policy, signals, intent)`

\- Method `resolveIntentPath(intent, path)` — null-safe recursive path walker

\- Class `SignalIntentBindingViolation`

\- Governing documentation confirming run point and scope limits

\*\*File: `packages/capability-registry/src/CapabilityPolicyBinding.ts`\*\*

\- Constant `CANONICAL\_CAPABILITY\_POLICY\_BINDINGS`

\- Class `CapabilityPolicyBinder`

\- Method `findViolation(action, declared)`

\- Class `CapabilityPolicyBindingViolation`

\*\*File: `packages/capability-registry/tests/unit/CapabilityPolicyBinder.test.ts`\*\*

\- Unit test coverage of Mechanism B

\*\*File: `docs/deep-tech/01-INNOVATION-NARRATIVE.md`\*\*

\- Documented discovery-and-fix narrative for Mechanism A

\*\*File: `docs/deep-tech/04-IP-PATENT-SUMMARY.md`\*\*

\- Repository's own assessment ranking this as strongest patent candidate

\*\*File: `packages/policy/src/PolicyEngine.ts`\*\*

\- Structurally execution-inert confirmation

\---

\## CONCLUSION

This patent describes two structurally related mechanisms for closing a real vulnerability class in policy-gated execution where a request approved \*as declared\* executes \*differently\* (with different intent values or under a different policy).

The novelty lies in the specific composition: a pre-evaluation, side-effect-free, execution-inert binding check for each gap, occurring strictly before the mechanisms they protect, making the correspondence between declared and executed values a structural invariant.

The fact that this system's own developers discovered and fixed a real instance of these gaps independently is strong evidence that the gaps are non-obvious and the fixes are non-trivial.

\*\*Status:\*\* Complete draft. Ready for attorney review. Not filing-ready. \*\*Recommended as highest-priority filing candidate if provisional application timing permits.\*\*
