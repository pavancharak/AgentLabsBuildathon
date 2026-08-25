# Verification Gaps

Version: 1.0
Status: Public
Companion to `docs/CLAIMS.md`

---

## Purpose

`CLAIMS.md` documents what this repository proves. This document is its complement: every
place a claim, a code path, or a piece of production behavior is *not* independently
verified today. The goal is to know exactly where the unproven edges are before an external
review finds them first.

Same discipline as `CLAIMS.md`: every entry cites a file, a line, or a specific test (or
names the absence of one). Severity is one of three tiers:

- **blocks-pilot**: a real correctness, security, or operational gap a pilot customer or
  their security team would reasonably block on.
- **pre-production**: real, worth closing before general availability, not urgent enough
  to block a scoped pilot.
- **cosmetic**: a documentation, naming, or observability gap with no behavioral
  consequence.

This audit was run against commit `651497a`, `npm test` reporting 345 passed, 1 skipped, 85
test files, coverage measured via `npm run coverage` (`@vitest/coverage-v8`).

---

## Environment note, load-bearing for everything below

Supabase-gated integration tests (see below) are gated on whether `SUPABASE_URL` plus
either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY` are present in `process.env` at
test-run time (`packages/api/tests/helpers/supabase-availability.ts`). Vite's built-in env
loading exposes whatever a local `.env` file sets to `process.env` inside every `vitest run`
invocation, so whether these tests exercise a real, live Supabase project or are skipped
entirely depends silently on the environment doing the run, with no signal in the test
output either way. During this audit pass, Supabase credentials were available in the
environment, so every Supabase-gated integration test ran against a live project rather
than being skipped, and all of them passed; those results are folded into the "verified"
counts throughout this document.

This is itself flagged as gap **G-3** below: nothing about the test output distinguishes
"ran against a real database" from "ran hermetically," and a fresh clone or a CI job without
Supabase credentials configured would silently get less coverage than an environment that
has them, without anyone noticing the difference.

---

## Gaps closed this pass

| # | Gap | Closed by | Verified |
|---|---|---|---|
| 1 | Credential isolation (issue → consume → destroy) was proven only at the library level, never through a real HTTP request | `packages/api/tests/integration/credential-isolation.integration.test.ts` (new), using `packages/api/tests/bootstrap/createInspectableExecutionSystem.ts` (new, test-only re-composition of the real gateway/execution-control/connector chain) | 3 tests: success case (credential issued + destroyed, proven by a second `consume()` throwing `"has been revoked"`), executor-failure case (same proof, plus confirms the credential is still destroyed on a downstream failure), spoofed-attestation case (proves zero sessions/credentials are ever created when the gateway attestation doesn't verify) |
| 2 | `PolicyNotFoundError` never triggered through HTTP | `packages/api/tests/unit/execute-api.test.ts`, "returns 404 when the referenced policy does not exist" | `POST /execute` with an unregistered `policy.name`/`version` → 404 |
| 3 | `DuplicateBusinessTransactionError` never triggered through HTTP (sequential case) | Same file, "returns 409 when the same businessTransactionId is submitted twice" | Two sequential `POST /execute` calls with the same ID → 200, then 409 |
| 4 | `POST /policies/validate` had zero test coverage of any kind | `packages/api/tests/unit/policies-api.test.ts` (new file) | All 4 branches: missing `policyId` (400), missing `policyVersion` (400), loadable policy (200), unknown policy (404) |
| 5 | `GET /receipt/latest/:id`'s 200 success path never exercised | `packages/api/tests/unit/receipt-get-api.test.ts`, new case | Executes a transaction, confirms the receipt route returns the same trust record hash the execution produced |
| 6 | `GET /verification/:id`'s 200 success path never exercised | `packages/api/tests/unit/verification-api.test.ts`, new case | Same pattern |
| 7 | Envelope expiry boundary (`now === expiresAt` exactly) never tested, only "clearly expired"/"clearly valid" | `packages/envelope-verifier/tests/unit/envelope-verifier.test.ts`, "treats the exact expiresAt instant as expired" | Confirms the `<` comparison in `AuthorizationVerifier` is exclusive at the exact instant, and that one millisecond earlier is still valid |
| 8 | Session credential expiry boundary never tested at the exact instant | `packages/execution-control/tests/unit/session-credential-vault.test.ts`, two new cases | Confirms the `>=` comparison is inclusive at the exact instant, one millisecond earlier is still valid |
| 9 | `SessionCredentialVault.consume()`/`revoke()` with an unknown ID never tested | Same file, two new cases | Both throw `"Unknown session credential: <id>."` |
| 10 | Nonce store: no test simulated two concurrent `verify()` calls on the same nonce | `envelope-verifier.test.ts`, "under two concurrent verify() calls with one nonce" | `Promise.all` of two calls, exactly one succeeds, deterministic given `MemoryNonceStore.checkAndRecord()` has no `await` between check and set, not a flaky/probabilistic test |
| 11 | Session credential vault: no test simulated two concurrent `consume()` calls on the same session credential | `session-credential-vault.test.ts`, "under two concurrent consume() calls" | Same pattern, deterministic for the same reason |

18 new tests, 2 new test files, 1 new test-only helper file. Full list of files touched is
in the phase report; nothing in `packages/*/src` was modified.

---

## Gaps closed in the 2026-07-17 audit closeout session

Scope: nine tasks closing findings from the July 16 external audit. Full closing report is
this session's final message to the user; summarized here for the trust-artifact record.

| # | Gap | Closed by | Verified |
|---|---|---|---|
| 12 | `.gitignore` was mixed UTF-16LE/ASCII; git could not parse part of it, which is how `trace.txt` got committed | Rewrote `.gitignore` as clean deduplicated UTF-8/ASCII, recovering every rule from both encoded segments and adding the missing `trace.txt`/`*.trace` rules | `file .gitignore` reports ASCII text; `git check-ignore -v` passes for every representative path including a nested `trace.txt` |
| 13 | Committed debris: 1.6MB `trace.txt`, a pasted-transcript `claim.md`, stray root `resume.md`/`pending.md`, and a misplaced root `vendor-payment.json` | Deleted `trace.txt` and `claim.md`; archived `resume.md`/`pending.md` content to `docs/sessions/2026-07-11-remaining-enterprise-productization.md` and `docs/sessions/2026-07-07-milestone-1b-note.md`; moved `vendor-payment.json` to `examples/vendor-payment.json` | `git status` shows the deletions/move; no remaining references to the old paths found by repo-wide grep |
| 14 | `PARMANA_POLICY_DIR` was read via a non-null assertion; unset, it surfaced as `ERR_INVALID_ARG_TYPE` inside `FilePolicyRepository.load` at request time, not at startup | `packages/shared/src/config/Config.ts`'s `loadConfig()` now validates it at startup, same fail-closed discipline as caller-auth keys | `packages/shared/tests/unit/config.test.ts` (new, 3 tests): refuses to start when unset, refuses when blank, loads the configured value |
| 15 | No canonical list of environment variables the system reads; several were undocumented anywhere (see G-11) | Added `.env.example` at repo root, one entry per `process.env.*` read confirmed by grep across `packages/*/src`, safe placeholders only | Manually cross-checked against every `process.env.` call site in `packages/*/src` |
| 16 | `engines.node` declared `>=22` while the ML-DSA-65 (dilithium3) signature provider requires Node >=24 (native `node:crypto` support); on Node 22/23 the affected tests failed rather than skipping with an explanation | `engines.node` raised to `>=24` in the root `package.json` and the three packages that touch ml-dsa-65 (`crypto`, `execution-gateway`, `envelope-verifier`); added `isMlDsa65Supported()`/`ML_DSA_65_SKIP_REASON` (`@parmana/crypto`) and wired `describe.skipIf`/`it.skipIf` into all 5 affected test files | All 5 files pass on Node 24 (24 tests); on an unsupported Node build the same tests report skipped with the reason in the test name instead of failing |
| 17 | No CI ran the main test suite on push or pull request (`.github/workflows/` had only `python-sdk.yml`), which was gap **G-2** below | Added `.github/workflows/ci.yml`: Node 24, `npm ci`, `npm run build`, a terminology-regression grep guard, then `npm test`; explicit env vars only, no dependency on any `.env` file | YAML validated by parsing with the repo's own `yaml` dependency; the terminology-guard grep and each step verified locally against the actual repo tree |
| 18 | `createApp`'s `callerAuth` option was optional; omitting it silently mounted the API with no caller authentication, and every pre-existing test relied on that omission | `callerAuth` is now a required option: either `{ authenticator, auditSink }` or the literal string `"disabled"`. `server.ts` and all 21 dependent test files (via the shared `tests/test-app.ts` singleton, plus the two direct call sites in `credential-isolation.integration.test.ts`) now state their choice explicitly | Full `packages/api` suite: 85 passed, 1 skipped (Supabase-gated), 0 failed other than the pre-existing live-Supabase-network gap (G-3, unrelated) |
| 19 | The retired term "execution governance" remained in 14 files (`GOVERNANCE.md`, `typescript/docs/06-09`, `docs/architecture/EXECUTION-FLOW-AUDIT.md`, `docs/architecture/KEY-MANAGEMENT.md`, `docs/rfcs/RFC-0012`, `docs/00-introduction/PROBLEM.md`, `docs/specifications/reference-policies.md`, plus this document) | Replaced with "execution authorization" / "AI Execution Authorization" in 12 of the 14 (see exclusions below); added a CI grep guard so it cannot silently reappear | Repo-wide case-insensitive grep for the phrase now returns only the four intentionally-excluded files (see note below) |
| 20 | `FileKeyProvider` built key file paths from `keyId` with no input validation | Rejects any `keyId` not matching `^[A-Za-z0-9._-]+$` before path construction, in `getPrivateKey`, `getPublicKey`, `hasKey`, and `getMetadata` (all route through the same two path-building methods) | `packages/crypto/tests/unit/file-key-provider.test.ts` (new, 5 tests): rejects a `../../../../etc/passwd`-style keyId in all four methods; accepts the well-formed `"default"` keyId used by the rest of the suite |
| 21 | Root `package.json` and `typescript/package.json` both declared `"name": "parmana"`, making plain `npm run <script>` cascade across every workspace and `npx <bin>` resolve relative to an arbitrary workspace instead of the repo root (documented in `docs/audit/CORE-API-FINDINGS-SDK-AUDITS.md` §4) | Renamed `typescript/package.json` to `"@parmana/legacy-reference"`; ran `npm install` to resync `node_modules`/lockfile; removed the `./node_modules/.bin/tsx` workaround from `.github/workflows/python-sdk.yml`, restored to `npm run check:python-models` | `npm run typecheck` and `npm run check:python-models` at repo root now each run only the intended root script, verified directly |
| 22 | No LICENSE; repository intent (proprietary, evaluation-only) was undeclared | Wrote `LICENSE` (source-available for evaluation, all rights reserved, contact `founder@parmanasystems.com`); updated both `# License` sections in `README.md` to match | None |
| 23 | This document's "Environment note" asserted that the `.env` in a specific checkout contains live Supabase credentials, a disclosure of where live credentials exist, not just a description of the gating mechanism | Rephrased to describe the `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` gating mechanism and gap without asserting where live credentials are currently present | None |

**Note on item 19's two exclusions:** `docs/site/how-parmana-thinks.mdx` and
`docs/site/concepts/execution-authorization.mdx` both cite an unrelated third-party academic
work actually named "Execution Governance" (Ku, 2026, EG Reference Specification v0.9.7.3)
in a "Related work" callout. Renaming that citation would misrepresent the cited work's
real name, so it was left untouched. `docs/ROADMAP-v1.md` narrates the terminology sweep
itself (quoting the retired term to describe gap G-18 there, which this session's edit to
`docs/specifications/reference-policies.md` happens to resolve as a side effect; that
roadmap document's own G-18/R6 entries were not updated, out of scope for this session). This
document (`docs/VERIFICATION-GAPS.md`) is exempted from the CI grep guard for the same
reason this section needs to name the retired term.

**No shipped npm package name or public API identifier uses "execution governance"** in any
casing (`ExecutionGovernance`, `execution-governance`, `EXECUTION_GOVERNANCE`), confirmed by
repo-wide grep. Nothing requires a decision on that front.

**Explicitly out of scope for this session, remains open:** the in-memory `NonceStore`
(`MemoryNonceStore`) and `InMemoryCallerAuditSink` both lose all state on process restart,
taking with them the replay-nonce window and the caller-authentication audit trail alike. See new gap **G-13**
below. This was not touched this session and must not be read as closed by anything above.
*(Update from a later hardening session: G-13 has since been resolved. See its entry below
for what changed and how it's verified. This paragraph is left as written at the time for an
accurate record of what this specific session did and did not do.)*

---

## Gaps closed in the Phase 3D certification session

An independent, from-scratch re-certification of the public claim *"Even if AI has valid
credentials, it still cannot execute anything your business hasn't authorized. No
exceptions"* was performed against current repository state (treating every prior phase's
conclusion, including this document's own, as a claim to re-verify, not inherit) and is
recorded in full in `docs/architecture/phase3d-independent-authorization-certification.md`.
**Result: CLAIM FULLY CERTIFIED** for `razorpay:refund-create` and `hubspot:deal-update`,
the two capabilities actually reachable in production.

That certification disclosed eight limitations. Two were genuine, safely closable gaps and
were fixed in the same follow-up session, recorded here as new closed entries:

**G-25. Truncated credential fragments reached the caller-visible `POST /execute` response.**
`GatewayRazorpayAdapter`/`GatewayHubSpotAdapter` returned `keyIdRedacted`/`bearerRedacted`
metadata built by truncating the literal credential to its first 8 (Razorpay `key_id`) or 12
(HubSpot bearer token — the entire credential) characters. `ConnectorEvidence.ts`'s generic
metadata redaction filter (`SENSITIVE_KEY_PATTERN`, matched against key *names*) did not
match either key name, so this literal fragment passed unfiltered through
`ExecutionEvidence.attributes` into the signed Trust Record and the HTTP response body an
AI-facing caller receives. Not a bypass of any authorization decision (the fragment cannot
be used to reconstruct the full secret or skip any check on a subsequent request), but a
genuine exception to a "zero credential bytes ever reach the caller" reading of credential
isolation. **RESOLVED.** `redactRazorpayKeyId`/`redactHubSpotToken`
(`packages/connector-sdk/src/connectors/razorpay/RazorpayTypes.ts`,
`packages/connector-hubspot/src/HubSpotTypes.ts`) now return a one-way, truncated SHA-256
fingerprint (`fp_` + 12 hex chars of the digest) instead of a literal substring — the
operational "which credential executed this" signal an operator needs (same credential ⇒
same fingerprint; a rotated credential ⇒ a different one) is preserved, with zero bytes of
the actual secret reaching any caller-visible surface. `razorpay-connector.test.ts` and
`hubspot-connector.test.ts` were strengthened from asserting a specific redacted string to
asserting the full serialized response contains no substring of the real credential at all —
closing the regression-coverage gap, not merely the immediate instance. Verified:
`npx tsc -b` clean; both suites re-run, 22/22 passing; full monorepo suite re-run,
1039 passed (unchanged count), 43 skipped (+4, the next entry's new file), 0 failed.

**Extends G-24's residual closure (TD-23/Phase 3B): Razorpay daily-cumulative-cap ledger
atomicity was proven live only for the in-memory test implementation.**
`InMemoryRazorpayDailyRefundLedger.test.ts`'s 50-way concurrent-`reserve()` proof exercises
the implementation `NODE_ENV=test` wiring actually uses; the production
`SupabaseRazorpayDailyRefundLedger`'s `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`
atomicity — sound by construction, the same idiom already proven live for `consumed_nonces`
(G-13) — had no dedicated integration test issuing genuinely concurrent connections against
a real Postgres database. **RESOLVED.**
`packages/storage/tests/integration/supabase-razorpay-daily-refund-ledger.integration.test.ts`
(new), gated the same way every other live-database suite in this repository is
(`resolveDatabaseGate`, requiring `ALLOW_LIVE_SUPABASE=1` to run against a real project — not
opted into during this session, so not executed live; confirmed to compile and to skip
cleanly, `1 file skipped, 4 tests skipped`, exactly like its siblings), adds: a two-way race
asserting exact, non-lost-update totals; a 20-way concurrent-reservation proof matching the
in-memory implementation's own proof in kind; and a `release()`-floors-at-zero case (the
schema's `chk_reserved_paise_non_negative` constraint).

**Explicitly not closed by this session, carried forward with reasons (full detail in
`phase3d-independent-authorization-certification.md` §12, items numbered to match that
section exactly):**
- **(§12.1) `payments:execute`/vendor-payment would not satisfy this claim if it were ever
  enabled in production.** Already tracked in this document's own "Investigation
  (2026-08-04): `vendor-payment` remains genuinely blocked" entry above (`vendorVerified`,
  `invoiceVerified`, `paymentApproved`, `sufficientFunds`, `riskScore` remain pure
  caller-declared attestations with no independent verifier and no real system to fetch them
  from) — the certification independently re-confirmed that finding from current source
  rather than merely citing it, and it remains out of scope for this session for the same
  reason: it is not currently a production capability (§2 of the certification), so it
  cannot presently violate the claim, but enabling it as currently written would.
- **(§12.3) HubSpot's `TRUSTED_APPROVAL_ISSUERS`** (`createApprovalIssuerRegistry.ts`)
  remains empty by design; the Signed Approval Artifact mechanism has never been exercised
  against a real, operator-provisioned issuer key in production. Fail-closed, not a
  weakness — and provisioning a real approver key is inherently an operational action, not
  something a code change can substitute for.
- **(§12.5) `GatewayAttestation`** still has no independent expiry/TTL of its own, relying
  on the durable execution-authorization nonce upstream (§6.4 of the certification).
  Deliberately not touched — a shared, foundational crypto primitive; adding a new
  replay-defense mechanism to it is exactly the kind of change this codebase's own
  established practice (Phase 2L's STOP conditions) treats as needing its own chartered
  phase, not a same-session edit, especially with no currently exploitable path found
  through it.
- **(§12.6) The internal gateway-session/session-credential-vault layers** remain
  in-memory, single-process only. Deliberately not touched — persistent/shared storage for
  this layer is infrastructure work of the same shape `02-REMAINING.md` already tracks as a
  dedicated "big rock" (nonce-store persistence), and this layer is downstream of the
  already-durable, load-bearing nonce check.
- **(§12.7) `OverrideService`/`OverrideVerifier`** (G-5, below) remain unreachable dead
  code. **Deliberately, explicitly not wired up** — `02-REMAINING.md`'s own Tier 0 entry
  for this component is a standing security guard reading "do NOT wire overrides" until its
  documented deficiencies are fixed with a design partner's input. Wiring it to "close" G-5
  would directly contradict that guard.
- **(§12.8) Hybrid/PQ signing's scope** (G-4) still stops short of
  execution-authorization/Gateway/connector signing — already tracked there as a
  separately-chartered expansion project, unrelated in kind to this session's scope.

None of these six carried-forward items provide a currently exploitable path for an AI
holding valid credentials to execute an action the business has not authorized, per the
certification's adversarial review (§10 of that document).

---

## Gaps checked and found not applicable

- **Gateway session store concurrency**: `InMemoryGatewaySessionStore.consume()` is fully
  synchronous (not even `async`), so two "concurrent" calls cannot interleave in any sense:
  Node calls them one after another, unconditionally. The existing sequential
  "rejects a reused session" test already covers everything the synchronous case can prove;
  a `Promise.all` wrapper around a synchronous method would not test anything additional.

- **Direct database-write bypass of `RuntimeEngine`.** Raised as `NOT VALIDATED (to full
  exhaustiveness)` by the Strategic Positioning source-code validation audit (2026-08-09),
  which had traced every HTTP route and both SDKs but not every method of every repository
  implementation. Closed by tracing every write method on `ExecutionTrustRecordRepository`
  (`create`, `appendExecution`, `replaceExecution`, `appendOverride`, `appendVerification`,
  `appendReceipt`, `appendSettlementConfirmation`) and `BusinessTransactionRepository`
  (`accept`/`create`) to its callers, repo-wide: every one has exactly one caller, always
  inside `packages/runtime/src/services/*` or `ExecutionTrustApplication`
  (`appendSettlementConfirmation`'s sole caller, `RazorpaySettlementProcessor.ts:203`, is
  itself gated by an independent re-fetch of real Razorpay state before writing, not
  caller-triggered directly). Zero routes in `packages/api/src/routes`, zero SDK methods in
  `typescript/src`/`python/parmana`, write to either repository directly. **Now DIRECTLY
  VALIDATED**, not merely unvalidated-but-presumed-clean: `docs/CLAIMS.md` 2.22's "no code
  path that does not pass through `RuntimeEngine`" scope is confirmed to extend to the
  storage layer as well, not only the HTTP/connector-dispatch layer that document's own
  bypass search (Phase 3D §5.2) already covered.

---

## Remaining gaps, by severity

**Status note, updated in the adversarial-testing hardening session that added G-24:**
every `blocks-pilot` entry (G-1, G-2, G-3, G-24) is now resolved. **This note's own prior
claim, "none describes a live, exploitable security defect," was wrong at the time it
was written**, not because anything regressed, but because G-24 was a real, live,
exploitable bypass of the core execution-authorization invariant that this document's own
internal audit process had not found; an external adversarial exercise found it. Left here
deliberately, struck through in spirit rather than silently rewritten, as the concrete
reason this document's own "re-verify before relying on it" caveat exists. Every gap still
open below (`pre-production`: G-4, G-5, G-6, G-7, G-8, G-9; `cosmetic`: G-10, G-11) is, by
its own text, either explicitly not a security defect (G-9), unreachable from any HTTP path
(G-8), disconnected from the live request path (G-6), a permanent-skip test-coverage gap
rather than a vulnerability (G-7), or a documentation/citation gap (G-10, G-11). This is
again an assessment of those entries as written, not a fresh audit pass against them, and
carries the same re-verify caveat G-24 just demonstrated the cost of skipping.

**Addendum (2026-08-24):** this status note's own gap list (G-4 through G-11) predates
several gaps added in later sessions and is not being retroactively expanded to enumerate
all of them here — see each gap's own entry for its current status. One addition from this
date is directly relevant to this note's own claim structure: **G-29** (new, `pre-production`,
below) is, like G-9, explicitly not a security defect — no request that should be rejected
executes — but unlike every other `pre-production` entry in this note's list, it is a gap
in this system's own audit/evidentiary trail, the same category of property RFC-0021
(Refusal Records) and the caller-audit-sink work exist specifically to provide. It is
open precisely because those two mechanisms both fire downstream of the point where G-29's
rejections occur, not because either mechanism has a defect. **G-29 itself was resolved
later the same day** — see its own entry below for the fix.

### blocks-pilot

**Stale-narrative notice, added 2026-08-24, read before relying on anything below.** The
Razorpay connector — `RazorpayConnector`, `RazorpayRefundService`,
`RazorpaySignalStateVerifier`, `RazorpayDailyRefundLedger`,
`RazorpayCumulativeRefundLedger`, `RazorpaySettlementProcessor`, and every
`packages/connector-sdk/src/connectors/razorpay/*`/`packages/api/src/bootstrap/*Razorpay*`
file this G-24 entry and its updates below cite by path — **was deliberately removed from
this codebase in its entirety on 2026-08-12** (commit `d8a6ded`, "Add HubSpot integration
evidence and update TRL assessment"; confirmed directly: `git log --all -- <any of the
paths above>` shows no file at `HEAD`). `docs/CLAIMS.md` §3.16 and §3.8/§3.9 (both now
marked "Historical: Razorpay connector removed 2026-08-12") already carry this correction;
this document did not, until now — nothing here had been touched since commit `586ea3a`,
which predates the removal, RFC-0021 (Refusal Records), caller-to-capability scoping
(`allowedCapabilities`), the principal-denied audit trail (`docs/CLAIMS.md` §3.19), and
the structural-validation audit trail (G-29 below) alike. The
narrative below is preserved as-written, unedited, as an accurate historical record of
what closed G-24 and its TD-23/RFC-0022 residuals for Razorpay *while the connector still
existed* — but every present-tense claim in it about `RazorpaySignalStateVerifier` etc.
being "wired into production `POST /execute`" is no longer true of current `main`.
`hubspot:deal-update`/`hubspot:deal-fetch` and, since 2026-08-19,
`github:pr-fetch`/`github:pr-merge` (`docs/CLAIMS.md` §3.17) are the capabilities actually
reachable in production today; `HubSpotSignalStateVerifier` (the hubspot-deal-update
closure, further below in this same entry) remains live and current, unaffected by the
Razorpay removal. See G-30 below: the GitHub pair was never added to
`CANONICAL_CAPABILITY_POLICY_BINDINGS`, unlike HubSpot's.

---

**G-24. Policy-evaluation signals were never bound to the executed Intent: the most
severe gap found in this document, a live, reproducible bypass of the core "no
unauthorized execution" invariant, not merely an operational or data-consistency gap
like the rest of this tier. RESOLVED in the adversarial-testing hardening session that
found it.** Found via an external adversarial security exercise (not this codebase's own
internal audit process) run against a disposable local clone: `BusinessTransactionMapper.
fromRequest` (`packages/api/src/mappers/BusinessTransactionMapper.ts:34,36`) takes
`policy` and `signals` verbatim from the client request body. `SignalValidator`
(`packages/policy/src/SignalValidator.ts`) only checks that `signals` is a well-shaped
object, never that its *values* are true. `RuntimeEngine.execute`
(`packages/runtime/src/RuntimeEngine.ts`) evaluated `PolicyEngine.evaluate(policy,
signals)` against exactly those caller-declared signals, with no server-side enrichment
or derivation anywhere in the codebase (confirmed by a repo-wide grep for
enrichment/derivation patterns at the time: zero hits). Separately, `ExecutableContent`
(`packages/shared/src/domain/executable-content.ts`), the thing `ExecutionGateway`
actually signs and executes, is built from `intent.action`/`intent.target`/
`intent.parameters`, a completely disjoint set of fields from `signals`. Nothing
cross-validated that the two described the same real-world action. `docs/CLAIMS.md`
§3.4 already documented half of this precisely, neutrally, without flagging it as a
risk: "policy is evaluated against caller-supplied signals, the same generic mechanism
vendor-payment already uses"; the authors knew signals were caller-supplied; nothing in
the document connected that fact to the missing binding.

Live proof-of-concept, reproduced against an isolated disposable clone (no production
system, no real credentials, no live traffic; see that session's own isolation
confirmation) and again against this repository directly after the fix, both via `POST
/execute` with a real, valid API key and no other privilege: `signals` declared a fully
verified, policy-approved $5,000 payment to a known vendor
(`vendorVerified/invoiceVerified/paymentApproved/sufficientFunds: true, paymentAmount:
5000, riskScore: 10, vendorId: "VENDOR-1001"`), while `intent`, the part that actually
executes, targeted `"ATTACKER-CONTROLLED-ACCOUNT-9999"` for `999999999`. Before the fix:
`200`, policy decision `APPROVED`, execution `COMPLETED`, a real Ed25519-signed Execution
Trust Record and receipt issued for it: the exact artifacts this project's "independently
verifiable execution" claim rests on, attesting to something that never happened as
described. A related, compounding finding from the same session: `authority.principalId`
(who the trust record says approved the action) was likewise caller-declared with no
binding to the identity `callerId` actually proves. Any caller holding any valid API key
could claim to be any human or role, including an "impersonate the CEO" PoC that also
succeeded before this fix.

Fix, two parts, deliberately scoped to *bind the signals a policy actually evaluates to
the intent it actually executes* rather than the larger, separate problem of
independently re-verifying every signal's truth (most signals, `vendorVerified`,
`riskScore`, and similar, have no Intent-side equivalent at all; deriving *those* from an
independently verified source, the way `RazorpaySettlementProcessor` already correctly
does for webhook-derived settlement facts ("the webhook is a doorbell, not a delivery"),
is real, valuable, future work, not done this session):

- **`Policy.boundSignals`** (`packages/policy/src/types/Policy.ts`), an opt-in map from
  signal key to an intent dot-path (`{ "paymentAmount": "parameters.amount", "vendorId":
  "target" }`), validated structurally by `PolicyValidator`. **`SignalIntentBinder`**
  (`packages/policy/src/SignalIntentBinder.ts`) checks every declared binding (strict
  equality; a missing signal counts as a violation, not a pass), and `RuntimeEngine.
  execute` runs this check immediately before `PolicyEngine.evaluate`, over the exact
  signals about to be evaluated and the exact intent that will be signed and executed if
  approved. A violation is built into an ordinary `PolicyDecision` with outcome `REJECT`
  and a reason naming every mismatched field. It flows through the same `ExecutionGate.
  enforce` rejection path as any other policy rejection, so **no authorization is ever
  generated** for a mismatched request, the same fail-closed shape as every other gate in
  this document. `policies/vendor-payment/2.0.0/policy.json` and
  `policies/razorpay-refund/1.0.0/policy.json` were patched in place (not new versions:
  this is a security fix to existing behavior, the same precedent G-1's in-place atomicity
  fix set, not a new business capability) to declare `boundSignals` for their
  amount/target-shaped signals.
- **`isPrincipalAllowed`** (`packages/api/src/auth/isPrincipalAllowed.ts`): an
  authenticated caller may only submit a transaction whose `authority.principalId` is in
  its `ApiKeyEntry.allowedPrincipalIds` grant (`packages/shared/src/config/
  ApiKeyEntry.ts`), defaulting, when unset, to requiring `principalId === callerId`
  exactly, never "anything." Enforced in `routes/execute.ts` and `routes/transactions.ts`
  before `application.execute` is ever called; a mismatch is `403`, no transaction
  constructed. Composed with a second, independent fix for the compounding IDOR finding
  from the same session (any authenticated caller could read any other caller's complete
  transaction/trust-record/receipt history via `/transactions`, `/trust-records`,
  `/verify`, `/verification`, `/replay`, `/receipt*`, none of them scoped by caller at
  all): `metadata.submittedBy` is now stamped server-side from the authenticated
  `callerId` (any client-supplied value is overwritten, never trusted), and
  `isOwnedByCaller` (`packages/api/src/auth/isOwnedByCaller.ts`) gates all six read routes
  plus `GET /transactions`'s list (filtered post-fetch) and `GET /transactions/:id`.
  Cross-caller access now reads as a clean `404`, not a `403` that would confirm the
  target id exists. Both principal-binding and ownership checks are skipped only when
  caller-auth itself is disabled (`req.callerId === undefined`), matching that mode's
  existing no-caller-identity posture.

A third, unrelated finding from the same session was fixed alongside these because it was
already well-scoped: `FilePolicyRepository.load` (`packages/policy/src/
FilePolicyRepository.ts`) built its file path from `name`/`version` with no input
validation, the same bug class G-20 (this table's item 20, FileKeyProvider) had already
been hardened against, just not applied here. Live PoC: `policy: { name:
"../examples/tutorials/01-hello-world", version: "." }` produced a *different, content-
dependent* error (`400 "policyId is required."`) than the clean `404 "not found"` a
genuinely absent path returns, proof the file was read and parsed from outside
`PARMANA_POLICY_DIR`. Now rejected by the same `^[A-Za-z0-9._-]+$` allowlist
`FileKeyProvider` already uses, before any filesystem access, collapsing both cases to an
identical `404` with no differential signal. A fourth, lower-severity finding (malformed
JSON and oversized request bodies on `/execute` surfaced as a generic `500`, indistinguish-
able from a crash, even though the identical `entity.too.large` error type already had
dedicated `413` handling on the webhook route) was fixed the same way, in
`middleware/error-handler.ts`.

Verified: 28 new tests across `packages/policy` and `packages/api` (`SignalIntentBinder.
test.ts`, `file-policy-repository.test.ts`, `isPrincipalAllowed.test.ts`,
`caller-scoping.integration.test.ts`, `error-handler-body-parsing.test.ts`, plus new cases
in `runtime.e2e.test.ts` and `caller-auth.integration.test.ts`), each reproducing the
specific live exploit shape found and asserting it is now rejected, alongside positive
controls proving legitimate matching requests still succeed and cross-caller access to a
caller's *own* data is unaffected. Full suite: 597 tests (558 passed, 35 skipped, the
same pre-existing Supabase-gated skip count as before this session, nothing newly
skipped), `npm run lint` and `npm run typecheck` both clean. The exact live exploit
sequence (signal/intent mismatch, principal spoofing, path traversal, cross-caller read)
was re-run via real HTTP against a freshly built, isolated clone with the fix applied,
not only the automated suite, and confirmed blocked in every case, with a positive
control confirming a legitimate, correctly-bound request still executes successfully.

**Residual, explicitly not addressed by this session, flagged for a future pass:**
`boundSignals` only closes the *decoupling* between what a policy evaluates and what
executes for the specific fields a policy author declares bound. It does not verify that
an unbound signal (`vendorVerified`, `paymentApproved`, `sufficientFunds`, `riskScore`,
and similar) is actually *true*. Those remain caller-declared attestations with no
independent verification, same as before this session; closing that gap for real would
mean extending the `RazorpaySettlementProcessor` fetch-verify pattern to policy signals
generally, a materially larger project than this session's scope. `razorpay-refund/1.0.0`
was bound only on `requestedRefundAmountPaise`; a `paymentId`-shaped binding (so a
declared `paymentStatus: "captured"` claim cannot be about a different payment than the
one `intent` actually refunds) was considered and deliberately not added, since the
policy's `signalsSchema` has no existing field cleanly mappable to `intent.parameters.
paymentId` without inventing new policy-author-facing surface beyond this session's
scope. Flagged here rather than silently left unmentioned.

**Update (2026-08-04), RFC-0022: the razorpay-refund slice of this residual is now closed.**
`SignalStateVerifier` (`packages/policy/src/types/SignalStateVerifier.ts`) is a new, optional,
additive port. `RuntimeEngine.execute` computes a *provisional* decision exactly as before
(`SignalIntentBinder` check, then `PolicyEngine.evaluate` if binding passed), and only when that
provisional decision is `APPROVE` does it run the configured `SignalStateVerifier`, over the
exact signals just evaluated; a violation overrides the decision to an ordinary REJECT
(`matchedRuleId: "signal-state-verification-violation"`), the same fail-closed shape
`SignalIntentBinder` violations already use. Gating on "provisional decision is APPROVE" rather
than running unconditionally is deliberate: a request already going to be REJECTed (by binding or
by an ordinary policy rule) needs no independent re-fetch, which preserves the existing "a policy
denial makes zero calls to the external vendor system" property those tests already asserted
(see `hubspot-deal-update.integration.test.ts`'s `fetchSpy` assertions, updated below). `SignalIntentBinder`
itself is unmodified. `RazorpaySignalStateVerifier`
(`packages/connector-sdk/src/connectors/razorpay/RazorpaySignalStateVerifier.ts`) is the
concrete implementation wired into production `POST /execute`
(`packages/api/src/bootstrap/createRazorpaySignalStateVerifier.ts`, composed in
`packages/api/src/application.ts`): for `razorpay:refund-create` requests only, it independently
re-fetches the real payment from Razorpay -- reusing the exact fetch `RazorpayRefundService`
already performed (`executeRazorpayCapability`, extracted from `RazorpayRefundService` into
`RazorpayCapabilityExecution.ts` so both share one implementation) -- and compares `paymentStatus`,
`paymentCurrency`, `refundableRemainingPaise`, and `requestedExceedsRemainder` against the
caller-declared signals. A fetch failure (network error, payment not found) is itself treated as
a violation: fail-closed, never a silent pass-through. `requestedRefundAmountPaise` is read from
the caller's declared signals rather than re-derived, because `SignalIntentBinder` has already
proven it equals `intent.parameters.amountPaise` by the time this verifier runs.

**Verified:** a new regression test,
`packages/api/tests/integration/razorpay-refund.integration.test.ts` ("rejects by policy through
POST /execute when caller-declared signals misrepresent the real Razorpay payment state"), was
written first and confirmed failing (`200 APPROVED`, a real refund landing on the mock server)
against the code as it stood before this fix, then confirmed passing (`403 POLICY_DENIED`, no
refund reaches the mock server) after it. Full repo `tsc -b`, `eslint . --ext .ts`, and `vitest
run` (762 passed, 40 pre-existing skips, no new skips) all clean, no regressions.

**Explicitly still open, not addressed by this update:**
- ~~`dailyCumulativeAfterThisRefundPaise` is *not* independently verified~~ **-- CLOSED, TD-23
  Phase 3B, see `docs/CLAIMS.md` 3.4's RFC-0022/TD-23 update.** `RazorpayDailyRefundLedger`
  (`packages/connector-sdk/src/connectors/razorpay/RazorpayDailyRefundLedger.ts`, a new,
  differently-shaped `reserve()`/`release()` atomicity primitive -- not the same interface
  as the 2026-08-04 `RazorpayCumulativeRefundLedger.recordApprovedRefundIfWithinCap()` fix
  below, which lived inside `RazorpayRefundService`, since deleted entirely in the
  execution-ownership refactor that moved `RazorpayConnector` to `execution-gateway`; see
  the connector-path corrections elsewhere in this document) is now unconditionally
  supplied to `RazorpaySignalStateVerifier` in production
  (`createRazorpaySignalStateVerifier.ts`), backed by `SupabaseRazorpayDailyRefundLedger`.
  This residual note originally tracked whether *any* ledger was reachable from production
  at all -- it is now, via this new primitive, superseding the deleted class's fix rather
  than continuing it.
- **`vendor-payment`** (`policies/vendor-payment/2.0.0/policy.json`) has the identical shape of
  gap and no verifier: `vendorVerified`, `invoiceVerified`, `paymentApproved`, `sufficientFunds`,
  and `riskScore` remain pure caller-declared attestations. There is no single external system in
  this codebase these facts could be fetched from the way Razorpay's payment API supplies
  `razorpay-refund`'s facts, so closing this one is a materially different, larger problem than
  either closure below, not a trivial extension of them.

**Update (2026-08-04), RFC-0022: the hubspot-deal-update slice of this residual is now also
closed**, following the razorpay-refund closure above exactly, as its flagged "natural next
candidate" (a real, fetchable external source -- HubSpot's own deal API -- already existed).
`HubSpotSignalStateVerifier`
(`packages/connector-hubspot/src/HubSpotSignalStateVerifier.ts`) is the concrete implementation,
wired into production `POST /execute` the same way
(`packages/api/src/bootstrap/createHubSpotSignalStateVerifier.ts`, composed alongside the Razorpay
verifier in `packages/api/src/application.ts` via a new `CompositeSignalStateVerifier`
(`packages/policy/src/CompositeSignalStateVerifier.ts`), since `RuntimeEngine` accepts exactly one
`SignalStateVerifier` and each capability-scoped verifier only recognizes its own action, returning
no violations for anything else): for `hubspot:deal-update` requests only, it independently
re-fetches the real deal from HubSpot -- reusing the exact fetch `HubSpotDealUpdateService`
already performed (`executeHubSpotCapability`, extracted from `HubSpotDealUpdateService` into
`HubSpotCapabilityExecution.ts`, mirroring `RazorpayCapabilityExecution.ts` exactly) -- and
compares `currentDealStage`, `dealStageChangeRequested`, `dealStageTransitionAllowed`,
`amountChangeRequested`, `amountDeltaAbs`, and `amountChangeExceedsThreshold` against the
caller-declared signals. A fetch failure is itself treated as a violation: fail-closed, never a
silent pass-through. `proposedDealStage`/`proposedAmount` are read from the caller's declared
signals rather than re-derived, because `SignalIntentBinder` has already proven they equal
`intent.parameters.dealstage`/`intent.parameters.amount` by the time this verifier runs.
`preAuthorizedForAmountChange` is deliberately excluded from *this* verifier's fetch-based
mechanism: it is an explicitly out-of-band claim with no HubSpot-side fact to fetch and compare
against (see `HubSpotDealUpdateSignals.ts`'s own comment on that field), the same category of
exclusion as `dailyCumulativeAfterThisRefundPaise` above was, at the time this paragraph was
written. **Update (TD-23, Phase 3C, now closed):** exclusion from fetch-based verification did
not mean unverified forever -- `preAuthorizedForAmountChange` now has its own, differently-shaped
verification path (a real, independently-issued, signed Approval Artifact, not a HubSpot API
fetch), added directly to `HubSpotSignalStateVerifier` itself. See `docs/CLAIMS.md` 3.10's
TD-23 update for the full mechanism (`ApprovalVerifier`, `packages/approval/src/ApprovalVerifier.ts`).

**Verified:** a new regression test,
`packages/api/tests/integration/hubspot-deal-update.integration.test.ts` ("rejects by policy
through POST /execute when caller-declared signals misrepresent the real HubSpot deal state"),
was written and confirmed failing (`200 APPROVED`, no deal-state check) with the HubSpot verifier
deliberately left out of the composite while the Razorpay verifier stayed wired, then confirmed
passing (`403 POLICY_DENIED`, the mock deal stage stays unchanged) once wired in. This also
implicitly re-verified the ordering fix above: the two pre-existing `hubspot-deal-update`
policy-denial tests, each asserting *zero* HTTP calls reached the mock HubSpot server on a
denial, kept passing with the verifier now in the request path, because it only ever runs when
the provisional decision is `APPROVE`. `HubSpotDealUpdateService`'s own 42 pre-existing unit
tests pass unmodified -- this was a pure additive change to production wiring, not a change to
that service's behavior. (`HubSpotDealUpdateService` was itself later deleted in the Phase 1C
execution-ownership refactor, replaced by `HubSpotCapabilityExecution.ts`; this was a true,
accurate statement about the code as it stood at the time this paragraph was written.) Full repo `tsc -b`, `eslint . --ext .ts`, `tsc --noEmit`, and `vitest
run` (763 passed, 40 pre-existing skips, no new skips) all clean, no regressions.

**Explicitly still open, not addressed by this update:** `vendor-payment` (above) remains the
only capability of the three using this generic signals mechanism with no independent state
verification at all, for the reason already stated: no single fetchable external source exists
for its signals in this codebase.

**Investigation (2026-08-04): `vendor-payment` remains genuinely blocked, not merely
unattempted.** Per-fact breakdown of every unbound signal in
`policies/vendor-payment/2.0.0/policy.json`'s `signalsSchema` (only `paymentAmount` and
`vendorId` are bound, via `boundSignals`):

- `vendorVerified` -- would need a vendor-verification/KYB (know-your-business) service. No
  connector anywhere in this codebase represents one, not even as a write-only placeholder.
- `invoiceVerified` -- would need an accounts-payable/invoicing system exposing invoice
  match/approval status. `SapConnector` (`packages/connector-sdk/src/connectors/sap/
  SapConnector.ts`) is the plausible real-world candidate (SAP is a common AP system), but it is
  a bare `MockConnector` with exactly one capability, `sap:post-invoice` (write-only, scripted,
  in-memory), explicitly documented as "temporary... until the real connector is implemented."
  No fetch/read capability exists.
- `paymentApproved` -- would need an approval-workflow system. `WorkdayConnector`
  (`.../workday/WorkdayConnector.ts`) is the plausible candidate, same situation exactly:
  `MockConnector`, one write-only capability (`workday:submit-expense-report`), no fetch
  capability, same "temporary" doc comment.
- `sufficientFunds` -- would need an account-balance/treasury API. `OracleConnector`
  (`.../oracle/OracleConnector.ts`) is the plausible candidate, same situation: `MockConnector`,
  one write-only capability (`oracle:create-purchase-order`), no fetch capability.
- `riskScore` -- would need a risk/fraud-scoring service. No connector of any kind represents
  one in this codebase, not even a write-only placeholder like the four above.

`VendorPaymentConnector` itself (`.../vendor-payment/VendorPaymentConnector.ts`) is likewise a
bare `MockConnector`, one write-only capability (`vendor-payment`), no fetch capability, same
"temporary... until the real connector is implemented" doc comment.

Unlike Razorpay and HubSpot, where `MockRazorpayServer`/`MockHubSpotServer` stand in for a real,
already-production-capable HTTP integration (`RazorpayConnector`/`HubSpotConnector` speak to the
real vendor API today whenever no test-only `*_BASE_URL` override is set), `MockConnector` here
is not a test substitute for anything real: in production it would simply return
`{ success: true, metadata: {} }` for whatever it's asked to execute. There is no real system,
mocked in tests, that a verifier's fetch could be faithfully checked against for any of the five
facts -- building one now would mean either fetching from a write-only capability that has
nothing to fetch, or fabricating a new read capability backed by nothing but a hardcoded test
double, which would not be independent verification, only the appearance of it. Per this
investigation's own instructions: this is "genuinely blocked," not "could close this but
haven't" -- **no code was changed for vendor-payment.** All five facts remain exactly as
documented above: pure caller-declared attestations.

**Update (2026-08-04): the daily-cumulative-cap ledger race (flagged above and in the
state-freshness investigation that preceded the razorpay-refund closure) is now fixed.** The
race: `RazorpayRefundService.requestRefund()` read `RazorpayCumulativeRefundLedger
.cumulativeAmountToday(scopeId)` once, early (before that call's own payment fetch and policy
evaluation), then -- across two further `await` points (the payment fetch, and later the actual
refund-create capability call) -- unconditionally appended to the ledger only after a successful
refund, with nothing re-checking the total in between. Two concurrent `requestRefund()` calls for
the same `scopeId` could both read the same pre-write total, both independently pass the
`reject-exceeds-daily-cumulative-cap` rule, and both execute, pushing the real combined total
over the configured cap.

Fix: `RazorpayCumulativeRefundLedger.recordApprovedRefundIfWithinCap(scopeId, amountPaise,
businessTransactionId, capPaise, now?)`
(`packages/connector-sdk/src/connectors/razorpay/RazorpayCumulativeRefundLedger.ts`) re-reads the
current total and appends in a single synchronous call -- no `await` anywhere inside it, so
JavaScript's run-to-completion semantics make the read-then-append atomic with no explicit lock
needed. Returns the new total when the append is accepted, or `null` when appending would exceed
`capPaise` (nothing appended). `RazorpayRefundService.requestRefund()` now calls this immediately
before the actual refund-create capability call (not at the point signals are first built, and no
longer unconditionally after success): a `null` result is treated as an ordinary REJECT
(`matchedRuleId: "reject-exceeds-daily-cumulative-cap-race-guard"`) and Razorpay is never
contacted for it, the same "zero external calls on a denial" shape every other REJECT path here
already has. `capPaise` comes from a new `RazorpayRefundServiceOptions.dailyCumulativeCapPaise`
field, defaulting to a new exported constant,
`RAZORPAY_DEFAULT_DAILY_CUMULATIVE_CAP_PAISE = 2_000_000`
(`packages/connector-sdk/src/connectors/razorpay/RazorpayRefundSignals.ts`) -- this must match
`policies/razorpay-refund/1.0.0/policy.json`'s own cap literal exactly; the two are not
mechanically linked (nothing reads a rule's literal value back out of hand-authored policy JSON),
the same accepted coupling risk `HUBSPOT_DEFAULT_AMOUNT_CHANGE_THRESHOLD` already carries against
`hubspot-deal-update`'s policy.

Known, accepted trade-off of reserving before executing rather than only recording after success:
if the reservation succeeds but the subsequent Razorpay-side refund-create call itself then fails
(network error, Razorpay rejects it), the ledger entry is not rolled back --
`AppendOnlyLedger` is deliberately append-only, by design, with no delete. The day's recorded
cumulative total can therefore end up slightly higher than the sum of refunds that actually
landed on Razorpay, conservatively reducing remaining headroom for the rest of that scope's day.
This is the opposite failure direction from the race being fixed (under-permits rather than
over-permits) and is flagged here rather than left implicit.

**Verified:** a new regression test,
`packages/connector-sdk/tests/unit/razorpay-refund-service.test.ts` ("two concurrent requests
against the same daily cumulative cap cannot both succeed when only one should"), fires two
concurrent `requestRefund()` calls via `Promise.all` against a ledger seeded to 1,700,000 of a
2,000,000 cap, each individually requesting 200,000 (within the per-refund cap and, read
naively, within headroom) but 2,100,000 combined -- over the cap. Proven failing empirically, not
just reasoned about: `git stash`-ed the fix's own source changes (keeping the earlier
razorpay-refund closure's extraction intact) and ran the test against the resulting pre-fix code,
observing both concurrent requests approved and executed (`approvedCount` `2`, failing the `<= 1`
assertion) before restoring the fix. Re-ran the now-passing test five consecutive times with no
flake. Full repo `tsc -b`, `eslint . --ext .ts`, `tsc --noEmit`, and `vitest run` (764 passed, 40
pre-existing skips, no new skips) all clean, no regressions.

**Independently re-confirmed, Phase 3D (fresh re-verification, not a citation of this entry's
own history).** Every update above documents this codebase's own account of closing G-24 and
its TD-23 residuals across several sessions. The Phase 3D certification
(`docs/architecture/phase3d-independent-authorization-certification.md`) treated all of it as a
claim to re-verify, not inherit: it re-traced `SignalIntentBinder`, `CapabilityPolicyBinder`,
`RazorpaySignalStateVerifier`, `HubSpotSignalStateVerifier`, and `RazorpayDailyRefundLedger`
directly from current source (not from this document's narrative) and confirmed, as of commit
`cb467fc`, that all five are still unconditionally wired into production bootstrap (§4, §5 of
that document) and that no alternate execution path bypasses them (§5.2 — the two open
questions an evidence pass raised there, the exact Razorpay dispatch site and
`SdkConnectorExecutor`'s internals, were independently closed by direct reading, not left as
citations). This re-confirmation is current as of that commit, not merely a restatement of the
closures already documented above.

**G-1. Duplicate Business Transaction ID: real, deterministic data-loss race in
`MemoryBusinessTransactionRepository`. RESOLVED (Option A, as written in D-1 below,
implemented as written) in the audit-sink/G-1 hardening session that followed the G-13
session.** The original bug
(`packages/runtime/src/services/business-transaction-service.ts:36-49`): `accept()` does
`await this.repository.exists(id)` then, only if false, `await this.repository.create(...)`,
a classic check-then-act race, not atomic. Two concurrent `accept()` calls with the same
`businessTransactionId` and *different* content both used to succeed, no
`DuplicateBusinessTransactionError` was ever thrown by either, and the second write silently
overwrote the first (100% reproducible via `Promise.all`, not probabilistic).

The fix, exactly as D-1's Option A specified:

- **`MemoryBusinessTransactionRepository.create()`** now does the `Map.has` check and the
  `Map.set` in the same synchronous tick, no `await` between them, so two concurrent calls
  cannot interleave (the same technique `MemoryNonceStore.checkAndRecord()` and
  `SupabaseNonceStore.checkAndRecord()` already use for G-13), and throws
  `DuplicateBusinessTransactionError` itself on a collision, rather than relying on the
  service layer's separate (and racy) `exists()` check. `business-transaction-service.ts`'s
  own `exists()`-then-`create()` sequence is untouched; it remains a cheap fast-path for the
  non-racing common case, but the storage layer is now the actual source of truth.
- **`BusinessTransactionRepository`'s `create()` contract** (`packages/shared/src/
  repositories/business-transaction-repository.ts`) now documents the insert-if-absent
  requirement explicitly: every implementation must throw `DuplicateBusinessTransactionError`
  atomically for a duplicate, not overwrite it.
- **`SupabaseBusinessTransactionRepository.create()`** now maps a `23505` unique-violation
  (from the `business_transaction_id TEXT PRIMARY KEY` constraint that was already there,
  in `supabase/migrations/20260629013035_initial_schema.sql` since the original schema, no
  new migration needed) to `DuplicateBusinessTransactionError` via the same
  `isUniqueViolation` helper G-13 built (`packages/storage/src/errors/
  PostgresErrorCodes.ts`), instead of rethrowing the raw Postgres error.
- **Architectural note, not anticipated by D-1's text**: `DuplicateBusinessTransactionError`
  previously lived in `@parmana/runtime`, which `@parmana/storage` cannot depend on without a
  circular reference (`packages/runtime/tsconfig.json` already references `../storage` for
  its own test fixtures). The class was moved to `@parmana/shared`
  (`packages/shared/src/errors/duplicate-business-transaction-error.ts`, alongside the
  existing sibling `BusinessTransactionNotFoundError`/`ConflictError`/`ParmanaError`
  hierarchy that `execution-service.ts` already used) so both repositories can throw the
  identical class. `packages/runtime/src/errors/DuplicateBusinessTransactionError.ts` now
  re-exports it, so every existing import path
  (`business-transaction-service.ts`, `error-handler.ts`, `execute-api.test.ts`) is
  unchanged and `instanceof` identity is preserved end to end, verified directly by
  `execute-api.test.ts`'s existing "returns 409 when the same businessTransactionId is
  submitted twice" test, which still passes unmodified.
- **API-layer HTTP mapping required no change.** `packages/api/src/middleware/
  error-handler.ts`'s existing `instanceof DuplicateBusinessTransactionError` branch
  (409, no `code` field, matching `schemas/common/error.schema.json`'s documented contract)
  already matches the relocated class via the re-export, confirmed by the same
  `execute-api.test.ts` test above.

Verified: 8 unit tests with mocked/in-memory storage:
`packages/storage/tests/unit/memory-business-transaction-repository.test.ts` (including the
concurrency proof: two simultaneous `create()` calls with the same id and different content,
exactly one succeeds and the other rejects with `DuplicateBusinessTransactionError`, and the
stored record is exactly the winner's, never a merge or the loser's),
`packages/storage/tests/unit/supabase-business-transaction-repository.test.ts` (mocked
`23505` mapping, and fail-closed propagation of any other storage error), and
`packages/storage/tests/unit/business-transaction-repository-duplicate-consistency.test.ts`
(`describe.each` over both implementations, asserting the identical error class and message
for a duplicate), plus 2 Supabase-gated integration tests against a real project, routed
through `resolveSupabaseGate`:
`packages/storage/tests/integration/supabase-business-transaction-duplicate.integration.test.ts`
(sequential duplicate, and the same concurrent-race proof against real Postgres).

**G-2. No CI runs the main test suite. CLOSED in the 2026-07-17 session.** See "Gaps closed
in the 2026-07-17 audit closeout session" above. `.github/workflows/ci.yml` now runs
`npm ci`, `npm run build`, a terminology-regression guard, and `npm test` on every push and
pull request, Node 24, with explicit env vars and no dependency on any `.env` file.
Supabase-gated integration tests are not run in CI (no `SUPABASE_*` secrets are configured
there); they skip cleanly rather than failing, which is itself a decision worth revisiting
if fleet-wide Supabase coverage in CI is wanted later; not done this session.

**G-3. Live external credentials are used by default, unlabeled, on every local test run.
RESOLVED in this session (hardening pass following 2026-07-17 audit closeout).** All 10
Supabase-gated suites (9 in `packages/api`, 1 in `packages/storage`) now route through a
shared `resolveSupabaseGate(suiteLabel)` helper
(`packages/api/tests/helpers/supabase-availability.ts`,
`packages/storage/tests/helpers/supabase-availability.ts`, kept as two independent copies
by design; see that file's own comment). Behavior:

- No `SUPABASE_*` configured: unchanged, skips cleanly, exactly as before.
- `SUPABASE_*` configured but `ALLOW_LIVE_SUPABASE=1` is not set: **hard failure**, not a
  silent run and not a silent skip. The suite throws during test collection, naming the
  missing flag explicitly, so a contributor whose `.env` happens to carry live credentials
  can no longer write real rows to a real project without knowing it.
- `SUPABASE_*` configured and `ALLOW_LIVE_SUPABASE=1` set: runs exactly as it did before
  this change.

Verified directly: with this checkout's own live-credential `.env` present and
`ALLOW_LIVE_SUPABASE` unset, `receipt-negative.integration.test.ts` now fails in ~3s with
`"Receipt Negative Integration: SUPABASE_URL and a Supabase key are configured, but
ALLOW_LIVE_SUPABASE=1 is not set..."` instead of silently running. The guard itself (all
three branches) is covered by unit tests with no live network dependency:
`packages/api/tests/unit/supabase-availability.test.ts` and
`packages/storage/tests/unit/supabase-availability.test.ts` (4 and 3 tests respectively).

**Residual, not addressed by this fix:** once a contributor does opt in with
`ALLOW_LIVE_SUPABASE=1`, no test cleans up after itself:
`workflow-supabase.integration.test.ts` and its siblings still write real
`business_transactions` and `execution_trust_records` rows that are never deleted. That
cleanup gap is a smaller, separate concern from the "silent by default" problem this fix
closes, and was out of this session's scope.

**G-30. `github:pr-fetch`/`github:pr-merge` were wired into production
(`createConnectorRegistry.ts`, commit `38658c0`, 2026-08-19) without a matching entry in
`CANONICAL_CAPABILITY_POLICY_BINDINGS`. Found 2026-08-25, independent of a CLAIMS.md
audit-fix pass that was looking for something else entirely.** `CapabilityPolicyBinder.
findViolation(action, declared)` (`packages/policy/src/CapabilityPolicyBinding.ts`) returns
`undefined` — no violation, by design — for any `action` with no canonical entry in the map;
this is documented, intentional behavior for genuinely out-of-scope actions (test/tutorial
fixtures), but `github:pr-fetch`/`github:pr-merge` are not out of scope — they are real,
production-wired, tested capabilities (`docs/CLAIMS.md` §3.17), reachable through the same
`POST /execute` route as `hubspot:deal-update`. A caller invoking `github:pr-merge` today can
declare *any* loadable policy reference — `CapabilityPolicyBinder` will not reject the
pairing — exactly the "real capability paired with an unrelated, unprotected policy" attack
shape `docs/CLAIMS.md` §2.22 describes as closed. `github-pr-approval/1.0.0` is the intended
policy (§3.17), but nothing structurally prevents a different, loadable policy from being
declared instead and evaluated in its place.

**Why this was missed twice.** `packages/policy/tests/unit/CapabilityPolicyBinder.test.ts`'s
own `"binds every capability the production connector registry actually registers"` test
does not actually read `createConnectorRegistry.ts`; it asserts a hardcoded
`Set(["hubspot:deal-fetch", "hubspot:deal-update"])`, so it passed both before and after
GitHub was wired in without ever checking the claim its own name makes. The original
`CLAIMS-MD-AUDIT.md` (audited against commit `822d65f`, 2026-08-24 — five days after GitHub
was wired in) and the `docs: fix CLAIMS.md stale references and broken citations` pass that
closed out its findings the same day both re-counted `createConnectorRegistry.ts`'s
connectors and both still reported two (`test-fixture`, `hubspot`), missing the `github`
registration entirely — confirmed independently by re-reading the file directly rather than
trusting either report (it registers three: `test-fixture`, `hubspot`, `github`).

**Severity: blocks-pilot.** This is the same shape of finding as G-24, not G-29: a live,
reproducible gap in the specific structural protection §2.22 claims covers "every capability
the production connector registry actually registers." It requires GitHub App credentials to
be configured to matter in practice (the connector fails closed to unregistered otherwise,
per §3.17), so it is not exploitable against an unconfigured deployment, but it is real for
any deployment that has configured GitHub.

**Not yet fixed.** Two options, same shape as D-1/D-2/D-3 above: (A) add
`github:pr-fetch`/`github:pr-merge` to `CANONICAL_CAPABILITY_POLICY_BINDINGS`, pointing both
at `github-pr-approval/1.0.0`, mirroring HubSpot's own two-capabilities-one-policy shape
exactly, and extend `CapabilityPolicyBinder.test.ts`'s coverage test to read
`createConnectorRegistry.ts`'s actual registrations (or an equivalent single source of
truth) instead of a hardcoded set, so this cannot silently recur a third time. *Estimated
size: small — a two-line map addition plus a test fix, under an hour.* (B) if GitHub's own
policy-selection surface is considered intentionally out of scope for this binder for some
reason not yet documented, state that explicitly in `docs/CLAIMS.md` §2.22 and §3.17 rather
than leaving §2.22's "every capability" claim uncorrected.

### pre-production

**G-4. Hybrid/post-quantum signing was dead configuration in production. PARTIALLY
CLOSED, for two of the several signing surfaces, by the Hybrid Signature Support
milestone (Phase A).** Originally: `CRYPTO_MODE`, `PRIMARY_SIGNATURE_PROVIDER`, and
`SECONDARY_SIGNATURE_PROVIDER` were all read into `config.crypto`
(`packages/shared/src/config/Config.ts`), and `crypto.mode` was parsed but never read
anywhere else in the codebase; every production signing call site hardcoded
`CryptoBootstrap.create()` (single-provider), never `createHybrid()`. A deployer who set
`CRYPTO_MODE=hybrid` expecting defense-in-depth PQ signing got silently ignored config;
the server signed Ed25519 only, regardless. That description is now accurate for most,
but no longer all, of this codebase's signing surfaces.

**What's actually wired now:** `packages/crypto/src/VerificationCrypto.ts` (Execution
Trust Records) and `ReceiptCrypto.ts` (Receipts) both read `crypto.mode` (via
`parseCryptoMode`, `packages/shared/src/config/ConfigValidation.ts` — the previously-unvalidated
raw cast is also fixed) and, when it is `"hybrid"`, additionally sign with
`HybridSignatureProvider` (`packages/crypto/src/HybridSignatureProvider.ts`) using both
`PRIMARY_SIGNATURE_PROVIDER` and `SECONDARY_SIGNATURE_PROVIDER`, via
`CryptoBootstrap.createHybrid()` — the same factory this entry originally found unused.
The result is additive, not a schema replacement: the existing single `signature` field
is signed exactly as before (so old records and `@parmana/sign`'s third-party verifier
stay compatible), and a new `signatures` array plus `schemaVersion` are populated only
when hybrid mode produced them. `VerificationCrypto.verify()`/`verifySignature()` require
every entry in `signatures` to independently verify when present — a missing or malformed
entry rejects the whole record, never a silent downgrade to the legacy field alone.
Verified: `packages/crypto/tests/unit/hybrid-signature-provider.test.ts`,
`packages/runtime/tests/unit/verification-service-hybrid.test.ts`,
`packages/runtime/tests/integration/receipt-hybrid.integration.test.ts`.

**What's still exactly as this entry originally found it:** `RuntimeAuthorizationSigner`
(execution authorization signing), gateway attestation signing
(`createGatewayKeyPair`/`GatewayAuthenticationSigner`), and every connector's own signing
path (`createConnectorRegistry.ts` and its call sites) all still call
`CryptoBootstrap.create()` only — single-provider, `PRIMARY_SIGNATURE_PROVIDER` alone,
completely unaffected by `CRYPTO_MODE`. This was a deliberate scope decision (see the
milestone's own "Explicitly out of scope" list: Refusal Records and audit-event signing
are an explicit fast-follow, not this pass), not an oversight, but it means `CRYPTO_MODE=hybrid`
still does **not** mean "everything this process signs is hybrid-signed" — only Trust
Records and Receipts are. A deployer reading `CRYPTO_MODE=hybrid` as covering the whole
process would still be wrong, just differently wrong than before.

**Now promoted to `docs/CLAIMS.md` (3.13), scoped to exactly what's built.** Hybrid
signing is real, tested, and wired for the two surfaces above; `CRYPTO_MODE=hybrid`
remains opt-in, not the production default (`parmana-api-live.fly.dev` still runs
`PRIMARY_SIGNATURE_PROVIDER=ed25519` alone — 3.13 states this explicitly), and
`@parmana/sign`'s public verifier does not yet recognize the `signatures` envelope shape
(3.13's own "Required caveat" paragraph). The claim is capability-only, not a deployment
claim: it does not say hybrid signing runs in staging or production anywhere, because it
doesn't yet.

**Decision still required for the remaining surfaces, see below** (D-2's Option A/B choice
was written before this partial closure and should be re-read as applying only to the
signing paths listed as unwired above).

**G-5. `OverrideService` has zero test coverage and no HTTP route.**
`packages/runtime/src/services/override-service.ts` (business rules: transaction must
exist, trust record must exist, one override per transaction) is never imported by any test
anywhere in the repo, and `packages/api/src/app.ts` mounts no `/overrides` route at all. The
only proof that an override can land on a trust record and still verify
(`packages/api/tests/integration/workflow-supabase.integration.test.ts:122-200`) bypasses
`OverrideService` entirely, calling `storage.trustRecords.appendOverride()` directly on the
repository and manually pre-computing the hash/signature to match: a storage-layer proof,
not a proof that the actual application-layer service (with its business rules) works, or
is even reachable by anything. **Decision required, see below.**

**G-6. `packages/receipt` has zero test files. STALE CLASS NAMES CORRECTED (Phase 3D
follow-up, in response to an external audit report of `docs/CLAIMS.md` 2.5/2.6 that this
entry's own inaccuracy helped mislead — see G-26 for the full account).** `"test": "vitest
run --passWithNoTests"` still means this silently succeeds with nothing asserted — that
part of this entry remains true. But the class names this entry previously cited,
`ExecutionReceiptBuilder`, `ExecutionReceiptVerifier`, and the `ExecutionPermit` model in
`packages/execution-control`, **no longer exist anywhere in this repository** — confirmed
by repo-wide search, zero hits. They were confirmed to have zero live callers and zero test
coverage, and were deliberately deleted during the Hybrid Signature Support milestone
(Phase A); `examples/tutorials/54-execution-receipt/run.ts` and
`55-execution-receipt-verification/run.ts` each carry their own "historical note" explaining
the deletion and what each tutorial demonstrates instead today (the real, live
`ReceiptService`/`application.verify()` path, not the deleted cluster).

**What `packages/receipt` actually contains today:** `ReceiptEngine`
(`packages/receipt/src/ReceiptEngine.ts`) and `ReceiptBuilder`
(`ReceiptBuilder.ts`, a thin factory for it) — a *different, smaller* pair of classes than
this entry originally named, not a renaming of them. `ReceiptEngine.generate()` hashes its
payload with `crypto.createHash("sha256").update(JSON.stringify(payload))` — a
stringified-JSON hash, not this codebase's `CanonicalSerializer` discipline every other
signed artifact uses (Trust Records, Receipts on the live path, Approval Artifacts,
execution authorizations) — and there is no verifier class in this package at all. Still
confirmed disconnected: zero references to `ReceiptEngine`/`@parmana/receipt` anywhere
outside `packages/receipt/src` itself, matching this entry's original "disconnected from
`packages/runtime` and `packages/api`" finding, still accurate. It remains real, shipped
code with a public export surface and zero automated proof of correctness — that
conclusion holds, just for the correct class names.

**Not to be confused with the real, live receipt mechanism**, which is fully implemented,
wired, and tested: `ReceiptService.generate()` (`packages/runtime/src/services/
receipt-service.ts`) — called directly by `ExecutionTrustApplication.execute()` on every
successful execution, after verification — loads the Trust Record, requires the latest
Verification to have actually succeeded (fail-closed otherwise, `ReceiptGenerationError`),
computes a hash and signature via `ReceiptCrypto` (`@parmana/crypto`, canonical
serialization, real Ed25519/hybrid signing), and persists the result via
`appendReceipt`. Tested by `packages/runtime/tests/integration/receipt.integration.test.ts`
and `receipt-hybrid.integration.test.ts`. This is what `docs/CLAIMS.md` 2.5's "Signed
Receipts"/`ReceiptCrypto` citation refers to.

**G-26. External audit of `docs/CLAIMS.md` 2.5/2.6 ("Execution Evidence / Receipt") reported
"Execution Evidence: Not yet implemented," citing a `TODO` stub. Independently investigated
and found to be a false positive caused by two genuine, since-fixed sources of confusion in
this repository itself, not by the underlying claim being false. RESOLVED.**

**What the audit found, verified accurate:** `ExecutionEvidenceComponent`
(`packages/runtime/src/components/ExecutionEvidenceComponent.ts`, as it existed before this
entry) contained exactly the `// TODO: Build ExecutionEvidence from enterprise execution
result.` stub the audit quoted, followed by `return context;` with no evidence built,
attached, signed, or verified. That description of that specific file was correct.

**What the audit got wrong, and why:** `ExecutionEvidenceComponent` was never wired into
the runtime pipeline at all — confirmed by repo-wide search: zero references anywhere
outside its own file, not even in `packages/runtime/src/components/index.ts`'s barrel
export. `RuntimeFactory.create()` (`packages/runtime/src/RuntimeFactory.ts`) only ever adds
`TrustChainValidationComponent` and `ExecutionComponent`
(`packages/runtime/src/components/ExecutionComponent.ts`) as pipeline stages. The real,
live execution-evidence path is `ExecutionComponent.execute()`, which builds the approved
request, forwards it to the `ExecutionSystem`, and then calls
`ExecutionEvidenceBuilder.build(response)` (`packages/runtime/src/
ExecutionEvidenceBuilder.ts`) — a complete, non-stub implementation that maps a real
`ExecutionResult` into a real `ExecutionEvidence` (`action`, `target`, `parameters`,
`success`, `executedAt`, `attributes`) — then persists it via
`ExecutionService.attachEvidence()` (`packages/runtime/src/services/
execution-service.ts:86-100`, a real `trustRecords.replaceExecution(...)` write, not a
no-op). This is the same evidence the Phase 3D certification independently confirmed is
embedded, hashed, and signed inside the Execution Trust Record
(`docs/architecture/phase3d-independent-authorization-certification.md` §8), and is
exercised by `razorpay-live.integration.test.ts`, `hubspot-live.integration.test.ts`, and
`hubspot-deal-update.integration.test.ts`. A separate, similarly-named class,
`ReceiptComponent`, has the identical "correctly implemented but not actually wired as a
pipeline stage" shape (live receipt generation happens via
`ExecutionTrustApplication.execute()`'s own direct `this.receipts.generate(...)` call, not
via this component) — not a stub like `ExecutionEvidenceComponent` was, so it did not
itself mislead this particular audit, but the same class of confusion.

Separately, the same audit's receipt-package findings ("no `ExecutionReceiptBuilder`
implementation, no `ReceiptEngine` implementation, no verifier implementation, no tests")
were traced to this document's own **G-6** entry, whose cited class names had gone stale
after those exact classes were deleted in an earlier session (see G-6's corrected text,
above) — an external reader citing this document in good faith would reach the same
mistaken conclusion the audit did.

**Fix, three parts:**
1. `ExecutionEvidenceComponent.ts` — confirmed dead, not exported from the package's public
   surface, zero references anywhere — **deleted outright**, removing the exact stub an
   auditor or a future contributor could otherwise find and mistake for the live path.
2. `ReceiptComponent.ts` — kept (it remains part of `@parmana/runtime`'s public export
   surface, `packages/runtime/src/index.ts`, so removing it is a larger compatibility
   decision than this fix's scope), but given an explicit doc comment stating it is not
   currently wired as a pipeline stage and naming the actual live invocation path.
3. G-6 (above) corrected to name this package's actual current classes
   (`ReceiptEngine`/`ReceiptBuilder`) instead of the deleted ones, and to explicitly
   distinguish it from the real, tested, live receipt mechanism.

**Verified:** `npx tsc -b` clean after the deletion (confirming no hidden caller existed);
full regression suite re-run, unchanged pass/fail/skip counts aside from the removed file
itself.

**G-27. `payments:execute` (vendor-payment) was a gap-in-waiting against the public
positioning claim "only what you authorize should become real" — real, committed code that
would have violated that claim had it ever been made a production capability as it then
existed. RESOLVED by outright removal (below), and the positioning claim itself
subsequently upgraded to YES by an independent fourth validation pass — see this entry's
own "Positioning-claim status" paragraph, below, for the full account. Originally
documented here per the Strategic Positioning source-code validation audit (2026-08-09,
read-only by its own rules, so this entry was originally that audit's required
documentation follow-up, not a restatement of new findings).**

**Not a live defect.** `createVendorPaymentConnector.ts:30-32` gates registration to
`process.env.NODE_ENV === "test"` only; `createConnectorRegistry.ts` skips registering it
otherwise. This is a real, structural exclusion (independently confirmed by reading the
gating condition directly, both in the Phase 3D certification and again in the Strategic
Positioning audit) — `payments:execute` cannot currently be reached through any production
`POST /execute` or `POST /transactions` request. The reason this still belongs in this
document: the mechanism excluding it is an environment variable, not a proof that its
authorization-relevant facts are true — a different, weaker kind of guarantee than every
other in-scope capability has.

**What exists, and why it's blocked, in full**: already investigated exhaustively in this
document's own "Investigation (2026-08-04): `vendor-payment` remains genuinely blocked, not
merely unattempted" entry (above, this same G-24 block) — re-read directly, not
transcribed, for this entry. Summary: `policies/vendor-payment/2.0.0/policy.json`'s
`signalsSchema` has five signals (`vendorVerified`, `invoiceVerified`, `paymentApproved`,
`sufficientFunds`, `riskScore`); only two (`paymentAmount`, `vendorId`) are bound to Intent
via `boundSignals`. The other five remain pure caller-declared attestations, with **no
independent verifier anywhere in this codebase** — confirmed again, fresh, by the Strategic
Positioning audit's own grep sweep. The plausible real-world sources for these facts
(`SapConnector`, `WorkdayConnector`, `OracleConnector`) are each a bare, write-only
`MockConnector` with no fetch capability to verify against; `riskScore` has no candidate
connector at all.

**What would need to be true before this capability could be enabled without contradicting
the positioning claim**: the same closure work Razorpay (TD-23, Phase 3B) and HubSpot
(TD-23, Phase 3C) already received — a `SignalStateVerifier` implementation that
independently re-derives each of the five facts from a real external system and rejects on
any disagreement with the caller's declared value, wired unconditionally into production
the way `RazorpaySignalStateVerifier`/`HubSpotSignalStateVerifier` are. This is **not**
attempted here — it requires building genuine external integrations (a KYB/vendor-
verification service, an AP/invoice-matching system, an approval-workflow system, a
treasury/balance API, a risk-scoring service) that do not exist in this repository in any
form today, a real feature-scoping decision for a future phase, not a documentation task.
**No code was changed for vendor-payment by this entry or the audit that prompted it.**

**Cross-reference audit, confirmed clean:** checked `docs/CLAIMS.md` for any claim that
`payments:execute`/vendor-payment would contradict. None found — 2.23's own text already
scopes the "CLAIM FULLY CERTIFIED" result to `razorpay:refund-create`/`hubspot:deal-update`
explicitly and names vendor-payment as out of scope "for that reason, not because it was
overlooked"; 3.3's scope clause already disclaims "any enterprise-specific connector"; no
claim anywhere states or implies repository-wide signal-verification coverage. No narrowing
edit to `CLAIMS.md` was needed as a result of this entry.

**RESOLVED by removal, not by independent verification.** Decision: `payments:execute`/
vendor-payment was never on the roadmap as a real capability, so building the independent
`SignalStateVerifier` work described above (a real feature-scoping project) was rejected in
favor of removing the capability outright — the gap can't exist if the capability doesn't.
Removed: `packages/connector-sdk/src/connectors/vendor-payment/` (the `VendorPaymentConnector`
class and its metadata — confirmed orphaned, zero live callers, predating even this fix),
`packages/api/src/bootstrap/createVendorPaymentConnector.ts` (the `NODE_ENV === "test"`-gated
factory this entry's own opening paragraph cited), `packages/api/src/bootstrap/
createCredentialProvider.ts` (its dedicated, single-purpose credential provider — confirmed
to have had exactly one caller, the registration block below), the vendor-payment
registration block inside `createConnectorRegistry.ts`, and the now-meaningless
`"vendor-payment"` entry from `createConnectorAuthenticator.ts`'s trusted Gateway-attestation
identity list. `payments:execute` now has no connector to resolve to **in any environment**,
not only outside `NODE_ENV=test` — confirmed by a new regression test asserting exactly
this (`create-connector-registry.test.ts`, "payments:execute has no connector to resolve to
in any environment").

**Deliberately not removed**: `policies/vendor-payment/2.0.0/policy.json` and the shared
test fixtures (`packages/api/tests/fixtures/{business-transaction,policies}.ts`) that use it
as their generic default example — investigation found these are load-bearing shared
infrastructure for 19+ unrelated test files (caller-auth, credential-isolation, receipts,
replay, trust records, verification, and others that have nothing to do with vendor-payment
as a business capability), not vendor-payment-specific testing. The policy file's continued
existence carries no execution risk with zero connector able to back it — a caller
presenting `intent.action: "payments:execute"` still cannot cause any real-world effect,
regardless of policy outcome, because `ConnectorSdkRegistry.resolveCapability` fails closed
with "No connector registered for capability" before any connector dispatch is possible.
Migrating the shared fixtures away from the vendor-payment name entirely was considered and
explicitly declined as disproportionate to the actual risk (none) for this pass — flagged
here, not silently decided.

**Positioning-claim status, confirmed by the fourth validation pass.** "Only authorized
actions become execution" no longer has a capability-shaped exception. This entry
documented the removal but deliberately did not itself re-certify the positioning claim —
that re-certification has since happened: a fourth, independent Strategic Positioning
validation pass, run fresh with no reliance on this entry's own conclusions, re-traced the
production connector registry from source, re-confirmed `payments:execute` has no connector
to resolve to in any environment, independently scrutinized the replacement test-only
connector for new bypass risk (found none), and upgraded the executive verdict from
PARTIALLY SUPPORTED to **SUPPORTED BY IMPLEMENTATION — YES**. Full record, including the
precise honesty constraint on what was and wasn't re-verified in that pass (2 of 10 negative
tests re-run fresh; multi-tenant isolation and the direct-database-write bypass finding left
as "unchanged, not re-traced"): `docs/architecture/strategic-positioning-validation.md` §6
("Final Answer") and "Verdict History"; also cited in `docs/CLAIMS.md` §2.25.

**Verified**: `npx tsc -b --force` clean; full regression suite re-run (see this session's
own record for exact pass/skip counts, unchanged aside from the tests removed/updated for
this capability specifically).

**Update (code-only ground-truth capture pass, follow-up closure): one more miss from this
entry's own removal list, found and fixed.** `packages/policy/src/CapabilityPolicyBinding.ts`'s
`CANONICAL_CAPABILITY_POLICY_BINDINGS` still carried a `"payments:execute" →
{name: "vendor-payment", version: "2.0.0", ...}` entry — not in this entry's "Removed:" list
above, and confirmed genuinely orphaned relative to the current connector registry
(`createConnectorRegistry.ts` registers exactly `test-fixture`, `razorpay`, `hubspot`; no
`payments:execute`-capable connector exists in any environment, as this entry itself already
established). Inert, not dangerous — `CapabilityPolicyBinder.findViolation()` can only ever
reject a request for a bound action, and `payments:execute` has no connector to reach
`RuntimeEngine` for in the first place — but stale relative to `CANONICAL_CAPABILITY_POLICY_BINDINGS`'s
own doc comment, which claims the table covers "every capability actually registered in
production bootstrap." Removed the entry; `packages/policy/tests/unit/CapabilityPolicyBinder.test.ts`'s
`"binds every production-registered capability..."` test (which had been asserting the stale
set, including `payments:execute`, as expected output — itself a second symptom of the same
miss) updated to match the corrected table. Full regression suite re-run clean, unchanged
pass/skip counts aside from this one test's edited assertion. No other reference to this
binder entry found in `CLAIMS.md` or elsewhere in this file that depended on `payments:execute`
being present in the table.

**G-28. `PARMANA_AUTH_DISABLED=true`'s exact scope, precisely documented (previously
undocumented in either `CLAIMS.md` or this file, despite `CLAIMS.md` 2.16/2.17 already
citing the flag by name).** Flagged by the Strategic Positioning source-code validation
audit (2026-08-09) as a real, disclosed bypass path that needed its precise scope stated
somewhere, rather than left implicit — "don't let this get flattened into either
overstating or understating the risk" was that audit's own framing, and it is the right bar
to document against.

**What the flag does, confirmed directly:** `createCallerAuthenticator.ts:31-39`
(`packages/api/src/bootstrap/`) returns `{ disabled: true }` when `config.auth.disabled` is
set, after printing a loud, unmissable startup warning ("WARNING: PARMANA_AUTH_DISABLED=true.
The API is accepting requests with no caller authentication. This must never be set in a
real deployment."). Default behavior remains fail-closed: with no keys configured and this
flag unset, the process refuses to start at all (same file, lines 41-48) — the flag is the
only way around that refusal, and it is opt-in, never a silent fallback.

**What the flag does NOT do, confirmed directly:** `RuntimeEngine`, `PolicyEngine`,
`CapabilityPolicyBinder`, `SignalIntentBinder`, and every `SignalStateVerifier` operate on
the constructed `BusinessTransaction` object only — none of them ever reads the Express
`Request` object, `req.callerId`, or anything caller-auth-middleware-derived (confirmed by
direct grep of `RuntimeEngine.ts`/`PolicyEngine.ts`/`SignalIntentBinder.ts`/
`CapabilityPolicyBinding.ts` for any reference to caller identity: zero hits). The
caller-auth middleware and the action-level authorization pipeline are two structurally
separate mechanisms with no dependency between them. Setting `PARMANA_AUTH_DISABLED=true`
therefore removes **caller identity and accountability** (who submitted this request,
whether they're allowed to assert the `authority.principalId` they declared, per
`isPrincipalAllowed.ts`) — it does **not** remove **action-level authorization**
(`CapabilityPolicyBinder`, `SignalIntentBinder`, `PolicyEngine.evaluate`,
`SignalStateVerifier`, `ExecutionGate.enforce`), which remain fully active and would still
reject an unauthorized `razorpay:refund-create`/`hubspot:deal-update` request exactly as
they do with caller-auth enabled.

**Precise statement for any future doc referencing this flag:** "`PARMANA_AUTH_DISABLED`
disables caller identity/accountability only; it does not disable action-level
authorization." Neither "auth can be fully disabled" nor silent omission of the flag
correctly describes current behavior — both were considered and rejected for this entry.

**G-7. `execution-failure.integration.test.ts` is permanently `describe.skip`ped**, not
env-gated. `RuntimeFactory` always constructs its own `DefaultExecutionSystem` internally,
with no dependency-injection seam for a test to supply a failing `ExecutionSystem`. The
claim it would prove (that an execution-system failure is surfaced as
`execution.status === "FAILED"` with a 500, not silently swallowed) remains unverified.
Unlike every other gap in this document, closing this one requires a `RuntimeFactory`
constructor signature change, which is out of scope for a test-only pass.

**G-8. Several error branches remain untested, all reachable only via direct library use,
not via any HTTP path this server currently exposes:**
- `ExecutionGateway.ts:246-249`: the "executionControl is incomplete" guard. Only reachable
  by direct library misuse; production's bootstrap always supplies a complete options object.
- `SignedTokenConnectorAuthenticator`'s two distinct identity-mismatch branches
  (`gatewayId` mismatch at line 65-67, `publicIdentity` mismatch, separately from the
  signature-verification branch that every existing test actually exercises first);
  every existing test uses one consistent identity, so these specific branches, distinct
  from "signature doesn't verify," are unexercised.
- `SdkConnectorExecutor.ts:47-60`: `expectedVersion` mismatch and `health.status ===
  "unavailable"` rejections. Neither is used by `packages/api`'s bootstrap today
  (`createConnectorRegistry.ts` never passes `expectedVersion`), so also unreachable from
  HTTP currently, only from direct library use.
- `SdkConnectorExecutor.ts:62-67`'s own capability check is structurally dead in every
  configuration this repo wires up: `DefaultConnectorPolicy.assertAllowed()` runs the
  identical check earlier in the same call chain and always wins first.

**G-9. `ExecutionControlService` and `SessionCredentialSecureConnector` each independently
audit-log the same execution** (confirmed directly this pass while writing the new
credential-isolation test; see "Gaps closed" #1 above). Not a security defect: both
records are consistent, and only the connector-level one carries `credentialId`. It is a
duplicate-logging quirk worth a one-line fix (skip the outer log, or document why both
exist) but was out of scope for this pass since it isn't test-only.

**G-13. `MemoryNonceStore` and `InMemoryCallerAuditSink` both lose all state on process
restart. RESOLVED in the durable-replay-protection hardening session that followed the
2026-07-17 audit closeout and its own G-3 fix.** Both now have durable, Supabase-backed
replacements, wired in as the production default:

- `packages/storage/src/supabase/SupabaseNonceStore.ts`: implements `NonceStore`
  (`@parmana/envelope-verifier`) with the exact same interface and call-site semantics as
  `MemoryNonceStore`: a nonce is still consumed as the last step of verification, strictly
  before execution (`packages/execution-gateway/src/ExecutionGateway.ts`, unchanged by this
  session; only the storage backing changed). Backed by a new `consumed_nonces` table
  (`supabase/migrations/20260718090000_add_nonce_and_caller_audit_tables.sql`) whose
  `PRIMARY KEY` on `nonce` is the entire atomicity mechanism: two concurrent `INSERT`s of
  the same nonce race at the database, not in application code; exactly one succeeds, the
  other fails with a `23505` unique_violation, mapped to "already consumed" by a new
  `isUniqueViolation` helper (`packages/storage/src/errors/PostgresErrorCodes.ts`; no such
  Postgres-error-code mapping existed anywhere in this codebase before this session; see
  D-1 below, which needs the same kind of mapping for G-1, still open and unrelated).
- `packages/api/src/auth/SupabaseCallerAuditSink.ts`: implements `CallerAuditSink`
  unchanged, backed by a new `caller_audit_events` table in the same migration.

Production wiring (`packages/api/src/bootstrap/createNonceStore.ts`,
`createCallerAuditSink.ts`) fails closed: test wiring (`NODE_ENV=test`) still gets
`MemoryNonceStore`/`InMemoryCallerAuditSink`, mirroring the production/test split
`createCredentialProvider.ts` already established for the vendor-payment connector
credential, but outside test wiring, an unconfigured Supabase backing throws a named,
actionable error at startup (`assertSupabaseConfigured`) rather than silently falling back
to an in-memory store. `SupabaseNonceStore.checkAndRecord` also fails closed on any error
other than a unique-violation: the error propagates rather than being swallowed, so a
request whose nonce check hit an unreachable database is rejected, never silently treated
as accepted.

Verified: 22 unit tests against mocked storage (atomic-consumption mapping, the fail-closed
storage-error path, and the fail-closed production-wiring checks):
`packages/storage/tests/unit/supabase-nonce-store.test.ts`,
`packages/storage/tests/unit/postgres-error-codes.test.ts`,
`packages/api/tests/unit/supabase-caller-audit-sink.test.ts`,
`packages/api/tests/unit/bootstrap/create-nonce-store.test.ts`,
`packages/api/tests/unit/bootstrap/create-caller-audit-sink.test.ts`, plus 5 Supabase-gated
integration tests against a real project, routed through the same `resolveSupabaseGate` the
G-3 fix established (skip cleanly with no credentials, hard-fail without
`ALLOW_LIVE_SUPABASE=1`): `packages/storage/tests/integration/
supabase-nonce-store.integration.test.ts` (atomic consumption, a real concurrent-`INSERT`
race with exactly one winner, and, the test that actually proves this gap closed, a nonce
consumed through one store instance is still consumed by a second, independently
constructed instance against the same backing, which `MemoryNonceStore` cannot pass at all)
and `packages/api/tests/integration/supabase-caller-audit-sink.integration.test.ts` (a
written event is read back through a second, independent client).

**Residual, explicitly not addressed by this session:**
- **Unbounded growth.** `consumed_nonces` is append-only by design (no application code
  updates or deletes a row), and nothing purges expired rows yet. The table carries
  `expires_at` for exactly this purpose; a future session should add a retention job (e.g. a
  scheduled delete of rows well past their `expires_at`), sized past the maximum TTL rather
  than tied to it. `caller_audit_events` has the same open shape and the same unmade
  retention decision.
- **`CallerAuditSink.record()`'s failure semantics are unchanged, not hardened.**
  `middleware/caller-auth.ts` still `await`s `record()` with no `try`/`catch`, exactly as
  before this session (re-confirmed by re-reading the call site). This session was
  instructed to preserve that behavior, change only durability, and does. Whether a failed
  audit write should be allowed to fail the caller-auth request path at all remains an open
  design question, not decided here. *(Update from a later session: this question has since
  been decided and implemented: fail-closed. See "Decision record: audit-sink fail-closed"
  immediately below.)*

**G-14. The test that proves G-13 closed could silently not run at all, with a green
summary line. RESOLVED in the session that followed G-13.** `resolveSupabaseGate`
(`packages/api/tests/helpers/supabase-availability.ts`,
`packages/storage/tests/helpers/supabase-availability.ts`) decides whether a Supabase-gated
suite runs by reading `process.env.SUPABASE_URL` at module-collection time. That variable
only reached a given test file's `process.env` if something in *that file's own import
graph* happened to transitively import `packages/shared/src/config/Config.ts`, whose
module-scope `dotenv.config()` call was, until this session, the only place `.env` ever got
loaded. Vitest runs each test file's collection in a worker thread, and worker threads each
get an independent snapshot of `process.env`, so whether a file "saw" `SUPABASE_URL` came
down to which worker it landed in and which sibling files shared that worker, not a real gate
decision. `packages/storage/tests/integration/supabase-nonce-store.integration.test.ts`
(no import path to `Config.ts`; it only imports `SupabaseClientFactory` and
`SupabaseNonceStore`, both dependency-free of `@parmana/shared`'s config module) lost that
coin flip in every run observed across two separate sessions, including the one that first
wrote G-13's "RESOLVED, verified" claim above: the restart-simulation test that is the
*specific* proof `MemoryNonceStore` could not pass ("a nonce consumed through one store
instance is still consumed by a fresh instance against the same backing") was silently
`describe.skipIf`-skipped, not run, every time, with nothing in the `npm test` summary
distinguishing it from a clean pass.

Fix, three parts:

1. **Deterministic env loading.** `vitest.setup.ts` (already registered as the sole
   `setupFiles` entry in `vitest.config.ts`, so every worker always runs it first) now calls
   `dotenv.config({ path: <repo-root>/.env, override: false })` directly, before any test
   file's own imports execute. Every worker now gets an identical, complete env snapshot
   regardless of which test files happen to share it. `Config.ts`'s own `dotenv.config()` call
   is untouched: `override: false` on both sides means neither load can clobber the other or
   an already-set shell variable; it is now simply a no-op the first time a file imports it.
2. **Ambient-env coupling in unit tests: investigated, none found requiring a code change.**
   The working hypothesis going into this fix was that several unit tests (`verification-api`,
   `execute-api`, `receipt-get-api`, `transactions-api`, and peers) implicitly depend on
   `SUPABASE_*` being *absent* to stay on their in-memory storage path, and would need
   `vi.stubEnv`/explicit deletion in `beforeEach`/`afterEach` to stay green once env loading
   became deterministic. Reproducing this directly (full suite runs with `SUPABASE_URL` and
   a key present under the corrected deterministic loading, both with `ALLOW_LIVE_SUPABASE`
   unset (fail-closed gate throws for the 13 gated suites, everything else green) and set (all
   13 gated suites plus every unit test green)) found no such coupling. Reading
   `packages/api/src/bootstrap/createNonceStore.ts` and `createCallerAuditSink.ts` confirms
   why: both branch on `NODE_ENV === "test"` first, unconditionally returning the in-memory
   implementation in test wiring regardless of `SUPABASE_URL`'s presence; the coupling the
   hypothesis assumed does not exist in the production bootstrap code. (A prior, separate
   session had reproduced 13 unit-test failures resembling this hypothesis, but by shelling
   out `set -a; . ./.env; set +a` before `npm test` rather than letting `dotenv` load it;
   that method's real effect was exporting `ALLOW_LIVE_SUPABASE=1`, which happened to still
   be present in `.env` at that point in that session, globally as well, driving every gated
   suite live and concurrent alongside the unit tests, not "`SUPABASE_URL` merely present."
   That confound does not reproduce under `dotenv`-based loading; see verification below.)
3. **Closed the fail-open hole in the gate itself.** `resolveSupabaseGate` previously had only
   three branches: opt-in + configured → run; configured without opt-in → throw; unconfigured
   → skip cleanly. A fourth case was unhandled: opt-in **set** but `SUPABASE_URL`/a key **not
   visible**, which fell through to the "unconfigured" branch and skipped cleanly: exactly
   the silent-skip failure mode this gap describes, just with an explicit opt-in present.
   Both helper copies now throw a dedicated error naming this exact condition ("a live run was
   explicitly requested... but Supabase env is not visible to this worker; env loading is
   broken") instead of degrading to a skip. Explicit intent must never quietly become a green
   skip.

Verified: unit coverage for all four `resolveSupabaseGate` branches in both packages
(`packages/api/tests/unit/supabase-availability.test.ts`,
`packages/storage/tests/unit/supabase-availability.test.ts`, 5 and 4 tests respectively; the
new case in each is "(case d, G-14) throws naming broken env loading when
ALLOW_LIVE_SUPABASE=1 is set but SUPABASE_* is not visible"). With `ALLOW_LIVE_SUPABASE=1`
temporarily appended to this checkout's live-credential `.env`, `npm test` was run three
consecutive times specifically because the original bug was scheduling-dependent and one
green run proves nothing: all three reported an identical `107 passed | 1 skipped (108)`
test files and `478 passed | 1 skipped (479)` tests, zero failures, with the
restart-simulation test confirmed executing and passing (not skipped) via a verbose-reporter
run interleaved between them. (The one remaining skip in every run is the pre-existing,
unrelated `describe.skip` in `execution-failure.integration.test.ts`, not Supabase-gated.)
Before this fix, the same live-opt-in configuration produced `475 passed | 4 skipped (479)`,
the nonce-store suite's 3 tests silently missing, non-deterministically, from run to run.
`ALLOW_LIVE_SUPABASE=1` was removed from `.env` again immediately after verification; `npm
run lint` and `npm run build` both pass clean on the resulting tree.

**Residual, not addressed by this fix:** the two `resolveSupabaseGate` copies remain
independent, hand-maintained duplicates (by design, per each file's own comment; see G-3);
a future divergence between them would not be caught by anything short of manually diffing
the two files or the shared unit-test coverage happening to be kept in lockstep, as it was
this session.

**G-15. A default `npm test` on a machine with live Supabase credentials configured either
threw (pre-G-14 fix) or, independently, could crash test collection outright with a generic
supabase-js error. RESOLVED in the session that followed G-14, in two parts.**

*Part 1: `resolveSupabaseGate` branch 2 semantics changed, deliberately, from G-3's
original design.* The "configured, no opt-in" branch used to throw (G-3's own fix, made
consistent by G-14). It now skips cleanly instead, logging one line naming why
(`"<suiteLabel>: Supabase credentials configured but ALLOW_LIVE_SUPABASE=1 not set —
skipping live suite. Set ALLOW_LIVE_SUPABASE=1 to run it."`). **Trade-off, accepted
deliberately:** the previous throw existed specifically so a contributor with live
credentials in `.env` could not accidentally run live suites without realizing it. Turning
that into a skip means a default `npm test` on such a machine (the common daily-development
case) now stays green and side-effect-free without anyone touching `.env`, at the cost of
reintroducing exactly the silent-by-default posture G-3 was written to close. The other
three branches are unchanged: opted-in + configured still runs live; unconfigured still
skips cleanly; opted-in + **not** visible still throws (G-14's fix stays a hard failure;
explicit intent must never quietly degrade). Both helper copies
(`packages/api/tests/helpers/supabase-availability.ts`,
`packages/storage/tests/helpers/supabase-availability.ts`) and both packages' 4-branch unit
tests were updated in lockstep.

*Part 2: the storage bootstrap crashed test collection independent of the gate.*
`StorageFactory.createFromEnvironment()` (`packages/storage/src/StorageFactory.ts`) built
whatever `PARMANA_STORAGE` named (including a live `SupabaseClient` via
`SupabaseClientFactory.create()`), with no test-mode awareness at all, unlike
`createNonceStore.ts`/`createCallerAuditSink.ts`'s NODE_ENV-gated split (G-13). Worse,
`packages/api/src/repositories.ts` called it as a **module-scope side effect**, so merely
*importing* `repositories.ts` (which every `packages/api` test file does transitively via
`../src/application.js`) constructed live storage, crashing the entire suite with
supabase-js's generic `"supabaseUrl is required."` the moment `SUPABASE_URL` was absent
while `PARMANA_STORAGE=supabase` was still set (as it is in this checkout's `.env`),
confirmed directly: 22 files failed this way when `.env`'s Supabase lines were commented out
without also changing `PARMANA_STORAGE`. Fixed two ways:

- `createFromEnvironment()` now returns `MemoryStorageProvider` unconditionally when
  `NODE_ENV === "test"`, **regardless of `PARMANA_STORAGE`**, mirroring
  `createNonceStore`/`createCallerAuditSink` exactly. Outside test mode, behavior is
  unchanged except that `PARMANA_STORAGE=supabase` with no visible credentials now throws a
  Parmana-worded error naming both knobs (`PARMANA_STORAGE=supabase requires SUPABASE_URL
  and a Supabase key...`) before `SupabaseClientFactory.create()` would otherwise fail with
  its generic message.
- `repositories.ts` no longer constructs storage at module scope. The exported
  `businessTransactionRepository`/`executionTrustRecordRepository` bindings are now Proxies
  that defer the real `StorageFactory.createFromEnvironment()` call to first property
  access. The interface at every call site (`application.ts`, both integration tests that
  import these directly) is unchanged; only the timing of construction moved.

**Trade-off, accepted deliberately (same shape as Part 1's):** because the in-memory
override is unconditional under `NODE_ENV=test`, tests that set `PARMANA_STORAGE=supabase`
in their own `beforeAll` specifically to exercise real persistence through the shared
`packages/api/tests/test-app.ts` app singleton can no longer reach a live backend through
that singleton, full stop. `ALLOW_LIVE_SUPABASE=1` does not change this, since it is a
`resolveSupabaseGate` concern, not a `StorageFactory` one. Two concrete casualties,
confirmed directly:
- `packages/api/tests/unit/transactions-api.test.ts`'s three `it.skipIf(!supabaseConfigured)`
  persistence-shape cases still pass under a live opt-in run, but now silently exercise the
  in-memory path rather than real Supabase persistence; their gating on live credentials is,
  after this fix, no longer meaningful. Not changed this session; flagged here since nothing
  in the test output signals the silent downgrade.
- `packages/api/tests/integration/workflow-supabase.integration.test.ts`'s "round-trips an
  override through the Supabase repository and still verifies" case failed outright (not
  silently) under a live opt-in run, because it writes an override through its own
  directly-constructed `SupabaseStorageProvider` and then verified by calling
  `request(app).post("/verify")`, and `app`'s repositories, unlike the directly-constructed
  one, are now always in-memory under test, so the record it just wrote to real Supabase was
  never visible to that HTTP call → 404. Fixed in this session by verifying against the same
  directly-constructed `storage.trustRecords` instead, via a directly-instantiated
  `VerificationService` (`@parmana/runtime`), the exact class the real `/verify` route
  delegates to (`ExecutionTrustApplication.verify`), so this still exercises real production
  verification logic against the real repository; it no longer additionally proves the HTTP
  endpoint wires to it, which the file's first test ("executes a Business Transaction",
  unaffected, still routes end-to-end through `app`) already covers.

Verified:
- Unit: `packages/storage/tests/unit/storage-factory.test.ts` (5 tests: NODE_ENV=test forces
  in-memory regardless of `PARMANA_STORAGE`, with and without credentials present; the named
  misconfiguration error outside test mode; unaffected `supabase`/`memory` behavior outside
  test mode) and `packages/api/tests/unit/repositories.test.ts` (2 tests, using
  `vi.doMock`/`vi.resetModules`: importing the module performs zero calls to
  `StorageFactory.createFromEnvironment`; the first repository property access constructs
  exactly once, memoized across both exported repositories).
- (a) `npm test` with this checkout's live-credential `.env` as-is, no opt-in: 0 failed
  files, all 13 previously-gate-throwing suites now skip cleanly logging the new branch-2
  message (confirmed by grep: 13 occurrences, 0 remaining `"Refusing to run"` throws), plus
  the 1 pre-existing unrelated `execution-failure.integration.test.ts` skip, everything else
  green (`97 passed | 13 skipped (110)` files, `455 passed | 33 skipped (488)` tests).
- (b) `ALLOW_LIVE_SUPABASE=1` set for a single process invocation only (never written to
  `.env`), run twice consecutively: both runs identical, `109 passed | 1 skipped (110)`
  files, `487 passed | 1 skipped (488)` tests, 0 failures, restart-simulation test confirmed
  passing (not skipped) via an interleaved verbose run.
- (c) A single invocation with `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`
  set to empty strings for the process only (unsetting them outright doesn't work: `.env`'s
  real values would just backfill via `dotenv`'s `override:false`; an explicit empty string
  is what `override:false` actually respects), simulating a fresh clone without editing
  `.env`: all 13 gated suites skip via the unconfigured branch (verified via grep: their
  `[SKIP] ... not set` messages, not the branch-2 message), 0 failed files, nothing crashes
  at collection despite `.env`'s `PARMANA_STORAGE=supabase` still being set underneath;
  this is the direct proof Part 2 closes the collection-crash bug.
- `npm run lint` and `npm run build` both clean throughout.

**G-19. `POST /execute` returns HTTP 500 for an expected policy rejection, and neither the
rejection nor the approval response surfaces the policy's plain-language `reason`.** Found
2026-07-21 while building a parmanasystems.com live-proof widget route
(`packages/api/src/routes/public-demo.ts`, since removed 2026-07-21 along with the widget
it backed; see the frontend's own history for why) that worked around both issues by
calling `PolicyEngine.evaluate()` directly rather than relying on `/execute`'s response.
That workaround route is gone; this gap is not: it is a property of `/execute` and the
shared `runtime`/`shared` packages, entirely independent of the now-deleted route, and was
never fixed. Two distinct issues on the real, existing `/execute` route:
1. **Status code.** `ExecutionGate.enforce()` (`packages/runtime/src/ExecutionGate.ts:31-44`)
   throws a bare `RuntimeError` for a rejected `Decision`, which defaults to `status: 500`
   (`packages/runtime/src/errors/RuntimeError.ts:6-20`); every policy rejection currently
   reaches the caller looking identical to a server crash, even though
   `DecisionOutcome.REJECTED` is an ordinary, expected outcome of policy evaluation, not a
   fault.
2. **Missing reason field.** `Decision.reason` (`packages/shared/src/domain/decision.ts:52`)
   already carries the exact plain-language string from the matched policy rule
   (`policies/<name>/<version>/policy.json`'s `outcome.reason`) all the way through
   `DecisionBuilder.build()` (`packages/runtime/src/DecisionBuilder.ts:57-67`), and
   `ExecutionGate.enforce` does interpolate it into its thrown message
   (`packages/runtime/src/ExecutionGate.ts:38-42`), but `ExecutionTrustRecord`
   (`packages/shared/src/domain/execution-trust-record.ts`) has no `decision` field at all,
   so on the APPROVED path the reason is dropped entirely, and on the REJECTED path a caller
   only gets it as an unstructured substring of `error` inside the generic `RuntimeError`
   message (`"Execution rejected: <reason>"`), never a dedicated field.

Neither issue touches this codebase's core CLAIMS.md claims: fail-closed still holds,
nothing here weakens the signature or verification chain. But any real API consumer today
has no clean way to distinguish "policy said no" from "the server broke," and no structured
access to why. **Not fixed this pass**, flagged only, per explicit instruction to keep the
live-proof-widget work scoped and avoid touching the shared runtime/API packages.

---

### Decision record: audit-sink fail-closed

**Decided and implemented** in the audit-sink/G-1 hardening session that followed G-13
(directly resolves the open question G-13 left above): if a `CallerAuditSink.record()` write
fails, the request now fails closed. An action that executes without an audit record
contradicts Parmana's core claim of independently verifiable execution, so the availability
cost of rejecting the request is accepted, consistent with the `NonceStore`'s own
fail-closed wiring (G-13). This was a deliberate design decision, not a bug fix; it is
recorded here so the decision itself is discoverable in the gap tracker, not only in session
history.

Implementation: `packages/api/src/middleware/caller-auth.ts`'s `recordOrFailClosed` helper
wraps both `auditSink.record()` call sites (the `caller.rejected` path and the
`caller.authenticated` path). On failure, it logs a structured entry
(`{ event: "caller_audit_write_failed", route, error }`, distinguishable from other
failures) and passes a new `AuditUnavailableError`
(`packages/api/src/auth/AuditUnavailableError.ts`, extends `RuntimeError`: 503,
`AUDIT_UNAVAILABLE`) to `next()`, which `error-handler.ts`'s existing generic
`instanceof RuntimeError` branch maps with no changes to that file. The success path is
byte-for-byte unchanged. Deliberately no retry, buffering, or queueing: that would convert
fail-closed into eventually-audited, a materially different (and rejected) design; see
"Decisions left for the owner" in this session's closing report if a retry layer is ever
reconsidered.

Verified: 6 unit tests directly against the middleware
(`packages/api/tests/unit/middleware/caller-auth.test.ts`): both success paths unchanged
(valid credential reaches `next()` with no error, missing credential still gets its 401),
both failure paths reject with `AuditUnavailableError` (status 503, code
`AUDIT_UNAVAILABLE`) rather than a 401 or a silent pass-through, the structured log entry's
exact shape, and that the sink is called exactly once (no retry). Plus the pre-existing
`packages/api/tests/unit/supabase-caller-audit-sink.test.ts` (G-13 session), which already
proves `SupabaseCallerAuditSink` propagates storage errors rather than swallowing them,
required for this guard to be reachable at all in production wiring.

**G-29. Structural/admission-time rejections — malformed input, missing required fields,
and duplicate `businessTransactionId` — produce no audit record of any kind. RESOLVED
same-day (2026-08-24).** Found during a 2026-08-24 review of this repository's five
architectural trust-record gaps
(scoped alongside RFC-0021 Refusal Records, RFC-0022 signal-state verification, caller-to-
capability scoping, and the principal-denied audit trail — G-29 is the one of the five
that was genuinely still open). Two signed, durable audit mechanisms exist in this
codebase today: `RefusalRecord` (RFC-0021, `docs/CLAIMS.md` §3.11) for a policy `REJECT`,
and `CallerAuditSink` (`docs/CLAIMS.md` §2.16/§2.19/new §3.19) for a caller-identity
denial. Both fire only *after* a request has already passed structural validation and
reached `RuntimeEngine`/policy evaluation. A request that fails before that point is
invisible to both:

- **Duplicate `businessTransactionId`.** `BusinessTransactionService.accept()`
  (`packages/runtime/src/services/business-transaction-service.ts:36-44`) throws
  `DuplicateBusinessTransactionError`, mapped to `409` by
  `packages/api/src/middleware/error-handler.ts:106-114` (2.20's own atomicity guarantee).
  No `.record()` call, no `CallerAuditSink`, no `RefusalRecordRepository` write happens
  anywhere between the `throw` and the `409` response.
- **Field-level validation.** `BusinessTransactionValidator.validate()`
  (`packages/runtime/src/validators/BusinessTransactionValidator.ts:5-63`) throws
  `BusinessTransactionValidationError` for the trust-chain-consistency and
  required-field checks it performs (cross-field mismatches; missing `policy.name`,
  `policy.version`, `intent.action`), mapped to `400`
  (`error-handler.ts:80-90`). Same absence of any write.
- **Malformed / oversized request body.** Caught generically by `error-handler.ts:29-49`
  (`entity.parse.failed` → `400`, `entity.too.large` → `413`), before any route handler —
  and therefore before any audit sink — is ever reached.
- **`businessTransactionId` format check.** The UUID-shape regex in `execute.ts:20-29` /
  `transactions.ts:24-33` runs first of all, directly in the route handler, before the
  request body is even mapped into a `BusinessTransaction`; a `400` is returned
  (`execute.ts:57-62`) with no audit call.

No pre-`RuntimeEngine` audit layer exists to catch any of these: a repo-wide grep for a
generic structural/admission-time audit pattern returns zero hits, and
`packages/api/tests/unit/concurrent-duplicate-id-investigation.test.ts` — an existing test
that empirically proves the *correctness* of the 409-under-concurrency behavior 2.20/G-1
already established — asserts only on HTTP status codes and stored transaction content,
because there is no audit trail to assert on.

**Severity: pre-production, not blocks-pilot.** Unlike G-24, this is not an authorization
bypass — every one of these paths correctly rejects the request with the right HTTP
status, before any policy evaluation or execution occurs. What is missing is purely
forensic: an operator investigating a wave of malformed requests, ID-collision attempts,
or probing traffic against `/execute`/`/transactions` has no durable, queryable record of
them today, only whatever a caller's own logs or a reverse proxy's access log happened to
capture.

**RESOLVED, same-day (2026-08-24).** Closed exactly the way this entry's own original
"not yet fixed" note anticipated: a new `caller.structural_rejected` `CallerAuditEvent`
variant (`packages/api/src/auth/CallerAuditSink.ts`), reusing `CallerAuditSink` at all
four points, split into two disciplines matching where each rejection actually happens in
the pipeline (full detail and evidence in `docs/CLAIMS.md` §3.20, the promoted claim this
resolution backs):

- The UUID-format check and the two `application.execute()` errors
  (`BusinessTransactionValidationError`, `DuplicateBusinessTransactionError`) all run
  inside a route handler mounted *after* caller-auth middleware, so a caller identity is
  already known there (when caller-auth is enabled) — these reuse
  `recordCallerAuditEvent`'s existing **fail-closed** discipline (2.19) exactly, the same
  one `caller.capability_denied`/`caller.principal_denied` already use.
- Malformed/oversized body is rejected by `express.json()` itself, *before* caller-auth
  middleware — or any route handler — ever runs; there is no caller identity to protect
  the accountability of at that point. This one path is deliberately **fail-open**
  instead, mirroring `RefusalRecord`'s own reasoning (§3.11's first scope caveat) rather
  than 2.19's — the request is already correctly rejected either way, and a storage hiccup
  should not turn a correct `400`/`413` into an opaque `500` for a case with no caller
  identity to protect in the first place. `createErrorHandler(auditSink?)` (replacing the
  former plain `errorHandler` export) threads the sink into `error-handler.ts` for this
  one branch only.

**Verified:** `packages/api/tests/integration/structural-validation-audit.integration.test.ts`
(new, 9 tests, real HTTP requests against the production `createApp` composition): all
four rejection points audited with the correct `reason`/`businessTransactionId`/`callerId`
shape (absent fields verified absent, not merely unchecked); the valid path records
nothing; caller-auth disabled still returns the correct status with no audit sink to write
to. `packages/api/tests/unit/supabase-caller-audit-sink.test.ts` extended (2 new cases) for
the new `business_transaction_id` column. Full repo `npx tsc -b`, `npx eslint . --ext .ts`,
and `npm test` all clean: 1243 passed (was 1234 before this session), 37 pre-existing
skips (unchanged), 0 failed — the pre-existing 8 failing tests observed at the start of
this session (`PARMANA_POLICY_DIR` in this checkout's local `.env` pointing at a
non-existent directory, an environment misconfiguration unrelated to this fix) were also
corrected as a prerequisite to getting a clean baseline, not silently left failing.

### cosmetic

**G-10. CLAIMS.md citations that are vague or indirect** rather than pointing at a specific
test:
- **2.7 Replay Support** cites only "Replay package" and "G-08", no test file named, even
  though `packages/replay/tests/unit/replay-engine.test.ts` and
  `packages/replay/tests/replay.integration.test.ts` (6 files, 9 tests total) are real and
  always-run.
- **2.9 Independent Envelope Verification** cites `packages/envelope-verifier/README.md`
  ("Claims" section), a documentation file, not a test.
- **3.2 Fleet-Wide Single-Use** cites the same README pattern.
- **2.1, 2.2, 2.3, 2.4** cite class names only (`BusinessTransactionValidator`,
  `PolicyRouter`, `PolicyValidator`) with no test file named, and, checked directly this
  pass, **`BusinessTransactionValidator` and `PolicyRouter` have no dedicated test file
  anywhere in the repo**, only indirect coverage through other tests
  (`ReferencePolicies.test.ts`, `ReferencePoliciesEvaluation.test.ts` for
  `PolicyValidator`; nothing dedicated for the other two).

None of these claims are false; the underlying capability is real, verified by tests
elsewhere in the suite. But a reader following CLAIMS.md's own citation cannot find the
proof without independently searching for it, which is the exact failure mode CLAIMS.md's
discipline exists to prevent.

**G-11. PARTIALLY CLOSED in the 2026-07-17 session.** `EXECUTION_AUTHORIZATION_TTL_SECONDS`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `CRYPTO_MODE`,
`RECEIPT_VERSION`, and `DATABASE_URL` are read by `packages/shared/src/config/Config.ts`.
The new root `.env.example` now documents every environment variable confirmed (by grep)
to be read anywhere in `packages/*/src`, including all of these, with `CRYPTO_MODE`
annotated as dead per G-4. What remains open: the public docs site
(`guides/deploy-patterns.mdx`, `deployment/local.mdx`, `cryptography/overview.mdx`) still
does not mention them. `.env.example` is a better source of truth than doc prose (it
can't drift as invisibly), but the site itself was not updated this session.

---

## Decision required (options, not fixes)

### D-1. Duplicate Business Transaction race (G-1)

**Option A: fix the race.** Add a real uniqueness guard to
`MemoryBusinessTransactionRepository.create()` (e.g. `Map.has` check inside the same
synchronous tick as `Map.set`, throwing `DuplicateBusinessTransactionError` itself instead
of relying on the service-layer check) and add an explicit "insert if absent" contract to
the `BusinessTransactionRepository` interface so `SupabaseBusinessTransactionRepository`
can be reviewed against the same contract (its own version is protected today only by the
Postgres `PRIMARY KEY` constraint, which would currently surface as a raw, unstructured
Postgres error rather than the clean 409 the sequential path gives, a related but distinct
inconsistency worth fixing in the same pass). *Estimated size: small, a few hours,
`MemoryBusinessTransactionRepository.create()` is nine lines; the Supabase-side error
mapping needs a `catch` for the Postgres unique-violation error code and a rethrow as
`DuplicateBusinessTransactionError`. Test: the exact `Promise.all` scenario already used
to confirm the bug, now asserting one success and one clean rejection.*

**Option B: document the limitation.** State plainly on `reference/storage.mdx` and
`guides/deploy-patterns.mdx` that `memory` storage is not safe under concurrent duplicate
submissions of the same `businessTransactionId` and is not intended for anything beyond
local development, matching its existing framing everywhere else on the site. *Estimated
size: trivial, a docs paragraph, no code change. Leaves the underlying bug in place for
anyone who does run `memory` storage under real concurrent load, including any pilot that
starts on `memory` before migrating to Supabase.*

I lean toward Option A being cheap enough that Option B alone under-serves anyone actually
running a pilot on `memory` storage under load, but this is a real design/priority call.

**Status: RESOLVED. Option A implemented as written above**, in the audit-sink/G-1
hardening session that followed the G-13 session. See G-1's own entry above for what
changed and how it's verified. One point the estimate above didn't anticipate:
`DuplicateBusinessTransactionError` had to move from `@parmana/runtime` to `@parmana/shared`
to avoid a circular package dependency; also documented in G-1's entry.

### D-2. Hybrid/PQ dead configuration (G-4)

**Status: PARTIALLY RESOLVED, Option A implemented for two of the three originally-listed
call sites.** See G-4's own entry above for what changed. `VerificationCrypto` (Trust
Records) and `ReceiptCrypto` (Receipts) now branch on `config.crypto.mode` and call
`CryptoBootstrap.createHybrid()`; the additive `signatures`/`schemaVersion` schema change
D-2 originally flagged as "the real complexity, not the `CryptoBootstrap` call itself" is
built (`SignatureEntry`, `packages/shared/src/domain/signature-entry.ts`), with the
existing single `Signature` field left untouched rather than replaced, closing exactly the
schema-design question this entry called out as unresolved. The Supabase schema question
this entry raised does not apply to these two surfaces: neither `execution_trust_records`
nor `receipts` needed a new column, since `signatures`/`schemaVersion` ride inside the
existing JSON-shaped record/receipt columns.

**What Option A has not touched, and D-1's original estimate did not have to consider
piecemeal:** `RuntimeAuthorizationSigner`, gateway attestation signing, and
`createConnectorRegistry.ts`'s connector-signing call sites remain exactly as this entry
originally found them — single-provider, `CryptoBootstrap.create()` only. Extending Option
A to these is a separate decision, deliberately deferred (see the Hybrid Signature Support
milestone's own scope: "Refusal Records and audit-event signing get hybrid signing in a
fast-follow milestone, not this one"), not a rejection of Option A for them. **Option B
(remove `CRYPTO_MODE` entirely, document as single-provider by design) is no longer live**
for the codebase as a whole — the config is not dead anymore, just narrower in scope than
"everything this process signs" — though it would still be a coherent choice to describe
the *remaining* unwired surfaces as single-provider-by-design rather than extend Option A
to them.

**CLAIMS.md status:** now updated (3.13), capability-scoped only — it does not claim
hybrid-in-production, since it isn't (opt-in, not default; `@parmana/sign` doesn't cover
the new envelope shape yet, both stated explicitly in 3.13's own text). D-2's original note
that Option A "needs its own design decision" and touches CLAIMS.md is now fully resolved:
the design decision was made and implemented, and the claim was written scoped to exactly
that.

### D-3. `OverrideService` unreachable and untested (G-5)

**Option A: wire it in.** Add a `POST /overrides` (or similar) route calling
`OverrideService`, and a test suite proving its actual business rules (duplicate-override
rejection, missing-transaction/missing-trust-record errors), replacing the storage-layer
bypass test with a real one. *Estimated size: small-to-medium, the service already exists
and is presumably complete; this is mostly route wiring plus tests, roughly a day.*

**Option B: remove it, or explicitly mark it `[FUTURE]`.** If overrides aren't meant to be
externally triggerable yet, delete the unused service (it's dead code by the same
definition applied elsewhere in this audit) or add a CLAIMS.md `[FUTURE]` entry and a
`reference/runtime.mdx` note that override application is a domain concept modeled in code
but not yet exposed. *Estimated size: trivial either way.*

---

## Top 5 to close first, if a bank's security team were reviewing next week

1. **G-1, duplicate-transaction race: RESOLVED.** Option A implemented as written: atomic
   `Map.has`/`Map.set` in the same tick for the in-memory repository, `23505` mapping for
   the Supabase repository, both throwing the same `DuplicateBusinessTransactionError`
   (relocated to `@parmana/shared` to avoid a circular dependency; see G-1's own entry).
2. **G-3, live credentials used silently by default: RESOLVED.** The "silently" half is
   fixed: an `ALLOW_LIVE_SUPABASE=1` opt-in is now required, hard-failing with a named
   error otherwise. The cleanup half remains: no test deletes the real rows it writes once
   opted in. *Remaining work: a cleanup step (or a dedicated, disposable test project) so
   an opted-in `npm test` stops leaving permanent rows in a real database, a day, mostly
   cleanup-hook work across 10 test files.*
3. **G-2, no CI: CLOSED 2026-07-17.** `.github/workflows/ci.yml` now runs the full suite
   on every push and PR. Supabase-gated tests are excluded there (no project secrets
   configured in CI) and rely on local runs; the decision this note flagged as worth
   making explicitly was made explicitly: local-only for now, revisit if fleet-wide
   Supabase coverage in CI becomes a priority.
4. **G-4, hybrid/PQ dead config: PARTIALLY RESOLVED.** Option A is now implemented for
   Trust Records and Receipts (Hybrid Signature Support, Phase A) — the config is no
   longer dead, just narrower in scope than every signing surface. Remaining: execution
   authorization signing, gateway attestation, and connector signing are still
   single-provider-only, unaffected by `CRYPTO_MODE`. *Extending Option A to those, if
   wanted, is the remaining project; not urgent, since nothing currently misleads a
   deployer into thinking they're covered by hybrid mode when they aren't (G-4's own
   "still exactly as originally found" paragraph names them explicitly).*
5. **G-5, OverrideService unreachable** (Option A or B, either closes the ambiguity): right
   now it's neither a documented `[FUTURE]` capability nor a tested, reachable one, which is
   the actual gap, not the specific choice between exposing or removing it. *A day for either
   option.*

---

## How to reproduce this audit

```bash
npm test                    # baseline: 345 passed, 1 skipped
npm run coverage             # per-file coverage, v8
grep -rn "\.skip(\|\.skipIf(\|\.todo(" packages/*/tests packages/*/test --include="*.test.ts"
```

Every finding above traces to a specific `file:line` cited inline; none are inferred from
summaries or file names alone.

---

## Legacy documentation tree terminology sweep, closed 2026-07-17

Previously deferred (see prior revision of this document): `docs/00-introduction`,
`docs/rfcs`, `GOVERNANCE.md`, `docs/01-concepts` through `docs/03-api`, `docs/adr`, and
`typescript/docs/06_autonomous_vehicle.md` through `typescript/docs/09_multi_agent.md`
predate the Mintlify site (`docs/site`) and were left untouched during an earlier
terminology sweep that updated `docs/site`, `README.md`, `packages/connector-sdk/
package.json`, and the affected tutorial READMEs.

The 2026-07-17 audit closeout session swept the remainder: `GOVERNANCE.md`,
`docs/00-introduction/PROBLEM.md`, `docs/rfcs/RFC-0012-Phase-1-Architecture-Completion.md`,
`typescript/docs/06_autonomous_vehicle.md` through `09_multi_agent.md`,
`docs/architecture/EXECUTION-FLOW-AUDIT.md`, `docs/architecture/KEY-MANAGEMENT.md`, and
`docs/specifications/reference-policies.md`. A fresh repo-wide grep confirms
`docs/01-concepts` through `docs/03-api` and `docs/adr` never actually contained the
retired term (zero matches); nothing to sweep there. See "Gaps closed in the 2026-07-17
audit closeout session" above (item 19) for the two files intentionally left unswept (an
external citation that is itself correctly named "Execution Governance") and the CI guard
now in place against regression.
