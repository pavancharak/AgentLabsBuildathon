# IP & Patent Summary

_Draft — DPIIT Deep Tech recognition application_
_Status: DRAFT. Current IP posture only — no patent filings are claimed here because none are
confirmed to exist. See [DEEP-TECH-APPLICATION-PROMPT.md](./DEEP-TECH-APPLICATION-PROMPT.md) for
why this is treated as an open item rather than asserted._

## Current IP posture (as of 2026-08-25)

- **Patents filed: none confirmed.** Nothing in this repository, its commit history, or this
  session references a patent application, provisional filing, or attorney engagement. This is
  the single most important gap in the checklist for the "novel IP" criterion — see TODO below.
- **Copyright / trade secret protection: in place today.** The core engine
  (`@parmana/runtime`, `@parmana/policy`, `@parmana/execution-gateway`, `@parmana/execution-control`,
  `@parmana/envelope-verifier`, `@parmana/crypto`, `@parmana/storage`, `@parmana/shared`, and the
  connector packages) is licensed `SEE LICENSE IN LICENSE` — a proprietary, source-available-for-
  evaluation-only license (`LICENSE`, root of repo): no use, copy, modification, or distribution
  is permitted without a separate written agreement. This is real, already-effective legal
  protection over the implementation, independent of whether a patent is ever filed.
- **Deliberate open-core split.** The thin client SDKs (`typescript/`, `python/`) are licensed
  Apache-2.0 — meant to be freely integrated by anyone calling the Parmana API. The proprietary
  boundary is drawn correctly for a Deep Tech narrative: the mechanism (policy engine, execution
  gateway, credential isolation, signing/verification core) is closed; the integration surface
  (how a caller talks to it) is open. This split should be described explicitly in the
  application — DPIIT reviewers checking licenses will otherwise see Apache-2.0 files and
  reasonably ask whether the "core tech" is actually proprietary.

## What the core proprietary mechanism actually is (candidate patentable subject matter)

None of the following are claimed as patented or as patent-pending — they are the specific,
named, implemented mechanisms that a patent attorney would evaluate for novelty if Parmana files.
Each is real and traceable to source, not a marketing description:

1. **Binding policy-evaluation signals to the executed Intent, not just the declared one**
   (`Policy.boundSignals`, `SignalIntentBinder`) — the fix for the self-discovered execution-
   authorization bypass documented in
   [01-INNOVATION-NARRATIVE.md](./01-INNOVATION-NARRATIVE.md). This is the most defensible
   candidate: it addresses a specific, demonstrated exploit class (declare a small action,
   execute a different one) with a structural binding mechanism, not an access-control rule.
2. **Structural capability-to-policy binding** (`CapabilityPolicyBinding.ts`) — every registered
   execution capability is bound to exactly one governing policy at the framework level, closing
   the class of bug where a capability could be paired with an unrelated or unprotected policy
   (the substitution exploit referenced in `docs/CLAIMS.md`).
3. **Credential isolation via single-use, session-scoped execution release** — connectors never
   receive a long-lived credential; `SessionCredentialSecureConnector` and the gateway session
   store issue a single-use session per approved execution instead.
4. **Independently verifiable execution evidence** (`@parmana/envelope-verifier`) — a signed
   Execution Trust Record that a third party can verify without trusting Parmana's own runtime or
   database, with both classical (Ed25519) and post-quantum (ML-DSA-65) signing configurable.
5. **Deterministic replay reconstruction of a past policy decision** (`@parmana/replay`) — proven
   and tested per `docs/CLAIMS.md`, though (per `docs/ROADMAP-v1.md` gap G-19) not yet wired to an
   HTTP entry point in production.

Items 1 and 2 are the strongest patent candidates specifically because they were derived from a
real, demonstrated exploit rather than designed defensively in the abstract — that's a concrete
technical-problem-to-solution narrative, which is what a patent claim needs.

## Update (2026-08-25): draft specifications now exist

Three attorney-review drafts have been written, grounded directly in this repository's real
source (`docs/patents/DRAFT-01-runtime-credential-isolation.md`,
`DRAFT-02-signed-execution-audit-trail.md`, `DRAFT-03-policy-change-maker-checker.md`). None have
been reviewed by a patent attorney, prior-art-searched, or filed — see
`docs/patents/PATENT_FILING_REGISTER.md` for real status (currently: nothing filed). This
supersedes an earlier prompt that falsely claimed three complete, ready-to-file specifications
already existed; they didn't, and these are the real replacements.

## TODO before this is submission-ready

- [ ] **Get a real answer on patent filing status from Pavan/counsel — do not submit this
      document until that answer is confirmed.** If none are filed, the honest and still credible
      position for DPIIT is: "no patents filed yet; provisional application(s) planned for
      [mechanism 1 and/or 2 above] before/alongside this submission" — DPIIT's "novel IP" criterion
      accepts registered IP _or_ documented proprietary technology, and the copyright/trade-secret
      posture above is real evidence even without a patent.
  - [ ] If a provisional filing is feasible before the Sep 15, 2026 target submission date in
        the application timeline, prioritize filing on item 1 (the intent-binding fix) — it has
        the cleanest "problem found → structural fix" narrative of everything in this repo.
- [ ] Design registrations (webhook audit format, vault API) — mentioned in the source master
      prompt as a checklist item; no evidence either way in this repo, confirm with Pavan.
- [ ] Confirm whether `founder@parmanasystems.com` (the LICENSE contact) is the correct legal
      entity contact to reference in a DPIIT filing, or whether counsel should be listed instead.
