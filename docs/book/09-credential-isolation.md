# Chapter 9 — Credential Isolation

`packages/execution-control/src/{GatewayAttestation,SessionCredentialExecutionControl,ExecutionControlService,GatewaySessionStore,ConnectorPolicy,SessionCredentialVault,SessionCredentialSecureConnector}.ts`.

## The question this package answers

Once `ExecutionGateway` (Chapter 8) has verified a request and decided to release it, one
question remains: how does the connector that actually calls the external system (HubSpot,
GitHub, a bank's payment rail) get the credential it needs, without that credential ever
becoming visible to the caller, the gateway's own long-term state, or a replay of the same
request? `execution-control` is the answer, and it's built as a chain of narrow,
single-purpose components rather than one class that does all of it.

## Step 1 — proving the gateway itself released this specific request

`GatewayAttestation` is a second, separate signature from the authorization envelope itself:
`GatewayAttestationSigner.sign(gatewayId, authorizationId, privateKey)` Ed25519-signs
`{gatewayId, authorizationId, nonce, issuedAt}`. Its own doc comment is careful to disclaim
what this attestation is *not*: the `nonce` here is explicitly not a replay defense on its
own — that's delegated to the session store (step 2) and the upstream envelope `NonceStore`
(Chapter 7). What it does prove is narrower and specific: that the Gateway itself — not some
other caller holding a copy of the verified content — is the one presenting this exact
`authorizationId` for release, right now.

`SessionCredentialExecutionControl.execute()` gates entry on this attestation *before* any
session exists:

> "Wraps an existing ExecutionControl (typically `ExecutionControlService`, unmodified) with
> a request-bound Gateway attestation check that runs before any `GatewaySession` is created.
> `ExecutionControlService.execute()` is the sole caller of `InMemoryGatewaySessionStore.create()`
> in this package (verified by inspection, not enforced by a lock), so gating entry here...
> is what makes 'no session without a matching attestation' hold, provided this wrapper is
> the path actually wired into production rather than `ExecutionControlService` being
> constructed and called directly." (`SessionCredentialExecutionControl.ts`)

That parenthetical — "verified by inspection, not enforced by a lock" — is an honest
admission that this invariant depends on production wiring actually using this wrapper, not
on a structural guarantee the type system enforces. It's the same category of thing Chapter
4 flagged about the capability-coverage test: a real property, true today, held by
discipline and wiring rather than by something that would fail loudly if violated.

## Step 2 — a session that can only be used once

`ExecutionControlService.execute()` re-authenticates the gateway, resolves a `Connector` via
`ConnectorRegistry.resolveCapability(action)`, and creates a one-time `GatewaySession` via
`InMemoryGatewaySessionStore.create()`, binding `contentBinding`/`authorizationBinding`
hashes into the session itself. It builds an immutable (`deepFreeze`'d) `GatewayExecutionRequest`,
calls `connector.execute(request)`, and audits `session.created`/`execution.completed`/
`execution.rejected` regardless of outcome.

## Step 3 — the connector consumes the session exactly once

`SessionCredentialSecureConnector.execute()` is where the session actually gets spent:
`policy.assertAllowed()` (→ `DefaultConnectorPolicy.assertAllowed`) re-authenticates gateway
and connector identity, checks the `verifiedTransaction` flags, checks capability membership,
and — critically — **consumes** the `GatewaySession`. Single-use: a replayed attempt to reuse
the same session is rejected at `InMemoryGatewaySessionStore.consume()`. Only after that
consumption succeeds does the connector:

> "SecureConnector that resolves credentials through a `SessionCredentialVault` instead of a
> raw `CredentialVault`: obtains a single-use, time-bounded session credential per execution
> and destroys it (`revoke()`) on every exit path — success, executor failure, or policy
> rejection after issuance — via try/finally." (`SessionCredentialSecureConnector.ts`)

## Step 4 — the credential itself never leaves the vault as a value until the last possible moment

```
// SessionCredentialVault.ts
"A single-use, time-bounded lease on an underlying ExecutionCredential. Carries no secret
material itself — the secret is only ever returned by consume(), and only once."
```

`issue()` only confirms the underlying credential *exists* — it never resolves or stores the
secret. `consume()` is the one and only point the plaintext credential is fetched, and it can
only be called once per lease. This is the actual mechanism behind "the caller never sees the
credential": the caller (an AI agent, a human, anything upstream of the Gateway) only ever
interacts with signed envelopes and hashes; the plaintext secret exists, briefly, inside the
connector's own executor call, and nowhere else in the request's lifetime.

## The whole chain, restated

A verified request enters `SessionCredentialExecutionControl` (attestation check) →
`ExecutionControlService` (session creation, connector resolution) →
`SessionCredentialSecureConnector` (policy check, session consumption, credential lease) →
the connector's own executor (the one place the plaintext credential exists) → `revoke()`
(guaranteed via `finally`, on every exit path). Four independent components, each of which
can reject the request on its own terms, each auditing its own outcome, and none of which
holds a secret longer than the single call that needs it.

## `Connector` itself never resolves credentials — that's the contract

Chapter 10 covers `Connector`'s full contract, but the credential-isolation half of it
belongs here: a `Connector` implementation is documented as never evaluating policy,
authorizing execution, interpreting AI output, or resolving credentials itself — credential
resolution happens exclusively inside this package, before a `Connector`'s own `execute()` is
ever called. A connector receives an already-resolved credential as a parameter; it never
goes looking for one on its own.
