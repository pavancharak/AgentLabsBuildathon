# Parmana Codebase Reference

**Purpose:** a grounded technical map of this repo, built by reading actual source
(all of `packages/*/src`, `typescript/src`, `python/parmana`, `schemas/`, `policies/`,
and the storage/migration layer — not by trusting `docs/*.md`, which drift from code
regularly and are cited elsewhere in this repo as often stale). Built 2026-09-07.
Read this file before re-reading the repo from scratch; it should save the ~6-parallel-
agent, full-codebase pass that produced it. Update it (don't just append) when you make
a change that invalidates something below — a stale reference file is worse than none,
because it gets trusted.

**How to use this file:** it is a map, not a source of truth. Before recommending or
editing based on something below that names a specific file, function, or line number,
confirm it still exists — this document can go stale exactly like the docs it was built
to replace. Treat "the reference says X" as "X was true on 2026-09-07," not "X is true
now."

**Session changelog** (bottom of this file) records exactly what changed after this
document's initial build, so both stay honest over time.

---

## 1. Architecture, bottom-up

```
@parmana/shared        (domain types, config, errors, repository interfaces — zero internal deps)
        |
        v
@parmana/crypto         (signing/hashing/verification primitives)
        |
        +-------------------+-------------------+
        v                   v                   v
@parmana/capability-   @parmana/envelope-   @parmana/policy
   registry (leaf,          verifier          (rule engine, signal/intent
   capability->policy                          binding, capability-registry
   binding map)                                re-export)
        |                   |                   |
        +-------------------+-------------------+
                            v
                  @parmana/execution-system   (ExecutionSystem/ExecutionRequest port)
                            |
                            v
                  @parmana/execution-control  (session-scoped, single-use, credential-
                            |                   isolating connector dispatch)
                            v
                  @parmana/execution-gateway  (ExecutionGateway implements ExecutionSystem;
                            |                   composes envelope-verifier + execution-control;
                            |                   houses production connector adapters)
                            v
                  @parmana/runtime            (RuntimeEngine orchestrator: policy load ->
                            |                   binding checks -> evaluate -> sign -> execute
                            |                   -> trust record)
                            v
                  @parmana/api                (Express HTTP server, composition root,
                                                caller-auth, governance, bootstrap)

Leaf/standalone packages, not in the above spine:
  @parmana/storage        (StorageProvider + repositories, Memory + Supabase backends)
  @parmana/approval       (verifies externally-signed Approval Artifacts — a narrower,
                            different mechanism from execution authorization)
  @parmana/connector-sdk  (base Connector authoring contract + test doubles)
  @parmana/connector-github, @parmana/connector-hubspot
                           (capability IDs, types, metadata — passive; real adapters live
                            in execution-gateway/connector-execution)
  @parmana/governance-ui  (separate Express app, talks to @parmana/api over plain HTTP,
                            zero @parmana/* runtime deps by design)
  @parmana/replay         (decision replay — re-runs PolicyEngine.evaluate only, not a
                            full execution replay)
  typescript/ (npm "@parmana/sdk"), python/ (pip "parmana")
                           (client SDKs, HTTP wrappers over the API — Python's models are
                            codegenned from packages/shared; TypeScript's are hand-written
                            and lag behind)
```

Only 4 real capabilities exist in production today: `hubspot:deal-fetch`,
`hubspot:deal-update`, `github:pr-fetch`, `github:pr-merge`. Everything else
(`vendor-payment`, `customer-refund`, `database-change`, `access-control`,
`connector-capability`, `llm-tool-call`, `production-deployment`,
`rag-document-access`) has a policy file under `policies/` but no live connector —
these are reference/example policies, not reachable through any registered capability.

---

## 2. `packages/api` — the HTTP server (composition root)

Express 4 app. `src/server.ts` boot order: `assertStorageConfigured()` ->
`assertSigningKeyMaterialConfigured()` -> `createExecutionSystem()` ->
`createApplication()` -> `createCallerAuthenticator()` -> `createApp()` -> listen ->
(unawaited) `runPolicyGovernanceIntegrityCheckAtStartup()`.

**Routes** (`src/app.ts`), mount order: `/health`, `/ready`, `/openapi.yaml`,
`/documentation` (all pre-auth) -> `/refusal/verify`, `/audit/verify` (deliberately
pre-auth, RFC-0021) -> caller-auth middleware -> `/`, `/version`, `/callers/me`,
`/execute`, `/verify`, `/verification/:id`, `/refusal/:id`, `/receipt`,
`/receipt/latest/:id`, `/transactions`, `/policies/validate`,
`/policies/:name/:version/pending-changes` (+ related), `/trust-records/:id`,
`/replay` -> error handler.

**`POST /execute`** (`src/routes/execute.ts`): validate UUID shape -> map body
(structural only, no runtime validation — real validation happens inside
`@parmana/runtime`) -> `isPrincipalAllowed` -> `isCapabilityAllowed` -> overwrite
`transaction.metadata.submittedBy`/`grantedCapability` server-side (never trusted from
client) -> `application.execute(transaction)`.

**`POST /transactions`** (`src/routes/transactions.ts`): same pipeline as `/execute`
(both call `application.execute()`), status 201 vs 200. As of commit `7da8f0d` it now
performs identical `grantedCapability`/`caller.capability_granted` handling to
`/execute` — this used to be a real drift (see §7 Session Changelog, gap 33/NF-004).

**Ownership scoping** (`auth/isOwnedByCaller.ts`): compares
`transaction.metadata?.submittedBy === callerId`; **returns `true` for a
nonexistent transaction** (deliberate — 404-vs-403 indistinguishable by design, avoids
leaking existence). Used by `/verify*`, `/receipt*`, `/refusal-get`, `/trust-records`,
`/replay`.

**Auth layers** (independent, non-substitutable):
1. Caller auth (`middleware/caller-auth.ts`) — Bearer token, SHA-256(key) via
   `timingSafeEqual` (`auth/StaticKeyAuthenticator.ts`), sets `req.callerId` +
   `req.callerAllowedPrincipalIds`/`callerAllowedCapabilities`.
2. `isPrincipalAllowed`/`isCapabilityAllowed` — fail-closed (unset
   `allowedCapabilities` = caller can invoke nothing; `"*"` is explicit wildcard).
3. `isOwnedByCaller` — IDOR prevention.
4. Human-only + step-up (`isHumanCaller`, `PolicyChangeStepUpVerifier`) — narrower,
   only for the 4 pending-policy-change handlers (maker-checker governance).

**Audit trail** (`auth/CallerAuditSink.ts`): 7 event types incl.
`caller.capability_granted`/`_denied`, `caller.principal_denied`,
`caller.non_human_denied`, `caller.structural_rejected`. Fail-closed by design
(`recordCallerAuditEvent` — write failure blocks the request with 503
`AUDIT_UNAVAILABLE`), **except** the pre-identity malformed-body path in
`error-handler.ts`, which is deliberately fail-open (no accountability to protect
yet). `SupabaseCallerAuditSink` writes via raw `pg` (`PostgresPoolFactory`), **not**
`supabase-js`/PostgREST — a repo-wide workaround for a stuck PostgREST schema cache
(ticket SU-437429), also applied to every nonce store and the `/ready` probe. Per-caller
hash chain (not global) via `pg_advisory_xact_lock(hashtext(callerId))`
(`chainHash`/`previousChainHash`/`chainPosition`, `CallerAuditChainVerifier` in
`@parmana/crypto` verifies offline, no DB needed).

**Governance write path** (`governance/PolicyChangeApprovalService.ts`): persists the
signed approval record **before** writing the live policy file (recoverable-failure
ordering). `verifyPolicyGovernanceIntegrityAtStartup.ts` is fail-open (never blocks
startup), detects live-file-vs-approval-record drift.

**Bootstrap gotchas** (`src/bootstrap/`):
- **Update 2026-09-10:** `createGatewayIdentity.ts`'s `gatewayId` is now configurable via
  `PARMANA_GATEWAY_ID` (defaults to the same `"parmana-gateway"` literal), and
  `createSessionStore.ts`'s session-issuance token is `Object.freeze({ token: randomUUID() })`
  instead of a bare `{}` — both `TODO` comments are gone, replaced with an explanation of why
  each is a deliberate design rather than an unaddressed placeholder. The line below is the
  pre-fix state, kept for this document's own historical accuracy at its 2026-09-07 build
  date:
- ~~`createGatewayIdentity.ts`/`createSessionStore.ts` carry literal placeholder values
  (`gatewayId: "parmana-gateway"`, `Object.freeze({})` as the session-issuance auth
  token) with `TODO: Replace with production` comments — currently shipped, not
  aspirational.~~
- `createConnectorRegistry.ts` registers only 3 connectors conditionally:
  `test-fixture` (NODE_ENV=test only), `hubspot` (if `HUBSPOT_PRIVATE_APP_TOKEN` set),
  `github` (if all 3 GitHub App env vars set). As of commit `672aee6`, calls
  `assertConnectorCapabilitiesBound()` after building all registrations (see §7, gap 34).
- `createConnectorRoute.ts`: as of commit `8fdc09c`, always throws — the dead
  `"payments:execute" -> "vendor-payment"` mapping was removed (that connector was
  never registered; the function is only reachable via `ExecutionGateway`'s deprecated
  `executionControl.channel` path, never the `executionControl.service` path this repo
  actually wires).
- `TRUSTED_APPROVAL_ISSUERS` (`createApprovalIssuerRegistry.ts`) is an empty array **by
  design** — every `preAuthorizedForAmountChange` claim in HubSpot signal verification
  currently fails closed. Still true as of this writing (see §8, D-4/NF-005, undecided).
- `LateBoundSignalStateVerifier` (`executionGatewaySignalStateVerifier.ts`) — narrow
  window between Gateway construction and `application.ts` binding where signal-freshness
  checking is silently permissive (`[]`, same-process startup only).

**Rate limiting** is per-process (in-memory `express-rate-limit` store) by default — fleet
ceiling is `limitPerMinute * machineCount`, not fleet-wide. **Update 2026-09-10:** when
`DATABASE_URL` is configured, `PostgresRateLimitStore`
(`packages/storage/src/postgres/PostgresRateLimitStore.ts`) shares counts fleet-wide
instead; see `docs/VERIFICATION-GAPS.md` G-41.

---

## 3. `packages/runtime` — the orchestrator

`RuntimeEngine.execute()` flow: load policy via `PolicyRouter` (from `@parmana/policy`
— a second, incompatible `packages/runtime/src/policy/PolicyRouter.ts` existed at one
point and has since been deleted, see §10 changelog) -> compute `policyContentHash` ->
`CapabilityPolicyBinder.findViolation()` (short-circuits to REJECT if capability has a
canonical binding the declared policy doesn't match) -> `SignalIntentBinder.
findViolations()` (short-circuits to REJECT if policy's `boundSignals` don't match
executed Intent) -> `PolicyEngine.evaluate()` (the actual rule engine) -> if APPROVE and
a `SignalStateVerifier` is configured, independently re-derive real-world facts and
override to REJECT on mismatch (**skipped entirely for any REJECT** — a policy denial
makes zero external calls) -> `DecisionBuilder.build()` -> if not APPROVED,
`writeRefusalRecord()` (**fail-open**, `console.error` only, never blocks the REJECT) ->
`ExecutionGate.enforce()` (throws `RuntimeError` 403 `POLICY_DENIED` synchronously for
any non-APPROVED decision) -> build `ExecutableContent` -> sign
`SignedExecutionAuthorization` via `RuntimeAuthorizationSigner` (carries
`policyContentHash`, `signalsHash`, `submittedBy`, `grantedCapability`) -> `RuntimePipeline`
(2 stages: `TrustChainValidationComponent`, `ExecutionComponent` — the latter rebuilds
the `Execution` artifact from scratch via `ExecutionService.create()`, discarding the
transient one built earlier for hook visibility) -> `BusinessTrustPipeline` ->
`BusinessTrustRecordBuilder.build()` -> signed `ExecutionTrustRecord`.

`capabilityPolicyBinder`/`signalIntentBinder` are typed optional on `RuntimeEngine`'s
constructor "for backward compatibility" but `RuntimeBuilder` (the only production
wiring path) always constructs and passes both — never actually absent in the shipped
system.

`RuntimeAuthorizationSigner` always reads private keys from disk via `FileKeyProvider`
with `DEFAULT_KEY_ID = "default"` — signing key material comes from files
(`keys/default.private.pem`), not an injected `KeyProvider`.

Hybrid signature mode (`BusinessTrustRecordBuilder.ts`) is gated by
`loadConfig().crypto.mode === "hybrid"`, read once at construction (module-level field),
not per-transaction.

`BusinessTrustRecordBuilder.build()` as of commit `6303801` also captures
`context.authorization` onto the record (see §7, gap 24/NF-003) — conditionally spread
(`...(context.authorization !== undefined ? {authorization: context.authorization} : {})`)
to satisfy `exactOptionalPropertyTypes`.

**Deleted (2026-09-08 dead-code cleanup — see §10):** `packages/runtime/src/policy/`
(entire subtree: `PolicyRouter.ts`, `PolicyAdapter.ts`, `PolicyRegistry.ts`,
`PolicyValidator.ts`, `SignalValidator.ts`, `OverrideVerifier.ts`,
`types/RuntimePolicy.ts`, `types/RuntimeTransaction.ts`, plus the dedicated test that
imported it, `tests/unit/policy-router.test.ts`), `packages/runtime/src/ports/`
(`ExecutionTrustRecordStore.ts`, `TrustRecordHasher.ts`, `VerificationEngine.ts`),
`services/DecisionService.ts`, `services/override-service.ts`,
`RuntimeGatewayAuthenticator.ts` (0 bytes). Each was reconfirmed to have zero non-self
references, including from tests, immediately before deletion.

**Not dead, kept:** `components/ReceiptComponent.ts` is not on the default production
pipeline by its own doc comment (real receipt generation is
`ExecutionTrustApplication.execute()`'s direct `this.receipts.generate(...)` call;
`RuntimeFactory` only wires `TrustChainValidationComponent` + `ExecutionComponent`), but
it is a genuinely exported, documented, tested extension point (`ReceiptService` is
real and live) — "not on the default path" and "dead code" are different things, and
this is the former, not the latter.

**Gotchas:** `ExecutionBuilder.build()` hardcodes `ExecutionMode.SYNC`.
`VerificationService.runChecks()` treats an `Execution` with no chain fields as
"unprotected legacy," passes it (soft compatibility carve-out). `Runtime.isEmpty()`/
`.size()` reach into `this.engine["pipeline"]` via bracket notation, bypassing TS
`private`. `RuntimeEngine` constructor logs wiring state via bare `console.log`, not a
structured logger.

---

## 4. `packages/execution-gateway`, `packages/execution-control`, `packages/execution-system`

`ExecutionGateway implements ExecutionSystem` — the single verification boundary
`RuntimeEngine` calls into. `verify()` order (all computed unconditionally, nonce
consumed last and only if everything else passed): envelope checks (delegated to
`@parmana/envelope-verifier`) -> `businessTransactionHashMatches` -> `policyStillCurrent`
(if policyRepository configured) -> `signalsStillCurrent` (if signalStateVerifier
configured) -> nonce consumption.

**Three mutually exclusive dispatch paths**, chosen at construction (constructor throws
if not exactly one is configured):
1. `executionControl.service` (from `@parmana/execution-control`) — the real,
   production-wired path (`createExecutionGateway.ts` only passes `service` + `route`;
   `route` ends up unused in practice, see next point).
2. `executionControl.channel` (`@deprecated`, the embedded `connector-runtime/`
   prototype) — still fully implemented/tested/exported, but only reached when
   `executionControl.service === undefined`, which never happens in production wiring.
   This is where `createConnectorRoute()` would actually matter if ever reached.
3. Raw `connector: Connector` — oldest path.

`packages/connector-sdk` (base contract, `Connector`/`ConnectorCapabilities`/
`CredentialProvider`/`MockConnector`) is passive — real adapters
(`GatewayGitHubAdapter`, `GatewayHubSpotAdapter`, `GatewayHttpAdapter`,
`GitHubAppCredentialProvider`) live in `execution-gateway/src/connector-execution/`.
`ConnectorEvidence.ts`'s `buildConnectorEvidence()` — as of commit `8fdc09c`, both
`requestSummary.parameters` and `responseSummary.metadata` are redacted via
`redactSensitiveKeys()` (previously only the response side was).

`execution-control`: `DefaultConnectorPolicy.assertAllowed()` order: gateway auth ->
connector-identity trust -> `verifiedTransaction` booleans -> capability-declared check
-> optional `grantedCapability` match (**not fail-closed when absent** — deliberate) ->
single-use session consume. `GatewayAttestation`'s `issuedAt` is **never checked for
staleness** in this file (mitigated elsewhere by single-use session + upstream
`NonceStore`). Everything here is in-memory/single-process (no distributed session
story). `SessionCredentialExecutionControl`'s safety property (only one caller can
create sessions) is "verified by inspection, not enforced by a lock" per its own doc
comment.

`execution-system`: `DefaultExecutionSystem` is a no-op stub, **always returns
`success: true`** — a real risk if ever wired into production by mistake.
`HttpExecutionSystem`'s `timeout` option is declared but never enforced (no
`AbortController`).

---

## 5. `packages/crypto`, `packages/envelope-verifier`, `packages/policy`, `packages/capability-registry`

**Crypto**: `CryptoBootstrap.create()`/`.createHybrid()` — process-lifetime cached
singleton (config changes mid-test need `vi.resetModules()`). Only 2 real signature
providers: `Ed25519SignatureProvider` and `Dilithium3SignatureProvider` — **the latter
is actually ML-DSA-65** (FIPS 204's standardized version of Dilithium3, via Node's
native `"ml-dsa-65"` key type, requires Node >=24 + OpenSSL >=3.5), just named
"Dilithium3" throughout the codebase. Declared-but-unimplemented:
`ECDSA_P256`/`DILITHIUM5`/`SPHINCS_PLUS` signature algorithms, `SHA3512`/`BLAKE3` hash
algorithms — configuring any of these throws `Unknown ... provider` at first use.
`FileKeyProvider.getMetadata()` always returns the **primary** algorithm regardless of
which `keyId` is queried — wrong for the secondary hybrid key, though nothing currently
calls it that way. Hybrid mode: `HybridSignatureProvider` requires both signatures to
independently verify, no partial pass. `VerificationCrypto.canonicalRecord()` — see
§3/§7 for the `authorization` field addition (commit `6303801`); explicitly excludes
`verifications`/`receipts` (produced after sealing, would be circular).
`CanonicalSerializer` normalizes via `Object.keys().sort()` + `JSON.stringify` — the
latter drops `undefined`-valued keys, which is what makes additive optional trust-record
fields backward-compatible for free. **Deleted (2026-09-08 cleanup):**
`LocalFileKeyManager.ts`, `GatewayAuthentication{Builder,Signer,Validator,Verifier}.ts`,
`modules/CryptoModule.ts`+`BuiltinCryptoModule.ts`, and a second, incompatible
`KeyProvider` interface that lived at `providers/key/KeyProvider.ts` (the real one,
which `FileKeyProvider` actually implements, is `packages/crypto/src/KeyProvider.ts` —
confirmed by its own import before deleting the duplicate). **Correction to an earlier
version of this section:** `packages/crypto/scripts/generate-keypair.ts` was previously
listed here as a dead duplicate of the root `scripts/generate-keypair.ts` — that was
wrong. It is genuinely invoked at runtime, via `execFileSync`, by
`examples/04-verified-execution/run.ts` to bootstrap example keys on a fresh clone; the
two files serve different callers and neither is dead. Not deleted.

**envelope-verifier**: `EnvelopeVerifier.verify()` composes `verifyChecks()` (all
side-effect-free) then `consumeNonce()` only if checks passed (prevents nonce-poisoning
DoS via a forged envelope). `MemoryNonceStore` self-documents as unsafe for production
(loses state on restart) — production uses `SupabaseNonceStore`/`SupabaseApprovalNonceStore`.

**policy**: `PolicyEngine.evaluate()` — pure function, first-match-wins rules, missing
signal never satisfies a condition (fail-closed), no match = REJECT by default.
`OperatorEvaluator`'s `matches` operator does uncached `new RegExp(pattern).test()` on
every evaluation — **no ReDoS protection**; `PolicyValidator` only checks the regex
compiles, not that it's safe. `SignalIntentBinder.findViolations()` uses strict `!==`
(a declared signal `500` won't match Intent value `"500"`). `FilePolicyRepository`
writes atomically (temp file + rename). `CapabilityPolicyBinder`/
`CANONICAL_CAPABILITY_POLICY_BINDINGS` actually live in `@parmana/capability-registry`
(leaf package, only depends on `@parmana/shared`), **re-exported** from
`@parmana/policy`'s `index.ts` — most consumers (including `packages/api`) import it via
`@parmana/policy`, not the capability-registry package directly. Only 4 entries in the
map (the 4 real capabilities, §1) — the other 8 policies are unbound; see §7 gap 34 for
the startup guardrail that now catches *future* unbound registrations (does not
retroactively protect the 8 unused policies, since nothing registers their capabilities
today).

**receipt** (`@parmana/receipt`): **deleted (2026-09-08 cleanup)** — it was fully
dead/orphaned (only self-referenced, no `package.json` outside its own declared it as a
dependency), reconfirmed immediately before removal. Real receipt generation is, and
was always, `@parmana/crypto`'s `ReceiptCrypto.createReceipt()`, wired into
`packages/runtime/src/services/receipt-service.ts` — unaffected by the deletion.

---

## 6. `packages/storage`

Two entirely separate systems in one package:

**System A (real, production)**: `StorageProvider` (5 repositories) via
`StorageFactory.create()`/`.createFromEnvironment()`. Backend selection: `memory` ->
`MemoryStorageProvider`; `supabase` -> `SupabaseStorageProvider` (throws if
`DATABASE_URL` unset); `postgres`/`sqlite` -> **both always throw "not implemented"**
despite being declared valid config values. `createFromEnvironment()` forces `memory`
under `NODE_ENV=test` regardless of `PARMANA_STORAGE`. Despite the "Supabase" class
names, **every real read/write goes through a direct `pg.Pool`**
(`PostgresPoolFactory.ts`, lazy process-wide singleton), not `supabase-js`/PostgREST —
same workaround as the caller-audit sink (§2), applied to every repository:
`SupabaseBusinessTransactionRepository`, `SupabaseExecutionTrustRecordRepository`,
`SupabaseRefusalRecordRepository`, `SupabasePendingPolicyChangeRepository`,
`SupabasePolicyChangeApprovalRecordRepository`, `SupabaseNonceStore`,
`SupabaseApprovalNonceStore`, `SupabasePolicyChangeStepUpNonceStore`.
`SupabaseClientFactory` (real `supabase-js` client) is exported but **never actually
called** anywhere in production — confirmed dead in practice.

`SupabaseExecutionTrustRecordRepository` — as of commit `6303801`, the header table
(`execution_trust_records`) has `authorization_json`, `schema_version`,
`signatures_json` columns (migration `20260907120000_...sql`), fixing a previously-
undiscovered gap where hybrid-mode `schemaVersion`/`signatures` were never persisted at
all (silently dropped on every Supabase read since the hybrid milestone shipped).
**Date rehydration is inconsistent across repositories** — some rehydrate only the
top-level `createdAt`, some walk nested fields, some do neither; nested `Date`-typed
fields commonly come back as raw strings after a JSONB round-trip. Duplicate-insert
atomicity is two-layered everywhere: application-level check (racy on `memory`, closed
by `Map.has`+`Map.set` in the same synchronous tick) + a real DB constraint on Supabase
(`23505` unique-violation mapped to `DuplicateBusinessTransactionError`).

**System B (deleted 2026-09-08 — was a dead toy subsystem, also in this package)**:
`StorageEngine`, `StorageBuilder`, `AppendOnlyLedger`, `LedgerEntry`, `LedgerSerializer`
(used `JSON.stringify(entry, Object.keys(entry).sort())` — filtered top-level keys
only, did **not** recursively canonicalize, the same non-canonical-hash anti-pattern the
deleted `@parmana/receipt` package also had), and three ~18-line in-memory-array
repositories (`ExecutionRepository`/`VerificationRepository`/`CryptoProofRepository`).
Was referenced only by their own tests (also deleted:
`tests/unit/storage-engine.test.ts`, `append-only-ledger.test.ts`,
`ledger-serializer.test.ts`) and by `@parmana/replay`'s own unused `ReplayContext.ts`
(also deleted, along with its export from `replay/src/index.ts` and the now-unneeded
`@parmana/storage` dependency from `replay/package.json`/`tsconfig.json`). Was unrelated
to, and structurally incompatible with, System A, which is unaffected by this removal.

---

## 7. Connectors, governance-ui, replay, approval, shared, SDKs

**connector-github/connector-hubspot**: passive metadata packages (capability
constants, types, JWT signing for GitHub App auth, mock servers for tests). Real
adapters live in `execution-gateway`. `HubSpotSignalStateVerifier.ts`
(`packages/connector-hubspot/src/`) implements `SignalStateVerifier` — re-fetches the
real deal via `executeHubSpotCapability()`/`HUBSPOT_DEAL_FETCH_CAPABILITY` (a read-only
capability call, its own independently-signed authorization, submitted straight to the
gateway — this is an internal verification mechanism **called by** `RuntimeEngine`
during policy evaluation, not a bypass of it), diffs 6 signal keys against caller-declared
values, and optionally verifies `preAuthorizedForAmountChange` against a real
`SignedApproval` artifact via `@parmana/approval`. Dangling code comments reference a
"Razorpay connector"/`RazorpayRefundService`/`HubSpotDealUpdateService` that do not exist
anywhere in the current repo tree — leftover from a prior refactor, harmless but
confusing if grepped for.

**connector-sdk**: `oracle`/`salesforce`/`sap`/`workday` mock connectors exist in
`src/connectors/` but are **not exported** from the package's public entry point —
reachable only via deep relative import, used only by the package's own test.

**governance-ui**: a real server-rendered Express app (no client JS at all), zero
`@parmana/*` runtime deps by design (talks to the API over plain `fetch`). Implements
propose/list/diff for policy changes but **deliberately does not implement
approve/reject** — the diff page renders CLI instructions for the checker to sign
locally and curl the result themselves; the UI server never holds a checker's step-up
key. Session store is default in-memory `express-session` `MemoryStore` (restart logs
everyone out — accepted tradeoff, not a bug). Manual XSS-escaping throughout (`escapeHtml`)
since there's no auto-escaping templating engine.

**replay**: re-runs only `PolicyEngine.evaluate()` against a recorded decision's
signals, **not** a full execution replay (no connector calls, no credential resolution).
Only ever inspects `trustRecord.executions[0]` — a multi-execution record's later
executions are silently ignored. `ReplayBuilder.build()` ignores its constructor
argument. `ReplayExecutor.execute()` does no actual execution, echoes the plan back.
`toPolicySignals()` is a pure type-cast, zero runtime validation. `package.json`
dependency list was wrong until commit `8fdc09c` (declared unused
`@parmana/runtime`/`@supabase/supabase-js`/`express`, didn't declare actually-used
`@parmana/policy`/`@parmana/shared`) — fixed.

**approval** (`@parmana/approval`): verifies externally-signed Approval Artifacts — a
narrower mechanism than "execution authorization," backing one specific signal claim
(e.g. `preAuthorizedForAmountChange`), not a whole request envelope.
`StaticApprovalIssuerRegistry` revokes at the issuer-key level, not per-artifact.
Currently unreachable in practice since `TRUSTED_APPROVAL_ISSUERS` is empty (§2, §8).

**shared** (`@parmana/shared`): the dependency-graph floor — domain types, config
(`loadConfig()`, sole `process.env` access point), errors, repository interfaces.
`ExecutionTrustRecord` — see §3/§5/§6 for the `authorization` field. `RefusalRecord` is
narrow by design (only `PolicyEngine.evaluate` REJECTs and `SignalIntentBinder`
violations, not every possible rejection — caller-auth failures are a separate,
unsigned mechanism). `ChallengeRecord` is deliberately **unsigned** (evidence of an
organizational process, not a runtime transaction). **Deleted (2026-09-08 cleanup):**
five dead types with zero consumers outside `shared` itself — `types/Verification.ts`
(a differently-shaped duplicate of the real, root-exported `domain/verification.ts`
`Verification`) and `types/ExecutionStatus.ts` were genuinely unexported from the
package root; `types/ExecutionProof.ts`, `types/ExecutionTransaction.ts`, and
`types/Metadata.ts` were, contrary to an earlier version of this note, actually
exported from `packages/shared/src/index.ts` (part of the package's declared public
surface) despite having no internal consumer anywhere in this monorepo, including the
SDKs — checked by grepping for each name imported specifically via `@parmana/shared`,
not just by internal relative path, before deleting. Their export lines were removed
from `index.ts` in the same pass.

**typescript/ SDK** (`@parmana/sdk`): thin HTTP wrappers, no business logic. As of
commit `8fdc09c`, `PolicyApi.validate(policyId, policyVersion)` sends the correct
`{policyId, policyVersion}` body (previously sent the entire `Policy` document, a real
bug — the real route never accepted that shape). `HttpTransport` retries GET only, opt-in.
Models are hand-written and lag behind the domain types (no generator/check exists for
this SDK's models, unlike Python's).

**python/ SDK** (`parmana`): models are **codegenned** from `packages/shared/src/domain/*.ts`
via `python/scripts/generate_models.ts` (`npm run generate:python-models` /
`check:python-models`) — the one exception is `ReplayResult` (hand-maintained, inline
return type not a named export). `api/__init__.py`'s imports/`__all__` now include
`AuditApi`/`RefusalApi` (commit `8fdc09c` — were previously missing despite both being
wired into `client.py`). `parmana/serialization/encoder.py`'s `encode()` — as of commit
`6303801`, recurses via `dataclasses.fields()`/`getattr()` on real attribute values
instead of `dataclasses.asdict()`, which previously flattened nested dataclasses into
plain dicts before `encode()`'s own `None`-filtering could run, so an unset optional
field nested inside another dataclass (e.g. `BusinessTransactionMetadata.
granted_capability`) was serialized as an explicit JSON `null` instead of omitted —
this broke `POST /transactions` (500) and the quickstart example when hit through a
strict `!== undefined` check server-side. Fixed; regression test in `test_encoder.py`.

---

## 8. Known gaps / decisions, current status (2026-09-07)

- **Capability-policy binding coverage**: only 4 of the ~12 real+example capabilities/
  policies have a canonical binding (`CANONICAL_CAPABILITY_POLICY_BINDINGS`, 4 entries).
  No live exploitable surface today (the other 8 policies have no registered connector),
  but `assertConnectorCapabilitiesBound()` (commit `672aee6`) now fails startup if a
  *newly registered* capability is unbound and not on the
  `INTENTIONALLY_UNBOUND_CAPABILITIES` allowlist — closes the recurrence risk, does not
  retroactively bind the 8 unused policies.
- **NF-005 (HubSpot approval issuers)**: `TRUSTED_APPROVAL_ISSUERS` empty by design,
  still empty. A dev-only issuer with a committed private key was proposed and
  **rejected** during review (inconsistent with this repo's ephemeral-test-key
  convention). **Undecided**, not closed — see `docs/VERIFICATION-GAPS.md` D-4.
- **NF-001 (upstream authorization verification)**: not a bug in the current caller-
  authenticated trust model; a delegation-layer feature, future scope only. Full design
  spec: `NF-001-UPSTREAM-AUTHORIZATION-VERIFICATION.md` (repo root).
- **TTL validation** and **nested evidence-secret redaction depth** — flagged in earlier
  audit material as possible P1s, not independently re-verified or fixed this session;
  treat as unconfirmed until checked against current code.
- `docs/CLAIMS.md` and `docs/VERIFICATION-GAPS.md` are kept reasonably current as of
  commit `a82f9fd` (§2.33, §2.31 update, gaps 24-34, D-4/D-5) — more current than most of
  this repo's other `docs/` content, which should still be treated skeptically per this
  file's opening note.

---

## 9. Testing/build conventions worth knowing

- `vitest.setup.ts` generates ephemeral Ed25519 keypairs (`default`, `gateway`) fresh per
  test run into a temp dir, sets `PARMANA_KEY_DIR` — this is the established pattern for
  any test/dev key material; **never** commit a private key into source, even for a
  "dev-only" purpose (this exact question came up for NF-005 and was declined for this
  reason).
- Packages resolve `@parmana/*` imports via compiled `dist/`, not `src/` —
  `npx vitest run` alone can silently test stale cross-package code after an edit; use
  `npm test` (runs `pretest` -> `check-dist-fresh.ts`) or `npx tsc -b` first. (Prior
  session finding, still true.)
- Test directories: `packages/<name>/tests/{unit,integration,e2e}/` — not `test/` singular,
  not `packages/<name>/test/`. Confirmed repeatedly this session against multiple
  external "v-final" prompts that guessed `test/unit/...`/`test/integration/...` and were
  wrong every time.
- `packages/api/src/` has **no `services/` directory**. `packages/runtime/src/` has no
  `bootstrap/`, `verification/`, or `trust/` subdirectories — `BusinessTrustRecordBuilder.ts`
  and friends sit directly under `packages/runtime/src/`.
- Full-suite Python live-server integration tests (`tests/test_live_server_integration.py`)
  show 3-4 timeout-under-load failures when run as part of the full ~130s suite but pass
  cleanly in isolation — confirmed pre-existing on `main`, unrelated to any change made
  this session. Don't chase these as regressions without first checking if they reproduce
  in isolation.
- Gitleaks runs as a pre-commit hook in this repo; every commit above passed it clean.

---

## 10. Session changelog (commits made after this file's initial build)

Keep this section current — append a line per commit that changes something this file
describes, or update the relevant section directly and note it here.

- `6303801` — NF-003: `ExecutionTrustRecord.authorization` field, storage migration +
  hybrid-signature persistence fix, Python encoder recursion fix.
- `8fdc09c` — SDK/connector cleanup: TS `PolicyApi.validate` body shape, Python
  `__init__.py` exports, dead duplicate `throw`, `ConnectorEvidence` redaction symmetry,
  dead vendor-payment routing removal, `replay/package.json` dependency fix.
- `672aee6` — `assertConnectorCapabilitiesBound()` startup guardrail + intentionally-
  unbound allowlist.
- `7da8f0d` — NF-004: `/transactions` capability-grant parity with `/execute`.
- `a82f9fd` — docs: CLAIMS.md §2.33 + §2.31 update, VERIFICATION-GAPS.md gaps 24-34 +
  D-4/D-5, NF-001 design spec.

This file itself was created in the commit that follows the above (see `git log` for
the actual hash at read time — this line is intentionally not hash-pinned since it
describes its own commit).

- `437f5ec` — Policy Governance hardening: `PolicyChangeCrypto.verify()` wired into
  `verifyPolicyGovernanceIntegrityAtStartup` (new `"signature-invalid"` mismatch
  reason), `previousRecordHash` chaining on `PolicyChangeApprovalRecord` (new
  `"chain-broken"` reason, requires a Supabase migration), a 5-minute periodic re-run
  on top of the startup-only check, `PolicyValidator` regex hardening, coverage
  warnings surfaced on the pending-change endpoints, and removal of the (already
  unexported) `policy/src/types/LedgerEntry.ts`/`hashLedger()`. See `docs/CLAIMS.md`
  §2.34, `docs/VERIFICATION-GAPS.md` gaps 35-38.
- `4e1a8e3` — fix: `scripts/backfill-legacy-policy-approvals.ts` (new in `437f5ec`)
  must not treat a real, already-open `PendingPolicyChange` as "legacy" — see
  `docs/VERIFICATION-GAPS.md` gap 39.
- `7a1aa37` — execution-time Policy Governance verification:
  `PolicyGovernanceExecutionVerifier` (new, `packages/api/src/governance/`), wired
  into `RuntimeEngine.execute()` as a new optional trailing constructor param (same
  idiom as `signalStateVerifier`/`capabilityPolicyBinder`), before
  `capabilityPolicyBinder`/`signalIntentBinder`. Feature-flagged
  (`POLICY_EXECUTION_VERIFICATION_ENFORCED`, default `false` — every real production
  policy in this system is currently `PENDING_APPROVAL`, so an unconditional gate
  would refuse all of them). See `docs/CLAIMS.md` §2.35, `docs/VERIFICATION-GAPS.md`
  gap 40.
- `ba456e0`, `b86b50d`, `f1de1ad`, `98dfcc1`, `f034fff`, `b6b05fa` — docs only: CLAIMS.md/
  VERIFICATION-GAPS.md/changelog updates for the above, a real (not fabricated) policy
  approval runbook (`docs/operations/policy-approval-runbook.md` +
  `policy-approval-windows-setup.md`), and `docs/CURRENT-STATE.md` — a code-grounded
  current-state summary distinct from this file, with no dates or version numbers.
- **2026-09-08 dead-code cleanup** (this file's own §3/§5/§6/§7 sections updated
  directly rather than only noted here, per this section's own instruction): deleted
  `packages/receipt` (entire package), `packages/runtime/src/policy/` (entire
  subtree, plus its dedicated test), `packages/runtime/src/ports/`,
  `services/DecisionService.ts`, `services/override-service.ts`,
  `RuntimeGatewayAuthenticator.ts` (0 bytes), `packages/storage`'s System B toy
  subsystem (`StorageEngine.ts`, `StorageBuilder.ts`, `ledger/AppendOnlyLedger.ts`,
  `ledger/LedgerEntry.ts`, `ledger/LedgerSerializer.ts`, the three toy repositories,
  and their three dedicated tests), `packages/replay/src/context/ReplayContext.ts`
  (its only real consumer), five dead types in `@parmana/shared`
  (`types/Verification.ts`, `ExecutionStatus.ts`, `ExecutionProof.ts`,
  `ExecutionTransaction.ts`, `Metadata.ts` — the last three were exported from the
  package root despite zero consumers, corrected from this file's earlier claim that
  all five were unexported), and eight orphaned files in `@parmana/crypto`
  (`LocalFileKeyManager.ts`, the four `GatewayAuthentication*.ts` files,
  `modules/CryptoModule.ts`+`BuiltinCryptoModule.ts`, the duplicate `KeyProvider`
  interface at `providers/key/KeyProvider.ts`). Every deletion was reconfirmed with a
  fresh repo-wide grep immediately beforehand, not assumed from this file's prior
  claims — two of which turned out to be wrong on re-verification and are corrected
  in place above: `components/ReceiptComponent.ts` is a deliberately-kept, documented,
  exported extension point, not dead code (excluded from deletion), and
  `packages/crypto/scripts/generate-keypair.ts` is genuinely invoked by
  `examples/04-verified-execution/run.ts` (also excluded, previously miscategorized
  here as a dead duplicate). Corresponding `index.ts` export lines,
  `tsconfig.json`/`package.json` project references, and dependency declarations were
  updated in the same pass. Full repo `npx tsc -b` and `npx vitest run` clean
  afterward: 1,539 passed, 38 pre-existing skips, 0 failed (down from 1,551 — four
  test files for now-deleted code removed, not a regression).
