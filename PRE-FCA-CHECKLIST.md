# Pre-FCA Submission Checklist

**A note before the checklist itself.** This originating prompt's "Organizational Sign-Off"
section named "Manthan Systems leadership (parent company)" as a required sign-off party distinct
from Pavan. Nothing in this repository supported that, and Pavan has since confirmed directly:
there is no separate "Manthan Systems" parent company — it's Parmana itself. That correction is
reflected below. Whether a distinct CTO/Head of Engineering exists (separate from Pavan) is still
unconfirmed — `docs/deep-tech/06-TEAM-AND-EXPERTISE.md` (a prior session's dedicated investigation
of team/co-founder structure) found no evidence of anyone beyond Pavan as sole founder and lists
it as an open TODO.

---

## Legal Review

- [ ] Lawyer reviewed `FCA-SUBMISSION-PHASE2-WEEK2.md`
- [ ] Language cleared (no liability concerns) — specifically: "hard boundary" vs. "designed to
      enforce," "post-compromise protection" vs. overreach
- [ ] Claims are defensible against the actual repo/commits cited
- [ ] Limitations properly disclosed (single connector demoed, no independent signature
      verification performed yet, no in-scope-merge control case yet — see below)
- Status: NOT STARTED
- Owner: [external counsel — name TBD]
- Timeline: [date range]
- **Why this is required:** `FCA-SUBMISSION-PHASE2-WEEK2.md` makes claims in Parmana's own
  words ("hard boundary," "post-compromise protection") that no one outside this session has
  checked for legal exposure. Sending that language to a real regulator without a lawyer
  confirming it's defensible — and that its limitations are disclosed rather than glossed over —
  risks the company being held to a stronger claim than the evidence actually supports.
- **Pending because:** no real lawyer has been identified or contacted yet (see prior turn — the
  originating prompt's outreach email had a `[Name]` placeholder, not a real recipient).

## Compliance Review

- [ ] Compliance expert reviewed against FCA rules (SM&CR, Consumer Duty, COBS, SYSC, and any
      emerging FCA guidance on agentic AI — this session found no evidence such guidance
      currently exists in a form specific enough to check against; that should be confirmed by
      whoever does this review, not assumed either way)
- [ ] SM&CR coverage addressed — who is the accountable senior manager for this system
- [ ] Consumer Duty applicability assessed
- [ ] COBS/SYSC alignment confirmed
- [ ] Decision on whether an independent security audit is a prerequisite or can run in parallel
- [ ] Decision on whether the `PARMANA_AUTH_DISABLED` history needs disclosure — note: this
      session (see `GITHUB-CALLER-SCOPING-PHASE2-WEEK2-RESULTS.md`) could confirm only that the
      variable is not currently set in production, not a verified timeline of when/whether it was
      previously set; get the real history from Pavan directly before deciding on disclosure
      wording, rather than asserting a specific date
- Status: NOT STARTED
- Owner: [compliance expert, ideally FCA-familiar — name TBD]
- Timeline: [date range]
- **Why this is required:** The evidence package proves a technical mechanism works; it does not
  by itself establish that mechanism satisfies what the FCA actually expects under SM&CR,
  Consumer Duty, or SYSC. Only someone who knows those rules can tell us if the evidence answers
  the right questions, or if we're demonstrating the wrong thing entirely.
- **Pending because:** no compliance expert has been identified or contacted yet.

## Security Audit

- [ ] Independent auditor engaged
- [ ] Signature verification tested by a party other than Parmana itself (this session's evidence
      package showed signature _fields_ are populated in live responses but did not run a
      separate, out-of-process verification tool against them — that gap should be closed here,
      not re-asserted as already done)
- [ ] Audit trail tamper-resistance verified (Supabase access controls, isolation)
- [ ] Scope enforcement penetration-tested (attempt to bypass `isCapabilityAllowed` directly, not
      just via the documented request shape)
- [ ] Post-compromise scenario validated against a real threat model (e.g., stolen GitHub App
      token — what can an attacker who has the connector credential itself, not just a scoped
      caller key, actually do?)
- [ ] Key rotation tested (leaked API key revoked/rotated without redeploy)
- [ ] Report received & findings addressed
- Status: NOT STARTED
- Owner: [independent security firm or internal security team — name TBD]
- Timeline: [date range]
- **Why this is required:** Every claim in the evidence package so far was verified by the same
  party that built the system (this session, working with Pavan). "We tested our own boundary and
  it held" is weaker evidence than an independent party trying to break it and failing. This is
  also the only review type that can meaningfully test the post-compromise claim against a
  realistic attacker, not just the request shapes this session happened to try.
- **Pending because:** no auditor or firm has been identified or contacted yet.

## In-Scope-Merge Test (Scenario 4)

**Not executed as part of this checklist-creation task.** Merging a real pull request is an
irreversible, externally visible action (even reverted, the merge and revert both land in
`pavancharak/parmana-exp`'s real history) and needs Pavan's explicit go-ahead at the time it's
actually run, not a standing blanket authorization baked into a checklist.

- [ ] New disposable PR created for the test
- [ ] Full-access caller (`fca-full-access`) attempts `github:pr-merge`
- [ ] Response documented (expect 200, signed trust record)
- [ ] GitHub confirms the merge independently (`gh api .../pulls/N` shows `merged: true`)
- [ ] Evidence committed: `GITHUB-CALLER-SCOPING-PHASE2-WEEK2-SCENARIO4.md`
- [ ] Test PR/branch cleaned up afterward
- Status: NOT STARTED
- Owner: Pavan (needs to explicitly authorize the merge at execution time)
- Timeline: [date]
- **Why this is required:** The evidence package currently proves the _rejection_ path (fetch-only
  can't merge) three ways but never shows the _success_ path for the merge capability itself. A
  reviewer could reasonably ask "does `github:pr-merge` even work when it's supposed to?" and
  right now the honest answer is "not yet demonstrated."
- **Pending because:** it's a real, irreversible action (merges a real PR) — deliberately not run
  without Pavan's explicit go-ahead in the moment, not a standing authorization from a plan.

## Organizational Sign-Off

- [ ] Pavan (founder, Parmana) approved
- [ ] Confirm with Pavan: is there a distinct CTO/Head of Engineering, or is that also Pavan?
      (`docs/deep-tech/06-TEAM-AND-EXPERTISE.md` currently has team/co-founder structure as an
      open TODO — no separate parent company; it's Parmana itself.)
- [ ] Authority to submit to FCA confirmed
- Status: NOT STARTED
- Owner: Pavan
- Timeline: [date]
- **Why this is required:** submitting to a real regulator is a decision with legal weight; it
  should be a deliberate, named commitment, not an implicit default of "nobody objected."
- **Pending because:** the underlying question ("does anyone besides Pavan need to sign off?") is
  itself still unresolved — see the note at the top of this document.

## Final Document Prep

- [ ] `FCA-SUBMISSION-PHASE2-WEEK2.md` updated with legal feedback
- [ ] Updated with compliance feedback
- [ ] Updated with security audit findings
- [ ] Scenario 4 evidence integrated (once run)
- [ ] Final read-through by Pavan
- [ ] Submission method confirmed with FCA (email? portal? meeting first? — not yet identified in
      this repo or checklist; needs research, not assumption)
- Status: NOT STARTED
- Owner: Pavan
- Timeline: [date range]
- **Why this is required:** every section above (legal, compliance, security, Scenario 4) exists
  to produce feedback or evidence — this step is where that feedback actually gets folded back
  into the document that goes to the FCA, rather than living only in reviewers' inboxes.
- **Pending because:** it depends on the outputs of every section above, none of which have
  started.

## Ready to Submit

- [ ] All sections above COMPLETE
- [ ] Sign-off received from whoever is actually confirmed to need to give it
- [ ] FCA contact identified
- [ ] Submission date set
- Status: NOT READY

---

## Timeline

No dates are committed here. The originating draft of this checklist proposed a Sep 15 – Oct 13
week-by-week schedule, but that assumed reviewer availability (a lawyer, a compliance expert, a
security firm) that has not actually been engaged yet — none of Part 1–3 above has an owner name
attached. Fill in real dates once real people are engaged; a placeholder schedule risks being
read as a commitment that hasn't actually been made.
