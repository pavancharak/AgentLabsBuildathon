# Connector Build Guide

Read this before starting any new connector. It documents exactly which files to create, in which
package, with which naming convention — worked through top to bottom, a new connector build
should not need to grep the existing codebase for tribal knowledge or ask where something goes.

**Canonical reference connector: HubSpot** (`packages/connector-hubspot/`). Every file path below
cites HubSpot's real, current file as the concrete example. HubSpot is the standard because it was
built clean, with both hardening lessons below applied from its first version rather than
retrofitted — Razorpay's connector (being removed from this codebase; see the removal plan in this
session) was the one that discovered those lessons the expensive way. Where Razorpay's now-removed
code established a pattern still worth capturing (webhook handling — HubSpot has none), that
section says so explicitly and cites Razorpay's code from the commit before removal.

---

## 0. Package structure: one standard, one deprecated pattern — stated explicitly

**Standard, going forward: a dedicated `packages/connector-<name>/` workspace package.** This is
HubSpot's pattern (`@parmana/connector-hubspot`) and is what every new connector should follow.

**Deprecated: spreading a connector across `packages/connector-sdk/src/connectors/<name>/` plus
scattered files directly in `packages/api/src/bootstrap`, with no dedicated package.** This was
Razorpay's original pattern. It is deprecated, not merely "the older way" — say so explicitly to
whoever proposes it again:

- Coupling passive capability/metadata definitions to `@parmana/connector-sdk` itself meant they
  could never be depended on, versioned, or removed independently of the SDK package.
- One connector's build/test/typecheck problems could destabilize `connector-sdk`, which every
  other connector also depends on — no package-boundary blast radius containment.
- This session's own Razorpay removal proved the cost concretely: removing HubSpot (if it were
  ever removed) would be one `git rm -r packages/connector-hubspot` plus a handful of wiring edits.
  Removing Razorpay required enumerating and deleting files scattered across six different
  packages (`connector-sdk`, `execution-gateway`, `api/src/bootstrap`, `api/src/webhooks`,
  `api/src/routes`, `storage`), because it never had its own package boundary.

A dedicated package gives a connector its own `package.json` (own dependency graph, own
`npm run build`/`test`/`typecheck`), and a removal or a breaking internal change stops at that
package's boundary instead of leaking into unrelated files.

---

## 1. Scope to one narrow action first

Don't build a general-purpose connector for a whole API surface. HubSpot started with one property
update on one object type (Deal `dealstage`/`amount`), not Contacts, Companies, or any other
object. Widen scope in a later milestone, once the first one is fully proven.

---

## 2. File-by-file checklist: `packages/connector-<name>/`

Create the package first. Copy HubSpot's `package.json` shape:

- [ ] `packages/connector-<name>/package.json` — name `@parmana/connector-<name>`, `private: true`,
      `type: module`, `main`/`types` pointing at `./dist/index.js`/`./dist/index.d.ts`. Dependencies:
      always `@parmana/connector-sdk`, `@parmana/crypto`, `@parmana/shared`, `@parmana/policy`; add
      `@parmana/approval` only if the connector needs independent pre-authorization verification
      (see §5); add `@parmana/envelope-verifier`/`@parmana/execution-system` if the connector's
      SignalStateVerifier needs to execute a real fetch through the gateway (it will — see §5).
      Reference: `packages/connector-hubspot/package.json`.
- [ ] `packages/connector-<name>/tsconfig.json` — copy `connector-hubspot`'s verbatim, update paths.

Inside `src/`, one file per responsibility — **do not merge these**, the separation is deliberate
(passive metadata stays swappable/testable independent of execution logic):

- [ ] **`<Name>Capabilities.ts`** — capability id constants, always `"<name>:<verb>"` (e.g.
      `HUBSPOT_DEAL_UPDATE_CAPABILITY = "hubspot:deal-update"`), the connector's `Options` interface
      (`connectorId`, `capabilities`, optional `baseUrl` for the test-seam override), and parameter
      DTOs for each capability. Pure metadata — zero execution logic. Reference:
      `packages/connector-hubspot/src/HubSpotCapabilities.ts`.
- [ ] **`<Name>Types.ts`** — domain types matching the external API's real wire shape (model only
      the fields this milestone actually reads or writes, nothing more). Must include:
  - [ ] An explicit **deny-by-default allowlist constant** of every field this milestone may
        write (e.g. `HUBSPOT_ALLOWED_DEAL_UPDATE_PROPERTIES`). This is the single source of truth
        both the connector's guard and its request-body construction read from.
  - [ ] A **`<NAME>_TEST_MODE_PLACEHOLDER_<CREDENTIAL>`** constant, shaped like a real credential
        for that vendor but using an all-zero/obviously-fake identifier segment that vendor will
        never issue for real. Document *why* directly in the comment: this exists because
        Razorpay's first version had no guard against sending its placeholder to the real
        production API, and only survived because Razorpay happened to reject it — an accident of
        vendor behavior, never a guarantee this codebase controls. Every new connector closes this
        gap from its first version, not after an incident.
  - [ ] A `<Name>CredentialValue` interface + `is<Name>CredentialValue()` type guard.
  - [ ] A `redact<Name>Token()` (or equivalent) function returning a **one-way, truncated SHA-256
        fingerprint** (`fp_` + 12 hex chars), never a literal substring of the real credential —
        HubSpot's own fingerprint function was fixed once (Phase 3D certification) after an earlier
        version returned a truncated-but-literal prefix of the actual secret. Start with the
        fingerprint form; don't repeat that mistake.
        Reference: `packages/connector-hubspot/src/HubSpotTypes.ts`.
- [ ] **`<Name>Metadata.ts`** — a `ConnectorMetadata` object: `connectorId`, `displayName`,
      `version` (`{major, minor, patch}`), `health: healthyNow()` (from `@parmana/connector-sdk`),
      `description`. Reference: `packages/connector-hubspot/src/HubSpotMetadata.ts`.
- [ ] **`Mock<Name>Server.ts`** — a hermetic, in-memory HTTP stand-in for the vendor's real API,
      using Node's own `node:http` `createServer` (no external mocking library). Must implement:
      auth-header checking (401 on missing/wrong credential, matching the real vendor's error
      shape if documented), path routing for exactly the endpoints this milestone touches, and a
      `setResponseDelayMs()` test hook for exercising the connector's own timeout handling. Never
      makes or receives real network traffic beyond localhost.
      Reference: `packages/connector-hubspot/src/MockHubSpotServer.ts`.
- [ ] **`<Name><Action>Signals.ts`** — pure functions that assemble the `PolicySignals` object the
      policy evaluates: any arithmetic (deltas, threshold comparisons), any allowlist/state-machine
      lookup (e.g. `isHubSpotStageTransitionAllowed`'s forward-only pipeline check) that
      `PolicyEngine`'s `OperatorEvaluator` cannot do itself (it only compares one fact against one
      literal — no fact-to-fact arithmetic, no lookup tables). Only include a `proposed*` field in
      the returned signals **when the caller actually supplied it** — this must mirror exactly what
      the real `Intent.parameters` will contain, which the policy's `boundSignals` check depends on
      to compare like-for-like. Reference:
      `packages/connector-hubspot/src/HubSpotDealUpdateSignals.ts`.
- [ ] **`<Name><Action>Receipt.ts`** — the receipt type + builder for this action. Never contains
      the raw credential — only a `bearerRedacted` fingerprint, already redacted by the connector
      before this builder ever sees it. Hash via `TrustRecordHasher` (`@parmana/crypto`).
      Reference: `packages/connector-hubspot/src/HubSpotDealUpdateReceipt.ts`.
- [ ] **`<Name>CapabilityExecution.ts`** — one generic `execute<Name>Capability()` helper: signs a
      fresh authorization and submits it through the caller-supplied `ExecutionSystem` (the same
      gateway every other execution goes through — envelope verification, nonce consumption,
      connector dispatch, unmodified). Both the connector's primary action *and* its own
      `SignalStateVerifier` (next item) call this — the sign-then-execute shape must exist in
      exactly one place, not be duplicated. Reference:
      `packages/connector-hubspot/src/HubSpotCapabilityExecution.ts`.
- [ ] **`<Name>SignalStateVerifier.ts`** — implements `SignalStateVerifier`
      (`@parmana/policy`). Independently re-fetches the real, current state (via
      `execute<Name>Capability` against a read capability) and compares it to what the caller
      declared, immediately before `PolicyEngine.evaluate`'s result would otherwise be trusted
      verbatim. **Fails closed**: a fetch error becomes a violation, never a pass-through. If the
      policy has any "caller declares X was pre-authorized" signal, verify it against a real,
      independently-issued Approval Artifact (`@parmana/approval`'s `ApprovalVerifier`) rather than
      trusting the caller's own claim — see §5. Reference:
      `packages/connector-hubspot/src/HubSpotSignalStateVerifier.ts`.
- [ ] **`index.ts`** — the package's public barrel. **Explicit named exports only** — list every
      symbol individually (as HubSpot's does), never a wildcard `export *` that silently changes
      the public surface when an internal file is edited. The executable connector class itself is
      **not** exported here (see §3) — this package stays passive: capability definitions, schemas,
      types, metadata, and signal logic only.
      Reference: `packages/connector-hubspot/src/index.ts`.

---

## 3. The execution-gateway adapter — where the executable connector lives

The package above is deliberately **passive** — it defines what a capability *means*, not how it's
*executed*. The executable class lives in `packages/execution-gateway/src/connector-execution/`
(Phase 1C convention: "connector packages retain only capability definitions, schemas, metadata,
and interfaces; this is where those get wired into a real, running execution path").

- [ ] **`Gateway<Name>Adapter.ts`** — implements the `Connector` interface from `@parmana/connector-sdk`
      (`connectorId`, `capabilities`, `async execute(request, context)`). Constructed with the
      `<Name>ConnectorOptions` type imported back from `@parmana/connector-<name>`. Must implement,
      in this order, before any network call:
  1. [ ] Reject if `request.capability` isn't in `this.capabilities`.
  2. [ ] Reject if `context.credential.value` doesn't match the connector's own credential shape
         (`is<Name>CredentialValue`).
  3. [ ] **Placeholder-credential guard**: if `baseUrl === DEFAULT_BASE_URL` (the real vendor
         endpoint) *and* the resolved credential equals the test-mode placeholder constant, refuse
         outright with a clear error — never rely on the vendor rejecting it.
  4. [ ] **Deny-by-default property/field guard** (if the action writes data): any field name in
         `request.parameters` not present in the allowlist constant is refused before any network
         call, not silently dropped.
  5. [ ] `AbortController` + `context.timeoutMs` timeout, fail-closed on non-2xx or network error,
         the fetched/updated resource's `bearerRedacted` fingerprint attached to the response
         metadata — never the raw credential.
      Reference: `packages/execution-gateway/src/connector-execution/GatewayHubSpotAdapter.ts`.
- [ ] **`createGateway<Name>Connector.ts`** — a thin factory: `(options) => new Gateway<Name>Adapter(options)`,
      returning the stable `Connector` interface type, never the concrete class. Callers never
      construct or depend on the adapter class directly.
      Reference: `packages/execution-gateway/src/connector-execution/createGatewayHubSpotConnector.ts`.
- [ ] Add both to `packages/execution-gateway/src/connector-execution/index.ts`'s internal barrel
      (this barrel is **not** re-exported from the package's own top-level `index.ts` — only the
      `createGateway*()` factory is part of the public surface; the concrete adapter class stays
      internal, and `packages/execution-gateway/tests/unit/public-api-boundary.test.ts` enforces
      this — add your new connector's class name to that test's "must not be exported" list).

---

## 4. Wiring into the production application: `packages/api/src/bootstrap/`

- [ ] **`create<Name>CredentialProvider.ts`** — returns `CredentialProvider | undefined`.
  - Under `NODE_ENV === "test"`: read the documented test-credential env var(s) **directly, by
    their exact `.env.example` name** (e.g. `TEST_HUBSPOT_PRIVATE_APP_TOKEN`), falling back to the
    `TEST_MODE_PLACEHOLDER` constant if unset. **Never introduce a bridge/alias variable with
    different word order** (e.g. Razorpay's original `TEST_RAZORPAY_KEY_ID` instead of the
    documented `RAZORPAY_TEST_KEY_ID` — fixed only after the fact). Read the real name from day one.
  - In production: read the real env var(s). If unset, **return `undefined`** — never a crash,
    never a fallback to mock credentials. `createConnectorRegistry.ts` (next item) treats
    `undefined` as "don't register this connector," the same fail-closed-absence shape every
    connector uses.
      Reference: `packages/api/src/bootstrap/createHubSpotCredentialProvider.ts`.
- [ ] **`create<Name>Connector.ts`** — thin factory delegating to `createGateway<Name>Connector`,
      wiring `<NAME>_BASE_URL` as an optional test-seam override (never set in production; exists
      only so an integration test can point the connector at a mock server).
      Reference: `packages/api/src/bootstrap/createHubSpotConnector.ts`.
- [ ] **`create<Name>SignalStateVerifier.ts`** (only if §2's `<Name>SignalStateVerifier.ts` was
      built) — constructs it with `FileKeyProvider`/`DEFAULT_KEY_ID` (the same signing key
      `RuntimeAuthorizationSigner` already uses), the policy name/version, and — if pre-authorization
      gating applies (§5) — a real `ApprovalVerifier`, supplied **unconditionally**, never optional
      in production wiring. Reference: `packages/api/src/bootstrap/createHubSpotSignalStateVerifier.ts`.
- [ ] **`createConnectorRegistry.ts`** — add a block: resolve the credential provider; if
      `undefined`, `console.warn({ event: "<name>_connector_unavailable", reason: "..." })` and skip;
      else `registrations.push({ connector: create<Name>Connector(), metadata: <Name>Metadata,
      connectorIdentity: { connectorId: "<name>", publicIdentity: "spiffe://parmana/connectors/<name>",
      authenticationMetadata: {} }, credentialProvider, policy: new DefaultConnectorPolicy(...),
      gatewayAuthentication, crypto, audit })`. Mirror the existing HubSpot block exactly.
- [ ] **`createConnectorAuthenticator.ts`** — add `{ connectorId: "<name>", publicIdentity:
      "spiffe://parmana/connectors/<name>", authenticationMetadata: {} }` to the trusted-identity
      array.
- [ ] If a `<Name>SignalStateVerifier` was built, wire it into `application.ts`'s
      `CompositeSignalStateVerifier([...])` construction alongside any other connector's verifier.
- [ ] **`.env.example`** — add a clearly-headed block (`# --------- <Name> connector (optional...) ---------`)
      documenting every new env var: production credential, test-mode credential (must state any
      enforced prefix format), `ALLOW_LIVE_<NAME>=1`, any `TEST_<NAME>_*` fixture ids the live suite
      needs, and the `<NAME>_BASE_URL` test seam. Reference the HubSpot block in `.env.example`
      directly for the exact structure and comment style to match.

---

## 5. Policy, and (if needed) independent pre-authorization

- [ ] **`policies/<capability-name>/1.0.0/policy.json`** — `signalsSchema` listing every signal the
      rules reference; `boundSignals` mapping every `proposed*` signal to its `parameters.*` Intent
      field **from this policy's first version, not retrofitted** — this is the `SignalIntentBinder`
      hardening lesson Razorpay only added after a live demonstration of the signal/intent mismatch
      vector; HubSpot applied it proactively and every new connector must too. Rules array must end
      in an **unconditional `reject-default`** fallback (`"condition": { "always": true }`) — never
      let a request fall through with no matching rule. Reference:
      `policies/hubspot-deal-update/1.0.0/policy.json`.
- [ ] Add the capability → policy binding to `CANONICAL_CAPABILITY_POLICY_BINDINGS`
      (`packages/policy/src/CapabilityPolicyBinding.ts`) — one entry per capability id, pointing at
      this exact `{name, version, schemaVersion}`. This is what stops a caller pairing a real,
      fund/data-moving capability with an unrelated, unprotected policy.
- [ ] **If any signal amounts to "a human/external party pre-authorized this"** (HubSpot's
      `preAuthorizedForAmountChange`): do not trust it as a bare caller-declared boolean past the
      first version if it can be avoided. Wire a real `ApprovalVerifier` (`@parmana/approval`) into
      the `<Name>SignalStateVerifier`, checking a real `SignedApproval` artifact (issuer identity,
      signature, expiry, capability/resource scope match, single-use nonce) carried in
      `signals.approvalArtifact`, verified against the **independently re-derived** requested value
      (not the caller's own declared one) so a genuine approval for a smaller amount can't be reused
      to authorize a larger one.

---

## 6. Webhook handling — only if the connector has webhooks

HubSpot has none (request/response only). This section captures the pattern from Razorpay's
webhook implementation — being removed from this codebase, but the pattern is real and reusable
for the next connector that needs it. All of the following live under `packages/api/src/`, not
inside the connector's own package (webhook handling is an API-layer concern, not a connector
capability):

- [ ] **`webhooks/<Name>WebhookTypes.ts`** — the pending-event shape (`eventId`, raw `payload`,
      `receivedAt`, optional `eventType`).
- [ ] **`webhooks/<Name>WebhookEventStore.ts`** (interface) — one method,
      `recordIfUnseen(event): Promise<boolean>`, atomically dedupes on `eventId` in a single call
      (no separate check-then-set — no race window), plus `listAll()` for whatever later process
      drains recorded events. Provide **both** an `InMemory<Name>WebhookEventStore.ts` (tests) and a
      `Supabase<Name>WebhookEventStore.ts` (production) implementation.
- [ ] **`webhooks/<Name>WebhookAuditSink.ts`** (interface) — **a separate sink from the event
      store**, not an extension of it: a delivery that never verifies has no `eventId` yet, so
      recording its rejection can't go through the event store. Event type union at minimum:
      `"webhook.received" | "webhook.duplicate" | "webhook.rejected"`. Deliberately narrow fields —
      only `eventId`/`eventType`/whatever minimal ids the payload carries, **never full payload
      contents**, never any customer/card/PII field the vendor's payload might include. Provide both
      `InMemory<Name>WebhookAuditSink.ts` and `Supabase<Name>WebhookAuditSink.ts`.
- [ ] **`webhooks/verify<Name>WebhookSignature.ts`** — a pure, side-effect-free function verifying
      the vendor's documented HMAC (or equivalent) signature over the **raw request body bytes**,
      timing-safe compared (`node:crypto`'s `timingSafeEqual`) against the signature header. Must
      never be passed a re-serialized/re-parsed body — re-`JSON.stringify()`-ing a parsed object is
      not guaranteed to reproduce the original wire bytes.
- [ ] **`routes/webhooks-<name>.ts`** — **verify-then-consume ordering is load-bearing**: signature
      verification runs first and is entirely side-effect-free; the dedupe store is never touched
      until *after* a valid signature and a present event id are both confirmed, so a forged request
      can never burn a legitimate event id. Mount `express.raw({ type: "application/json", limit })`
      on **this router only**, ahead of the handler — and mount this router in `app.ts` **before**
      the global `express.json()` middleware, so the raw bytes reaching signature verification are
      exactly what the vendor signed, never a re-serialized reconstruction.
- [ ] **`bootstrap/resolve<Name>WebhookSecret.ts`** — test-mode fallback to a placeholder (so
      hermetic tests need zero setup) + production fail-closed-absent (unset ⇒ route simply not
      mounted, 404s) + a hard startup error if the secret is **set but blank** (an empty secret would
      accept forged signatures as valid — this must never silently pass).
- [ ] **Migration**: `<name>_webhook_events` (event_id `TEXT PRIMARY KEY` — the primary key itself
      *is* the atomic dedupe mechanism, a concurrent duplicate insert fails with `23505`) and
      `<name>_webhook_audit_events` (`id BIGSERIAL PRIMARY KEY`, `type TEXT NOT NULL CHECK (type IN
      (...))`, `occurred_at`, `route`, plus only the narrow payload-derived fields the audit sink
      interface defines). Both `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, no policy defined (the
      service-role key bypasses RLS by design — document this reasoning inline, don't just enable it
      silently). See §8 for migration file conventions.
- [ ] Reference (current, until removed): `packages/api/src/webhooks/{RazorpayWebhookEventStore,
      RazorpayWebhookAuditSink,verifyRazorpayWebhookSignature}.ts`,
      `packages/api/src/routes/webhooks-razorpay.ts`,
      `supabase/migrations/20260718182238_add_razorpay_webhook_tables.sql`.

---

## 7. Test files — what's expected, and exactly where each lives

**Build and run in this order, every time:**

1. [ ] **Hermetic first** — the full authorize → verify → execute → confirm chain against the
       connector's own `Mock<Name>Server`, zero real network calls. Lives in
       `packages/connector-<name>/tests/unit/`:
   - `<name>-<action>-policy.test.ts` — schema validation + every rule branch, and (since G-33,
     `docs/VERIFICATION-GAPS.md`) confirming the policy loads at all under `PolicyValidator`'s
     fail-closed `boundSignals`/`unboundSignalReasons` coverage check. `PolicyAction` has only
     `approve`/`reject` (`REQUIRE_OVERRIDE` was removed as dead code, G-38) — no unintended-outcome
     check is needed beyond that. Reference: `hubspot-deal-update-policy.test.ts`.
   - `<name>-<action>-signals.test.ts` — every branch of the pure signal-building/allowlist logic
     (forward/backward/terminal/unrecognized-state cases, delta/threshold arithmetic, boundSignals-
     safe omission of absent fields). Reference: `hubspot-deal-update-signals.test.ts`.
   - `<Name>SignalStateVerifier.test.ts` — independent re-verification logic, including the
     Approval Artifact path if §5 applies. Reference: `HubSpotSignalStateVerifier.test.ts`.
   - The **executable connector's own test** (`<name>-connector.test.ts`: fetch, update, deny-by-
     default guard before any network call, non-2xx/timeout fail-closed, bad-credential-shape
     rejection, credential never leaked into a thrown error or response metadata, placeholder-
     credential guard against the real endpoint and its mock-server exemption) lives in
     **`packages/execution-gateway/tests/unit/`**, not in the connector's own package — this is the
     Phase 1C convention (the executable class itself lives in `execution-gateway`; its test moves
     with it). Reference: `packages/execution-gateway/tests/unit/hubspot-connector.test.ts`.
2. [ ] **Policy-denial-makes-zero-calls, proven at two layers:**
   - Connector-execution layer (alongside the executable connector's own test, in
     `execution-gateway/tests/unit/`): a denied action makes zero real calls, asserted by reading the
     mock server's state directly afterward and confirming it's byte-for-byte unchanged.
   - HTTP boundary (`packages/api/tests/integration/<name>-<action>.integration.test.ts`): a policy
     `REJECTED` decision reached through the real, production-wired `POST /execute` is caught in
     `ExecutionGate.enforce` before the connector is ever dispatched to — assert `response.status
     === 403`, `response.body.code === "POLICY_DENIED"`, **and** a `fetch` spy confirming literally
     zero calls reached the mock server's base URL. Reference:
     `packages/api/tests/integration/hubspot-deal-update.integration.test.ts`.
3. [ ] **Gated live suite last** —
       `packages/api/tests/integration/<name>-live.integration.test.ts` +
       `packages/api/tests/helpers/<name>-live-availability.ts` (the gating logic — mirror
       `hubspot-live-availability.ts`). Gated behind `ALLOW_LIVE_<NAME>=1` **plus** the real
       test-mode credential env var(s), each **format-validated before any network call** (e.g. must
       start with the vendor's documented test-key prefix) so a malformed credential fails fast
       instead of making a real request. Skipped by default — never part of routine `npm test`.
       **Prefer a non-destructive nudge-then-revert live action** (read live, apply a small
       reversible change, verify independently via a test-side oracle bypassing the connector, then
       revert) over an irreversible one — this is what lets the live suite be rerun repeatedly
       without depleting or permanently altering real state. Reference:
       `packages/api/tests/integration/hubspot-live.integration.test.ts`.

---

## 8. Migration conventions — only when actually needed

**Most connectors need zero new migration.** HubSpot has none — its state (deal properties) lives
entirely in the external vendor, not in Parmana's own database. Only add a migration if the
connector needs durable server-side state beyond what `execution_trust_records`/receipts already
capture generically — webhook dedup (§6) or a cumulative-cap reservation ledger are the two
precedents.

- [ ] **File location and naming**: `supabase/migrations/<YYYYMMDDHHMMSS>_<short_description>.sql`
      — a real, chronological UTC timestamp prefix (this determines application order), snake_case
      description.
- [ ] **Idempotent, always**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`. Widening a
      `CHECK` constraint requires `DROP CONSTRAINT IF EXISTS <name>` immediately followed by an
      unconditional `ADD CONSTRAINT <name> CHECK (...)` — Postgres has no "alter check in place."
- [ ] **RLS on every new table**: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY`, no policy defined
      — the service-role key (used server-side by Parmana's API) bypasses RLS by design, so this
      closes the table to the anon/authenticated Data API roles by default-deny without needing an
      explicit policy. State this reasoning in the migration's own comment, don't just enable it
      silently.
- [ ] **Update `scripts/apply-all-migrations.sql` in the same commit** — append the new migration's
      block using the exact `-- Source: supabase/migrations/<file>` header format the existing
      blocks use. Do this immediately, not "later" — this session found the consolidated script had
      drifted 5 migrations stale because this step kept getting skipped, which became the actual
      blocker when a fresh project needed the full history applied in one shot. Don't repeat that.

---

## 9. `CLAIMS.md` — what to write, and the discipline that governs it

- [ ] **One new `## 3.<N> <Connector Name> (Scoped)` section**, added after the last existing `3.x`
      entry. The `(Scoped)` suffix is not decorative — every connector claim in this codebase is
      scoped, and the section must say exactly what's covered and what isn't.
- [ ] **Present-tense claims only for what has actually been run and observed this session** — never
      for what the code merely appears capable of. This is the single most important discipline
      specific to connector work: a connector touches a real external vendor, real money or real
      customer data in the live case, and a false "this works" claim here is the most expensive kind
      to be wrong about. If the live-gated suite wasn't run this session (no credentials available),
      say so explicitly — "not re-run live this session, open work for whoever next has credentials
      configured" — exactly as HubSpot's own §3.10 does in its SDK-dogfooding update, rather than
      letting an earlier session's live-pass silently stand in for this one.
- [ ] **Cite exact file paths, exact test file names, and exact test counts** as evidence — every
      claim in this document is checkable against the cited file, not asserted on its own authority.
- [ ] **An explicit "Scope, precisely" (or equivalent) paragraph** naming what's out of scope this
      milestone (other object types, other actions, other properties) — add corresponding
      `[FUTURE]` bullets to §4 for each.
- [ ] **Disclose bugs plainly, including when the connector's own safety mechanism caught your
      mistake, not just when it caught a real defect.** HubSpot's first live amount-test run failed
      `403` because the test fixture itself omitted a required signal — that was `SignalIntentBinder`
      working correctly, not a connector bug, and §3.10 documents it as exactly that rather than
      glossing over it or quietly fixing it out of the record.
- [ ] **This guide itself is never a CLAIMS.md entry.** A complete, accurate connector-build guide
      is internal engineering documentation — it does not change what Parmana can do, and must never
      be cited as if it were a product capability. Don't add one.

---

## 10. Two hardening rules that apply regardless of everything above

Both were real incidents on Razorpay, discovered and fixed after the fact. Every new connector
builds them in from its first version:

- **Placeholder-credential guard** (§3, step 3) — never rely on the vendor happening to reject a
  test-mode placeholder sent to its real API.
- **No bridge/alias env variables** (§4) — read the documented test-credential variable name
  directly, exactly as `.env.example` documents it, with no intermediate variable that can drift
  out of sync with what's actually read.
