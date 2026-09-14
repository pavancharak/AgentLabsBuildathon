# Connector Developer FAQ

See [Connector Credential Isolation](../architecture/CONNECTOR_ISOLATION.md) for the full
architecture; this page answers the questions that come up while actually building one.

### Do I need to wire credential isolation myself?

No. Every connector registered through the standard path
(`packages/api/src/bootstrap/createConnectorRegistry.ts` → `createGatewayConnectorRegistry`) is
automatically wrapped in `SessionCredentialSecureConnector`
(`packages/execution-gateway/src/connector-execution/GatewayConnectorRegistry.ts`). You don't
call anything to turn this on — it's the default, and skipping it requires an explicit
`legacyInsecure: true` flag whose own doc comment says "for tests only."

### Where should I enforce scope limits (amount, allowed action)?

Upstream, in `PolicyEngine` (`packages/policy/src/PolicyEngine.ts`), before your connector is
ever invoked. Your connector receives a request that has already passed policy. A
connector-specific defense-in-depth check (like HubSpot's property allowlist, refusing to touch
any deal field outside a fixed set) is fine as an extra guard — but the authorization decision
itself is not your layer.

### Should I call `SessionCredentialVault` directly?

No — and you can't easily even if you tried. Your connector never receives a `SessionCredentialVault`
reference; it receives an already-resolved `CredentialHandle` via
`ConnectorExecutionContext.credential`. The wrapper (`SessionCredentialSecureConnector`) is the
only thing that ever calls `issue()` / `consume()` / `revoke()`.

### How do I get the credential my connector needs?

Through `context.credential.value` in `execute(request, context)` — already resolved for you.
You never fetch, decrypt, or look it up yourself.

### What if I want to disable isolation for a test?

Set `legacyInsecure: true` on that registration. It requires you to _not_ set the
`ExecutionAuditSink` (or the registry throws), and its type doc explicitly says every production
connector should go through the default path instead. If you see this flag set on a real,
env-configured connector rather than a test fixture, that's a bug worth flagging in review.

### What if a compromised session needs to be cut off mid-flight?

That's `revoke()` — called automatically in a `finally` on every exit path (success, executor
failure, or a late policy rejection) by `SessionCredentialSecureConnector`. Not something your
connector code needs to trigger itself.

### How do I know isolation is actually working for my connector?

`SessionCredentialSecureConnector`'s own test suite
(`packages/execution-control/tests/`) proves the wrapper's issue/consume/revoke/expiry behavior
once, generically, for every connector that goes through it. Your job is testing your connector's
own request handling, not re-proving the wrapper — see
[Building a Connector](./BUILDING_A_CONNECTOR.md)'s testing section for what to actually cover.

### Can I add a connector without a code change — some config or plugin path?

No, not today. There is no dynamic registration path — adding a connector means adding the files
described in [Building a Connector](./BUILDING_A_CONNECTOR.md) and one new entry in
`createConnectorRegistry.ts`. This is a stated, current scope limit, not an oversight.

### What interface do I actually implement — `Connector` or `ConnectorExecutor`?

`Connector` (`packages/connector-sdk/src/ConnectorTypes.ts`). `ConnectorExecutor` is
execution-control's internal interface, satisfied on your behalf by `SdkConnectorExecutor`
(`packages/execution-gateway/src/connector-execution/SdkConnectorExecutor.ts`) — you never
implement it yourself.
