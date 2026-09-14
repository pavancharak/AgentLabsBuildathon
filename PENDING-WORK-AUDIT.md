# Pending Work Audit Report

**Repo:** parmana-exp
**Current commit:** `eaf373e748f52efd6c84f067b670650ae6b147e1`
**Branch:** main
**Remote status:** origin/main and backup/main both at `eaf373e` — fully pushed, nothing local ahead
**Date:** 2026-09-06

---

## Gap Status

| Gap                                            | Status    | Commit    | Tests                                                                                         |
| ---------------------------------------------- | --------- | --------- | --------------------------------------------------------------------------------------------- |
| #1: boundSignals coverage validation           | **FIXED** | `8a81dd8` | `PolicyValidator.test.ts`, `PolicyRouter-boundSignals-coverage.test.ts`                       |
| #2: RuntimeEngine optional-protections logging | **FIXED** | `1f479ff` | `optional-protections-logging.test.ts`                                                        |
| #3: Razorpay stale references                  | **FIXED** | `cf7909c` | N/A (cleanup, not behavior)                                                                   |
| #4: Caller re-check at connector layer         | **FIXED** | `806d6aa` | `connector-policy-granted-capability.test.ts`                                                 |
| #5: Per-caller audit chain                     | **FIXED** | `b752ff1` | `supabase-caller-audit-sink.test.ts`, `caller-audit-chain-verifier.test.ts`, integration test |

All 5 verified directly against current code this pass (not from memory): `findUncoveredFacts` exists in `PolicyValidator.ts` and is called from `PolicyRouter.ts`; `runtime_engine_constructed` log line exists in `RuntimeEngine.ts`; zero stale Razorpay references remain in source (3 hits found are deliberate historical "why" narration citing real incidents, not stale claims); `grantedCapability` check exists in `ConnectorPolicy.ts` (4 references); `pg_advisory_xact_lock` and `CallerAuditChainVerifier` both exist and are wired.

**Note on Gap #4's real location:** the prompt that originally described this gap assumed a `ConnectorExecutionGateway.ts`/`packages/execution-authority-gate` architecture that does not exist in this repo. The actual, correctly-scoped fix lives in `packages/execution-control/src/ConnectorPolicy.ts` (`DefaultConnectorPolicy.assertAllowed()`), checking a `grantedCapability` field signed into `ExecutionAuthorizationPayload` — see `docs/CLAIMS.md` §2.31 for the full, honestly-scoped design (explicitly framed as defense-in-depth against a _future_ code path, not a fix for a live exploit).

---

## Documentation Status

| Document                                                 | Status               | Completeness                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/CLAIMS.md`                                         | **COMPLETE**         | 48 numbered `§X.Y` sections; citation-integrity test (`documentation-references.test.ts`) passes **276/276** checks (this count grows as content is added — 276 is current, not a fixed target of 274)                                                                                                             |
| `docs/site/trust-and-claims/objections-and-evidence.mdx` | **EXISTS, COMPLETE** | ~48 table rows across 5 domains (Authorization, Credentials, Audit Trail, Fail-Closed Behavior, Performance), each following objection → evidence → test citation, with explicit "Honest limit" rows where nothing closes the objection                                                                            |
| `docs/site/trust-and-claims/what-we-dont-claim.mdx`      | **EXISTS, COMPLETE** | Documents permanent refusals (§5: no guaranteed regulatory compliance, no absolute unauthorized-execution prevention, etc.), scoped-claim caveats (envelope verification, single-use nonce scope, credential isolation scope), and no-KMS/HSM key management — honest about limitations, not new content this pass |

No broken citations found. No sections lack test citations in a way the automated check would miss (the check validates every backtick-quoted file path and every `CLAIMS.md §X.Y` cross-reference across `CLAIMS.md`, `README.md`, `DEPLOYMENT.md`, `SECURITY.md`, and the full `docs/site/**/*.mdx` tree).

---

## Test Status

- **Full suite:** 1499 passed, 39 skipped, 1 file failed on the first parallel run
- **The 1 failure is a confirmed pre-existing flake**, not a regression: `typescript/test/integration/examples.integration.test.ts` fails intermittently under full-suite parallel load (resource contention, likely simultaneous port binding) and passes cleanly every time run in isolation — reconfirmed this pass.
- Gap-related test files, all passing: `PolicyValidator.test.ts`, `PolicyRouter-boundSignals-coverage.test.ts`, `optional-protections-logging.test.ts`, `connector-policy-granted-capability.test.ts`, `supabase-caller-audit-sink.test.ts` (13 cases), `caller-audit-chain-verifier.test.ts` (5 cases), `audit-event-crypto.test.ts`, `authorization-signing-performance.test.ts`, `execution-pipeline-latency.test.ts`.

---

## Actually Pending Work

### Work to Do

- Nothing from the 5 gaps above — all fixed, tested, documented, committed, pushed.
- Two items explicitly identified and left open by design, not oversight:
  1. `CallerAuditEvent` chain doesn't catch an entire caller's history deleted at once, or cross-caller reordering (stated limit of the per-caller design, `docs/CLAIMS.md` §2.32).
  2. Key compromise: no automated key rotation, no HSM/KMS-backed `KeyProvider` — an accepted, operationally-mitigated risk, not a code gap (`what-we-dont-claim.mdx`, `objections-and-evidence.mdx` Domain 1).
- **Phase 1/2 requirements mapping** (`regulatory.md`, commit `eaf373e`) is blocked on real FCA/NFRA/investor requirements documents, which do not exist in this repo or conversation yet.

### Work Already Done

- All 5 gaps above (commits `8a81dd8`, `1f479ff`, `cf7909c`, `806d6aa`, `b752ff1`).
- `docs/CLAIMS.md` §2.30, §2.31, §2.32 documenting the above.
- `docs/site/trust-and-claims/objections-and-evidence.mdx` — full evidence index built from 4 parallel research passes across ~41 real objections (not the fabricated 52-scenario plan originally proposed).
- `docs/site/concepts/caller-audit-trail.mdx` — new reference page for the audit-chain subsystem, which previously had none.
- `docs/site/changelog.mdx` — backfilled with all commits from this session.
- 2 pre-existing lint issues fixed (`373402a`), unrelated to the above.

---

## Recommendation

**Next steps:**

1. Nothing blocking from a code/documentation standpoint — the 5 known gaps are closed.
2. If Series A or regulatory conversations need a live coverage matrix against _specific_ requirements: provide the actual FCA Supercharged Sandbox criteria, NFRA requirements, or investor checklist (see `regulatory.md`'s blocking condition) — nothing can be honestly mapped without them.
3. Optional, not blocking: decide whether to invest in the two explicitly-accepted-risk items above (cross-caller audit chain reordering detection; KMS/HSM key management) — both are real, both are non-trivial (schema/architecture changes), neither is currently claimed as solved.

**Series A readiness (engineering-evidence angle):** the codebase's own claims are internally consistent, tested, and honestly scoped — CLAIMS.md and the evidence-index page are real, checkable artifacts an investor's technical diligence could verify by cloning and running `npm test`. Whether that satisfies a specific investor's checklist is unknowable without that checklist.

**Jan 1 deadline readiness:** not assessable from this repo alone — this audit found no code-level blocker among the 5 known gaps, but the "Jan 1, 2027" RBI-deadline framing referenced in prior conversation turns was never substantiated with an actual regulatory document in this session, so no honest readiness verdict can be given against it.
