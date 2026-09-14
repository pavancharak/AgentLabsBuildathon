# Phase 2A.2 — Controlled Production Deployment & Post-Deployment Verification

Executes and verifies the production deployment of Phase 2A, approved after Phase 2A.1's independent operational readiness review (`docs/operations/phase2a-deployment-readiness.md`, recommendation: READY WITH CONDITIONS, explicitly accepted by Pavan for this deployment). This is a deployment and verification phase, not an implementation phase — no application code was modified during this phase.

---

## Preconditions Verified Before Deploying

**Repository state, confirmed clean:**

```
git status          → clean, no uncommitted changes
git log --oneline -5:
  10c8064  docs(operations): independent readiness review before Phase 2A redeploy
  6eff8ec  fix(production): remove MockConnector from production bootstrap (Phase 2A)
  ...
```

Phase 2A (`6eff8ec`) and Phase 2A.1 (`10c8064`) both committed.

**Phase 2A.1's three explicit conditions, quoted and individually addressed:**

1. _"Complete the deployment checklist in §8 in full, in order, including the rollback decision point."_ — This condition is executed by this very phase: §8's checklist items map directly onto the Post-Deployment Verification sections below (build identity, connector registration, fail-closed check, logs, rollback decision), all completed in order and recorded here.
2. _"Treat the first monitoring window post-deploy as the resolution mechanism for the §4.5 uncertainty..."_ — Executed: see §6 (Production Monitoring) below; no `payments:execute` traffic appeared in the observation window, consistent with §3's prediction.
3. _"If practical, resolve the database-identity question directly..."_ — Attempted: see §7 (Historical Data Integrity Status) below. Narrowed but not fully closed.

**Other preconditions:**

- Rollback plan: exists (Phase 2A.1 §7), with the exact pre-deploy image identified.
- Production backup: not independently re-verified this session (Supabase-managed backups assumed baseline, as in Phase 2A.1); irrelevant to deploy risk since Phase 2A makes no schema/data change.
- **Deployment approval: obtained.** Pavan's message explicitly states: _"I have reviewed the Phase 2A.1 Operational Readiness Report... I accept the documented deployment conditions and residual operational risk... You are approved to proceed with Phase 2A.2."_

## 1. Deployment Summary

Deployed the exact reviewed Phase 2A commit to `parmana-api` on Fly.io via a dedicated git worktree checked out at that commit (not the repository's working directory, which was one commit ahead — see §2), to guarantee byte-for-byte artifact identity with what Phase 2A.1 reviewed. Both production machines updated via Fly's standard rolling-deploy strategy; one machine additionally restarted post-deploy to capture direct startup-log evidence (§4).

## 2. Commit Deployed

**Deployed commit:** `6eff8ecbc67b2610ffd1cbcf8a94676bdec31981` (`fix(production): remove MockConnector from production bootstrap (Phase 2A)`) — the exact commit Phase 2A.1 reviewed.

**Note on repository HEAD vs. deployed commit:** at deploy time, `main`'s HEAD was `10c8064` (Phase 2A.1's report, one commit ahead of `6eff8ec`). Rather than deploying HEAD and treating the discrepancy as approximate, a git worktree was created at the exact commit `6eff8ec` (`git worktree add <path> 6eff8ec`), verified clean (`git status --porcelain=v1 -uall` → empty) and at the exact SHA, and the deploy was run from inside that worktree. `git diff --stat 6eff8ec..HEAD -- . ':!docs/operations'` was also run beforehand and confirmed zero difference outside `docs/operations/` — i.e., even had HEAD been deployed instead, the built artifact would have been identical, since documentation changes don't enter the Docker build. This is stated for completeness, not because it was relied upon: the deploy was performed from the exact reviewed SHA specifically, not from HEAD.

**No additional commits included; no uncommitted changes** — confirmed by the worktree's clean `git status` immediately before running `flyctl deploy`.

## 3. Deployment Evidence

| Field                              | Value                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment target                  | Fly.io app `parmana-api` (`fly.toml`: `app = 'parmana-api'`)                                                                                                                                                                                                                                       |
| Deployment command                 | `flyctl deploy --app parmana-api`, run from the `6eff8ec` worktree                                                                                                                                                                                                                                 |
| Deployment start                   | 2026-08-05T02:31:17Z (pre-deploy state captured)                                                                                                                                                                                                                                                   |
| Deployment completion              | 2026-08-05T02:33:58Z (both machines confirmed `started`, health checks passing)                                                                                                                                                                                                                    |
| New release                        | `v40`, `registry.fly.io/parmana-api:deployment-01KZ7W5ZZF13WV46E6TBNTVFE6`                                                                                                                                                                                                                         |
| Previous release (rollback target) | `v39`, `registry.fly.io/parmana-api:deployment-01KZ3ZJEXK4RFV440R84E4E2S9` (unchanged from Phase 2A.1's identification)                                                                                                                                                                            |
| Deployment result                  | **Success** — both machines (`2867e1ef14d648`, `6830243f236d98`) reached `started` state, 1/1 health checks passing, confirmed via `flyctl status` and `flyctl image show` (both machines report identical image digest `sha256:72ef1f662b852de6fdc7492ccbeac011d3847882865da8d8727c9cb55754e859`) |

One transient warning appeared during the rolling update (`"The app is not listening on the expected address..."`) immediately followed by `"Machine ... is now in a good state"` for the same machine — consistent with a health-check race during the brief window before the new process bound its port, not a persistent condition; both machines were confirmed healthy seconds later and remained so through the entire verification window.

Build identity is additionally supported by direct chain-of-custody: this session personally created the worktree, verified its SHA and clean status, invoked the deploy from inside it, and observed the full Docker build log (`COPY packages ./packages`, `RUN npx tsc -b`, etc.) execute against that exact tree.

## 4. Connector Registration Verification

**MockConnector is NOT registered — confirmed by direct production runtime evidence**, not inference. `flyctl logs`'s buffer did not retain logs back to the original rolling-deploy boot time, so machine `6830243f236d98` was restarted (`flyctl machine restart`, a routine, low-risk operation already proven safe seconds earlier during the deploy's own rolling restart) specifically to capture a fresh startup log. The captured production log, verbatim:

```
event: 'vendor_payment_connector_unavailable',
reason: 'No real vendor-payment implementation exists outside NODE_ENV=test;
payments:execute is not registered in production rather than being served by
MockConnector (Phase 2A — see docs/architecture/phase2a-production-connectors.md).'
```

This is the exact `console.warn` call written into `createConnectorRegistry.ts` by Phase 2A, now confirmed firing in the live production process. **✓ MockConnector is not registered. ✓ `payments:execute` has no production mock — confirmed directly, not inferred from source code alone.**

Both machines run the identical image (§3), so this finding applies to both, though only one was directly observed at boot (restarting the second machine solely to duplicate this observation was judged unnecessary — the least-destructive-verification principle argues against redundant production restarts once the image identity is already confirmed).

## 5. Fail-Closed Verification

**No live authenticated `payments:execute` HTTP request was made against production.** This session does not hold a valid production caller API key (`PARMANA_API_KEYS` is a Fly secret, not retrievable), and obtaining or guessing one to test this would itself be an inappropriate, unauthorized production action — explicitly the kind of "unsafe production operation" this phase's instructions prohibit. This is stated directly rather than glossed over.

**The least-destructive, legitimately-available verification was used instead: direct log evidence combined with deterministic code tracing, not speculation.**

1. §4's production log confirms `vendor-payment` is not present in the connector registry.
2. `GatewayConnectorRegistry.resolveCapability()` (`packages/execution-gateway/src/connector-execution/GatewayConnectorRegistry.ts:152-168`) is a closed, deterministic loop over registered connectors; with `vendor-payment` absent (confirmed, §4), any call with `capability: "payments:execute"` **must** reach the function's final `throw new Error("No connector registered for capability 'payments:execute'.")` — there is no other code path.
3. `ExecutionControlService.execute()` calls this synchronously with no surrounding `try`/`catch` (traced and quoted in Phase 2A's own report, re-confirmed unchanged by this deploy since `packages/execution-control/src` was not touched by Phase 2A), so the throw occurs before session creation, before credential issuance, before any audit "session.created" event.
4. `RuntimeEngine.execute()`'s only catch block re-throws rather than swallowing (also unchanged).
5. This exact mechanism was mutation-tested in Phase 2A (`git stash` the fix, confirm tests fail, restore, confirm they pass) and is the same mechanism already relied on for Razorpay/HubSpot's fail-closed behavior in this same production process — HubSpot's `hubspot_connector_unavailable` warning fired in the very same startup log (§4), and Razorpay's connector registered successfully (no warning), demonstrating the identical registration-guard code executing correctly for all three connectors side by side, in production, at the same boot.

**✓ No Trust Record can be created** (persisted only after `RuntimeEngine.execute()` returns successfully; it cannot, given 2-4 above). **✓ No Receipt can be created** (reached only after a persisted Trust Record). **✓ No vendor evidence can be created** (no connector is ever invoked). **✓ No fabricated success is possible** (the request throws before any success artifact exists). This conclusion is deterministic given §4's confirmed registry state, not an assumption about behavior — the same standard of evidence Phase 2A's own tests were held to.

## 6. Production Monitoring

Reviewed post-deploy logs across both machines (live tail and `--no-tail` buffer) for: deployment logs, application logs, startup warnings, connector warnings, runtime errors.

- **Startup warnings:** `vendor_payment_connector_unavailable` (expected, §4) and `hubspot_connector_unavailable` (pre-existing, confirmed unrelated to this deploy — `flyctl secrets list` shows no `HUBSPOT_PRIVATE_APP_TOKEN` configured, identical to Phase 2A.1's finding).
- **Runtime errors:** none found (`grep -iE "error|fail|warn|500|payments:execute"` across the live log window, excluding the routine settlement-poller's own `failed: 0` counter field, returned no matches).
- **One transient, self-correcting anomaly:** immediately after the machine restart (§4), the first `razorpay_settlement_poll_tick` reported `failed: 17` (vs. the steady-state `failed: 0`); the next tick, 7 seconds later, and every tick after it through the end of the observation window reported `failed: 0`, matching both the other machine's continuous behavior and the pre-deploy baseline from Phase 2A.1. Consistent with a cold-start settlement-queue re-evaluation, not a regression.
- **`payments:execute` traffic:** none found. No request, successful or failed, referencing this capability appeared anywhere in the observed log window (live tail from ~02:35:47Z through ~02:39:40Z, plus the full restart/boot sequence of `6830243f236d98`). This is the specific signal §3 of Phase 2A.1 predicted ("no evidence found of any production workflow depending on `payments:execute`") and the specific signal this deploy's condition #2 asked to be monitored for.

**No caller, no endpoint hit, no outcome to document for `payments:execute` — because none occurred in the observation window.**

## 7. Historical Data Integrity Status

Phase 2A.1 classified this **C. Unable to Certify**, because the Supabase database this session could query (credentials in `.env`, documented there as backing "live integration tests") could not be confirmed as the same database backing production's `DATABASE_URL`/`SUPABASE_URL` Fly secrets.

**New evidence obtained this session, attempting to resolve condition #3:**

- The Supabase CLI (`supabase`, authenticated) was available and was not used in Phase 2A.1. `supabase projects list` returned exactly two projects on this account: `REDACTED-PROJECT-REF`, named **"REDACTED-PROJECT-NAME"**, region `ap-southeast-2`, created `2026-06-17` — and `REDACTED-SANDBOX-PROJECT-REF`, named **"REDACTED-SANDBOX-NAME"**, region `ap-south-1`, created `2026-08-04` (the day before this deploy), not linked to this repository.
- `REDACTED-PROJECT-REF`'s host (`db.REDACTED-PROJECT-REF.supabase.co`) is the **exact same host** as the `DATABASE_URL` found in the local `.env` (already known from Phase 2A.1) — this CLI lookup independently corroborates that hostname's project identity and name for the first time.
- This repository's own `supabase/.temp/linked-project.json` (CLI-generated local state, not committed) confirms this repository's Supabase CLI is linked specifically to `REDACTED-PROJECT-REF` ("REDACTED-PROJECT-NAME"), not the sandbox project.
- `flyctl ssh console` was retried (attempting to read production's actual resolved `DATABASE_URL`/`SUPABASE_URL` environment variables directly, redacting credentials before display) and **failed again**, identical error to Phase 2A.1 (`websocket: failed to WebSocket dial... connection attempt failed`) — confirmed as a persistent network/tunnel limitation of this environment across two independent sessions, not a transient or permissions issue. Not retried a third time, per this review's own guidance against rabbit-holing on a repeatedly-failing tool call.
- No mechanism was found to compare Fly's secret digests (`flyctl secrets list` shows digests, not values, with an undocumented hashing scheme) against a locally-computed value, so this avenue remains closed.

**Classification: Still Unable to Certify.** The uncertainty is narrower than Phase 2A.1 left it — this is now known to be the one Supabase project this repository's own tooling associates with itself, distinctly named apart from the separate, newer "sandbox" project, rather than an anonymous database of unknown relationship — but "narrower" is not "closed." No mechanism available to this session could produce a byte-for-byte confirmation that Fly's production `DATABASE_URL` secret resolves to this project. The database's _content_ was not re-queried this session (nothing in this deployment would have changed it, and Phase 2A.1's findings — 18 `payments:execute` records, 100% test-attributed — stand unchanged).

**Recommended follow-up to close this fully:** a one-step confirmation from whoever manages the Fly/Supabase organization (`REDACTED-ORG-SLUG`) that project `REDACTED-PROJECT-REF` ("REDACTED-PROJECT-NAME") is or isn't what `parmana-api`'s `DATABASE_URL`/`SUPABASE_URL` secrets point to — now a much narrower, specific question than Phase 2A.1 could pose.

## 8. Rollback Decision

**Decision: Continue operating. No rollback.**

Evidence supporting this decision:

- Build identity confirmed (§3).
- Connector registration confirmed correct — MockConnector absent, exactly as intended (§4).
- Fail-closed behavior confirmed deterministic, given §4's evidence (§5).
- Existing production behavior (health, Razorpay connector registration, HubSpot's pre-existing unavailable state, settlement poller) all unchanged from pre-deploy baseline except the one intended change (§6).
- Zero `payments:execute` traffic, zero errors, zero unexpected warnings in the observation window (§6).
- No rollback trigger from Phase 2A.1 §7 fired (no real-caller impact reported, no elevated error rate, no unrelated regression).

None of the three rollback triggers defined in Phase 2A.1 §7 have occurred. The rollback plan (image `deployment-01KZ3ZJEXK4RFV440R84E4E2S9`, `flyctl deploy -a parmana-api --image registry.fly.io/parmana-api:deployment-01KZ3ZJEXK4RFV440R84E4E2S9`) remains documented and ready if needed later.

## 9. Remaining Operational Risks

- **Database-identity question (§7)** remains open, narrower but unresolved. If it's later confirmed that the queried database is _not_ production, the Historical Data Integrity Assessment reverts to fully unexamined for the real production store, and a fresh assessment against the actual production database would be warranted.
- **Observation window is short** (this session's monitoring covers roughly the 10 minutes following deploy, not a full business cycle). Continued passive monitoring for `payments:execute` traffic and the `vendor_payment_connector_unavailable` warning's rate over the following days is prudent, consistent with Phase 2A.1's condition #2, though nothing in this session's evidence suggests it's necessary to block on.
- **`VENDOR_PAYMENT_TOKEN` Fly secret is now orphaned** — it was never consumed by `MockConnector` even before this fix (MockConnector ignores credentials entirely) and now backs a capability that isn't registered at all. No security or operational risk (unused secrets don't grant capability), just housekeeping; not addressed in this phase as it's outside this phase's scope (deployment verification, not cleanup).

## 10. Final Recommendation

**DEPLOYMENT VERIFIED WITH FOLLOW-UP.**

Not an unconditional **DEPLOYMENT VERIFIED**, specifically because one item from the Final Recommendation's required list cannot be fully demonstrated:

| Requirement                                                  | Status                                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployed commit exactly matches the reviewed commit          | ✓ — `6eff8ec`, deployed from a verified-clean worktree at that exact SHA (§2, §3)                                                                                                                                                                   |
| Deployment succeeded                                         | ✓ (§3)                                                                                                                                                                                                                                              |
| MockConnector absent from production                         | ✓ — confirmed by direct production log evidence, not inference (§4)                                                                                                                                                                                 |
| Fail-closed behavior verified                                | ✓ — deterministically, from confirmed registry state plus unchanged, previously-tested code paths (§5); **not** verified by an actual live authenticated HTTP call, which this session correctly declined to attempt without legitimate credentials |
| No unexpected operational impact                             | ✓ — no errors, no unexpected traffic, one transient self-correcting anomaly explained (§6)                                                                                                                                                          |
| No production security regression                            | ✓ — no security-relevant code touched; connector-registration behavior change only                                                                                                                                                                  |
| No rollback criteria triggered during the observation window | ✓ (§8)                                                                                                                                                                                                                                              |

**Why "WITH FOLLOW-UP" rather than an unconditional verified:** the Historical Data Integrity Assessment (§7) remains **Still Unable to Certify** — narrowed by new evidence this session (the Supabase CLI project-identity finding), but not closed. This mirrors Phase 2A.1's own instruction precedent (an Unable to Certify classification changes the recommendation tier) and this phase's explicit rule not to infer success where evidence is incomplete. Every other requirement is fully satisfied with direct evidence; this is the one specific, narrow, named gap.

**Required follow-up:** the one-step organizational confirmation named in §7. No code, configuration, or deployment action is required — this is a documentation/confirmation step that, once obtained, converts this report's §7 classification to Confirmed Clean (expected, given all `payments:execute` records found are test-attributed) and would let the record be updated accordingly without any further deployment action.

---

**Addendum (2026-08-05, Phase 2A.4):** the follow-up named above has since been completed. Phase 2A.3 (`docs/operations/phase2a-historical-integrity-verification.md`) resolved the database-identity question directly against production evidence (production's own `/ready` endpoint's `SELECT 1` observed, timestamp-correlated, in the historically-queried database) and classified the historical record **HISTORICAL INTEGRITY CONFIRMED** — zero non-test-attributed records. TD-1 is now closed; canonical evidence chain in `docs/operations/td1-closure-summary.md`. This report's own findings and evidence above remain accurate and unedited as the record of what Phase 2A.2 itself verified.
