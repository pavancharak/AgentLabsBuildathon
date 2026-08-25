# CLAIMS.md Audit Report

**Audited file:** `docs/CLAIMS.md`
**Repo commit:** `822d65f` (main; note the requesting brief cited `d83b9b8` — CLAIMS.md and VERIFICATION-GAPS.md were both updated by a prior session in this same conversation, adding §3.19/§3.20 and closing G-29, before this audit began. This report audits the file as it actually stands, not the `d83b9b8` snapshot.)
**Method:** every citation below was independently checked against the working tree — file existence via `Glob`/`Read`/`Bash`, code content read directly, and three test suites actually executed (not merely grepped) to get exact pass counts. Three parallel sub-audits covered §1–§2.15, §2.17–§2.26, and §3.1–§3.9/§3.12–§3.18; the sections most recently written this session (§2.16, 2.19, 2.20, 3.10, 3.11, 3.16, 3.19, 3.20) were verified directly by the lead pass. Combined, this is complete coverage of every numbered claim in the file — §3.4–§3.7 were checked and confirmed to not exist as section headers at all (numbering jumps 3.3 → 3.8 in the source), not a gap in this audit.

## Summary

CLAIMS.md is **not currently production-ready as a trust document** — not because the underlying system is untrustworthy, but because the document itself contains a cluster of five present-tense sections (§2.21–§2.25) that still assert `razorpay:refund-create` is "actually reachable in production" and cite test files and source files that were deleted when the Razorpay connector was removed from this codebase on 2026-08-12 (commit `d8a6ded`). One of these — §2.25 — is directly, mechanically falsifiable: it describes `createConnectorRegistry.ts` as registering three connectors including `razorpay`; the file registers exactly two, with zero Razorpay references, confirmed by both direct code reading and the file's own dedicated test. This is the same class of defect the sibling sections §3.8, §3.9, and §3.16 got right (each is explicitly marked "Historical: Razorpay connector removed 2026-08-12" and maintains past tense throughout) — the removal was handled correctly in three places and missed in five adjacent ones, plus two more (§3.3, §3.12) with unrelated stale-refactor citations of their own. Beyond that cluster, the rest of the document is in good shape: roughly two-thirds of sections have zero issues, several (§2.10, §2.13's core claim, §2.15, §2.22's core mechanism, §3.2, §3.13, §3.14, §3.15, §3.17) have exact, verbatim-verified evidence including precise test counts confirmed by actually running the suites, and the newest sections added this session (§3.19, §3.20) are clean. The remaining issues are lower-severity and mechanical: a cluster of eight broken `G-0N` gap-reference labels in §2.1–§2.7 that resolve to nothing, six test-file citations using a `test/` directory convention this repo abandoned in favor of `tests/unit/`/`tests/integration/`, two citations wrong on filename casing as well as directory, one citation naming a function (`recordOrFailClosed`) that doesn't exist under that name anywhere in the code, one broken internal cross-reference (§3.11 → "2.15's sibling checks," which is about something unrelated), and a handful of stale test counts (§3.3, §3.10, §3.11) that drifted as the cited files grew after the citation was written.

**The audit brief itself also contained factual errors about the document's own structure** — worth flagging explicitly since this pattern (a prompt asserting specifics about this repo that turn out not to match reality) has recurred before in this session. The brief's Dimension 6 checklist claims RFC-0022/Signal Verification is documented at "§3.17" (actually GitHub connector; no standalone RFC-0022 section exists — it's covered inside §3.10's HubSpot slice and, historically, inside the now-removed Razorpay material), that hybrid cryptography is at "§2.13" (actually Key/Algorithm Binding Guard; hybrid signing is §2.14 and §3.13), and that the HubSpot connector is at "§3.17-3.18" (actually §3.10; §3.17 is GitHub, §3.18 is deployment infrastructure). None of these wrong assumptions changed this audit's findings — every section was independently verified against its actual content, not the brief's labels — but a reader relying on the brief's own checklist to navigate the document would end up in the wrong place three times out of five checklist items.

---

## Dimension 1: Scope Accuracy (Present-Tense Claims)

### Issues Found

- **§2.21** (Distinguishable HTTP Status for Policy Denial and Replay): present-tense claim describes "a Razorpay-refund-specific policy denial through the real production bootstrap chain" as current evidence; the connector no longer exists. **Overstated.**
- **§2.22** (Canonical Capability-to-Policy Binding): core mechanism claim is accurate and current (`CANONICAL_CAPABILITY_POLICY_BINDINGS` correctly contains only `{hubspot:deal-fetch, hubspot:deal-update}`), but the motivating prose still uses `razorpay:refund-create` as a live example ("e.g. `razorpay:refund-create`") and one evidence bullet fabricates a test scenario that doesn't exist. **Partially overstated** (mechanism itself is fine; supporting narrative is stale).
- **§2.23** (Independently Certified Authorization): headline sentence — "for both capabilities actually reachable in production (`razorpay:refund-create`, `hubspot:deal-update`)" — is false as written; only one capability is reachable. **Overstated, needs \[FUTURE\]-style historical marker or correction**, matching the treatment §3.8/§3.9/§3.16 already got.
- **§2.24** (Authorization Is Caller-Type-Agnostic): repeats §2.23's false framing by direct cross-reference ("per 2.23"). **Overstated by propagation.**
- **§2.25** (Strategic Positioning): claims `createConnectorRegistry.ts` "now registers exactly three connectors in production wiring — `test-fixture` ... `razorpay`, `hubspot`." The file registers exactly two. **Overstated, directly falsifiable.**
- **§3.3** (Connector SDK Foundation): evidence cites `HttpConnector`, `SdkConnectorExecutor`, `CapabilityConnectorPolicy` as living in `packages/connector-sdk/src` — all three moved to `packages/execution-gateway` during the Phase 1C refactor. The prose itself isn't false (it doesn't claim a specific location outside its evidence bullets), but the citation is. **Evidence overstated**, not the claim's substance.
- **§2.1–§2.7**: present-tense claims themselves check out (implementations exist and were confirmed), but each cites a `G-0N` gap-tracking reference that resolves to nothing (see Dimension 3/8). Not an overstatement of the claim's substance, but a verifiability gap.

### Sections confirmed accurate, no scope issue
§1 (preamble), §2.2 core claim, §2.3, §2.4, §2.5, §2.6 (claim substance, wording flagged separately), §2.7 (model scope-caveat writing), §2.8, §2.9 (claim substance), §2.10, §2.11, §2.12, §2.13 (core `assertKeyType` claim, exact match), §2.14, §2.15, §2.16, §2.17, §2.18, §2.19, §2.20 (now correctly cross-referenced to resolved G-29), §2.26, §3.1, §3.2, §3.8/§3.9 (tense discipline correctly maintained throughout — the *evidence citations* are what's stale, not the prose), §3.10, §3.11, §3.13, §3.14, §3.15, §3.16, §3.17, §3.18 (claim substance; one stale evidence citation), §3.19, §3.20.

### Summary
- Sections audited: 41 (§1 preamble + §2.1–§2.26 + §3.1–§3.3, §3.8–§3.20)
- Scope-accurate, no issues: 29
- Overstated present-tense (Razorpay-reachability cluster): 5 (§2.21, §2.22, §2.23, §2.24, §2.25)
- Evidence overstated but claim substance correct: 2 (§3.3, §3.12)
- Needs verifiability fix only (broken G-number labels, no claim-accuracy issue): 7 (§2.1–§2.7, counted once as a cluster of citation defects, not per-section overstatement)

---

## Dimension 2: Contradiction Detection

```
§2.16 vs §3.16: No contradiction. §2.16 (identity/authentication — "does this credential prove a valid caller") and
§3.16 (authorization/scoping — "which capabilities may this proven caller invoke") are different, complementary
layers. Confirmed consistent.

§2.19 vs §3.19: No contradiction. §3.19 explicitly states "In production, this audit write inherits 2.19's
existing fail-closed guarantee" — a correct, stated extension, not an overlap or restatement.

§2.20 vs docs/VERIFICATION-GAPS.md G-29: No contradiction, now correctly resolved. §2.20 carries a "Scope note
(docs/VERIFICATION-GAPS.md G-29, RESOLVED)" that accurately states the atomicity claim was never in question and
that the audit-trail gap G-29 found has since been closed (cross-referencing §3.20). Verified consistent with
VERIFICATION-GAPS.md's own G-29 entry, which independently confirms "RESOLVED same-day."

§3.11 vs §3.16 (as posed in the brief, "RefusalRecord vs policy REJECTs"): WRONG PREMISE IN THE BRIEF — §3.16 is
"Caller-to-Capability Scoping," not "policy REJECTs." There is no dedicated "policy REJECTs" claim section under
that description; REJECT-outcome content is split across §2.3 (Deterministic Policy Evaluation), §2.4 (Authorized
Execution), and §3.11 (Refusal Records) itself. Correcting the premise: §3.11 and §3.16 don't overlap in subject
matter at all (refusal evidence vs. caller-capability authorization), so there is nothing to contradict. No issue,
but the brief's own framing needed correction before this check meant anything.

Any section referencing another — general check: found two broken internal cross-references, both inside §3.11:
"(2.15's sibling checks)" — §2.15 is "Authorization-Binding Verification" (APPROVED-execution authorizationId
presence), unrelated to PolicyEngine/SignalIntentBinder rejections. WRONG REFERENCE.
"(2.16, 2.19, 3.5)" — 2.16 and 2.19 are correct (both are genuinely about caller-authentication audit trails);
"3.5" does not exist as a section anywhere in the document (numbering jumps 3.3 → 3.8). WRONG REFERENCE.
```

No other cross-section contradictions were found across the full document. The Razorpay-removal handling is internally consistent within §3.8/§3.9/§3.16 (which agree with each other and with the removal date) and internally consistent within §2.21–§2.25 (which agree with each other, wrongly, in the opposite direction) — the contradiction is between these two clusters, covered under Dimension 1 above rather than restated here.

---

## Dimension 3: Evidence Verification

This is where the bulk of concrete findings live. Reported by severity.

### CRITICAL — evidence points at content that does not exist, or a claim is directly falsified by its own cited source

```
§2.21: Distinguishable HTTP Status for Policy Denial and Replay
Evidence claims (verbatim from CLAIMS.md):
  • packages/api/tests/integration/razorpay-refund.integration.test.ts
    → Exists? No — deleted with the Razorpay connector, 2026-08-12.
  • packages/api/tests/integration/razorpay-live.integration.test.ts
    → Exists? No — same.
  Both cited for: "the same 403/POLICY_DENIED assertion for a Razorpay-refund-specific policy denial through the
  real production bootstrap chain" — this production path no longer exists.

§2.22: Canonical Capability-to-Policy Binding (TD-22)
Evidence claims (verbatim from CLAIMS.md):
  • packages/policy/tests/unit/CapabilityPolicyBinder.test.ts — "proves the exact live-shaped exploit —
    razorpay:refund-create paired with the unrelated, unprotected customer-refund/1.0.0 policy; hubspot:deal-update
    paired with vendor-payment — is rejected."
    → Exists? Yes. Matches claim? Partial. The hubspot:deal-update/vendor-payment half is real (test at line 46).
      The razorpay:refund-create/customer-refund/1.0.0 half does not exist in this file. The actual second test
      (line 73) pairs hubspot:deal-fetch with customer-refund/1.0.0 — a different capability than claimed. The
      test file's own comment (lines 116-127) explicitly documents Razorpay capabilities were removed and asserts
      the current bound-capability set is exactly {hubspot:deal-fetch, hubspot:deal-update} — the test source was
      correctly updated after the removal; the CLAIMS.md description describing it was not.

§2.23: Independently Certified Authorization (Phase 3D)
Evidence claims (verbatim from CLAIMS.md):
  • "Result: CLAIM FULLY CERTIFIED for both capabilities actually reachable in production (razorpay:refund-create,
    hubspot:deal-update)."
    → False as written. razorpay:refund-create has no connector to resolve to in any environment (independently
      confirmed via createConnectorRegistry.ts and its own test — see §2.25 below).
  • packages/connector-sdk/src/connectors/razorpay/RazorpayTypes.ts (redactRazorpayKeyId)
    → Exists? No.
  • packages/storage/tests/integration/supabase-razorpay-daily-refund-ledger.integration.test.ts
    → Exists? No.
  Two of five cited evidence files are gone. This section carries no [FUTURE]/historical marker, unlike §3.8/§3.9.

§2.24: Authorization Is Caller-Type-Agnostic
Evidence claims: the "Scope, precisely" paragraph repeats §2.23's now-false "razorpay:refund-create...
production-reachable" framing by direct cross-reference. Not a new independent error, but means a reader who
trusts §2.24 without chasing the §2.23 citation is still misled by it directly.

§2.25: Strategic Positioning — Independently Validated, YES (Pass 4)
Evidence claims (verbatim from CLAIMS.md):
  • "createConnectorRegistry.ts now registers exactly three connectors in production wiring — test-fixture ...
    razorpay, hubspot"
    → Directly falsified by reading the cited file itself: it registers exactly TWO connectors (test-fixture,
      hubspot), zero references to razorpay anywhere in the file.
  • packages/api/tests/unit/bootstrap/create-connector-registry.test.ts
    → Exists? Yes. Matches claim? No — independently confirms the two-connector reality: its own ENV_KEYS constant
      lists only NODE_ENV/HUBSPOT_PRIVATE_APP_TOKEN, every it() block is HubSpot-scoped, zero mentions of razorpay
      anywhere in the file. This is the single most directly, mechanically falsifiable finding in this audit —
      checkable with one grep against the exact file the claim itself cites.

§3.3: Connector SDK Foundation (Scoped)
Evidence claims (verbatim from CLAIMS.md):
  • packages/connector-sdk/src (Connector, ConnectorRegistry, CredentialProvider, SdkConnectorExecutor,
    HttpConnector, MockConnector, CapabilityConnectorPolicy)
    → HttpConnector: does NOT exist at this path (moved to packages/execution-gateway/src/HttpConnector.ts;
      git log confirms it existed at the old path historically, then moved).
    → SdkConnectorExecutor: does NOT exist at this path (actual: packages/execution-gateway/src/connector-
      execution/SdkConnectorExecutor.ts).
    → CapabilityConnectorPolicy: does NOT exist at this path (actual: packages/execution-gateway/src/connector-
      runtime/CapabilityConnectorPolicy.ts).
    → MockConnector.ts: exists at the cited path, correct.
  • "packages/connector-sdk/tests/unit (45 tests: ...)"
    → Test count wrong. Only 4 test files currently exist there (credential-provider.test.ts, enterprise-mock-
      connectors.test.ts, mock-connector.test.ts, reference-policy.test.ts). Ran the suite: 32 tests pass, not 45.
      No HttpConnector-timeout test, no "end-to-end Gateway integration" test, no "Trust Record hash-boundary
      regression" test found in this directory — moved to packages/execution-gateway/tests along with the classes.
  Unlike the sibling §3.10 (HubSpot), which explicitly documents the same Phase 1C relocation with an "Update"
  paragraph and corrected paths, §3.3 was never updated after the refactor that moved its own cited classes.

§3.12: `@parmana/sign`: Open-Core Extraction of the Signing Primitives (Scoped)
Evidence claims (verbatim from CLAIMS.md):
  • "packages/crypto/src/providers/signature/Dilithium3SignatureProvider.ts, SignatureVerifier.ts,
    ArtifactHasher/CanonicalSerializer.ts (this repository's own, internal versions of the same primitives)"
    → Dilithium3SignatureProvider.ts: exists at exactly this path.
    → SignatureVerifier.ts: does NOT exist at this path — actual location is packages/crypto/src/
      SignatureVerifier.ts (one directory up).
    → ArtifactHasher: does NOT exist ANYWHERE in this codebase, under any path. No class or file of this name
      found by repo-wide grep. The closest internal equivalents are TrustRecordHasher.ts, ReceiptHasher.ts,
      ExecutableContentHasher.ts — none named ArtifactHasher. This is cited as an existing internal class; it is
      not.
    → CanonicalSerializer.ts: exists, but at packages/crypto/src/CanonicalSerializer.ts, not under
      providers/signature/ as the citation's grouping implies.

§2.19 (cross-cutting into Dimension 3): Fail-Closed Caller-Authentication Audit Writes
Evidence claims (verbatim from CLAIMS.md):
  • "packages/api/src/middleware/caller-auth.ts (recordOrFailClosed)"
    → No function named recordOrFailClosed exists anywhere in this codebase (confirmed by repo-wide grep, zero
      hits). The actual implementing function is recordCallerAuditEvent, defined in a separate file
      (packages/api/src/auth/recordCallerAuditEvent.ts) and imported into caller-auth.ts — that file is not cited
      in §2.19's evidence at all. The claim's substance is correct (this is genuinely how the fail-closed
      mechanism works, directly confirmed by reading both files); only the named symbol and its file are wrong.
```

### IMPORTANT — stale test counts, wrong paths, uncaveated deleted-file citations

```
§3.10: HubSpot Deal Stage/Amount Update Connector
  • "packages/api/tests/integration/hubspot-deal-update.integration.test.ts (3 tests)"
    → Actual: 6 tests (grep-confirmed test names: an approved dealstage update; a policy-denied stage transition;
      a policy-denied over-threshold amount change; a signal/state mismatch rejection; a TD-22 capability/policy-
      binding rejection; a TD-23 unbacked pre-authorization rejection). The file grew via later TD-22/TD-23 work
      without this citation being updated. All other evidence in this large, otherwise carefully-maintained
      section (45 unit tests across 5 files, exact per-file counts of 12/2/9/12/10) checked out exactly.

§3.11: Durable, Third-Party-Verifiable Refusal and Audit Records (RFC-0021, Scoped)
  • "packages/api/tests/integration/audit-verify.integration.test.ts (5 tests)"
    → Actual: 4 tests (verified by reading every it() block directly). All three other test-file citations in
      this section (refusal-record.integration.test.ts: 6, refusal-record-fail-open.test.ts: 2, supabase-refusal-
      record-repository.test.ts: 4) matched exactly.

§2.6, §2.8 (both citations), §2.11, §2.12: wrong test-file directory convention.
  All four cite packages/<pkg>/test/<file>.test.ts (singular "test", no subdirectory). The actual, consistent
  convention across this entire repository is packages/<pkg>/tests/unit/<file>.test.ts or tests/integration/...
  (plural "tests", with a unit/integration subdirectory). None of these citations resolve as literally written.
  The underlying test-name text quoted in §2.10, §2.11, §2.12 was independently confirmed to exist verbatim at
  the correct (differently-pathed) location, so the claims themselves are not false — only the paths are broken.

§2.13, §2.14: same directory issue, PLUS wrong filename casing on two citations.
  §2.13's "packages/crypto/test/SignatureProvider.test.ts" — actual: packages/crypto/tests/unit/
  signature-provider.test.ts (PascalCase cited, kebab-case actual — will not resolve on a case-sensitive
  filesystem even after fixing the directory).
  §2.14's "packages/crypto/test/Dilithium3SignatureProvider.test.ts" — actual: packages/crypto/tests/unit/
  dilithium3-signature-provider.test.ts (same double error). §2.14's second citation,
  dilithium3-cross-instance.test.ts, has only the directory wrong, casing is already correct.

§2.1–§2.7: eight broken "G-0N" gap-tracking labels (G-01 through G-08, one doubled in §2.5, i.e. 8 total
  instances across 7 sections). docs/VERIFICATION-GAPS.md numbers entries G-1 through G-29, no leading zero, and
  none of the real G-1 through G-8 describe the topics these citations imply (G-1 is a duplicate-transaction-ID
  race; the §2.1 citation is attached to "Trusted Business Transaction," an unrelated subject). Worse: unlike
  every later gap-reference in the document (e.g. §2.16's "docs/VERIFICATION-GAPS.md G-28", §3.20's "G-29,
  docs/VERIFICATION-GAPS.md"), these eight carry no qualifying document name at all, so a reader has no signal
  that this is a separate, seemingly-abandoned internal ID scheme rather than a pointer into the real gap
  document.

§3.8, §3.9: Deployed Environment (both marked Historical, tense discipline in the prose is correctly maintained
  throughout — no present-tense slips found in either section's body text):
  • §3.8 cites scripts/process-razorpay-settlements.ts — does not exist (removed 2026-08-12), cited with no note.
  • §3.9 cites fly.live.toml — does not exist (removed 2026-08-12), cited with no note.
  • Both sections' Evidence lists say a live smoke test was "performed... this session" — accurate when written
    (2026-07-19-era), now several sessions stale; a reader who reaches the Evidence bullets without first reading
    the section-opening historical disclaimer several paragraphs above could misread "this session" as current.

§3.18: Deployment Infrastructure Requirements (Scoped) — NOT marked historical, present-tense throughout:
  • Cites fly.toml/fly.live.toml as "3.8/3.9's own deployed instances." fly.toml exists; fly.live.toml does not
    (same 2026-08-12 removal). Arguably worse than the §3.8/§3.9 instances of this same pattern, since here there
    is no adjacent historical disclaimer establishing context at all — this section describes itself as current.

§3.17: GitHub Pull Request Merge Connector — one low-confidence discrepancy. github-pr-merge-live.integration.
  test.ts is cited as having "2 tests," both gated to skip; the suite as actually run showed only 1 test skipped.
  Likely a Vitest reporting artifact of a nested describe.skipIf wrapping only one of two it() blocks, not
  necessarily a real documentation error — flagged for awareness, not asserted as a confirmed defect.
```

### CLEAN — evidence verified exact, no issues found

```
§2.10 (Rejection of Forged/Tampered/Expired/Replayed): all 5 cited test names verified verbatim with exact line
  numbers. Best-evidenced section in §2.1-§2.15.

§2.13 (core claim): assertKeyType's actual behavior — throws naming both expected and actual key type — was read
  directly and matches the claim exactly, word for word in spirit.

§2.15 (Authorization-Binding Verification): VerificationService's actual source comment matches the claim's
  language almost verbatim ("must carry a non-empty authorizationId... REJECTED executions are not required to").

§2.17, §2.18: all citations resolve, no issues found.

§2.22 (core mechanism, as opposed to its stale prose noted above): CANONICAL_CAPABILITY_POLICY_BINDINGS itself is
  clean and current — exactly {hubspot:deal-fetch, hubspot:deal-update}, no stale entries.

§2.26 (Policy Governance, Maker-Checker): all 30 cited files/tests confirmed to exist (line-by-line content not
  re-verified for every one, given scope, but zero missing files found — a notably larger, cleaner citation set
  than any other section in the document). No Razorpay dependency.

§3.2 (Fleet-Wide NonceStore): every citation resolves and matches.

§3.10 (HubSpot connector, aside from the one test-count noted above): exceptionally well-maintained — 45 unit
  tests across 5 files matched to the exact number, deletion of HubSpotDealUpdateService/Harness independently
  confirmed, Phase 1C relocation explicitly and correctly documented in-section (the positive counter-example to
  §3.3's failure to do the same).

§3.13 (Hybrid ML-DSA-65 Signing): every citation resolves; test counts re-run and confirmed exact (7 tests in
  hybrid-signature-provider.test.ts; 4+2=6 across the two cited hybrid-verification test files).

§3.14 (Per-Caller Rate Limiting): every citation resolves; all 6 claimed test scenarios found with near-verbatim
  describe/it name matches; documented defaults (30/300) match Config.ts exactly.

§3.15 (SDK Dogfooding): every citation resolves; runExecuteExample/run_quickstart functions confirmed to exist at
  the cited lines; the TypeScript integration test re-run and confirmed passing (1/1).

§3.16, §3.19, §3.20: verified directly this session at time of writing — clean (§3.19/§3.20 in particular, since
  both were authored in the immediately preceding turn of this same session and independently re-checked here).
```

---

## Dimension 4: [FUTURE] Markers Audit

No incorrect `[FUTURE]` markers were found. Every `[FUTURE]`-tagged item in §4 was spot-checked and genuinely describes something not implemented (HubSpot Contacts/Companies objects, HubSpot delete/archive, webhook triggers, Stripe/Salesforce/SAP/ServiceNow/Workday/Slack/Jira/database connectors, cloud KMS providers, `CRYPTO_MODE=hybrid` in any live deployment, `@parmana/sign` hybrid-envelope recognition). No implemented feature was found lacking a `[FUTURE]` marker it should have — the actual defect in this document is the opposite shape of problem: implemented-then-*removed* Razorpay functionality that should have been converted to historical/removed framing (as §3.8/§3.9/§3.16 correctly did) but wasn't (§2.21–§2.25, and by omission §3.3/§3.12's stale-refactor citations), not a missing forward-looking marker.

One related, narrower observation: §3.8's own body mentions a superseded `[FUTURE]` note about "live-mode operation" that was later fulfilled by §3.9 and then rendered moot entirely by the Razorpay removal — this is already implicitly handled by both sections' historical markings and isn't a fresh defect worth a separate correction.

---

## Dimension 5: Scope Caveats Audit

```
§2.20 (duplicate-ID atomicity): needs caveat for G-29? Yes, has it, and it's current — "Scope note
  (docs/VERIFICATION-GAPS.md G-29, RESOLVED): ... A duplicate-ID submission's rejection attempt is now also
  durably audited (§3.20, caller.structural_rejected)." Clear, accurate, cross-linked correctly.

§3.8/§3.9 (deployed environment): scope caveat for historical-only status? Yes, has it, prominently — both
  section titles carry "Historical: Razorpay connector removed 2026-08-12" and the body text opens with an
  explicit "nothing below should be read as describing present-tense behavior" disclaimer. This is the strongest,
  clearest caveat pattern in the document. The residual issue (uncaveated deleted-file citations within the
  Evidence list) is a Dimension-3 citation defect, not a missing scope caveat — the caveat itself is exemplary.

§2.21–§2.25: needs a caveat/historical marker for the same reason? Yes — currently missing entirely. This is the
  central finding of this audit: these five sections should carry the same "Historical: Razorpay connector
  removed 2026-08-12" treatment §3.8/§3.9/§3.16 already have, or be rewritten to drop Razorpay from their
  present-tense claims and evidence, and currently do neither.

§3.11 (RefusalRecord): does it caveat that pre-RuntimeEngine rejections aren't covered? Yes, precisely — "Every
  policy REJECT decision reachable through RuntimeEngine.execute" is explicitly scoped language, not a universal
  "every refusal" claim, and the underlying refusal-record.ts domain type's own doc comment independently states
  the same scope limit ("this covers PolicyEngine.evaluate REJECTs and SignalIntentBinder binding-violation
  REJECTs only, not every kind of rejection"). This directly refutes the audit brief's own speculative example
  under Dimension 7 ("§3.11 says 'every refusal is durable' — but what about pre-RuntimeEngine?") — §3.11 never
  makes that unscoped claim in the first place, and the adjacent gap it correctly does NOT cover is now closed by
  §3.20/G-29 anyway.

§3.16 (caller-to-capability scoping): caveat clarity — exceptionally clear, arguably the best-caveated section in
  the document: "do not read this claim as 'Parmana's live CRM-moving (HubSpot) capabilities are now scope-
  restricted' — they are not, yet" is about as unambiguous as a limitation statement can be written.

§2.23/§2.24/§2.25: implicit assumption (Razorpay still reachable) is NOT made explicit anywhere — this is the
  same finding as above, restated for this dimension's framing: the assumption needed a caveat and doesn't have
  one.

§2.9 ("A receiving system can independently verify..."): no caveat present or obviously needed beyond the hedge-
  word flag under Dimension 7 — the claim's substance (only Parmana's public key and the envelope are required)
  is accurate and doesn't depend on an unstated assumption.
```

---

## Dimension 6: Completeness Check

```
Feature checklist:
- RefusalRecord (RFC-0021): §3.11 — complete, accurate, one stale test count (5 vs actual 4).
- Signal Verification (RFC-0022): documented within §3.10 (HubSpot slice, current) and, historically, within
  the now-superseded §3.8/§3.9 material (Razorpay slice). NOT at "§3.17" as the audit brief's own checklist
  assumed — §3.17 is the GitHub PR-merge connector, unrelated. There is no single dedicated "RFC-0022" section;
  this is a real documentation-structure fact, not a gap, but worth noting since the brief got it wrong.
- Scoped Identity (allowedCapabilities): §3.16 — complete, exceptionally well-caveated.
- Principal Override Audit: §3.19 — complete, added this session, verified clean.
- Structural Validation Audit (G-29): §3.20 — complete, added this session, verified clean.
- Hybrid cryptography (ML-DSA-65): §2.14 (base PQ signing capability) and §3.13 (dual Ed25519+ML-DSA-65 signing).
  NOT at "§2.13" as the brief assumed — §2.13 is the Key/Algorithm Binding Guard, a related but distinct claim
  about rejecting mismatched key types.
- HubSpot connector: §3.10 — complete, best-evidenced connector section in the document. NOT at "§3.17-3.18" as
  the brief assumed — those are GitHub and Deployment Infrastructure respectively.
- Razorpay connector removal: acknowledged correctly in §3.8, §3.9, §3.16 (all three explicitly, prominently,
  consistently dated 2026-08-12) and in §2.22's Evidence (the CapabilityPolicyBinder map itself is current).
  NOT acknowledged in §2.21, §2.22 (prose only, not the mechanism), §2.23, §2.24, §2.25, §3.3 (different, non-
  Razorpay stale-refactor issue), or §3.18 — this is the audit's central finding, restated once more here because
  this dimension asks for it directly.
- GitHub connector: §3.17 — complete, well-evidenced, one low-confidence minor test-count note.
- Caller authentication at the API boundary: §2.16 — complete, accurate.
- Policy Governance (maker-checker): §2.26 — complete, unusually self-critical (documents its own two found-and-
  fixed defects rather than presenting as flawless), all 30 citations resolve.
- Deployment infrastructure requirements: §3.18 — complete in substance, one stale (uncaveated) file citation.
```

---

## Dimension 7: Clarity and Ambiguity Audit

```
§2.6: "Verification can confirm execution integrity using the generated execution artifacts."
Issue: hedge word "can" rather than direct present tense ("confirms").
Clarity: could be read as "is capable of, when invoked" (accurate) or as expressing uncertainty about whether it
  actually does (not the intent). In context, the surrounding evidence makes the intended reading clear, but the
  sentence alone is the kind of phrasing the audit brief's own watch-word list flags.
Suggestion: not proposing a specific reword per this audit's own "don't fix, report" instruction — flagging the
  exact word and location only.

§2.9: "A receiving system can independently verify that Parmana authorized an execution request..."
Issue: same "can" pattern as §2.6.

§2.23: "no repository evidence was found that materially contradicts the claim"
Issue: "materially" is undefined. Could mean "no contradicting evidence exists at all" or "some minor
  contradicting evidence exists but was judged immaterial" — a reader cannot tell which without reading the full
  cited certification document.

§2.25: "independently, repeatedly source-code-validated across four passes"
Issue: "independently" is doing significant work in this sentence, but the same paragraph's own "Honesty
  constraint" two sentences later admits 8 of 10 negative tests were NOT independently re-run in pass 4, only
  "cited from code paths confirmed structurally unchanged." The headline claim and its own immediately-following
  caveat are in tension for a reader who stops at the first sentence.

§2.26: "a live check against a real running API confirmed the raw key string is absent from every page this
session produced"
Issue: "this session" is a dangling reference — no session is dated or otherwise identified anywhere in the
  surrounding paragraph, and this document has accumulated many sessions' worth of edits. Unclear which session,
  or how a future reader would confirm the claim still holds for their own session.

§3.1: no ambiguous wording found, but flagged separately under Dimension 3 for having no test-file evidence at
  all for a claim this load-bearing ("cryptographically impossible to accept") — a completeness/evidentiary gap
  more than a wording ambiguity.

Positive note, not an issue: §2.7's "Scope note" (disambiguating package-level ReplayEngine from the unrelated
  HTTP-level POST /replay behavior) and §3.16's "do not read this claim as..." caveat are both cited by the
  sub-audits as model examples of precise, unambiguous scope-caveat writing — worth preserving as the house style
  when the Razorpay-cluster sections above are eventually corrected.
```

---

## Dimension 8: Coreference and Cross-References

```
§3.11 → "(2.16, 2.19, 3.5)" for caller-authentication/webhook audit trails:
  2.16: correct — §2.16 is genuinely "Caller Authentication at the API Boundary."
  2.19: correct — §2.19 is genuinely "Fail-Closed Caller-Authentication Audit Writes."
  3.5: INCORRECT — no section numbered 3.5 exists anywhere in this document (numbering jumps 3.3 → 3.8, confirmed
    by grep across the full file). Broken reference.

§3.11 → "(2.15's sibling checks)" for PolicyEngine.evaluate/SignalIntentBinder rejections:
  INCORRECT — §2.15 is "Authorization-Binding Verification" (APPROVED-execution authorizationId presence,
  checked by VerificationService), an unrelated topic to policy/signal-binding rejections. Broken reference.

§3.16 → does it reference §3.11 (RefusalRecord)?
  It does not — zero mentions of "3.11" or "RefusalRecord" anywhere in §3.16's body, confirmed by direct search.
  Not a "broken" reference since none is claimed; simply absent. Arguably a missed opportunity for a cross-link,
  since both sections are part of the same overall "is a rejection/denial durably evidenced" story — noted as a
  nice-to-have, not a defect.

§2.22 → "(2.24, 2.16's own G-28 note)":
  Correct. §2.24 does discuss caller-type-agnostic authorization in a way consistent with this citation's
  context, and §2.16 does contain a "docs/VERIFICATION-GAPS.md G-28" reference for PARMANA_AUTH_DISABLED scope,
  independently confirmed present in §2.16's own text.

§2.20 → "docs/VERIFICATION-GAPS.md G-29":
  Correct and current, confirmed against VERIFICATION-GAPS.md's own G-29 entry (RESOLVED, cross-references back
  to CLAIMS.md §3.20 — a fully consistent round-trip).

§3.18 → "3.8/3.9's own deployed instances":
  Correct in the sense that §3.8/§3.9 are genuinely about deployed instances; the citation itself (fly.live.toml)
  is stale, already covered under Dimension 3.

The "G-0N" family in §2.1-§2.7 (G-01 through G-08): not cross-references to other CLAIMS.md sections, but
  pseudo-references to docs/VERIFICATION-GAPS.md that don't resolve to anything real there — covered fully under
  Dimension 3/5 above, restated here since Dimension 8 is the more natural home for a "reference resolves
  incorrectly" finding.
```

---

## Recommendations

### Critical Fixes (blocking — these make specific, checkable claims that are false)

1. **§2.21, §2.23, §2.24, §2.25**: add the same "Historical: Razorpay connector removed 2026-08-12" treatment §3.8/§3.9/§3.16 already carry, or rewrite each to drop `razorpay:refund-create` from present-tense "production-reachable" framing. §2.25 in particular needs its connector-registry description corrected from "three connectors ... razorpay" to the actual two.
2. **§2.22**: correct or remove the fabricated `razorpay:refund-create`/`customer-refund/1.0.0` test-scenario description in the evidence bullet; it should describe the actual second test (`hubspot:deal-fetch`/`customer-refund/1.0.0`).
3. **§3.3**: update the evidence citation to reflect the Phase 1C relocation of `HttpConnector`, `SdkConnectorExecutor`, and `CapabilityConnectorPolicy` into `packages/execution-gateway`, following §3.10's own precedent for documenting the identical refactor. Correct the test count from 45 to the actual 32 (or re-derive the real current total across both packages' test suites).
4. **§3.12**: remove or correct the `ArtifactHasher` citation — no such class exists anywhere in this codebase. Fix `SignatureVerifier.ts`'s path (one directory up from where the citation implies).
5. **§2.19**: correct the `recordOrFailClosed` citation to name the actual function (`recordCallerAuditEvent`) and its actual file (`packages/api/src/auth/recordCallerAuditEvent.ts`).

### Important Fixes (clarity, verifiability — not false, but broken or misleading as written)

6. Fix the eight broken `G-0N` labels in §2.1–§2.7 — either point them at real, topically-matching `docs/VERIFICATION-GAPS.md` entries, or remove them; as written they resolve to nothing and (unlike every other gap-reference in the document) carry no qualifying document name to signal that to a reader.
7. Fix the six wrong test-directory-path citations (§2.6, §2.8 ×2, §2.11, §2.12: `test/` → `tests/unit/`) and the two additional wrong-casing citations riding along with them (§2.13, §2.14).
8. Fix §3.11's two broken cross-references: "(2.15's sibling checks)" and the "3.5" component of "(2.16, 2.19, 3.5)."
9. Update stale test counts: §3.10 (3 → 6), §3.11 (5 → 4).
10. Add a note or correction to §3.8's `scripts/process-razorpay-settlements.ts` and §3.9's `fly.live.toml` citations (both deleted) and to §3.18's `fly.live.toml` citation (same file, but in a section with no historical framing at all — the more pressing of the two instances).
11. Reword or caveat the hedge-word/ambiguous-term instances flagged under Dimension 7 (§2.6/§2.9's "can," §2.23's "materially," §2.25's "independently" vs. its own caveat, §2.26's dangling "this session").

### Nice-to-Have Improvements

12. Consider a cross-link from §3.16 to §3.11 (or vice versa), since both are part of the same "is a rejection/denial durably evidenced" narrative arc and currently don't reference each other.
13. §3.1 would benefit from at least one test-file citation given how load-bearing its claim is ("cryptographically impossible to accept").
14. §3.17's live-suite skip-count note (1 vs. 2) is worth a quick confirmation, though it may just be a Vitest reporting artifact of a nested `describe.skipIf`.

---

## Conclusion

CLAIMS.md **needs targeted revision before it should be relied on as a complete, current trust document**, specifically the five-section Razorpay-reachability cluster (§2.21–§2.25) plus the two unrelated stale-refactor citations (§3.3, §3.12) — all seven are CRITICAL-tier findings where a cited file, test, or fact does not match current reality, one of them (§2.25) directly and mechanically falsifiable from the exact file it cites. Everything else found in this audit is IMPORTANT-tier at most: broken cross-references, stale test counts, wrong file paths, and a handful of ambiguous phrases — none of which misrepresent what the system actually does, only where to go verify it.

It's worth being precise about what this audit does **not** find: no evidence that any *security* or *authorization* property this document claims is actually false. Every CRITICAL finding is about **documentation currency** (citing something that used to be true, or that moved), not about a gap in what the system enforces. The five-fold Razorpay overstatement is the most serious issue by far — a security reviewer who reads §2.23 or §2.25 without cross-checking against §3.16 would walk away with a materially wrong picture of what's currently reachable in production — but fixing it is a documentation correction, not a code or architecture fix.

**Recommended next step:** request changes to the seven CRITICAL-tier sections listed above (items 1–5 in Recommendations) before treating CLAIMS.md as an accurate, current representation of the system; the IMPORTANT-tier items (6–11) should be batched into the same pass since most are mechanical path/count corrections rather than new investigation. Re-audit is not needed after that pass — the underlying claims, once the Razorpay and refactor staleness is corrected, are well-supported by the evidence this audit independently verified.
