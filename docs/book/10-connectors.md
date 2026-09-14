[← Book Index](README.md) · [← Previous: Chapter 9, Credential Isolation](09-credential-isolation.md)

# Chapter 10: Connectors

`packages/connector-sdk/src/`, `packages/connector-hubspot/src/`, `packages/connector-github/src/`.

## The contract

```typescript
// packages/connector-sdk (ConnectorTypes.ts), abridged
export interface Connector {
  readonly connectorId: string;
  readonly capabilities: ConnectorCapabilities;
  execute(request, context): Promise<ExecutionResult>;
}
```

A `Connector` "NEVER evaluates policy, authorizes execution, interprets AI output, performs
business decisions, or resolves credentials." It validates a request, executes using an
already-resolved credential (Chapter 9), and returns a response with a fixed, predictable
shape. It's only ever reachable via `SdkConnectorExecutor` through `execution-control`'s
`SecureConnector` to the Execution Gateway; nothing calls a connector directly.

`MockConnector` is the reference test double: scripted (`respond`/`failWith`), records every
`invocation`. The four "enterprise" reference connectors, SAP, Oracle, Workday, Salesforce,
are each one-line factory functions wrapping `MockConnector` with a single fixed capability
(for example, SAP: `"sap:post-invoice"`), and each is explicitly commented as a placeholder
"used until the real enterprise connector is implemented." They should never be represented
as real SAP/Oracle/Workday/Salesforce connectivity. They are deterministic, in-memory
stand-ins, and this codebase's own documentation is careful to say so directly rather than
let the naming imply otherwise.

`HttpConnector` and `SdkConnectorExecutor`, despite the package name suggesting otherwise,
actually live in `@parmana/execution-gateway`, not `@parmana/connector-sdk`. `HttpConnector`
is documented as the same HTTP forwarding `@parmana/execution-system`'s `HttpExecutionSystem`
performed, refactored to sit behind the Execution Gateway, and `SdkConnectorExecutor` is "the
only place the Gateway's connector-execution layer touches the execution-control execution
path," checking a connector-version mismatch and refusing a connector whose own
`metadata.health.status === "unavailable"`.

## The two real, currently-registered connectors

**HubSpot**, the first real (non-mock) connector, making genuine external API calls.
Capabilities: `hubspot:deal-fetch`, `hubspot:deal-update`. Covered in depth by Chapters 2
and 3 (its `boundSignals` and `HubSpotSignalStateVerifier`) and Chapter 14 (its policy
`hubspot-deal-update/1.0.0`, canonically bound per Chapter 4). Registers only when
`HUBSPOT_PRIVATE_APP_TOKEN` is configured; fails closed to "not registered" otherwise, never
a partially-configured connector. That token is a long-lived static credential, unlike
GitHub's ephemeral per-execution token below. `warnIfHubSpotTokenStale()` (added
2026-09-10) logs a startup reminder once it's over 90 days old, or if
`HUBSPOT_PRIVATE_APP_TOKEN_ROTATED_AT` was never set at all. A reminder, not enforcement:
this process has no way to revoke or replace a HubSpot-side token itself.

**GitHub**, the second real connector, capabilities `github:pr-fetch`/`github:pr-merge`.
Auth model is a GitHub App: `GitHubAppJwt.ts` hand-rolls an RS256 JWT rather than pulling in
a JWT library, with a doc comment explaining why directly: this "matches this codebase's
existing preference for native `node:crypto` over pulling in a dependency for a
security-sensitive primitive," the same preference Chapter 6's signature providers embody.
The App JWT itself is never sent to GitHub's REST API directly; it's exchanged once for a
short-lived installation access token via `GitHubAppCredentialProvider`, and `GITHUB_BASE_URL`
is explicitly documented as a test-only seam pointing at `MockGitHubServer`, "never set in
production." Registers conditionally on all three of `GITHUB_APP_ID`/`GITHUB_INSTALLATION_ID`/
`GITHUB_APP_PRIVATE_KEY` being present, mirroring HubSpot's own fail-closed precedent exactly.

## The connector that was removed: Razorpay, as a case study

A third real connector existed: Razorpay, refund-creation only
(`razorpay:refund-create`), with its own `RazorpaySignalStateVerifier` (Chapter 3),
`RazorpaySettlementProcessor` (an out-of-band worker fetch-verifying a webhook's claimed
refund status against Razorpay's own API rather than trusting the webhook payload), and a
`RazorpayDailyRefundLedger` enforcing an atomic daily cumulative refund cap. It was live in
production, validated end-to-end including one real, authenticated, policy-gated refund of
100 paise against a real card-paid ten-rupee Payment Link, with a genuine webhook and a
signed `SETTLED` settlement confirmation roughly 48 seconds later.

It was removed from this repository **in full** on 2026-08-12, not deprecated, not gated
behind a flag, deleted: the connector code, its credential provider, its signal-state
verifier, its settlement processor, its webhook route, its tests, and every doc page
dedicated to it. `payments:execute`/vendor-payment (a separate, earlier connector, Chapter 18) was removed the same way, for a related but distinct reason. The immediate trigger for
Razorpay's removal isn't itself the point of this chapter. What matters architecturally is
what removing a _real, working, revenue-shaped_ connector in full teaches about the rest of
this codebase's design.

**Nothing in the authorization pipeline referenced Razorpay by name.** `RuntimeEngine`,
`PolicyEngine`, `ExecutionGateway`, none of them import or special-case a connector
identity. Removing one connector meant deleting `packages/connector-sdk`'s Razorpay-specific
files, its `createRazorpayConnector.ts`/`createRazorpayCredentialProvider.ts` bootstrap
factories, and its `CANONICAL_CAPABILITY_POLICY_BINDINGS` entries. Nothing upstream needed
to change.

**What it left behind was harder than the code deletion itself.** Months later, an
unrelated documentation-audit pass (part of this same session) found the removal had been
thorough at the code layer but incomplete at the documentation layer: roughly fifteen
`docs/site/**/*.mdx` pages and several `examples/tutorials/*/README.md` files still
described Razorpay as a live, currently-registered connector, some linking to pages that no
longer existed, one (`concepts/settlement.mdx`) entirely built around
`RazorpaySettlementProcessor` with no connector-agnostic content left once that class was
gone. Chapter 17 covers the citation-integrity mechanism this repo has since built partly
in response to exactly this failure mode.

**A capability being real once doesn't make evidence about it permanent.** `docs/CLAIMS.md`'s
own §2.21 (Chapter 12) had to be corrected after this removal: it previously cited a
Razorpay-specific integration test as proof that a policy rejection surfaces as
`403`/`POLICY_DENIED` "through the real production bootstrap chain." The underlying claim
remained true. A different, connector-agnostic test proves the same mechanism against
`test:fixture-execute`. But the specific evidence citing a deleted test file needed
updating, which is a small, concrete instance of a general risk: an Evidence section is
only as durable as the file it cites.

The honest summary: Razorpay is not a cautionary tale about building the connector, and not
one about the decision to remove it (this book doesn't take a position on that decision,
which predates and is outside this session's scope). It's a demonstration that this
codebase's separation of concerns (connectors are replaceable leaves; nothing upstream
depends on which ones exist) worked exactly as designed, and a reminder that documentation
about a removed thing needs the same deliberate cleanup the code itself got, or it silently
rots for months before anyone notices.

---

[← Book Index](README.md) · [← Previous: Chapter 9, Credential Isolation](09-credential-isolation.md) · [Next: Chapter 11, Storage →](11-storage.md)
