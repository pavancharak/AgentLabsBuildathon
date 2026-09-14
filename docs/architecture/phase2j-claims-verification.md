# Phase 2J — Correct Stale Repository Claims (TD-21)

Closes TD-21 (`docs/architecture/repository-certification.md`, Technical Debt Register), a Phase 2E finding. This is a documentation and certification phase — no production source code, runtime behavior, public API, or architecture changed. Only `docs/CLAIMS.md` was edited.

**Fixed against:** commit `c87629a` (`refactor(api): remove dead composition root and close TD-20`), the tip of `main`. Working tree was not clean at the start of this phase — Phase 2I's changes were still uncommitted; per user confirmation, they were committed first (`c87629a`) before this phase's own gate check was re-run and passed.

---

## 1. Original TD-21 Finding

From `docs/architecture/repository-certification.md`:

> `docs/CLAIMS.md:835` still describes `create-connector-registry.test.ts` as asserting "vendor-payment remains resolvable when razorpay is not" — true before Phase 2A, false since: that exact test was changed to assert the opposite (fails closed) outside `NODE_ENV=test`. Flagged during Phase 2A/2A.1 but never corrected. Stale claim about current test behavior in an actively-referenced claims document (not a dated historical snapshot like `EXECUTION-FLOW-AUDIT.md`/TD-6). **Next `CLAIMS.md` touch: correct the one clause; out of scope for a dedicated phase on its own.**

Rated **Low**, classified **Open**.

## 2. Historical Provenance Audit

**When the claim was introduced and whether it was accurate then:** `docs/CLAIMS.md`'s current §3.4 content (including the line-835 clause) traces to the same commit lineage as the Razorpay refund connector work. At the time it was written, `packages/api/tests/unit/bootstrap/create-connector-registry.test.ts` genuinely asserted that `vendor-payment` remained resolvable in production regardless of Razorpay's configuration — this was TD-1's very condition (vendor-payment unconditionally registered, unlike credential-gated Razorpay/HubSpot). The claim was **accurate when written**.

**Which phase superseded it:** Phase 2A, commit `6eff8ec` (`fix(production): remove MockConnector from production bootstrap`), 2026-08-05. Direct evidence, read from `docs/architecture/phase2a-production-connectors.md`:

> `packages/api/tests/unit/bootstrap/create-connector-registry.test.ts` | Test | Updated: the two tests that asserted `vendor-payment` remained resolvable in production now assert it fails closed; one new test explicitly proves `NODE_ENV=test` still works.

Independently re-confirmed against current source, not just this citation: `packages/api/tests/unit/bootstrap/create-connector-registry.test.ts` today contains a test literally titled `"(Phase 2A, fail-closed) does not register vendor-payment, and resolveCapability throws, outside test mode — MockConnector never backs production execution"` (line 74) and a second, `"does not fail startup of the whole registry when razorpay credentials are missing — vendor-payment resolution still fails closed, independently"` (line 62) — the exact opposite of what `CLAIMS.md:835` described.

**Why it was never corrected:** `docs/architecture/repository-certification.md`'s own provenance note states this was "flagged during Phase 2A/2A.1 but never corrected" — Phase 2A's charter was implementation, and it correctly updated the two `docs/site/` pages that would have gone stale (`docs/site/concepts/the-gateway.mdx`, `docs/site/integrations/connector-development-guide.mdx` — verified: both already read Phase-2A-accurate today, §8) but did not sweep `docs/CLAIMS.md` itself. This is exactly the situation TD-21 was registered to close.

**Should it remain as historical documentation rather than be rewritten:** No. `CLAIMS.md`'s own stated purpose (`docs/CLAIMS.md:81`, "Purpose") is to define **current** public technical claims, not a point-in-time snapshot — unlike `docs/architecture/EXECUTION-FLOW-AUDIT.md` (TD-6, a dated historical audit report this repository's own conventions preserve unedited). TD-21's own text draws this exact distinction. Correcting the claim, not preserving it, is the right action — independently re-confirmed, not assumed from TD-21's wording alone.

## 3. Claims Inventory

`docs/CLAIMS.md` was read in full (1428 lines): the Key Compromise Notice, Core Positioning (§1), 21 Supported Claims (§2.1–2.21), 10 Conditional Claims (§3.1–3.10), the TRL Maturity Assessment, 24 Future Claims (§4), 9 claims intentionally not made (§5), the Claim Lifecycle, and the Engineering Principle.

Full classification summary (every claim; detail on claims requiring action follows in §4–§6):

| Section                                         | Claim (summary)                                                                                                                                                                                                                                                                                                 | Classification                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §1 Core Positioning                             | Category/Mission/Value Proposition                                                                                                                                                                                                                                                                              | Not a checkable technical claim — positioning language, no verification applicable                                                                                                                                                                                                               |
| §2.1–2.5, 2.15, 2.17–2.21                       | Trusted Business Transactions, Deterministic Policy Selection/Evaluation, Authorized Execution, Verifiable Execution Evidence, Authorization-Binding Verification, Fail-Closed Startup Config, Key Provider Input Validation, Fail-Closed Audit Writes, Atomic Duplicate Rejection, Distinguishable HTTP Status | **Verified** — each traced to real, existing evidence (source files and/or tests exist and match the claim as worded); no known FUTURE item, open TD, or documented gap narrows any of these                                                                                                     |
| §2.6 Independent Verification                   | VerificationCrypto/verification-service                                                                                                                                                                                                                                                                         | **Verified**                                                                                                                                                                                                                                                                                     |
| §2.7 Replay Support                             | "Parmana supports replay... for verification and analysis"                                                                                                                                                                                                                                                      | **Verified But Incomplete → corrected this phase** (§5)                                                                                                                                                                                                                                          |
| §2.8–2.14                                       | Signed authorization, envelope verification, key/algorithm binding, PQ signing                                                                                                                                                                                                                                  | **Verified** — evidence paths cited use a stale directory convention (`test/` singular instead of `tests/unit/`); files themselves exist and are real (§6); not reclassified, see rationale there                                                                                                |
| §2.16 Caller Authentication at the API Boundary | "Every route except /health requires a valid caller credential"                                                                                                                                                                                                                                                 | **Verified But Incomplete → corrected this phase** (§5)                                                                                                                                                                                                                                          |
| §3.1–3.7, 3.9, 3.10                             | Envelope non-bypassability, fleet-wide nonce, connector SDK foundation, Razorpay refund/webhook/settlement milestones (3.4–3.7), HubSpot connector, live-mode                                                                                                                                                   | **Verified** — each is explicitly, narrowly scoped by its own text (this document's dominant style) and cites real, checked evidence                                                                                                                                                             |
| §3.4 (specific clause)                          | "vendor-payment remains resolvable when razorpay is not"                                                                                                                                                                                                                                                        | **Stale → corrected this phase** (TD-21's named target, §4)                                                                                                                                                                                                                                      |
| §3.8 Deployed Environment (Test Mode)           | "caller authentication at every route except `/health`"                                                                                                                                                                                                                                                         | **Verified But Incomplete → corrected this phase** (same fix as §2.16, §5)                                                                                                                                                                                                                       |
| TRL Maturity Assessment                         | TRL 7 assessment                                                                                                                                                                                                                                                                                                | **Verified** — explicitly labeled as interpretation, not a new evidentiary claim; scope-limited in its own text                                                                                                                                                                                  |
| §4 Future Claims (24 items)                     | Unimplemented connectors, cloud credential providers, algorithm migration, etc.                                                                                                                                                                                                                                 | **Future** — each explicitly framed as `[FUTURE]`/withheld, consistent with actual absence of implementation (spot-checked: no Stripe/GitHub/Salesforce/SAP/ServiceNow/Workday/Slack/Jira/Database connector exists in `packages/connector-sdk/src/connectors/`, confirmed by directory listing) |
| §5 Claims Not Made (9 items)                    | Non-bypassability, mathematical proof, compliance guarantees, etc.                                                                                                                                                                                                                                              | **Historical/positioning** — these are deliberate non-claims, not subject to staleness                                                                                                                                                                                                           |

No claim was found **Unable to Certify**. Every Verified claim had locatable repository evidence (source file, test file, or both); no claim required inventing evidence or guessing at intent.

## 4. Repository Verification — TD-21's Named Claim

`packages/api/tests/unit/bootstrap/create-connector-registry.test.ts` read in full. Confirmed independently (not copied from Phase 2A's own report):

- Line 50–60: `"(fail-closed) does not register razorpay, and resolveCapability throws, when credentials are unconfigured outside test mode"` — Razorpay's existing fail-closed behavior, unchanged by Phase 2A.
- Line 62–72: `"does not fail startup of the whole registry when razorpay credentials are missing — vendor-payment resolution still fails closed, independently"` — asserts `resolveCapability("payments:execute")` **throws** in production even when only Razorpay's credentials are missing (vendor-payment's own absence is independent, not "reachable as a fallback").
- Line 74–82: `"(Phase 2A, fail-closed) does not register vendor-payment, and resolveCapability throws, outside test mode — MockConnector never backs production execution"` — the direct contradiction of `CLAIMS.md:835`'s old wording.
- Line 84–90: `"(Phase 2A) registers vendor-payment (MockConnector) when NODE_ENV=test"` — confirms the claim is now conditioned on test mode, not "always resolvable."

This is the exact evidence TD-21 cited, independently re-run and re-read rather than trusted.

## 5. Stale Claim Analysis

**Why it became stale:** Phase 2A's fail-closed fix for TD-1 changed the very test `CLAIMS.md:835` cites, from asserting production-availability to asserting production-unavailability (§2, §4).

**Which phase superseded it:** Phase 2A (implementation, commit `6eff8ec`) — see §2 for the full four-stage evidence chain this phase's Task 4 required cross-referencing.

**Was the wording inaccurate:** Yes, directly — the cited test's current assertions are the literal opposite of what the clause described.

**Was correction appropriate:** Yes (§2's "should it remain historical" analysis) — `CLAIMS.md` is an actively-referenced current-state document, not a dated snapshot.

## 6. Verified But Incomplete Findings

Three findings, all corrected in this phase (none left open):

**§2.7 Replay Support.** "Parmana supports replay of recorded execution decisions for verification and analysis" is literally true — `@parmana/replay`'s `ReplayEngine` is real, tested, and does exactly this. But this phase's own prior work (Phase 2G, `docs/architecture/phase2g-replay-semantics.md`) independently established that `POST /replay`, the HTTP-reachable surface a reader would naturally assume this claim describes, does **not** exercise this package at all — it performs a signature/hash recheck, a materially different and narrower operation. A reader relying on this claim's plain wording, without already knowing Phase 2G's findings, would reasonably but wrongly conclude the HTTP API exposes semantic replay. **Corrected**: added an explicit scope note distinguishing the package-level capability from the HTTP route, pointing to the existing `docs/site/replay/overview.mdx` disambiguation and this repository's own `phase2g-replay-semantics.md` for the full evidence.

**§2.16 Caller Authentication at the API Boundary.** "Every route except /health requires a valid caller credential" is incomplete, not false — independently verified by reading `packages/api/src/app.ts` directly: **six** routes are mounted before the caller-auth middleware and exempt, not one: `/health`, `/ready`, `/openapi.yaml`, `/documentation`, `POST /refusal/verify`, and `POST /audit/verify`. The claim's own cited evidence (`packages/api/tests/integration/caller-auth.integration.test.ts`) only tests `/health` and `/ready` as exempt and its file-header comment itself says "every route except /health" — also incomplete relative to `app.ts`'s actual code (not corrected in this phase; it is a test file, out of this phase's documentation-only scope, see §9). **Corrected**: named all six exempt routes explicitly, with the reason the last two are intentionally unauthenticated (independently third-party-verifiable signature checks, not caller-data-exposing routes).

**§3.8 Deployed Environment (Test Mode).** The identical "except `/health`" phrase appears a second time, describing the same underlying fact in a different claim. **Corrected** identically, for consistency, with a pointer back to 2.16.

No claim remains classified **Verified But Incomplete** after this phase (§10 lists related, out-of-scope incompleteness found in _other_ files, which does not block this classification for `CLAIMS.md` itself).

## 7. Documentation Changes

`docs/CLAIMS.md` only, three edits:

1. **§3.4, evidence bullet (the named TD-21 target):** replaced "vendor-payment remains resolvable when razorpay is not" with "vendor-payment and razorpay each independently fail closed outside `NODE_ENV=test`," plus a pointer to `docs/operations/td1-closure-summary.md` naming the complete Implementation (Phase 2A) → Deployment Verification (Phase 2A.2) → Historical Integrity Verification (Phase 2A.3) → Technical Debt Closure (Phase 2A.4) evidence chain, per this phase's Task 4 instruction.
2. **§2.7 Replay Support:** added the package-vs-route scope note (§6).
3. **§2.16 and §3.8:** named all six caller-auth-exempt routes explicitly, in both places the incomplete four-word phrase appeared (§6).

No other claim, section, or unrelated wording was touched. `git diff --stat`: one file changed, `docs/CLAIMS.md`, 8 insertions / 8 deletions (three edits, each a same-line-count replacement).

## 8. Cross-Reference Verification (Phase 2A / 2A.1 / 2A.2 / 2A.3 / 2A.4)

Full chain read directly from `docs/operations/td1-closure-summary.md` (the canonical evidence record) and cross-checked against each underlying report:

| Phase                          | Commit    | Report                                                         | Outcome                                                                                                                                     |
| ------------------------------ | --------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2A (implementation)            | `6eff8ec` | `docs/architecture/phase2a-production-connectors.md`           | `createVendorPaymentConnector.ts` returns `undefined` outside `NODE_ENV=test`; `createConnectorRegistry.ts` guards registration accordingly |
| 2A.1 (readiness review)        | `10c8064` | `docs/operations/phase2a-deployment-readiness.md`              | READY WITH CONDITIONS                                                                                                                       |
| 2A.2 (deployment verification) | `0c19f78` | `docs/operations/phase2a-deployment-verification.md`           | DEPLOYMENT VERIFIED WITH FOLLOW-UP                                                                                                          |
| 2A.3 (historical integrity)    | `e6a25ab` | `docs/operations/phase2a-historical-integrity-verification.md` | HISTORICAL INTEGRITY CONFIRMED                                                                                                              |
| 2A.4 (closure)                 | —         | `docs/operations/td1-closure-summary.md`                       | TD-1 CLOSED                                                                                                                                 |

**Confirmed this stale claim relates directly to the MockConnector removal**: `create-connector-registry.test.ts` (the file `CLAIMS.md:835` cites) is the exact file Phase 2A modified to implement and prove the TD-1 fix. The corrected wording in §7 now points to this complete chain rather than restating it inline, matching this phase's Task 4 instruction and this document's own established style of pointing to canonical reports rather than duplicating their evidence (e.g., "see 3.2's sibling claim," "see Future Claims").

## 9. Repository Consistency Audit

Searched `docs/CLAIMS.md`, `docs/GUARANTEES.md`, `README.md`, every `docs/architecture/*.md`, every `docs/operations/*.md`, and every `docs/site/**` file for equivalent wording.

**The exact stale clause ("vendor-payment remains resolvable when razorpay is not") appears nowhere else** — confirmed by repo-wide grep both before and after this phase's edit. `docs/site/concepts/the-gateway.mdx` and `docs/site/integrations/connector-development-guide.mdx` already describe the post-Phase-2A fail-closed reality accurately (Phase 2A updated them itself, confirmed by direct reading: both contain an explicit "Update (Phase 2A)" / "used to register... unconditionally... that was a trust gap" callout). Every other `docs/site` page mentioning `vendor-payment`/`MockConnector` (roadmap.mdx, quickstart.mdx, deployment/local.mdx, guides/deploy-patterns.mdx, integrations/overview.mdx) describes it as "the one connector registered" or "a reference mock" without claiming unconditional production availability — none are stale in this specific way.

**A significant, separate consistency finding, documented per this phase's explicit "do not silently broaden" instruction, not fixed:** the "every route except `/health`" incompleteness found in `CLAIMS.md` §2.16/§3.8 (§6) recurs across **`docs/site`**, inconsistently:

- **Already complete** (list all four probe/doc routes, though still missing `/refusal/verify`/`/audit/verify`, which postdate these pages): `docs/site/api-reference/authentication.mdx`, `docs/site/faq.mdx`, `docs/site/llms.txt`, `docs/site/llms-full.txt` (three occurrences). `docs/site/llms.txt` line 22 is notable: it already contains its own prior self-correction — _"Note: the OpenAPI spec's own top-level description names only GET /health as exempt; the other three are real exemptions in packages/api/src/app.ts that the spec text omits. This page states the verified, complete list."_ — evidence a previous session already fought this exact class of drift once, for a subset of the exempt-route list.
- **Still incomplete** (say only "except `GET /health`"): `docs/site/api-reference/introduction.mdx`, `docs/site/guides/deploy-patterns.mdx` (line 122), `docs/site/reference/api.mdx` (line 26), `docs/site/security/overview.mdx`, `docs/site/trust-and-claims/what-we-dont-claim.mdx`, and `docs/site/openapi.bundled.yaml` (four occurrences, a generated file — would need the fix applied to `openapi/openapi.yaml`'s source and re-bundled, not edited directly).
- **Provenance**: `git log` shows `docs/site/faq.mdx` and `docs/site/api-reference/authentication.mdx` were both last corrected for this exact issue on 2026-07-21 (`8a3551a`, `c91a580`) — before the `POST /refusal/verify` (RFC-0021) and `POST /audit/verify` (caller/webhook audit signing) routes existed. The "complete" pages are complete relative to 2026-07-21's route set, not today's.

This is a materially larger documentation-consistency issue than TD-21's own named scope (one clause in one file) and spans roughly a dozen files across the published docs site plus a generated OpenAPI bundle. Fixing it is out of this phase's scope — doing so here would silently broaden a "correct one clause" phase into a site-wide documentation sweep. **Recommended as a dedicated future phase**, scoped specifically to reconciling the caller-auth exempt-route list across every `docs/site` page and regenerating `openapi.bundled.yaml` from a corrected `openapi/openapi.yaml`.

**Citation-path hygiene, documented, not fixed:** claims §2.6, §2.8, §2.9, §2.11–2.14 cite evidence paths using `packages/{runtime,crypto,envelope-verifier}/test/` (singular, no subdirectory) and PascalCase filenames (e.g., `SignatureProvider.test.ts`, `Dilithium3SignatureProvider.test.ts`). The actual files exist and are real, but live at `packages/{runtime,crypto,envelope-verifier}/tests/unit/` (plural, with a subdirectory) using kebab-case filenames (e.g., `signature-provider.test.ts`, `dilithium3-signature-provider.test.ts`) — confirmed by direct `find`. This does not narrow any claim's plain-language meaning (the tests exist and prove what's claimed) — it is a citation-accuracy defect, the same class `docs/VERIFICATION-GAPS.md`'s G-10 already tracks for a different set of citations ("vague or indirect... none of these claims are false"). Not reclassified as Verified But Incomplete (that definition is about omitted caveats/limitations, not path accuracy) and not fixed here, since correcting roughly eight citation paths across five claims is a distinct, mechanical documentation-hygiene task beyond TD-21's one-clause scope — flagged for a future pass, ideally alongside G-10's existing, similar finding.

**GUARANTEES.md consistency**: G-08's own wording ("Replay re-evaluates historical execution... Replay is intended to detect meaningful differences between recorded and replayed execution") is fully consistent with, and reinforces, this phase's corrected §2.7 wording. No change needed there.

## 10. Remaining Limitations

- The docs/site caller-auth exempt-route inconsistency (§9) — a dozen-plus files, one generated bundle — remains unfixed, by design, per this phase's explicit scope.
- The citation-path hygiene issue across §2.6/§2.8/§2.9/§2.11–2.14 (§9) remains unfixed, by design.
- `docs/architecture/repository-certification.md`'s TD-21 register row remains "Open" — consistent with this repository's established pattern (confirmed across Phase 2F/TD-9, Phase 2H/TD-19, Phase 2I/TD-20): the closing phase's own report is the canonical closure evidence; updating the register row itself is left to a future reassessment phase (as Phase 2E did retroactively for TD-15), not the closing phase.
- This phase's Claims Inventory (§3) verified every claim's existence and evidence but did not re-run every cited test file individually beyond what §8's full regression suite already covers; claims whose cited tests are part of the always-running suite (the large majority) are covered by §11's regression run, Supabase/live-gated citations (e.g., 3.4, 3.6–3.9) were not re-run live in this phase (no destructive or credentialed action was taken; this is a documentation phase).

## 11. Evidence Summary

```
Repository searches: grep -n "vendor-payment\|MockConnector" docs/CLAIMS.md (single stale
  occurrence found and fixed); grep -rn "except /health" across docs/CLAIMS.md and docs/site/
  (found and cross-referenced, §9); git log -S/--follow on CLAIMS.md's stale clause's source
  test file and on docs/ROADMAP-v1.md/GAP-AUDIT.md (citation-provenance check inherited from
  Phase 2I's own methodology, applied here to TD-21's chain)

Source references: packages/api/tests/unit/bootstrap/create-connector-registry.test.ts (read
  in full, lines 1-100), packages/api/src/app.ts (read in full, confirming 6 exempt routes),
  packages/replay/src/ReplayEngine.ts (Phase 2G's own prior finding, re-confirmed still
  accurate against current source)

Documentation references: docs/architecture/phase2a-production-connectors.md,
  docs/operations/{phase2a-deployment-readiness,phase2a-deployment-verification,
  phase2a-historical-integrity-verification,td1-closure-summary}.md,
  docs/architecture/repository-certification.md (TD-1/TD-21 rows), docs/GUARANTEES.md (G-08),
  docs/site/replay/overview.mdx, docs/architecture/phase2g-replay-semantics.md

Build output: npx tsc -b → clean, 0 errors
Test output: npm test -- --maxWorkers=2 → 140 test files passed, 15 skipped;
  959 tests passed, 39 skipped, 0 failed — identical to the pre-phase count, confirming zero
  production behavior change (expected: no test, schema, or source file was touched)
```

---

## Final Verification

| Item                                                                                        | Status                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TD-21 independently verified                                                                | ✓ — factual premise (stale test-behavior description) confirmed exactly accurate against current source, not assumed from the register entry                                                                |
| Historical provenance verified for every modified claim                                     | ✓ — §3.4's clause (§2, §4, §8: Phase 2A commit `6eff8ec`, full 2A→2A.4 chain); §2.7 (Phase 2G, this repository's own prior independent verification); §2.16/§3.8 (`packages/api/src/app.ts`, read directly) |
| Every modified claim supported by repository evidence                                       | ✓ — §4 (test file re-read), §6 (`app.ts` re-read), §8 (full evidence chain re-read)                                                                                                                         |
| Every Verified claim checked for completeness against known FUTURE items, TD, gaps, caveats | ✓ — §3 full inventory; two additional Verified But Incomplete findings surfaced and corrected (§6) beyond TD-21's named target                                                                              |
| Historically accurate claims preserved where appropriate                                    | ✓ — no historical report was rewritten; `docs/architecture/EXECUTION-FLOW-AUDIT.md`-style dated snapshots untouched (none required this phase)                                                              |
| Historical reports preserved                                                                | ✓ — `git status`/`git diff --stat` confirms only `docs/CLAIMS.md` changed                                                                                                                                   |
| Repository claims internally consistent                                                     | ✓, with one documented, out-of-scope exception (§9's docs/site exempt-route inconsistency)                                                                                                                  |
| Runtime unchanged                                                                           | ✓ — no source file touched                                                                                                                                                                                  |
| Production source code unchanged                                                            | ✓ — `git diff --stat`: `docs/CLAIMS.md` only                                                                                                                                                                |

Supported by: repository searches, source references, documentation references, git history, and build/test output, all listed in §11.

## Final Recommendation

**TD-21 CLOSED.**

The named claim (`docs/CLAIMS.md:835`) was independently re-verified stale, traced to the exact commit that superseded it (Phase 2A, `6eff8ec`), and corrected with a pointer to the complete four-stage evidence chain this phase's Task 4 required (`docs/operations/td1-closure-summary.md`), rather than merely restating "implementation changed." Two additional Verified But Incomplete claims were found during the mandatory full-document completeness check (§2.7 Replay Support's package-vs-route scope, §2.16/§3.8's caller-auth exempt-route list) and were also corrected in this same pass, narrowly and with direct repository evidence — per this phase's own rule, TD-21 could not be marked CLOSED with either left unaddressed, and neither was. A significant, separate consistency finding (the same exempt-route incompleteness recurring across roughly a dozen `docs/site` pages and a generated OpenAPI bundle) was documented in full, with provenance, but deliberately not fixed, since doing so would have silently broadened a one-clause correction into a site-wide documentation sweep — flagged instead as a recommended future phase. No claim was found Unable to Certify. No historical report was altered. `tsc -b` and the full test suite (959 passed, 39 skipped, 0 failed — identical to the pre-phase count) confirm zero production behavior change.
