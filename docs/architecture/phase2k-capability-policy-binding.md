# Phase 2K — Establish Canonical Capability-to-Policy Binding (TD-22)

Closes TD-22, raised by an independent repository verification of the public claim _"Even if AI has valid credentials, it still cannot execute anything your business hasn't authorized. No exceptions."_ That verification confirmed Property A (credential isolation) held, but found — and this phase independently re-confirms from scratch — that no mechanism bound a production capability to the one policy that authorizes it, letting a caller pair a real, fund-moving or record-mutating capability with an unrelated, unprotected policy and bypass that capability's own protections entirely.

This is an implementation phase: the gap was independently reconfirmed, so per this phase's own charter, establishing the canonical mapping is required. It is not an authorization, policy, or runtime redesign — one new, small, additive module and a minimal, backward-compatible wiring change.

**Fixed against:** commit `cb3c3fc` (`docs(claims): correct stale vendor-payment/caller-auth wording and close TD-21`), the tip of `main`. Working tree was not clean at the start — Phase 2J's changes were still uncommitted; per user confirmation, committed first (`cb3c3fc`) before this phase's gate check was re-run and passed.

---

## 1. Original Verification Finding

From the prior verification task's report (not itself a numbered phase document, but the direct predecessor to this one):

> **Property B (Independent Authorization): DOES NOT HOLD**, for a structural, undisclosed reason: no mechanism in this codebase binds a Business Transaction's declared `policy.name`/`policy.version` to the `intent.action`/capability actually being executed. [...] This is independently, concretely reproducible from source alone for both fund-moving (`razorpay:refund-create`) and business-record-mutating (`hubspot:deal-update`) capabilities.

## 2. Independent Verification Methodology

Every prior finding was treated as a hypothesis and re-derived from current source, not copied:

- Traced the complete lifecycle fresh: `BusinessTransactionMapper.fromRequest()` → `RuntimeEngine.execute()` → `PolicyRouter.load()` → `FilePolicyRepository.load()` → `PolicyValidator.validate()` → `SignalIntentBinder.findViolations()` → `PolicyEngine.evaluate()` → `SignalStateVerifier.findViolations()` → `ExecutionGate.enforce()` → `RuntimeAuthorizationSigner.sign()`.
- Read `packages/policy/src/PolicyRouter.ts`, `PolicyValidator.ts`, `PolicyRegistry.ts`, `PolicyEngine.ts`, `SignalIntentBinder.ts`, `FilePolicyRepository.ts` in full.
- **New finding this phase, not in the prior report:** discovered that `packages/runtime/src/policy/PolicyRouter.ts` and `packages/runtime/src/policy/PolicyValidator.ts` are same-named but entirely different, **unused** classes — a naming collision with the real `@parmana/policy` classes `RuntimeEngine` actually imports (confirmed: `RuntimeEngine.ts:22` imports `PolicyRouter` from `@parmana/policy`; `RuntimeBuilder.ts:8` constructs it from the same import; grep confirms zero importers of the `packages/runtime/src/policy/` versions anywhere in the repo). `@parmana/policy`'s own `PolicyRegistry` class is similarly unused in production (confirmed by grep across `packages/api/src`, `packages/runtime/src/RuntimeBuilder.ts`, `RuntimeFactory.ts`) and, by its own doc comment, explicitly "does NOT choose policies" — it was never a candidate binding mechanism. These are pre-existing dead-code artifacts, not fixed in this phase (out of TD-22's scope; noted for a future cleanup, matching this project's established pattern of flagging adjacent-but-out-of-scope findings rather than folding them in).
- Re-ran `git log -S`-style searches were not needed here (no historical-provenance question this time); instead, exhaustively re-verified **every currently-loadable policy file** (`policies/*/*/policy.json`, 11 files) for `boundSignals` presence, and re-read `Dockerfile:104` to reconfirm `PARMANA_POLICY_DIR=./policies` — the full directory, not a curated subset — is what production actually loads from.
- Manually re-traced the exact "wrong policy" exploit end to end against current source (not assumed from the prior report): `razorpay:refund-create` paired with `customer-refund/1.0.0` (a real, loadable policy with no `boundSignals`), confirmed the request would reach `PolicyEngine.evaluate()` fully approved on caller-declared signals alone, with `intent.parameters.amountPaise` (the real, unrelated amount that executes) never checked against anything.

## 3. Policy Selection Inventory

| Component                                                                                                                | Responsibility                                                                                                | Influences policy selection?                                                                           | Classification                                             |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `BusinessTransactionMapper.fromRequest()` (`packages/api/src/mappers/`)                                                  | Structural mapping of the HTTP request body into a `BusinessTransaction`                                      | Passes `request.policy` through verbatim — **yes, this is where caller control originates**            | Canonical (production entry point)                         |
| `BusinessTransaction.policy` / `PolicyReference` (`packages/shared/src/domain/`)                                         | Type shape: `{name, version, schemaVersion}`                                                                  | Carries the caller-declared value                                                                      | Canonical (data shape, unchanged)                          |
| `Intent.action` (`packages/shared/src/domain/intent.ts`)                                                                 | The capability actually being executed                                                                        | Was previously invisible to policy selection entirely                                                  | Canonical (unchanged)                                      |
| `@parmana/policy`'s `PolicyRouter` (`packages/policy/src/PolicyRouter.ts`)                                               | Loads exactly one policy by `(name, version)`, via an injected `PolicyRepository`                             | Executes the caller's choice, does not validate it                                                     | Canonical (the real, used implementation)                  |
| `packages/runtime/src/policy/PolicyRouter.ts`                                                                            | Same name, file-reading implementation                                                                        | N/A — never imported by anything                                                                       | **Unused/Legacy** (naming collision, not fixed this phase) |
| `@parmana/policy`'s `PolicyValidator` (`packages/policy/src/PolicyValidator.ts`)                                         | Validates a loaded policy's own internal structural integrity (non-empty `policyId`, well-formed rules, etc.) | No — does not compare the loaded policy against the caller's reference or the action at all            | Validation (canonical, used)                               |
| `packages/runtime/src/policy/PolicyValidator.ts`                                                                         | Same name, compares loaded policy to a reference                                                              | N/A — never imported by anything                                                                       | **Unused/Legacy** (naming collision, not fixed this phase) |
| `FilePolicyRepository` (`packages/policy/src/FilePolicyRepository.ts`)                                                   | Reads `<basePath>/<name>/<version>/policy.json`, regex-guards `name`/`version` against path traversal         | Executes the caller's choice of file path segments                                                     | Canonical (used)                                           |
| `@parmana/policy`'s `PolicyRegistry` (and its `packages/runtime/src/policy/` namesake)                                   | In-memory `name:version → metadata` catalog                                                                   | No — by its own doc comment, explicitly does not choose policies                                       | **Unused** in production (both copies)                     |
| `SignalIntentBinder`                                                                                                     | Enforces a policy's own opt-in `boundSignals` map                                                             | No — operates on whatever policy was already selected                                                  | Helper (canonical, used, unchanged)                        |
| `SignalStateVerifier` (Razorpay/HubSpot implementations)                                                                 | Independently re-verifies specific signals via a real vendor fetch, gated on `action`, not policy identity    | No — assumes the correct policy already ran `SignalIntentBinder`                                       | Helper (canonical, used, unchanged)                        |
| `DefaultConnectorPolicy.assertAllowed()`                                                                                 | Checks connector capability inclusion, gateway/connector identity, session validity                           | No — never inspects policy identity                                                                    | Validation (canonical, unchanged)                          |
| **`CapabilityPolicyBinder` / `CANONICAL_CAPABILITY_POLICY_BINDINGS`** (`packages/policy/src/CapabilityPolicyBinding.ts`) | **New this phase.** The single authoritative `action → PolicyReference` mapping                               | **Yes — enforces that the caller's declared policy must equal the canonical one for any bound action** | **Canonical (new)**                                        |

**Conclusion, independently re-confirmed:** before this phase, no component anywhere in the inventory determined policy selection from capability identity. `transaction.policy.name`/`.version` was the sole, unchecked, caller-derived input driving which policy governed every execution.

## 4. Capability-to-Policy Call Graph

**Before this phase** (every production capability, identical shape):

```
POST /execute
  → BusinessTransactionMapper.fromRequest(req.body)
      transaction.policy = req.body.policy         [caller-derived, verbatim]
      transaction.intent.action = req.body.intent.action   [caller-derived, verbatim]
  → RuntimeEngine.execute(transaction)
      → PolicyRouter.load(transaction.policy.name, transaction.policy.version)
          → FilePolicyRepository.load(name, version)   [reads whatever file the caller's name/version selects]
          → PolicyValidator.validate(policy)            [structural only -- no action/capability awareness]
      → SignalIntentBinder.findViolations(policy, signals, intent)   [only as strong as the SELECTED policy's own boundSignals]
      → PolicyEngine.evaluate(policy, signals)           [no action parameter exists in this call at all]
      → SignalStateVerifier.findViolations(...)          [gated on action, assumes SignalIntentBinder already ran correctly for the RIGHT policy]
      → ExecutionGate.enforce(decision)
      → RuntimeAuthorizationSigner.sign({policyName: transaction.policy.name, ...})
      → connector.execute() against intent.parameters    [never cross-checked against signals for an unbound field]
```

Nothing in this graph derives the policy from the capability. Everything derives the capability's protections from _whichever_ policy the caller happened to name.

**After this phase** (for the 6 canonically-bound capabilities; unbound actions are byte-for-byte unchanged):

```
POST /execute
  → BusinessTransactionMapper.fromRequest(req.body)   [unchanged]
  → RuntimeEngine.execute(transaction)
      → PolicyRouter.load(transaction.policy.name, transaction.policy.version)   [unchanged -- still loads whatever the caller named]
      → CapabilityPolicyBinder.findViolation(transaction.intent.action, transaction.policy)   [NEW]
          if transaction.intent.action has a canonical entry AND transaction.policy != canonical:
              → ordinary PolicyDecision REJECT, matchedRuleId "capability-policy-binding-violation",
                no rule ever evaluated, no authorization ever generated
          else: proceed exactly as before (SignalIntentBinder → PolicyEngine.evaluate → SignalStateVerifier → ...)
```

The check runs immediately after policy load (so the rejection decision can still reference `policy.policyId`/`policy.policyVersion`, matching the existing `SignalIntentBinder`-violation shape exactly) and before `SignalIntentBinder`, since checking a narrower guarantee against a policy already confirmed wrong is meaningless.

## 5. Canonical Mapping Design

`packages/policy/src/CapabilityPolicyBinding.ts` (new file, exported from `packages/policy/src/index.ts`):

```ts
export const CANONICAL_CAPABILITY_POLICY_BINDINGS: ReadonlyMap<string, PolicyReference> = new Map([
  ["payments:execute",         { name: "vendor-payment",     version: "2.0.0", schemaVersion: "1.0.0" }],
  ["razorpay:payment-fetch",   { name: "razorpay-refund",    version: "1.0.0", schemaVersion: "1.0.0" }],
  ["razorpay:refund-create",   { name: "razorpay-refund",    version: "1.0.0", schemaVersion: "1.0.0" }],
  ["razorpay:refund-fetch",    { name: "razorpay-refund",    version: "1.0.0", schemaVersion: "1.0.0" }],
  ["hubspot:deal-fetch",       { name: "hubspot-deal-update",version: "1.0.0", schemaVersion: "1.0.0" }],
  ["hubspot:deal-update",      { name: "hubspot-deal-update",version: "1.0.0", schemaVersion: "1.0.0" }],
]);

export class CapabilityPolicyBinder {
  public findViolation(action: string, declared: PolicyReference): CapabilityPolicyBindingViolation | undefined { ... }
}
```

**Design decisions, each independently justified:**

- **Scope: exactly the capabilities registered in production bootstrap** (`createConnectorRegistry.ts`), each bound to the one policy already purpose-built for it (`razorpay-refund/1.0.0` covers all three Razorpay capabilities including the two read-only fetches, since `RazorpaySignalStateVerifier` already internally uses that same policy name/version for its own verification fetches; `hubspot-deal-update/1.0.0` covers both HubSpot capabilities identically; `vendor-payment/2.0.0` is included for `payments:execute` even though that capability is not currently registered in production at all (TD-1), so the binding is ready the moment a real connector replaces the test-only `MockConnector`). **Every other action — every test, tutorial, and example fixture — has no canonical entry and is completely unaffected**, confirmed by design (the check is a no-op whenever `CANONICAL_CAPABILITY_POLICY_BINDINGS.get(action)` returns `undefined`) and by the full regression run (§8).
- **Reject-on-mismatch, not silent override.** A caller whose declared policy doesn't match the canonical one for a bound action is rejected outright (`POLICY_DENIED`, 403), never silently redirected to the canonical policy. This was chosen over silent substitution for two reasons: (1) it matches this codebase's dominant, established philosophy of explicit, named fail-closed rejections over silent correction (every credential provider, connector registry, and prior `SignalIntentBinder`/`SignalStateVerifier` addition rejects rather than substitutes); (2) it keeps the signed authorization's recorded `policyName`/`policyVersion` — still `transaction.policy.name`/`.version`, unchanged code — honest: since a mismatch is rejected before evaluation, by the time an authorization is ever signed for a bound capability, the caller's declared reference is _already_ guaranteed to equal the canonical one, so no new logic was needed to keep the audit trail accurate.
- **Optional, trailing constructor parameter on `RuntimeEngine`**, exactly matching the established precedent for both prior additions to this same class (`RefusalRecordBuilder`/`Repository` for RFC-0021, `SignalStateVerifier` for RFC-0022/G-24) — every pre-existing direct constructor call site (e.g. `packages/runtime/tests/e2e/runtime.e2e.test.ts`, which constructs `RuntimeEngine` directly) keeps compiling and behaving identically when it omits the new argument. The one production composition root, `RuntimeBuilder.build()`, now **always** constructs and passes a `CapabilityPolicyBinder` — unconditionally, with no builder method to disable it — making the binding an actual structural invariant for all real API traffic, while remaining non-breaking for every other existing call site.

## 6. Implementation Changes

Five files changed, one new:

- **New:** `packages/policy/src/CapabilityPolicyBinding.ts` — the mapping and binder class (§5).
- `packages/policy/src/index.ts` — exports `CANONICAL_CAPABILITY_POLICY_BINDINGS`, `CapabilityPolicyBinder`, `CapabilityPolicyBindingViolation`.
- `packages/runtime/src/RuntimeEngine.ts` — new optional trailing constructor parameter `capabilityPolicyBinder?: CapabilityPolicyBinder`; in `execute()`, a new check runs after policy load and before `SignalIntentBinder`, producing an ordinary `PolicyDecision` REJECT (`matchedRuleId: "capability-policy-binding-violation"`) on a mismatch, with `bindingViolations` (the `SignalIntentBinder` check) skipped entirely in that case (no point checking signal/intent binding against a policy already confirmed wrong).
- `packages/runtime/src/RuntimeBuilder.ts` — constructs `new CapabilityPolicyBinder()` unconditionally in `build()` and passes it as the new trailing argument to `RuntimeEngine`'s constructor.

**Not changed:** `PolicyRouter`, `PolicyValidator`, `PolicyEngine`, `SignalIntentBinder`, `SignalStateVerifier`, `ExecutionGate`, `ExecutionGateway`, any connector, any credential provider, any policy JSON file, `RuntimeFactory.ts`, `application.ts`, any route file, any public HTTP request/response schema.

## 7. Policy Substitution Analysis

Re-ran the exact substitution audit Task 3 required, against the fixed tree:

- **`razorpay:refund-create` + `customer-refund/1.0.0`** (the concrete exploit found during verification): now rejected — proven end to end through the real `POST /execute` route against the real production bootstrap chain (`packages/api/tests/integration/razorpay-refund.integration.test.ts`, new case, §8).
- **`hubspot:deal-update` + `customer-refund/1.0.0`** (the analogous exploit for the other mutating capability): now rejected — same proof, `hubspot-deal-update.integration.test.ts`, new case.
- **Version-only mismatch** (correct policy name, wrong version) is also rejected — `CapabilityPolicyBinder.test.ts`'s dedicated case, since the binder compares both `name` and `version`, not name alone.
- **Renaming/arbitrary policy references**: any `policy.name`/`.version` naming a file that doesn't exist at all still fails earlier, at `FilePolicyRepository.load()` (`PolicyNotFoundError`, pre-existing, unchanged) — the new check only matters for the case that previously succeeded: a real, loadable, _wrong_ policy.
- **Bypassing canonical routing entirely**: confirmed impossible for production traffic — `new RuntimeEngine(` occurs in exactly two places repo-wide (`RuntimeBuilder.ts`, and one direct-construction test file that predates and is unaffected by this change), and `RuntimeBuilder`/`RuntimeFactory` is the sole production composition root (Phase 1E's own architecture-boundary test, `tests/architecture/execution-boundary.test.ts`, independently re-confirms "exactly one ExecutionSystem binding in production composition"; re-run clean in §8).
- **Every policy identifier's provenance**: `transaction.policy.name`/`.version` remains **caller-derived** for every action without a canonical entry (unchanged, by design) and is now **caller-derived-but-validated** (must equal a **system-derived** canonical value or the request is rejected) for the 6 bound capabilities. No identifier is silently system-substituted.

## 8. Regression Validation

**New tests:**

- `packages/policy/tests/unit/CapabilityPolicyBinder.test.ts` (7 tests): no violation for unbound actions; no violation when declared matches canonical; the exact live-shaped `razorpay:refund-create`/`customer-refund` exploit blocked; the same shape for `hubspot:deal-update`; a version-only mismatch blocked; exactly one canonical entry per bound action (no duplicates); the complete bound-action set matches what Phase 2K's own capability inventory (§1 above, and the prior verification's Step 1) found in production bootstrap.
- `packages/api/tests/integration/razorpay-refund.integration.test.ts`, new case: the exploit rejected end to end through the real HTTP route and real production bootstrap chain, zero refund reaches the mock Razorpay server.
- `packages/api/tests/integration/hubspot-deal-update.integration.test.ts`, new case: the same, for HubSpot, with a `fetch` spy additionally confirming zero network calls reached the mock server.

**Full regression run, independently re-executed against the fixed tree:**

```
npx tsc -b                        → clean, 0 errors
npm test -- --maxWorkers=2        → 141 test files passed (+1), 15 skipped (unchanged);
                                     968 tests passed (+9: 7 new binder unit tests, 1 new
                                     Razorpay integration case, 1 new HubSpot integration
                                     case), 39 skipped, 0 failed
```

**Every pre-existing test that pairs a bound action with a policy reference already used the canonical value** — confirmed by direct inspection before writing any code, not discovered by trial and error: `packages/api/tests/fixtures/business-transaction.ts`, `runtime.e2e.test.ts`, `runtime.integration.test.ts`, `razorpay-refund.integration.test.ts`, `hubspot-deal-update.integration.test.ts` all already pair `payments:execute`/`razorpay:refund-create`/`hubspot:deal-update` with `vendor-payment@2.0.0`/`razorpay-refund@1.0.0`/`hubspot-deal-update@1.0.0` respectively. The handful of fixtures that pair these same action strings with a _different_ policy (`execution-request-builder.test.ts`'s `test-policy`, `execution-trust-record.test.ts`'s `vendor-payment@1.0.0`, `multi-item-trust-record.ts`'s `vendor-payment@1.0.0`) were individually confirmed, before implementation, to never invoke `RuntimeEngine.execute()` at all — each unit-tests an isolated builder or storage-repository class directly. The unchanged pass/fail/skip counts (only the expected +9 for genuinely new tests) confirm this held.

**Authorization, replay protection, and audit generation unchanged:** no file under `execution-gateway`, `execution-control`, `envelope-verifier`, or any audit sink was touched; every test covering those areas (already part of the full suite above) passed unmodified.

## 9. Marketing Claim Re-verification

Re-ran the verification for _"Even if AI has valid credentials, it still cannot execute anything your business hasn't authorized. No exceptions,"_ against the fixed tree, not assuming success:

**Property A — Credential Isolation: HOLDS, unchanged.** No file under `packages/execution-control`, `packages/execution-gateway`, or any credential provider was touched by this phase. Re-confirmed by the full regression run passing identically.

**Property B — Independent Authorization: the specific, undisclosed finding this phase targeted is now CLOSED.** The policy-selection bypass — pairing `razorpay:refund-create`/`hubspot:deal-update` with an unrelated, unprotected policy — is proven blocked end to end (§7, §8). **Two previously-identified, separately-disclosed gaps remain, unaddressed, and were never in TD-22's scope:**

- `razorpay-refund/1.0.0`'s `dailyCumulativeAfterThisRefundPaise` signal remains unverified against Parmana's own cumulative-refund ledger (no such ledger is wired to production `POST /execute` at all) — disclosed in `docs/VERIFICATION-GAPS.md` G-24 and `packages/connector-sdk/src/connectors/razorpay/RazorpaySignalStateVerifier.ts`'s own comment, unchanged by this phase.
- `hubspot-deal-update/1.0.0`'s `preAuthorizedForAmountChange` remains an unverified caller-declared boolean — disclosed in `docs/CLAIMS.md` §3.10/§4 (Future Claims), unchanged by this phase.

These are real, but _disclosed_, limitations distinct in kind from TD-22's undisclosed structural gap: both require independent verification _within_ the correct policy (a ledger fetch; a signed approval artifact) — a materially different, larger piece of work than binding a capability to its policy, and out of this phase's explicit non-goals ("Do NOT redesign authorization... Do NOT redesign policies... Only establish structural binding").

**Property C — Structural Enforcement: HOLDS for every production-registered capability.** Policy selection is now a system-derived invariant, not a caller-controlled choice, for all 6 capabilities identified in production bootstrap. This is independently demonstrable: `CANONICAL_CAPABILITY_POLICY_BINDINGS` is a fixed, code-defined constant with no runtime configuration surface, `RuntimeBuilder.build()` wires the enforcing `CapabilityPolicyBinder` unconditionally with no opt-out, and the full regression suite (§8) proves both that legitimate matching requests still succeed and that mismatched ones are now rejected.

**Overall claim status, honestly stated:** the claim is more supported than before this phase, but still not **fully** supported in the unqualified sense — the two disclosed gaps above mean a caller can still influence two specific, named facts (the daily cumulative total; the pre-authorization flag) without independent verification, even though the caller can no longer achieve this by picking a different policy. The claim's "No exceptions" wording remains stronger than what the repository currently proves for those two disclosed items.

## 10. Remaining Limitations

- The two disclosed Property B gaps (§9) remain open — out of TD-22's scope by design, not overlooked.
- `packages/runtime/src/policy/{PolicyRouter,PolicyValidator}.ts` and both copies of `PolicyRegistry` remain dead code, confirmed unused (§2) — a naming-collision hazard for future readers, flagged here, not cleaned up (out of scope; a candidate for a future, dedicated cleanup phase in the style of Phase 2I's TD-20 closure).
- The canonical mapping is a static, code-defined table — adding a new production capability (e.g., a real `vendor-payment` connector, or a sixth vendor integration) requires a corresponding code change to `CANONICAL_CAPABILITY_POLICY_BINDINGS`, not a configuration change. This is intentional (a canonical invariant should not be externally reconfigurable) but means the binding must be kept in sync by hand as new capabilities are added — no automated check currently enforces "every registered capability has a canonical entry" (the reverse direction — every canonical entry corresponds to a real registered capability — is asserted by `CapabilityPolicyBinder.test.ts`'s inventory-matching case, but nothing yet fails if a _new_ capability is registered without adding a binding for it).
- No STOP condition was triggered (§ Final Verification), but the underlying tension the STOP-conditions section anticipated is real: `docs/CLAIMS.md` §2.2 describes policy selection as caller-driven ("loads the policy identified by the Business Transaction") — this phase narrows that generic description for exactly 6 capabilities, without amending §2.2's wording. `CLAIMS.md` itself was not touched in this phase (out of scope; a future documentation phase should reconcile §2.2's general framing with this phase's capability-specific enforcement).

## 11. Evidence Summary

```
Repository searches: grep for "new RuntimeEngine(" (2 occurrences, both accounted for),
  "PolicyRouter"/"PolicyValidator"/"PolicyRegistry" importers (confirmed dead-code
  duplicates), boundSignals presence across all 11 policies/*/*/policy.json files,
  every action:"payments:execute"/"razorpay:refund-create"/"hubspot:deal-update" fixture
  repo-wide (12 files individually checked for RuntimeEngine reachability before
  implementation)

Source references: packages/api/src/mappers/BusinessTransactionMapper.ts,
  packages/policy/src/{PolicyRouter,PolicyValidator,PolicyRegistry,PolicyEngine,
  SignalIntentBinder,FilePolicyRepository,CapabilityPolicyBinding}.ts,
  packages/runtime/src/{RuntimeEngine,RuntimeBuilder}.ts, Dockerfile:104

Call graphs: before/after (§4)

Regression tests: packages/policy/tests/unit/CapabilityPolicyBinder.test.ts (7 new),
  packages/api/tests/integration/razorpay-refund.integration.test.ts (+1),
  packages/api/tests/integration/hubspot-deal-update.integration.test.ts (+1)

Build output: npx tsc -b → clean, 0 errors
Test output: npm test -- --maxWorkers=2 → 968 passed (+9), 39 skipped, 0 failed
```

---

## Final Verification

| Item                                                              | Status                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy selection independently verified                           | ✓ — fresh trace, §2, §3, §4; one new finding (dead-code `PolicyRouter`/`PolicyValidator`/`PolicyRegistry` duplicates) not in the prior report                                                                                                           |
| Canonical capability-to-policy binding established                | ✓ — `CapabilityPolicyBinding.ts`, wired unconditionally into the sole production composition root                                                                                                                                                       |
| Caller policy substitution impossible                             | ✓, for the 6 bound capabilities — proven end to end (§7, §8); unbound actions unaffected by design                                                                                                                                                      |
| Authorization remains independent                                 | ✓ — `PolicyEngine`, `SignalIntentBinder`, `SignalStateVerifier`, `ExecutionGate` all unchanged                                                                                                                                                          |
| Credential isolation unchanged                                    | ✓ — no file under `execution-control`/`execution-gateway`/credential providers touched                                                                                                                                                                  |
| Replay protection unchanged                                       | ✓ — no nonce/envelope-verifier file touched; full suite passes                                                                                                                                                                                          |
| Audit generation unchanged                                        | ✓ — no audit sink file touched                                                                                                                                                                                                                          |
| Runtime behavior unchanged except verified structural enforcement | ✓ — 959→968 test delta fully accounted for by 9 new tests; 0 pre-existing test broke                                                                                                                                                                    |
| Public API compatibility preserved or explicitly documented       | ✓ documented — HTTP contract (routes, request/response shapes, field names) unchanged; the _set_ of previously-succeeding requests narrows for exactly 2 capabilities that had no documented multi-policy flexibility (§9's residual-tension note, §10) |

Supported by: repository searches, source references, call graphs, regression tests, and build output, all in §11.

## Final Recommendation

**TD-22 CLOSED.**

Canonical binding did not exist (Objective B applied, not A) — independently reconfirmed from scratch, including one new finding (dead, same-named `PolicyRouter`/`PolicyValidator`/`PolicyRegistry` duplicates) the prior verification hadn't surfaced. It was introduced with the minimum change necessary: one new, small, dependency-free module in `@parmana/policy`, and a two-line wiring change in `RuntimeEngine`/`RuntimeBuilder` following this codebase's own established, backward-compatible pattern for exactly this kind of addition (matching RFC-0021/RFC-0022's precedent). No STOP condition was triggered — no existing canonical binding, no documented external dependency on caller-selected policies for these specific capabilities, and the HTTP contract itself is unchanged; the one residual tension (§10, §CLAIMS.md §2.2's general framing) is documented rather than silently papered over. Caller policy substitution for the exact exploit found during verification — and its `hubspot:deal-update` analog — is now proven impossible end to end through the real production HTTP route. Full regression (968 passed, +9 new, 0 failed) confirms zero unintended behavior change. The marketing claim's undisclosed Property B gap is closed; two separately-disclosed, differently-scoped gaps remain open, correctly out of this phase's charter, and are named explicitly rather than left implicit.
