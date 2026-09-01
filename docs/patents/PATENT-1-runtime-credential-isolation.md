> **STATUS: DRAFTING AID FOR ATTORNEY REVIEW — NOT A FILED OR FILING-READY APPLICATION.**
> Written 2026-09-01, re-verified line-by-line against this repository's current source
> (`packages/execution-control/src/SessionCredentialSecureConnector.ts`,
> `packages/execution-control/src/SessionCredentialVault.ts`,
> `packages/execution-control/src/CredentialVault.ts`) and its current test suite
> (`packages/execution-control/tests/unit/session-credential-vault.test.ts`,
> `packages/api/tests/integration/credential-isolation.integration.test.ts`). Every file, class,
> method, and quoted error string below was read directly from the working tree on that date, not
> copied from a prior summary. No patent attorney, patent agent, or prior-art search has reviewed
> this document. Do not submit this to the Indian Patent Office, the USPTO, or any other patent
> office in its current form. This document formalizes and supersedes the informal candidate
> claims in [`DRAFT-01-runtime-credential-isolation.md`](./DRAFT-01-runtime-credential-isolation.md)
> into patent-application structure (numbered paragraphs, independent/dependent claims); the
> underlying technical content is the same verified mechanism. See
> [`PATENT_FILING_REGISTER.md`](./PATENT_FILING_REGISTER.md) for real filing status (currently:
> nothing filed, nothing attorney-reviewed).

# Patent Application (Draft) — Method and System for Runtime Credential Isolation via Single-Use, Authorization-Bound, Structurally-Destroyed Execution Credentials

## Title

Method and System for Issuing and Unconditionally Destroying a Single-Use, Authorization-Bound
Execution Credential for an Automated Caller

## Field of the Invention

[0001] This invention relates to access-credential management for automated systems — including
but not limited to AI agents — that direct execution of an action against a third-party or
downstream system, and specifically to a mechanism that prevents an automated caller from ever
holding a credential capable of being reused, replayed, or exfiltrated for any purpose beyond the
single, individually-authorized execution it was issued for.

## Background

[0002] Conventional integration architectures — API gateways, OAuth-scoped bearer tokens,
role-based service accounts, static API keys — grant a calling process a credential that remains
valid for a period of time or a number of uses extending beyond any single action. Two structural
risks follow regardless of how narrowly the credential's *scope* is restricted:

[0003] First, a credential that outlives the action it was issued for is a standing target. If
logged, leaked, or exfiltrated by a compromised or misled caller (for example, an AI agent
induced by prompt injection to act outside its intended purpose), the credential remains usable
until it is manually revoked — an interval during which no cryptographic property of the system
prevents misuse.

[0004] Second, scope restriction is not the same as action-level binding. An OAuth scope such as
`refunds:write` constrains *what class* of action a credential may perform; it does not bind the
credential to *the one, individually-authorized execution* it was minted for. A credential valid
for the scope can be replayed against any number of same-scoped requests, not only the one that
was actually approved.

[0005] What is needed is a credential-issuance mechanism in which (a) the credential does not
exist until the specific action it will be used for has already been approved by policy, (b) the
credential is cryptographically or structurally bound to that one approved action's own
authorization identifier rather than merely to a scope class, (c) the credential is consumable at
most once, and (d) the credential is destroyed upon exit from the execution regardless of whether
that execution succeeded, failed, or the downstream system errored — without depending on
application-level cleanup code that could itself be skipped by a bug or an exception path.

## Summary of the Invention

[0006] The invention issues a single-use, session-scoped execution credential per individually
authorized execution, immediately before that execution occurs and only after a deterministic
policy check has already approved the specific request, and unconditionally destroys that
credential upon exit from the execution — regardless of whether the execution succeeded, the
downstream system failed, or an error occurred after issuance. The calling connector never holds
a long-lived credential; at any moment it holds, at most, one single-use credential scoped to
exactly one in-flight execution and one authorization identifier.

[0007] The destruction step is enforced structurally, via a language-level exception-safe
construct (a `try`/`finally` block) surrounding the point of use, rather than by an
application-level cleanup routine that a caller must remember to invoke and that an unanticipated
exception path could bypass.

## Detailed Description

### System components

[0008] **The secure connector adapter** (`SessionCredentialSecureConnector`,
`packages/execution-control/src/SessionCredentialSecureConnector.ts`). Every connector registered
into the execution path is wrapped in this adapter, which implements a single `execute(request)`
method performing the sequence described in paragraphs [0009]–[0013] for every execution request.

[0009] **Step 1 — policy assertion precedes credential issuance.** `execute()` first calls
`this.options.policy.assertAllowed(request, this, this.options.gatewayAuthentication)`. This call
is made before any credential-issuance call occurs; if it throws, no session credential is ever
minted for the rejected request. A rejected request therefore never causes credential material to
come into existence in the first place — the invention does not "issue then discard on
rejection," it never issues at all.

[0010] **Step 2 — issuance bound to authorization identifier.** Only after the policy assertion
passes does `this.options.sessionCredentials.issue(connectorId, authorizationId)` execute, where
`authorizationId` is read from `request.authorization.payload.authorizationId` — the identifier
of the one, specific, already-approved execution authorization this request carries. `issue()`
(`InMemorySessionCredentialVault.issue`,
`packages/execution-control/src/SessionCredentialVault.ts`) does not resolve or return the
underlying secret; it confirms the underlying `CredentialVault` holds a credential for
`connectorId` (discarding the resolved value immediately — "issue() must not hold the secret," per
the implementation's own governing comment), then records a `SessionCredentialRecord` keyed by a
freshly generated `sessionCredentialId`, carrying `connectorId`, `authorizationId`, an `expiresAt`
bound, and two independent boolean flags, `used` and `revoked`, both initialized `false`. The
caller receives only the opaque `sessionCredentialId` — a handle, never the credential material.

[0011] **Step 3 — single consumption, immediately preceding use.** Inside a nested `try` block,
`sessionCredentials.consume(sessionCredentialId)` is called exactly once, immediately before the
credential material is handed to `this.options.executor.execute(request.executableContent,
credential)`. `consume()` (paragraph [0012]) is the only method in the system that ever resolves
and returns the actual secret material, and it does so freshly at the moment of use rather than
returning a value cached at issuance time.

[0012] **Single-use enforcement inside `consume()`.** `consume()` checks, in order: (i) the
session credential is known (else throws `"Unknown session credential: {id}."`); (ii) it has not
been revoked (else throws `"Session credential has been revoked: {id}."`); (iii) it has not
already been used (else throws `"Session credential has already been used: {id}."`); (iv) it has
not expired (else throws `"Session credential has expired: {id}."`). Only if all four checks pass
does it set `record.used = true` and resolve the underlying credential via the wrapped
`CredentialVault`. Because `used` and `revoked` are independent, mutually reinforcing single-use
gates checked before any credential material is returned, a second `consume()` call against the
same `sessionCredentialId` — whether attempted before or after the connector's own destruction
step below — necessarily fails.

[0013] **Step 4 — unconditional, structurally-guaranteed destruction.** The `consume()`-then-`execute()`
sequence of Step 3 is wrapped in a `try { … } finally { await
this.options.sessionCredentials.revoke(sessionCredentialId); }` block. `revoke()` sets
`record.revoked = true` unconditionally. Because this runs in a `finally` clause, it executes on
every exit path from the guarded block — normal return, a thrown error from `executor.execute()`,
or a thrown error from `consume()` itself — without requiring any application code downstream to
remember to call it. A downstream execution failure therefore never leaves a usable credential
outstanding: the very next `consume()` attempt against that `sessionCredentialId`, from any
caller, fails with `"has been revoked"` (paragraph [0012]), which is distinguishable in the
failure message from `"has already been used"` — allowing a verifier to confirm that destruction,
specifically, occurred, not merely that the id happens to be otherwise unusable.

[0014] **Step 5 — audit on every path, keyed by opaque identifier only.** The outer `try`/`catch`
in `execute()` writes exactly one audit event on every call: `"execution.completed"` on success or
`"execution.rejected"` (carrying the caught error's message as `reason`) on any failure at any
stage — a rejected policy assertion, a failed `issue()`, a failed `consume()`, or a failed
`executor.execute()`. Each event carries `connectorId`, `authorizationId`, the gateway session id,
the gateway id, the executed `action`, and — when a session credential was actually issued before
the failure — `credentialId`, the opaque `sessionCredentialId`. The credential's own material is
never included in any audit event, at any outcome.

### Why the four steps compose into a single invention

[0015] The novelty is not any one step in isolation — single-use tokens, try/finally cleanup, and
policy-gated authorization each exist separately in prior art. The invention is the specific
composition: **binding issuance to an already-approved, specific authorization identifier (not a
scope class), followed by structural (language-construct-level, not application-level)
unconditional destruction on every exit path, verified independently by a distinguishable
"revoked" failure signature on reuse, wrapped around every registered connector by default rather
than as an opt-in.** Removing any one element weakens the guarantee: without authorization-id
binding, the credential could be replayed against a different same-scope action; without
`try`/`finally`, an unanticipated exception path could leave a live credential; without the
distinguishable revoked/used/expired failure taxonomy, an auditor could not distinguish "destroyed
as designed" from "coincidentally already consumed."

## Independent Claims (informal — for attorney refinement)

**Claim 1.** A computer-implemented method for authorizing execution of an action requested by an
automated caller against a downstream system, comprising:

(a) receiving an execution request carrying an authorization identifier of a specific,
individually-approved authorization;

(b) evaluating a policy against the execution request and rejecting the request, without issuing
any credential, if the policy does not approve it;

(c) responsive to policy approval, issuing a session-scoped execution credential handle bound to
both an identifier of the requesting connector and the authorization identifier of step (a), the
handle carrying no credential material itself;

(d) resolving the handle to underlying credential material exactly once, immediately before using
that material to perform the requested action, wherein a second resolution attempt against the
same handle is rejected independent of whether the first resolution succeeded or was itself
rejected;

(e) unconditionally marking the handle as destroyed upon completion of the requested action,
whether the action succeeded or failed, the marking being enforced by a structural
exception-handling construct surrounding both the resolution of step (d) and the performance of
the action, such that the marking occurs on every code path exiting that construct without
requiring a separate, independently invoked cleanup instruction; and

(f) recording an audit event for the execution request regardless of outcome, identifying the
session-scoped handle by its opaque identifier without recording the underlying credential
material.

**Claim 2.** The method of claim 1, wherein step (d)'s rejection of a second resolution attempt
produces a failure indication that is distinguishable, by its content, from a failure indication
produced when a handle has expired without ever being resolved — such that an external observer
can determine from the failure alone that destruction specifically occurred, rather than merely
that the handle is unusable for an unspecified reason.

**Claim 3.** A system comprising a connector registry in which every connector registered for
production execution is wrapped, by default and without a per-connector opt-in step, in an
adapter implementing the method of claim 1, such that no connector can be registered into the
execution path without the credential-isolation method of claim 1 applying to every request it
handles.

## Dependent Claims (informal)

**Claim 4.** The method of claim 1, wherein the policy evaluation of step (b) and the credential
issuance of step (c) are separated by a hard sequencing guarantee such that no credential handle
can exist in the system for a request that the policy evaluation has not already approved.

**Claim 5.** The method of claim 1, wherein the credential material resolved in step (d) is
fetched fresh from an underlying credential store at the moment of resolution rather than cached
at the time the handle of step (c) was issued.

**Claim 6.** The method of claim 1, wherein the audit event of step (f) further identifies, on a
rejection outcome, the specific stage at which rejection occurred by including the triggering
error's own message.

## What would need attorney/prior-art input before this is filing-ready

- Whether "single-use session credential, issued only after policy approval of the specific
  action and bound to that action's own authorization identifier, then destroyed via a structural
  exception-handling guarantee" is novel over existing short-lived-OAuth-token and ephemeral
  credential vaulting patterns (e.g., HashiCorp Vault dynamic secrets), or whether the
  distinguishing element needs sharper framing around the authorization-id binding specifically
  (as opposed to short lifetime alone, which is well-trodden art).
- Whether Claim 3 (default, non-opt-in wrapping at the registry level) is independently claimable
  or should be folded into Claim 1 as an implementation detail of "every connector."
- Formal patent drawings: a sequence diagram of policy-assert → issue → consume → execute →
  revoke → audit, and a state diagram of the four-way `used`/`revoked`/`expired`/`unknown`
  resolution-failure taxonomy in paragraph [0012].

## Source Code Reference (verified against working tree on 2026-09-01)

- `packages/execution-control/src/SessionCredentialSecureConnector.ts` — the wrapping adapter and
  `execute()` sequence (paragraphs [0008]–[0014]).
- `packages/execution-control/src/SessionCredentialVault.ts` —
  `InMemorySessionCredentialVault.issue/consume/revoke`, the single-use enforcement and exact
  error strings quoted in paragraph [0012].
- `packages/execution-control/src/CredentialVault.ts` — `InMemoryCredentialVault`, the underlying
  credential store `consume()` resolves against.
- `packages/execution-control/src/types.ts` — `SecureConnector`, `ConnectorExecutor`,
  `GatewayExecutionRequest` interfaces referenced above.
- `packages/execution-control/tests/unit/session-credential-vault.test.ts` — unit coverage of
  issue/consume/revoke semantics.
- `packages/api/tests/integration/credential-isolation.integration.test.ts` — integration proof,
  including the test at line ~29 ("issues and destroys exactly one session credential for a
  successful /execute request"), line ~75 ("still issues and destroys the session credential when
  the connector executor fails"), and line ~122 ("issues zero session credentials when the
  gateway attestation is spoofed"); the post-execution re-`consume()` assertion at lines ~70–71 and
  ~117–119 asserts the exact string match `/has been revoked/`, confirmed present in the source at
  the time of this draft.
