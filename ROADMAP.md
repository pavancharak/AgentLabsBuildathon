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



\* KMS/HSM custody — KEY\_PROVIDER correctly fails closed for aws-kms/azure-key-vault/

  gcp-kms/hsm rather than silently falling back to file-based keys, but no real

  implementation of any of them exists yet. Accepted target design for the

  aws-kms case: ADR-0009 (docs/adr/ADR-0009-KMS-Secrets-And-Connector-Signature-Hardening.md),

  see also "Secrets, Signing-Key Custody & Connector Signature Hardening" below

\* @parmana/sign (the external, independently published, open-core primitives

  package) does not yet recognize the hybrid `signatures`/`schemaVersion` envelope —

  separate, external work, not something this repository's own build performs



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
**Why not built:** the current signed-record model already gives tamper *detection* — the deploy/startup integrity check (`verifyPolicyGovernanceIntegrityAtStartup.ts`) and the CI gate (`scripts/verify-policy-changes-approved.ts`) both compare live content against the record's signed hash — even without tamper *prevention*. Genuine WORM/immutability is a larger infrastructure decision (which storage layer, what the anchor is) not yet made.

### Tiered approval: mobile biometric approval + enforced diff-review UX + two-person approval for high-stakes changes
**Problem it would solve:** the current step-up mechanism is a single signed envelope from a key the checker holds on a device with no AI agent access (see CLAIMS.md §2.26's open questions). A tiered model would let low-stakes changes use lighter-weight approval while reserving stronger guarantees (biometric-bound approval, mandatory diff review, two independent human approvers) for changes judged high-stakes.
**Why not built:** depends on defining "high-stakes" for a policy change, and on the open question below — building a tiered mobile-approval UX for Parmana-internal governance is premature if the eventual answer is that policy authoring moves external to Parmana entirely.

### Open question this future work depends on: Parmana-internal vs. external policy authoring
Several items above (three-role flow, tiered approval, WORM storage for approval records specifically) only make sense to build if Parmana's own maker-checker system remains the system of record for policy approval. The alternative — policies authored and approved in an external system, with Parmana staying read-only/enforcement-only for policy content — would make some of this work unnecessary and reshape the rest (verifying an external approval's provenance, rather than producing one). This is a genuinely open design question (see `docs/CLAIMS.md` §2.26) that should be resolved before investing further in any of the above.

---

## Secrets, Signing-Key Custody & Connector Signature Hardening — Future Work (Not Yet Built)

Found by a 2026-09-13 code-level audit (reading `process.env` call sites and the actual connector wire protocol across both this repo and the separate `parmana-paytm-agent` repo, not documentation). Full accepted design in `docs/adr/ADR-0009-KMS-Secrets-And-Connector-Signature-Hardening.md`. Nothing below is committed, scheduled, or in progress — this section records the accepted target design, not a plan with dates.

### Gateway signing key → AWS KMS (sign-without-release)
**Problem it would solve:** `PARMANA_KEY_MATERIAL_JSON` / `./keys/*.private.pem` put the Ed25519 private key that signs every Execution Authorization, Trust Record, Refusal Record, and Attestation directly on disk or in the environment. Anything with the process's filesystem access can read it and forge records for actions Parmana's policy engine never approved.
**Why not built:** requires a real refactor, not a config change — AWS KMS never exports private key material, so the seven call sites that currently do `KeyProvider.getPrivateKey()` + local `crypto.sign()` (`packages/crypto/src/VerificationCrypto.ts`, `RefusalCrypto.ts`, `AuditEventCrypto.ts`, `ReceiptCrypto.ts`, `PolicyChangeCrypto.ts`, `ExecutionChainCrypto.ts`, `packages/runtime/src/RuntimeAuthorizationSigner.ts`) need a new `sign(keyId, data)` abstraction instead of a `KeyObject`. AWS KMS added Ed25519 support in November 2025, so this needs no signature-algorithm migration once built.

### Opaque connector secrets → AWS Secrets Manager
**Problem it would solve:** `HUBSPOT_PRIVATE_APP_TOKEN`, `PAYTM_CONNECTOR_SHARED_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` are static, unrotated `process.env` reads with no managed lifecycle.
**Why not built:** needs a new `SecretsProvider` abstraction (`packages/shared/src/config/SecretsProvider.ts`, not yet created) and AWS access wired via Vercel's OIDC federation (`@vercel/oidc-aws-credentials-provider`, confirmed first-party) rather than static AWS keys — not yet provisioned.

### GitHub App credential → eliminated via Vercel Connect
**Problem it would solve:** `GITHUB_APP_PRIVATE_KEY` is a static master key in `.env`; only the installation token it mints is actually ephemeral.
**Why not built:** requires registering a Vercel Connect GitHub connector (an interactive, browser-based install/consent step) and replacing `createGitHubCredentialProvider.ts`'s production branch — not yet done.

### Paytm connector wire protocol → add signature verification
**Problem it would solve:** traced `GatewayPaytmAdapter.ts` against `parmana-paytm-agent`'s `executeAuthorizedConnectorRequest` (`src/server/handler.ts`) and found the `authorization.payload` sent over the wire is unsigned JSON — the receiving service only checks a bearer shared secret and string-matches `businessTransactionId`. Whoever holds `PAYTM_CONNECTOR_SHARED_SECRET` can call `POST /connector/paytm-refund` directly with self-chosen parameters, skipping Parmana's policy engine entirely.
**Why not built:** this is the deepest item — it requires a coordinated change across two independently deployed repositories (Parmana signs a canonical payload with the gateway key; `parmana-paytm-agent` fetches Parmana's public key via the existing `GET /keys/:keyId` and verifies it before executing), not yet scheduled.

### Open question this future work depends on
Which secrets backend to provision first is a real cost/vendor decision (AWS KMS + Secrets Manager vs. an alternative), not yet made by whoever owns the AWS account this would run under. See ADR-0009's "Open Decisions" for the full list (branch strategy across the two repos, AWS region, whether `parmana-paytm-agent` separately adopts managed secrets for its own credentials).


