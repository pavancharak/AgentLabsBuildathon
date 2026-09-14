# TD-1 Closure Summary — Canonical Evidence Record

**Status: CLOSED.** This document is the single canonical source for TD-1's full evidence chain. Every other repository document that references TD-1's closure should point here rather than re-stating this evidence.

---

## 1. Original Finding

First recorded in `docs/architecture/repository-certification.md` (Phase 1H independent repository certification), §4.9 and Technical Debt Register item **TD-1**:

> `vendor-payment` connector is permanently backed by `MockConnector`, unconditionally registered (unlike credential-gated Razorpay/HubSpot), fabricating signed `{success:true}` Trust Records/Receipts for `payments:execute` with no real vendor ever contacted.

Severity: **High**. Classified as a production-trust gap, not an architectural-boundary violation — the single-execution-pipeline and adapter-ownership invariants held throughout; `MockConnector` was always the one class the architecture allowlisted outside `execution-gateway`.

## 2. Root Cause

`packages/api/src/bootstrap/createVendorPaymentConnector.ts` unconditionally constructed a `MockConnector` for the `vendor-payment` connector's `payments:execute` capability, and `createConnectorRegistry.ts` registered it in every environment, including production — with no credential gate or environment check, unlike Razorpay's and HubSpot's connectors, which fail closed (skip registration, with a warning) when unconfigured.

## 3. Why The Issue Existed

Established with direct, contemporaneous, first-commit evidence in `docs/operations/phase2a-deployment-readiness.md` §1: `createVendorPaymentConnector.ts`'s original commit (`ddf4bc5`, 2026-07-09) already carried the docstring _"This is the production bootstrap for the vendor-payment connector. The current implementation uses MockConnector until the real enterprise connector is introduced."_ — intentional, temporary, self-documented technical debt from the moment it was written, not accidental. It was wired into the default server (`docs/site/roadmap.mdx`, commit `651497a`, 2026-07-11) specifically to demonstrate the credential-isolation/brokering architecture claim. No real `vendor-payment` implementation was ever built, and no roadmap entry committed to building one on any timeline.

## 4. Phase 2A — Implementation

Commit **`6eff8ecbc67b2610ffd1cbcf8a94676bdec31981`** (2026-08-05 07:32:29 +0530), `fix(production): remove MockConnector from production bootstrap (Phase 2A)`.

`createVendorPaymentConnector.ts` now returns `undefined` outside `NODE_ENV=test`; `createConnectorRegistry.ts` guards registration on that (`if (connector === undefined) { console.warn(...) } else { registrations.push(...) }`), mirroring the pre-existing Razorpay/HubSpot fail-closed pattern exactly. In production, `payments:execute` now fails with the same `"No connector registered for capability"` error every other unimplemented capability already produces. Regression tests added and validated by mutation testing (revert the fix, confirm the new tests fail; restore, confirm they pass). Full report: `docs/architecture/phase2a-production-connectors.md`.

## 5. Phase 2A.1 — Operational Readiness Review

Commit **`10c80644548015a27dbb5d5ce146150690768993`** (2026-08-05 07:53:39 +0530), `docs(operations): independent readiness review before Phase 2A redeploy`.

Independent review (historical rationale, production impact, fail-closed acceptability, capability readiness, and a first Historical Data Integrity Assessment). Classified **Unable to Certify** at this stage — strong evidence that every `payments:execute` record found was test-attributed, but the queried Supabase database's identity relative to production was not yet confirmed. Recommendation: **READY WITH CONDITIONS**, explicitly reviewed and accepted by Pavan before deployment proceeded. Full report: `docs/operations/phase2a-deployment-readiness.md`.

## 6. Phase 2A.2 — Production Deployment Verification

Commit **`0c19f78a3fb7bfd9714051bf4623ff384fc41441`** (2026-08-05 08:14:59 +0530), `docs(operations): verify Phase 2A production deployment`.

Deployed commit `6eff8ec` to `parmana-api` (Fly.io) from a git worktree checked out at that exact SHA, guaranteeing byte-for-byte artifact fidelity with the reviewed commit (Fly release `v40`). Verified via direct production log evidence — a machine restart captured the live `vendor_payment_connector_unavailable` startup warning verbatim, confirming the fix is active. No live authenticated end-to-end call was attempted (no legitimate production caller credential available to that session); fail-closed behavior was instead established deterministically from the confirmed registry state plus the already-tested, unchanged code path. New evidence narrowed (but did not close) the database-identity question: the Supabase CLI showed the repository's linked project is named "REDACTED-PROJECT-NAME," matching the historically-queried database's host exactly. Recommendation: **DEPLOYMENT VERIFIED WITH FOLLOW-UP** — every requirement satisfied except the still-open database-identity question. Full report: `docs/operations/phase2a-deployment-verification.md`.

## 7. Phase 2A.3 — Historical Integrity Verification

Commit **`e6a25abb3a2d4fb5a1bc3967a6c5aa5dd68a317c`** (2026-08-05 08:36:02 +0530), `docs(operations): certify historical integrity after Phase 2A`.

Resolved the database-identity question directly: production's own public `/ready` endpoint (exempt from caller auth, same as `/health`) executes a literal `SELECT 1` against the exact Postgres pool `DATABASE_URL` configures when `PARMANA_STORAGE=supabase`. Calling it live and, in the same instant, observing that literal `SELECT 1` — plus a Razorpay-webhook-store query matching the settlement poller's known cadence — land in `pg_stat_activity` on the "REDACTED-PROJECT-NAME" database (`REDACTED-PROJECT-REF`) constitutes direct, self-triggered, timestamp-correlated operational proof of identity, obtained without exposing any secret value. **Classification: IDENTICAL.** Re-querying the now-confirmed production database found 18 `payments:execute` business transactions, 8 Trust Records, 10 Receipts — unchanged from Phase 2A.1's count — every one attributed, within its own hashed record content, to `authority.principalId` of `"ordering-test"` or `"integration-test"`. Zero records show any other origin. Final Classification: **HISTORICAL INTEGRITY CONFIRMED**. Full report: `docs/operations/phase2a-historical-integrity-verification.md`.

## 8. Final Evidence Chain

| Phase                          | Commit    | Date       | Report                                                         | Outcome                                                                       |
| ------------------------------ | --------- | ---------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 2A (implementation)            | `6eff8ec` | 2026-08-05 | `docs/architecture/phase2a-production-connectors.md`           | MockConnector removed from unconditional production registration; fail-closed |
| 2A.1 (readiness review)        | `10c8064` | 2026-08-05 | `docs/operations/phase2a-deployment-readiness.md`              | READY WITH CONDITIONS                                                         |
| 2A.2 (deployment verification) | `0c19f78` | 2026-08-05 | `docs/operations/phase2a-deployment-verification.md`           | DEPLOYMENT VERIFIED WITH FOLLOW-UP                                            |
| 2A.3 (historical integrity)    | `e6a25ab` | 2026-08-05 | `docs/operations/phase2a-historical-integrity-verification.md` | HISTORICAL INTEGRITY CONFIRMED                                                |
| 2A.4 (this closure)            | —         | 2026-08-05 | `docs/operations/td1-closure-summary.md` (this document)       | TD-1 CLOSED                                                                   |

Deployed artifact: Fly.io app `parmana-api`, release `v40`, image `registry.fly.io/parmana-api:deployment-01KZ7W5ZZF13WV46E6TBNTVFE6`, built from commit `6eff8ec`.

## 9. Closure Rationale

TD-1 is closed, not merely "fixed," because every layer of evidence this program's own instructions demanded has been independently satisfied, each at the level of evidence appropriate to it:

- **Repository evidence** (Phase 2A): the fix exists, is tested, and mutation-testing confirmed the regression tests actually detect the reintroduced gap.
- **Deployment evidence** (Phase 2A.2): the exact reviewed commit is confirmed running in production, via direct build-identity chain-of-custody and a live-captured startup log showing the fix's own warning message firing in the real process.
- **Production/operational evidence** (Phase 2A.2, Phase 2A.3): the fail-closed behavior was established from confirmed registry state and unchanged, previously-proven code paths (not merely asserted); the historical-data question — whether any _real_ party was ever handed fabricated evidence of a _real_ execution — was answered directly, with self-triggered, timestamp-correlated proof of database identity, and a finding of zero non-test-attributed records.

No unresolved condition remains from any of the four phases. Phase 2A.1's conditions were each individually satisfied (checklist completed, monitoring window observed, database identity resolved). Phase 2A.2's one follow-up (historical data) was resolved by Phase 2A.3. Nothing further is pending.

## 10. Date Closed

**2026-08-05** (Phase 2A.4).

## 11. Related Commits

- `6eff8ecbc67b2610ffd1cbcf8a94676bdec31981` — Phase 2A implementation
- `10c80644548015a27dbb5d5ce146150690768993` — Phase 2A.1 report
- `0c19f78a3fb7bfd9714051bf4623ff384fc41441` — Phase 2A.2 report
- `e6a25abb3a2d4fb5a1bc3967a6c5aa5dd68a317c` — Phase 2A.3 report
- Original finding: Phase 1H, `c3a29b5` (`docs(architecture): certify repository architecture (Phase 1H)`)

## 12. Related Reports

- `docs/architecture/repository-certification.md` — Phase 1H, original TD-1 finding (§4.9, Technical Debt Register)
- `docs/architecture/phase2a-production-connectors.md` — Phase 2A implementation report
- `docs/operations/phase2a-deployment-readiness.md` — Phase 2A.1 operational readiness review
- `docs/operations/phase2a-deployment-verification.md` — Phase 2A.2 deployment verification
- `docs/operations/phase2a-historical-integrity-verification.md` — Phase 2A.3 historical integrity verification
- `docs/architecture/execution-pipeline-report.md` — Phase 1E baseline, carries the original (later-corrected) claim about `MockConnector` and production bootstrap

## 13. Repository Locations Updated (Phase 2A.4)

- `docs/architecture/repository-certification.md` — TD-1 register row marked Closed; dated certification addendum appended
- `docs/architecture/execution-pipeline-report.md` — dated addendum appended, extending the existing Phase 2A note with the full evidence chain
- `docs/architecture/phase2a-production-connectors.md` — dated addendum appended, superseding the "remains present in the currently deployed environment" caveat
- `docs/operations/phase2a-deployment-verification.md` — dated addendum appended, noting the "WITH FOLLOW-UP" condition was resolved by Phase 2A.3
- `docs/operations/phase2a-historical-integrity-verification.md` — traceability pointer added to this closure summary
- `docs/operations/td1-closure-summary.md` — this document, newly created

**Not modified** (explicitly out of scope for this closure pass): `docs/VERIFICATION-GAPS.md` and `docs/ROADMAP-v1.md` track a separate, G-numbered gap register that includes an unrelated, still-genuinely-open item about independent _signal-state verification_ for `vendor-payment` (whether caller-declared signals like `vendorVerified`/`riskScore` are independently checked against a real system before execution) — a different concern from TD-1 (whether execution itself could be fabricated), using a different identifier, never tracked as "TD-1," and not addressed by Phase 2A. `docs/CLAIMS.md` contains one now-imprecise line (§ "create-connector-registry.test.ts... vendor-payment remains resolvable when razorpay is not," no longer accurate in production since Phase 2A) — noted here for visibility but not edited in this pass, as it falls outside this closure's explicitly named document set and warrants its own dedicated review given CLAIMS.md's size and separate maintenance conventions.
