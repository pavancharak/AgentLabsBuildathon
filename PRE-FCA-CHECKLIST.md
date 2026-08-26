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

## Security Audit
- [ ] Independent auditor engaged
- [ ] Signature verification tested by a party other than Parmana itself (this session's evidence
      package showed signature *fields* are populated in live responses but did not run a
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

## Organizational Sign-Off
- [ ] Pavan (founder, Parmana) approved
- [ ] Confirm with Pavan: is there a distinct CTO/Head of Engineering, or is that also Pavan?
      (`docs/deep-tech/06-TEAM-AND-EXPERTISE.md` currently has team/co-founder structure as an
      open TODO — no separate parent company; it's Parmana itself.)
- [ ] Authority to submit to FCA confirmed
- Status: NOT STARTED
- Owner: Pavan
- Timeline: [date]

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
