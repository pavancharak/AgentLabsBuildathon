# Commercialization Roadmap

_Draft — DPIIT Deep Tech recognition application_
_Status: DRAFT. Grounded only in verified repo/git evidence as of 2026-08-25. Figures that require
business facts not present in the repo (pilot names, revenue, contract status) are marked TODO —
see the verification note in
[DEEP-TECH-APPLICATION-PROMPT.md](./DEEP-TECH-APPLICATION-PROMPT.md)._

> **Correction to the source master prompt:** the original prompt lists "Razorpay connector +
> policy governance in production" as an 0–12 month _upcoming_ milestone. That's stale — the
> Razorpay connector was already built, deployed, and validated against Razorpay's live-mode API
> with real money (`docs/CLAIMS.md` §3.8–§3.9), then **deliberately removed from the codebase on
> 2026-08-12** (commit `f399ff5`, "refactor: remove production execution layer from connector
> packages" — an architecture consolidation that moved connector execution into
> `@parmana/execution-gateway`, not a failure of the connector itself; `docs/CLAIMS.md` retains
> the Razorpay sections as an explicit historical record). The roadmap below reflects what's
> actually true today, not the stale claim.

---

## Phase 0 — Already demonstrated (not a forward-looking milestone)

This is evidence, not a plan, and should be presented to DPIIT as such:

- **A regulated-payments connector (Razorpay) reached real-money, live-mode production
  validation**, including a genuine webhook-driven settlement confirmation cycle end-to-end in
  under a minute (`docs/CLAIMS.md` §3.9: ~43 seconds from `POST /execute` to a signed `SETTLED`
  confirmation, against a real ₹10.00 payment). This is the strongest available evidence that the
  architecture works against a real regulated financial rail, not only in test.
- That connector was assessed at **TRL 7** on this evidence before being deliberately removed
  during an architecture refactor — the removal is a scoping decision (execution logic
  consolidated into the core gateway package for every future connector to reuse), not a retreat
  from the regulated-finance use case.
- **The platform currently runs two independent production connectors through the identical
  policy/credential-isolation/audit pipeline**: HubSpot (CRM: deal-stage/amount updates,
  live-verified against HubSpot's production API, `docs/CLAIMS.md` §3.10) and GitHub (recently
  wired into the same production execution chain — `packages/api/src/bootstrap/createConnectorRegistry.ts`
  registers `test-fixture`, `hubspot`, and `github` as of this writing). That two unrelated,
  externally-owned systems both run through one unmodified authorization core is the concrete
  proof behind the "execution-agnostic, not Razorpay-specific" claim — it no longer needs to be
  asserted, it can be pointed at.

## Phase 1 — Immediate (0–12 months)

- Re-add a regulated-payments connector to the current (post-refactor) connector architecture,
  carrying forward the Razorpay work as a reference implementation rather than starting over —
  this is scoping and engineering effort, not unproven research, since the underlying mechanism
  is already validated.
- [ ] TODO: name of specific regulated financial institution pilot(s), if any are actually
      lined up — the original prompt's "2-3 regulated financial institution pilots lined up" is
      unverified in this repo and should not be asserted to DPIIT without a real name/date/status
      from Pavan.
- [ ] TODO: Mastercard AI Defense Lab submission status — referenced in the source prompt as
      proof of enterprise interest; not verifiable here, confirm before citing.

## Phase 2 — Medium-term (12–24 months)

- A third and fourth connector beyond HubSpot/GitHub, chosen to broaden the regulated/high-stakes
  surface area (the payments connector from Phase 1 is the natural next regulated example).
- [ ] TODO: compliance framework documentation (RBI-aligned, if India-focused) — not yet present
      in this repo; should be drafted as its own deliverable, not asserted as done.
- [ ] TODO: customer revenue or signed pilot contracts — genuinely unknown to this session; get
      the real number (including ₹0 / pre-revenue, if that's the honest current state — DPIIT
      review will weigh a stated ₹0 with a credible pipeline far better than a vague claim).

## Phase 3 — Long-term (2–5 years)

- Scale the same connector-agnostic pattern (proven in Phase 0 across two unrelated systems)
  across additional vendors without re-deriving the core authorization/audit mechanism —
  the architecture already demonstrates this is a platform property, not per-connector work.
- Regulatory engagement pathway (CERT-In awareness, RBI guidance tracking) — no evidence in this
  repo of engagement to date; treat as a genuine forward-looking commitment, not a claimed
  achievement.
- Export readiness for non-India regulated markets, contingent on the domestic regulated-finance
  case (Phase 1's payments connector) actually closing.

---

## Why this version is stronger for the application than the source prompt's

The source master prompt asserts "Razorpay connector ... in production" as a near-term milestone,
which is both stale (it was removed, not pending) and undersells what's actually true: Parmana
already _proved_ the regulated-payments case with real money before consolidating the
architecture, and has since proven the platform generalizes by standing up two more connectors
(HubSpot, GitHub) through the same unmodified core. A DPIIT reviewer checking claims against the
codebase will find the corrected version credible and the original version wrong. Lead with
Phase 0.
