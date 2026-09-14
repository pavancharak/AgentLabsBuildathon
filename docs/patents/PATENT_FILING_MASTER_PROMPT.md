# Patent Application Management Prompt — Three Ready-to-File Applications

**Repo Location:** `docs/patents/PATENT_FILING_MASTER_PROMPT.md`
**Owner:** Pavan (CEO, Parmana Systems)
**Scope:** Manage 3 provisional patent applications
**Status:** See correction below — NOT ready to file as originally claimed
**Updated:** Aug 25, 2026

> **Correction (2026-08-25):** this file is archived verbatim from Pavan's original prompt below,
> which claimed three patent specifications were "✅ Completely ready to file" at
> `/parmana/docs/patents/PATENT_APP_01/02/03_*_COMPLETE.md`, with a filing timeline starting the
> same day. **None of those three files existed anywhere in this repository** — verified by
> direct search before any action was taken. Two of the three source-code citations
> (`packages/api/src/execution/executeTransaction.ts`, `packages/api/src/policies/policyEngine.ts`)
> also don't exist — the same fabricated paths already caught and corrected once in
> `docs/progress/MASTER_PROGRESS_TRACKER.md`.
>
> Per Pavan (2026-08-25): draft real specifications now, grounded in the actual codebase, rather
> than treating the original claims as true or proceeding to file anything. The three real drafts
> are in this same folder:
>
> - [`DRAFT-01-runtime-credential-isolation.md`](./DRAFT-01-runtime-credential-isolation.md)
> - [`DRAFT-02-signed-execution-audit-trail.md`](./DRAFT-02-signed-execution-audit-trail.md)
> - [`DRAFT-03-policy-change-maker-checker.md`](./DRAFT-03-policy-change-maker-checker.md)
>
> **Every one of them is explicitly labeled a drafting aid for patent-attorney review, not a
> filed or filing-ready application.** No government filing, fee payment, or attorney engagement
> should happen against the original prompt's timeline (which assumed same-day filing) — that
> timeline was built on documents that didn't exist. See
> [`PATENT_FILING_REGISTER.md`](./PATENT_FILING_REGISTER.md) for the actual (empty, honest)
> filing-status register.
>
> The rest of this file is preserved as-supplied for the record, including the parts now known
> to be inaccurate (marked inline where relevant). Do not act on filing dates, IPO reference
> numbers, or "✅ Completely ready" markers below — they are not real.

---

## Purpose (as originally written)

This prompt guides Claude to manage the complete patent filing process:

1. **File 3 provisional applications** (Aug 26-28 timeline)
2. **Track filing confirmations** (government reference numbers, dates)
3. **Maintain filing records** (for Deep Tech application reference)
4. **Manage follow-up actions** (convert to complete apps by Sep 25, 2027)
5. **Update Deep Tech narrative** (reference patents in Sep 15 application)

---

## Three Patent Applications (as originally claimed — NOT accurate, see correction above)

### Patent #1: Runtime Credential Isolation

**File:** `/parmana/docs/patents/PATENT_APP_01_CREDENTIAL_ISOLATION_COMPLETE.md` — **does not exist**
**Status:** ~~✅ Completely ready to file~~ **Not started; see DRAFT-01 instead**
**Source code cited:** `packages/api/src/bootstrap/createConnectorRegistry.ts` — this file is
real, but is the connector-wiring/registry, not where isolation is implemented. DRAFT-01 cites
the actual mechanism instead (`SessionCredentialSecureConnector.ts`, `CredentialVault.ts`,
`SessionCredentialVault`).

### Patent #2: Signed Execution Audit Trail

**File:** `/parmana/docs/patents/PATENT_APP_02_SIGNED_AUDIT_TRAIL_COMPLETE.md` — **does not exist**
**Status:** ~~✅ Completely ready to file~~ **Not started; see DRAFT-02 instead**
**Source code cited:** `packages/api/src/execution/executeTransaction.ts` — **this file and
directory do not exist anywhere in this repository.**

### Patent #3: Maker-Checker Policy Enforcement

**File:** `/parmana/docs/patents/PATENT_APP_03_MAKER_CHECKER_COMPLETE.md` — **does not exist**
**Status:** ~~✅ Completely ready to file~~ **Not started; see DRAFT-03 instead**
**Source code cited:** `packages/api/src/policies/policyEngine.ts` — **this file and directory do
not exist anywhere in this repository.** The real, and considerably stronger, maker-checker
mechanism in this codebase is the policy-change approval workflow
(`packages/api/src/governance/`, `packages/shared/src/domain/pending-policy-change.ts`) —
DRAFT-03 is grounded in that instead.

---

_(The remainder of the originally-supplied filing checklist, register template, post-filing
actions, 12-month conversion timeline, session-by-session instructions, blocker-resolution
guidance, and success criteria are process scaffolding that remains generally reusable once real
drafts exist and an attorney is actually engaged — omitted here for length; ask if you want the
full original text preserved too. The one change that matters procedurally: every "TODAY /
ASAP / Aug 26-28" date in the original assumed the three specs already existed. Re-derive a real
timeline once DRAFT-01/02/03 have had attorney review, not before.)_
