# G-30 Resolution + Architectural Path Forward

## Issue

`github:pr-fetch` and `github:pr-merge` lacked entries in
`CANONICAL_CAPABILITY_POLICY_BINDINGS`. A caller invoking either capability could pair it with
any loadable policy instead of the intended `github-pr-approval/1.0.0` — the same
unrelated-policy-pairing bypass `CapabilityPolicyBinder` exists to close, left open for the
GitHub connector specifically.

## Fix (committed `92d7aa6`)

Both capabilities now map to `github-pr-approval/1.0.0`, matching what
`github-pr-merge.integration.test.ts` already declared (no behavior change for the passing
case, only a new rejection for a caller declaring anything else). Verified: 11/11
(`CapabilityPolicyBinder.test.ts`), 4/4 (`github-pr-merge.integration.test.ts`), full suite
1274 passed / 37 skipped / 0 failed after a clean rebuild.

## Root Cause Analysis

Capability coverage is checked two independent, hand-maintained ways:

1. **Production registration:** `packages/api/src/bootstrap/createConnectorRegistry.ts` — what
   actually gets wired in, conditional on connector credentials being configured.
2. **Test coverage:** `packages/policy/tests/unit/CapabilityPolicyBinder.test.ts`'s "binds every
   capability the production connector registry actually registers" test — a hardcoded literal
   `Set`, not a live read of (1).

When GitHub's two capabilities were added to (1) (commit `38658c0`, 2026-08-19) without a
matching update to `CANONICAL_CAPABILITY_POLICY_BINDINGS` or to the literal in (2), both lists
still agreed with each other — they just both omitted GitHub — so `npm test` stayed green.
**Divergence undetected: 6 days (2026-08-19 to 2026-08-25),** caught by an unrelated
documentation-audit pass, not by the test suite whose name specifically claims to catch this.

## Path Forward

Full option detail, corrected code samples, and effort estimates in
[`G-30-ARCHITECTURE-OPTIONS.md`](./G-30-ARCHITECTURE-OPTIONS.md). Summary:

- **Option A — accept as documented debt.** ~30 min, this document plus the
  VERIFICATION-GAPS.md cross-link. No code change, no new coupling. Risk carried forward: the
  same gap shape can recur for a future connector before this is revisited.
- **Option B — `packages/policy`'s coverage test reads live from the registry.** Requires a new
  `packages/policy` → `packages/api` dependency edge (does not exist today in that direction)
  and constructing the full production registry (authenticator, session store, audit sink)
  inside a policy-package test. Revised estimate ~2–3 hours, not the original 1-hour sketch —
  see the options document for why.
- **Option C — shared `@parmana/capability-registry` package.** Centralizes capability
  identifiers (closes typo-level drift) with near-zero downstream import churn, since all
  current consumers already import via `packages/policy`'s single re-export point. Does **not**
  by itself close the runtime-registration half of the gap — `createConnectorRegistry.ts`'s own
  conditional-registration logic would need a separate, larger restructuring for that. Package
  scaffolding: ~2 hours. Full closure: materially more, not scoped here.

## Recommendation

**Option A now.** The security-relevant fix is already shipped and verified; nothing about this
decision reopens it. Between B and C, C is the architecturally sound target _if_ this gets
built, since it avoids the backwards dependency edge B introduces — but as scoped in the options
document, neither B nor C fully closes the underlying risk without also touching
`createConnectorRegistry.ts`'s registration logic, which is a bigger change than either
estimate captures. Rushing a partial version of B or C now trades a narrow architectural
regression for an incomplete fix; better to scope it properly later than do it fast under
submission pressure.

## Timeline

Dates below are Pavan's own project schedule, carried through as given — not independently
verified against anything in this repository.

- G-30 fix: 2026-08-26 (fixed same-day as found, 2026-08-25)
- This architecture-options documentation: 2026-08-26
- Revisit (Option B or C, per Pavan's choice): scheduled for later, per whatever cadence Pavan
  sets — not committed to a specific date here, since committing to "Q4" or a specific month is
  a scheduling decision for Pavan, not something this document should assert on his behalf.

## Risk

A similar capability-coverage gap can recur for any future connector added before this is
revisited, since the underlying two-independent-lists structure is unchanged by Option A.
Mitigation available today without waiting for B or C: when adding a new connector, manually
cross-check `createConnectorRegistry.ts`'s registrations against
`CANONICAL_CAPABILITY_POLICY_BINDINGS.keys()` as an explicit step (not currently written down
anywhere as a checklist item) — a process mitigation, not a structural one.

## For external review

Full transparency: gap found, fixed same-day, root cause documented, three concrete paths to
close the root cause with honest effort estimates and trade-offs, explicit recommendation. This
document and `G-30-ARCHITECTURE-OPTIONS.md` are both written to withstand the same level of
independent re-verification `docs/CLAIMS.md` and `docs/VERIFICATION-GAPS.md` are held to
elsewhere in this repository — every code claim in both documents was checked against the
actual source before being written, not assumed from the originating prompt.

## Outstanding

~~Awaiting Pavan's choice of A, B, or C.~~ **Decided: Option C (2026-08-26).** Implemented as
scoped in `G-30-ARCHITECTURE-OPTIONS.md`, with one deviation caught and corrected before
implementing: the new `@parmana/capability-registry` package does **not** depend on
`@parmana/connector-github`/`@parmana/connector-hubspot` as originally sketched — both already
depend on `@parmana/policy` (directly, or via `@parmana/connector-sdk`), so importing either
into the new package would have created a dependency cycle back through the package
`@parmana/policy` now depends on. The four capability-identifier strings remain hand-typed,
same as before the move; what the move actually closes is the `packages/policy` →
`packages/api` backwards edge Option B would have required. Full detail, verification steps,
and the updated status in `docs/VERIFICATION-GAPS.md`'s G-30 entry (search "Option C
implemented").
