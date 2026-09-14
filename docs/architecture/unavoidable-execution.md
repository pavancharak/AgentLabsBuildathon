# Parmana-Controlled Execution Architecture

## 1. Executive Summary

AI systems no longer only produce text. They can call APIs, move money, change cloud
infrastructure, update business records, operate databases, and control physical
systems. This changes the security question. It is no longer enough to ask whether an
AI was allowed to propose an action. An enterprise must control whether that action can
actually reach the system that performs it.

Authorization is necessary, but it is not sufficient. A signed authorization proves
what Parmana approved. By itself, it does not prevent an AI that holds credentials from
calling the target directly. It also does not remove alternate network paths around the
authorized route.

Parmana separates proposal from execution:

> AI may propose work.
>
> Parmana decides what may execute.
>
> Only Parmana can release execution.

The AI receives neither enterprise credentials nor a direct route to the target.
Parmana verifies the authorization and the exact content to be executed, then releases
that content through an authenticated Gateway session to a registered connector. Only
the connector can acquire the target credential. The target trusts the connector, not
the AI.

For a target integrated under this deployment model, the AI workload has no target
credential and no network route to the target. The target accepts the connector's
workload identity only. Therefore the only reachable execution path is the Parmana
Gateway and its registered connector.

This is a deployment-scoped claim, not a universal property of TypeScript. Operators
must remove legacy credentials and direct routes, isolate connector processes, enforce
target ingress policy, and protect the Gateway and connector workload identities.

## 2. The Problem

Today's AI platforms can invoke tools with consequences outside the model. A tool call
may create a payment, change a Salesforce record, deploy an application, delete data,
or send a command to a robot. These actions cross an important boundary: they turn a
model output into an enterprise side effect.

Traditional authorization often assumes that the approved request is the request that
will be executed. That assumption can fail in several ways:

- The AI can change its reasoning, plan, or parameters after approval.
- Middleware can transform or incorrectly reconstruct a payload.
- Data can drift between authorization and execution.
- A valid authorization can be replayed.
- An AI that possesses a credential can bypass the approved path entirely.
- A target with alternate ingress paths can be reached without the Gateway.

Cryptographic authorization addresses some of these risks. It can prove that Parmana
approved an exact request and expose modifications or replay. But cryptography cannot
make a credential disappear from the AI process, close an alternate network route, or
force a target to accept traffic from only one execution path.

That is why Parmana needs an execution-control layer. The system must control access to
the capability that causes the side effect, not only produce evidence that an action
was approved.

## 3. The Architectural Principle

Parmana does not attempt to constrain how an AI reasons. Models may reconsider, retry,
hallucinate, or generate different plans. Those behaviors are expected and do not form
the security boundary.

The boundary is enterprise execution. Parmana controls the point at which an approved
proposal obtains the credentials and network access required to become a real action.

The central principle is therefore:

> AI may propose work.
>
> Parmana decides what may execute.
>
> Only Parmana can release execution.

This principle turns authorization from advice that every caller is expected to follow
into a required step on the only reachable path to the target system.

## 4. Design Goals

Each design goal closes a specific route by which approved intent could diverge from
real execution:

- **AI never owns execution credentials.** A component that holds a target credential
  can act without returning to the authorization path. Target credentials are
  therefore not placed in model context, agent memory, Runtime state, requests,
  results, or audit records.
- **AI cannot execute directly.** The AI has no credential and no permitted network
  route to the target or connector execution endpoint. Removing both forms of access
  prevents a direct call from becoming an alternate execution path.
- **Connectors own credential use.** The component closest to the target is the final
  place that can enforce target-specific authority. Credentials are isolated inside
  the connector's trust boundary and are acquired only for a verified execution.
- **The Gateway is the single release point.** Only an authenticated
  `ExecutionGateway` may submit work to the execution channel. This makes release a
  distinct security decision rather than an incidental consequence of authorization.
- **Enterprise systems trust connectors, not AI.** Target IAM and ingress policy accept
  the identity of the appropriate connector. The target therefore enforces the same
  execution boundary even when an AI attempts to bypass upstream software.
- **Authorization remains independently verifiable.** The existing signed envelope and
  canonical `EnvelopeVerifier` remain the source of cryptographic authorization truth.
  Verification does not depend on trusting the AI's account of what was approved.
- **Executed content exactly matches authorized content.** The Gateway and connector
  independently compare the canonical content hash with the signed authorization.
  This prevents approval of one action from being reused for altered executable data.
- **Every release is single-use and attributable.** Authorization nonces and connector
  sessions prevent replay; audit events link authorization, execution, session,
  connector, credential use, and outcome. A valid approval cannot silently become
  permission for repeated execution.
- **The Runtime remains stable.** The layer extends the existing `ExecutionSystem` seam
  without changing policy evaluation, decisions, authorization format, cryptography,
  or `EnvelopeVerifier` behavior. Execution control can therefore be added without
  redefining the authorization model it is intended to enforce.
- **Connectors remain technology-neutral.** The same control model can support business
  applications, cloud platforms, databases, internal APIs, robots, and IoT systems
  through target-specific adapters. The security boundary stays consistent while the
  target operation and credential mechanism vary.

## 5. Architecture

The architecture separates four zones. The AI operates in an untrusted proposal zone.
The Parmana control plane verifies and releases work. Credentials exist only inside the
credential zone. Side effects occur in the target zone.

```text
 UNTRUSTED / PROPOSAL ZONE       PARMANA CONTROL PLANE       CREDENTIAL ZONE       TARGET ZONE

 AI Agent --> Runtime --> signed authorization --> ExecutionGateway
                                                   | canonical EnvelopeVerifier
                                                   | executable-content hash
                                                   | authenticated workload identity
                                                   v
                                          ExecutionChannel --> ConnectorRegistry
                                                                    |
                                                         one-time bound session
                                                                    v
                                                           SecureConnector
                                                           | capability policy
                                                           | session + hash check
                                                           v
                                                     CredentialVault --> Target
                                                     (opaque lease)     System
```

In business terms, the Runtime decides whether a proposal complies with policy. The
Gateway proves that the approval is valid and still applies to the exact action being
released. The execution channel permits only the Gateway to release work. The registry
selects an enterprise-owned connector. The connector checks its own authority, obtains
the least-privilege credential, and performs the action against the target.

In implementation terms, the existing Runtime, authorization envelope, cryptography,
and `EnvelopeVerifier` remain canonical and unchanged. `ExecutionGateway` still
implements the existing `ExecutionSystem` port. Controlled execution is an additive
Gateway configuration; the legacy `connector` configuration remains compatible.

### Package structure

```text
packages/execution-gateway/src/
  ExecutionGateway.ts                 canonical verification + release point
  execution-control/
    types.ts                          public ports and immutable messages
    ConnectorRegistry.ts              connector identity lookup
    DefaultExecutionChannel.ts        Gateway authentication + session creation
    InMemoryGatewaySessionAuthority.ts reference one-time session authority
    CapabilityConnectorPolicy.ts      action/resource capability enforcement
    DefaultSecureConnector.ts         connector authentication + credential use
    MemoryExecutionAuditSink.ts       reference audit sink
```

The package keeps control-plane responsibilities distinct. `ExecutionGateway.ts` is
the release boundary. The `execution-control` package area contains the ports and
reference components needed to authenticate the Gateway, route to a connector, bind a
single-use session, apply connector capabilities, isolate credential use, and record
the outcome.

Production adapters implement `GatewaySessionAuthority`, `CredentialVault`,
`CredentialedTarget`, and `ExecutionAuditSink`. Cloud IAM, OAuth, KMS, and concrete
vault products are deliberately outside this layer.

### Interfaces and integration points

Each interface exists to keep a security decision explicit and replaceable:

- `GatewayIdentityProvider` presents the Gateway workload identity to the channel. It
  prevents possession of request data from being treated as permission to release it.
- `ExecutionChannel` accepts verified releases only from that identity. It is the
  authenticated boundary between verification and connector invocation.
- `ConnectorRegistry` resolves a stable connector identity; connectors are never
  supplied by an AI request. This keeps routing under deployment control.
- `GatewaySessionAuthority` opens and atomically consumes sessions bound to connector,
  execution, authorization, content hash, and expiry. This prevents reuse or movement
  of a release to another execution context.
- `ConnectorPolicy` intersects the requested action and target with connector
  capabilities. A connector cannot use its credential for an unsupported operation.
- `CredentialVault` returns an opaque, short-lived lease inside the connector. It
  separates credential custody from the Runtime and Gateway.
- `CredentialedTarget` is the only code that sees the credential handle. It contains
  the target-specific operation without exposing credentials to upstream components.
- `ExecutionAuditSink` records the session, credential use, rejection, and outcome. It
  provides evidence without becoming the enforcement mechanism.

The Runtime integration is unchanged: inject `ExecutionGateway` at the existing
`ExecutionSystem` seam. Configure either the existing `connector` option or the new
`executionControl` option. No policy, decision, authorization, or verifier type changes.

## 6. Execution Flow

The sequence below shows the complete path from a proposal to a target side effect.

```text
AI -> Runtime: propose transaction
Runtime -> Gateway: ExecutionRequest + signed authorization
Gateway -> EnvelopeVerifier: signature, version, expiry, TTL
Gateway -> Gateway: recompute content hash; atomically consume authorization nonce
Gateway -> ExecutionChannel: frozen verified content + Gateway identity
ExecutionChannel -> Registry: resolve deployment-selected connector
ExecutionChannel -> SessionAuthority: open one-time bound session
ExecutionChannel -> SecureConnector: request + session
SecureConnector -> SecureConnector: recompute hash; authenticate/consume session
SecureConnector -> ConnectorPolicy: check action and target capabilities
SecureConnector -> CredentialVault: acquire opaque lease
SecureConnector -> Target: execute exact verified content with lease
SecureConnector -> CredentialVault: release lease
SecureConnector -> AuditSink: record outcome
```

The major steps exist for distinct reasons:

1. **Proposal and policy decision.** The AI proposes a transaction; the Runtime applies
   enterprise policy. The AI does not gain execution power by making the proposal.
2. **Signed authorization.** The Runtime sends the request with a content-bound
   authorization. This creates independently verifiable evidence of exactly what was
   approved.
3. **Gateway verification.** The Gateway checks signature, format version, expiry, TTL,
   content hash, and nonce. Invalid, changed, expired, or replayed requests stop before
   connector routing.
4. **Authenticated release.** The Gateway sends frozen content and its workload
   identity to the execution channel. Correct data alone is insufficient; the caller
   must also be the trusted Gateway.
5. **Deployment-owned routing.** The registry resolves the connector chosen by the
   deployment. The AI cannot register or nominate a connector through request data.
6. **Single-use session binding.** The session authority binds the release to one
   connector, execution, authorization, content hash, and expiry. A captured session
   cannot be moved or used twice.
7. **Connector verification and policy.** The connector independently recomputes the
   hash, consumes the session, and checks action and target capabilities. This protects
   the credential boundary even if an upstream caller sends an invalid invocation.
8. **Credential acquisition and execution.** Only after every check passes does the
   connector acquire an opaque lease and invoke the target with the exact verified
   content.
9. **Credential release and audit.** The connector releases the lease and records the
   outcome. Credential lifetime is limited, and the execution remains attributable.

All decisions before credential acquisition are deterministic for the same request,
registry snapshot, capabilities, clock, and nonce/session state. Nonce and session
consumption are the two explicit atomic side effects.

## 7. Trust Boundaries

A trust boundary exists wherever data or authority moves between components with
different attacker assumptions. The AI is assumed to be able to produce arbitrary
requests. The Gateway and connectors are trusted enforcement components but remain
separately authenticated. The vault and target are protected resources.

| Boundary          | Why it exists                                                                                             | Required control                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| AI to Runtime     | Model output is untrusted input, not execution authority.                                                 | AI is untrusted and receives no target or vault credentials.             |
| Gateway channel   | An attacker may possess valid request data without being the authorized release service.                  | mTLS/workload identity; ingress permits the Gateway only.                |
| Connector process | The component that can obtain credentials requires stronger isolation than the proposal or policy layers. | Separate identity/process; no public AI-reachable endpoint.              |
| Credential vault  | Credential custody must remain outside the AI, Runtime, and Gateway.                                      | Connector identity may acquire only its named credential.                |
| Target ingress    | Credential isolation is ineffective if the target remains reachable through another path.                 | Network and IAM policy accept connector identities only.                 |
| Audit             | Security investigations require durable evidence independent of volatile service state.                   | Append-only sink with authorization, session, connector, and result IDs. |

The in-memory session authority and identity presentation are reference/test adapters,
not process or network security boundaries. A production deployment replaces them with
mutually authenticated transport and atomic shared replay storage.

## 8. Threat Model and Mitigations

The model treats the AI and its requests as untrusted. It also considers stolen
artifacts, replay, routing manipulation, and compromise of trusted components.

| Attack                                              | Why it matters                                                                                                           | Mitigation and why it works                                                                                                                                                                                  | Required assumption                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| AI calls the target directly                        | If the AI can reach the target with a credential, it can ignore every Parmana decision.                                  | AI has neither credential nor network route; target IAM trusts connector identity only. The call therefore cannot be authenticated or delivered.                                                             | Target credentials and ingress policy are exclusively controlled as described.                         |
| AI calls a connector directly                       | A connector is credential-adjacent, so a public invocation path would become a bypass.                                   | Connector requires a Gateway-authenticated, one-time session. Request content alone cannot create that session.                                                                                              | Connector ingress and Gateway identity are protected.                                                  |
| Stolen authorization with changed amount/target     | A valid signature must not approve a modified payment, resource, or command.                                             | Gateway and connector recompute the canonical content hash. Modified content no longer matches the signed hash.                                                                                              | Canonical hashing and authorization verification remain trustworthy.                                   |
| Authorization replay                                | A previously valid action may be harmful if performed more than once.                                                    | Existing nonce store atomically rejects the second use, even if the envelope remains unexpired.                                                                                                              | All relevant instances share atomic nonce state.                                                       |
| Connector-session replay                            | Replaying a release after Gateway verification could repeat the target side effect.                                      | Session authority atomically consumes the session once, so later invocations fail before credential acquisition.                                                                                             | All relevant instances share atomic session state.                                                     |
| Session moved to another connector or execution     | A captured session must not authorize a different target path or transaction.                                            | Session binds connector, execution, authorization, content hash, and expiry. Any changed binding fails authentication.                                                                                       | Session authority and connector correctly validate every binding.                                      |
| Over-privileged connector invocation                | A connector credential may cover more operations than the current request should use.                                    | Connector capabilities and policy reject unsupported actions/target prefixes before credential acquisition. This narrows usable authority at the final enforcement point.                                    | Connector policy and capability configuration are deployment-owned and correct.                        |
| Credential exfiltration through Runtime/AI response | A credential returned upstream would restore the direct-execution path Parmana is intended to remove.                    | Vault access exists only in the connector; requests, authorization, audit events, and results contain no credential.                                                                                         | Connector isolation and vault permissions prevent upstream access.                                     |
| Registry/routing manipulation                       | Redirecting approved work to an attacker-controlled connector would bypass credential and policy controls.               | Registry and route configuration are deployment-owned; AI data cannot select or register a connector.                                                                                                        | Deployment configuration is protected from AI-controlled writes.                                       |
| Compromised connector                               | A connector can legitimately acquire a scoped credential, so compromise may produce real side effects within that scope. | Limit blast radius with per-connector identity, least-privilege credential, egress policy, short leases, and target audit reconciliation. These controls contain rather than eliminate connector compromise. | IAM, egress, lease scope, and audit reconciliation are enforced outside the compromised process.       |
| Compromised Gateway                                 | The Gateway is the trusted release authority; compromise could turn valid policy results into malicious releases.        | This layer cannot protect against its trusted release authority; isolate it, attest its workload, and monitor append-only audit records.                                                                     | Gateway isolation, identity protection, attestation, and external audit monitoring remain trustworthy. |
| Legacy credential or alternate target route         | Any unmanaged execution path disproves the claim that Parmana is unavoidable.                                            | Remove it or the unavoidability claim does not hold; continuously reconcile target-native logs against Parmana executions to detect exceptions.                                                              | Operators remove or explicitly govern every bypass and retain target-native evidence.                  |

## 9. Security Guarantees

The architecture provides different kinds of guarantees. Keeping them separate avoids
claiming that cryptography can enforce deployment topology or that network controls can
prove request integrity.

### Cryptographic guarantees

- The authorization can be independently verified using the existing canonical
  `EnvelopeVerifier` and Parmana public key.
- A modified action, target, parameter set, or business transaction identifier cannot
  reuse the authorization because the executable-content hash will differ.
- An expired authorization fails verification.
- A consumed authorization nonce causes a replay attempt to fail.
- These guarantees preserve the existing authorization format and cryptography; this
  layer does not redefine them.

### Architectural guarantees

- The Runtime and AI never receive the connector's credential handle.
- The execution channel accepts releases only with the configured Gateway identity.
- A secure connector rejects invocations without an authenticated, content-bound,
  single-use Gateway session.
- Connector sessions cannot be reused or moved to another connector, execution,
  authorization, content hash, or expiry context.
- Connector capability checks occur before credential acquisition.
- The credential lease exists only inside the secure connector-to-target path and is
  released after use.
- Every accepted controlled execution can be linked to its authorization, session,
  connector, credential acquisition event, and result.

### Guarantees that depend on deployment

- AI cannot execute directly only when it has no target credential and no alternate
  network route.
- Enterprise execution always passes through Parmana only when target IAM and ingress
  accept connector identities exclusively.
- Credential isolation is effective only when connector processes and vault permissions
  are isolated from AI and Runtime workloads.
- Gateway and connector authentication is effective only when their workload identities
  and mutually authenticated transport are protected.
- Cross-process replay protection requires atomic shared nonce and session storage.

Under those deployment conditions, planning, retrying, hallucinating, or changing a
request cannot create a Gateway identity, connector session, vault lease, target
credential, or target network route. Only Parmana can release execution.

## 10. Deployment Assumptions

"Unavoidable execution" is a deployment property, not a property of TypeScript or the
Runtime alone. The claim holds for an integrated target only when all of the following
conditions are true:

- The AI, agent tools, Runtime, and general middleware hold no target credentials.
- Legacy credentials are removed, disabled, or isolated as explicit exceptions.
- The target has no alternate network route reachable by the AI workload.
- Target IAM permits the registered connector identity and denies AI identities.
- Target ingress permits connector traffic and rejects direct AI traffic.
- Connector processes run under separate, protected workload identities.
- Vault policy permits each connector to acquire only its named, least-privilege
  credential.
- The Gateway identity is protected and accepted only by the execution channel.
- Connector identities are protected and accepted only by their intended vault and
  target scopes.
- Production transport uses mutual authentication, such as mTLS or equivalent workload
  identity enforcement.
- Nonce and session consumption use atomic storage shared by all relevant instances.
- Registry and routing configuration remain deployment-owned and are not writable by
  AI-controlled request data.
- Audit storage is append-only, and target-native activity is reconciled against
  Parmana execution records.

Break-glass users, vendor consoles, unmanaged credentials, or alternate network paths
are explicit bypasses. They must be removed, isolated, monitored, or reported as
exceptions rather than hidden by the claim.

## 11. Why This Is Different

Many security systems stop after deciding whether a caller is permitted and recording
what happened:

```text
Identity
    |
    v
Authorization
    |
    v
Logging
```

That model can establish who asked, what policy allowed, and what the application says
occurred. It does not necessarily control the capability that reaches the enterprise
system. If the AI still holds a credential or can use another route, authorization and
logging can be bypassed.

Parmana continues through the execution boundary:

```text
Authorization
    |
    v
Verification
    |
    v
Execution Gateway
    |
    v
Credential Isolation
    |
    v
Connector Enforcement
    |
    v
Enterprise System
```

Cryptographic authorization proves what Parmana approved. The execution-control layer
controls whether approved work can obtain the capability to act. The capability is
released only after canonical verification, is scoped to one registered connector and
one exact execution, and is consumed before that connector acquires its credential.

This is fundamentally different from recording execution. Logging observes or reports
a side effect after a component had the power to cause it. Parmana places verification,
credential custody, and connector enforcement before the side effect. Audit remains
important, but it supports evidence and detection rather than serving as the primary
control.

## 12. Future Evolution

The interfaces intentionally leave room for stronger production adapters without
changing the core Runtime or authorization model. Possible areas of future work include:

- stronger process, container, and host isolation for connectors;
- hardware-backed Gateway and connector workload identities;
- confidential-computing environments for credential use and connector execution;
- distributed execution channels with shared atomic replay protection;
- additional connectors for enterprise applications, cloud platforms, databases,
  internal APIs, robots, and IoT systems.

These are architectural directions, not current guarantees or promised features. Each
would require its own implementation, deployment controls, tests, and evidence before
expanding the security claim.
