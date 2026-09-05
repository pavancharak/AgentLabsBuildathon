# Chapter 13 — Caller Authentication and Scoping

`packages/api/src/auth/{StaticKeyAuthenticator,isPrincipalAllowed,isCapabilityAllowed,isHumanCaller,recordCallerAuditEvent,AuditUnavailableError,CallerAuditSink}.ts`,
`middleware/caller-auth.ts`.

## Identity is opaque, and deliberately caller-type-blind

`StaticKeyAuthenticator` authenticates by comparing a SHA-256 hash of the presented bearer
token against a configured `ApiKeyEntry` list, in constant time, never comparing or storing
the raw key. Nothing about this mechanism distinguishes a human, a script, an AI agent, or a
third-party integration — the same identity mechanism serves all of them identically, which
is Chapter 1's caller-type-agnosticism principle showing up again at the authentication
layer specifically, not just the authorization pipeline. Key rotation needs no downtime: two
`ApiKeyEntry` rows sharing one `callerId` let an old and new key both work simultaneously, and
removing the old entry alone revokes it — nothing about the running app object changes, only
the config passed to the next `createApp()` call.

`middleware/caller-auth.ts`'s own doc comment is precise about what this layer is and isn't:
"the ONLY layer that decides whether an HTTP request is even entertained... entirely
independent of policy evaluation... and gateway attestation, which run later and answer
different questions. A rejected caller never reaches either of those layers; a
well-authenticated caller submitting a policy-rejected transaction is still rejected by
policy, this middleware cannot substitute for it." `GET /health` is the one route exempt
from authentication entirely — everything else, including read-only routes like
`GET /policies`, requires a credential.

## Two independent scoping layers, checked in a fixed order

Once authenticated, a caller is checked against two independent grants, in a specific order
that matters:

1. **Principal scoping** (`isPrincipalAllowed`, §2.16/G-24) — is this caller permitted to
   *assert* the transaction's `authority.principalId`? Checked first.
2. **Capability scoping** (`isCapabilityAllowed`, §3.16) — is this caller permitted to
   *invoke* the transaction's `intent.action`? Checked second, only if principal scoping
   already passed.

Tutorial 84 (`examples/tutorials/84-caller-authentication`) proves the ordering directly: a
caller allowed to assert the principal but not invoke the capability is rejected `403` and
audited as `caller.capability_denied`; a caller allowed to invoke the capability but not
assert the principal is rejected `403` and audited as `caller.principal_denied` — and because
the principal check runs first, that second caller's request never even reaches the
capability check at all.

The two grants default in **opposite directions**, deliberately: `allowedPrincipalIds` unset
falls back to "may only assert its own `callerId` as principal" (a caller with no explicit
grant can still act as itself), while `allowedCapabilities` unset or empty **denies every
capability** — there is no equivalent "may invoke its own capability" fallback. The literal
string `"*"` is an explicit, auditable wildcard grant for capabilities, never an implicit
default. `GET /callers/me` returns a caller's own resolved identity and scope — no key
material — as a self-lookup a security review can point to directly.

**Scope, honestly stated (§3.16's own load-bearing caveat):** this mechanism is implemented,
tested, and enforced for every caller that authenticates through a caller-auth-enabled path.
It does not currently apply to the one capability that actually moves CRM state in
production — HubSpot's own integration tests still construct their app with
`callerAuth: "disabled"`, so there is no caller identity for `allowedCapabilities` to scope in
the first place on that path. Do not read this claim as "Parmana's live HubSpot capabilities
are scope-restricted today" — they are not, yet; today this protects only callers going
through caller-auth-enabled paths, which at present means test and tutorial callers scoped to
the generic `test:fixture-execute` capability.

## A caller-authentication event that fails to be recorded fails the request

This is the property with no obvious counterpart in most systems, and it's worth stating
precisely because it's counter to how audit logging is usually built: `recordCallerAuditEvent`
wraps every `CallerAuditSink.record()` call, and **on failure, the request is rejected**
(`AuditUnavailableError`, `503 AUDIT_UNAVAILABLE`) rather than proceeding unaudited. This
applies to *both* outcomes of authentication, not just denials — a missing credential whose
`caller.rejected` audit write fails still gets `503`, not the `401` it would otherwise get,
and a perfectly valid, well-authenticated credential whose `caller.authenticated` audit write
fails **also** gets `503`, not `200`. There is no retry, buffering, or queueing: a failure
fails closed immediately, once, every time — turning "eventually audited" into "audited or it
didn't happen" would be a different, weaker design. Tutorial 101
(`examples/tutorials/101-fail-closed-caller-audit-writes`) demonstrates both directions
against a real HTTP server with an audit sink engineered to always throw.

## The audit event taxonomy

Every caller-boundary denial gets its own named `CallerAuditEvent` type, each carrying the
authenticated `callerId` and never the raw key: `caller.rejected` (missing/invalid
credential), `caller.principal_denied`, `caller.capability_denied`, `caller.non_human_denied`
(the one governance-specific denial, Chapter 14), plus `caller.authenticated` for the
success path. Both call sites that need one (`execute.ts` and `transactions.ts`) call
`recordCallerAuditEvent` immediately before returning the corresponding `403`, in the same
sequencing — audit write first, HTTP response second, never the reverse — a discipline
established once for `caller.capability_denied` and then deliberately repeated for every
denial type added after it, rather than reinvented per case.
