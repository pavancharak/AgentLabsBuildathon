# Strategic Positioning — Source Code Validation (Living Document)

Certifies, from current repository state, whether the locked strategic positioning **"We
Are Not in the AI Race"** is supported by the implementation. This document is distinct
from `docs/architecture/phase3d-independent-authorization-certification.md`: Phase 3D
certified one specific marketing claim ("AI cannot execute anything the business hasn't
authorized") scoped to the two production-reachable capabilities. This document certifies
the broader positioning — that the authorization mechanism itself protects institutional
authority against execution risk from _any_ source, not only AI, and does not depend on any
particular AI technology.

**This is a living document.** Unlike a one-time audit, its verdict is a snapshot that can
be invalidated by ordinary code changes — a new connector, a new caller-identity concept, a
change to `RuntimeEngine`'s pipeline, or the reintroduction of an unverified-signal
capability would each require re-checking sections below, not just appending to them. See
"When to Re-Validate" at the end.

**Status as of this revision: SUPPORTED BY IMPLEMENTATION — YES, directly validated.**
Upgraded from three prior PARTIALLY verdicts (preserved below as history, not erased — see
"Verdict History"). The structural change that earned this: `payments:execute`
(vendor-payment), the one capability whose authorization-relevant facts were pure
caller-declared attestations with no independent verifier, was **removed from the
repository entirely**, not merely gated more tightly. A fourth, independent validation pass
— run fresh after that removal, with no reliance on the first three passes' conclusions —
confirmed no connector resolves for it in any environment. See §3.1 and §6.

**Honesty constraint, carried forward precisely, not rounded away:** the fourth pass did
not re-verify everything from scratch. It re-ran 2 of the 10 negative tests cited across
this document's history fresh (`authority-type-agnostic-execution.integration.test.ts`,
`create-connector-registry.test.ts`'s new cross-environment absence case); the other 8 were
cited from code paths confirmed unchanged by the removal, not individually re-executed in
that pass. Multi-tenant isolation (§3.3) and the direct-database-write bypass finding were
explicitly left as "unchanged, not re-traced" rather than re-asserted clean. **"YES" means
the specific invariant this positioning states — only institutionally authorized actions
become execution — is now supported without a known exception, not that every property in
this document was independently re-proven in the same session.**

### Verdict History

| Pass                                                  | Verdict                                  | What changed before the next pass                                                                                                                                      | Where recorded                           |
| ----------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1 (initial)                                           | PARTIALLY SUPPORTED                      | —                                                                                                                                                                      | This document, original revision         |
| 2 (after AI-agnosticism test + DB-write-bypass trace) | PARTIALLY SUPPORTED, narrower            | `authority-type-agnostic-execution.integration.test.ts` added; DB-write-bypass ruled out                                                                               | This document, §2 upgrades noted inline  |
| 3 (fresh re-verification, rule-20 discipline)         | PARTIALLY SUPPORTED, confirmed unchanged | No repository change; independent re-confirmation only                                                                                                                 | Delivered in-conversation                |
| **4 (after vendor-payment removal)**                  | **SUPPORTED BY IMPLEMENTATION — YES**    | `payments:execute` removed entirely (`docs/VERIFICATION-GAPS.md` G-27); replacement test-only connector independently scrutinized and found to introduce no new bypass | Delivered in-conversation; this revision |

Passes 1–3 are not deleted or rewritten — they were correct assessments of the repository
state at the time each ran. The verdict changed because the repository changed, not because
the earlier passes were wrong.

---

## 1. Locked Positioning Under Validation

> Parmana will not compete in the AI race. Parmana is technology agnostic. Its purpose is
> to protect institutional authority over what is allowed to become real-world execution.
> AI agents are one source of execution risk, but they are not the only source... **Only
> what you authorize should become real.** ... **AI may decide. You decide what becomes
> real.**

Validated against commit history through `authority-type-agnostic-execution.integration.test.ts`
and the `docs/CLAIMS.md` §2.24 / §2.22 / §2.23 entries this document's findings are recorded
in.

---

## 2. What Is Now Directly Validated

| Property                                                                                                                                                 | Status                                                   | Evidence anchor                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No AI-vendor dependency anywhere in the monorepo                                                                                                         | DIRECTLY VALIDATED                                       | Zero hits for openai/anthropic/langchain/gemini/etc. across every `package.json`                                                                                                                                                                                                                                                                                                                                                   |
| Authorization mechanism has no concept of "AI"                                                                                                           | DIRECTLY VALIDATED                                       | `RuntimeEngine`, `PolicyEngine`, `SignalIntentBinder`, `CapabilityPolicyBinder` — zero references to caller identity, model, or vendor anywhere in source                                                                                                                                                                                                                                                                          |
| Authorization outcome is caller-type-agnostic, not merely caller-type-blind by omission                                                                  | **DIRECTLY VALIDATED (upgraded from INFERRED)**          | `docs/CLAIMS.md` §2.24; `packages/api/tests/integration/authority-type-agnostic-execution.integration.test.ts` — an arbitrary, non-enum `authorityType` string produces byte-identical APPROVE and REJECT decisions to a conventional one, through the real `POST /execute` route. Re-run fresh in pass 4 (2/2 passing) after the vendor-payment removal, confirming no regression.                                                |
| Institutional authority (policy) controls execution, not the caller                                                                                      | DIRECTLY VALIDATED                                       | `FilePolicyRepository` reads from a server-controlled directory; no HTTP route writes policy content; `CapabilityPolicyBinder` fixes capability→policy binding structurally (`docs/CLAIMS.md` §2.22, TD-22)                                                                                                                                                                                                                        |
| Authorization enforced strictly before execution, for the two live capabilities                                                                          | DIRECTLY VALIDATED                                       | `ExecutionGate.enforce()` gates every path to a connector; `ExecutionComponent` throws if decision/authorization missing                                                                                                                                                                                                                                                                                                           |
| Unauthorized execution fails closed, not merely reported                                                                                                 | DIRECTLY VALIDATED                                       | 13 negative tests, cited in full in the Phase 3D certification §6 and the Strategic Positioning audit §6                                                                                                                                                                                                                                                                                                                           |
| No route, SDK method, or repository write path bypasses `RuntimeEngine`                                                                                  | **DIRECTLY VALIDATED (upgraded from NOT VALIDATED)**     | Every write method on `ExecutionTrustRecordRepository`/`BusinessTransactionRepository` traced to exactly one caller, always inside `packages/runtime/src/services/*` or `ExecutionTrustApplication`; see `docs/VERIFICATION-GAPS.md`, "Gaps checked and found not applicable". **Not re-traced in pass 4** — carried forward as still valid since the removal did not touch storage-layer callers, not re-verified fresh.          |
| Every production capability's authorization-relevant facts are independently verified before authorization is signed — **repository-wide, no exception** | **DIRECTLY VALIDATED (upgraded from PARTIALLY, pass 4)** | `packages/api/src/bootstrap/createConnectorRegistry.ts` registers exactly three connectors: `test-fixture` (`NODE_ENV=test`-only, unbound from `CapabilityPolicyBinding.ts`, no production implication), `razorpay`, `hubspot`. `payments:execute` has no connector to resolve to in any environment — `createVendorPaymentConnector.ts` and its dedicated credential provider no longer exist (`docs/VERIFICATION-GAPS.md` G-27). | `packages/api/tests/unit/bootstrap/create-connector-registry.test.ts`, "payments:execute has no connector to resolve to in any environment — vendor-payment was removed, not merely gated" — asserts this across `test`/`production`/`development` `NODE_ENV` values; re-run fresh in pass 4, 4/4 passing |
| `PARMANA_AUTH_DISABLED` does not disable action-level authorization                                                                                      | DIRECTLY VALIDATED, precisely scoped                     | `docs/VERIFICATION-GAPS.md` G-28; `docs/CLAIMS.md` §2.16 addendum — the flag removes caller identity/accountability only; `RuntimeEngine`'s gates have no dependency on it                                                                                                                                                                                                                                                         |
| Execution is bound to the exact authorized decision (no substitution after the fact)                                                                     | DIRECTLY VALIDATED                                       | `businessTransactionHash` recomputed and compared in `ExecutionGateway.verify()`; `SignalIntentBinder` proves signals describe the same action as `Intent`                                                                                                                                                                                                                                                                         |
| Replay is prevented by database-enforced atomicity, not application logic                                                                                | DIRECTLY VALIDATED                                       | `SupabaseNonceStore`/`SupabaseApprovalNonceStore`/`SupabaseRazorpayDailyRefundLedger` — single `INSERT`/`UPSERT` gated by a primary key, proven under live concurrent Postgres load                                                                                                                                                                                                                                                |
| Execution evidence is independently, cryptographically verifiable by a third party                                                                       | DIRECTLY VALIDATED                                       | `POST /audit/verify`, `POST /refusal/verify` — unauthenticated, need only Parmana's public key                                                                                                                                                                                                                                                                                                                                     |

---

## 3. What Remains Honestly Unresolved

These are not failures of documentation — they are genuine scope boundaries the mechanism
itself has not yet earned the right to claim past.

### 3.1 `payments:execute` (vendor-payment) — RESOLVED by removal (pass 4)

**Historical record (true through pass 3):** real, committed code
(`policies/vendor-payment/2.0.0/policy.json`, `VendorPaymentConnector`) whose five
authorization-relevant signals (`vendorVerified`, `invoiceVerified`, `paymentApproved`,
`sufficientFunds`, `riskScore`) were pure caller-declared attestations with **no
independent verifier anywhere in this codebase**. Excluded from production only by
`createVendorPaymentConnector.ts:30-32`'s `NODE_ENV === "test"` gate — an environment
variable, not a property of the authorization mechanism. If enabled as it then existed, it
would have violated "only what you authorize should become real": a caller could declare
`paymentApproved: true, sufficientFunds: true` etc. with nothing real behind those claims,
and receive a signed, APPROVED execution. This was, through pass 3, the sole reason the
verdict read PARTIALLY rather than FULLY supported.

**Current state (pass 4):** the capability was removed outright, not gated more tightly.
`createVendorPaymentConnector.ts` and its dedicated credential provider
(`createCredentialProvider.ts`) no longer exist. `createConnectorRegistry.ts` registers
exactly three connectors in production wiring: `test-fixture` (a generic,
`NODE_ENV=test`-only connector introduced solely so shared test infrastructure has
something to execute against, capability `test:fixture-execute`, unbound in
`CANONICAL_CAPABILITY_POLICY_BINDINGS`, no production implication), `razorpay`, `hubspot`.
`payments:execute` has no connector to resolve to in any environment — confirmed by
`create-connector-registry.test.ts`'s "payments:execute has no connector to resolve to in
any environment" case, which asserts this across `test`, `production`, and `development`
`NODE_ENV` values, re-run fresh in pass 4 (4/4 passing).

**Decision, stated plainly:** this was not independently verified — it was never on the
product roadmap as a real capability, so building the `SignalStateVerifier` work that would
have closed it (the same closure Razorpay and HubSpot already received) was rejected in
favor of removal. **Full detail, including what was deliberately retained** (the policy
file and shared test fixtures, which carry no execution risk with no connector to pair
with): `docs/VERIFICATION-GAPS.md` G-27.

**This is the reason §"Status" above now reads YES, not PARTIALLY.**

### 3.2 Caller-type-agnosticism, mechanism vs. exercise

§2's "DIRECTLY VALIDATED" entries prove the _mechanism_ contains no code path that could
distinguish an AI agent from a human, script, or third-party system. They do **not** prove
that a human, or a non-AI automated system, has actually submitted a production transaction
— no such exercise exists in this repository's test or deployment history as reviewed. The
distinction matters: this document claims "the mechanism cannot special-case caller kind,"
not "every caller kind has been observed in the wild."

### 3.3 Multi-tenant / cross-institution authority isolation

Explicitly out of scope, not attempted, and not characterized as a gap — the positioning
speaks of "institutional authority" in the singular. This repository's `Authority` model
(`USER | ROLE | SERVICE | ORGANIZATION`) supports one institution's principal/role/service/
organization hierarchy; no evidence was gathered bearing on isolation between multiple
institutions sharing one deployment, because nothing in the current architecture claims to
support that scenario either way.

---

## 4. Contradictions

No source-code behavior currently reachable in production contradicts the positioning.
**No conditional contradiction remains as of pass 4.** Through pass 3, this section named
one: `payments:execute` (§3.1), if ever enabled without first closing its
signal-verification gap, would have directly contradicted "only what you authorize should
become real." That capability no longer exists in this repository, so the contradiction it
would have produced cannot occur. Independently re-scrutinized in pass 4: the replacement
test-only connector (`test:fixture-execute`) does not reintroduce it — it is fail-closed by
the identical `NODE_ENV === "test"` mechanism every other connector uses, and unbound from
`CapabilityPolicyBinding.ts`'s governance entirely, so its own unverified signals (inherited
unchanged from the retained `vendor-payment/2.0.0` policy content) carry no production
implication.

---

## 5. Evidence Trail (Where Each Finding Lives)

| Finding                                                                                                   | Document                                                                                                                  | Section                                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Full claim-by-claim matrix, execution control path, enforcement points, bypass search, negative tests     | This document's originating audit (delivered in-conversation; not separately filed, per that audit's own read-only rules) | —                                                                                                                             |
| Canonical capability-to-policy binding (TD-22)                                                            | `docs/CLAIMS.md`                                                                                                          | §2.22                                                                                                                         |
| Phase 3D authorization certification (narrower marketing claim, two live capabilities)                    | `docs/architecture/phase3d-independent-authorization-certification.md`                                                    | Full document                                                                                                                 |
| Certification-level positioning summary and carried-forward limitations                                   | `docs/CLAIMS.md`                                                                                                          | §2.23                                                                                                                         |
| Caller-type-agnosticism, directly validated                                                               | `docs/CLAIMS.md`                                                                                                          | §2.24                                                                                                                         |
| `PARMANA_AUTH_DISABLED` precise scope                                                                     | `docs/VERIFICATION-GAPS.md`                                                                                               | G-28; also `docs/CLAIMS.md` §2.16 addendum                                                                                    |
| vendor-payment removal (RESOLVED, was "gap-in-waiting" through pass 3)                                    | `docs/VERIFICATION-GAPS.md`                                                                                               | G-27 (cross-references the original 2026-08-04 investigation inside the G-24 block, and its own "RESOLVED by removal" update) |
| `payments:execute` absence, repository-wide, independently re-confirmed (pass 4)                          | `packages/api/tests/unit/bootstrap/create-connector-registry.test.ts`                                                     | "payments:execute has no connector to resolve to in any environment" test                                                     |
| Direct-database-write bypass, ruled out                                                                   | `docs/VERIFICATION-GAPS.md`                                                                                               | "Gaps checked and found not applicable"                                                                                       |
| Historical G-24 signal/intent decoupling bypass (found and fixed, independently re-confirmed by Phase 3D) | `docs/VERIFICATION-GAPS.md`                                                                                               | G-24, with its Phase 3D re-confirmation paragraph                                                                             |

---

## 6. Final Answer

> **Based solely on the current repository implementation, does Parmana enforce the
> boundary that only institutionally authorized actions can become real-world execution,
> regardless of what kind of system requests them?**

**YES — directly validated (pass 4, superseding the PARTIALLY verdicts of passes 1–3).**

The _mechanism_ was already fully validated, with no remaining inferred or unvalidated
claims, for every capability the production system actually exposed as of pass 3 — proven,
not merely argued, to be blind to caller kind. The single remaining reason the verdict
stayed at PARTIALLY through pass 3 was `payments:execute`: dormant, disclosed, and honestly
characterized as a gap-in-waiting rather than swept into the "supported" column. Pass 4,
run fresh after that capability's outright removal, independently re-confirmed the
mechanism's other properties were unaffected and specifically re-verified — not assumed —
that no connector resolves for `payments:execute` in any environment, and that the
replacement test-only connector introduces no new bypass. Every other candidate concern
raised across this validation's history (`PARMANA_AUTH_DISABLED`, the second
`/transactions` entry point, in-process library use) was found to be a non-issue on direct
inspection or precisely scoped to what it actually affects, not left ambiguous.

**What YES does not claim, stated precisely so the upgrade cannot be misread as broader
than it is:** pass 4 re-executed only 2 of the 10 negative tests this document's history
cites (`authority-type-agnostic-execution.integration.test.ts`,
`create-connector-registry.test.ts`'s new absence case); the other 8 are carried forward
from code paths confirmed structurally unchanged by the removal, not individually re-run in
that pass. The direct-database-write bypass finding (§2) and multi-tenant isolation (§3.3)
were explicitly left as "unchanged, not re-traced" in pass 4, not re-asserted clean. YES
means the specific invariant this positioning states — an action cannot become real-world
execution unless it satisfies the institution's authorization requirements — is now
supported without a known exception, for every capability this repository currently
exposes. It does not mean every property adjacent to that invariant was re-proven from
scratch in the same session.

---

## 7. When to Re-Validate

This document's verdict is only as current as the commit it was checked against. Re-check
(at minimum) the affected section, not the whole document, when any of the following occur:

- **A new connector/capability is registered in production**, or `payments:execute` /
  an equivalent unverified-signal capability is ever reintroduced (`createConnectorRegistry.ts`
  gains a new entry) — re-check §2's authorization-enforcement rows for that specific
  capability, and re-open §3.1/§6's YES verdict specifically if the new or reintroduced
  capability lacks independent signal verification, the same way `payments:execute` once
  did.
- **`RuntimeEngine`, `PolicyEngine`, `SignalIntentBinder`, or `CapabilityPolicyBinder`
  changes** — re-run the caller-identity grep (§2's "no concept of AI" row) and re-run
  `authority-type-agnostic-execution.integration.test.ts` to confirm it still passes.
- **A new authentication mechanism is added** (OAuth, mTLS, a second `CallerAuthenticator`
  implementation) — re-check whether it introduces any caller-kind-specific authorization
  branching, which would falsify §2's caller-agnosticism row.
- **`PARMANA_AUTH_DISABLED`'s wiring changes**, or any code begins reading caller identity
  inside `RuntimeEngine` — re-check G-28's precise-scope claim; it would no longer hold.
- **A new repository write method is added** to `ExecutionTrustRecordRepository`,
  `BusinessTransactionRepository`, or an equivalent store — re-check its caller(s) before
  assuming the "no direct-write bypass" finding still holds.
- **Multi-tenancy is designed or implemented** — this document currently says nothing about
  it either way; that silence stops being accurate the moment a real design exists to check
  against.

No section of this document should be treated as permanently true. Each row in §2 names the
exact file(s)/test that would need to be re-read to confirm it still holds.
