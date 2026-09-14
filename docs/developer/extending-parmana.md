# Extending Parmana

A guide to the approved extension points in this repository: where new code goes, and — just as important — where it must never go. Read [`../architecture/system-architecture.md`](../architecture/system-architecture.md) first if you haven't already; this document assumes you know what each package owns.

For engineering practices specific to building a connector (test order, live-test hygiene, guard patterns learned from real incidents), see [`../CONNECTOR-BUILD-GUIDE.md`](../CONNECTOR-BUILD-GUIDE.md) — this document covers _where the code goes_; that one covers _how to build it well_. They're complementary, not duplicates.

Every rule below is backed by an automated test that fails the build if violated — see [`../architecture/repository-invariants.md`](../architecture/repository-invariants.md) for the exact test and failure mode of each one referenced here.

---

## Adding a new capability (for an existing vendor)

**Where:** the vendor's capability file in its connector package — e.g. `packages/connector-sdk/src/connectors/razorpay/RazorpayCapabilities.ts` or `packages/connector-hubspot/src/HubSpotCapabilities.ts`.

1. Add the namespaced capability constant (e.g. `export const RAZORPAY_PAYMENT_CAPTURE_CAPABILITY = "razorpay:payment-capture";` — must match `isNamespacedCapability`'s `verb:noun` pattern, `connector-sdk/src/ConnectorTypes.ts`).
2. Add its parameter DTO interface alongside the existing ones (e.g. `RazorpayPaymentCaptureParameters`).
3. Export both from the package's `index.ts`.
4. Implement the capability's handling in the vendor's _existing_ adapter inside `execution-gateway` (see "Adding a new vendor" below if the adapter itself needs a new method) — do **not** add executable logic to the capability file itself. It's a DTO/constants file; adding a `fetch()` call there fails Invariant 1.
5. Register the capability when constructing the connector at bootstrap (`packages/api/src/bootstrap/create<Vendor>Connector.ts`, in the `capabilities: connectorCapabilities([...])` list).

## Adding a new vendor (a whole new connector)

**Where:** the new adapter class lives _inside_ `execution-gateway`, never inside a connector package.

1. Define capability constants + DTOs in a new or existing connector package (e.g. `packages/connector-stripe/src/StripeCapabilities.ts`) — metadata only, per the "Adding a new capability" rules above.
2. Implement the executable adapter inside `packages/execution-gateway/src/connector-execution/GatewayStripeAdapter.ts`, implementing `connector-sdk`'s `Connector` interface (`execute(request: ConnectorRequest, context: ConnectorExecutionContext): Promise<ConnectorResponse>`). Model it on `GatewayRazorpayAdapter.ts` or `GatewayHubSpotAdapter.ts` — same shape: constructor takes `connectorId`/`capabilities`/optional `baseUrl` (defaulting to the vendor's real production API), `execute()` maps `request.capability` to an HTTP call, redacts credentials from any logged/returned metadata.
3. Add a factory function, `createGatewayStripeConnector(options): Connector`, in `packages/execution-gateway/src/connector-execution/createGatewayStripeConnector.ts` (mirrors `createGatewayRazorpayConnector.ts`) — returns the `Connector` interface, not the concrete class.
4. Export the factory (and only the factory) from `packages/execution-gateway/src/index.ts`. **Do not** export the adapter class itself, and do not add `export * from "./connector-execution/index.js"` to the public barrel — that would re-expose every internal implementation class, not just the new one (Invariant 7).
5. Wire it into `packages/api/src/bootstrap/createStripeConnector.ts` (calls the factory, returns `Connector`) and register it in `createConnectorRegistry.ts`'s registrations array, alongside the existing Razorpay/HubSpot entries.

**Why this boundary is where it is, and why it's enforced automatically:** every `implements Connector` outside `execution-gateway/src/connector-execution/` fails Invariant 2's test the moment it's added — you'll find out from a failing `npm test`, not from a design review months later.

## Adding a signal verifier

**Where:** `<VendorName>SignalStateVerifier.ts` inside the vendor's own connector package (e.g. `packages/connector-hubspot/src/HubSpotSignalStateVerifier.ts`), implementing `@parmana/policy`'s `SignalStateVerifier` interface (`findViolations(context, declaredSignals): Promise<readonly SignalStateViolation[]>`).

1. Re-fetch the real vendor state via the _existing_ `execute<Vendor>Capability()` helper in the same package (e.g. `executeHubSpotCapability`) — this signs a fresh authorization and dispatches through the injected `ExecutionSystem`/`ExecutionGateway`, the same path every other execution takes. Don't call `fetch()` directly here; that's exactly the pattern Invariant 1 forbids, and it would also bypass the authorization/audit chain the rest of the pipeline gets for free.
2. Compare each declared signal against the independently-fetched value; return a `SignalStateViolation` for each mismatch.
3. Wire it into the composite verifier: `packages/api/src/bootstrap/create<Vendor>SignalStateVerifier.ts`, composed with the others via `CompositeSignalStateVerifier` in `packages/api/src/application.ts`.

See [`../architecture/execution-walkthrough.md` §3](../architecture/execution-walkthrough.md) for exactly where this runs in the request lifecycle (after policy evaluation, before authorization is signed).

## Adding a policy

**Where:** a new policy file under the configured policy directory (`policies/`, see `PARMANA_POLICY_DIR`), loaded by `PolicyRepository`/`FilePolicyRepository` (`@parmana/policy`). No code change needed for an ordinary rule-based policy — policies are data, evaluated by the existing `PolicyEngine`.

If a policy needs to bind specific signals to Intent fields (closing the "declared signals could describe a different action than Intent" gap — see `system-architecture.md` §5), declare `boundSignals` on the policy; `SignalIntentBinder` picks this up automatically, no new code required.

If you need genuinely new _evaluation logic_ (not expressible as declarative rules), that's a `PolicyEngine`/`RuntimeComponent` change — see "Components that must never be modified directly" below before assuming this is the right approach; it usually isn't.

## Adding a custom `RuntimeComponent` pipeline stage

**Where:** implement `RuntimeComponent` (`execute(context: RuntimeContext): Promise<RuntimeContext>`) and add it via `RuntimeBuilder.addStage(...)` in whatever composes your `Runtime` (mirrors `TrustChainValidationComponent`/`ExecutionComponent` in `RuntimeFactory.create()`). This is a legitimate, designed extension point — `RuntimeBuilder`/`RuntimePipeline` exist specifically so stages are pluggable — see `docs/CONNECTOR-BUILD-GUIDE.md`-adjacent tutorials `examples/tutorials/15-custom-runtime-component`, `16-runtime-pipeline`, `19-runtime-composition` for worked examples.

A custom stage must still never construct or call a `Connector`/adapter directly — it should call the injected `ExecutionSystem`, exactly like `ExecutionComponent` does, if it needs to reach the execution pipeline at all. Anything else is a second execution path (Invariant 3).

---

## Components that must never be modified directly

These aren't "ask before touching" — they're the components the automated invariant tests exist specifically to protect, and unauthorized changes will fail CI, not just review:

| Component                                                                                                      | Why                                                                                                                                                                                                                                                                                          | Enforced by                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RuntimeEngine`'s import list                                                                                  | Must never import `execution-gateway`, `connector-sdk`, or `connector-hubspot` — it only knows about the abstract `ExecutionSystem` interface                                                                                                                                                | Invariant 4                                                                                                                                                 |
| `ExecutionTrustApplication`'s import list                                                                      | Same reason, same enforcement                                                                                                                                                                                                                                                                | Invariant 4                                                                                                                                                 |
| `ExecutionGateway.execute()`'s verification sequence                                                           | The order (version → signature → expiry → TTL → content hash → nonce) and the "only consume the nonce once everything else passed" rule are load-bearing for replay protection                                                                                                               | Manually reviewed; behavior-locked by `packages/execution-gateway/tests`                                                                                    |
| Any file under `packages/api/src/routes/`                                                                      | Must call only `application.execute(...)` / other `ExecutionTrustApplication` methods — never construct or import an adapter                                                                                                                                                                 | Invariant 5                                                                                                                                                 |
| Any file under `packages/api/src/bootstrap/`                                                                   | Composes objects; must never call `.execute(`                                                                                                                                                                                                                                                | Invariant 5                                                                                                                                                 |
| `packages/execution-gateway/src/index.ts` (the public barrel)                                                  | Must export only `ExecutionGateway`, the generic `Connector`/`ConnectorRequest`/`GatewayVerificationResult`/`HttpConnector` extension-point types, and the three `createGateway*Connector`/`createGatewayConnectorRegistry` factories — never the concrete adapter/registry/executor classes | Invariant 7                                                                                                                                                 |
| `CredentialVaultAdapter`'s credential lifecycle (resolve → single-use lease → destroy, no caching, no logging) | Changing this changes how long a credential is live in memory and what gets audited                                                                                                                                                                                                          | Behavior-locked by `packages/execution-gateway/tests/unit/credential-vault-adapter.test.ts`; semantics documented in the Phase 1C credential-handling audit |
| `packages/connector-sdk/src` and `packages/connector-hubspot/src` — no `fetch()` calls                         | These packages are passive by design; a `fetch()` call here is a second, unaudited execution path                                                                                                                                                                                            | Invariant 1                                                                                                                                                 |
| The `connector.execute()`/`adapter.execute()` call-site allowlist                                              | Exactly three files may call this: `ExecutionControlService`, `SdkConnectorExecutor`, and the one named worker exception (`RazorpaySettlementProcessor`)                                                                                                                                     | Invariant 3                                                                                                                                                 |

If you believe one of these genuinely needs to change, that's an architecture decision, not a routine PR — it should come with an update to `repository-invariants.md`'s corresponding invariant (loosening an allowlist, not deleting a check), not a workaround that routes around the test.

## What "approved extension point" means in practice

Every extension point above adds a _new file in a new, package-appropriate location_ and, at most, one _new entry_ in an existing allowlist (a new registration in `createConnectorRegistry.ts`, a new factory export, a new capability constant). None of them require editing `RuntimeEngine`, `ExecutionGateway`, or any file in the "must never be modified directly" table. If your change requires editing one of those files, stop and re-read this document — there's almost certainly a narrower extension point that does what you need.
