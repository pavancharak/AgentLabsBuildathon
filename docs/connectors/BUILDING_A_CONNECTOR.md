# Building a Connector for Parmana

**Status:** Verified against source, 2026-08-24, using the real HubSpot and GitHub connectors as
reference. See [Connector Credential Isolation](../architecture/CONNECTOR_ISOLATION.md) first —
this guide assumes that architecture.

**Scope, precisely:** there is no dynamic/runtime registration path. Adding a connector is a
bootstrap source change today — you add files following the pattern below and add one entry to
`packages/api/src/bootstrap/createConnectorRegistry.ts`. This matches what the codebase's own
roadmap documentation says explicitly: *"no dynamic registration path, no environment variable
that adds a connector, this is a code change today."*

## Anatomy of a connector

A connector is three things, all following the HubSpot/GitHub pattern:

1. A class implementing the SDK's `Connector` interface (`packages/connector-sdk/src/ConnectorTypes.ts`) —
   lives in `packages/execution-gateway/src/connector-execution/GatewayXAdapter.ts`.
2. A small factory function that constructs it — `createGatewayXConnector.ts`, same directory.
3. Two bootstrap files in `packages/api/src/bootstrap/`: `createXConnector.ts` (builds the
   connector, returns `undefined` if not configured) and `createXCredentialProvider.ts` (same,
   for credentials) — then one new registration pushed into `createConnectorRegistry.ts`.

You never touch `SessionCredentialVault`, `PolicyEngine`, or credential isolation code directly.
That's the point of the architecture this guide is following.

## Step 1: Implement the `Connector` interface

```ts
// packages/connector-sdk/src/ConnectorTypes.ts — the real, unmodified interface
export interface Connector {
  readonly connectorId: string;
  readonly capabilities: ConnectorCapabilities;
  execute(request: ConnectorRequest, context: ConnectorExecutionContext): Promise<ConnectorResponse>;
}
```

`ConnectorRequest` gives you `capability`, `businessTransactionId`, `action`, `target`, and
`parameters` — exactly what Parmana already authorized, nothing you re-interpret.
`ConnectorExecutionContext.credential` is an **opaque, already-resolved `CredentialHandle`** —
you read `context.credential.value`, you never fetch or resolve it yourself.

A trimmed version of the real HubSpot adapter
(`packages/execution-gateway/src/connector-execution/GatewayHubSpotAdapter.ts`):

```ts
export class GatewayHubSpotAdapter implements Connector {
  readonly connectorId: string;
  readonly capabilities: ConnectorCapabilities;

  constructor(private readonly options: HubSpotConnectorOptions) {
    this.connectorId = options.connectorId;
    this.capabilities = options.capabilities;
    Object.freeze(this);
  }

  async execute(
    request: ConnectorRequest,
    context: ConnectorExecutionContext,
  ): Promise<ConnectorResponse> {
    if (!this.capabilities.includes(request.capability)) {
      throw new Error(`does not declare capability "${request.capability}"`);
    }

    // context.credential is already resolved — you never call the vault.
    const { privateAppToken } = context.credential.value as { privateAppToken: string };

    switch (request.capability) {
      case HUBSPOT_DEAL_FETCH_CAPABILITY:
        return await this.fetchDeal(request, privateAppToken, context.timeoutMs);
      case HUBSPOT_DEAL_UPDATE_CAPABILITY:
        return await this.updateDeal(request, privateAppToken, context.timeoutMs);
      default:
        throw new Error(`no handler for capability "${request.capability}"`);
    }
  }
}
```

Notice what the real connector does that a naive example wouldn't show:

- **Deny-by-default on parameters.** HubSpot's `updateDeal` refuses any property outside an
  explicit allowlist (`HUBSPOT_ALLOWED_DEAL_UPDATE_PROPERTIES`) *before* any network call — not
  silently dropping it, refusing outright.
- **Refuses its own test-mode placeholder credential against the real API.** Don't rely on the
  vendor happening to reject a bad credential — that's an accident of their behavior, not
  something this codebase controls.
- **Fail-closed on non-2xx and on timeout**, via `AbortController` + a dedicated
  `parseOrFailClosed`.

Capability strings must be namespaced verbs (`isNamespacedCapability`, e.g. `hubspot:deal-update`),
declared via `connectorCapabilities([...])` — this validates at construction time, not at
execution time.

## Step 2: Register your connector (the actual production path)

There is no `registry.register('my-connector', new MyConnector())` call you make at runtime.
Instead, follow the exact structure `createConnectorRegistry.ts` already uses for HubSpot:

```ts
// packages/api/src/bootstrap/createConnectorRegistry.ts — real source, abridged
const myCredentialProvider = createMyConnectorCredentialProvider();

if (myCredentialProvider === undefined) {
  console.warn({ event: "my_connector_unavailable", reason: "MY_CONNECTOR_TOKEN is not configured." });
} else {
  registrations.push({
    connector: createMyConnector(),
    metadata: MyConnectorMetadata,
    connectorIdentity: {
      connectorId: "my-connector",
      publicIdentity: "spiffe://parmana/connectors/my-connector",
      authenticationMetadata: {},
    },
    credentialProvider: myCredentialProvider,
    policy: new DefaultConnectorPolicy(authenticator, sessions),
    gatewayAuthentication,
    crypto,
    audit,
    // no legacyInsecure — isolation is automatic
  });
}
```

`createGatewayConnectorRegistry(registrations)` (`packages/execution-gateway/src/connector-execution/createGatewayConnectorRegistry.ts`)
then constructs one `GatewayConnectorRegistry` and calls `.register()` for every entry. As long as
you don't set `legacyInsecure: true`, you get `SessionCredentialSecureConnector` isolation for
free — no extra step needed. See
[Connector Credential Isolation](../architecture/CONNECTOR_ISOLATION.md) for exactly what that
wrapper does.

The credential-provider pattern (`createXCredentialProvider()` returning `undefined` when not
configured, logging and simply not registering the connector rather than crashing) is what makes
a connector "optional" in a given deployment — following `createHubSpotCredentialProvider.ts`'s
own pattern.

## Step 3: Write tests

Test your connector's own logic — request handling, parameter validation, error mapping. Do
**not** write tests for session-credential isolation itself; that's already covered by
`SessionCredentialSecureConnector`'s own test suite (`packages/execution-control/tests/`) and
applies to your connector automatically.

What HubSpot's own test suite (`packages/execution-gateway/tests/unit/`, `packages/api/tests/integration/`)
actually verifies, as a model for what yours should cover:

- An approved request succeeds and returns the expected `ConnectorResponse`.
- A policy-denied request never reaches the connector at all.
- A deny-by-default guard (unsupported parameter, wrong credential shape) is rejected *before*
  any network call.
- A non-2xx response and a timeout both fail closed with a clear error, not a silent success.
- The credential value is never logged or placed in the response's `metadata` beyond a one-way
  redacted fingerprint (see `redactHubSpotToken` for the pattern).

## Common mistakes to avoid

**Don't try to call `SessionCredentialVault` yourself** — you never receive it, and there's no
constructor seam for it in `Connector`. If you find yourself importing
`@parmana/execution-control`'s vault types into a connector, something is architecturally wrong.

**Don't re-implement scope/amount checks inside `execute()`** as the primary control — `PolicyEngine`
has already run before your connector is ever called. A defense-in-depth guard specific to your
backend (like HubSpot's property allowlist above) is fine and encouraged; re-deciding "is this
amount allowed" from scratch is not your layer's job.

**Don't set `legacyInsecure: true`** on a production registration. It's documented, verbatim, as
"for tests only," and registering without it also requires you to supply the shared
`ExecutionAuditSink` — skipping both is possible only by deliberately doing so, not by omission.

## Reference implementations

- **HubSpot** — `packages/execution-gateway/src/connector-execution/GatewayHubSpotAdapter.ts`,
  bootstrap in `packages/api/src/bootstrap/createHubSpotConnector.ts` /
  `createHubSpotCredentialProvider.ts`, domain types/capabilities in `packages/connector-hubspot/src/`.
- **GitHub** — `packages/execution-gateway/src/connector-execution/GatewayGitHubAdapter.ts`,
  bootstrap in `packages/api/src/bootstrap/createGitHubConnector.ts` /
  `createGitHubCredentialProvider.ts`, domain types/capabilities in `packages/connector-github/src/`.
- **Slack** — a from-scratch worked example (not a production capability), built exactly following
  this guide: `packages/execution-gateway/src/connector-execution/GatewaySlackAdapter.ts`, bootstrap
  in `packages/api/src/bootstrap/createSlackConnector.ts` / `createSlackCredentialProvider.ts`,
  domain types/capabilities in `packages/connector-slack/src/`. See
  `docs/connectors/SLACK_CONNECTOR.md` and tutorials 111/112 for the full walkthrough, including a
  real-API correctness detail (Slack always answers HTTP 200; failure is only in the JSON body).

All follow the identical pattern described above; read them side by side before starting a new
connector.
