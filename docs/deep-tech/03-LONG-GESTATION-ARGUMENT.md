# Why Parmana Needs 20-Year Recognition

*Draft — DPIIT Deep Tech recognition application*
*Status: DRAFT. Grounded in verified repo/git evidence and Pavan's 2026-08-25 correction to the
incorporation date. See [DEEP-TECH-APPLICATION-PROMPT.md](./DEEP-TECH-APPLICATION-PROMPT.md) for
the verification trail.*

## The corrected starting point

Parmana was incorporated **April 20, 2026**, not April 2024 as an earlier draft of this
application stated. As of this filing (August 2026), the company is approximately **four months
old**. This is a materially different — and more honest — starting point than "2+ years,"
and it changes the shape of this argument: the case for 20-year recognition isn't "we've been at
this a while and need more runway," it's "the technical problem this company is solving has a
gestation period measured in years, and four months in, the company has already produced
evidence of real technical depth at a rate that only makes sense if the surrounding problem
is genuinely long-horizon."

## What four months actually produced

Since the first commit (`ba7bc45`, 2026-06-25 — roughly two months after incorporation, the gap
plausibly being entity setup, hiring, and design work before code started), the repository shows:

- A deterministic policy-and-execution architecture with credential isolation, taken to a
  **TRL 6 assessment**, including one connector (Razorpay) that briefly reached **TRL 7** on the
  strength of a real-money, live-mode production validation.
- A live, reproducible security vulnerability found and fixed in the same engineering session
  (the policy-signal/executed-intent binding gap — see
  [01-INNOVATION-NARRATIVE.md](./01-INNOVATION-NARRATIVE.md)), the kind of finding that only
  surfaces from genuine adversarial engineering rigor, not routine feature work.
- 1,313 automated tests, an independent source-code audit of the authorization boundary, and two
  additional production connectors (HubSpot, GitHub) proving the core mechanism generalizes.
- A major internal architecture refactor (the 2026-08-12 removal and consolidation of connector
  execution logic into `@parmana/execution-gateway`) — evidence the team is willing to rebuild
  core infrastructure mid-flight when the architecture demands it, rather than shipping around a
  weak foundation.

That pace is the argument, not a footnote: this is what a founding team produces when the
underlying problem has enough real technical depth to sustain that intensity. It is also exactly
why four months is nowhere near enough to call this settled — the same velocity applied to the
gaps below is a multi-year commitment, not a point of near-term uncertainty.

## Why the problem itself has a long horizon

1. **Execution-time authorization for AI agents is not a solved industry problem.** There is no
   equivalent of an OAuth or WAF standard for "verify a specific agent-initiated action against
   policy at the moment it executes, without ever handing the agent a reusable credential." Every
   connector Parmana adds (Razorpay → HubSpot → GitHub → whatever comes next) re-tests that the
   core mechanism actually generalizes to a system with different semantics, different failure
   modes, different credential models. That validation work doesn't shrink as more connectors are
   added — each one is a fresh adversarial question, not a template fill-in.

2. **Regulatory acceptance in regulated finance is a multi-year process, not a technical one.**
   Parmana's own roadmap (`docs/ROADMAP-v1.md`) targets a *shadow pilot* — deliberately not a
   live-money deployment — as the near-term production-readiness bar, specifically because a
   regulated financial institution's own review cycle, not Parmana's engineering velocity, sets
   the pace from pilot to live deployment to regulatory comfort. That is consistent with
   industry-typical multi-year timelines for new financial infrastructure to earn institutional
   trust, independent of how fast the underlying technology matures.

3. **The problem surface keeps growing, not shrinking, as the product succeeds.** Every new
   connector is a new credential model to isolate safely; every new regulated market is a new
   compliance regime to align policy semantics against; post-quantum signing
   (`@parmana/crypto`'s ML-DSA-65 support) is already necessary today, which signals a technology
   base that has to keep pace with cryptographic standards over a multi-decade horizon, not a
   one-time integration.

4. **Capital-intensity compounds with regulated-market entry**, not just engineering headcount:
   security audits, compliance certifications, and the kind of live-money validation work
   documented in `docs/CLAIMS.md` §3.8–§3.9 (a real payment, a real refund, a real webhook, run
   against production financial infrastructure) are not one-time costs — they repeat for every
   new regulated connector and every new jurisdiction.

## Why 10 years isn't a sufficient window

- Realistically 3–5 years to move from the current shadow-pilot target to sustained revenue in
  regulated enterprise deployments — consistent with how long regulated financial institutions
  typically take to move a new class of infrastructure from pilot to production vendor status.
- A further 2–3 years for a genuine regulatory pathway (CERT-In awareness, RBI-aligned guidance)
  to mature, which is outside Parmana's own control and cannot be compressed by engineering speed.
- 2+ years beyond that to prove the connector-agnostic architecture (already demonstrated across
  three connectors in four months) generalizes across multiple regulated verticals, not just
  payments and CRM.
- A safety margin appropriate to a category with no existing standard to fall back on — Parmana
  is not implementing a known spec faster than competitors, it is helping define what the
  category's technical and regulatory shape even is.

Twenty years is the window in which "execution-time authorization for AI-initiated actions"
plausibly goes from an open problem to established infrastructure. Four months of evidence shows
the team can move fast within that window; it does not shrink the window itself.

## TODO before this is submission-ready

- [ ] Confirm the exact incorporation date with the certificate of incorporation / MCA filing
      (this draft uses April 20, 2026 per Pavan's 2026-08-25 correction — attach the primary
      document for the DPIIT filing rather than relying on this narrative alone).
- [ ] If real pilot-to-production timelines exist from comparable regulated-fintech infrastructure
      vendors (cite-able, not anecdotal), add them here as external corroboration of the 3-5 year
      figure above — currently that figure is reasoned from Parmana's own roadmap framing, not an
      external benchmark.
