[← Book Index](README.md) · [← Previous: Chapter 13, Caller Authentication and Scoping](13-caller-authentication-and-scoping.md)

# Chapter 14: Policy Governance (Maker-Checker)

`packages/api/src/routes/pending-policy-changes.ts`, `auth/isHumanCaller.ts`,
`auth/PolicyChangeStepUpVerifier.ts`, `governance/PolicyChangeApprovalService.ts`,
`packages/governance-ui/src/`.

## The gap before this existed

Every other chapter in this book is about controlling *execution*, what an AI agent or
other caller is allowed to make happen. None of it protects the *rules* execution is checked
against: before this feature, any caller with filesystem write access to `policies/` could
change what a policy allows, with no second party involved and no durable, signed record of
who approved the change. This is the one deliberate exception to Chapter 1's
caller-type-agnosticism principle. `isHumanCaller()` checks `credentialHolderType ===
AuthorityType.USER`, and every one of the four governance endpoints calls
`requireHumanCaller()` before doing anything else, because changing the rules themselves is
treated as a decision only a human gets to make.

## Lifecycle: exactly one transition, never back

A policy change moves `PENDING_APPROVAL → APPROVED`/`REJECTED`, once, never reversed
(`pending-policy-change.ts`). Four endpoints cover the whole flow: `POST
/:name/:version/pending-changes` (propose), `GET /pending-changes` (list, with an embedded
diff), `POST /pending-changes/:id/approve`, `POST /pending-changes/:id/reject`.

## Layer by layer, in the order they're checked

**Human-only, first, on all four endpoints.** A `SERVICE`-credentialed (or unverified,
missing `credentialHolderType` entirely, the fail-closed default) caller is denied
`403 NON_HUMAN_CALLER_DENIED` before the request is interpreted at all, and the denial is
audited as `caller.non_human_denied` with `severity: "flagged"`.

**Maker not equal to checker, next, on approve/reject.**
`SameActorCannotApproveOwnChangeError` fires independently on both endpoints when
`proposedBy === req.callerId`: `403 SAME_ACTOR_CANNOT_APPROVE_OWN_CHANGE`, checked *before*
step-up authorization is even looked at, because a maker approving its own change is wrong
regardless of what envelope it presents.

**Step-up authorization, last, on approve/reject only.** A distinct human checker still
isn't enough on its own: approve/reject additionally require a `PolicyChangeStepUpAuthorization`
envelope, signed by the checker's own separate signing key, on top of, never instead of,
their ordinary bearer token. `PolicyChangeStepUpVerifier` reuses `@parmana/envelope-verifier`'s
`NonceStore` interface with a dedicated instance and table, specifically so step-up replay
protection never shares a namespace with execution-authorization or approval-artifact
nonces. Three independent single-use guarantees, never cross-contaminating. A missing,
expired, or replayed envelope is each independently rejected (`403
STEP_UP_AUTHORIZATION_INVALID`); per-check diagnostic detail is logged server-side only,
never leaked into the HTTP response body. An earlier draft of this endpoint did leak it, and
that was caught and fixed before merge.

Tutorial 103 (`examples/tutorials/103-policy-governance-maker-checker`) exercises all three
layers independently against a real HTTP server: a human maker proposes; a `SERVICE` caller
is denied at propose; the maker is denied approving its own change with no step-up envelope
even attempted; a distinct checker with *no* step-up envelope is still denied; only a distinct
checker *with* a valid step-up envelope succeeds.

## Sign before write: the safer order, proven, not just documented

`PolicyChangeApprovalService.approve()` signs and durably persists the
`PolicyChangeApprovalRecord` **before** writing the live `policies/{name}/{version}/policy.json`
file. This ordering is proven, not merely intended: a dedicated unit test injects a failure at
each step independently and confirms (1) when the file write fails, the signed record still
exists and independently verifies, and (2) when persisting the record fails, the file write is
never attempted at all. The whole service runs before the pending change is marked resolved,
so a failure anywhere in it leaves the change untouched, never falsely marked `APPROVED`.

## `governance-ui`: read-only, by design, not by omission

`packages/governance-ui` is a small, standalone Express app with exactly five routes:
`GET`/`POST /login`, `POST /logout`, `GET /` (list), `GET /pending-changes/:id` (diff). No
route, form, or template anywhere targets `/approve` or `/reject`. The diff page's own
instructions tell a checker to run `scripts/sign-policy-change-step-up.ts` **locally** and
submit the result themselves, with their own bearer token, entirely outside this UI. Its
login has no independent validation logic of its own: `POST /login` calls `GET /callers/me`
on the real API with the submitted key as the bearer token, and that single round trip *is*
the entire check. If the API accepts the key, the UI trusts it; if not, the UI has nothing
further to say. The session holds only the caller's own API key, server-side, in an
`express-session` cookie (`httpOnly`, `secure` in production, 8-hour expiry). The key never
reaches the browser except as that opaque cookie, and is attached as `Authorization: Bearer`
on every proxied call to the real API.

This isn't an unfinished feature; it's a structural choice, stated directly: a checker's
step-up private key must never leave their own machine, since the entire security guarantee
of step-up authorization rests on exactly that. A web UI that collected it would defeat the
property the mechanism exists to provide.

## Two open questions this feature does not resolve

**Internal vs. external policy authoring.** This system resolves *how* a policy change is
approved, given that Parmana is the system of record for the approval. It does not answer
whether Parmana *should* be that system of record at all. An architecture where policies
are authored and approved in an external system, with Parmana staying strictly
read-only/enforcement-only, remains a live, undecided option. The maker-checker system exists
because policy authoring was previously outside *any* governance surface, not because the
internal-vs-external question was compared and internal was chosen.

**The human-vs-AI-agent identity problem underneath step-up authorization.** `isHumanCaller()`
checks a flag (`credentialHolderType === AuthorityType.USER`) set once, at
credential-issuance time, by whoever provisions the credential. Nothing in this codebase, or
in any bearer-token or asymmetric-key scheme generally, technically verifies that the entity
holding a private key is actually a human rather than an automated system with access to the
provisioning step. This is a known, general limitation of software-based identity, not
something a purely technical fix inside this codebase can close. The current mitigation is
entirely operational, not code-enforced: the standing rule is that key generation and
step-up signing for a checker's credential must happen on a device with no AI agent access.
No code path in `PolicyChangeStepUpVerifier` or `isHumanCaller` checks or enforces that
rule; it's a process control sitting outside the system, the same category as "don't commit
your private key." Chapter 18 returns to both of these as part of a broader look at what
this codebase has deliberately left open rather than pretended to resolve.

---

[← Book Index](README.md) · [← Previous: Chapter 13, Caller Authentication and Scoping](13-caller-authentication-and-scoping.md) · [Next: Chapter 15, Audit and Evidence Trails →](15-audit-and-evidence-trails.md)
