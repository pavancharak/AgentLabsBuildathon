> **STATUS: DRAFTING AID FOR ATTORNEY REVIEW — NOT A FILED OR FILING-READY APPLICATION.**
> Written 2026-09-01, re-verified line-by-line against this repository's current source
> (`packages/shared/src/domain/pending-policy-change.ts`,
> `packages/shared/src/errors/same-actor-cannot-approve-own-change-error.ts`,
> `packages/api/src/routes/pending-policy-changes.ts`,
> `packages/api/src/bootstrap/createPolicyChangeStepUpVerifier.ts`,
> `packages/api/src/governance/verifyPolicyGovernanceIntegrityAtStartup.ts`,
> `packages/crypto/src/PolicyChangeCrypto.ts`, `packages/policy/src/PolicyEngine.ts`). Every file,
> class, method, and code path below was read directly from the working tree on that date. No
> patent attorney, patent agent, or prior-art search has reviewed this document. Do not submit
> this to the Indian Patent Office, the USPTO, or any other patent office in its current form.
> This document formalizes and supersedes the informal candidate claims in
> [`DRAFT-03-policy-change-maker-checker.md`](./DRAFT-03-policy-change-maker-checker.md) into
> patent-application structure; the underlying technical content is the same verified mechanism.
> See [`PATENT_FILING_REGISTER.md`](./PATENT_FILING_REGISTER.md) for real filing status.

# Patent Application (Draft) — Structural Separation-of-Duties Enforcement for Authorization-Policy Changes, with Deploy-Time Cryptographic Bypass Detection

## Title

Method and System for Structurally Enforced Maker-Checker Governance of an Automated-Execution
Authorization Policy, Combined with Deploy-Time Cryptographic Detection of Out-of-Band Policy
Modification

## Field of the Invention

[0001] This invention relates to governance of the authorization policy that itself controls
automated (including AI-agent-initiated) execution — specifically, to a mechanism that (a)
structurally prevents any single actor from both proposing and approving a change to that policy,
independent of the policy's own content, and (b) independently and cryptographically detects
whether the live policy in force was altered outside that governed approval workflow entirely,
including by a direct file or database write that bypasses the approval workflow's own API.

## Background

[0002] A system that evaluates automated execution requests against a policy document is only as
trustworthy as that policy document itself. If a single actor holds unilateral edit access to the
policy, execution-time enforcement is not a meaningful control: that actor can simply redefine
what "authorized" means, and every downstream enforcement mechanism will faithfully enforce the
new, potentially compromised, definition. Existing "maker-checker" or dual-control approval
workflows address this at the *application* layer — a proposal must pass through a distinct
approver before taking effect — but application-layer approval alone does not address a second,
subtler failure mode: if the underlying policy artifact (a file, a database row) can be modified
directly, outside the application that enforces the approval workflow, the approval workflow is
bypassed entirely and invisibly. Nothing in a conventional maker-checker UI or API detects that
the artifact it believes it is governing has, in fact, been altered by a different path.

[0003] What is needed is a governance mechanism that (a) enforces the maker-checker separation
structurally — at the code layer, independent of any policy-configurable rule that could itself be
weakened by exactly the kind of unilateral change being guarded against — and (b) independently,
at a point disconnected from the approval workflow's own request path (such as deploy or process
startup), cryptographically verifies that the artifact actually in force matches what the most
recent governed approval produced, surfacing any divergence as a detectable signal rather than
allowing it to pass unnoticed.

## Summary of the Invention

[0004] The invention (a) requires every proposed policy change to pass through a durable
pending-approval state naming a proposing actor; (b) structurally forbids the proposing actor from
also resolving (approving or rejecting) their own proposal, enforced at the API layer using the
caller's independently-verified identity rather than any value the request itself supplies; (c)
requires a distinct, separately-authenticated step-up verification for the resolving action
itself, independent of whatever session authenticated the resolver's earlier read access; and (d)
independently, at deploy or process-startup time, cryptographically hashes the live policy content
actually in force and compares it against the content hash recorded in the most recent governed
approval for that policy, surfacing — without blocking startup — any divergence indicating the
policy was altered outside the governed workflow.

## Detailed Description

### The governed artifact (`PendingPolicyChange`)

[0005] A `PendingPolicyChange` (`packages/shared/src/domain/pending-policy-change.ts`) holds the
full proposed policy content in its entirety — not a diff or patch — together with the proposer's
identity (`proposedBy`), a required free-text justification (`reason`), and a lifecycle `status`.
`proposedBy` must be a human-authenticated caller, a constraint enforced at the API layer before
the object is ever constructed, not by the type itself. The lifecycle vocabulary
(`PendingPolicyChangeStatus`) admits exactly three states — `PENDING_APPROVAL`, `APPROVED`,
`REJECTED` — and the resolving repository enforces that a transition occurs at most once, only out
of `PENDING_APPROVAL`, and never back into it: an approved or rejected change is a terminal,
immutable fact.

### Structural separation of duties (independent of policy content)

[0006] Before an approval or rejection is recorded, the resolving caller's own verified identity —
established by the caller-authentication layer that sits in front of the request, not by any field
the request body supplies — is compared against the proposal's `proposedBy`. A match raises
`SameActorCannotApproveOwnChangeError`
(`packages/shared/src/errors/same-actor-cannot-approve-own-change-error.ts`), enforced at both the
approve and reject handlers in `packages/api/src/routes/pending-policy-changes.ts`, before any
resolution is written. Because this check compares the *caller-authenticated* identity of the
resolving request against the *caller-authenticated* identity recorded at proposal time — neither
of which is itself part of the governed policy content — the check cannot be weakened by any
change to the policy the workflow governs; the separation-of-duties guarantee sits structurally
outside the artifact it protects.

### Step-up verification of the resolving action itself

[0007] Independent of whichever session authenticated the resolver's read access to the pending
change, the approve/reject action itself requires a distinct, separately-verified authorization —
a `stepUpAuthorization` validated by a dedicated `PolicyChangeStepUpVerifier`
(`packages/api/src/bootstrap/createPolicyChangeStepUpVerifier.ts`), backed by its own nonce store
(`createPolicyChangeStepUpNonceStore.ts`). This means the specific act of resolving a governed
policy change is authenticated as its own event, not merely authorized transitively because the
caller happened to already hold a valid general-purpose session.

### Deploy-time cryptographic bypass detection

[0008] `verifyPolicyGovernanceIntegrityAtStartup`
(`packages/api/src/governance/verifyPolicyGovernanceIntegrityAtStartup.ts`) runs independently of
the approval-request path described above, at deploy or process-startup time. For every distinct
`(policyName, policyVersion)` pair that has ever gone through the governed approval flow, it: (i)
loads the live policy content actually in force for that pair; (ii) hashes that live content via
`PolicyChangeCrypto.hashPolicyContent`, which routes through the same canonicalize-then-hash
procedure (`TrustRecordHasher`/`CanonicalSerializer`) used for every other cryptographic artifact
in the system; (iii) compares that hash against `contentHashAfter` of the most recently governed
approval record for the same pair; and (iv) reports a `"missing"` mismatch if no live content
exists at all for a pair that has an approval record, or a `"content-mismatch"` mismatch if live
content exists but its hash diverges from the recorded approval. Both mismatch classes indicate
the live artifact diverged from what the governed workflow of paragraphs [0005]–[0007] most
recently produced or expected — the signature of a policy edited outside the approval API
entirely, such as a direct filesystem or database write.

[0009] This check is deliberately fail-**open**: it never throws in a way that blocks process
startup, and a failure to even run the check (for example, because the approval-record store is
unreachable) is itself logged as a distinct, loud event
(`policy_governance_integrity_check_unavailable`) rather than silently treated as "no mismatches
found" — so that "nothing to report" and "the check itself could not run" are never
indistinguishable in operational logs. This is a deliberate departure from this system's
otherwise fail-*closed* configuration-validation discipline elsewhere: a governance-tooling
inconsistency here is treated as an operator-investigation signal, not a reason to take the
execution pipeline down.

### Structural separation from execution-time policy evaluation

[0010] The governance mechanism of paragraphs [0005]–[0009] governs *changes to* the policy
artifact. It is structurally distinct from, and connected only through the governed artifact
itself to, the *per-request evaluation* of that policy: `PolicyEngine.evaluate(policy, signals)`
(`packages/policy/src/PolicyEngine.ts`) deterministically evaluates the current policy against an
individual execution request's signals, using first-match rule semantics over a rule list, and is
explicitly documented (in the class's own governing comment) to never authorize execution, execute
business actions, access external systems, create trust records, perform replay, or generate
timestamps. The governance mechanism decides *what the rules are allowed to be*; `PolicyEngine`
decides, independently and at a different time, *what a specific request does under whatever rules
are currently in force*.

## Independent Claims (informal — for attorney refinement)

**Claim 1.** A computer-implemented method for governing changes to an authorization policy that
controls automated execution, comprising:

(a) receiving a proposed change to the policy, the proposal identifying a proposing actor by an
independently-authenticated identity and holding the proposal in a durable pending-approval state;

(b) receiving a request to resolve the proposal of step (a) as approved or rejected, the request
identifying a resolving actor by an independently-authenticated identity established by an
authentication layer external to the request's own content;

(c) comparing the resolving actor's identity of step (b) against the proposing actor's identity of
step (a), and rejecting the resolution request, without recording any approval or rejection, if
the two identities match; and

(d) responsive to the identities of step (c) not matching, requiring a distinct,
separately-verified authorization for the resolution action itself, independent of whatever prior
authentication authorized the resolving actor's access to the proposal, before recording a
terminal, non-reversible resolution of the proposal.

**Claim 2.** The method of claim 1, further comprising, at a time disconnected from the receipt of
steps (a)–(d): identifying every distinct governed policy for which a resolution has previously
been recorded; for each, computing a cryptographic hash of the content of that policy as currently
in force; comparing the computed hash against a cryptographic hash recorded at the time of the
most recent resolution of step (d) for that same policy; and reporting, without halting operation
of the system being governed, any policy for which the comparison of this step diverges — the
divergence indicating the policy in force was altered by a means other than steps (a)–(d).

**Claim 3.** The method of claim 1, wherein the same system that governs changes to the policy
under claim 1 separately, and at the time of each individual automated execution request,
deterministically evaluates that execution request against the then-currently-governed policy
using a rule-evaluation component that is structurally prevented, by its own implementation, from
authorizing execution, performing execution, or accessing any external system — such that
governance of the policy's content (claim 1) and per-request evaluation under that content (this
claim) are two structurally distinct mechanisms connected only by the governed policy artifact
itself.

## Dependent Claims (informal)

**Claim 4.** The method of claim 1, wherein the proposal of step (a) comprises the full proposed
policy content in its entirety, together with a required justification, rather than a diff or
patch against the current content.

**Claim 5.** The method of claim 1, wherein the terminal resolution of step (d) is enforced by a
repository component that permits a transition into the approved or rejected state at most once
per proposal and never permits a subsequent transition out of either terminal state.

**Claim 6.** The method of claim 2, wherein the reporting of a divergence distinguishes, in its
reported reason, between a case in which no live policy content exists at all for a previously
governed policy and a case in which live content exists but its hash does not match the recorded
value.

**Claim 7.** The method of claim 1, applied specifically to a policy that governs AI-agent-initiated
execution, wherein the proposing and resolving actors of steps (a)–(c) are human-authenticated and
the governed artifact is the machine-evaluated ruleset an autonomous agent's individual execution
requests are checked against under claim 3.

## What would need attorney/prior-art input before this is filing-ready

- Maker-checker / dual-control approval workflows are well-established prior art broadly in
  financial operations software; this is explicit non-novel background and not, by itself, a
  claimed element. The attorney will need to confirm the distinguishing elements are (a) the
  deploy-time cryptographic detection of out-of-band bypass entirely disconnected from the
  approval API (Claim 2), and (b) the structural pairing with a separately-implemented,
  provably execution-inert, execution-time policy-evaluation mechanism (Claim 3) — not the
  maker-checker concept itself, which is not novel.
- Whether Claim 3 is better prosecuted as part of this application or filed entirely separately
  from policy-*change* governance, since `PolicyEngine.evaluate()` is a general mechanism not
  intrinsically tied to how the policy it evaluates was authored or approved.
- Formal drawings: a state diagram of the `PendingPolicyChangeStatus` transitions of paragraph
  [0005], and a sequence diagram of the deploy-time integrity check of paragraph [0008].
- **Flagged for the founder's attention independent of this filing:**
  `docs/deep-tech/04-IP-PATENT-SUMMARY.md` separately assesses `packages/policy/src/SignalIntentBinder.ts`
  and `packages/capability-registry/src/CapabilityPolicyBinding.ts` — drafted as
  [`PATENT-4-signal-intent-and-capability-policy-binding.md`](./PATENT-4-signal-intent-and-capability-policy-binding.md)
  in this same batch — as the strongest patent candidate in the codebase, on the basis of a
  documented "found exploit → structural fix" narrative distinct from this application.

## Source Code Reference (verified against working tree on 2026-09-01)

- `packages/shared/src/domain/pending-policy-change.ts` — `PendingPolicyChange`,
  `PendingPolicyChangeStatus` (paragraph [0005]).
- `packages/shared/src/errors/same-actor-cannot-approve-own-change-error.ts` — separation-of-duties
  error (paragraph [0006]).
- `packages/api/src/routes/pending-policy-changes.ts` — API-layer enforcement of maker/checker
  identity comparison and step-up authorization requirement (paragraphs [0006]–[0007]; confirmed
  at both the approve and reject handlers).
- `packages/api/src/bootstrap/createPolicyChangeStepUpVerifier.ts`,
  `createPolicyChangeStepUpNonceStore.ts` — step-up verification composition (paragraph [0007]).
- `packages/api/src/governance/verifyPolicyGovernanceIntegrityAtStartup.ts` — deploy-time
  cryptographic integrity check, fail-open design, and dual mismatch-reason taxonomy (paragraphs
  [0008]–[0009]).
- `packages/crypto/src/PolicyChangeCrypto.ts` — `hashPolicyContent`, `sign`, `verify` over the
  canonical `PolicyChangeApprovalRecord` view (paragraph [0008]).
- `packages/policy/src/PolicyEngine.ts` — the structurally separate, execution-inert evaluation
  mechanism of Claim 3 (paragraph [0010]; the class's own governing comment lists the six things it
  "SHALL NOT" do, confirmed present in the current source).
