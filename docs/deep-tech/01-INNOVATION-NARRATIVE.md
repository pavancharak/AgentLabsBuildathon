# Why Parmana Is Deep Tech, Not a Regular Startup

_Draft innovation narrative — DPIIT Deep Tech recognition application_
_Status: DRAFT, grounded only in verified repo evidence (README.md, docs/CLAIMS.md). Sections
marked TODO require figures/facts that don't yet exist in this repo or session memory and must
come from Pavan directly — see the verification note in
[DEEP-TECH-APPLICATION-PROMPT.md](./DEEP-TECH-APPLICATION-PROMPT.md)._

---

## The problem class

Connecting an AI agent to a real system (a payment API, a CRM, a banking rail) creates a gap
that conventional access control doesn't close: granting an agent permission to act is not the
same as controlling what it actually does at the moment it acts. Role-based access and API
scopes decide _who may ask_; they say nothing about _whether the specific action requested at
execution time was the one actually authorized_, and they give the caller the underlying
credential directly, which means every connector integration becomes a new place a long-lived
secret can leak or be replayed.

This is a structural gap, not a configuration mistake — it exists in every architecture where
permission is checked once (at grant time) and then trusted indefinitely (at every subsequent
execution). As AI agents move from suggesting actions to executing them autonomously, this gap
becomes the attack surface.

## What Parmana builds

Parmana is **execution trust infrastructure**: a layer that sits between an AI agent (or any
caller) and the real systems it calls, and enforces two properties that don't exist by default
in API-gateway or RBAC architectures:

1. **Execution-time authorization, not just permission-time authorization.** Every requested
   action carries an explicit authority, authorization, and intent, and is evaluated against a
   deterministic policy immediately before it executes — not only when access was originally
   granted. An approved transaction is released through an execution gateway that never lets the
   caller hold the real credential; the connector receives a single-use, credential-isolated
   session instead of a long-lived secret.
2. **Independently verifiable proof of what happened.** Every approved execution produces a
   signed, tamper-evident record in an append-only Execution Trust Record — verifiable by a third
   party without trusting Parmana's own runtime or database (`@parmana/envelope-verifier`).
   Signing supports both classical (Ed25519) and post-quantum (ML-DSA-65) algorithms.

The chain is: **authorize → verify → execute → confirm.** This is implemented, not conceptual —
the repository ships thirteen packages (`@parmana/api`, `@parmana/runtime`, `@parmana/policy`,
`@parmana/execution-gateway`, `@parmana/execution-control`, `@parmana/connector-sdk`,
`@parmana/envelope-verifier`, `@parmana/crypto`, `@parmana/receipt`, `@parmana/replay`,
`@parmana/storage`, `@parmana/shared`) that together enforce fail-closed configuration
(a misconfigured process refuses to start rather than degrade silently), credential isolation,
exactly-once consumption of every authorization and webhook event, and append-only signed
evidence.

## Why this is engineering research, not integration work

The claims above are backed by evidence at the level DPIIT scrutiny should expect, not marketing
copy:

- **1,313 automated tests** across the workspace (1,274 passed, 37 skipped — live-credential-gated
  suites that skip cleanly with no credentials configured — 2 pending, 0 failed), independently
  re-verified via a JSON-reporter run rather than a summary line (`docs/VERIFICATION-GAPS.md`,
  finding G-24).
- **A real, self-discovered and self-fixed vulnerability class**, documented rather than hidden:
  a live, reproducible execution-authorization bypass was found in the same session it was fixed
  — policy-evaluation signals were not originally bound to the executed Intent, meaning a caller
  could declare a small, fully-verified action while a different action actually executed. The
  fix (`Policy.boundSignals` + `SignalIntentBinder`) closes that gap. This is exactly the kind of
  technical uncertainty and iterative hardening DPIIT's "long development cycle" criterion is
  meant to capture — the risk wasn't hypothetical, it was found in Parmana's own system and
  required a structural fix, not a patch.
- **Validated against a real external system, not a mock**: HubSpot deal-stage/amount updates,
  authorized by policy and executed through the signed gateway pipeline, proven against HubSpot's
  actual production API with a real, non-destructive read-nudge-revert mutation on a real account
  (`docs/CLAIMS.md`, §3.10).
- **Assessed at Technology Readiness Level 6** (system/subsystem model or prototype demonstration
  in a relevant environment) on the strength of that live-system proof, per `docs/CLAIMS.md`'s
  Maturity Assessment. The same assessment documents that a prior deployment briefly reached
  TRL 7 on Razorpay evidence before that connector was deliberately removed on 2026-08-12 — an
  honest account of what regressed and why, not a smoothed-over claim.
- **Independently source-code-validated**: a from-scratch audit traced, for every capability the
  system exposes, whether an action can become real-world execution without satisfying
  institutional authorization — regardless of whether the requester is an AI agent, a human, or
  anything else — by following the actual execution path rather than trusting function names or
  comments (`docs/architecture/strategic-positioning-validation.md`).

None of this is a policy engine wrapped in marketing language. The core technical problem —
how to bind a policy decision to the literal action that executes, atomically, without handing
out reusable credentials, in a way a third party can verify without trusting the vendor — is
still an open problem industry-wide; there is no equivalent to OAuth or a WAF standard for this
layer yet. That is the basis for the "core scientific or engineering innovation, not incremental"
criterion.

## What's not yet true (kept honest deliberately)

Parmana's own documentation discipline is part of the evidence: `docs/CLAIMS.md` states every
technical claim at the scope its evidence actually supports and keeps a running list of what is
explicitly not yet proven, rather than rounding claims up. `docs/VERIFICATION-GAPS.md` tracks
open gaps by number (e.g., G-24 above). This section of the application should point DPIIT
reviewers at that document directly — a Deep Tech reviewer checking for real R&D versus polish
will find more credibility in an explicit gap list than in a claim with no caveats.

## TODO — required before this narrative is submission-ready

The following are referenced by the original application master prompt but are **not yet
documented anywhere accessible to this repo or session** and must be supplied by Pavan before
they can be asserted in an actual DPIIT filing:

- [ ] Patent/IP filing status (none of the claims above depend on patents existing — they rest on
      documented, tested, independently-verifiable implementation — but DPIIT's "novel IP"
      criterion may still expect a patent answer, even if the answer is "none filed yet, filing
      planned for [date]")
- [ ] R&D spend figures (headcount, months of effort, ₹ invested) — needed for the "R&D intensity"
      criterion; nothing above substitutes for an actual spend statement
- [ ] The Mastercard AI Defense Lab submission and the "UK AISI agentic incident (Aug 2026)" —
      referenced in the master prompt as external validation, but unverified in this session;
      confirm these are real and get citable sources/dates before using them, or drop them
- [ ] Commercialization roadmap and "why 20 years" gestation argument — separate documents per
      the checklist in `DEEP-TECH-APPLICATION-PROMPT.md`, not drafted here
