# Execution Walkthrough

A single business transaction, traced from the HTTP request that submits it to the signed Receipt returned to the caller. Every step below names the real class and method, verified directly against source (not inferred from a diagram). For the condensed call-graph form of the same trace, see [`execution-pipeline-report.md §2`](./execution-pipeline-report.md). For what each package is responsible for along the way, see [`system-architecture.md`](./system-architecture.md).

The example: an AI agent decides to release a $5,000 vendor payment. The trace below shows what happens between that decision arriving at Parmana and a receipt being returned — including the two points where the request can be stopped (policy rejection, signal mismatch) before anything is ever authorized.

---

## Stage 0 — HTTP request

`POST /execute` with a `BusinessTransaction` body reaches `packages/api/src/routes/execute.ts`, which calls:

```ts
await application.execute(transaction);
```

`application` is an `ExecutionTrustApplication` instance, built once at startup by `RuntimeFactory.create(...)` (`packages/runtime/src/RuntimeFactory.ts`) and threaded through `packages/api/src/application.ts`.

## Stage 1 — Accept

`ExecutionTrustApplication.execute()` (`packages/runtime/src/ExecutionTrustApplication.ts:64`) first calls `this.transactions.accept(transaction)` — `BusinessTransactionService` persists the transaction as received, before any policy or authorization work happens.

## Stage 2 — RuntimeEngine: policy evaluation

`ExecutionTrustApplication.execute()` then calls `this.runtime.execute(transaction)` (`Runtime.ts:31`), a thin façade that calls `RuntimeEngine.execute()` (`packages/runtime/src/RuntimeEngine.ts:125`). Inside it, in order:

1. **Policy loading** — `PolicyRouter.load(transaction.policy.name, transaction.policy.version)` fetches the named `Policy`.
2. **Signal/Intent binding** — `SignalIntentBinder.findViolations(policy, signals, { target, parameters })` checks the transaction's declared signals describe the _same action_ as its Intent. A violation short-circuits straight to a REJECT decision (`matchedRuleId: "signal-intent-binding-violation"`) — `PolicyEngine.evaluate()` is never even called.
3. **Policy evaluation** — if no binding violation, `PolicyEngine.evaluate(policy, signals)` produces the provisional `PolicyDecision` (`APPROVE` or `REJECT`).

**If REJECT here:** skip to Stage 2b (Refusal Record) — no external call is made, no authorization is ever generated.

## Stage 3 — RuntimeEngine: signal/state verification

Only runs if the provisional decision from Stage 2 is `APPROVE` **and** a `SignalStateVerifier` is configured (production always configures one — `CompositeSignalStateVerifier`, wired in `packages/api/src/application.ts` from `createRazorpaySignalStateVerifier()`/`createHubSpotSignalStateVerifier()`).

`this.signalStateVerifier.findViolations({ action, businessTransactionId, intentParameters }, signals)` independently re-fetches the real state (e.g. `RazorpaySignalStateVerifier` calling `executeRazorpayCapability()`, which signs its _own_ fresh authorization and calls the same injected `ExecutionSystem`/`ExecutionGateway` — this is the one place, other than the real execution below, where a network call to the vendor happens). A mismatch between the declared signal and the independently-verified value overrides the decision to `REJECT` (`matchedRuleId: "signal-state-verification-violation"`) — again, no authorization is generated for it.

## Stage 2b/3b — Refusal Record (only on REJECT)

If `decision.outcome !== APPROVED` after Stages 2–3, `RuntimeEngine` calls `this.writeRefusalRecord(transaction, decision, bindingViolations)` (`RefusalRecordBuilder`, RFC-0021) — a signed, third-party-verifiable evidentiary record of the refusal, written _before_ `ExecutionGate.enforce()` runs. This is evidentiary-only: it never delays or affects the synchronous response.

`ExecutionGate.enforce(decision)` then throws for any non-approved decision, ending the request here.

## Stage 4 — Authorization

Only reached for an `APPROVED` decision. `RuntimeEngine` builds the frozen `ExecutableContent` (`businessTransactionId`, `action`, `target`, `parameters`) and calls:

```ts
this.authorizationSigner.sign(
  {
    decisionId,
    businessTransactionId,
    policyName,
    policyVersion,
    executableContent,
  },
  authorizationTtlSeconds,
);
```

`RuntimeAuthorizationSigner` (`@parmana/crypto` under the hood) produces a `SignedExecutionAuthorization` — the cryptographic proof that _this specific content_ was authorized by policy `policyName@policyVersion`, with a TTL.

## Stage 5 — RuntimePipeline: TrustChainValidationComponent, then ExecutionComponent

`RuntimeEngine` builds `RuntimeContext` (`{ transaction, decision, authorization, execution }`) and calls `this.pipeline.execute(context)` (`RuntimePipeline.ts:30`), which runs its two configured stages in order (wired in `RuntimeFactory.create()`):

1. **`TrustChainValidationComponent.execute()`** — validates the chain of custody from authority → authorization → intent is internally consistent before anything executes.
2. **`ExecutionComponent.execute()`** (`packages/runtime/src/components/ExecutionComponent.ts:44`) — builds the `ExecutionRequest` (`ExecutionRequestBuilder`), then calls:

```ts
await this.executionSystem.execute(request);
```

`executionSystem` is the injected `ExecutionSystem` — in production, always `ExecutionGateway` (bound exclusively in `packages/api/src/bootstrap/createExecutionSystem.ts`). This is the boundary: everything before this line is Runtime's; everything from here on is Gateway's.

## Stage 6 — ExecutionGateway: verify, then dispatch

`ExecutionGateway.execute()` (`packages/execution-gateway/src/ExecutionGateway.ts:214`):

1. Calls `this.verify(request)` internally — re-checks protocol version, signature, expiry, TTL-vs-policy, and business-transaction content hash (independently of anything Runtime already checked), then — only if every one of those passed — checks and consumes the nonce (`nonceUnseen`). Any failure throws, naming every failing check; a nonce-replay failure throws `NonceAlreadyConsumedError` specifically.
2. Deep-freezes the verified `ExecutableContent` (`deepFreeze`) so nothing can mutate it between here and the connector call.
3. Calls `this.executionControl.service.execute(transaction, gatewayAuthentication)` — `gatewayAuthentication` is minted fresh, per request, by `mintGatewayAuthentication` (a `GatewayAttestationSigner`, bound to _this specific_ `authorizationId`).

## Stage 7 — ExecutionControlService: resolve, session, dispatch

`ExecutionControlService.execute()` (`packages/execution-control/src/ExecutionControlService.ts:44`):

1. Re-authenticates the Gateway itself: `authenticator.authenticateGateway(gatewayIdentity, gatewayAuthentication)`.
2. Resolves the target connector: `this.options.registry.resolveCapability(release.executableContent.action)` → a `SecureConnector` (production: `GatewayConnectorRegistry`, internal to `execution-gateway`, constructed via `createGatewayConnectorRegistry()` at bootstrap — never a class name `api` imports directly).
3. Creates a one-time `GatewaySession`: `this.options.sessions.create(release, connector.connectorId, ...)`.
4. Records `session.created` on the shared `ExecutionAuditSink`.
5. Calls `connector.execute(request)` — this `connector` is the `SecureConnector`, not yet the raw vendor adapter.

## Stage 8 — SessionCredentialSecureConnector: credential issue, dispatch, destroy

`SessionCredentialSecureConnector.execute()` (`packages/execution-control/src/SessionCredentialSecureConnector.ts:70`) is the production `SecureConnector` implementation `GatewayConnectorRegistry.register()` wires up (unless a connector opts into `legacyInsecure`, test-only):

1. Re-checks the connector's own `ConnectorPolicy` (`GatewayCapabilityConnectorPolicy` wrapping `DefaultConnectorPolicy` — a second, defense-in-depth policy check independent of `RuntimeEngine`'s earlier `PolicyEngine.evaluate()`).
2. Issues a session-scoped, single-use credential lease from `sessionCredentials` (`InMemorySessionCredentialVault`, backed by `CredentialVaultAdapter` wrapping the connector's `CredentialProvider`).
3. Calls the injected `ConnectorExecutor` — production: `SdkConnectorExecutor.execute()` (`packages/execution-gateway/src/connector-execution/SdkConnectorExecutor.ts:41`), which calls `connector.execute(request, context)` on the _raw vendor `Connector`_ (`GatewayRazorpayAdapter` / `GatewayHubSpotAdapter` / `GatewayHttpAdapter`) — the one call in the whole trace that reaches the actual business system.
4. Destroys the credential lease immediately after (issue → single use → destroy — no credential outlives one execution).
5. Records `execution.completed` on the shared audit sink, with `connectorId`, `credentialId`, `gatewayId`, `authorizationId`.

## Stage 9 — Business System

The adapter's `execute()` (e.g. `GatewayRazorpayAdapter.execute()`) makes the real HTTP call to Razorpay/HubSpot/the configured HTTP target, using the resolved credential and the verified, frozen request. It returns an `ExecutionResult` (`success`, `metadata` — vendor response evidence, redacted of anything credential-shaped by `ConnectorEvidence`'s `redactSensitiveKeys`).

The result unwinds back through Stages 8 → 7 → 6 → 5.

## Stage 10 — BusinessTrustPipeline: Trust Record

Back in `RuntimeEngine.execute()`, once `this.pipeline.execute(context)` returns the processed context, it calls:

```ts
await this.trustPipeline.execute(processedContext);
```

`BusinessTrustPipeline.execute()` (`packages/runtime/src/BusinessTrustPipeline.ts:31`) validates the context carries a transaction and execution artifact, then assembles the immutable `ExecutionTrustRecord` (`BusinessTrustRecordBuilder`) — the canonical, signed record of everything that happened: transaction, decision, authorization, execution, and (once generated) receipts and settlement confirmations.

`Runtime.execute()` persists it: `await this.trustRecords.create(trustRecord)`.

## Stage 11 — Verification

Back in `ExecutionTrustApplication.execute()`, after `runtime.execute()` returns:

```ts
await this.verification.verify(transaction.businessTransactionId);
```

`VerificationService.verify()` independently re-derives and checks the Trust Record's hash and signature — proving the record wasn't tampered with between being written and being read back, using the same crypto primitives a third party could use to verify it themselves.

## Stage 12 — Receipt

```ts
await this.receipts.generate(transaction.businessTransactionId);
```

`ReceiptService.generate()` produces a signed `Receipt` referencing the Trust Record's hash — the artifact a caller holds as proof the execution happened, was authorized, and is independently verifiable.

## Stage 13 — Response

`ExecutionTrustApplication.execute()` loads the now-complete `ExecutionTrustRecord` (`trustRecords.findByTransactionId(...)`) and returns it. The route handler (`packages/api/src/routes/execute.ts`) serializes it as the HTTP response.

---

## What can stop this trace early, and where

| Stop point                                                              | Stage | What's produced instead                                                                                                               |
| ----------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Signal/Intent binding violation                                         | 2     | `PolicyOutcome.REJECT` → Refusal Record, no external call                                                                             |
| Ordinary policy REJECT                                                  | 2     | Refusal Record, no external call                                                                                                      |
| Signal/State verification mismatch                                      | 3     | `PolicyOutcome.REJECT` → Refusal Record — note this path _did_ make one external call (the state-verification fetch) before rejecting |
| Gateway envelope verification failure (signature/expiry/TTL/hash/nonce) | 6     | Thrown error (or `NonceAlreadyConsumedError`); `ExecutionComponent` marks the Execution failed                                        |
| Gateway re-authentication failure                                       | 7     | Thrown error — the Gateway itself wasn't who it claimed to be                                                                         |
| Connector policy re-check failure                                       | 8     | Thrown error — defense-in-depth denial independent of Stage 2's policy evaluation                                                     |
| Vendor call failure                                                     | 9     | `ExecutionResult.success: false`, still recorded in the Trust Record                                                                  |

Every one of these produces evidence (a Refusal Record, an audit event, or a Trust Record with `success: false`) — nothing fails silently.
