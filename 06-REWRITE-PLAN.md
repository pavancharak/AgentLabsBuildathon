# 06 — REWRITE PLAN

_Design/scoping document only. No application code. Snapshot: 2026-08-04, written against
`parmana-exp` at commit `a0c725e` ("Add state-verification for Razorpay/HubSpot signals, fix
cumulative-cap race, complete Postgres migration")._

---

## 0. Why this document exists

`parmana-exp` has real, live-verified production history: TRL 7 (`docs/CLAIMS.md` §
Maturity Assessment), a real ₹1.00 refund moved through Razorpay Live Mode with a genuine
Razorpay-initiated webhook closing the loop (CLAIMS.md 3.9), a public adversarial security
finding found/fixed/disclosed (G-24, `docs/VERIFICATION-GAPS.md`), an open-core signing
library extracted (`@parmana/envelope-verifier`), and — as of this session — the completion of
a multi-session effort to remove a PostgREST/`supabase-js` dependency in favor of direct
Postgres access. None of that is being thrown away as _knowledge_. The code is being rewritten;
the requirements, the proofs, and the hard-won judgment calls are the actual asset and this
document is how they survive the rewrite.

This document is precise enough that starting implementation from it should not require
re-deriving any of the decisions below. Where a decision is genuinely open, that is stated
explicitly rather than silently resolved.

---

## 1. Full capability inventory (rewrite acceptance criteria)

Source of truth: `docs/CLAIMS.md` §§ 2–3 (the only document in this repo whose own stated
discipline is "present-tense only if backed by implementation + tests"), cross-checked against
the actual source tree this session. Nothing below is aspirational; where CLAIMS.md itself
scopes a claim narrowly (e.g. "test mode only," "reachability only, not money-moving"), that
scope is preserved here — the rewrite's bar is to match the _actual_ proven capability, not an
inflated version of it.

### 1.1 Core execution/authorization pipeline (propose → verify → execute → confirm)

- Business Transaction validated for internal trust-chain consistency before entering the
  runtime (`BusinessTransactionValidator`, CLAIMS 2.1).
- Exactly one explicitly referenced policy loaded and identity-validated; no discovery,
  negotiation, "latest version," or silent substitution (`PolicyRouter`, `PolicyValidator`,
  CLAIMS 2.2).
- Deterministic, sequential, first-match policy evaluation with a recorded matched rule,
  reason, and evaluation trace (`PolicyEngine`, CLAIMS 2.3).
- Execution blocked when required trust artifacts are missing or the decision is not approved
  (`TrustChainValidationComponent`, `ExecutionGate`, CLAIMS 2.4).
- Signed, single-use, time-bounded Execution Authorization per approved decision (Ed25519
  default, ML-DSA-65/FIPS 204 selectable via `SIGNATURE_PROVIDER`) (CLAIMS 2.8).
- A rejected Decision never produces a signed authorization — authorization signing happens
  strictly after `ExecutionGate.enforce()` approves (CLAIMS 2.12).
- Independent envelope verification: a receiving system verifies an authorization using only
  Parmana's public key and the envelope, without trusting Parmana's process or database
  (`@parmana/envelope-verifier`, CLAIMS 2.9, 3.1 — scoped: opt-in per receiving endpoint, not a
  network-level guarantee).
- Rejection of forged signatures, tampered payloads, expired envelopes, and replayed envelopes,
  with the specific proven property that a _forged or expired_ envelope never burns the nonce
  (CLAIMS 2.10).
- Cryptographically verifiable execution evidence: Execution Trust Records, canonical hashes,
  signed Receipts (`ExecutionTrustRecordBuilder`, `VerificationCrypto`, `ReceiptCrypto`, CLAIMS
  2.5).
- `authorizationId` is part of the hashed/signed Trust Record content, not attached alongside
  it — tampering changes the recomputed hash (CLAIMS 2.11).
- Independent verification of execution evidence from the artifacts alone (CLAIMS 2.6), and
  replay of recorded decisions for verification/analysis (CLAIMS 2.7).
- Authorization-binding verification: every `APPROVED` execution in a verified Trust Record
  must carry a non-empty `authorizationId`; all checks (integrity, signature, binding) run
  unconditionally and independently — one failure never suppresses another (CLAIMS 2.15).
- Distinguishable HTTP status: policy `REJECTED` → `403`/`POLICY_DENIED`; consumed-nonce replay
  → `409`/`NONCE_ALREADY_CONSUMED`; genuine server error → `500` (CLAIMS 2.21).
- Atomic rejection of duplicate `businessTransactionId` — identical error class regardless of
  storage backend, proven under real concurrent-`create()` races against both the in-memory and
  Postgres-backed repository (CLAIMS 2.20).

### 1.2 Credential isolation architecture

- `execution-control` / `execution-gateway`: session credentials resolved only inside the
  vault, at execution time, and destroyed immediately afterward by an unconditional
  `try/finally` — the requesting code never holds the credential (CLAIMS 3.4's
  "SessionCredentialSecureConnector" description, proven for Razorpay's `key_id`/`key_secret`
  and HubSpot's Private App token alike).
- One-time Gateway sessions; issuance/consumption/destruction lifecycle enforced structurally,
  not by convention.
- `CredentialProvider` seam (`StaticCredentialProvider`, `EnvironmentCredentialProvider`) with
  credential-leak checks in the connector-SDK foundation test suite (CLAIMS 3.3).
- Fail-closed absence, not fail-open substitution: when a connector's real credential env vars
  are unset outside test mode, that connector is simply never registered — `ConnectorSdkRegistry`
  reports "no connector registered for capability," never a mock/placeholder credential silently
  standing in (CLAIMS 3.4, 3.10; `createRazorpayCredentialProvider.ts`,
  `createHubSpotCredentialProvider.ts`).
- Placeholder-credential guard against the _real_ production endpoint, present from day one for
  HubSpot (learned from Razorpay's retrofit — see § 2).

### 1.3 Signal/Intent binding — the G-24 fix, exact mechanism (safety-critical, reproduce precisely)

This is not a general "validate inputs" feature. It is a specific, narrow, load-bearing
mechanism and the rewrite must reproduce its exact shape, not an approximation:

- `Policy.boundSignals`: an opt-in map from a signal key to an Intent dot-path (e.g.
  `{ "requestedRefundAmountPaise": "parameters.amountPaise" }`), validated structurally by
  `PolicyValidator`.
- `SignalIntentBinder.findViolations(policy, signals, intentSnapshot)`: for every declared
  binding, resolves the Intent dot-path and requires **strict equality** against the declared
  signal value. A missing signal counts as a violation, not a pass (never treats `undefined ===
undefined` as a match).
- Runs in `RuntimeEngine.execute()` **immediately before `PolicyEngine.evaluate`**, over the
  exact signals about to be evaluated and the exact Intent that will be signed and executed if
  approved.
- A violation is built into an ordinary `PolicyDecision` with `outcome: REJECT`,
  `matchedRuleId: "signal-intent-binding-violation"`, `evaluatedRules: 0`, naming every
  mismatched field in the reason string. **No policy rule is ever evaluated for a bound
  mismatch, and no authorization is ever generated.**
- The historical exploit this closes, verbatim (for the regression test — see § 7): `signals`
  declaring a fully verified, policy-approved $5,000 payment to a known vendor
  (`vendorVerified/invoiceVerified/paymentApproved/sufficientFunds: true, paymentAmount: 5000,
riskScore: 10, vendorId: "VENDOR-1001"`) while `intent` targets
  `"ATTACKER-CONTROLLED-ACCOUNT-9999"` for `999999999`. Before the fix: `200`/`APPROVED`/
  `COMPLETED`, a real signed Trust Record and receipt issued for it.
- A compounding, same-session finding fixed alongside it: `authority.principalId` was
  likewise caller-declared with no binding to the identity the caller's credential actually
  proves (`isPrincipalAllowed`, gates against the caller's own grant, not the request's claim).

### 1.4 Nonce/replay protection

- `NonceStore` interface; `MemoryNonceStore` (tests/single-process) and `SupabaseNonceStore`
  (production, Postgres-backed — now direct `pg`, see § 2) implementations.
- Fleet-wide single-use requires one shared, durable NonceStore surviving process restarts —
  stated as a conditional claim precisely because a per-process in-memory store only gives
  per-instance single-use (CLAIMS 3.2). Production wiring fails closed at startup if the durable
  store is not configured; never silently falls back to in-memory.
- Concurrent-request race proven directly against real Postgres: two simultaneous
  `checkAndRecord` calls for the same nonce — exactly one succeeds (CLAIMS 3.2 evidence).
- Nonce consumption is the **last** check in the verification order — version → signature →
  expiry → TTL policy → `businessTransactionHash` recompute-and-compare → nonce — so a forged or
  mismatched request never burns a nonce (`ExecutionGateway.verify`).

### 1.5 Refusal Record pipeline (RFC-0021)

- A durable, signed, third-party-verifiable artifact for every policy `REJECT` (not just every
  `APPROVE`) — closing the historical asymmetry where only approvals were provable.
- Signed the same structural way as a Receipt (`RefusalCrypto`, same
  `TrustRecordHasher`/`ArtifactSigner`/`FileKeyProvider`/`DEFAULT_KEY_ID` composition as
  `ReceiptCrypto`).
- **The fail-open guarantee, precisely**: a Refusal Record write failure — builder not
  configured, signing error, storage outage, anything — is caught and never rethrown; the
  caller (`RuntimeEngine.execute()`, immediately before `executionGate.enforce()`) always
  proceeds to enforce the REJECT exactly as if the Refusal Record mechanism did not exist. The
  refusal itself never depends on its own evidence being writable. A failure is still loud
  (`console.error`, structured, naming the transaction/decision), never silent.
- Independently verifiable by anyone holding the record, against Parmana's public key alone —
  no database lookup, no caller authentication required (`verifyRefusalRecord`).
- `GET /refusal/:id` (ownership-scoped) and `POST /refusal/verify` (unauthenticated,
  third-party) routes.

### 1.6 Audit-sink signing (caller-auth, webhook)

- Every caller-authentication accept/reject event, and every Razorpay-webhook accept/reject
  event, is durably recorded and now (as of this session's commit) cryptographically signed —
  the same evidentiary standard as Refusal Records and Receipts, applied to the _access_ layer,
  not just the execution layer.
- Fail-closed at the point of use for caller-auth: `middleware/caller-auth.ts` rejects the
  request with `503`/`AUDIT_UNAVAILABLE` if the audit write itself fails — an action that
  executes without an audit record is treated as contradicting "independently verifiable
  execution" (CLAIMS 2.19). No retry, buffering, or queueing: fails closed immediately, once,
  every time. **This is the deliberate opposite of the Refusal Record's fail-open guarantee (§
  1.5) — carry forward the distinction, not just one of the two rules**: caller-auth is a gate
  the request has not yet passed (safe to hold it open pending durable proof); a policy REJECT
  is a decision already made (must never be blocked from taking effect by an unrelated evidence
  write).
- Backed by direct Postgres via `PostgresPoolFactory` (this session's "complete Postgres
  migration" commit), not `supabase-js`.

### 1.7 ChallengeRecord (RFC-0022) — status: designed, not implemented

`docs/rfcs/RFC-0022-Challenge-Record.md` is a **Draft**, explicitly "no implementation code is
included or should be inferred as approved by this document's existence." Its own recommendation
(§ Proposal 3) is **not** to sign it like `RefusalRecord` — a Challenge Record is evidence of an
_epistemic process_ (what was questioned, checked, and changed), not of an execution outcome,
and the RFC gives specific reasoning for why that distinction matters. `packages/storage/src/
postgres/PostgresChallengeRecordRepository.ts` and `packages/shared/src/domain/
challenge-record.ts` exist as scaffolding but there is no wired write path, no route, and no
test suite backing a "ChallengeRecord" capability today — **do not inventory this as an
existing, working capability**. The rewrite's job is to implement the RFC's design (unsigned,
structured, append-only, cross-linked to the claim/gap/RFC it resolves), not to reverse-engineer
an existing behavior.

### 1.8 Razorpay: connector + webhook + settlement lifecycle (full chain, proven live)

- `RazorpayConnector`: `razorpay:payment-fetch`, `razorpay:refund-create`,
  `razorpay:refund-fetch` capabilities; deny-by-default credential handling; fails closed
  before any network call if the built-in test-mode placeholder credential would reach
  Razorpay's real API.
- Policy pack (`policies/razorpay-refund/1.0.0/policy.json`): payment must exist and be
  captured, currency INR, amount within remainder, per-refund cap, daily cumulative cap.
- Application-level idempotency at two independent layers: a local outcome cache
  (`RazorpayRefundService`) and the connector's own pre-create Razorpay-side refund listing
  keyed by `notes.parmana_txn`.
- Webhook receipt (M4a): signature-verified (HMAC-SHA256, timing-safe, over raw wire bytes,
  never a re-serialization), durably deduplicated by event id via one atomic
  `recordIfUnseen`, verify-before-consume ordering proven directly.
- Settlement closure (M4b): **FETCH-VERIFY is load-bearing, not decorative** — a webhook is
  "a doorbell, never a delivery." Before any confirmation is written, an authenticated
  `razorpay:refund-fetch` confirms the refund's actual status directly from Razorpay; the
  _fetched_ status, never the webhook's own claimed event type, decides
  `SettlementConfirmation.status`. Park-and-retry with a bounded attempt window for the
  legitimate race where a webhook arrives before the synchronous execution path finishes
  writing the Trust Record.
- Settlement Confirmation is a second, independently signed artifact — the original Receipt and
  Trust Record hash/signature are never mutated.
- **Proven live, not merely implemented**: a real ₹1.00 (100 paise) refund, executed through the
  production `POST /execute` chain, moved real money in Razorpay **Live Mode**
  (`parmana-api-live`, `fly.live.toml`), and a genuine Razorpay-initiated `refund.processed`
  webhook, delivered to a permanent public endpoint (not a temporary tunnel), was
  signature-verified, correlated by construction (the settlement processor never queries
  Razorpay on its own initiative — only drains events a real signed webhook POST actually wrote),
  fetch-verified, and closed into a signed `SETTLED` Settlement Confirmation. This is the TRL 7
  evidence (CLAIMS § Maturity Assessment). A permanently captured, redacted real webhook
  delivery fixture (`packages/api/tests/fixtures/razorpay-webhook-real-delivery.ts`) is replayed
  in an always-running hermetic test so this proof does not silently rot.
- **The gap this session closed** (post-CLAIMS.md, see `docs/VERIFICATION-GAPS.md` G-24's
  update): the _generic_ `POST /execute` production route previously evaluated the
  `razorpay-refund` policy against caller-supplied signals with zero independent verification
  against Razorpay's real state — `paymentStatus`, `refundableRemainingPaise`,
  `requestedExceedsRemainder` were pure caller attestations. `RazorpaySignalStateVerifier` now
  independently re-fetches the real payment and overrides an APPROVE to REJECT on mismatch,
  wired into production. **This is § 6 Risk C's origin case and the rewrite's structural fix
  for it must supersede this session's per-capability fix — see § 6/§7.**
- **Still open, not carried forward as "done"**: `dailyCumulativeAfterThisRefundPaise` is
  verified against Parmana's own ledger's arithmetic, but no ledger is wired to the generic
  production route at all (only the test/tutorial-only `RazorpayRefundService` has one). The
  ledger's own TOCTOU race (concurrent refunds both reading a stale cumulative total) is fixed
  in `RazorpayRefundService` (`recordApprovedRefundIfWithinCap`, atomic reserve-before-execute)
  but that fix has never been exercised against production traffic, because production traffic
  doesn't go through that service.

### 1.9 HubSpot connector

- `@parmana/connector-hubspot`: standalone workspace package (not a subdirectory of
  `connector-sdk` — see § 5 for why this placement pattern is being adopted generally).
- Deal `dealstage`/`amount` update only; deny-by-default at the _property_ level (a request
  naming any property outside `HUBSPOT_ALLOWED_DEAL_UPDATE_PROPERTIES` is refused before any
  network call).
- Both of Razorpay's retrofitted hardening fixes were built in from HubSpot's first version,
  not added after an incident: the real-endpoint placeholder-credential guard, and no
  bridge/renamed environment variable between test and production credential resolution. This
  is direct evidence the "learn once, apply proactively next time" discipline already works in
  this codebase — the rewrite should trust and continue it, not merely aspire to it.
- `boundSignals` present in the policy's first version, not retrofitted after a live
  demonstration of a gap the way Razorpay's was.
- `HubSpotSignalStateVerifier` (this session) closes the same generic-route gap Razorpay's
  fix closes, wired into production the same way.
- Two explicitly open, deliberately unresolved design decisions inherited as-is (not bugs):
  one global stage order rather than per-pipeline configuration; one authorization
  scope covering both `dealstage` and `amount` rather than two independently revocable ones.
- Live-verified against a real HubSpot account (non-destructive: read, small in-threshold nudge,
  independently confirmed, reverted, confirmed reverted).

### 1.10 Storage layer

- Repository interfaces in `@parmana/shared`; in-memory implementations for tests; Postgres
  implementations for production.
- **As of this session: direct Postgres (`pg`, `PostgresPoolFactory`, `DATABASE_URL`), not
  PostgREST/`supabase-js`, for the repository/query layer** — `SupabaseBusinessTransactionRepository`,
  `SupabaseExecutionTrustRecordRepository`, `SupabaseNonceStore`, `SupabaseRefusalRecordRepository`
  were all migrated this session. **Precisely, not overclaimed**: `@supabase/supabase-js` is
  still listed in `packages/storage/package.json` and still imported by
  `SupabaseClientFactory.ts`, used by `SupabaseStorageProvider.ts`/`StorageFactory.ts`. The
  migration is not fully purged as of this snapshot — see § 2's lesson for why the rewrite must
  not repeat even this residual incompleteness.
- Atomic duplicate-transaction rejection proven identically across both backends (§ 1.1).
- Migrations: `supabase/migrations/*.sql`, applied via `scripts/apply-all-migrations.sql` /
  `packages/storage/scripts/migrate.ts`.

### 1.11 API surface

Routes, with actual behavior (from `packages/api/src/app.ts` and route files), grouped by
caller-auth exemption:

- **Exempt from caller-auth** (mounted before the auth middleware): `GET /health`,
  `GET /ready` (distinguishes Supabase/Postgres-backed storage from in-memory),
  `GET /openapi.yaml`, `GET /documentation`, `POST /refusal/verify` (unauthenticated,
  third-party signature verification), `POST /audit/verify` (unauthenticated, pure
  signature-over-bytes verification of caller-auth/webhook audit events), and
  `POST /webhooks/razorpay` when configured (its own HMAC verification is the access control,
  not caller-auth — mounted with a route-scoped `express.raw()` ahead of the global
  `express.json()` so signature verification runs over the exact wire bytes).
- **Behind caller-auth** (every other route, when `callerAuth` is not `"disabled"`):
  `GET /`, `GET /version`, `POST /execute` (submit + execute a Business Transaction),
  `POST /verify`, `GET /verification/:id` (surfaces settlement status inline, never silently),
  `GET /refusal/:id` (ownership-scoped), `POST /receipt`, `GET /receipt/latest`,
  `POST /transactions` + `GET /transactions` (list, filtered post-fetch by caller) +
  `GET /transactions/:id`, `GET /policies` (and sub-routes), `GET /trust-records/:id`,
  `POST /replay`.
- Caller identity binding: an authenticated caller may only assert an `authority.principalId`
  it is actually granted (`isPrincipalAllowed`); `metadata.submittedBy` is stamped server-side
  from the authenticated identity, never trusted from the client; `isOwnedByCaller` scopes every
  read route so cross-caller access reads as a clean `404`, never a `403` that would confirm the
  target id exists.
- `createApp`'s `callerAuth` and `razorpayWebhook` options have **no default** — every call site
  states its choice explicitly (`"disabled"` or the real configuration), by design, so silently
  mounting the API with no caller authentication is structurally impossible to do by omission.

### 1.12 Deployment shape

- Multi-stage Dockerfile (`deps` → `build` via `tsc -b` → `prod-deps` (fresh `npm ci
--omit=dev`) → `runtime` on `node:24-slim`, non-root `node` user, signing key material never
  baked into the image — `keys/` starts empty in the image; `PARMANA_KEY_MATERIAL_JSON` or a
  mounted volume supplies it at runtime).
- Single container runs both the HTTP API and the Razorpay settlement poll loop
  (`docker/entrypoint.sh`), a documented, deliberate trade-off, not an architectural
  requirement.
- Two live Fly.io deployments proven this year: `parmana-api` (`fly.toml`, Razorpay Test Mode,
  the TRL 7 test-mode proof) and `parmana-api-live` (`fly.live.toml`, Razorpay Live Mode, the
  real-money proof). Both require caller authentication at every route except `/health`
  (observed live: unauthenticated `POST /execute` → `401` with `WWW-Authenticate`).
- Fail-closed startup configuration validation across the board: policy directory, caller-auth
  keys, signing key material, and (in production) the durable NonceStore/audit-sink
  configuration all refuse to start with a named, actionable error rather than surfacing as an
  unstructured runtime failure or silently degrading to an in-memory/mock substitute (CLAIMS
  2.17).

---

## 2. Lessons to carry forward explicitly (judgment, not just code)

1. **No PostgREST / auto-generated REST layer dependency, ever, not even residually.**
   `parmana-exp` spent real, multi-session effort removing `@supabase/supabase-js` from the
   query path after it was implicated in a production incident, and — as documented precisely
   in § 1.10 — the removal is _still not fully complete_ as of this snapshot (the dependency and
   one client-factory file remain). The lesson is not "prefer direct Postgres"; it is "a partial
   removal is still the wrong end-state, and it is easy to end up there by accident even when
   you know better." The rewrite's mechanism for this is structural, not aspirational — see § 7.

2. **G-24: signal/intent binding must be content-bound, verified against the exact executed
   Intent, not just checked for internal shape validity.** The distinction that mattered:
   `SignalValidator` (pre-G-24) only checked that `signals` was well-shaped; it never checked
   that `signals` described the same action as `intent`. "Well-formed" and "true" and "about
   the same thing" are three different properties and this codebase's history has now separately
   discovered all three needed independent enforcement (SignalValidator → SignalIntentBinder →
   SignalStateVerifier). Reproduce the exact mechanism (§ 1.3), and reproduce the taxonomy —
   design the rewrite's policy-evaluation contract around all three properties from day one
   rather than discovering them in sequence again.

3. **Fail-closed for evidence writes, except where fail-closed would let the evidence-write
   layer veto a security-critical decision it did not make.** Two real, deliberately different
   rules exist side by side in this codebase and the rewrite must reproduce the distinction, not
   collapse it into one policy: caller-auth audit writes fail closed (§ 1.6 — refusing an
   unproven request is safe); Refusal Record writes fail open (§ 1.5 — a REJECT decision has
   already been made and must take effect regardless of whether its own evidence trail can be
   written). Getting this backwards in either direction is a real defect class, not a style
   preference.

4. **One-session-per-milestone, one-commit-per-milestone discipline.** `05-SESSION-LEDGER.md`'s
   own record shows this produced reviewable, bisectable history across 8+ real sessions. The
   rewrite's milestone boundaries in § 3 are sized to fit this discipline directly.

5. **CLAIMS.md present-tense-only-if-tested, from commit one, not backfilled.**
   `docs/CLAIMS.md`'s own explicit lifecycle (Idea → Implementation → Automated Tests → Audit →
   Documented Proof → Public Claim) is the actual reason this document is trustworthy enough to
   serve as § 1's source of truth. `04-INCIDENTS-LOG.md` and `01-ACHIEVED.md`/
   `05-SESSION-LEDGER.md` are explicitly, admittedly stale ("Snapshot: July 5, 2026," not updated
   since) — this is the one discipline in this codebase's history that visibly _lapsed_, and the
   rewrite must not let CLAIMS.md lapse the same way. Concrete mechanism in § 7.

6. **Docker builds must compile fresh — the stale `dist/` lesson.** `pretest` already runs
   `scripts/check-dist-fresh.ts` in this repo (`package.json`), and the Dockerfile's own build
   stage runs `npx tsc -b` from source inside the image rather than trusting a pre-built `dist/`
   copied in. Carry forward both mechanisms verbatim: a test-gate that refuses to run against
   stale compiled output, and a Docker build that always compiles from source in a clean stage.

7. **Test gates must check the actual environment variable the exercised code path reads, not a
   renamed or superseded one.** This session's "complete Postgres migration" commit touched
   `assertStorageConfigured.ts`, `createNonceStore.ts`, and multiple tests specifically because
   gates had been written against `SUPABASE_URL` while the code path they gated had moved to
   `DATABASE_URL`. A stale gate reads as passing (or as a clean skip) while proving nothing about
   the code that actually runs in production. Every fail-closed startup/test gate in the rewrite
   must be reviewed at the same time as the config surface it gates, not independently.

---

## 3. Sequencing plan

Each milestone below is scoped to be independently testable and committable, matching the
one-session/one-commit discipline (§ 2.4). The order deliberately differs from the historical
order where the historical order retrofitted something this plan can build native from the
start — each such reordering is called out.

| #       | Milestone                                                                                                                                                                                                                                                                                                                                                                               | Packages                                                                                     | Native-from-start (vs. historical retrofit)                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **M0**  | Repo scaffold: package skeleton (§ 5), `CLAIMS.md` created empty with its lifecycle rule stated, `CONTRIBUTING.md`, CI skeleton (build/lint/typecheck/test, dist-freshness gate, dependency-cruiser rule — § 7 Risk B), and the **G-24 regression test ported verbatim, committed first, red** (§ 7 Risk A).                                                                            | none yet                                                                                     | —                                                                         |
| **M1**  | Crypto + key management: Ed25519 default, ML-DSA-65 selectable, `FileKeyProvider` with the path-traversal `assertValidKeyId` guard _from its first version_ (historically retrofitted after an unrelated finding — see CLAIMS 2.18), key/algorithm binding guard from day one.                                                                                                          | `crypto`                                                                                     | keyId validation                                                          |
| **M2**  | Domain model + storage: repository interfaces, in-memory implementations, **direct Postgres from the first commit, zero `supabase-js` dependency ever** (§ 7 Risk B), migrations runner.                                                                                                                                                                                                | `shared`, `storage`                                                                          | direct Postgres                                                           |
| **M3**  | Policy Engine + the unified signal-trust contract: `PolicyEngine`, `SignalIntentBinder` (§ 1.3, reproduced exactly), **and the structural external-state-verification contract (§ 7 Risk C) built together as one concept, not two sequential features.** G-24 regression test (M0) now must pass.                                                                                      | `policy`                                                                                     | signal/state contract unified from day 1, not discovered in sequence      |
| **M4**  | Runtime pipeline (propose → verify → execute → confirm), Execution Gateway, envelope verification, durable shared NonceStore, credential isolation (session credential vault, issue/consume/destroy).                                                                                                                                                                                   | `envelope-verifier`, `execution-system`, `execution-control`, `execution-gateway`, `runtime` | —                                                                         |
| **M5**  | Refusal Record pipeline, built as a first-class part of `RuntimeEngine.execute()`'s REJECT path from this milestone, **including its fail-open guarantee from the first version** (historically RFC-0021 landed as its own dedicated session after the core pipeline had existed for months — see § 2.3).                                                                               | `runtime`, `storage`                                                                         | fail-open guarantee native                                                |
| **M6**  | Audit-sink signing for caller-auth and webhook events, direct-Postgres from the start, fail-closed per § 2.3's distinct rule.                                                                                                                                                                                                                                                           | `api`, `storage`                                                                             | signed audit natively, not added after a "should this be signed too" pass |
| **M7**  | API surface: every route in § 1.11, caller-auth middleware with the mandatory-no-default `CallerAuthOption` shape from day one, deployment shape (Dockerfile, `docker/entrypoint.sh`, Fly config, migrations wiring).                                                                                                                                                                   | `api`                                                                                        | —                                                                         |
| **M8**  | Razorpay connector: connector + policy pack + `RazorpaySignalStateVerifier`-equivalent **built and wired into the one production execution path in the same milestone** — no interim state where a "stronger" fetch-verify implementation exists unwired while a generic path evaluates unverified caller signals (§ 6 Risk C's own origin story, not to be repeated even temporarily). | `connector-razorpay` (own package — § 5)                                                     | verifier native, wired same-milestone                                     |
| **M9**  | Razorpay webhook receipt + settlement lifecycle (fetch-verify load-bearing from this milestone's first version, not a separately-scoped M4a/M4b/M4c/M4d sequence spread across four historical milestones).                                                                                                                                                                             | `api`, `connector-razorpay`                                                                  | —                                                                         |
| **M10** | HubSpot connector, following Razorpay's now-mature pattern immediately (placeholder-credential guard, no bridge env var, `boundSignals` + state verifier all present in its first version — this already happened correctly once historically; repeat it).                                                                                                                              | `connector-hubspot`                                                                          | —                                                                         |
| **M11** | ChallengeRecord (RFC-0022), built per the RFC's own design and its own recommendation (unsigned, structured, append-only, cross-linked) — this is the first _implementation_ of RFC-0022, not a reproduction of an existing capability (§ 1.7).                                                                                                                                         | `shared`, `storage`, `api`                                                                   | genuinely new                                                             |
| **M12** | **Adversarial parity diffing** (§ 7): the G-24 exploit payload, plausible Risk-C-shaped unbound-signal misrepresentation attempts, and every case in the current `SignalIntentBinder`/policy test suites run through both `parmana-exp` and the new repo, outputs diffed. Not a normal test-writing milestone — its deliverable is a diff report, committed.                            | n/a (cross-repo)                                                                             | —                                                                         |
| **M13** | **Dedicated adversarial-review session** (§ 7), separate reviewer mindset from M3/M4/M8's implementation sessions: explicitly tasked with defeating signal-binding, credential-isolation, and state-verification code on all three named risks. Findings feed fixes back into M3/M4/M8 before M14.                                                                                      | n/a (review)                                                                                 | —                                                                         |
| **M14** | **Cutover gate**: the new repo independently re-earns TRL 7 — a real transaction, a real webhook, live-verified, on its own deployed infrastructure. `parmana-exp` remains the authoritative, live, production system until this milestone closes. Not before.                                                                                                                          | n/a                                                                                          | —                                                                         |

Every milestone after M3 assumes the unified signal-trust contract (M3) exists; no later
milestone may introduce a capability that evaluates policy against externally-sourced state
through any path other than that contract (§ 7 Risk C).

---

## 4. What genuinely gets left behind (and why that's fine)

- **`@parmana/verification`'s original six-stage pipeline package.** CLAIMS.md's own Future
  Claims section states it plainly: "retired in Session 5; it had no real implementation and no
  real test coverage; its stage architecture is not being resurrected." Nothing of value here —
  do not resurrect the shape, only the (already-superseding) `verification-service.ts` design it
  was replaced by.

- **The `docs/` tree's documentation sprawl.** This repo currently contains 700+ markdown files
  under `docs/`, with clear evidence of at least three superseded restructuring passes (parallel
  `ARCHITECTURE.md` at `/ARCHITECTURE.md`, `docs/ARCHITECTURE.md`, `docs/001-ARCHITECTURE.md`,
  `docs/02-architecture/ARCHITECTURE.md`, `docs/ARCHITECTURE_LOCK_v1.md`; parallel
  `docs/AUDIT_*.md` and numbered `docs/0NN-*.md` series; a `docs/00-introduction/` next to a
  root-level `VISION.md` and a `docs/VISION.md`). Only a narrow slice of this tree is load-bearing
  and current: `docs/CLAIMS.md`, `docs/VERIFICATION-GAPS.md`, `docs/rfcs/*`, `docs/adr/*`, and the
  connector build guide. The rest is historical noise from iterating on how to _present_ the
  project, not on what the project _does_ — do not port it wholesale; let § 1 (derived from the
  current, load-bearing subset) be the new repo's starting documentation surface, expanded
  forward from there.

- **The stale root-level snapshot docs themselves** (`01-ACHIEVED.md`, `02-REMAINING.md`,
  `03-CLAIMS-POSITION.md`, `04-INCIDENTS-LOG.md`, `05-SESSION-LEDGER.md`) — genuinely useful as
  _historical record_ (this plan cites several of them directly), but by their own admission not
  living documents. `04-INCIDENTS-LOG.md`'s own header names this precisely: "not been updated to
  reflect... this document's own gap... see RFC-0022 for the durable, structured record type
  going forward." Carry forward the _content_ they document (folded into § 1–2 above); do not
  carry forward the pattern of a numbered snapshot doc nobody is responsible for keeping current
  — RFC-0022/ChallengeRecord (M11) is the intended replacement pattern, and the rewrite should
  actually use it rather than let it stay a design document a second time.

- **Accumulated git history of credential rotations and debugging sessions.** INC-1 (the
  publicly-exposed private key, rotated 2026-07-05) and its still-open cleanup item (a
  `git filter-repo` history purge of the old repository, and archiving a sibling
  `pavancharak/parmana` repo with the same exposure) are real, documented incidents worth
  knowing about — but the _git history itself_ carrying that exposure is not an asset to
  preserve. The new repo starts with clean history and a freshly generated keypair, never
  derived from or containing the compromised material.

- **Abandoned/unresolved Fly.io deployments.** `parmana-api-live` is flagged (outside what this
  codebase's own docs currently record — CLAIMS.md 3.9 documents it as the deliberate live-mode
  proof deployment, not as abandoned) as an unresolved operational cleanup item. Whatever its
  exact current state, it should not be treated as infrastructure the rewrite inherits or must
  keep running — fold its decommissioning into the M14 cutover gate: once the new repo
  independently re-earns its own live-mode TRL 7 proof, both of `parmana-exp`'s deployed Fly
  apps (`parmana-api`, `parmana-api-live`) are candidates for teardown, not before.

- **Superseded implementation attempts, specifically the "one strong, one weak, both live"
  pattern.** `RazorpayRefundService`/`RazorpayRefundHarness` is a real, well-tested,
  fetch-verify-correct implementation that was simply never wired into the generic production
  route (§ 1.8, § 6 Risk C). This is not a capability to reproduce as a _second_ pathway in the
  rewrite — the rewrite has exactly one pathway per § 7's Risk C mechanism, so there is no
  "harness vs. generic route" distinction to carry forward at all. The lesson survives (§ 2.1);
  the two-pathway shape does not.

---

## 5. Repo setup proposal

**Name**: a clean `parmana` (not `parmana-v2`, not another `-exp`/`-next` variant). Reasoning:
a version-numbered or "experimental"-sounding name signals impermanence and invites a _third_
rewrite's worth of "which one is real" confusion later; the actual signal to send is that this
_is_ the product going forward, with `parmana-exp` explicitly archived (read-only, README
pointing at the new repo) once M14 closes — not run in parallel indefinitely, not renamed to
imply lesser status while still being load-bearing.

**Package boundaries: reuse `parmana-exp`'s, with two specific adjustments.**

Reasoning for reuse: these boundaries (`shared`, `crypto`, `envelope-verifier`, `storage`,
`policy`, `execution-system`, `execution-control`, `execution-gateway`, `connector-sdk`,
`connector-hubspot`, `runtime`, `api`) are not arbitrary — they were arrived at through real
iteration (`envelope-verifier` was extracted specifically to make the "verify without trusting
Parmana's process" claim (§ 1.1, 2.9) checkable by an outside party; `connector-hubspot` was
deliberately extracted as its own package rather than nested, once the pattern of "one connector
per third-party system" became clear). Restructuring them without a concrete reason would be
change for its own sake, contradicting § 7's own "check whether it was load-bearing before
simplifying" discipline turned inward on the architecture itself.

Two adjustments, both justified by evidence already in this document:

1. **Every third-party connector is its own standalone package from day one** —
   `connector-razorpay`, `connector-hubspot`, and any future connector — none nested inside
   `connector-sdk` the way Razorpay currently is. HubSpot's placement is already the better
   pattern (CLAIMS 3.10's own phrasing: "not a subdirectory of `@parmana/connector-sdk`, unlike
   Salesforce/SAP/Oracle/Workday/Razorpay"); adopt it uniformly instead of leaving `connector-sdk`
   as a growing dumping ground for some connectors and a clean foundation-only package for others.

2. **The unified signal-trust contract (§ 3 M3, § 7 Risk C) lives in `policy` as a first-class
   export from `policy`'s first version**, not bolted on as a `runtime`-level optional dependency
   the way this session's `SignalStateVerifier` port was added (real, tested, but — by its own
   design — _optional_, which is precisely the shape Risk C's elimination mechanism must not
   have; see § 7).

One deliberately open decision, not resolved here: whether Refusal Record / audit-sink / (future)
ChallengeRecord evidentiary writes deserve their own `packages/evidence` boundary distinct from
`runtime` (where Refusal Record currently lives) and `api` (where audit-sink currently lives).
There is not yet enough evidence in this codebase's history that today's placement is causing a
real problem to justify moving it preemptively — flag it for a concrete decision at M5/M6, once
ChallengeRecord's real shape (M11) makes the full evidentiary surface visible, rather than
guessing now.

---

## 6. Risk: what could make the rewrite worse, not better

### Risk A — G-24 reopens

If the new signal-binding logic is even slightly different from `SignalIntentBinder`'s exact
semantics (§ 1.3) — strict equality vs. loose, "missing signal = violation" vs. "missing signal
= skip," binding checked before vs. after policy evaluation — it can silently reopen the exact
exploit already found by an external adversarial exercise, fixed, and publicly disclosed once
(CLAIMS 3.4's own "adversarial-testing hardening session" update, `docs/VERIFICATION-GAPS.md`
G-24). A rewrite is exactly the situation where "close enough" reimplementations happen by
accident, because the new code is written from memory of the _concept_ rather than against the
old code's exact behavior.

### Risk B — PostgREST gets reintroduced

`parmana-exp` spent real effort — and, per § 1.10/§ 2.1, still has not 100% finished spending it
— removing `@supabase/supabase-js` after it was implicated in a production incident. Most ORM
and BaaS tooling defaults nudge toward an auto-generated REST layer because it is the path of
least resistance for a new project; a rewrite done under normal time pressure, by a different
session or a different tool, can reintroduce exactly this dependency without anyone deciding to.

### Risk C — the unbound-signal/unverified-state gap gets rebuilt

Distinct from Risk A. G-24 was signals disagreeing _with each other_ (signals vs. intent,
within the same request). This is signals agreeing with each other while disagreeing _with
reality_ — the production `POST /execute` route evaluated `razorpay-refund` policy against
caller-supplied `paymentStatus`/`refundableRemainingPaise`/`requestedExceedsRemainder`/
`dailyCumulativeAfterThisRefundPaise` with zero fetch against Razorpay's actual state; a
separate, correct, fetch-verify implementation (`RazorpayRefundService`) existed the whole time
but was never wired into the route real traffic uses (§ 1.8). **This session's fix for it —
`RazorpaySignalStateVerifier`/`HubSpotSignalStateVerifier`, composed via
`CompositeSignalStateVerifier`, wired as an _optional_ trailing constructor dependency on
`RuntimeEngine`** — is real, tested, and closes the gap for exactly two capabilities. It is
**not yet the structural guarantee this risk's elimination mechanism requires**, and this plan
states that honestly rather than claiming the current fix already covers it: because the
dependency is optional, a _third_ capability added later, by a session that does not know this
history, can be wired without a verifier and silently reopen exactly this gap for itself. The
rewrite's job is to make that omission impossible to make, not merely unlikely.

---

## 7. Mandatory risk-reduction measures

Each measure below names its risk and its concrete mechanism. None of these are advisory.

### [Risk A] G-24 regression test ported first, verbatim, before any other milestone

The exact scenario in § 1.3's exploit paragraph — signals declaring a fully verified $5,000
payment to `VENDOR-1001` while intent targets `ATTACKER-CONTROLLED-ACCOUNT-9999` for
$999,999,999 — becomes a test in the new repo's first commit (M0), asserting the same two
things the original fix's own verification asserted: the decision must not be `APPROVED`, and
no signed authorization is ever produced. It is written in the new repo's own test framework and
naming conventions (not copy-pasted file-for-file, since M0 has no `RuntimeEngine` yet to import
it into), but the payload, the mismatch, and both assertions are word-for-word the original's.
It **exists and fails loudly** — red, visibly, in CI — from M0 until M3 makes it pass, so
"don't reopen G-24" is something the suite enforces from the first commit, not something anyone
has to remember across the intervening milestones.

### [Risk B] Structural omission of PostgREST, not disciplined avoidance

Two independent, redundant enforcement layers, both configured in M0 before any application
code exists:

1. **`package.json`-level**: a CI step (or a `dependency-cruiser`/`npm ls` check — this repo
   already depends on `dependency-cruiser` at the root, reuse it) that fails the build if
   `@supabase/supabase-js`, or any equivalently-shaped auto-generated-REST-layer client, appears
   anywhere in the dependency graph, at any depth, ever — not just "not currently imported."
2. **Import-level**: an ESLint `no-restricted-imports` rule naming the same package explicitly,
   so even a developer who somehow got the package installed (a stray `npm install`, a merge)
   gets a fast, local, pre-commit signal, not just a CI failure discovered later.

`DATABASE_URL` + `pg` (already proven, via `PostgresPoolFactory`, § 1.10) is the only supported
storage-connection shape from the first commit.

### [Risk C] No generic policy-evaluation pathway may exist that bypasses state verification

This is the measure this plan is most explicit about improving on this session's own fix, not
merely repeating it:

- `Policy`'s schema gains a required declaration, alongside the existing `boundSignals`, naming
  every signal the policy treats as **externally-sourced** (not fully determined by the request
  itself) — e.g. `externalSignals: string[]` naming `paymentStatus`, `refundableRemainingPaise`,
  `requestedExceedsRemainder` for `razorpay-refund`.
- The generic policy-evaluation entry point (the M3 successor to today's `PolicyEngine.evaluate`
  call site inside `RuntimeEngine.execute`) **requires** a registered state-fetcher for every
  `externalSignals` entry a loaded policy declares, resolved at policy-load time
  (`PolicyRouter`/registration), not at evaluate-call time. **A policy that declares an
  external signal with no matching fetcher registered fails to load at all** — the same
  fail-closed-at-startup discipline this codebase already applies to missing config (CLAIMS
  2.17), applied here to missing state-verification coverage instead of missing environment
  variables.
- Consequence, stated plainly: there is no code path in the rewrite equivalent to today's
  `RuntimeEngine(..., signalStateVerifier?: SignalStateVerifier)` optional trailing parameter.
  If a capability's policy declares external signals, the runtime cannot evaluate it without a
  fetcher; if it doesn't declare any, there is nothing to verify and no fetcher is required. The
  "generic path skips the fetch because nobody wired one" failure mode this session's fix leaves
  open (§ 6 Risk C) becomes a load-time refusal instead of a silent gap.
- `dailyCumulativeAfterThisRefundPaise`-shaped signals (dependent on Parmana's own ledger state,
  not a third-party API) are the same category under this contract: the "fetcher" for such a
  signal is Parmana's own storage layer, and the same load-time-required-fetcher rule applies —
  closing exactly the gap named in § 1.8's "still open" note, structurally, rather than leaving
  it as an accepted risk a second time.

### CLAIMS.md exists from commit one

Created in M0, before any application code — as an empty file stating only its own lifecycle
rule (Idea → Implementation → Automated Tests → Audit → Documented Proof → Public Claim) and a
placeholder Future Claims section. Every milestone that adds a capability updates CLAIMS.md in
the _same session_, not as separate follow-up work — the same rule `03-CLAIMS-POSITION.md`
already states for `parmana-exp`, actually enforced this time rather than lapsing the way
`01-ACHIEVED.md`/`04-INCIDENTS-LOG.md`/`05-SESSION-LEDGER.md` did (§ 2.5).

### Side-by-side adversarial comparison for security-critical paths (M12)

For signal/intent binding and every capability touching externally-sourced state: the G-24
exploit payload (§ 7 Risk A), the full current `SignalIntentBinder`/`ReferencePolicies*` test
suites (`packages/policy/tests/unit/`), and a constructed set of Risk-C-shaped
misrepresentation attempts (declared `paymentStatus`/deal-stage/amount claims that individually
satisfy every policy rule while contradicting a fixed, known-real mock state) are run against
both `parmana-exp` and the new repo, on identical inputs, with outputs diffed and the diff
committed as this milestone's deliverable. Matching `parmana-exp`'s proven-correct outputs is
the floor; on every Risk-C-shaped input, the new repo's output must additionally be _strictly
better_ (REJECT where `parmana-exp`'s generic route today would APPROVE) — passing the new
repo's own test suite is explicitly not sufficient evidence of either.

### `parmana-exp` stays authoritative in production until the new repo re-earns TRL 7 (M14)

Stated as a gate, not a target date: `parmana-exp`'s two live deployments continue serving
production traffic, unmodified in this regard, until the new repo has its own real transaction,
real webhook, and live-verified confirmation — the same three-part evidence CLAIMS.md's own
Maturity Assessment cites for `parmana-exp`'s current TRL 7 (§ 1.8). No earlier milestone
completion, however thorough, substitutes for this gate.

### Dedicated adversarial-review session, separate from implementation (M13)

A session whose only task is trying to defeat the new implementation on Risk A, B, and C
specifically — signal-binding, credential-isolation, and state-verification code — run by a
different reviewing pass than the one that built M3/M4/M8, mirroring the fact that G-24 itself
was found by an _external_ adversarial exercise, not this codebase's own internal audit process
(CLAIMS 3.4's own phrasing). Its job is to find a way in, not to confirm the design is sound;
findings feed fixes back into the relevant milestone, re-verified, before M14.

### Before simplifying, check whether it was load-bearing

Whenever a rewrite milestone's implementation of something is simpler than `parmana-exp`'s
version of the same capability, the commit implementing it must include a one-line note: what
was removed, and why the removed complexity wasn't actually protecting against something real —
cross-checked explicitly against `04-INCIDENTS-LOG.md`'s numbered incidents and the relevant
RFC(s)/ADR(s) for anything the removed complexity might trace back to (e.g. simplifying
`FileKeyProvider`'s `keyId` handling without checking it against CLAIMS 2.18 / the path-traversal
finding it fixes would be exactly the mistake this note exists to catch before it ships). This is
the same discipline `05-SESSION-LEDGER.md`'s existing "session ledger" convention already
models — the rewrite continues that convention verbatim (§ 2.4), with this specific note format
added to it.
