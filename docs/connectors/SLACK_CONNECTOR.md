# Slack Connector

**Status:** a worked example of `docs/connectors/BUILDING_A_CONNECTOR.md`'s pattern, built from
scratch — not a production capability with an operational rollout plan. It exists to show a
complete, real (non-mock) connector implementation end to end: `packages/connector-slack` (domain
types, `MockSlackServer`), `packages/execution-gateway/src/connector-execution/GatewaySlackAdapter.ts`
(the executable class, calling Slack's real Web API), bootstrap wiring in
`packages/api/src/bootstrap/`, a real policy (`policies/slack-post-message/1.0.0`), and two runnable
tutorials (`examples/tutorials/112-slack-connector`, and the caller side in
`examples/tutorials/111-connect-an-agent`).

## Why this connector is a useful second example, not a duplicate of HubSpot's

HubSpot and GitHub both call their vendor's real API **in-process**, and this connector follows
that exact shape (unlike Paytm, which proxies to a separate service) — but Slack's real API has a
correctness detail HubSpot's doesn't, worth seeing modeled explicitly:

**Slack's `chat.postMessage` always answers HTTP 200 — even on failure.** Success or failure is
signaled only by the JSON body's `ok` boolean plus an `error` string (`invalid_auth`,
`channel_not_found`, `rate_limited`, ...). A connector that checked only `response.ok` (the HTTP
flag) would treat every one of those as a silent success. `GatewaySlackAdapter.execute()` parses
the body and fails closed on `ok: false` explicitly — see its class doc comment and
`SlackTypes.ts`'s `SlackPostMessageResponse`.

## Flow

```text
Agent
  |  POST /execute  { action: "slack:post-message", target: <channelId>, parameters: {channel, text} }
  v
Parmana
  |  policy: slack-post-message@1.0.0
  |  bound signal: channelId == intent.target
  |  APPROVE requires: contentApproved && channelAuthorized
  v
  +-- REJECT  -> stop, Slack is never called
  |
  +-- APPROVE
        |
        v
  GatewaySlackAdapter
        |  deny-by-default: only {channel, text} are ever sent
        v
  POST https://slack.com/api/chat.postMessage
        |
        v
  ok: true  -> ConnectorResponse.success: true
  ok: false -> thrown, fails closed (never a silent success)
```

## Capability and policy binding

Exactly one capability: `slack:post-message`
(`packages/connector-slack/src/SlackCapabilities.ts`). Bound, in
`packages/capability-registry/src/CapabilityPolicyBinding.ts`'s
`CANONICAL_CAPABILITY_POLICY_BINDINGS`, to `slack-post-message@1.0.0`. `assertConnectorCapabilitiesBound.ts`
refuses to start the process if this binding is ever removed while the connector stays registered —
the same fail-closed startup guardrail every other connector gets.

## Trust / connector identity

`slack` / `spiffe://parmana/connectors/slack`, added to both
`packages/api/src/bootstrap/createConnectorAuthenticator.ts`'s trusted-connector-identity list and
its registration in `createConnectorRegistry.ts`. Subject to the same
`SignedTokenConnectorAuthenticator` check as every other connector.

## Environment variables

```
SLACK_BOT_TOKEN=            # Real bot token (xoxb-...). If unset, the connector is simply not
                             # registered -- no crash, mirrors HubSpot/GitHub's optional-connector
                             # behavior.
SLACK_BASE_URL=              # Test seam only. Points the connector at a mock server instead of
                             # https://slack.com. Never set in production.

TEST_SLACK_BOT_TOKEN=       # Test-mode token (NODE_ENV=test), read directly, no bridge variable.
```

## Deny-by-default and credential handling

- `SLACK_ALLOWED_POST_MESSAGE_PARAMETERS` (`["channel", "text"]`) is the only set of fields this
  connector will ever place in a `chat.postMessage` request body — an unsupported parameter is
  refused before any network call, not silently dropped.
- The bot token is never logged or returned in a response; only a one-way SHA-256 fingerprint
  (`redactSlackToken`) is placed in `ConnectorResponse.metadata`.
- A built-in test-mode placeholder token (`SLACK_TEST_MODE_PLACEHOLDER_TOKEN`) is refused outright
  against any non-local base URL, before any network call — never relying on Slack happening to
  reject it.
- Requires HTTPS outside `NODE_ENV=test`, checked at construction time, mirroring
  `GatewayPaytmAdapter`'s own guard.

## What this connector does not do

- It is not wired into any live, deployed Parmana instance's positioning or claims documentation —
  it is explicitly a from-scratch worked example, unlike Paytm/HubSpot/GitHub.
- It sends exactly one message per approved transaction; it has no retry, no thread/reply support,
  and no other Slack Web API method.
- There is no gated live-integration suite here (unlike HubSpot's `ALLOW_LIVE_HUBSPOT`) — running
  one against a real Slack workspace is open work for whoever wants to exercise it live.

## Reference

- Tutorial 111 (`examples/tutorials/111-connect-an-agent`) — the caller side, through the real HTTP
  layer, using the existing `paytm:refund`/`customer-refund` pipeline.
- Tutorial 112 (`examples/tutorials/112-slack-connector`) — this connector end to end: an approved
  post that really reaches the mock server, a policy denial that never calls Slack, and a
  `channelId`/`intent.target` mismatch caught by `SignalIntentBinder` before policy evaluation even
  runs.
