# R&D Evidence Dossier

*Draft — DPIIT Deep Tech recognition application*
*Status: DRAFT. This is an index of citable, checkable artifacts already in the repository —
not a spend statement (that's a separate, still-TODO deliverable requiring real ₹/headcount
figures from Pavan/finance). Every line below names a file, commit, or section a DPIIT reviewer
can open and verify directly.*

## Purpose

DPIIT's Deep Tech scrutiny looks for R&D *intensity* and iterative technical refinement, not
just a finished product. This document collects the evidence already sitting in the repository
that speaks to that — organized so a reviewer (or Pavan, assembling the final application) can
go straight to the source rather than take a narrative's word for it.

## 1. Development velocity and iteration discipline

- **233 commits** from the first commit (`ba7bc45`, 2026-06-25) to now (2026-08-25) — roughly
  two months of active engineering, against an incorporation date of April 20, 2026
  (see [03-LONG-GESTATION-ARGUMENT.md](./03-LONG-GESTATION-ARGUMENT.md)).
- **A numbered, tracked technical-debt and gap-finding discipline** running from at least G-1
  through G-29 (`docs/VERIFICATION-GAPS.md`, plus commit `822d65f`, "feat: durable audit trail
  for structural validation rejections (G-29)") — each entry cites the specific file/line/test
  that closes it, not a checkbox with no evidence.
- **A mid-flight architecture refactor** (commit `f399ff5`, 2026-08-04, "refactor: remove
  production execution layer from connector packages") — the team restructured core
  infrastructure after it was already working in production, rather than accumulating debt
  around a weak foundation. This kind of refactor is a normal and expected marker of real R&D,
  not routine feature delivery.
- **Two internal audit documents totaling ~1,500 lines** (`docs/AUDIT_SECURITY.md`, 774 lines;
  `docs/AUDIT_TESTS.md`, 738 lines) — self-conducted but methodologically explicit (see §3 below),
  with severity tiers (blocks-pilot / pre-production / cosmetic) and citations for every finding.

## 2. Testing rigor

- **1,313 automated tests** across the workspace (1,274 passed, 37 skipped — Supabase/live-
  credential-gated suites that skip cleanly with no credentials configured — 2 pending, 0
  failed), re-verified 2026-08-24 via a JSON-reporter run rather than trusting a summary line
  (`README.md`; `docs/VERIFICATION-GAPS.md` finding G-24).
- Tests span unit, integration, and **live production API** tiers — not simulated. The HubSpot
  integration tests exercise HubSpot's actual production API with a real, non-destructive
  read-nudge-revert mutation on a real account (`docs/CLAIMS.md` §3.10); the (now-removed,
  historically retained) Razorpay tests did the same against Razorpay's live-mode API with real
  money (`docs/CLAIMS.md` §3.8–§3.9).
- Explicit acknowledgment of test-environment fragility as a tracked gap, not a hidden one:
  `docs/VERIFICATION-GAPS.md` G-3 documents that whether Supabase-gated tests run against a real
  database or skip silently depends on local environment state, with no signal in the test
  output — flagged and tracked rather than glossed over.

## 3. Security-audit findings (self-conducted, independently re-verified)

- **A live, reproducible execution-authorization bypass, found and fixed in the same session**
  (commit `5605928`, "fix: bind policy signals to executed intent, closing an execution-
  authorization bypass"). Before the fix, a caller could declare a small, fully-verified action
  while a different action executed — a structural gap in how policy signals were bound, not a
  configuration mistake. The fix (`Policy.boundSignals`, `SignalIntentBinder`) is the strongest
  single piece of evidence in this dossier: it demonstrates the team can find a real exploit in
  its own system and close it structurally, which is the kind of technical uncertainty DPIIT's
  "long development cycle" language is meant to capture.
- **An independent, from-scratch source-code audit** of whether any registered capability can
  become real-world execution without satisfying institutional authorization — for every
  capability the system exposes, regardless of caller type — tracing the actual execution path
  rather than trusting function or comment names
  (`docs/architecture/strategic-positioning-validation.md`). Verdict: directly validated for
  production-registered capabilities, with caveats stated explicitly rather than smoothed over.
- **A four-pass, self-adversarial re-certification** of the "even with valid credentials, an
  agent cannot execute anything not authorized" claim (`docs/CLAIMS.md`, phase2k/phase2l/phase3d
  architecture docs cited around line 757–837) — each pass treated the prior pass's conclusion as
  a claim to re-verify, not inherit, and the fourth pass changed the verdict based on a structural
  code change (`payments:execute` removed entirely) rather than re-asserting the same finding.
- **A publicly disclosed key-compromise incident, handled transparently**: the default signing
  key was exposed in a separate Parmana Systems GitHub repository before 2026-07-05; this
  repository's own history never carried the exposure, but `docs/CLAIMS.md`'s "Key Compromise
  Notice" documents the exposure, the rotation, and voids every signature from the compromised
  key regardless of when it was produced — the kind of disclosure discipline that supports the
  documentation-rigor argument to a regulator.

## 4. Architecture and implementation depth

- Thirteen independently versioned packages implementing the authorize → verify → execute →
  confirm chain (full list and roles in `README.md`), each with its own test suite.
- Fail-closed configuration as a stated and tested architectural property (a misconfigured
  process refuses to start rather than degrade silently) — not asserted, checkable in the
  bootstrap code (`packages/api/src/bootstrap/`).
- Dual cryptographic signing support, classical and post-quantum (`@parmana/crypto`: Ed25519
  default, ML-DSA-65 configurable) — evidence of building for a multi-year cryptographic horizon,
  not just current standards.
- Three production-registered connectors as of this writing (`test-fixture`, `hubspot`,
  `github` — `packages/api/src/bootstrap/createConnectorRegistry.ts`), each proving the same
  unmodified authorization core against a genuinely different external system's credential and
  API model.

## 5. What this dossier does NOT include (explicit gaps)

- **R&D spend figures** (₹, headcount-months) — not derivable from the repository; needs a real
  statement from Pavan/finance. See the still-open checklist item in
  [DEEP-TECH-APPLICATION-PROMPT.md](./DEEP-TECH-APPLICATION-PROMPT.md).
- **External, independent (non-Parmana) audit or academic validation** — everything in §3 above
  is self-conducted. That's still meaningful (the findings are specific, cite real code, and
  include a self-discovered exploit closed the same session — not vague self-praise), but it is
  not a substitute for third-party validation if DPIIT's reviewers weight that differently.
  Confirm before citing: whether any external security review, academic citation, or the
  Mastercard AI Defense Lab submission referenced in the source master prompt actually occurred.
- **The "UK AISI agentic incident (Aug 2026)"** cited in the source master prompt as external
  validation of the threat model — no source or citation for this was available in this session;
  do not cite it in the application until Pavan supplies a verifiable source.

## TODO before this is submission-ready

- [ ] R&D spend statement (see above)
- [ ] Confirm or drop the Mastercard AI Defense Lab and UK AISI incident references
- [ ] Decide whether to commission an external security review before submission — strengthens
      §3 materially if timeline allows before the Sep 15, 2026 target submission date
