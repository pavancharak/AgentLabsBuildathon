# Connector Code Review Checklist

See [Connector Credential Isolation](../architecture/CONNECTOR_ISOLATION.md) and
[Building a Connector](./BUILDING_A_CONNECTOR.md) for the architecture this checklist assumes.

## Architecture

- [ ] Connector implements the SDK's `Connector` interface
      (`packages/connector-sdk/src/ConnectorTypes.ts`) — not `ConnectorExecutor` directly (that's
      execution-control's internal interface; `SdkConnectorExecutor` adapts for you).
- [ ] Registered by pushing a new entry into `packages/api/src/bootstrap/createConnectorRegistry.ts`'s
      `registrations` array, following the HubSpot/GitHub pattern exactly.
- [ ] **No `legacyInsecure: true`** on the registration. If you see it on a non-test
      registration, that is a defect — flag it, don't wave it through.
- [ ] No import of `SessionCredentialVault`, `CredentialVault`, or anything from
      `@parmana/execution-control`'s credential types inside the connector class itself — the
      connector receives an already-resolved `CredentialHandle` via
      `ConnectorExecutionContext.credential` and never fetches it.
- [ ] No re-implementation of amount/scope authorization as the primary gate — `PolicyEngine` has
      already approved the request before `execute()` is called. A connector-specific
      defense-in-depth check (e.g. a property allowlist, as HubSpot's does) is fine; treating the
      connector as the place scope gets decided is not.

## Implementation

- [ ] `execute(request: ConnectorRequest, context: ConnectorExecutionContext): Promise<ConnectorResponse>`
      signature matches exactly.
- [ ] Capabilities are namespaced verbs (`namespace:action`, e.g. `hubspot:deal-update`),
      declared via `connectorCapabilities([...])`.
- [ ] Every declared capability has a handler; an undeclared one is rejected before any network
      call (`this.capabilities.includes(request.capability)` checked first).
- [ ] Unsupported/unexpected request parameters are refused outright, not silently dropped or
      silently ignored — a caller's real intent should never be quietly narrowed.
- [ ] Non-2xx responses and timeouts both fail closed (thrown error, not a fabricated success).
- [ ] The resolved credential value is never logged, thrown into an error message, or placed in
      `ConnectorResponse.metadata` beyond a one-way redacted fingerprint.
- [ ] If there's a built-in test-mode/placeholder credential, the connector refuses to send it to
      the real production endpoint — don't rely on the vendor happening to reject it.

## Testing

- [ ] Unit tests cover the connector's own request/response handling and parameter validation —
      not session-credential isolation itself (that's `SessionCredentialSecureConnector`'s test
      suite, already covers every connector automatically).
- [ ] A policy-denied request test exists at the integration level (proves the connector is never
      reached when `PolicyEngine` rejects).
- [ ] A deny-by-default guard (bad parameter, wrong credential shape) is tested and fails before
      any network call.
- [ ] Non-2xx and timeout paths are tested.
- [ ] If the connector has a webhook or async confirmation path, signature verification and
      replay/dedupe are tested directly.

## Documentation

- [ ] What the connector does and which capabilities it exposes is documented.
- [ ] Required configuration (env vars, credential shape) is documented, including what happens
      when it's absent (should be: connector not registered, warning logged — not a crash).

## Approval

- [ ] Reviewer independently confirmed `legacyInsecure` is absent from the registration (don't
      trust a PR description's claim — check the actual diff).
- [ ] Reviewer confirmed the connector never imports execution-control's vault/credential types.
- [ ] Reviewer confirmed test coverage matches the list above, not just "tests exist."

Once every box is checked: the connector is wired for automatic credential isolation and is
ready to review for its actual backend-integration correctness (the part specific to your
connector, which this checklist doesn't cover).
