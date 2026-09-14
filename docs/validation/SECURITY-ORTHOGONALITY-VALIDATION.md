# Validation: "Security vulnerabilities in downstream business systems are orthogonal to Parmana's authorization boundaries"

**Method:** direct code reading of the production wiring path (bootstrap → gateway → execution-control → connector), 2026-09-08. No file in this document was assumed from the original prompt — several of its paths were wrong (see Corrections) and were re-derived from `git`/`find` before use.

## Corrections to the original request

The prompt cited these paths, which do not exist:

- `packages/credentials/src/SessionCredentialVault.ts` → actually `packages/execution-control/src/SessionCredentialVault.ts`
- `packages/core/src/execution/SessionCredentialSecureConnector.ts` → actually `packages/execution-control/src/SessionCredentialSecureConnector.ts`
- `packages/core/src/execution/*` and `packages/credentials/*` don't exist at all in this repo.

Everything below cites the real files.

---

## Section 1: Execution Flow Diagram

```
Caller (signed authorization + executable content)
   │
   ▼
ExecutionGateway.execute()                         packages/execution-gateway/src/ExecutionGateway.ts:399
   │  1. EnvelopeVerifier: sig / expiry / TTL / nonce   (envelope-verifier pkg)
   │  2. businessTransactionHash recompute-and-compare      :251-266
   │  3. policyContentHash recompute-and-compare (if wired) :274-310
   │  4. signalsHash + SignalStateVerifier re-check (G-31)  :312-352
   │  5. nonce consumed LAST, only if all above passed      :366-370
   │  → throws on any failure (:405-410); nothing downstream runs
   ▼
ExecutionControlService.execute()                  packages/execution-control/src/ExecutionControlService.ts:44
  wrapped by  SessionCredentialExecutionControl     packages/execution-control/src/SessionCredentialExecutionControl.ts:28
   │  0. (wrapper, runs first) verifies a fresh, REQUEST-BOUND GatewayAttestation
   │     (Ed25519-signed, authorizationId-bound) before touching the inner service :31-46
   │  1. authenticator.authenticateGateway(...)                    :53-62
   │  2. registry.resolveCapability(action) → connector             :68-71
   │  3. sessions.create(...) → one-time GatewaySession              :77-83
   ▼
SessionCredentialSecureConnector.execute()         packages/execution-control/src/SessionCredentialSecureConnector.ts:70
   │  1. policy.assertAllowed(...) → DefaultConnectorPolicy          packages/execution-control/src/ConnectorPolicy.ts:15
   │       - gateway auth, connector-identity trust, verifiedTransaction flags,
   │         capability match, grantedCapability match, single-use GatewaySession.consume()
   │  2. sessionCredentials.issue()  → single-use, time-bounded lease (no secret yet)
   │  3. sessionCredentials.consume() → resolves the real secret, ONCE
   │  4. executor.execute(content, credential)  (try/finally: revoke() always runs)
   ▼
SdkConnectorExecutor.execute()                     packages/execution-gateway/src/connector-execution/SdkConnectorExecutor.ts:41
   │  version/health/capability checks, credential-handle type check
   ▼
connector.execute(request, context)   ← e.g. GatewayHubSpotAdapter / GatewayGitHubAdapter
   │
   ▼
BUSINESS SYSTEM (HubSpot / GitHub / etc.)
```

Everything above the last arrow runs **inside Parmana's process**, before the business system's own API is ever called. The business system receives only the already-decided, already-resolved outbound call — it never participates in the authorization decision.

---

## Section 2: Q&A with Code Evidence

### Part 1 — Where authorization happens

**Q1: Where does authorization checking happen? Can a business system be reached without a credential?**

- First step on any request: `ExecutionGateway.verify()` — signature, expiry, TTL, nonce, content-hash, policy-freshness, signal-freshness (`ExecutionGateway.ts:232-390`). All of this is cryptographic/deterministic re-verification, done before anything is dispatched.
- The credential is not issued at this stage at all — it's issued two layers downstream, inside `SessionCredentialSecureConnector.execute()` (`SessionCredentialSecureConnector.ts:77-80`), and only _after_ `DefaultConnectorPolicy.assertAllowed()` (`ConnectorPolicy.ts:15`) has already thrown on any policy/identity/session violation.
- A business system cannot be reached without a credential: `SdkConnectorExecutor.execute()` calls `connector.execute(request, context)` where `context.credential = credential.value` (`SdkConnectorExecutor.ts:85-91`) — that credential came from `sessionCredentials.consume()`, which is called two lines above it, inside the same connector method that already ran policy checks.

**Q2: Can downstream systems bypass or upgrade the credential?**

- Authorization is fully decided before the credential is issued — see the ordering in Section 1. The credential carries no scope information the business system could reinterpret; it's an opaque `ExecutionCredential` resolved server-side and handed to the connector adapter for one call.
- The `SessionCredential` (the lease object, not the secret) is `Object.freeze`d (`SessionCredentialVault.ts:77-83`), and `GatewayExecutionRequest` itself is `deepFreeze`d before being handed to any connector (`ExecutionControlService.ts:99-113`).
- It cannot be "upgraded": `consume()` throws if already used, revoked, or expired (`SessionCredentialVault.ts:86-99`), and `revoke()` runs in a `finally` block on every exit path — success, executor failure, or policy rejection (`SessionCredentialSecureConnector.ts:83-89`). There is no method on the interface that lets a caller (or the business system, which never sees the vault at all) request a broader grant.
- The business system process never has a reference to the vault, the policy engine, or the gateway's private key — it receives a resolved secret value for one outbound call and nothing else.

**Q3: Is the boundary inside or outside business systems?**
Outside. Every check — signature, replay, content-hash, policy-freshness, signal-freshness, session single-use, capability-match — happens in Parmana's own process (`ExecutionGateway` → `ExecutionControlService`/`SessionCredentialExecutionControl` → `SessionCredentialSecureConnector`) before `connector.execute()` is ever called. The business system's own code, database, or API surface is never consulted for the authorization decision.

```
┌─────────────────── Parmana process (authorization boundary) ───────────────────┐
│ EnvelopeVerifier → ExecutionGateway → SessionCredentialExecutionControl        │
│  → ExecutionControlService → DefaultConnectorPolicy → SessionCredentialVault   │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                    │  (decision already made; single resolved call)
                                    ▼
                    ┌───────────────────────────────┐
                    │   Business system (HubSpot,    │   ← outside the boundary;
                    │   GitHub, etc.) — receives      │      compromise here cannot
                    │   only the dispatched call      │      re-open the decision
                    └───────────────────────────────┘
```

### Part 2 — Credential isolation

**Q1: How does `SessionCredentialSecureConnector` work? Can it be bypassed?**
Flow per `execute()` call (`SessionCredentialSecureConnector.ts:70-117`):

1. `policy.assertAllowed(request, this, gatewayAuthentication)` — throws first, before any credential exists.
2. `sessionCredentials.issue(connectorId, authorizationId)` — confirms an underlying credential exists but discards the resolved value (`SessionCredentialVault.ts:57-63`, doc comment: "issue() must not hold the secret").
3. `sessionCredentials.consume(sessionCredentialId)` — the _only_ place the actual secret is resolved, and only once.
4. `executor.execute(content, credential)` — the outbound call, wrapped so `revoke()` always fires in `finally`.
   It cannot be bypassed in the production wiring: `createConnectorRegistry.ts` (`packages/api/src/bootstrap/createConnectorRegistry.ts`) builds every registration via `createGatewayConnectorRegistry`, which routes to `SessionCredentialSecureConnector` unless `legacyInsecure: true` is set — see Q2.

**Q2: Are all connectors wrapped by default? Is `legacyInsecure` used in production?**
Yes, mandatory by default. In `GatewayConnectorRegistry.register()` (`packages/execution-gateway/src/connector-execution/GatewayConnectorRegistry.ts:100-137`):

```ts
if (options.legacyInsecure === true) {
  secureConnector = new InMemorySecureConnector({...});   // raw CredentialVault, no session isolation
} else {
  ...
  secureConnector = new SessionCredentialSecureConnector({...});  // default path
}
```

The doc comment on the flag (`GatewayConnectorRegistry.ts:49-56`) states: _"For tests only — every production connector goes through the default, session-credential path."_
I grepped the entire repo (excluding `.test.ts`/`__tests__`/`dist`) for `legacyInsecure` — it appears only in the two declaration sites and their doc comments. **Zero production call sites set it to `true`.** `packages/api/src/bootstrap/createConnectorRegistry.ts` registers `test-fixture`, `hubspot`, and `github` — none pass `legacyInsecure`, so all three get the default `SessionCredentialSecureConnector` path.

**Q3: Credential lifecycle**

- Created: `SessionCredentialVault.issue()` on every `execute()` call, scoped to one connector + one authorizationId (`SessionCredentialVault.ts:57-83`).
- Lifetime: `expiresAt = issuedAt + lifetimeMs` (default 30,000ms, `GatewayConnectorRegistry.ts:24,124`); also single-use — `consume()` sets `used = true` and refuses a second call (`SessionCredentialVault.ts:94-101`).
- Destroyed: `revoke()` is called unconditionally in the connector's `finally` block (`SessionCredentialSecureConnector.ts:87-89`) — success, executor error, or a rejection after issuance all revoke it.
- One-time use only — not reusable, not renewable, no refresh path exists on the `SessionCredentialVault` interface.

---

## Section 3: Vulnerability Scenario Results

**Scenario 1 — Downstream system fully compromised. Can the attacker approve payments outside policy?**
**BLOCKED.** Policy evaluation (`ExecutionGateway` + `DefaultConnectorPolicy`) has already run and completed before the compromised system's code executes at all — the business system is the very last node in the chain and is never asked to re-derive or confirm the decision. A compromised business system can only act on the one resolved credential/call it was already handed for one specific, already-authorized action; it has no channel back into Parmana's policy engine, session store, or signing key to mint a new authorization. Evidence: `ExecutionGateway.ts:399-452`, `ConnectorPolicy.ts:15-56`, `SessionCredentialSecureConnector.ts:70-117`.

**Scenario 2 — Attacker calls the business system's API directly, bypassing Parmana. Can they execute without verification?**
**BLOCKED, conditioned on infrastructure** (see caveat below). Within Parmana's own architecture: connector wrapping is mandatory by default (`legacyInsecure` never set `true` in production — Section 2, Q2), and `SdkConnectorExecutor` requires a resolved `CredentialHandle`, rejecting a raw credential outright (`SdkConnectorExecutor.ts:69-73`). There is no code path in this repo that lets a caller reach a connector's underlying credential without going through the vault.
**Caveat this claim does not cover:** whether the business system's _own_ API is independently reachable by an attacker who has the business system's native credentials through some channel entirely outside Parmana (e.g. a leaked HubSpot API key used directly against HubSpot's API, never touching Parmana at all). That is a real-world possibility but it isn't a "bypass of Parmana" — it's the business system's own credential-hygiene problem, which is a different question from the one the claim is about (whether Parmana's authorization boundary can be reached around). No code in this repo could prevent that scenario since it never enters Parmana's process.

**Scenario 3 — Attacker intercepts and tampers with a credential in transit.**
**BLOCKED, but the framing doesn't quite match the architecture.** There is no network-transmitted "credential" to intercept: `SessionCredentialSecureConnector`, `ExecutionControlService`, and the connector adapters all run in the same Parmana process — the resolved secret goes directly from `SessionCredentialVault.consume()` into `SdkConnectorExecutor`'s in-memory call (`SdkConnectorExecutor.ts:85-91`), never serialized to a wire format an external attacker could intercept.
What _is_ transmitted and cryptographically protected: the caller's signed authorization (Ed25519, verified by `EnvelopeVerifier`, `ExecutionGateway.ts:242-246`) and, for the gateway-to-execution-control hop, a fresh `GatewayAttestation` signed with Ed25519 and bound to one `authorizationId` (`GatewayAttestation.ts:56-71`, checked in `SignedTokenConnectorAuthenticator.authenticateGatewayForRequest`, `SignedTokenConnectorAuthenticator.ts:45-52`). Tampering with either breaks signature verification and is rejected before anything downstream runs.

---

## Section 4: Gaps Found

| Gap                                                                                    | Description                                                                                                                                      | File:line                                                                                   | Orthogonal to the claim?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same-process issuance secret is a hardcoded placeholder                                | `gatewaySessionIssuanceAuthentication` is `Object.freeze({})`, with an explicit `// TODO: Replace with the production authentication mechanism.` | `packages/api/src/bootstrap/createSessionStore.ts:6-13`                                     | **Yes.** This value never leaves the process — it gates `ExecutionControlService` calling `InMemoryGatewaySessionStore.create()` within the same Node process. It's not attackable over a network boundary; an attacker who could supply it already has arbitrary code execution inside Parmana's own process, which is outside this claim's threat model entirely (the claim is about _business-system_ compromise, not Parmana-process compromise). Worth hardening before any move to a multi-process/service-mesh deployment, but it does not let a downstream _business system_ bypass authorization.                      |
| `test:fixture-execute` capability intentionally unbound from canonical policy bindings | Documented exemption, reason given, enforced by a test that requires a non-empty reason                                                          | `packages/api/src/bootstrap/intentionallyUnboundCapabilities.ts:14-19`                      | **Yes.** Test-fixture-only, never registered outside `NODE_ENV=test` per its own doc comment; not present in production capability set (`hubspot:*`, `github:*` are both bound).                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `legacyInsecure` / `InMemorySecureConnector` escape hatch exists in the codebase       | A non-session-isolated connector path exists, gated by a boolean the default-off doc comment says is test-only                                   | `packages/execution-gateway/src/connector-execution/GatewayConnectorRegistry.ts:56,100-108` | **Partially.** The _capability_ to bypass session isolation exists in code — it's not merely absent. It's currently orthogonal in practice because grep confirms zero production call sites set it `true`, but this is a convention enforced by code review / doc comment, not a compile-time or runtime guarantee. A future connector registration that mistakenly sets `legacyInsecure: true` would silently drop to the raw-credential-vault path. Recommend: an explicit env/build-time assertion (mirroring `assertConnectorCapabilitiesBound`'s fail-closed pattern) that no production registration ever sets this flag. |

No gap found that lets a compromised or maliciously-controlled **business system** reach back into Parmana's policy engine, forge an authorization, or expand what it was already permitted to do.

---

## Section 5: Validation Conclusion

```
VALIDATION RESULT: TRUE (with one hardening note, not a bypass)

EVIDENCE:
1. Authorization happens BEFORE business system execution
   - ExecutionGateway.execute(): packages/execution-gateway/src/ExecutionGateway.ts:399-452
   - SessionCredentialSecureConnector.execute() (policy check precedes credential issuance):
     packages/execution-control/src/SessionCredentialSecureConnector.ts:74-89

2. Boundary location: OUTSIDE business systems
   - Entire verification/policy/session/credential chain runs in Parmana's own process;
     the business system is only ever handed a resolved outbound call:
     packages/execution-gateway/src/connector-execution/SdkConnectorExecutor.ts:85-91

3. Credential protection: SECURE
   - Single-use, time-bounded, revoked on every exit path (finally block):
     packages/execution-control/src/SessionCredentialSecureConnector.ts:83-89
   - Not network-transmitted (in-process resolution), so "interception in transit" doesn't
     apply the way a bearer-token model would suggest.
   - Gateway-to-control-plane hop IS cryptographically signed (Ed25519, request-bound):
     packages/execution-control/src/GatewayAttestation.ts:56-71

VULNERABILITY SCENARIOS:
- Scenario 1 (Compromised business system): BLOCKED — decision already made upstream.
- Scenario 2 (Direct API access bypassing Parmana): BLOCKED within Parmana's own boundary
  (mandatory session-credential wrapping, verified: zero legacyInsecure=true in production).
  Caveat: cannot protect against a leaked native business-system credential used entirely
  outside Parmana — that's a different claim than "bypassing Parmana."
- Scenario 3 (Credential tampering in transit): BLOCKED — no such transit exists for the
  session credential itself; the signed artifacts that DO transit (authorization envelope,
  gateway attestation) are Ed25519-verified and request-bound.

REAL GAPS (non-bypass):
- Hardcoded same-process issuance placeholder with an open TODO (orthogonal: YES — not
  reachable from outside the process, so not a business-system bypass vector; hardening
  item for future multi-process deployment).
- Existence of a code-level legacyInsecure escape hatch, currently unused in production but
  not structurally prevented from being misused (orthogonal in current state: YES, but
  recommend adding a fail-closed startup assertion rather than relying on convention alone).

FINAL STATEMENT:
The claim holds as stated: authorization is fully decided inside Parmana's process — via
Ed25519 signature/replay/policy/signal verification, then a mandatory single-use session-
credential layer — before any business system is invoked, and a compromised or malicious
business system has no code path back into that decision. The one caveat worth carrying
into external conversations is scoped precisely: Parmana's boundary cannot protect a
business-system credential that leaks and gets used entirely outside Parmana's own call
path — that is a business-system credential-hygiene problem, not an authorization-boundary
bypass, and is a distinct claim from the one being validated here.

READY FOR USE IN: External conversations, with the Scenario 2 caveat stated explicitly
rather than implied — regulators and technical investors will ask the "what about a leaked
API key used directly against HubSpot" question, and the honest answer is "outside Parmana's
scope by design," not "impossible."
```
