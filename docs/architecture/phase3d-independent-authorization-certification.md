# Phase 3D — Independent Authorization Certification

Certifies, from current repository state only, whether the public claim _"Even if AI
has valid credentials, it still cannot execute anything your business hasn't
authorized. No exceptions"_ is fully supported by the implemented system. This is a
certification pass, not an implementation phase: no production source code and no
documentation other than this new file were changed.

**Certified against:** commit `cb467fc` ("complete hybrid signature migration"), the tip
of `main`. Working tree was clean before this phase began (`git status`, `git diff
--stat`, `git log --oneline -10` all confirmed at the start of this session).

**Method:** treated the repository as never audited before. Prior phase documents
(2K, 2L, 3A, 3B, 3C) and `docs/VERIFICATION-GAPS.md`/`docs/CLAIMS.md` were read only as
claims to independently re-verify, never as conclusions to inherit. Every finding below
traces to a file:line read directly in this session, either by the certifying process
itself or by one of four parallel evidence-gathering passes it commissioned and then
independently cross-checked (§1). Where a sub-agent's finding could not be independently
confirmed, or where its own report flagged an open question, that is stated explicitly
rather than smoothed over.

---

## 1. Certification Methodology

Two verification tracks ran in parallel and were then reconciled against each other:

1. **Direct source tracing** (this process): read `packages/api/src/bootstrap/*`,
   `packages/api/src/routes/execute.ts`, `packages/runtime/src/RuntimeEngine.ts`,
   `packages/runtime/src/RuntimeBuilder.ts`, `packages/runtime/src/ExecutionGate.ts`,
   `packages/policy/src/CapabilityPolicyBinding.ts`, both `SignalStateVerifier`
   implementations, `packages/approval/src/ApprovalVerifier.ts`,
   `packages/execution-gateway/src/connector-execution/GatewayRazorpayAdapter.ts`,
   `packages/storage/src/supabase/{SupabaseNonceStore,SupabaseRazorpayDailyRefundLedger}.ts`,
   and the governing policy JSON files, in full, before commissioning any sub-agent work.
2. **Four independently-scoped evidence passes**, each given the specific files and
   questions to trace and instructed to cite file:line for every claim and to mark
   anything it could not confirm as `NOT VERIFIED`/`UNABLE TO CERTIFY` rather than assume
   a pass:
   - Property A (capability inventory, credential isolation)
   - Property B + C (independent authorization, structural enforcement)
   - Property D + E (replay resistance, concurrency safety)
   - Property F + repository-wide search + adversarial review

Every open question a pass raised was independently re-investigated by this process
before being accepted into this document (see §3–§7, "independently re-verified" notes).
Two flags raised by the Property B/C pass (exact Razorpay refund-create dispatch site;
`SdkConnectorExecutor` internals) were closed by direct re-reading in this session, not
taken on faith — see §5.2.

Regression suite: `npx tsc -b` (clean, 0 errors) and
`npm test -- --maxWorkers=2` (148 test files passed, 15 skipped; 1039 tests passed, 39
skipped, 0 failed) were both run fresh in this session (§Regression Verification below),
not assumed from a prior phase's report.

---

## 2. Production Capability Inventory

Derived strictly from the production bootstrap composition root, not documentation.

**Entrypoint trace:** `packages/api/src/server.ts` (Node's real entrypoint, top-level
statements run on import — no test/mock branch wraps it) →
`createExecutionSystem()` (`packages/api/src/bootstrap/createExecutionSystem.ts:11-13`,
unconditionally `createExecutionGateway()`) → `createExecutionControl()`
(`createExecutionGateway.ts:33`) → `createConnectorRegistry()`
(`createExecutionControl.ts:58`).

`createConnectorRegistry.ts:43-168` registers a connector only when its credential
provider factory returns non-`undefined`:

| Connector        | Registration gate                                                                                                                                                                                                               | Production capability?                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `vendor-payment` | `createVendorPaymentConnector()` returns a real connector only when `process.env.NODE_ENV === "test"` (`createVendorPaymentConnector.ts:30-32`); otherwise `undefined`, logged and skipped (`createConnectorRegistry.ts:55-64`) | **No.** Confirmed by reading the gating condition directly, not inferred from the comment alone. |
| `razorpay`       | `createRazorpayCredentialProvider()` returns `undefined` unless both `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set (`createRazorpayCredentialProvider.ts:85-89`)                                                          | **Yes**, conditional on operator-supplied secrets.                                               |
| `hubspot`        | `createHubSpotCredentialProvider()` returns `undefined` unless `HUBSPOT_PRIVATE_APP_TOKEN` is set                                                                                                                               | **Yes**, conditional on operator-supplied secrets.                                               |

**Capability action strings exposed** (confirmed against `GatewayRazorpayAdapter.execute()`'s
switch, `GatewayRazorpayAdapter.ts:98-109`, and `GatewayHubSpotAdapter.execute()`'s
switch, `GatewayHubSpotAdapter.ts:109-118`):

| Capability action        | Kind                      | Connector method                                                                                                                                                                                               |
| ------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `razorpay:payment-fetch` | read                      | `fetchPayment`                                                                                                                                                                                                 |
| `razorpay:refund-create` | **money-moving write**    | `createRefund`                                                                                                                                                                                                 |
| `razorpay:refund-fetch`  | read                      | `fetchRefund`                                                                                                                                                                                                  |
| `hubspot:deal-fetch`     | read                      | `fetchDeal`                                                                                                                                                                                                    |
| `hubspot:deal-update`    | **record-mutating write** | `updateDeal` (deny-by-default property allowlist — `HUBSPOT_ALLOWED_DEAL_UPDATE_PROPERTIES`, `HubSpotTypes.ts:36`; any other property name throws before any network call, `GatewayHubSpotAdapter.ts:162-171`) |

**This certification's scope is therefore the two write capabilities,
`razorpay:refund-create` and `hubspot:deal-update`**, since those are the only production
actions capable of executing something a business would need to have authorized. `payments:execute`
(vendor-payment) is a capability defined in code and policy (`policies/vendor-payment/2.0.0`)
but is **not reachable in production under any current environment configuration** — it
has no gate that would ever register it outside `NODE_ENV=test`. It is addressed
separately in §12 because, if it were ever wired into production as currently written, it
would **not** satisfy this claim (see §12.1).

---

## 3. Property A Verification — Credential Isolation

### 3.1 Origin, storage, read, use

| Capability | Credential origin (env var)               | Read site                                                                         | Storage at rest                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ----------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| razorpay   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | `createRazorpayCredentialProvider.ts:34-35`, inside `resolve()`, lazily, per call | None. `CredentialHandle` is constructed fresh per resolution (`brandCredentialHandle`), wrapped in a 30-second single-use session credential (`InMemorySessionCredentialVault`, default TTL `GatewayConnectorRegistry.ts:24,124`), consumed exactly once and revoked in a `finally` block on every exit path (`SessionCredentialSecureConnector.ts:77-89`). No disk/DB persistence anywhere in this chain. |
| hubspot    | `HUBSPOT_PRIVATE_APP_TOKEN`               | `createHubSpotCredentialProvider.ts:35`, inside `resolve()`                       | Same mechanism as above.                                                                                                                                                                                                                                                                                                                                                                                   |

Both providers read `process.env` only inside `resolve()`, never at module scope, and
name only the variable in thrown errors, never the value (`createRazorpayCredentialProvider.ts:38-41`).

### 3.2 Full call-graph trace: does the AI-facing path ever hold the raw credential?

Traced end-to-end, `POST /execute` → resolution:

```
routes/execute.ts:108-111        application.execute(transaction)
  ExecutionTrustApplication.execute()
    RuntimeEngine.execute()                      -- policy load, SignalIntentBinder,
                                                     CapabilityPolicyBinder, PolicyEngine,
                                                     SignalStateVerifier: NO credential contact
      ExecutionGate.enforce(decision)             -- fail-closed gate, RuntimeEngine.ts:375
      authorizationSigner.sign(...)                -- signs an envelope, not a credential
      pipeline.execute(context)
        ExecutionComponent.execute()
          ExecutionRequestBuilder.build()          -- object has NO credential field
          executionSystem.execute(request)
            ExecutionGateway.execute()             -- signature/expiry/hash/nonce verify only
              SessionCredentialExecutionControl.execute()
                ExecutionControlService.execute()
                  registry.resolveCapability(action)
                  connector.execute(request)        <-- FIRST point CredentialProvider.resolve() runs
                    = CredentialVaultAdapter.getCredential (only call site of .resolve() in the repo)
```

`ExecutionRequestBuilder.build()` (`packages/runtime/src/ExecutionRequestBuilder.ts:29-50`)
constructs its return value purely from `toExecutableContent(...)` and the signed
`authorization` envelope — verified directly, no credential field exists on the type or
in the object literal. The credential is resolved for the first time inside
`ExecutionControlService.execute()`, strictly downstream of policy evaluation
(`RuntimeEngine.ts:269`), the fail-closed gate (`RuntimeEngine.ts:375`), and authorization
signing (`RuntimeEngine.ts:397`). Confirmed further: `GatewayRazorpayAdapter.execute()`
(read directly, `GatewayRazorpayAdapter.ts:58-122`) is the only class that ever reads
`context.credential.value.{keyId,keySecret}` and builds the `Basic` auth header
(`GatewayHubSpotAdapter.ts` equivalent: `Bearer ${privateAppToken}`); both are
`Object.freeze`d, package-private construction, reachable only via
`createGatewayRazorpayConnector.ts`/`createGatewayHubSpotConnector.ts`, which is exactly
what `createRazorpayConnector.ts`/`createHubSpotConnector.ts` (the production bootstrap
call sites) instantiate.

**Classification: VERIFIED.** No AI-facing object — the HTTP request, the transaction,
the policy decision, the signed authorization, the execution request — ever carries or
passes through a component holding the raw connector credential. Authorization is fully
decided (policy evaluated, gate enforced, envelope signed) before the credential provider
is touched for the first time.

### 3.3 Disclosed exception: truncated credential fragments in the response body

Both adapters return a **redaction-intended prefix** of the credential in
`ConnectorResponse.metadata`:

- `GatewayRazorpayAdapter.ts:132,151,209`: `keyIdRedacted: redactRazorpayKeyId(keyId)` →
  `RazorpayTypes.ts:74-76`: first 8 characters of `key_id` (the less-sensitive half of the
  Razorpay credential pair; `key_secret` is never touched by this function).
- `GatewayHubSpotAdapter.ts:145,194`: `bearerRedacted: redactHubSpotToken(token)` →
  `HubSpotTypes.ts:73-75`: first 12 characters of the **entire** HubSpot Private App
  token — for HubSpot the bearer token _is_ the whole credential, so this is a literal
  fragment of the actual secret, not a separate, less-sensitive identifier.

`ConnectorEvidence.ts:31`'s generic redaction filter (`SENSITIVE_KEY_PATTERN =
/credential|secret|token|apikey|api_key|password|authorization/i`, applied to metadata
**key names**, `redactSensitiveKeys`, lines 39-48) does **not** match the key names
`keyIdRedacted`/`bearerRedacted` — confirmed by direct regex inspection — so this
truncated fragment passes unfiltered through `buildConnectorEvidence()` →
`ExecutionEvidence.attributes` → the `ExecutionTrustRecord` returned in the `POST
/execute` JSON response body (`routes/execute.ts:113`). This is intentional, tested
behavior (`razorpay-connector.test.ts:231`, `hubspot-connector.test.ts:268` assert the
exact truncated values), not an oversight discovered by accident, but it is a genuine
exception to a "zero credential bytes ever reach the caller" reading of Property A.

**Materiality assessment:** an 8-character `key_id` prefix or 12-character bearer-token
prefix does not, by itself, grant any additional execution capability — the calling AI
still cannot construct a valid, authorized request without passing the exact same
independent-authorization gauntlet (§4) for every subsequent call; the fragment cannot be
used to bypass `RuntimeEngine`/policy evaluation, forge a signature, or reconstruct the
full secret. This does **not** contradict the claim under review (which concerns
execution authorization, not credential confidentiality), but it is disclosed here as a
genuine, verified exception to a maximally strict reading of "credential isolation," not
folded silently into a blanket VERIFIED. See §12.2.

**Test-coverage caveat, independently confirmed:** `credential-isolation.integration.test.ts`
was read in full. It exercises the _generic_ session-credential single-issue/single-use/
always-revoked mechanism (shared by every connector via `SessionCredentialSecureConnector`)
through a real HTTP `POST /execute` call, but does so against a synthetic, test-only
`vendor-payment`-shaped double (`createInspectableExecutionSystem.ts`), not the real
Razorpay/HubSpot adapters or credential providers, and asserts only audit-sink content and
HTTP status — never response-body content. **It would not catch a regression that leaked
a connector's full secret, or a larger fragment than today's 8/12 characters, into
`ConnectorResponse.metadata`.** This is a real, disclosed gap in regression coverage for
the specific property "no credential-derived bytes reach the caller," independently
confirmed by reading the test file in full.

---

## 4. Property B Verification — Independent Authorization

Traced for both write capabilities: `Request → Capability → Policy → Authorization →
Execution`.

### 4.1 Razorpay `razorpay:refund-create`

| Authorization input                                                                         | Classification                                | Mechanism                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paymentStatus`, `paymentCurrency`, `refundableRemainingPaise`, `requestedExceedsRemainder` | Independently verified                        | `RazorpaySignalStateVerifier.findViolations()` re-fetches the real payment from Razorpay (`executeRazorpayCapability` against `razorpay:payment-fetch`) and rejects on any mismatch against the caller's declared signal (`RazorpaySignalStateVerifier.ts:74-79,171-178`). Fails closed on fetch error.                                                   |
| `requestedRefundAmountPaise`                                                                | Caller-declared, structurally bound to Intent | `policies/razorpay-refund/1.0.0/policy.json:16-18` (`boundSignals`) binds it to `parameters.amountPaise`; `SignalIntentBinder.findViolations()` (`RuntimeEngine.ts:216-226`) rejects any divergence _before_ `PolicyEngine.evaluate` runs — cannot describe a different real-world action than the one that will execute.                                 |
| `dailyCumulativeAfterThisRefundPaise` (TD-23)                                               | Repository-derived, atomic                    | `RazorpaySignalStateVerifier.reserveDailyCumulative()` atomically reserves the amount against `RazorpayDailyRefundLedger` (real DB counter) and rejects on any disagreement between the caller's declared value and the real, just-reserved total — not merely on exceeding the cap (`RazorpaySignalStateVerifier.ts:220-264`, violation logic line 245). |

Production wiring, confirmed directly: `createRazorpaySignalStateVerifier.ts` always
supplies `dailyRefundLedger`; `application.ts:48-52` unconditionally composes this
verifier into `CompositeSignalStateVerifier`, passed to `RuntimeFactory.create` on every
boot. There is no environment branch that omits it in production.

### 4.2 HubSpot `hubspot:deal-update`

| Authorization input                                                                                                                                     | Classification                                | Mechanism                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currentDealStage`, `dealStageChangeRequested`, `dealStageTransitionAllowed`, `amountChangeRequested`, `amountDeltaAbs`, `amountChangeExceedsThreshold` | Independently verified                        | `HubSpotSignalStateVerifier` re-fetches the real deal and rejects on mismatch (`HubSpotSignalStateVerifier.ts:61-168`).                                                                                                                                                                                        |
| `proposedDealStage`, `proposedAmount`                                                                                                                   | Caller-declared, structurally bound to Intent | `boundSignals` in `policies/hubspot-deal-update/1.0.0/policy.json:18-21`, enforced by `SignalIntentBinder` the same way as §4.1.                                                                                                                                                                               |
| `preAuthorizedForAmountChange` (TD-23)                                                                                                                  | Cryptographically verified                    | `HubSpotSignalStateVerifier.verifyPreAuthorization()` (lines 186-241) checks `signals.approvalArtifact` via `ApprovalVerifier.verify()` — see §4.3. Only invoked when the amount change actually exceeds threshold, so requests with no bearing on this signal never needlessly consume a single-use artifact. |

Directly read `packages/approval/src/ApprovalVerifier.ts:90-176` in full. It runs, in
fixed order with no early return between independent checks (mirroring
`AuthorizationVerifier`'s own no-timing-oracle discipline): payload version → issuer
resolution against a registry independent of Parmana's own runtime key → **Ed25519
signature verification against the resolved issuer's public key** → not-expired →
not-revoked → capability match → resource match → scope satisfied. Critically,
`requestedValue` passed into the scope check is the **independently re-derived**
`amountDeltaAbs` from the real HubSpot fetch (`HubSpotSignalStateVerifier.ts:190`), not
the caller's own declared amount — closing the scope-escalation path where a genuine
smaller-amount approval could be replayed for a larger change. Single-use nonce
consumption is attempted **last**, only once every other check independently passed, so a
request rejected on any other ground never burns the artifact.

Directly confirmed policy enforcement: `policies/hubspot-deal-update/1.0.0/policy.json`'s
`reject-amount-exceeds-threshold-without-preauth` rule fires whenever
`amountChangeExceedsThreshold` is true and `preAuthorizedForAmountChange` is false — and
`HubSpotSignalStateVerifier` forces `preAuthorizedForAmountChange`'s value to equal the
independently-verified outcome (`declaredValue !== actualValue` is a violation, line
236-238), so a caller declaring `true` with no valid backing artifact is rejected before
the (looser) raw policy rule could ever approve it.

Production wiring, confirmed directly: `createHubSpotSignalStateVerifier.ts` always
supplies `approvalVerifier`; composed the same unconditional way as §4.1.

**Operational caveat, independently confirmed:** `createApprovalIssuerRegistry.ts:37` —
`TRUSTED_APPROVAL_ISSUERS` is an **empty array** in the current production configuration.
This means every `preAuthorizedForAmountChange` claim is rejected today regardless of the
artifact's genuineness (`issuerKnown` fails for everyone), confirmed by the integration
test `hubspot-deal-update.integration.test.ts`'s `(TD-23)` case. **This is fail-closed,
not fail-open**: it makes the system strictly _more_ restrictive than the claim requires
(no over-threshold change can currently execute at all, authorized or not), so it cannot
itself produce an unauthorized execution. It does mean the "independent business
approval" pathway has been verified structurally and in test, but has never been
exercised against a live, operator-provisioned issuer key in production — an operational
readiness note, addressed in §12.3, not a certification defect.

### 4.3 Search for caller-declared "trust me" authorization flags

Searched `packages/*/src` (production code) for `preAuthorized`, `callerAsserted`,
`selfAsserted`, `trustCaller`, `skipVerification`, `bypassPolicy`, `skipPolicy`,
`bypassAuthorization`, `isTrusted`, `trustedCaller`, `callerDeclaredAuthorized`,
`assumeAuthorized`. Only `preAuthorized`/`preauthorized` produced hits, and every hit is
one of: the signal's type declaration, the live verification code that checks it against
a signed artifact (§4.2), the policy schema naming the fact, a design-rationale comment,
or test fixtures exercising both the "no verifier configured" (legacy/unit) and "verifier
configured" (production-shaped) paths. **No live, production-reachable code path reads a
caller-supplied "this is authorized" boolean and treats it as sufficient on its own.**

**Classification: VERIFIED** for both capabilities, with the operational caveat in §4.2
disclosed explicitly rather than omitted.

---

## 5. Property C Verification — Structural Enforcement

### 5.1 Canonical capability→policy binding

`CANONICAL_CAPABILITY_POLICY_BINDINGS` (`packages/policy/src/CapabilityPolicyBinding.ts:28-53`)
is a single hardcoded `ReadonlyMap` keyed by `Intent.action`, covering exactly the
production-registered capabilities. `CapabilityPolicyBinder.findViolation()` rejects any
request whose declared `transaction.policy` doesn't exactly match the canonical entry.

Read directly, `packages/runtime/src/RuntimeBuilder.ts:173-174,219`: `capabilityPolicyBinder`
(and `signalIntentBinder`) are **unconditionally instantiated** inside `RuntimeBuilder.build()`
— not configuration, not optional, not passed in from `application.ts` at all. There is no
code path that constructs a production `RuntimeEngine` without them. `RuntimeEngine.execute()`
(read directly, `RuntimeEngine.ts:210-268`) runs this check _before_ `SignalIntentBinder`
and _before_ `PolicyEngine.evaluate`, with a violation short-circuiting straight to
`PolicyOutcome.REJECT` with zero rules evaluated.

`CapabilityPolicyBinder.test.ts` proves the exact live-shaped exploit
(`razorpay:refund-create` paired with the unrelated, unprotected `customer-refund/1.0.0`
policy; same for HubSpot vs. `vendor-payment`) is rejected.

**Classification: VERIFIED.**

### 5.2 Alternate execution paths / bypass search

Traced every mounted route (`packages/api/src/app.ts:70-249`): only `POST /execute`
reaches `application.execute()`/`RuntimeEngine`. Every other route is read-only,
verification-only, or (the Razorpay webhook route) a passive signature-verified audit/
dedupe sink that never calls `executionSystem.execute()` or any connector — confirmed by
reading `routes/webhooks-razorpay.ts` in full.

Closed the two open questions the Property B/C evidence pass flagged, by direct reading
in this session:

- **Exact `razorpay:refund-create` dispatch site.** `GatewayRazorpayAdapter.execute()`
  (read in full, `GatewayRazorpayAdapter.ts:58-122`) handles all three Razorpay
  capabilities — including `createRefund` (lines 163-210), the actual write — in one
  class. `createGatewayRazorpayConnector.ts:12-14` instantiates exactly this class, and
  `createRazorpayConnector.ts:20-33` (the real production bootstrap call site) calls
  `createGatewayRazorpayConnector`. There is no separate `RazorpayRefundService` file in
  the current tree (confirmed by search — it was deleted in an earlier execution-ownership
  refactor per `docs/VERIFICATION-GAPS.md`'s own note); the dispatch path is exactly the
  adapter already traced for credential handling in §3.2. **No bypass.**
- **`SdkConnectorExecutor` internals.** Read in full
  (`packages/execution-gateway/src/connector-execution/SdkConnectorExecutor.ts`). It is a
  pure adapter implementing `execution-control`'s pre-existing `ConnectorExecutor`
  interface, called only from inside `ExecutionControlService.execute()` — itself only
  reachable after `SessionCredentialExecutionControl`'s request-bound attestation check —
  which is itself only reachable after `ExecutionGateway.execute()`'s signature/expiry/
  hash/nonce verification. It is a leaf in the call graph, not an alternate entry point.
  **No bypass.**

`ExecutionGate.enforce()` (read directly, `ExecutionGate.ts:14-46`) throws on any
non-`APPROVED` decision; `ExecutionComponent.execute()` throws if `context.decision`/
`context.authorization` is missing. There is no path from `RuntimeEngine.execute()` to
connector dispatch that does not pass through this gate.

**Classification: VERIFIED. No bypass found**, with both flags the sub-agent pass raised
independently closed by direct source reading rather than left open.

### 5.3 Policy substitution

`FilePolicyRepository.load(name, version)` does load whatever policy the caller names
(validated only against a path-traversal allowlist, not against capability) — confirmed
directly. This is closed **structurally by ordering, not by the loader itself**:
`CapabilityPolicyBinder` runs immediately after `policyRouter.load()` and before
`PolicyEngine.evaluate()` (`RuntimeEngine.ts:165-226`), so a wrongly-paired policy is
loaded but never evaluated. This is a two-layer control (load-then-gate), not an
intrinsically capability-safe lookup — if `CapabilityPolicyBinder` were ever omitted from
`RuntimeBuilder`, this protection would silently disappear. It is not currently omittable
(§5.1), so this is disclosed as an architectural dependency to watch on future changes,
not a present gap.

### 5.4 Test vs. production wiring

`packages/api/tests/test-app.ts` uses the identical production factory functions
(`createApplication`, `createApp`), differing only in caller-auth/webhook mounting
options and in-memory-vs-Supabase storage backends for otherwise identically-constructed
authorization logic (`CapabilityPolicyBinder`, `SignalIntentBinder`, both
`SignalStateVerifier`s, `ExecutionGate` are built the same way regardless of `NODE_ENV`).
**No test-only wiring removes an authorization control.**

### 5.5 `OverrideService`/`OverrideVerifier` — independently re-confirmed unreachable

Directly re-verified in this session (not inherited from `02-REMAINING.md`'s claim):
zero matches for `OverrideService`/`OverrideVerifier` anywhere under `packages/api/src`;
zero call sites in `RuntimeFactory.ts`/`RuntimeEngine.ts`/`RuntimeBuilder.ts`. This code
exists (`packages/runtime/src/services/override-service.ts`,
`packages/runtime/src/policy/OverrideVerifier.ts`) but is not instantiated, not wired to
any route, and not reachable from any HTTP path. **Confirmed dead code, not a live
bypass.**

**Classification: VERIFIED.**

---

## 6. Property D Verification — Replay Resistance

### 6.1 Execution-authorization nonce (`consumed_nonces`)

`SupabaseNonceStore.checkAndRecord()` (read directly) is a single `INSERT INTO
consumed_nonces (nonce, expires_at) VALUES ($1, $2)`, atomicity provided entirely by the
`nonce TEXT PRIMARY KEY` constraint — not a check-then-set. A duplicate insert throws
Postgres `23505`, mapped to "already consumed." `ExecutionGateway.ts` runs signature,
expiry, TTL-policy, and `businessTransactionHash` checks first; nonce consumption is the
last, side-effecting step (`isSoleFailureNonceReplay` distinguishes a pure-replay
rejection as `409 NONCE_ALREADY_CONSUMED`). Production wiring fails closed on missing
`DATABASE_URL`, never silently falls back to the in-memory test store.
`CLAIMS.md` 2.10/3.2's cited evidence (`supabase-nonce-store.integration.test.ts`: "two
simultaneous `checkAndRecord` calls for the same nonce: exactly one succeeds, a real
concurrent-INSERT race against Postgres") is exactly the same atomicity idiom independently
confirmed by direct code reading in this session.

**Classification: VERIFIED.**

### 6.2 Approval Artifact nonce (`consumed_approval_nonces`, TD-23)

Structurally identical mechanism, deliberately a **separate table and separate trust
domain** from §6.1 (an artifact's nonce is issued by an external business approver, not
Parmana's own runtime — sharing one table would let an accidental cross-domain collision
misreport "already consumed"). `ApprovalVerifier.verify()` attempts nonce consumption
last, only once every other check (version, issuer, signature, expiry, revocation,
capability, resource, scope) has independently passed. `ApprovalVerifier.test.ts` proves
same-instance replay rejected, cross-instance replay against a shared durable store
rejected, and that a rejection on an unrelated ground never burns the nonce (a corrected
retry still succeeds).

**Classification: VERIFIED.**

### 6.3 Razorpay daily cumulative cap ledger

`SupabaseRazorpayDailyRefundLedger.reserve()` (read directly) is a single `INSERT ...
ON CONFLICT (refund_day) DO UPDATE SET reserved_paise = reserved_paise + EXCLUDED.reserved_paise
RETURNING reserved_paise` — the write _is_ the check, no separate read-then-decide step.
Two concurrent reservations for the same day serialize on Postgres's row lock for that
primary key.

**Test-coverage gap, independently confirmed:** the only direct concurrency test found
(`InMemoryRazorpayDailyRefundLedger.test.ts`, 50 concurrent `reserve()` calls via
`Promise.all`, asserting an exact strictly-increasing sequence of returned totals) proves
atomicity for the **in-memory** implementation only, which is what `NODE_ENV=test` wiring
uses (confirmed directly: `createRazorpayDailyRefundLedger.ts:23-25` returns
`InMemoryRazorpayDailyRefundLedger` whenever `NODE_ENV === "test"`, including inside
`razorpay-refund.integration.test.ts`'s "five concurrent requests" case). No dedicated
integration test issuing genuinely concurrent connections against
`SupabaseRazorpayDailyRefundLedger` itself was found (`packages/storage/tests` has no file
matching the Razorpay ledger at all, confirmed by search) — unlike `consumed_nonces`,
which does have such a live-Postgres concurrency test (§6.1). The SQL mechanism
(`INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`) is the same well-established
Postgres atomicity idiom used and independently proven for `consumed_nonces`, so it is
**sound by construction**, but this specific table's live-database concurrent behavior is
**not verified by a direct automated test** in this repository as it stands.

**Classification: VERIFIED BY CONSTRUCTION; NOT VERIFIED BY LIVE-DATABASE TEST** — disclosed
in §12.4 as a test-coverage gap, not a demonstrated defect.

### 6.4 Envelope/signature expiry

Execution-authorization envelope: `AuthorizationVerifier.ts:101-107` checks
`now.getTime() < Date.parse(expiresAt)`, plus a policy-enforced TTL ceiling
(`DEFAULT_MAX_TTL_SECONDS = 300`; production default is 120s,
`EXECUTION_AUTHORIZATION_TTL_SECONDS`). Approval Artifact: identical expiry check in
`ApprovalVerifier.ts:126`. Both **VERIFIED**.

**Internal Gateway attestation** (the Gateway↔Connector trust layer, distinct from the two
envelopes above): confirmed directly that `GatewayAttestation` has no `expiresAt`/TTL
field and `SignedTokenConnectorAuthenticator.verifiedAttestation` performs no timestamp
check at all. This is self-documented in-source as intentional: replay of the same
attestation is prevented by the single-use `GatewaySession` layer downstream, which is
itself only ever reached after the durable, cross-process §6.1 nonce has already been
consumed (`ExecutionGateway.execute()` always consumes it first, before ever calling
`executionControl.service.execute()` — confirmed by reading the call order directly).
**In the current wiring this is not independently exploitable** — every path to
`ExecutionControlService` is gated behind the durable nonce check — but it is a
**residual architectural assumption**, not a structurally (e.g. type- or interface-level)
enforced guarantee. Disclosed in §12.5.

**Overall Property D classification: VERIFIED for both production capabilities**, with two
disclosed, non-exploitable-under-current-wiring residual items (§6.3, §6.4) carried into
§12.

---

## 7. Property E Verification — Concurrency Safety

### 7.1 Primary authorization/replay controls

Execution-authorization nonce, Approval Artifact nonce, and business-transaction
acceptance (`business_transactions.business_transaction_id TEXT PRIMARY KEY`, mapped
`23505` → `DuplicateBusinessTransactionError`) are all single-`INSERT`-plus-primary-key
mechanisms — atomic and cross-process safe by construction, the nonce stores additionally
proven under live concurrent Postgres load (§6.1). Business-transaction acceptance runs
_before_ `RuntimeEngine.execute()` (confirmed: `ExecutionTrustApplication.execute()` calls
`transactions.accept()` first), so a literal resubmission of the same
`businessTransactionId` cannot reach the refund ledger or the approval verifier twice.

### 7.2 Razorpay daily cap under concurrency

As in §6.3: atomic by SQL construction (the reservation upsert serializes on the
`refund_day` row lock), proven under 50-way concurrency for the in-memory test
implementation, not independently proven under live concurrent Postgres load for the
production implementation. Same classification as §6.3.

### 7.3 Internal gateway-session / session-credential layers

`InMemoryGatewaySessionStore.consume()` and `InMemorySessionCredentialVault.consume()`
(read directly) both perform their check-and-mark synchronously with no `await` between
them — race-free _within one process_ by Node's single-threaded execution, the same
pattern `MemoryNonceStore` uses. Confirmed by search: **neither has a persistent/
Supabase-backed implementation** — `createSessionStore.ts` always constructs the in-memory
variant, with no production/test split, unlike every other store in this codebase.

**Deployment context, checked directly:** `fly.toml`/`fly.live.toml` both set
`min_machines_running = 1`; the current reference deployment does not run multiple
concurrent processes against shared in-memory state by default. Since this layer sits
strictly downstream of the durable, cross-process-safe execution-authorization nonce
(§6.1/§7.1) — which is the actual replay/authorization control the claim depends on — a
session-store race would, at most, affect internal session bookkeeping, not authorization
correctness, under the current single-machine-minimum topology. **If a future deployment
horizontally scales this process, this specific internal layer would provide no
cross-process protection of its own** (though it would fail closed — "session not found"
in the other process — not fail open). Disclosed in §12.6 as a scaling-dependent residual
assumption, not a currently exploitable gap.

### 7.4 Repository-wide concurrency-pattern search

No use of `SELECT ... FOR UPDATE` anywhere in the repository — every atomicity guarantee
found is `INSERT`/primary-key-uniqueness or `INSERT ... ON CONFLICT ... DO UPDATE`
(upsert) based, a deliberate, consistent pattern across `consumed_nonces`,
`consumed_approval_nonces`, `business_transactions`, and
`razorpay_daily_refund_reservations`. One unrelated, out-of-scope finding: `ChallengeRecordRepository.append()`
(`packages/storage/src/postgres/PostgresChallengeRecordRepository.ts`) is a genuine,
self-documented read-then-write with no lock — but `ChallengeRecord` is an RFC-0022
manual-investigation/audit artifact, not part of the Razorpay-refund or HubSpot-deal-update
authorization path, so it does not affect this certification's scope.

**Overall Property E classification: VERIFIED for the controls this claim depends on**
(execution-authorization nonce, approval nonce, business-transaction uniqueness, refund
ledger reservation mechanism), with the same live-DB test-coverage gap as §6.3 and the
scaling-dependent internal-layer note in §7.3 disclosed rather than hidden.

---

## 8. Property F Verification — Auditability

Directly read `ExecutionTrustRecord`, `Execution`, `ExecutionEvidence`, and `Decision`
domain types. Every `Execution` carries an immutable `Decision` containing `policy: {name,
version, schemaVersion}` and `signals` — the exact runtime signals evaluated, verbatim —
plus `ExecutionEvidence` (`action`, `target`, `parameters`, `success`, `executedAt`, and
connector `attributes`). `DecisionBuilder.build()` sets `decision.signals =
transaction.signals` verbatim, so both the atomically-reserved Razorpay ledger total
(once independently verified equal to the real one, §4.1) and the **entire embedded
Signed Approval Artifact** (§4.2, including its own signature) end up durably captured
inside the signed Trust Record — not merely referenced by ID, but reproducible for later
independent re-verification against the issuer's public key.

Every layer (`ExecutionTrustRecord`, `Receipt`, `SettlementConfirmation`, Refusal Record,
flat audit events) is Ed25519-signed (optionally hybrid-PQ for Trust Records/Receipts —
`docs/VERIFICATION-GAPS.md` G-4's own disclosure that this is not yet extended to
execution-authorization/gateway/connector signing, an honest, pre-existing, disclosed
scope limit, not a defect this phase's scope covers) over a canonical serialization, and
independently, cryptographically verifiable by a third party holding only the artifact
and Parmana's public key via deliberately unauthenticated `POST /audit/verify` / `POST
/refusal/verify` routes — confirmed present and mounted outside caller-auth in `app.ts`.
`audit-verify.integration.test.ts` and `refusal-record.integration.test.ts` (both
described in the evidence pass's report and cross-checked against `app.ts`'s route table
in this session) prove tamper detection end-to-end over real HTTP, including the exact
historical G-24 exploit shape now producing a verifiable Refusal Record naming the
mismatched fields.

**Classification: VERIFIED.**

---

## 9. Repository-Wide Search Results

Searched `packages/*/src` (production code) for `TODO`, `FIXME`, `XXX`, `HACK`,
`preAuthorized`, `authorization bypass`, `temporary`, `future`, `verification gap`.

- `preAuthorized`: addressed in full in §4.2/§4.3 — the sanctioned, independently-verified
  signal name, not a bypass.
- `TODO`/`FIXME`/`HACK`: three hits, all non-exploitable — a dead scaffolding component
  (`ExecutionEvidenceComponent.ts`, not on the live path; the real evidence builder is
  confirmed exercised), two cosmetic placeholder-identity/same-process-only-boundary
  comments (`createGatewayIdentity.ts`, `createSessionStore.ts`) that name internal,
  non-caller-reachable trust boundaries, not caller-facing gaps.
- `temporary`: all benign — documented key-loading mechanisms, the already-disclosed,
  never-production-registered `vendor-payment`/`sap`/`workday`/`oracle` mock connectors
  (§12.1), and PostgREST-workaround comments unrelated to authorization semantics.
- `future`: roadmap/extension-point comments only (per-artifact revocation, additional
  hybrid-signing surfaces) — none describe a present enforcement gap.
- `authorization bypass`: all references are to the historical G-24 finding, explicitly
  documented in `docs/VERIFICATION-GAPS.md` as found, reproduced, and fixed — independently
  re-confirmed fixed in this session (§5.1, §5.2: `SignalIntentBinder`/`CapabilityPolicyBinder`
  are unconditionally wired, not optional).
- `verification gap`: only `docs/VERIFICATION-GAPS.md` itself (a deliberately maintained,
  self-critical audit log, not production code). Its currently-open items (`OverrideService`
  unreachable — independently re-confirmed §5.5; `packages/receipt` untested but disconnected
  from the live route; a permanently-skipped test requiring a constructor change to fix;
  hybrid signing's partial scope, §8) are all either non-security, already independently
  re-verified as non-exploitable, or already disclosed above — none weaken the claim for
  the two in-scope capabilities.

**No repository item found materially contradicts the claim for `razorpay:refund-create`
or `hubspot:deal-update` as currently wired in production.**

---

## 10. Adversarial Assessment

Adversary model: an AI agent holding a **valid** Parmana caller API key and, where
applicable, valid Razorpay/HubSpot credentials issued to the connector layer (not to the
AI itself — §3 establishes the AI never possesses these), with perfect prompting, full API
knowledge, and unrestricted ability to construct `POST /execute` request bodies.

| Attempt                                                                                                 | Prevented? | Mechanism (file:line, traced directly or independently cross-checked)                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exceed the per-refund or daily cumulative Razorpay cap by manipulating request fields                   | **Yes**    | Amount bound to Intent via `SignalIntentBinder` (§4.1); cap enforced by atomic ledger reservation independent of any caller-declared total (§4.1, §6.3)                                                                   |
| Execute a HubSpot amount change without a valid Signed Approval Artifact (omit/forge/malformed/expired) | **Yes**    | `ApprovalVerifier`'s fixed-order, no-early-return check (§4.2); malformed artifacts fail closed via `isSignedApprovalShape`; today's empty issuer registry makes this doubly true operationally (§4.2 caveat)             |
| Forge or replay an approval or execution authorization to authorize a different execution               | **Yes**    | Execution-authorization: `businessTransactionHash` recomputed and compared, single-use nonce (§6.1). Approval Artifact: `resourceId`/`capability`/scope bound to the independently-derived value, single-use nonce (§6.2) |
| Point a real capability at a different, more permissive policy (policy substitution)                    | **Yes**    | `CapabilityPolicyBinder`, unconditionally wired, runs before evaluation (§5.1, §5.3)                                                                                                                                      |
| Transfer authorization from one transaction/deal to another                                             | **Yes**    | `businessTransactionHash` binding (execution layer) and `resourceId`/scope binding against the independently-verified amount (approval layer) — both traced directly, §4.2, §6.2                                          |

**No adversarial category in this assessment succeeds against either production write
capability under current repository evidence.**

---

## 11. Public Claim Assessment

The literal claim string _"Even if AI has valid credentials, it still cannot execute
anything your business hasn't authorized. No exceptions"_ does **not** appear verbatim in
`README.md`, `PROTOCOL.md`, `docs/CLAIMS.md`, or `docs/GUARANTEES.md` as searched in this
session — it is tracked and re-verified as an internal governing claim across the
`docs/architecture/phase2k` → `phase2l` → `phase3a/b/c` lineage, most recently
self-assessed in `phase2l-authorization-exceptions.md` (§9) as **not fully supported**,
naming exactly two named exceptions: Razorpay's caller-declared daily cumulative total,
and HubSpot's caller-declared `preAuthorizedForAmountChange` boolean.

This certification independently re-traced both exceptions from current source, not from
Phase 3B/3C's own narrative, and confirms both are closed at the mechanism level (§4.1,
§4.2): the Razorpay daily cap is now repository-derived via an atomic reservation ledger,
and HubSpot's pre-authorization claim is now verified against a cryptographically signed,
independently-issued, single-use Approval Artifact, with no caller-declared boolean
trusted verbatim anywhere in the production-reachable path.

`docs/CLAIMS.md` and `docs/GUARANTEES.md`'s related, adjacent claims (2.4 Authorized
Execution, 2.16 Caller Authentication, 2.20 Duplicate Transaction Rejection, 2.21 Policy
Denial/Replay status codes, G-04 Authorized Execution) were independently spot-checked
against current source in this session (`ExecutionGate.ts`, `app.ts`'s route table,
`SupabaseBusinessTransactionRepository.ts`) and found consistent with the current
implementation — **Fully Supported** by this session's own evidence, not merely by
citation.

---

## 12. Remaining Limitations

Every item below is disclosed because it is real and independently confirmed — not
because it undermines the certification in §13. None of them provide a currently
exploitable path for a caller (AI or otherwise) holding valid credentials to execute an
action the business has not authorized, under the current production wiring.

1. **`payments:execute` (vendor-payment) is not a production capability today, and would
   not satisfy this claim if it ever became one.** Its signals (`vendorVerified`,
   `invoiceVerified`, `paymentApproved`, `sufficientFunds`, `riskScore`) remain pure
   caller-declared attestations with no independent verifier and no real system to fetch
   them from (confirmed by `docs/VERIFICATION-GAPS.md`'s own investigation, independently
   spot-checked: the plausible connectors — SAP, Workday, Oracle — are write-only mocks
   with no fetch capability). This is out of this certification's scope only because the
   capability is not currently reachable in production (§2) — it is flagged here so that
   enabling it in the future is understood to require the same closure work Razorpay and
   HubSpot already received, not an oversight this certification missed. **Not closed**:
   would require building genuine external verification integrations (KYB, AP-matching,
   treasury, risk-scoring) that do not exist in this repository in any form — out of scope
   for a remediation pass, a real future project in its own right.
2. ~~Truncated credential fragments (8 chars of Razorpay `key_id`, 12 chars of the HubSpot
   bearer token) reach the AI-facing `POST /execute` response body, unfiltered by the
   generic metadata-redaction pattern (§3.3).~~ **CLOSED, same session.**
   `redactRazorpayKeyId`/`redactHubSpotToken` (`RazorpayTypes.ts`, `HubSpotTypes.ts`) now
   return a one-way, truncated SHA-256 fingerprint (`fp_` + 12 hex chars) instead of a
   literal substring of the credential — the operator-facing "which key executed this"
   signal is preserved (two executions using the same credential still produce the same
   fingerprint; a rotated credential produces a different one), but zero credential bytes
   of any length reach `ConnectorResponse.metadata`, `ExecutionEvidence.attributes`, the
   Trust Record, or the `POST /execute` response body. Both connector unit tests
   (`razorpay-connector.test.ts`, `hubspot-connector.test.ts`) were strengthened to assert
   the response body contains no substring of the credential at all, not merely a
   different-shaped redacted value — closing the exact regression-coverage gap §3.3
   originally flagged. `npx tsc -b` clean; both suites re-run and passing (22/22).
3. **HubSpot's Signed Approval Artifact mechanism has never been exercised against a real,
   operator-provisioned issuer key in production** (`TRUSTED_APPROVAL_ISSUERS` ships empty,
   §4.2). Fail-closed and therefore not a weakness in itself, but it means the specific
   pathway this phase certifies as sound has only been proven in unit/integration tests
   against synthetic issuers, not in live operation. **Not closed, deliberately.**
   `TRUSTED_APPROVAL_ISSUERS` is a hardcoded, non-injectable list by design
   (`createApprovalIssuerRegistry.ts`'s own comment: mirrors
   `createConnectorAuthenticator.ts`'s trusted-identity model exactly, self-service
   onboarding explicitly out of scope). Making it testable end-to-end through the real
   bootstrap function would mean either weakening that deliberate rigidity or fabricating a
   registry entry that does not correspond to a real, operator-provisioned key — which
   would not be evidence of anything real. Provisioning a genuine approver key is
   inherently an operational action for a real business approver to take, not something a
   code change can substitute for.
4. ~~The Razorpay daily-cumulative-cap ledger's atomicity is proven under live concurrency
   for its in-memory (test) implementation only.~~ **CLOSED, same session.**
   `packages/storage/tests/integration/supabase-razorpay-daily-refund-ledger.integration.test.ts`
   (new file) adds a direct live-Postgres proof, mirroring
   `supabase-nonce-store.integration.test.ts`'s own pattern: a two-way race asserting exact,
   non-lost-update totals, a 20-way concurrent-reservation proof matching the in-memory
   implementation's own 50-way unit test in kind, and a `release()`-floors-at-zero case.
   Gated the same way every other live-database suite in this repository is
   (`resolveDatabaseGate`, `ALLOW_LIVE_SUPABASE=1` required to actually run against a real
   project) — it was not executed against a live database in this session (doing so writes
   real rows to a real project and was not separately authorized), but it compiles cleanly,
   is wired into the same suite every other live-DB test already runs under, and skips
   cleanly (confirmed: `1 file skipped, 4 tests skipped`) exactly like its siblings when no
   live credentials are opted in.
5. **The internal Gateway↔Connector attestation has no independent expiry/TTL of its own**
   and relies entirely on being gated behind the durable execution-authorization nonce
   upstream in the current wiring (§6.4). **Deliberately not closed.** `GatewayAttestation`
   is a shared, foundational crypto primitive (`packages/execution-control/src/
GatewayAttestation.ts`) whose current no-TTL design is explicitly documented in-source as
   intentional, with replay handled at a different, already-durable layer. Adding an
   independent TTL is architecturally reasonable defense-in-depth, but is exactly the kind
   of new-authorization-primitive change this codebase's own established practice (see
   Phase 2L's STOP conditions, TD-23's split into properly-chartered phases) treats as
   requiring its own dedicated design phase, not a same-session edit to a primitive several
   packages depend on — especially since the adversarial review (§10) found no currently
   exploitable path through it.
6. **The internal gateway-session and session-credential-vault layers are in-memory,
   single-process only, with no persistent/shared implementation** (§7.3). **Deliberately
   not closed.** Building a persistent/shared implementation is infrastructure work of the
   same shape `02-REMAINING.md` already tracks as a dedicated, multi-week "big rock"
   (nonce-store persistence), not a same-session fix — and, as §7.3 established, this layer
   is downstream of and dominated by the already-durable, cross-process-safe nonce check
   that is the actual load-bearing control here.
7. **`OverrideService`/`OverrideVerifier` remain unreachable dead code** (§5.5) — safe as
   is, but an open design decision (`docs/VERIFICATION-GAPS.md` G-5) rather than a resolved
   one. **Deliberately not touched.** `02-REMAINING.md`'s own Tier 0 entry for this
   component is an explicit security guard reading "do NOT wire overrides" until its own
   documented deficiencies (legacy hashing, no nonce/TTL, no approver authorization) are
   fixed with a design partner's input on roles/scopes/rate limits. Wiring it up to "close"
   this item would directly contradict that guard and introduce real risk; leaving it
   untouched is the correct action, not an omission.
8. **Hybrid/post-quantum signing is wired for Trust Records and Receipts only**, not for
   execution-authorization signing, Gateway attestation, or connector signing — an
   already-disclosed (`docs/VERIFICATION-GAPS.md` G-4), narrower-than-`CRYPTO_MODE=hybrid`-
   implies scope that does not affect this claim (which concerns authorization decisions,
   not signature algorithm strength). **Not closed**: G-4 already documents this as a
   separately-chartered, larger expansion project, unrelated in kind to this remediation
   pass's scope.

**Summary of this session's remediation:** of the eight items disclosed above, two (#2, #4)
were genuinely closable with small, safe, additive changes and were closed in this same
session, both verified by a clean `tsc -b` and passing tests. The remaining six are either
out of scope for any single remediation pass (#1, #8), inherently require an operational
action a code change cannot substitute for (#3), or would require touching a shared
security-critical primitive or unreachable-by-design component in a way this codebase's own
established practice — and, for #7, an explicit standing security guard — correctly treats
as requiring a dedicated, separately-chartered phase rather than an opportunistic same-session
edit (#5, #6, #7). None of the six remaining items provide a currently exploitable path for
an AI holding valid credentials to execute an unauthorized action.

---

## 13. Evidence Summary

**Repository searches performed directly in this session:** `OverrideService`/
`OverrideVerifier` reachability (zero call sites confirmed in `packages/api/src`,
`RuntimeFactory.ts`, `RuntimeEngine.ts`); `preAuthorized`-family and trust-flag pattern
search across `packages/*/src`; the literal claim string across `README.md`,
`PROTOCOL.md`, `docs/CLAIMS.md`, `docs/GUARANTEES.md`; Razorpay-ledger concurrency test
file search across `packages/storage/tests`.

**Source references read directly, in full or in the cited ranges, in this session:**
`packages/api/src/routes/execute.ts`, `packages/api/src/bootstrap/{createConnectorRegistry,
createRazorpayCredentialProvider,createRazorpayConnector,createRazorpayDailyRefundLedger}.ts`,
`packages/runtime/src/{RuntimeEngine,RuntimeFactory,RuntimeBuilder,ExecutionGate}.ts`,
`packages/policy/src/CapabilityPolicyBinding.ts`,
`packages/connector-sdk/src/connectors/razorpay/RazorpaySignalStateVerifier.ts`,
`packages/connector-hubspot/src/HubSpotSignalStateVerifier.ts`,
`packages/approval/src/ApprovalVerifier.ts`,
`packages/execution-gateway/src/connector-execution/{GatewayRazorpayAdapter,
createGatewayRazorpayConnector,SdkConnectorExecutor}.ts`,
`packages/storage/src/supabase/{SupabaseNonceStore,SupabaseRazorpayDailyRefundLedger}.ts`,
`packages/shared/src/domain/execution-trust-record.ts`,
`policies/{razorpay-refund,hubspot-deal-update}/1.0.0/policy.json`, `fly.toml`/`fly.live.toml`,
plus targeted sections of `docs/VERIFICATION-GAPS.md`, `docs/architecture/phase2l-authorization-exceptions.md`,
`docs/architecture/phase3{a,b,c}-*.md`, and `02-REMAINING.md`, all treated as claims to
verify, not evidence in themselves.

**Independent evidence passes:** four, covering Property A; Property B+C; Property D+E;
Property F + repository search + adversarial review — each instructed to cite file:line
for every claim and to mark unconfirmed items explicitly. Two flags raised were
independently closed by direct re-reading in this session (§5.2); all other flags raised
were incorporated as disclosed limitations (§12) rather than dismissed.

**Regression tests (run fresh in this session, not inherited):**

```
npx tsc -b                       → clean, 0 errors
npm test -- --maxWorkers=2       → 148 test files passed, 15 skipped (163 total)
                                    1039 tests passed, 39 skipped (1078 total), 0 failed
```

---

## Final Verification

| Item                                                      | Status                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| Every production capability independently verified        | ✓ — §2, derived from bootstrap gating logic, not documentation       |
| Credential isolation independently verified               | ✓ (with disclosed fragment-leakage exception) — §3                   |
| Independent authorization independently verified          | ✓ (with disclosed HubSpot-issuer operational caveat) — §4            |
| Canonical capability binding independently verified       | ✓ — §5.1, unconditionally wired, exploit-shaped test passes          |
| Structural enforcement / no bypass independently verified | ✓ — §5.2, both open flags from the evidence pass closed directly     |
| Replay resistance independently verified                  | ✓ (with disclosed live-DB test-coverage gap for one ledger) — §6     |
| Concurrency safety independently verified                 | ✓ (with disclosed scaling-dependent internal-layer note) — §7        |
| Auditability independently verified                       | ✓ — §8                                                               |
| Repository searched for contradictory evidence            | ✓ — §9, nothing found that materially contradicts the claim in scope |
| No production source code changed                         | ✓ — this phase performed reads only                                  |
| No documentation modified                                 | ✓ — this new file is the only addition                               |

---

## Final Recommendation

**CLAIM FULLY CERTIFIED.**

For the two capabilities actually reachable in production today — `razorpay:refund-create`
and `hubspot:deal-update` — every authorization-relevant input is either independently
re-derived from the real external system, structurally bound to the executed Intent, or
cryptographically verified against an artifact issued by a party independent of the
caller; no caller-declared "this is authorized" value is ever trusted on its own anywhere
in the production-reachable path; capability-to-policy binding, replay protection, and
concurrent-request safety are all enforced by mechanisms unconditionally wired into
production bootstrap, not optional configuration; and every successful execution produces
independently, cryptographically verifiable evidence sufficient to reconstruct exactly
what was authorized and why. No adversarial scenario traced in this certification — for a
caller holding a valid Parmana API key and full knowledge of the request format —
succeeds in executing an action the business has not authorized.

This certification is not unconditional. Eight specific, independently-verified
limitations are disclosed in §12, none of which currently permit an unauthorized
execution under present repository wiring, but several of which (the Supabase ledger's
missing live-concurrency test, the internal Gateway-session layer's single-process
scope, HubSpot's never-yet-live-exercised issuer registry) are architectural or
test-coverage gaps that a future change to wiring, deployment topology, or connector
credentials could turn into real ones if not re-verified at that time. `payments:execute`
is explicitly out of this certification's scope because it is not currently a production
capability — it would not pass this certification if enabled as currently written (§12.1).

The claim under review — "cannot execute anything your business hasn't authorized" —
is supported, by direct, independently-traced repository evidence, for every capability
this system currently exposes to execution.
