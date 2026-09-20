# 02 — REMAINING

_The full forward roadmap. Snapshot: July 5, 2026._

> **Out of date.** For current status read [docs/REMAINING-WORK.md](docs/REMAINING-WORK.md) (2026-09-20). This file is kept as the July 5 snapshot.

Progress against the original vision: **~40% of the code, ~80% of the credibility** —
the provability layer is done; what remains is the unavoidability layer.

---

## Tier 0 — Immediate (days; mostly your side)

- [ ] **SECURITY GUARD — do not wire overrides**: `OverrideService`/`OverrideVerifier`
      must NOT be connected to any API route in current form — legacy
      SHA256-over-stringified-JSON, no canonical serialization, no nonce, no TTL,
      no approver authorization. Safe today only because unreachable from any
      route. Modernize to envelope discipline (canonical serialization, signed
      approver, nonce, TTL) before any exposure. Design parameters (roles,
      scopes, rate limits, un-overridable floors) to be set with first design
      partner — see `packages/runtime/src/policy/OverrideVerifier.ts` and
      `packages/runtime/src/services/override-service.ts`. Storage note: the
      Supabase ETR repository's override READ path was restored in the storage
      closeout session — if Item 1 of that session is ever reverted, appendOverride
      must be disabled with it, or round-tripped records with overrides will fail
      hash verification. Related: neither appendOverride nor appendExecution ever
      recomputes trustRecordHash (only appendVerification/appendReceipt are safe
      post-seal, since verifications/receipts sit outside the canonical hash) —
      appending an override or execution to an already-sealed record necessarily
      breaks its verification; any future override mechanism must incorporate
      overrides before sealing, or define a re-sealing protocol.
- [ ] **Close Session 8**: resolve the duplicated-`executableContent`-extraction deviation
      (consolidate to the single shared derivation, or prove drift is impossible with a
      cited test); apply the full CLAIMS.md set — corrected §2.16 (with the "requests that
      bypass the Gateway are not covered" clause), §3.3 sole-release-boundary, and the D2
      migration note.
- [ ] **Git hygiene / history purge**: `git filter-repo --path-glob '*.pem' --invert-paths` + force-push; delete or re-point the `v1.1.0-execution-permit` tag (advertises the
      reverted counterfeit hash); archive or make-private the old `pavancharak/parmana`
      repo — but first rescue its `policies/` directory into `parmana-exp` and update `.env`
      (local `.env` currently points `PARMANA_POLICY_DIR` at the old repo).
- [ ] **Record the 5-scenario demo** from example 04 — the design-partner opener.
- [ ] **CLAIMS.md and UNAVOIDABILITY-ARC.md need a status update**: credential-brokering
      moved from "not started" to "in-memory scaffold built (`execution-control`, 11
      tests)" — still [PARTIAL], not the finished claim. (Found while building the docs
      site, Session 9.)
- [x] **Enforcement severity decided 2026-09-20: uniform blocking, always on in production
      (G-47, gaps 57 and 58, `docs/VERIFICATION-GAPS.md`).** Original note follows. Open items now:
      G-50 (approver authority not scoped per policy) and G-51 (signals verified only for HubSpot).
      Older text: **Decide the enforcement severity policy before enforcement is ever turned on**: `PolicyGovernanceExecutionVerifier`
      currently blocks execution identically for a forged approval-record signature
      (`SIGNATURE_INVALID`, active tampering) and an honest process gap
      (`NO_APPROVAL_RECORD`/`CONTENT_MISMATCH`, e.g. a legitimate hotfix mid-rollout) — no
      graduated response exists. Not urgent today (the flag is off, blocked on the Tier 0
      legacy-policy backfill above), but this is exactly the kind of default a security team
      will ask about before a pilot, and it should be a deliberate choice, not whatever the
      uniform-blocking code happens to do today. Three options sketched in
      `docs/investigations/2026-09-15-evidence-anchor-gap-audit.md`'s GAP-5 addendum: keep
      uniform blocking (simplest, most conservative), graduate by severity (hard-block only
      on signature tampering, alert-and-continue on process gaps), or make it
      deployment-configurable. Pick one before flipping the flag, not after.

---

## Tier 1 — Near-term code (1–3 weeks)

- [ ] **Micro-session — fresh-clone correctness**: `PARMANA_POLICY_DIR` needs a
      repo-relative fallback (execution routes currently 500 on a bare clone); make
      Supabase repository construction lazy/config-guarded (currently throws at
      module-import before skip gates run — the hermetic exemption needs a dual env
      override to work).
- [ ] **Session 6 — Authority / Evidence check design** (Intent is already DONE — the
      gateway's content binding _is_ intent verification). Open honest question from the
      investigation: does an Authority check verify anything the signature check doesn't,
      before a key/authority registry exists? If not, Authority moves behind the KMS
      work and is not kept as vaporware.
- [ ] **Cleanup remnants**: orphaned Replay/Storage subsystems
      (`ReplayExecutor`/`ReplayPipeline` → `StorageEngine`/`AppendOnlyLedger`, unreachable
      from the live route); the `LedgerSerializer` replacer-array bug (dead code);
      resurrect `execution-failure.integration.test.ts` now that the gateway provides a
      clean failure-injection point.
- [ ] **Session 8-KMS Phase 1** — investigation only (interface impact of KMS-holds-the-key,
      which algorithms KMS supports, test strategy without live AWS in CI). The
      key-exposure incident is the business case.
- [ ] **Dev-environment note — npm workspaces cascade**: plain `npm run build`/`npm test`
      behave unpredictably on any machine whose `~/.npmrc` sets `workspaces=true`
      (cascades into every workspace's own non-order-aware script instead of the root's).
      Not a repo defect — each developer should verify `npm config get workspaces` returns
      null/false. Discovered during audit closeout.
- [ ] **TypeScript build config gap — execution-system and receipt**: both packages lack
      `composite`/`tsBuildInfoFile` settings that every sibling package has; a stray
      `tsconfig.tsbuildinfo` can survive a dist/-only clean and silently skip recompilation
      — the same failure class as the stale-dist incident (MUST-FIX-1, GAP-AUDIT.md).
      Micro-edit: align both tsconfigs with the sibling pattern.
- [ ] **No CI for the TypeScript path**: only `.github/workflows/python-sdk.yml` exists; the
      TS suite and the stale-dist freshness guard (`scripts/check-dist-fresh.ts`) run only
      via local pretest. Micro-session: add a GitHub Actions workflow running install →
      check-dist-fresh → build → full test sweep on push/PR.
- [ ] **Supabase collection-ordering determinism**: the four collection queries in
      `SupabaseExecutionTrustRecordRepository.findByTransactionId` apply no `.order(...)`;
      Postgres guarantees no row order without ORDER BY, and `CanonicalSerializer` preserves
      array order — so a Trust Record with 2+ overrides or 2+ executions can fail hash
      verification purely from row-return order (false integrity failure). Dormant while
      records seal with single-element collections. Micro-fix:
      `.order("created_at", { ascending: true })` on all four queries plus a documented
      stable tiebreak (secondary sort on the ID column) matched to write-time insertion
      order; add a 2-element round-trip test.
- [ ] **TS client SDK parity + tests**: missing endpoints vs Python's near-parity — GET /,
      GET /version, POST /transactions, GET /receipt/latest/:id, POST /verify (the TS SDK's
      only Verification method today, renamed to `getLatestVerification` in the API
      hardening micro-session, maps to GET /verification/:id — there is no TS equivalent of
      Python's fresh-verify `.verify()` / POST /verify at all). Also: all 9
      `typescript/test/*.test.ts` files are empty stubs (0 bytes each) — `vitest run`
      reports passes trivially. Decide parity scope with the first integrating partner
      before building either.
- [ ] **Version-number convention**: three disconnected version numbers exist today —
      root `package.json` says `0.1.0`, the latest git tag is `v1.0.0`, and the `/version`
      endpoint (`packages/api/src/routes/version.ts`) hardcodes `0.4.0`, read from none of
      the others. Micro-decision: pick one source of truth (likely `package.json`, read at
      build or boot time) and derive the other two from it instead of hand-maintaining
      three numbers independently.
- [ ] **Dead code — orphaned signal validation**: `SignalValidationError`
      (`packages/policy/src/errors/SignalValidationError.ts`) is imported and
      instanceof-checked in `packages/api/src/middleware/error-handler.ts` but nothing in
      the live execution path ever throws it — `packages/policy/src/SignalValidator.ts`
      (the only class that throws it) has no callers anywhere in the codebase. Separately,
      `packages/runtime/src/policy/SignalValidator.ts` is a second, unrelated
      implementation (throws plain `Error`, not `SignalValidationError`) that is also
      never imported by anything. Confirmed by grep during the API hardening
      micro-session (2026-07-08); a follow-up micro-edit should remove both dead classes
      after re-confirming no caller was added since.

---

## Tier 2 — The big rocks (months; the future-tense claims)

Each converts one currently-future claim into present tense.

- [ ] **KMS / HSM key custody** (~1–2 wks after investigation)
      → _"Parmana's signing key cannot be exfiltrated from the application process."_
      Also retroactively hardens every existing signature claim, and closes the incident
      class that produced the key exposure.

- [ ] **Credential brokering — one system class, AWS STS first** (~4–8 wks; shape with a
      design partner) → _"For [action class] on AWS, AI never possesses execution
      credentials."_ This is the architectural leap from "authorizes with proof" to
      "AI cannot act alone." Extending the envelope with resource/action fields is a
      signed-artifact schema change — a dedicated versioned session, never a rider.

- [ ] **Reference deployment + bypass detection** (per-deployment; needs a partner's red
      team) → _"Non-bypassable per integrated system under the reference deployment;
      bypass detected everywhere."_ Includes network-policy templates and a reconciliation
      loop comparing downstream activity against issued authorizations. The unscoped
      "non-bypassable, period" stays permanently unclaimable (break-glass/legacy paths).

- [ ] **Nonce store persistence** (Redis/Supabase-backed `NonceStore`)
      → fleet-wide single-use, beyond per-process. TTL bounds the persistence window.

---

## Tier 3 — Business track (parallel, not code)

- [ ] Update the deck to "with proof" positioning; retire the forbidden phrasings AND the
      now-dead "six-stage verification pipeline" language.
- [ ] Brief Mohinder & Abhigna from `docs/CLAIMS.md` — especially the mandatory
      conditional-clause rule (partnerships conversations are where claims get rounded up).
- [ ] **Start design-partner conversations now** — do not wait for the code. Session 9
      (credential brokering) should be shaped against a real partner's workflow, so the
      partner search is itself a prerequisite for the next big code rock.

---

## The permanent ceiling (never claimable, and say so proudly)

- **"Non-bypassable, period"** — break-glass, SSH, vendor consoles, and legacy static
  credentials are load-bearing enterprise requirements, not gaps. Ceiling forever:
  "non-bypassable per integrated system under the reference deployment."
- **"Universal"** — credential brokering is per-system-class; each integration is earned.
- **"The policy is correct"** — Parmana proves rules were followed, never that they were
  wise. Stating this openly is what makes everything else believable.

---

## Suggested order

Tier 0 → micro-session (fresh-clone correctness) → Session 6 (Authority/Evidence design)
→ cleanup remnants → KMS Phase 1 → KMS build → **partner conversations running in
parallel throughout** → credential brokering shaped by a real partner → reference
deployment proven by their red team.
