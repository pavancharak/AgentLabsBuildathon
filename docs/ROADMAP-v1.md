# Parmana Roadmap to v1.0 (DRAFT)

Status: **Draft, for review.** Not canonical until approved.
Audited against commit `c282b8d` (2026-07-13).
Companion to `docs/CLAIMS.md` and `docs/VERIFICATION-GAPS.md`. This document does not
duplicate their findings; it cross-references them by gap number (G-N) and decision number
(D-N) and adds only what those two files do not already cover.

Target for "production-ready" in this document: **a shadow pilot at a regulated financial
institution** (their security review, their environment, one connector, verifiable records).
Not planet-scale, not multi-tenant SaaS, not every connector on the roadmap. Every priority
call below is made against that specific bar.

---

## Phase 0: Baseline verification

Run before any audit work, so the audit itself rests on a verified baseline rather than trust
in this document's own claims.

| Check                   | Result                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git status`            | Clean. Branch `main`, one local commit ahead of `origin/main` at time of audit.                                                                                                                                                                                                                                                                     |
| `git log --oneline -15` | Most recent work: a test-alignment commit (`c282b8d`), an execution-system rename (`850e7ab`, see below), a runtime refactor separating business trust from execution trust building (`7c0f186`), a docs restructuring (`5a2b4d1`), and the credential-isolation feature landing (`651497a`). No surprises; consistent with recent session history. |
| `npm run rebuild`       | Clean, no errors.                                                                                                                                                                                                                                                                                                                                   |
| `npx tsc -b`            | Exit 0. Whole workspace type-checks.                                                                                                                                                                                                                                                                                                                |
| `npm test`              | **345 passed, 1 skipped, 84 test files.** Green.                                                                                                                                                                                                                                                                                                    |

**ExecutionTrustRecord to ExecutionTrustAttestation rename: NOT complete, and arguably not a
rename at all.** Commit `850e7ab` ("rename execution trust record to execution trust
attestation") only touched `packages/execution-system` (`ExecutionTrustAttestationBuilder.ts`,
`models/ExecutionTrustAttestation.ts`, `index.ts`) and `packages/receipt`. It did **not** touch
the actual canonical domain model, `packages/shared/src/domain/execution-trust-record.ts`,
which remains named `ExecutionTrustRecord` and is the type constructed by
`packages/runtime/src/BusinessTrustRecordBuilder.ts` and referenced across roughly 30 files in
`runtime`, `storage`, and `api`. The two types have **different shapes** (`ExecutionTrustRecord`
is an aggregate with `transaction`, `overrides`, `executions`, `verifications`, `receipts`,
`trustRecordHash`, `signature`; `ExecutionTrustAttestation` is a small signed envelope with
`artifactHash`, `signatures`, `gatewayId`, `policyVersion`, `timestamp`) and the
"attestation" one is **never instantiated anywhere in the repository** (`grep -rn "new
ExecutionTrustAttestationBuilder("` returns zero results, including in tests). So the commit
message describes a rename that did not happen to the real model; what it actually did was
rename a small, already-orphaned type inside an already-orphaned package chain (see D4 and O1
below). This is not a blocking defect (nothing production-facing references
`ExecutionTrustAttestation`), but the commit message is misleading about what changed, and the
naming collision between the two types is a genuine readability hazard for anyone new to the
codebase. Flagged as **G-15** below.

Baseline is green. Proceeding with the audit.

---

## 1. Unfinished components (verified, not assumed)

Each of the following was named as a known item going into this audit. All seven are confirmed
still true, with fresh evidence as of `c282b8d`, not carried over from memory.

### 1.1 `@parmana/receipt` package is orphaned

Zero production dependents. `grep "@parmana/receipt"` across every `package.json` in the
workspace returns only `packages/receipt/package.json` itself; across source and tests it
returns only the package's own files plus three tutorials (54, 55, 56). Neither `packages/api`
nor `packages/runtime` depends on it. The receipt actually produced in production
(`packages/runtime/src/services/receipt-service.ts`, type `Receipt` from `@parmana/shared`) is
a different, unrelated shape from the package's own `ExecutionReceipt` model. See D4, D5, O1.

### 1.2 `ExecutionPermit` model has no production caller

`ExecutionPermitBuilder` (`packages/execution-control/src/ExecutionPermitBuilder.ts`) is
exported from `execution-control`'s index but `grep -rn "new ExecutionPermitBuilder("` across
the repository returns zero results. Its only consumer is the equally-orphaned
`ExecutionReceiptBuilder` in the dead `@parmana/receipt` package (1.1).

### 1.3 `POST /execute` malformed body returns an unhandled 500

Confirmed with exact evidence, not previously documented anywhere (including
`VERIFICATION-GAPS.md`). `packages/api/src/routes/execute.ts:47-57` validates only
`businessTransactionId` (a UUID regex). Every other field (`metadata`, `authority`,
`authorization`, `intent`, `policy`) passes unchecked through
`BusinessTransactionMapper.fromRequest` (explicitly documented in that file as
"structural mapping only, no validation"). Real validation lives in
`packages/runtime/src/validators/BusinessTransactionValidator.ts`, which directly dereferences
nested properties (`transaction.metadata.businessTransactionId`,
`transaction.authority.authorityId`, `transaction.policy.name.trim()`, and five more). Omit any
of `metadata`/`authority`/`authorization`/`intent`/`policy` from the request body and one of
these throws a raw `TypeError`, not a `BusinessTransactionValidationError`.
`packages/api/src/middleware/error-handler.ts` only special-cases five specific error classes;
a bare `TypeError` falls through to the generic branch: `console.error` plus a 500. No test
exercises this path (`execution-failure.integration.test.ts` is `describe.skip`ped and tests a
different scenario entirely). **This is exactly the kind of input a security review's first
hour of fuzzing finds.** New gap: **G-12**.

### 1.4 Hybrid/PQ configuration is dead, and the dead chain is larger than previously documented

`VERIFICATION-GAPS.md` G-4 already documents that `CRYPTO_MODE` is read into config but never
consulted anywhere else, and that all three production signing call sites hardcode
`CryptoBootstrap.create()` (single-provider) rather than `createHybrid()`. This audit confirms
that finding and extends it: `CryptoBootstrap.createHybrid()` itself has **zero callers**
anywhere in the repository. The only two classes that would ever call it,
`ExecutionTrustAttestationBuilder` (execution-system) and `ExecutionPermitBuilder`
(execution-control), are themselves never instantiated (1.1, 1.2). So the dead chain is not
just "one env var with no effect," it is: `CRYPTO_MODE` to `createHybrid()` to `HybridSigner`
to `ExecutionTrustAttestationBuilder`/`ExecutionPermitBuilder` to `ExecutionReceiptBuilder` to
`@parmana/receipt`, an entire unwired subsystem, five packages deep. Extends **G-4**.

### 1.5 Dead bootstrap files: `ConnectorFactory` and `ExecutionControlComposition`

Both exist under `packages/api/src/bootstrap/`. `ConnectorFactory.createAll()` is a stub
returning `[]`. `ExecutionControlComposition.ts` is a full, working composition root, but
nothing imports it outside `ConnectorFactory.ts` itself, and nothing imports
`ConnectorFactory`. The actual production wiring is a separate, parallel implementation,
`packages/api/src/bootstrap/createExecutionControl.ts`, built from individual `create*.ts`
helpers. Two composition roots exist for the same responsibility; only one is real. (Note:
`packages/connector-sdk/src/ConnectorFactory.ts` is a same-named but unrelated, actively-used
class. Do not conflate the two when acting on this finding.) New gap: **G-13**.

### 1.6 Runtime has no Clock injection seam

Zero references to any `Clock` type in `packages/runtime/src` (confirmed by grep). Eight files
construct timestamps that end up in immutable records via direct `new Date()` calls:
`BusinessTrustRecordBuilder.ts:39`, `DecisionBuilder.ts:66`, `ExecutionBuilder.ts:48`,
`services/DecisionService.ts:41`, `services/verification-service.ts:70`,
`services/override-service.ts:79`, `services/execution-service.ts:69,113,134`,
`services/receipt-service.ts:102`. Contrast with `packages/execution-control`, which has a
proper `Clock` interface with a `SystemClock` implementation, constructor-injected into
`GatewayAttestation.ts`, `SessionCredentialVault.ts`, and `SessionCredentialSecureConnector.ts`
and wired that way in production (`createExecutionControl.ts`). `execution-gateway` sits in
between: no `Clock` interface, but at least a `now: Date = new Date()` default-parameter
pattern that permits test override, unlike runtime's hardcoded calls. New gap: **G-14**.

### 1.7 Legacy docs tree and `GOVERNANCE.md` are stale, not just "older"

`docs/00-introduction`, `docs/01-concepts`, `docs/02-architecture`, and `docs/03-api` were all
created in a single commit on 2026-07-03 and have never been touched since, despite the
architecture they describe changing materially afterward (the crypto provider refactor, the
runtime trust-pipeline split in `7c0f186`). `docs/rfcs` (25 files, only 3 commits ever) shows
internal disorganization on top of staleness: duplicate RFC numbers (`RFC-0007`, `RFC-0008`
x3, `RFC-0009` x2, `RFC-0010` x2), consistent with an uncurated set of superseded drafts.
`GOVERNANCE.md` has had exactly 2 commits, the last on 2026-06-27, effectively frozen since
the repository's first week. `docs/site` (the Mintlify site) is the only docs tree with commits
as recent as the current HEAD. This was already flagged as deferred, out of scope, in
`VERIFICATION-GAPS.md`; this audit adds the evidence for _why_ it should stay deferred-and-
flagged rather than deferred-and-forgotten: anyone citing the legacy tree as authoritative
today would be citing pre-refactor architecture.

---

## 2. Duplicate implementations

### D1. The "secure connector release" concept is implemented three times

- **(a) `packages/execution-control`** (`InMemoryConnectorRegistry`, `SecureConnector`,
  `GatewayExecutionRequest`): the production path. Consumed by `ExecutionControlService`,
  `packages/api/src/bootstrap/ExecutionControlComposition.ts` (dead, see 1.5, but same types),
  and `createExecutionGateway.ts`.
- **(b) `packages/connector-sdk`** (`ConnectorSdkRegistry`): clean composition, not a
  duplicate. It wraps an internal `InMemoryConnectorRegistry` and delegates `get()` verbatim,
  adding authoring ergonomics on top (metadata, versioning, executor wiring). No action needed.
- **(c) `packages/execution-gateway/src/connector-runtime/*`** (7 files, 380 lines): a fully
  independent, structurally different reimplementation under the _same names_ as (a)
  (`ConnectorIdentity`, `SecureConnector`, `ConnectorRegistry`, `ExecutionAuditSink`,
  `ConnectorPolicy`) but different shapes (`invoke()` instead of `execute()`, different
  identity fields). Its **only** consumer anywhere in the repository is
  `packages/execution-gateway/tests/unit/execution-control.test.ts`, which exercises the
  `@deprecated channel`/`gatewayIdentity` fields on `ExecutionGatewayOptions`. No tutorial,
  example, or production bootstrap file references it.

Two unrelated classes are both literally named `CapabilityConnectorPolicy` (one in
`connector-sdk`, actively used; one in the dead `connector-runtime`, not), which is its own
small hazard independent of the larger duplication.

### D2. `channel`/`gatewayIdentity` (legacy) vs `service`/`gatewayAuthentication` (modern) on `ExecutionGatewayOptions`

Both live on the same interface, one marked `@deprecated` in a doc comment. Production
bootstrap (`createExecutionGateway.ts`) only ever sets `service`/`gatewayAuthentication`. The
`channel` path's only caller is the same test file as D1(c).

### D3. Direct `connector` option vs `executionControl.service` on `ExecutionGatewayOptions`

Unlike D1/D2, this one is not fully dead: it is used deliberately in
`examples/04-verified-execution/run.ts` and, notably, in
`examples/tutorials/60-end-to-end-enterprise-execution/run.ts`, which explicitly contrasts a
"preview" gateway built the simple way against a "production" gateway built via
`executionControl.service` in the same file. Production bootstrap never uses it. Read as
intentional public "simple mode" API for newcomers, demonstrated as superseded by the same
tutorial that uses it, rather than dead code.

### D4. `ExecutionTrustRecord` (shared, live) vs `ExecutionTrustAttestation` (execution-system, orphaned)

Covered in Phase 0 above. Different shapes, different purposes on paper (aggregate record vs.
signed envelope), but the naming collision plus the fact that the "attestation" side is never
instantiated makes this read as an incomplete migration rather than two deliberately distinct
concepts.

### D5. Three parallel `Receipt` models

1. `packages/shared/src/domain/receipt.ts` (`Receipt`): live, produced by
   `packages/runtime/src/services/receipt-service.ts`, the real production path.
2. `packages/receipt/src/ReceiptEngine.ts` (a second, differently-shaped `Receipt`): zero call
   sites outside its own package. Dead.
3. `packages/receipt/src/models/ExecutionReceipt.ts` (wraps the orphaned
   `ExecutionTrustAttestation` and `ExecutionPermit`): constructed only inside tutorials 54-56.
   Dead in production.

---

## 3. Obsolete classes, files, and packages

### O1. `@parmana/receipt` package

Confirmed orphaned (1.1). Depends on two other orphaned classes (`ExecutionTrustAttestationBuilder`,
`ExecutionPermitBuilder`). Its only reason to exist today is to be demonstrated by three
tutorials that could equally demonstrate the real `ReceiptService`.

### O2. `ExecutionTrustAttestationBuilder`

Exported, never instantiated anywhere, including in its own package's tests (1.4, D4).

### O3. `@parmana/replay` — NOT obsolete, a wiring gap

Different in kind from the others: this is a substantial, real implementation (14 source
files: `ReplayEngine`, `ReplayExecutor`, `ReplayPipeline`, `ReplayVerifier`, etc.), not dead
code. But it has exactly one consumer repository-wide, tutorial 06, and is not a dependency of
`packages/api` or `packages/runtime`. `CLAIMS.md` claim 2.7 ("Replay Support") is true in the
narrow sense that the package is tested, but there is no `/replay` HTTP route and no wiring
into the runtime pipeline. Given that "verifiable records" is explicitly part of this
project's shadow-pilot success criteria, this is worth resolving deliberately rather than
leaving as an accidental gap. See section 7.

### O4. `examples/archive/` — 90 directories, 2 files, zero references

`find examples/archive -type f` returns exactly two files
(`32-multi-step-execution/transaction.json`, `32-runtime-pipeline/run.ts`); the other 88
directories are empty. Nothing in the repository (no README, no npm script, no docs page)
references the directory. The low-numbered dirs (19, 23-29, 32, 43) overlap with topics now
covered by the real, complete `examples/tutorials/1-60` sequence; the high-numbered dirs
(97-126ish: load-test scale scenarios, industry-vertical demos, agent-framework integrations)
have no counterpart anywhere else in the repo and read as an unexecuted content backlog rather
than abandoned work.

### O5. `packages/execution-gateway/src/connector-runtime/*`

Same finding as D1(c), restated here because it also qualifies as obsolete on its own terms:
380 lines, one test file as its only consumer, tied to the deprecated `channel` field (D2).

### O6. Direct `connector` field on `ExecutionGatewayOptions`

Same finding as D3, restated here: not dead, but zero production bootstrap usage, load-bearing
only for two example/tutorial files.

### O7. Trademark symbols remaining in code and docs

Not part of the original known-items list, found during this audit while checking the locked
architecture principle "no trademark symbols anywhere in code or docs." Five files still carry
"™" after two symbols (`Execution Permit`, `Execution Trust Record`, `Execution Receipt`,
`Execution Trust`, `Complete Execution Flow`, `Execution Receipt Verifier`,
`Execution Receipt Verification`): `README.md` (3 instances, all under the heading
"Execution Trust Record™"), and `examples/tutorials/53-execution-permit/README.md`,
`54-execution-receipt/README.md`, `55-execution-receipt-verification/README.md`,
`56-complete-execution-flow/README.md` (the bulk of the instances, roughly 50 across the four
files). New gap: **G-17**.

### O8. Stray "Execution Governance" outside the already-deferred legacy tree

`docs/specifications/reference-policies.md:235` lists "Execution Governance" as one of four
example values for a policy schema's `category` field (alongside "Execution Authorization,"
"Deployment Governance," "Access Governance"). This file is not part of the previously
identified and deferred legacy tree (`docs/00-introduction`, `docs/rfcs`, `docs/01-03`,
`docs/adr`), so it was not caught by the terminology sweep that covered `README.md`,
`docs/site`, and the tutorial READMEs. New gap: **G-18**.

---

## 4. Technical debt, cross-referenced against VERIFICATION-GAPS.md and CLAIMS.md

This section exists so the audit and the published gap register stay one list. Items already
tracked in `VERIFICATION-GAPS.md` are referenced, not restated in full; only new information
is added. New gaps introduced by this audit are numbered continuing from **G-11** (the last
number in the current `VERIFICATION-GAPS.md`).

**Already tracked, this audit adds no new information beyond confirming still-current:**
G-1 (duplicate transaction race, blocks-pilot), G-2 (no CI, blocks-pilot), G-3 (live Supabase
credentials in tests, blocks-pilot), G-6 (receipt package untested, pre-production), G-7
(execution-failure test permanently skipped, pre-production), G-8 (untested error branches,
pre-production), G-9 (duplicate audit logging, pre-production), G-10 (vague CLAIMS.md
citations, cosmetic), G-11 (undocumented env vars, cosmetic).

**Already tracked, this audit extends with new evidence:**

- **G-4** (hybrid/PQ dead config): extended per 1.4. The dead chain is five packages deep, not
  one env var. This changes the calculus on D-2's two options: Option B (document as
  single-provider, remove `CRYPTO_MODE`) now also implies either deleting or explicitly
  archiving the orphaned `ExecutionTrustAttestationBuilder`/`ExecutionPermitBuilder`/
  `ExecutionReceiptBuilder`/`@parmana/receipt` chain, not just the config variable. See section
  6 for a merged recommendation.

**New gaps from this audit:**

| Gap      | Severity                                         | Summary                                                                                                                                                                                                                                                                                                                                                                    | Source      |
| -------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **G-12** | blocks-pilot                                     | `POST /execute` with a malformed/incomplete body throws an unhandled `TypeError`, surfaced as an opaque 500, not a clean 400. Zero test coverage.                                                                                                                                                                                                                          | 1.3         |
| **G-13** | pre-production                                   | Two composition roots for Execution Control exist (`ExecutionControlComposition`/`ConnectorFactory`, dead, vs. `createExecutionControl.ts`, real). Reading the wrong one as source of truth risks real confusion for new contributors or auditors.                                                                                                                         | 1.5         |
| **G-14** | pre-production                                   | `packages/runtime` has no Clock injection seam; 8 files call `new Date()` directly for timestamps embedded in immutable trust/decision/execution/receipt records, undermining deterministic replay testing and requiring global `Date` mocking in tests instead of DI.                                                                                                     | 1.6         |
| **G-15** | pre-production                                   | The `ExecutionTrustRecord`/`ExecutionTrustAttestation` naming collision (Phase 0, D4) is a readability and onboarding hazard: two types with the words "Execution Trust" in their name, only one of which is real, and the commit that introduced the second one described it as a rename of the first.                                                                    | Phase 0, D4 |
| **G-16** | cosmetic                                         | `examples/archive/` (90 directories, effectively empty) is unreferenced dead scaffolding.                                                                                                                                                                                                                                                                                  | O4          |
| **G-17** | cosmetic, but flagged against a locked principle | Trademark symbols ("™") remain in `README.md` and tutorials 53-56, violating the explicit "no trademark symbols anywhere in code or docs" architecture principle.                                                                                                                                                                                                          | O7          |
| **G-18** | cosmetic                                         | Stray "Execution Governance" category-example value in `docs/specifications/reference-policies.md`, outside the already-deferred legacy tree, missed by the terminology sweep. **RESOLVED 2026-07-17** — see `docs/VERIFICATION-GAPS.md`, "Gaps closed in the 2026-07-17 audit closeout session," item 19; the stray value was replaced with "AI Execution Authorization." | O8          |
| **G-19** | pre-production                                   | `@parmana/replay` (O3) is a real, tested capability with zero HTTP entry point and zero wiring into `packages/api`/`packages/runtime`. Directly relevant because "verifiable records" is a named success criterion for the shadow pilot this roadmap targets.                                                                                                              | O3          |

**Not in VERIFICATION-GAPS.md at all, surfaced only in CLAIMS.md Section 4, elevated here
because of the shadow-pilot target:**

- **API-layer authentication.** `CLAIMS.md` states plainly: "no route in the Parmana API
  enforces auth today; every request accepted from any caller who can reach the port."
  Confirmed directly against source in this audit (`grep` for auth middleware across
  `packages/api/src/app.ts` and every route file returns nothing). For a general-purpose
  roadmap this might be a normal, deferrable item. For a shadow pilot at a regulated financial
  institution specifically, this is very likely the single highest-priority gap in the entire
  repository: a security review at a bank will not proceed past the first API scan if any
  authenticated caller can invoke `/execute` with no credentials at all. This has no gap number
  in `VERIFICATION-GAPS.md` because that document's scope was test coverage, not missing
  features; it belongs in this roadmap's priority section instead. See section 7.

---

## 5. Next implementation milestones, in dependency order

Ordered so that nothing on the list depends on something later in the list.

1. **API-layer authentication.** Nothing else matters to a bank's security review before this
   exists. No dependencies. Should land first.
2. **Fix the duplicate-transaction race (G-1, D-1 Option A).** No dependencies on (1); can be
   done in parallel. Small, well-scoped, already has a documented fix shape in
   `VERIFICATION-GAPS.md`.
3. **Fix the `/execute` malformed-body 500 (G-12).** No dependencies. Requires either
   completing `BusinessTransactionValidator` to check-then-throw a typed error before
   dereferencing nested fields, or adding a schema-validation pass ahead of it in
   `packages/api/src/routes/execute.ts`. Small to medium.
4. **Stand up CI (G-2).** Depends conceptually on (2) and (3) landing first, so CI's first run
   is green rather than immediately red; not a hard technical dependency.
5. **Resolve D-2 (hybrid/PQ), Option B first.** Depends on nothing technically, but should
   happen before any external party reads `docs/site/cryptography/overview.mdx` as part of a
   security review, so sequence it before the pilot's review begins. Bundle with deleting the
   now-fully-diagnosed dead chain from 1.4 (G-4 extension) since Option B already touches the
   same files.
6. **Resolve D-3 (`OverrideService`).** Independent of everything else above. Pick Option A
   (wire it in) if override capability is part of the pilot's demo story; otherwise Option B
   (mark `[FUTURE]`) is trivial and unblocks nothing else either way.
7. **Decide and act on `@parmana/replay` wiring (G-19).** Depends on (1) if a `/replay` route
   is added (new route needs the same auth gate as every other route). Directly relevant to the
   pilot's "verifiable records" success criterion, so should not slip past the pilot's start.
8. **Live-credential hygiene in tests (G-3).** Independent of all of the above; do opportunistically,
   but do not let it block the pilot-facing items 1-7.
9. **Dead-code and duplication cleanup (D1c/D2/O1/O2/O4/O5, G-15/G-16/G-17/G-18).** Lowest
   technical priority, since none of it is reachable in production, but doing it before the
   pilot's security review reduces the code surface they have to review and rule out. Sequence
   this immediately before the review, not immediately after this document is approved.
10. **Clock injection in runtime (G-14).** Lowest priority: real debt, but no external party
    will notice its absence in a shadow pilot; it matters for the project's own testing
    rigor and for a more literal "replayable" claim, not for pilot readiness per se.
11. **Key custody beyond local PEM files.** Named in `CLAIMS.md` Section 4 as a known future
    claim, not yet started. Out of scope for a _shadow_ pilot (no real financial consequence to
    a compromised local key in a non-production shadow run), but should be the first item
    tackled after the pilot if it converts to a live deployment. Listed here for dependency-order
    completeness, not for near-term action.

---

## 6. Delete / merge / rename recommendations

Each entry: why, impact, breaking or non-breaking, estimated effort, dependencies, own branch.

### R1. Delete `packages/execution-gateway/src/connector-runtime/*` and the `channel`/`gatewayIdentity` fields on `ExecutionGatewayOptions`

- **Why:** 380 lines of a parallel, never-production-used implementation (D1c, D2, O5).
  Confusion risk for anyone reading `execution-gateway` as source of truth.
- **Impact:** removes public exports (`packages/execution-gateway/src/index.ts:24` and the
  deprecated fields on `ExecutionControlOptions`).
- **Breaking:** yes, for any external consumer who imported these exports directly (unlikely
  given they were already marked `@deprecated`), and for the one internal test
  (`execution-control.test.ts` in `execution-gateway`), which must be deleted or rewritten
  against the modern `service` path first.
- **Effort:** small, half a day including retiring the test.
- **Dependencies:** none.
- **Branch:** own branch, since it is a public-API-surface deletion, not a pure test fix.

### R2. Delete `packages/api/src/bootstrap/ConnectorFactory.ts` and `ExecutionControlComposition.ts`

- **Why:** dead composition root, zero callers, actively confusable with the real one (1.5,
  G-13).
- **Impact:** internal only, not exported from the package's public surface.
- **Breaking:** no.
- **Effort:** trivial, under an hour.
- **Dependencies:** none.
- **Branch:** can ride along with R1 or land standalone; either is fine given the low risk.

### R3. Delete or repurpose `@parmana/receipt`, `ExecutionTrustAttestationBuilder`, `ExecutionPermitBuilder`

- **Why:** an entire orphaned five-package-deep chain (1.1, 1.2, 1.4, D4, D5, O1, O2) that
  exists only to demonstrate itself in three tutorials, using a `Receipt` and
  `ExecutionTrustRecord`-shaped concept that diverges from the real, production
  `ReceiptService`/`ExecutionTrustRecord`.
- **Two paths, a genuine decision, not a mechanical fix:**
  - **Option A, delete:** remove `packages/receipt`, `ExecutionTrustAttestationBuilder`,
    `ExecutionPermitBuilder`, and rewrite tutorials 54-56 to demonstrate the real
    `ReceiptService` and `ExecutionTrustRecord` instead. Straightens the story for anyone
    reading the tutorials as documentation of real behavior, which is presumably their
    purpose.
  - **Option B, keep and document as `[FUTURE]`:** if the intent was always a distinct,
    forward-looking "portable receipt bundle" concept (permit plus attestation, independently
    verifiable without the full trust record), keep the package but add a `CLAIMS.md
[FUTURE]` entry making that intent explicit, and rename `ExecutionTrustAttestation` to
    something that does not collide with `ExecutionTrustRecord` (resolves G-15 without
    deleting anything).
- **Impact:** Option A removes a whole package and rewrites three tutorials; Option B is a
  rename plus one doc entry.
- **Breaking:** Option A yes (package removal); Option B no.
- **Effort:** Option A, one to two days including tutorial rewrites and their manual exit-code
  verification. Option B, a few hours.
- **Dependencies:** none for either.
- **Branch:** own branch either way, this is exactly the kind of structural call this session's
  own discipline says should be decided by you, not silently picked.

### R4. Delete `examples/archive/`

- **Why:** 90 empty or near-empty directories, zero references anywhere in the repo (O4).
- **Impact:** none, nothing points at it.
- **Breaking:** no.
- **Effort:** trivial.
- **Dependencies:** none. If the high-numbered directories represent real planned work (load
  testing, industry verticals, agent-framework integrations), move that intent to a tracked
  backlog or issue list before deleting the directory names, so the ideas are not lost, only
  the empty scaffolding.
- **Branch:** can ride along with any other cleanup branch.

### R5. Remove trademark symbols (G-17)

- **Why:** direct violation of the locked "no trademark symbols anywhere in code or docs"
  principle.
- **Impact:** prose-only, `README.md` and 4 tutorial READMEs.
- **Breaking:** no.
- **Effort:** small, mechanical, similar in shape to the "Execution Governance" terminology
  sweep already completed this session.
- **Dependencies:** none.
- **Branch:** could be a small standalone pass, does not need to block anything else.

### R6. Fix the stray "Execution Governance" category value (G-18)

- **Why:** direct violation of the locked vocabulary principle, missed by the earlier sweep
  because this file was outside the previously identified legacy tree.
- **Impact:** one line in `docs/specifications/reference-policies.md`.
- **Breaking:** no.
- **Effort:** trivial, one line.
- **Dependencies:** none.
- **Branch:** bundle with R5, same category of fix.
- **Status: RESOLVED 2026-07-17.** Fixed in the 2026-07-17 audit closeout session's
  terminology sweep — see `docs/VERIFICATION-GAPS.md`, "Gaps closed in the 2026-07-17
  audit closeout session," item 19.

### R7. Resolve the `ExecutionTrustRecord`/`ExecutionTrustAttestation` naming collision (G-15)

- Subsumed by R3; whichever option is chosen there resolves this too. Not a separate piece of
  work.

---

## 7. Prioritized roadmap to v1.0 (shadow pilot readiness)

"Production-ready" here means: ready for a regulated financial institution's security team to
review this system, in their environment, running one connector, and trust the records it
produces. Not ready for unbounded scale, not ready for every connector in `CLAIMS.md` Section
4's future list, not ready for multi-tenant deployment. Three phases, each gated on the
previous one's exit criteria.

### Phase A: Baseline trust (must complete before any external review)

1. API-layer authentication (section 5, item 1). No dependencies. This is the one item on this
   entire roadmap that, left undone, is likely to end a pilot conversation before it starts.
2. Fix G-1, duplicate transaction race (D-1 Option A). Half a day per `VERIFICATION-GAPS.md`'s
   own estimate.
3. Fix G-12, malformed-body 500. Small to medium.
4. Stand up CI (G-2). A day, including the explicit decision on whether Supabase-gated tests
   run in CI or stay local-only.
5. Fix G-3, live-credential hygiene in tests. A day, mostly cleanup-hook work.

**Exit criteria for Phase A:** every request to the API requires valid credentials; the
duplicate-transaction and malformed-body bugs are fixed with regression tests; CI runs on
every PR; `npm test` no longer silently writes to a live external database by default.

### Phase B: Credibility under review (must complete before the security review itself)

6. Resolve D-2, hybrid/PQ dead config, Option B (document as single-provider by design) unless
   hybrid signing is independently roadmapped for the pilot, in which case Option A.
7. Resolve D-3, `OverrideService`, either option, so it stops being neither documented nor
   reachable.
8. Decide and act on R3 (`@parmana/receipt` chain), because a reviewer who finds two
   differently-shaped "receipt" and "trust record" concepts in the same codebase will
   reasonably ask which one is real.
9. Decide and act on G-19, `@parmana/replay` wiring, specifically because "verifiable records"
   is part of this pilot's own stated success criteria and right now that capability is not
   reachable through the system a reviewer would actually poke at.
10. Dead-code cleanup: R1, R2, R4, so the code surface a reviewer has to rule out is smaller
    than it is today.
11. Vocabulary and trademark cleanup: R5, R6, so nothing in the reviewed material contradicts
    the locked architecture principles this project has committed to.

**Exit criteria for Phase B:** every claim in `CLAIMS.md` that a reviewer could plausibly test
against the running system is either true today or explicitly marked `[FUTURE]`; no dead code
path is reachable from a route a reviewer would find by reading `packages/api/src/routes`; the
docs a reviewer would read (`docs/site`, `README.md`) contain no unresolved contradictions
between what is claimed and what runs.

### Phase C: Engineering rigor (can run in parallel with, or after, the pilot itself)

12. Clock injection in runtime (G-14).
13. Vague CLAIMS.md citations (G-10): point every claim at a specific test file, not a class
    name or a README section.
14. Undocumented env vars (G-11).
15. Key custody beyond local PEM files, only if the shadow pilot converts to a live deployment.

**Exit criteria for Phase C:** not required for the shadow pilot itself; this phase exists so
the roadmap does not stop thinking the day the pilot starts.

---

## Summary: what changed since the last audit

`VERIFICATION-GAPS.md` (from the prior remediation pass) already tracked 11 gaps (G-1 through
G-11) and 3 open decisions (D-1 through D-3). This audit:

- Confirmed all 11 gaps are still current, with no regressions and no new information needed
  for 9 of them.
- Extended G-4 with a materially larger blast radius (a five-package dead chain, not one env
  var).
- Added 8 new gaps (G-12 through G-19), two of which (G-12, malformed-body 500; and the
  unnumbered API-authentication gap) are assessed as blocks-pilot severity for this project's
  specific shadow-pilot target, even though neither was previously documented anywhere.
- Confirmed the `ExecutionTrustRecord` to `ExecutionTrustAttestation` rename mentioned as "in
  flight" is not complete and, on inspection, was never a rename of the real model to begin
  with.
- Identified one substantial, real, tested capability (`@parmana/replay`) that is unwired
  rather than unfinished, worth a deliberate decision rather than continued neglect given its
  direct relevance to this project's own "verifiable records" pilot goal.

No code was changed in the course of this audit. No commits were made.
