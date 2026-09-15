# Evidence Anchor Gap Audit

_Investigation-only session. Zero source changes. Snapshot: 2026-09-15, `main` @ `b1b2f7a`._

## 0. What this audit was asked to find

An external prompt asked whether four independent evidentiary records exist for every
execution — a declared operator perimeter, a signed authorization decision, a signed
backend-execution confirmation, and a binding "evidence anchor" linking all three — and
predicted, up front, that none of it would exist yet. The prompt's own file paths
(`packages/policy/src/policy_loader.py`, a top-level `packages/receipt/`,
`connector-razorpay/src/razorpay-connector.ts`) don't match this codebase (TypeScript
throughout, no Python server-side, no Razorpay connector package); the real modules were
traced instead and are cited below.

**This first pass got one major thing wrong, corrected in §4:** an initial read of
`packages/policy` and `packages/runtime` in isolation concluded the policy content actually
used for a decision is never cross-checked against what an operator approved. That's false —
`docs/CLAIMS.md` §2.26/§2.27 and `RuntimeEngine.ts` show real, tested code doing exactly
that, just gated behind an environment flag this deployment currently has off. Leaving both
the wrong first conclusion and the correction in this document, not silently fixing it,
because the gap between "grep three files" and "check whether an existing CLAIMS.md section
already covers this" is itself worth recording.

## 1. GAP-1: Declared Perimeter — mechanism exists, coverage doesn't

**What exists.** `PolicyChangeApprovalService.approve()`
(`packages/api/src/governance/PolicyChangeApprovalService.ts:53-138`) produces a
`PolicyChangeApprovalRecord` — `policyName`, `policyVersion`, `proposedBy`, `approvedBy`,
`proposedAt`, `approvedAt`, `contentHashBefore`/`contentHashAfter`, `previousRecordHash`
(hash-chained to the prior record for the same policy+version) — signed with the same
`DEFAULT_KEY_ID` every other trust artifact uses (`packages/crypto/src/PolicyChangeCrypto.ts:79-99`),
durably persisted (Supabase-backed `PolicyChangeApprovalRecordRepository`), _before_ the live
`policies/{name}/{version}/policy.json` file is written, not after — proven, not just
documented (`packages/api/tests/unit/PolicyChangeApprovalService.test.ts` injects a failure
at each step). This is already thoroughly documented in `docs/CLAIMS.md` §2.26 and was not
independently rediscovered here; it's summarized only to establish what Record 1 actually
is.

**What's genuinely missing, confirmed by grep, not in CLAIMS.md's own framing:**
`PolicyRepository.save()` has exactly one caller in the entire codebase —
`PolicyChangeApprovalService.approve()`. So the mechanism only ever fires for a change made
through the live governance API. `docs/CLAIMS.md` §2.26's own "Legacy-policy backfill"
section already states the resulting coverage gap precisely: all 10 real policies currently
in `policies/` were bootstrapped by direct git commit, were only retroactively _proposed_
through the real API on 2026-08-19, and **zero rows exist in
`policy_change_approval_records`** — no policy, legacy or otherwise, has ever completed
approval, as of that section's own last-checked date. Not independently re-verified against
a live database this session (no live credentials in scope); stated here as "matches
CLAIMS.md's own last-recorded state," not as freshly re-confirmed.

**Also missing, not covered by CLAIMS.md §2.26 at all:** `agentId`/scope, structured
declared limits (`maxAmountPerTxn` etc. — present only implicitly inside the hashed JSON
blob, never extracted into queryable fields), and valid-from/valid-to dates. None of these
exist on the `Policy` type (`packages/policy/src/types/Policy.ts:198-238`) or anywhere in the
governance record. And the signature is Parmana's own system key attesting "the caller
identified as X did this," not a signature made with the operator's own personally-held key
— CLAIMS.md §2.26 names this precisely as an open, unresolved question ("the
human-vs-AI-agent identity problem").

**Verdict:** PARTIAL. Mechanism real and well-tested; coverage for everything currently
deployed is zero; several fields the original prompt asked for were never in scope for this
feature at all.

## 2. GAP-2: Authorization Decision — richer than predicted, but the richest part doesn't survive to storage

`PolicyEngine.evaluate()` (`packages/policy/src/PolicyEngine.ts:35-55`) computes a full
`PolicyDecision`: `outcome`, `reason`, **and** `matchedRuleId`, `evaluatedRules` (count), and
`matchedPath` (the complete ordered rule-id trace) — this is already a stronger evidentiary
record than the prompt assumed existed anywhere.

**Confirmed gap:** `DecisionBuilder.build()` (`packages/runtime/src/DecisionBuilder.ts:32-51`)
takes that `PolicyDecision` and produces the `Decision` that actually gets persisted and
signed — and drops `matchedRuleId`, `evaluatedRules`, and `matchedPath` in the process. Only
the free-text `reason` string survives into the durable artifact. An auditor holding a signed
`ExecutionTrustRecord` gets prose, not a structured, independently re-checkable rule
citation, even though the structured version existed in memory one function call earlier.

**Asymmetry, also confirmed:** a REJECT decision gets an independently addressable, signed,
retrievable artifact of its own — `RefusalRecordBuilder`
(`packages/runtime/src/RefusalRecordBuilder.ts`), its own hash, its own signature, `GET
/refusal/:id`, zero-trust verification via `POST /refusal/verify`. An APPROVE decision gets
no equivalent: `Decision` exists only nested inside the full `ExecutionTrustRecord`; there is
no `GET /decisions/:id` (confirmed against the full route table, `packages/api/src/app.ts`).

**Verdict:** PARTIAL, and better than the "might not be queryable separately" prediction —
the rich data exists, it just doesn't make it past one function boundary into anything
durable.

## 3. GAP-3: Action Executed — thorough capture, but a trust boundary Parmana can't see across

`ExecutionEvidenceBuilder` (`packages/runtime/src/ExecutionEvidenceBuilder.ts`) and, for a
real connector, `buildConnectorEvidence()`
(`packages/execution-gateway/src/connector-execution/ConnectorEvidence.ts:84-116`) capture a
genuinely thorough record: `connectorId`, `connectorVersion`, `capability`,
`sanitizedEndpoint` (credentials/query stripped), `credentialProviderId`, redacted
request/response summaries, `startedAt`/`completedAt`, and its own `connectorEvidenceHash`,
folded into the overall `ExecutionTrustRecord` hash. No separate table — it's embedded, not
standalone — but that matches how every other artifact in this system works (one signed
envelope, not a table per concept), not obviously a gap on its own.

**Real, confirmed limit:** for the one connector that touches real money in this deployment
(`GatewayPaytmAdapter.ts:29-50`), the adapter's own doc comment states it plainly — it
"never calls Paytm's own API, never holds `PAYTM_MERCHANT_KEY`, and never re-runs
authorization." Paytm's own checksum/signature verification happens entirely inside a
_separate_ repository (`parmana-paytm-agent`), reached over HTTPS with a shared-secret
transport credential. So even the strongest real-execution case here cannot, from within
this codebase, independently verify a cryptographic confirmation the backend itself
produced — what's recorded is what Parmana's own HTTP call observed, hashed by Parmana, not
signed by the vendor.

**Verdict:** PARTIAL. Data capture is strong. Independent, vendor-originated confirmation is
out of this repository's reach by architecture, not by oversight — `docs/CLAIMS.md` §3.22
already scopes this boundary explicitly for Paytm specifically (`docs/VERIFICATION-GAPS.md`
G-42/G-43 closed the _audit-trail_ half of that same boundary on 2026-09-14; the
_cryptographic-confirmation_ half addressed here is a different, still-open question).

## 4. GAP-4: Evidence Anchor — the corrected finding

**First pass (wrong):** grepping the whole tree for `evidence_anchor`/`anchor`/`binding`
found nothing but a markdown table's column header. Concluded: nothing links Record 1 to
Records 2/3 at all.

**What was missed, then found by reading `docs/CLAIMS.md` §2.26/§2.27 directly:**

1. **G-24 (`docs/CLAIMS.md` §2.26, already shipped):** `RuntimeEngine.execute()` computes
   `policyContentHash` from the actually-loaded policy document and stamps it onto
   `ExecutionTrustRecord.transaction.policy.contentHash`
   (`PolicyReference.contentHash`, `packages/shared/src/domain/policy-reference.ts:31`) —
   so an auditor _can_ tell, after the fact, exactly which policy _content_, not just which
   version string, produced a given decision.
2. **§2.27 policy-freshness enforcement (already shipped):** the same hash is signed into
   the `ExecutionAuthorizationPayload` itself and independently re-checked by
   `ExecutionGateway` immediately before a connector runs (`policyStillCurrent`,
   `packages/execution-gateway/src/ExecutionGateway.ts`) — closing a TOCTOU gap between
   decision time and execution time, opt-in via `ExecutionGatewayOptions.policyRepository`.
3. **`PolicyGovernanceExecutionVerifier` (§2.26, already shipped):** when
   `POLICY_EXECUTION_VERIFICATION_ENFORCED=true`, `RuntimeEngine` refuses to evaluate a
   policy at all unless its most recent `PolicyChangeApprovalRecord` exists, its signature
   verifies, and its `contentHashAfter` matches the content about to be evaluated
   (`packages/api/src/governance/PolicyGovernanceExecutionVerifier.ts:31-63`) — this is
   precisely the Record-1-to-Record-2 binding check the original prompt asked whether an
   evidence anchor would provide.

So Record 4, for the policy-governance half specifically, is **built and tested**, not
missing. What's still real, after crediting all three of the above:

- **Off by default, and can't be turned on yet.** `createPolicyExecutionVerifier.ts:1-31`'s
  own comment states enabling it today "would refuse every execution in the system," because
  every real deployed policy is still `PENDING_APPROVAL` (GAP-1 above). The mechanism exists;
  it cannot be live until the backfill CLAIMS.md §2.26 describes is completed.
- **A pass produces no artifact of its own.** `PolicyGovernanceExecutionVerifier.verify()`
  returns `undefined` on success — nothing is written or signed to say "this decision was
  checked against approval record X and matched." Only a _failure_ leaves a durable trace
  (an ordinary policy rejection, which does get a signed `RefusalRecord`). An auditor with a
  clean `ExecutionTrustRecord` from a deployment running with enforcement on can infer the
  check must have passed, but holds no independent artifact proving that check specifically
  ran, as opposed to `policyExecutionVerifier` having been unconfigured.
- **Record 3 is outside all three mechanisms.** None of G-24, §2.27, or
  `PolicyGovernanceExecutionVerifier` reference `ConnectorEvidence` or its
  `connectorEvidenceHash` at all — they bind policy content to the decision, never the
  decision to what a connector actually did afterward, beyond both sitting in the same
  overall signed envelope.

**Verdict:** PARTIAL, not MISSING — a materially different conclusion from this document's
own first pass. The policy-governance half of Record 4 is real, tested, and currently
disabled pending a backfill. The connector-evidence half was never attempted and remains
open.

## 5. Corrected gap register (supersedes §1's original four-way MISSING/PARTIAL table)

| Gap                                                           | Status                          | Blocking factor                                                                                     |
| ------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| GAP-1: declared-perimeter coverage                            | PARTIAL                         | Zero of 10 live policies have a completed approval record (already tracked, `docs/CLAIMS.md` §2.26) |
| GAP-2: structured decision trace discarded before persistence | PARTIAL, newly identified       | `DecisionBuilder.build()` drops fields `PolicyEngine` already computed                              |
| GAP-3: no vendor-originated backend confirmation              | PARTIAL, architecturally scoped | Out of this repo's reach for Paytm by design (separate repository)                                  |
| GAP-4: policy-governance evidence anchor                      | PARTIAL, corrected from MISSING | Built, tested, feature-flagged off, no positive-pass artifact, no connector-evidence linkage        |

## 6. Suggested next steps, in order

1. Complete the Record-1 legacy backfill (already the documented blocker for enabling
   `POLICY_EXECUTION_VERIFICATION_ENFORCED` — a process/scheduling dependency, not a code
   change; see `docs/CLAIMS.md` §2.26's "Legacy-policy backfill" for the exact pause point).
2. Preserve `matchedRuleId`/`evaluatedRules`/`matchedPath` through `DecisionBuilder` into the
   persisted `Decision` (small, precise fix — the data already exists one call frame away).
3. Once (1) is done and enforcement can safely be turned on, consider whether a _positive_
   pass should also leave a durable trace (e.g., stamping the matched
   `PolicyChangeApprovalRecord`'s id/hash onto the `ExecutionTrustRecord` itself, the same
   way `policyContentHash` already is) — currently only failure is evidenced.
4. Connector-evidence-to-governance linkage (the Record-3 half of a complete evidence
   anchor) has no design yet; genuinely new scope, not a fix to something partially built.

No files outside `docs/investigations/` were changed to produce this document.

## Addendum, same day: GAP-5, found after GAP-4/GAP-3 were fixed (G-45/G-46)

After `PolicyGovernanceAnchorResolver` (G-45) and `vendorConfirmationVerified` (G-46) shipped,
a design question surfaced about `PolicyGovernanceExecutionVerifier` — the pre-existing,
still-feature-flagged-off enforcement gate G-45's resolver deliberately does not replace or
change: **should a policy-governance mismatch actually stop execution, and should every kind
of mismatch be treated the same way?**

**What exists today.** `PolicyGovernanceExecutionVerifier.verify()`
(`packages/api/src/governance/PolicyGovernanceExecutionVerifier.ts:31-63`) returns one of
three distinct failure reasons — no approval record at all, an approval record whose
signature doesn't verify, or live content that no longer matches the approval record's
`contentHashAfter` — but `RuntimeEngine` treats all three identically: an ordinary policy
REJECT, no authorization ever generated
(`packages/runtime/src/RuntimeEngine.ts:284-291`, `capabilityBindingViolation`'s sibling
check). Once `PolicyGovernanceAnchorResolver` (G-45) gives every execution a structured,
always-present answer to "which of these, if any, is true" (`VERIFIED` |
`NO_APPROVAL_RECORD` | `SIGNATURE_INVALID` | `CONTENT_MISMATCH`), the question of whether
enforcement should treat all three the same becomes answerable with real data for the first
time, once enforcement can safely be turned on at all (still blocked on the G-1 backfill).

**GAP-5: `SIGNATURE_INVALID` (a tamper signal) and `NO_APPROVAL_RECORD`/`CONTENT_MISMATCH`
(which can be honest process gaps, e.g. a legitimate hotfix that hasn't gone through
governance yet) currently have no way to be handled differently — enforcement, if turned on,
blocks on all three identically, with no graduated response.** This is a defensible
conservative default (fail closed on any unknown-legitimacy mismatch is the same discipline
this codebase applies everywhere else — see `docs/investigations/2026-09-15-evidence-anchor-gap-audit.md`'s
own GAP-4 finding, and `AuthorizationVerifier`'s fail-closed unrecognized-version handling),
not a bug. But it means there is no way today to, for example, hard-block only on
`SIGNATURE_INVALID` while alerting-and-continuing on `NO_APPROVAL_RECORD` during a
transition period — an all-or-nothing choice a real rollout of enforcement will likely want
to reconsider once the backfill is complete and enforcement is actually being turned on for
the first time.

**Verdict:** not a defect in what was built this session (G-45's resolver correctly reports
the distinction; only the _enforcement_ verifier, unchanged, collapses it). A genuine open
design question for whenever `POLICY_EXECUTION_VERIFICATION_ENFORCED` is actually turned on
— tracked so it isn't decided implicitly by default behavior nobody chose on purpose. See
`docs/VERIFICATION-GAPS.md` G-47 and `02-REMAINING.md`'s Tier 0 for where this is registered
going forward.
