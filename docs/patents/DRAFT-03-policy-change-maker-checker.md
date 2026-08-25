> **STATUS: DRAFTING AID FOR ATTORNEY REVIEW — NOT A FILED OR FILING-READY APPLICATION.**
> Written 2026-08-25 directly from this repository's actual source code (cited throughout). No
> patent attorney, patent agent, or prior-art search has reviewed this document. Do not submit
> this to the Indian Patent Office or any other patent office in its current form. See
> [`PATENT_FILING_MASTER_PROMPT.md`](./PATENT_FILING_MASTER_PROMPT.md) for why this exists —
> the original prompt cited `packages/api/src/policies/policyEngine.ts` as the complete,
> ready-to-file source for this patent; that file does not exist anywhere in this repository.
> This draft is grounded in the real mechanism instead, which is stronger and more specific than
> the original prompt's generic "maker-checker" description.

# Provisional Patent Specification (Draft) — Structural Separation-of-Duties Enforcement for Policy Changes, with Cryptographic Deploy-Time Integrity Verification

## Field

Systems and methods for governing changes to the authorization policy that itself controls
automated (including AI-agent-initiated) execution — specifically, enforcing that no single actor
can both propose and approve a change to that policy, and cryptographically detecting if a policy
was altered outside the governed approval workflow.

## Background / Problem

A system that evaluates automated execution requests against a policy (see
`packages/policy/src/PolicyEngine.ts`, which evaluates each request deterministically at
execution time — the "why not config-time" distinction the original patent-management prompt
referenced) is only as trustworthy as the *policy document itself*. If any single actor can edit
that policy unilaterally, then execution-time enforcement is not a real control — the actor with
edit access to the policy can simply change what "authorized" means. This is a distinct problem
from *transaction*-level authorization (already the subject of the two other patent candidates in
this batch); it is authorization of the *rules themselves*.

A further, subtler failure mode: even if an approval workflow exists at the application layer, if
the underlying policy file can be edited directly (e.g., a direct filesystem or database write
outside the application), the approval workflow is bypassed entirely and invisibly.

## Summary of the Invention

The invention (a) requires every proposed policy change to pass through a durable
`PENDING_APPROVAL` state naming a proposer ("maker"); (b) structurally forbids the proposer from
also being the resolver ("checker") of their own proposed change, enforced at the API layer
before any approval record is created; (c) requires a distinct step-up verification for the
resolving action itself (Layer 4, described below); and (d) independently, at deploy/startup
time, cryptographically verifies that the live policy content actually in force matches the
content hash recorded in the most recent approval record for that policy — detecting the "policy
edited outside the approval workflow entirely" bypass described above, without blocking startup
on a detected mismatch (a deliberate fail-open/loud-alert design, distinct from this system's
fail-closed configuration-validation behavior elsewhere).

## Detailed Description

1. **Proposal (maker).** A `PendingPolicyChange` (`packages/shared/src/domain/pending-policy-change.ts`)
   is created holding the full proposed policy content (not a diff), the proposer's identity
   (`proposedBy`), a required free-text `reason`, and status `PENDING_APPROVAL`. `proposedBy` must
   be a human-authenticated caller, enforced at the API layer before construction.
2. **Structural separation of duties.** The resolving caller's identity is checked against
   `proposedBy` before an approval or rejection can be recorded; a match raises
   `SameActorCannotApproveOwnChangeError`
   (`packages/shared/src/errors/same-actor-cannot-approve-own-change-error.ts`), enforced in
   `packages/api/src/routes/pending-policy-changes.ts`. This is a structural (code-level)
   guarantee, not a policy-configurable rule that could itself be weakened by a policy change.
3. **Step-up verification of the approval action itself** ("Layer 4" per
   `createPolicyChangeStepUpVerifier.ts`'s own comment): the approve/reject action requires a
   distinct verifier (`PolicyChangeStepUpVerifier`) backed by a nonce store
   (`createPolicyChangeStepUpNonceStore.ts`) — meaning the checker's approval itself is a
   separately-authenticated action, not merely gated by whatever session authenticated their
   earlier read access.
4. **Immutable, terminal lifecycle.** Status transitions only `PENDING_APPROVAL` → `APPROVED` or
   `REJECTED`, exactly once, never reversible and never re-enterable
   (`PendingPolicyChangeRepository.resolve`).
5. **Cryptographic deploy-time integrity check**
   (`packages/api/src/governance/verifyPolicyGovernanceIntegrityAtStartup.ts`): for every
   `(policyName, policyVersion)` pair that has ever gone through the approval flow, the live
   policy file's content is hashed (`PolicyChangeCrypto.hashPolicyContent`) and compared against
   the `contentHashAfter` of the most recent `PolicyChangeApprovalRecord` for that pair. A
   mismatch — meaning the live file was edited outside the approval API after being approved, or
   the approved content was never actually written — is logged loudly (`console.error`) but does
   **not** block startup, a deliberate design choice distinct from this system's fail-closed
   configuration checks: a governance-tooling inconsistency is a signal for an operator to
   investigate, not a reason to take the execution pipeline down.
6. **Downstream execution-time enforcement.** Separately, `PolicyEngine.evaluate()` evaluates the
   (now-governed) policy deterministically against each individual execution request at the
   moment of execution — first-match rule semantics, no side effects, explicitly scoped to *not*
   authorize execution, execute actions, or access external systems itself.

## Novel Elements (candidate claims — informal, for attorney refinement)

1. A method for governing changes to an authorization policy that controls automated execution,
   comprising: requiring a proposed change to be held in a durable pending-approval state naming
   a proposing actor; structurally preventing the proposing actor from resolving their own
   proposal, enforced independent of the policy's own content; requiring a distinct,
   separately-authenticated verification step for the resolving action itself; and permitting the
   proposed content to take effect only upon a terminal, non-reversible approval.
2. The method of claim 1, further comprising a deploy-time or startup-time integrity check that
   cryptographically hashes the live policy content in force and compares it against a recorded
   content hash from the most recent approval for that policy, to detect policy content that was
   altered outside the governed approval workflow entirely — including by direct file or
   database access bypassing the approval API — and reporting such a mismatch without blocking
   system startup.
3. The method of claim 1, wherein the same system separately, and at the time of each individual
   automated execution request, deterministically evaluates that execution request against the
   then-current governed policy, such that policy governance (claim 1) and per-transaction policy
   evaluation (this claim) are structurally distinct mechanisms operating at different times,
   connected only by the governed policy artifact itself.
4. The method of claim 1, applied specifically to a policy that governs AI-agent-initiated
   execution, where the "maker" and "checker" are human-authenticated actors and the governed
   artifact is the machine-evaluated ruleset an autonomous agent's actions are checked against.

## What would need attorney/prior-art input before this is filing-ready

- Maker-checker / dual-control approval workflows are well-established prior art in financial
  operations broadly (this is explicit non-novel background, not a claimed element by itself).
  The attorney will need to confirm the distinguishing elements are (a) the deploy-time
  cryptographic detection of *out-of-band* bypass (claim 2) and (b) the structural pairing with
  execution-time policy evaluation of the governed artifact (claim 3) — not the maker-checker
  concept itself.
- Whether claim 3 is better filed as part of this application or kept entirely separate from
  policy-*change* governance, since `PolicyEngine.evaluate()` is a general mechanism not
  intrinsically tied to how the policy was authored.
- Formal drawings: a state diagram of `PendingPolicyChangeStatus` transitions, and a sequence
  diagram of the deploy-time integrity check.
- **Also flagged for Pavan's attention independent of patent filing:** `docs/deep-tech/04-IP-PATENT-SUMMARY.md`
  separately assessed `packages/policy/src/SignalIntentBinder.ts` (the fix for the self-discovered
  execution-authorization bypass) as the single strongest patent candidate in this codebase,
  because it has a real "found exploit → structural fix" narrative. It is not included as one of
  the three drafts here because the original prompt's three titles didn't name it — worth
  deciding whether it should replace one of these three, or be added as a fourth.

## Source Code Reference

- `packages/shared/src/domain/pending-policy-change.ts` — `PendingPolicyChange`,
  `PendingPolicyChangeStatus` (read in full 2026-08-25).
- `packages/shared/src/errors/same-actor-cannot-approve-own-change-error.ts` — separation-of-duties
  enforcement.
- `packages/api/src/routes/pending-policy-changes.ts` — API-layer enforcement of maker/checker
  identity and step-up verification.
- `packages/api/src/bootstrap/createPolicyChangeStepUpVerifier.ts`,
  `createPolicyChangeStepUpNonceStore.ts` — Layer 4 step-up verification.
- `packages/api/src/governance/verifyPolicyGovernanceIntegrityAtStartup.ts` — deploy-time
  cryptographic integrity check (read in full 2026-08-25).
- `packages/crypto/src/PolicyChangeCrypto.ts` — `hashPolicyContent`.
- `packages/policy/src/PolicyEngine.ts` — the separate execution-time evaluation mechanism (claim 3).
