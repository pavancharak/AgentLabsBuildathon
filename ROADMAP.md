\# Parmana Roadmap

\*\*Version:\*\* 0.1.0

\*\*Status:\*\* Active

\---

\# Vision

Parmana is an \*\*Execution Trust Infrastructure\*\*.

Its mission is to establish a verifiable trust chain between:

\* Authority

\* Intent

\* Authorization

\* Execution

\* Evidence

\* Verification

The roadmap below defines the implementation order.

\---

\# Phase 1 — Core Foundation

\*\*Status:\*\* In Progress

\## Objectives

Build the immutable domain model.

\### Packages

\* @parmana/core

\### Deliverables

\* Value Objects

\* Domain Objects

\* ExecutionTransaction

\* Serialization

\* Unit Tests

\### Exit Criteria

\* 100% build success

\* Domain tests passing

\* Documentation complete

\---

\# Phase 2 — Runtime

\*\*Status:\*\* Planned

\## Objectives

Implement deterministic execution orchestration.

\### Packages

\* @parmana/runtime

\### Deliverables

\* Runtime

\* RuntimeBuilder

\* RuntimePipeline

\* RuntimeComponent

\* AuthorityStage

\* IntentStage

\* AuthorizationStage

\* ExecutionStage

\* EvidenceStage

\### Exit Criteria

\* Pipeline execution

\* Runtime tests

\* Stage tests

\---

\# Phase 3 — Verification

\*\*Status:\*\* Partially complete

\## Objectives

Implement independent execution verification.

\### Where it lives

Not a separate package. `packages/runtime/src/services/verification-service.ts`,
running on the live execution path. A separate `@parmana/verification`
six-stage pipeline package was scaffolded but never implemented or wired in,
and was retired in Session 5 — see docs/CLAIMS.md.

\### Delivered

\* Integrity verification (recomputed hash vs. stored hash)

\* Signature verification (delegates to @parmana/crypto)

\* Authorization-binding verification (APPROVED executions require an authorizationId)

\### Remaining

\* AuthorityVerifier / IntentVerifier / EvidenceVerifier — not implemented;

tracked as Future Claims in docs/CLAIMS.md, targeting verification-service.ts

\### Exit Criteria

\* Verification reports

\* Deterministic replay tests

\---

\# Phase 4 — Cryptography

\*\*Status:\*\* Partially complete (updated 2026-09-11 — this phase was still marked
"Planned" here despite being the most heavily built and audited part of the system;
see docs/VERIFICATION-GAPS.md and docs/CLAIMS.md 2.13/2.14/2.28/3.12 for the real,
current, evidence-backed state)

\## Objectives

Provide pluggable cryptographic services.

\### Packages

\* @parmana/crypto

\### Delivered

\* HashProvider / SignatureProvider / Provider Registry

\* SHA-256 Provider (SHA-3/BLAKE3 declared as valid config values, no real

implementation exists — see docs/CODEBASE-REFERENCE.md)

\* Ed25519 Provider (deterministic, RFC 8032)

\* Post-Quantum Provider: ML-DSA-65 / FIPS 204 (Dilithium3), native via Node

\>=24 / OpenSSL \>=3.5 `node:crypto` (ECDSA-P256, Dilithium5, SPHINCS+ remain

declared config values with no implementation)

\* Hybrid signing (CRYPTO\_MODE=hybrid): classical + post-quantum signed together,

both required for verification, fail-closed on a missing/corrupted/duplicated entry

\* KeyId-aware key resolution with expiry/revocation (EnvelopeVerifier /

ExecutionGateway path)

\* Standalone offline verification (packages/crypto/src/OfflineVerifier.ts and a

Python counterpart) — zero network/disk/env-var dependency, added 2026-09-11

after a same-day audit found no such capability existed in this repository

\* Public-key discovery (GET /keys/:keyId, GET /.well-known/jwks.json), added

2026-09-11 for the same reason

\* Durable-evidence (Trust Record / Refusal Record / Audit Event) signing-key

rotation via PARMANA\_VERIFICATION\_KEY\_ID, added 2026-09-11 — previously only

the ephemeral Authorization/Gateway envelope had this

\* Opt-in hybrid-signature-downgrade protection (HYBRID\_SIGNATURE\_REQUIRED),

added 2026-09-11

\### Remaining

\* KMS/HSM custody — KEY\_PROVIDER=aws-kms now has a real, sign-without-release

implementation (packages/crypto/src/providers/signer/KmsSigner.ts, via the new

Signer/SignerBootstrap abstraction — see ADR-0009,

docs/adr/ADR-0009-KMS-Secrets-And-Connector-Signature-Hardening.md, and also

"Secrets, Signing-Key Custody & Connector Signature Hardening" below).

azure-key-vault/gcp-kms/hsm still correctly fail closed rather than silently

falling back to file-based keys, with no implementation yet

\* @parmana/sign (the external, independently published, open-core primitives

package) does not yet recognize the hybrid `signatures`/`schemaVersion` envelope —

separate, external work, not something this repository's own build performs

\* **FIXED (2026-09-16), root cause found — not the error-handling gap it first looked
like.** `ExecutionGateway.execute()` throwing on `[signatureVerified,
businessTransactionHashMatches, nonceUnseen]` all false together (found 2026-09-15
via a real Pfinite refund request) traced back to one root cause, not three
independent failures: `businessTransactionHashMatches`/`nonceUnseen` both
short-circuit to `false` whenever `signatureVerified` is `false` (see
`ExecutionGateway.verify()`'s own `passed`/`priorChecksPassed` gating), so this was
always a single bug wearing three symptoms. That bug: `createExecutionGateway.ts`
passed `keyProvider: new FileKeyProvider()` to `ExecutionGateway` unconditionally,
regardless of `KEY_PROVIDER` — and `EnvelopeVerifier.resolveKey()` uses `keyProvider`
(when supplied at all) for **every** authorization it verifies, not only
tenant-scoped ones, contradicting this same file's own 2026-09-15 "KNOWN GAP" comment
that called this path "currently inert." Under `KEY_PROVIDER=aws-kms`, every
authorization was signed by the real KMS key (via `SignerBootstrap`) but verified
against a stale local `default.public.pem` left over from before the KMS migration
— signing and verification silently used different keys, so signature verification
failed on every real request. Fixed with `SignerKeyProviderAdapter`
(`packages/crypto/src/providers/SignerKeyProviderAdapter.ts`, new) adapting a
`Signer` to `KeyProvider`'s read-only surface (`getPrivateKey()` throws, matching
`KmsSigner`'s own "throws loudly rather than silently" precedent) so signing and
per-authorization verification now share the same resolved `Signer` and therefore
the same real key. Verified against live production traffic: a real Pfinite refund
request now passes every Gateway check and reaches actual connector execution — it
still gets an HTTP 500, but now from the separate `parmana-paytm-agent` connector
service itself (`PaytmConnector "paytm" request to the Paytm connector service
failed with HTTP 500`), not from this codebase. Traced via the shared
`execution_audit_events` table (both repos write to it) to Paytm's real API itself
returning a non-JSON 503 — expected, since no real Paytm merchant credentials are
configured in `parmana-paytm-agent` yet; external to both repositories.

**Full documentation of this entire migration:**
`docs/operations/aws-kms-vercel-oidc-setup-guide.md` (step-by-step setup for a new
developer/project) and `docs/operations/2026-09-15-kms-migration-troubleshooting-guide.md`
(narrative account of every bug found doing this the first time, root causes, fixes,
and a quick diagnostic checklist). Full technical postmortem for the two most
significant bugs (the signing/verification key divergence, and the rate-limiter
store-reuse crash) is `docs/VERIFICATION-GAPS.md` G-48 and G-49.

\---

\# Phase 5 — Storage

\*\*Status:\*\* Planned

\## Objectives

Persist immutable execution artifacts.

\### Packages

\* @parmana/storage

\### Deliverables

\* Repository Interfaces

\* Memory Storage

\* File Storage

\* Serialization

\---

\# Phase 6 — SDK

\*\*Status:\*\* Planned

\## Objectives

Developer-facing APIs.

\### Packages

\* @parmana/sdk

\### Deliverables

\* Builders

\* Client APIs

\* Utilities

\* Developer Experience

\---

\# Phase 7 — API

\*\*Status:\*\* Planned

\## Objectives

Expose Parmana over HTTP.

\### Packages

\* @parmana/api

\### Deliverables

\* REST API

\* Validation

\* Authentication

\* OpenAPI Specification

\---

\# Phase 8 — CLI

\*\*Status:\*\* Planned

\## Objectives

Developer and administrator tooling.

\### Packages

\* @parmana/cli

\### Deliverables

\* Execute

\* Verify

\* Replay

\* Inspect

\* Export

\---

\# Phase 9 — Enterprise

\*\*Status:\*\* Future

\## Planned Capabilities

\* Policy Engine

\* Human Approval (see "Policy Governance — Future Work" at the end of this document for the maker-checker feature already built, and the further work considered but not yet built)

\* Multi-Tenant Runtime

\* Compliance Packs

\* Audit Dashboard

\* Enterprise Storage

\* Observability

\* HA Deployment

\---

\# Phase 10 — Ecosystem

\*\*Status:\*\* Future

\## Planned Deliverables

\* VS Code Extension

\* Terraform Provider

\* Kubernetes Operator

\* Language SDKs

\* Cloud Integrations

\* Marketplace Integrations

\---

\# Definition of Done

A phase is complete when:

\* Implementation is complete.

\* Tests pass.

\* Documentation is updated.

\* Conformance requirements are satisfied.

\* ADRs are updated if required.

\---

\# Guiding Principle

Implementation follows Architecture.

Architecture follows Execution Trust.

Execution Trust remains the primary design objective for every phase of the Parmana platform.

---

## Policy Governance — Future Work (Not Yet Built)

Candidate future work for the maker-checker Policy Governance feature (see `docs/CLAIMS.md` §2.26 for what is built and proven today). None of the items below are committed, scheduled, or in progress — this section records considered-but-deferred ideas, not a plan.

### Three-role flow (Maker → Reviewer → Approver)

**Problem it would solve:** the current model is two roles (maker, checker); a stakes-gated third role (an intermediate Reviewer) would let higher-risk policy changes require broader sign-off than a single checker, without forcing that overhead onto every change.
**Why not built:** not required at current stage/scale — the existing single-checker maker≠checker model (`SameActorCannotApproveOwnChangeError`, `packages/api/src/routes/pending-policy-changes.ts`) already closes the gap this feature exists to close. Would need product decisions (which changes are "high-stakes," how a Reviewer's authority differs from an Approver's) before implementation makes sense.

### Freeze/escalation on repeated non-human-caller attempts

**Problem it would solve:** today, a denied non-human-caller attempt on a governance endpoint is logged (`caller.non_human_denied`, fail-closed — `requireHumanCaller()` in `pending-policy-changes.ts`) but has no consequence beyond that single request being denied; repeated attempts from the same caller produce repeated log entries, not an escalating response.
**Why not built:** no automated response to a pattern of denied attempts exists yet. Would require deciding what "freeze" means operationally (freeze the caller's credential? the specific policy? notify a human?) and isn't urgent while attempt volume is low enough for a human to review the audit log directly.

### WORM/immutable storage for approved policy content and approval records

**Problem it would solve:** `policy_change_approval_records` (`supabase/migrations/20260818120000_add_policy_governance_tables.sql`) is an ordinary Postgres table under RLS — application code never issues `UPDATE`/`DELETE` against it, but nothing at the storage layer prevents a sufficiently privileged operator (e.g. via `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS) from doing so. True write-once/read-many storage, or an external anchor (e.g. a hash notarized outside the database), would remove that operator-trust requirement.
**Why not built:** the current signed-record model already gives tamper _detection_ — the deploy/startup integrity check (`verifyPolicyGovernanceIntegrityAtStartup.ts`) and the CI gate (`scripts/verify-policy-changes-approved.ts`) both compare live content against the record's signed hash — even without tamper _prevention_. Genuine WORM/immutability is a larger infrastructure decision (which storage layer, what the anchor is) not yet made.

### Tiered approval: mobile biometric approval + enforced diff-review UX + two-person approval for high-stakes changes

**Problem it would solve:** the current step-up mechanism is a single signed envelope from a key the checker holds on a device with no AI agent access (see CLAIMS.md §2.26's open questions). A tiered model would let low-stakes changes use lighter-weight approval while reserving stronger guarantees (biometric-bound approval, mandatory diff review, two independent human approvers) for changes judged high-stakes.
**Why not built:** depends on defining "high-stakes" for a policy change, and on the open question below — building a tiered mobile-approval UX for Parmana-internal governance is premature if the eventual answer is that policy authoring moves external to Parmana entirely.

### Open question this future work depends on: Parmana-internal vs. external policy authoring

Several items above (three-role flow, tiered approval, WORM storage for approval records specifically) only make sense to build if Parmana's own maker-checker system remains the system of record for policy approval. The alternative — policies authored and approved in an external system, with Parmana staying read-only/enforcement-only for policy content — would make some of this work unnecessary and reshape the rest (verifying an external approval's provenance, rather than producing one). This is a genuinely open design question (see `docs/CLAIMS.md` §2.26) that should be resolved before investing further in any of the above.

---

## Secrets, Signing-Key Custody & Connector Signature Hardening — Future Work (Partially Built)

Found by a 2026-09-13 code-level audit (reading `process.env` call sites and the actual connector wire protocol across both this repo and the separate `parmana-paytm-agent` repo, not documentation). Full accepted design in `docs/adr/ADR-0009-KMS-Secrets-And-Connector-Signature-Hardening.md`. **Update (2026-09-15): two of the four items below are now built** (gateway signing key → AWS KMS; Paytm wire-protocol signature verification) — see each section. The remaining two (connector secrets → Secrets Manager; GitHub App elimination) are still accepted design only, nothing committed or scheduled.

### Gateway signing key → AWS KMS (sign-without-release) — DONE (2026-09-15)

**Problem it solved:** `PARMANA_KEY_MATERIAL_JSON` / `./keys/*.private.pem` put the Ed25519 private key that signs every Execution Authorization, Trust Record, Refusal Record, and Attestation directly on disk or in the environment. Anything with the process's filesystem access can read it and forge records for actions Parmana's policy engine never approved.
**Status:** built. All seven call sites (`packages/crypto/src/VerificationCrypto.ts`, `RefusalCrypto.ts`, `AuditEventCrypto.ts`, `ReceiptCrypto.ts`, `PolicyChangeCrypto.ts`, `ExecutionChainCrypto.ts`, `packages/runtime/src/RuntimeAuthorizationSigner.ts`) plus `packages/api/src/routes/keys.ts` resolve signing/verification through `SignerBootstrap.create()`, which returns a real `KmsSigner` (`packages/crypto/src/providers/signer/KmsSigner.ts`) when `KEY_PROVIDER=aws-kms`. Fixed 2026-09-15: `KmsSigner` was passing the logical keyId (e.g. `"default"`) straight through as AWS KMS's `KeyId` parameter, an invalid format; it now maps `keyId` → `alias/<keyId>`, passing an already-qualified alias/ARN/raw key ID through unchanged. Verified end-to-end against a real AWS KMS key (`ECC_NIST_EDWARDS25519`/`ED25519_SHA_512`) under a least-privilege IAM identity scoped to that one key.
**Update (2026-09-15, later same day):** the Vercel→AWS OIDC IAM role is now built. IAM OIDC identity provider trusting `https://oidc.vercel.com/pavan-dev-singh-charaks-projects` (Team issuer mode), IAM role `arn:aws:iam::013659367671:role/parmana-vercel-kms-signer` with a trust policy scoped to `owner:pavan-dev-singh-charaks-projects:project:parmana-api-real:environment:production` (production only — preview/development are not trusted), and a least-privilege policy (`kms:Sign`/`kms:GetPublicKey`/`kms:DescribeKey` on exactly the one gateway key ARN, no key-management actions — a narrower policy than the local-admin `parmana-kms-operator` user has). `@vercel/oidc-aws-credentials-provider` is already a declared dependency (`packages/api`, `packages/crypto`).
**Update (2026-09-15, later same day): live in production, verified end-to-end.** `AWS_ROLE_ARN`/`AWS_REGION=ap-south-1`/`KEY_PROVIDER=aws-kms` are set on the live Vercel project (`parmana-api-real`), and `AssumeRoleWithWebIdentity` via Vercel's OIDC token is confirmed working against a real deployment (`GET /keys/default` returns a real KMS-backed public key, `POST /execute` reaches business logic). Getting there surfaced three more real gaps than the ones already listed above, none visible from code review alone:

- `createGatewayPublicKey()` (`packages/api/src/bootstrap/createGatewayPublicKey.ts`) read a local file unconditionally regardless of `KEY_PROVIDER` — outside ADR-0009's original seven-call-site audit. Fixed to resolve through `SignerBootstrap`, which required making the whole `createExecutionSystem()` chain async (~20 call sites across `server.ts`, `api/index.ts`, tests, and tutorials updated to `await` it).
- Vercel Functions cannot obtain the OIDC token at module-load/cold-start time, only during actual request handling (`@vercel/oidc`'s own documented constraint) — `api/index.ts` had to be restructured to lazily build the app on the first real request instead of eagerly at module top level.
- `assertSigningKeyMaterialConfigured()`'s early-return for `KEY_PROVIDER=aws-kms` also skipped materializing the _separate_ "gateway" attestation key (`createGatewayKeyPair.ts`, DEFAULT_GATEWAY_KEY_ID="gateway") — never meant to move to KMS at all. Fixed to only skip the "default" key's local-file check, not materialization of other keys `PARMANA_KEY_MATERIAL_JSON` carries.

Also found and fixed the same day, surfaced by the same production testing (unrelated to KMS): `express-rate-limit` v8's `ERR_ERL_STORE_REUSE` — `createApp()` was passing one shared `PostgresRateLimitStore` instance to both the `/execute` and `/health`,`/ready` limiters, which the library's own documented contract disallows. **Correction:** this validation only logs the violation (`console.error`) rather than throwing — verified directly against the installed library's source — so it was not, as first assumed, the direct cause of the 500s observed that night (those traced to the signing/verification key divergence below); still a real contract violation worth fixing regardless. Fixed with per-limiter store instances (`RateLimitOption.executeStore`/`healthStore`, replacing the single `store` field) and prefix-based key namespacing (`PostgresRateLimitStore`'s new `prefix` parameter, matching `express-rate-limit`'s own documented `Store.prefix` contract). See `docs/VERIFICATION-GAPS.md` G-49 and `examples/tutorials/115-per-limiter-rate-limit-stores/` for the full corrected account.

**Still not done:** deleting `PARMANA_KEY_MATERIAL_JSON` from Vercel/`.env` (ADR-0009 step 4) — explicitly a last step, only after everything above has been live and verified for a while, not rushed the same day.

### Opaque connector secrets → AWS Secrets Manager

**Problem it would solve:** `HUBSPOT_PRIVATE_APP_TOKEN`, `PAYTM_CONNECTOR_SHARED_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` are static, unrotated `process.env` reads with no managed lifecycle.
**Why not built:** needs a new `SecretsProvider` abstraction (`packages/shared/src/config/SecretsProvider.ts`, not yet created) and AWS access wired via Vercel's OIDC federation (`@vercel/oidc-aws-credentials-provider`, confirmed first-party) rather than static AWS keys — not yet provisioned.

### GitHub App credential → eliminated via Vercel Connect

**Problem it would solve:** `GITHUB_APP_PRIVATE_KEY` is a static master key in `.env`; only the installation token it mints is actually ephemeral.
**Why not built:** requires registering a Vercel Connect GitHub connector (an interactive, browser-based install/consent step) and replacing `createGitHubCredentialProvider.ts`'s production branch — not yet done.

### Paytm connector wire protocol → add signature verification — DONE

**Problem it solved:** traced `GatewayPaytmAdapter.ts` against `parmana-paytm-agent`'s `executeAuthorizedConnectorRequest` (`src/server/handler.ts`) and found the `authorization.payload` sent over the wire is unsigned JSON — the receiving service only checked a bearer shared secret and string-matched `businessTransactionId`. Whoever holds `PAYTM_CONNECTOR_SHARED_SECRET` could call `POST /connector/paytm-refund` directly with self-chosen parameters, skipping Parmana's policy engine entirely.
**Status:** built, across both repositories. `GatewayPaytmAdapter.ts` signs the canonical payload via `SignerBootstrap`/`Signer.sign()` and includes `signature`/`keyId` in the outbound request; `parmana-paytm-agent`'s `executeAuthorizedConnectorRequest` fetches Parmana's public key via `GET /keys/:keyId` and verifies it before calling Paytm (see `docs/CLAIMS.md` §3.22's "ADR-0009 Phase 2B" reference). This is additive to the existing bearer-secret check, not a replacement.

### Open question this future work depends on

Which secrets backend to provision first is a real cost/vendor decision (AWS KMS + Secrets Manager vs. an alternative), not yet made by whoever owns the AWS account this would run under. See ADR-0009's "Open Decisions" for the full list (branch strategy across the two repos, AWS region, whether `parmana-paytm-agent` separately adopts managed secrets for its own credentials).
