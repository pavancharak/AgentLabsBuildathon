# Session Summary: Phase 2 Week 2 Complete (Aug 26, 2026)

**A note on how this document was produced.** The originating prompt supplied this file's content
nearly verbatim to save. Two claims in it didn't match the repo's own prior verification and were
corrected rather than transcribed — see the "Database" line under Infrastructure below, and the
"What's Next" section's dates. Everything else was checked against this session's actual commits
and tool output before being kept as written.

## What We're Doing

Parmana is building an authorization layer for agentic AI in regulated finance.

**The Problem:** AI agents can be compromised. If an agent with "read-only" scope gets hacked, we
need a hard boundary that prevents it from doing writes anyway — no matter what the agent code
tries.

**The Solution:** Parmana enforces scope at the API key layer (hard boundary), not at the policy
layer (soft suggestion). Every action is signed and logged. Regulators can independently verify
that every execution stayed within bounds.

**Current Work:** Assembling evidence toward a submission to the FCA (Financial Conduct
Authority, UK regulator) — not yet submitted; see "What's Stuck" below.

---

## Why We're Doing This

FCA guidance on agentic AI in financial services is an emerging area. Three concerns this session
worked from:

1. **Authorization:** Did the user give the agent permission to do this?
2. **Authenticity:** Is the agent's request a true reflection of user intent?
3. **Accountability:** Who is responsible if something goes wrong?

Parmana's evidence this session addresses each:

- Authorization: hard scope boundary, enforced at the API key layer, before connector dispatch
- Authenticity: signed execution trust records (ed25519), independently verifiable in principle
  (not yet independently re-verified by a party other than this session — see limitations below)
- Accountability: audit records for both successful executions and scope rejections

---

## Where Everything Is

### Code Repository

- **Repo:** github.com/pavancharak/parmana-exp
- **Branch:** `test/fca-scenario-1` (open PR #1, real, id `4364268804`; contains all FCA work
  this session)
- **Main branch:** not yet touched by this work

### Key Files Committed This Session

**Commit `9993940`:** `GITHUB-CALLER-SCOPING-PHASE2-WEEK2-RESULTS.md`

- Live test results, three scenarios, run against real `parmana-api.fly.dev` and real GitHub data
- Scenario 1: fetch-only caller fetches PR #1 → SUCCESS (200, signed trust record)
- Scenario 2: fetch-only caller attempts merge → REJECTED (403 `CAPABILITY_NOT_ALLOWED`)
- Scenario 3: same rejection under maximally policy-favorable signals → REJECTED

**Commit `cbd7cad`:** `FCA-SUBMISSION-PHASE2-WEEK2.md`

- Evidence package framed for FCA, explicitly not asserted as certified regulatory sufficiency
- Sections: Authorization (hard boundaries), Authenticity (signed trails), Accountability (audit
  records), plus a technical appendix and the live test summary

**Commit `061f483`:** `PRE-FCA-CHECKLIST.md`

- Roadmap to FCA submission: legal, compliance, security audit, Scenario 4, org sign-off
- Corrected an org-structure claim from its originating prompt ("Manthan Systems" parent company
  — confirmed by Pavan mid-session not to exist; it's Parmana itself)

**Commit `c0db2f1`:** `PRE-FCA-CHECKLIST.md` (updated)

- Added an explicit "Why this is required" and "Pending because" line to every section

### Supporting Architecture Documentation

- `SCOPED-CREDENTIAL-ARCHITECTURE.md` (commit `c6844bd`) — the real architecture doc; note its
  original prompt asked for a file named `GITHUB-CALLER-SCOPING-ARCHITECTURE.md`, which doesn't
  exist — this is the real one, cited correctly in `FCA-SUBMISSION-PHASE2-WEEK2.md`
- `packages/api/tests/integration/github-caller-scoping.integration.test.ts` (commit `94375ed`) —
  hermetic integration tests (4 passing) against a mock GitHub server

### Live Infrastructure

- **Deployment:** `parmana-api.fly.dev` (Fly.io) — health-checked this session:
  `{"status":"UP"}`, HTTP 200
- **GitHub App:** authenticated, installed on `pavancharak/parmana-exp` — confirmed via deployed
  Fly secrets (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID`) and via
  Scenario 1's response showing `credentialProviderId: "github-app"` with real PR data returned
- **Database:** Supabase, backing production `DATABASE_URL`/`SUPABASE_URL` — **correction to the
  originating draft of this document**, which named it "parmana-sandbox (AWS ap-south-1)." Per
  this repo's own prior, independently-verified finding
  (`docs/operations/td1-closure-summary.md`, closed 2026-08-05, §7 "Phase 2A.3"), production is
  confirmed to be the account's _other_, repo-linked project — a **separate** project literally
  named as a sandbox, region `ap-south-1`, was found on the same account but explicitly **not
  linked to this repository** and not the one production points to. This session did not
  re-verify project identity independently; it is carried forward from that closed, dated
  investigation rather than re-derived here.

---

## What's Complete

### Evidence Collected (this session, live against production)

✅ **Scenario 1: Valid (Within Scope)** — 200, signed trust record, real PR data (headSha
matched PR #1's actual commit, independently cross-checked via `gh api`)

✅ **Scenario 2: Out-of-Scope (Rejection at Boundary)** — 403 `CAPABILITY_NOT_ALLOWED`, request
never reached the GitHub connector

✅ **Scenario 3: Jailbreak-Framed Attempt** — same rejection, with signals set to maximally
policy-favorable, demonstrating the outcome doesn't depend on request content

### Documentation Complete

✅ `FCA-SUBMISSION-PHASE2-WEEK2.md` — framed explicitly as an evidence package pending legal/
compliance review, not a certified submission
✅ `PRE-FCA-CHECKLIST.md` — review types, honest NOT-STARTED status, rationale per section
✅ Architecture citations verified against real code (`isCapabilityAllowed.ts`,
`ApiKeyEntry.ts`, `SCOPED-CREDENTIAL-ARCHITECTURE.md`)

### Infrastructure Verified

✅ `parmana-api` deployed and healthy, GitHub App credentials present and functioning (proven by
Scenario 1's real connector call, not just secret presence)
✅ Three live scenarios ran against the actual deployment, not a mock

---

## What's Stuck (Intentionally)

### Scenario 4: Full-Access Merge Test

**Status:** Pending explicit approval. **Why stuck:** merging a real PR is irreversible and
externally visible even if reverted afterward; declined twice already in this session (once when
proposed as part of the checklist, once when proposed as part of a "Weeks 1-6" execution roadmap)
pending Pavan's in-the-moment go-ahead specifically, not a standing authorization.

### Legal Review

**Status:** Pending. **Why stuck:** no real lawyer has been contacted — the originating
"Weeks 1-6" roadmap's outreach email had a `[Name]` placeholder, not a real recipient; sending
outreach on Pavan's behalf without a real person to send it to isn't possible, and wasn't done.

### Compliance Review

**Status:** Pending. **Why stuck:** same — no compliance expert identified yet.

### Security Audit

**Status:** Pending. **Why stuck:** same — no auditor or firm identified yet.

### Organizational Sign-Off

**Status:** Pending. **Why stuck:** whether anyone beyond Pavan needs to sign off is itself
unresolved (`docs/deep-tech/06-TEAM-AND-EXPERTISE.md` has co-founder/team existence as an open
TODO); confirmed this session that there's no separate "Manthan Systems" parent company.

---

## What's Next

The originating "Weeks 1-6" roadmap proposed specific dates (engagement this week, first legal
pass Oct 1, compliance pass Oct 8, audit results Oct 15, submission Oct 26). Those dates are not
carried into this summary as commitments: no lawyer, compliance expert, or auditor has actually
been engaged, so any date attached to their work would be invented, not planned. The real next
step, in order, is:

1. Pavan identifies and contacts real people for legal, compliance, and security review (their
   actual availability sets the real timeline).
2. Pavan decides whether/when to authorize Scenario 4.
3. Pavan resolves who actually needs to sign off (`PRE-FCA-CHECKLIST.md`'s open question).
4. Once reviews return feedback, fold it into `FCA-SUBMISSION-PHASE2-WEEK2.md`.
5. Identify the actual FCA contact/submission method before sending anything.

---

## Decisions Made This Session

- Did not fabricate engagement, review feedback, or completed reviews — every pending item says
  "pending" and why.
- Did not execute irreversible actions (Scenario 4 merge, or any of it) without Pavan's explicit,
  in-the-moment approval — declined twice when asked to schedule or execute it as part of a plan.
- Did not send outreach to unnamed placeholder lawyers/compliance experts/security firms, and did
  not email the FCA — no real recipients existed, and doing so would have misrepresented how far
  along this actually is.
- Did not create a git tag asserting a submission event that hasn't happened (the "Weeks 1-6"
  roadmap proposed `fca-submission-20261026`, dated two months in the future).
- Corrected several fabricated/incorrect specifics found in originating prompts across this
  session: a nonexistent architecture filename, a wrong PR `id`, an unverified auth-bypass
  timeline claim, an invented parent company, and — in this document — an inverted claim about
  which Supabase project backs production.

---

## Open Questions

1. Org structure: who signs off beyond Pavan, if anyone?
2. Scenario 4: when does Pavan want to authorize the actual merge test?
3. Legal/compliance/security: who are the real people to contact?
4. FCA submission method: not yet researched.

---

## How to Use This Document

**Picking this up later:** read "What's Complete" for what's actually proven, "What's Stuck" for
why nothing has moved past evidence-gathering, "What's Next" for the real (not pre-dated) next
steps.

**Talking to FCA:** send `FCA-SUBMISSION-PHASE2-WEEK2.md`, not this file — this one is an internal
working record, including corrections to earlier drafts, not something written for an external
regulatory audience.

---

## Key Commits Reference

| Commit    | File                                            | What It Is                      |
| --------- | ----------------------------------------------- | ------------------------------- |
| `9993940` | `GITHUB-CALLER-SCOPING-PHASE2-WEEK2-RESULTS.md` | Live test results (3 scenarios) |
| `cbd7cad` | `FCA-SUBMISSION-PHASE2-WEEK2.md`                | Evidence package for FCA        |
| `061f483` | `PRE-FCA-CHECKLIST.md`                          | Roadmap to FCA submission       |
| `c0db2f1` | `PRE-FCA-CHECKLIST.md`                          | Updated with blocking rationale |
| `94375ed` | `github-caller-scoping.integration.test.ts`     | Hermetic tests (4 passing)      |
| `c6844bd` | `SCOPED-CREDENTIAL-ARCHITECTURE.md`             | Real architecture doc           |

---

## Final Status

**Phase 2 Week 2: evidence-gathering complete for the three requested scenarios.**

Not complete: Scenario 4 (deliberately held), legal/compliance/security review (not yet engaged),
organizational sign-off (structure unresolved). This is an accurate snapshot, not a "ready to
submit" status.

**Document created:** Aug 26, 2026 (session time; exact UTC timestamp not independently checked
against a clock this session, so not stated to the minute as the originating draft claimed).
