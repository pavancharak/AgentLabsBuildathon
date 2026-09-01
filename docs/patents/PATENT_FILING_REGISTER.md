# Patent Filing Register

Real filing status only. Nothing in this file is populated until a real filing actually happens —
do not pre-fill dates, reference numbers, or costs based on a plan or timeline. See
[`PATENT_FILING_MASTER_PROMPT.md`](./PATENT_FILING_MASTER_PROMPT.md) for why this register starts
empty despite an earlier draft claiming filings were already in progress.

**2026-09-01 update:** the three informal DRAFT-0N documents have each been formalized into
patent-application structure (numbered paragraphs, independent/dependent claims), re-verifying
every cited file and code path against the working tree as of that date rather than trusting the
2026-08-25 drafts unchecked. Candidate D — flagged on 2026-08-25 as "not yet drafted" and
separately assessed in `docs/deep-tech/04-IP-PATENT-SUMMARY.md` as the strongest candidate in the
codebase — has now been drafted for the first time as PATENT-4. None of the four have been
attorney-reviewed, prior-art-searched, or filed. The formal PATENT-N documents supersede the
informal DRAFT-0N documents as the citable spec for each candidate; DRAFT-0N files are kept for
history, not deleted.

| Candidate | Formal Spec | Superseded Draft | Attorney Reviewed? | Prior-Art Search Done? | Filed? | Filing Date | IPO Reference # | Govt Fee Paid | Professional Fee Paid |
|-----------|-------------|-------------------|---------------------|--------------------------|--------|-------------|-------------------|-----------------|--------------------------|
| A — Runtime Credential Isolation | [PATENT-1](./PATENT-1-runtime-credential-isolation.md) | [DRAFT-01](./DRAFT-01-runtime-credential-isolation.md) | No | No | No | — | — | — | — |
| B — Signed Execution Trust Record | [PATENT-2](./PATENT-2-signed-execution-trust-record.md) | [DRAFT-02](./DRAFT-02-signed-execution-audit-trail.md) | No | No | No | — | — | — | — |
| C — Policy-Change Maker-Checker Governance | [PATENT-3](./PATENT-3-policy-change-governance.md) | [DRAFT-03](./DRAFT-03-policy-change-maker-checker.md) | No | No | No | — | — | — | — |
| D — Signal/Intent Binding + Capability/Policy Binding | [PATENT-4](./PATENT-4-signal-intent-and-capability-policy-binding.md) | — (not previously drafted) | No | No | No | — | — | — | — |

**Next real step:** get PATENT-1/2/3/4 in front of an actual patent attorney — per
`docs/deep-tech/04-IP-PATENT-SUMMARY.md`'s own recommendation, prioritize D if only one can be
filed on a near-term timeline, since it has the strongest documented novelty narrative (a real,
self-discovered execution-authorization bypass and its structural fix, not a defensively-designed
mechanism). Nothing in this register should be updated until each column reflects something that
actually happened, with a citable artifact (an email, a receipt, a reference number) — not a plan
or an expected date.
