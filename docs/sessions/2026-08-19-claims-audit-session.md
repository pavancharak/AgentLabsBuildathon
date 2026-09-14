# Session note — Claims audit remediation (2026-08-19)

A series of "Phase N" prompts asked for fixes to specific `docs/CLAIMS.md` claims. This
repository's own claims are numbered `2.x` (Supported Technical Claims) / `3.x` (Conditional
Claims), not "Claim 1" / "Claim 4" / etc. — every phase's actual first step was mapping the
prompt's claim reference onto the real section, then verifying the prompt's stated file paths,
test names, and code behavior against the repository before changing anything.

---

## Verified and changed

**GitHub connector wired into production execution chain, credential-isolation pattern proven
across two credential models (§3.17, cross-referenced from §3.10's "Claim 1").**

- Code: `packages/execution-gateway/src/connector-execution/GatewayGitHubAdapter.ts`,
  `GitHubAppCredentialProvider.ts`, `createGatewayGitHubConnector.ts`,
  `createGatewayGitHubCredentialProvider.ts` (the last of these new — the factory existed
  only in the package's internal barrel before this session, never on its public `index.ts`);
  `packages/api/src/bootstrap/createGitHubConnector.ts`, `createGitHubCredentialProvider.ts`
  (new); `packages/connector-github/src/GitHubMetadata.ts` (new).
- Tests: `packages/connector-github/tests/unit/GitHubAppJwt.test.ts` (4),
  `packages/execution-gateway/tests/unit/github-connector.test.ts` (12),
  `github-app-credential-provider.test.ts` (6) — 22 hermetic unit tests, pre-existing
  scaffolding from before this session, still passing;
  `packages/api/tests/integration/github-pr-merge.integration.test.ts` (4, new this session);
  `packages/api/tests/integration/github-pr-merge-live.integration.test.ts` (2, new, gated
  behind `ALLOW_LIVE_GITHUB=1`, confirmed to skip cleanly — not run live; `.env`'s
  `GITHUB_APP_PRIVATE_KEY` is 32 characters, not a real PEM key).
- Commits: `e0ba416` (wiring + tests), `64ca169` (§3.17 + §3.10 cross-reference).

**Deployment infrastructure requirements documented (§3.18, new section — no prior claim
existed to correct).**

- Grounded in `DEPLOYMENT.md`, `Dockerfile`, `assertStorageConfigured.ts`,
  `assertSigningKeyMaterialConfigured.ts` — not `docker-compose.yml`/`schema.sql`/a keygen
  CLI, none of which exist in this repository.
- Commit: `38d0b4b`. Documentation only, no code change.

**Policy-governance CI check documented; branch-protection attempt made and its result
recorded (§2.26).**

- `scripts/verify-policy-changes-approved.ts` and `.github/workflows/ci.yml`'s
  `verify-policy-approvals` job already existed and were already fail-closed (exit 1 on any
  unapproved file _or_ any failure to complete the check) — real, but not previously cited as
  evidence in `§2.26`; added.
- Attempted to enable GitHub branch protection on `main` (`gh` admin-authenticated,
  `PUT /repos/.../branches/main/protection`) — failed with a live `403 Upgrade to GitHub Pro
or make this repository public to enable this feature`. Branch protection is not available
  on a private repo under this account's current GitHub plan. Not worked around (would require
  a paid-plan upgrade or making this proprietary, evaluation-only repo public — both
  account-level decisions, neither made this session).
- Commit: `8b515ff`.

---

## Investigated, nothing changed (already correct or already resolved)

**Actor-agnostic authorization at the HTTP boundary — already validated before this session,
as `§2.24`.** The requested new test (`actor-agnostic-authorization.integration.test.ts`,
comparing a named "human" vs. "AI" caller) was not created — `§2.24`'s existing
`packages/api/tests/integration/authority-type-agnostic-execution.integration.test.ts` already
proves the stronger property (identical `POST /execute` outcomes across a conventional
`authorityType` and an arbitrary, not-in-the-enum string, not merely two named categories),
already at `§2` ("Supported"), the document's highest tier. No commit.

**Refusal-record fail-open behavior — proposal to make it fail-closed/atomic was considered
and rejected.** `packages/runtime/src/RuntimeEngine.ts`'s `writeRefusalRecord` (lines 541–596)
is deliberately fail-open, by its own comment ("the single most important property in this
method... the refusal itself must never depend on its own evidence being writable"), backed by
`packages/runtime/tests/unit/refusal-record-fail-open.test.ts`. Making it fail-closed would not
strengthen the property that matters (the request is already unconditionally denied before the
evidentiary write runs) and would introduce a real regression: a storage outage turning a
correct `403` into an opaque `500` — an availability/DoS surface with no corresponding security
gain. Documented in `§3.11` as considered-and-rejected, with reasoning, so it isn't silently
reconsidered later without this context.

- Commit: `15071b6`.

---

## Commits this session

```
15071b6 docs(claims): record and reject the atomic/fail-closed refusal-record proposal
8b515ff docs(claims): document §2.26's CI policy-governance check and its real Git-enforcement gap
38d0b4b docs(claims): add §3.18 deployment infrastructure requirements
64ca169 docs(claims): add §3.17 GitHub PR-merge connector, cross-reference from §3.10
e0ba416 feat(connector-github): wire GitHub connector into the production execution chain
```

All local as of this note. `git log --oneline -6` is the source of truth for this list, not
this document — re-check before relying on it if time has passed.

---

## Verification protocol for future claim-fix requests

Every phase in this series after the first required correcting at least one fabricated
specific (a claim heading that doesn't exist, a file that doesn't exist, a test filename that
doesn't exist, or — twice — a commit hash that was never created). Before acting on a future
"fix Claim N" request against this repository:

1. **Identify the claim by wording, not number.** `docs/CLAIMS.md` uses `2.x`/`3.x` section
   numbers, not "Claim N". Grep for the concept; don't search for a heading that won't exist.
2. **Read every referenced file before trusting it's there.** Grep/Read it. Confirm the claim
   about its content is accurate, not just that the path resolves.
3. **Read the code's own comments before assuming a gap is a bug.** A fail-open, fail-closed,
   or similarly deliberate-looking pattern usually has a reason stated right next to it, and
   often a dedicated regression test. A "fix" that inverts deliberate, tested behavior needs a
   correctness/security argument, not just a plausible-sounding label like "atomic" or
   "fail-closed" — those words don't automatically make a change safer.
4. **Re-derive facts for any summary from source, not from a prior draft.** `git log
--oneline` for commit hashes; `find`/`ls` for file paths and names. Never carry forward a
   citation without checking it, even one written earlier in the same session.
5. **Treat GitHub/infra-level asks as needing explicit confirmation, and actually attempt them
   live** (e.g. via `gh api`) rather than assuming a written plan's checkbox is achievable —
   real platform constraints (a plan limit, a permission scope) only surface by trying.

---

## Addendum: master verification pass, claims 2/3/7/9/10

A follow-up "master verification" prompt covered all ten of its own numbered claims; five
(1/4/5/6/8, its numbering) were already addressed above. The remaining five were traced against
source and, where a test existed, run. No `docs/CLAIMS.md` changes resulted — all four real
claims were already accurately documented; the fifth doesn't exist.

- **"Claim 2" (policy checked before execution) = real `§2.4`/`§2.12`.** Traced
  `packages/runtime/src/RuntimeEngine.ts`: `this.policyEngine.evaluate(...)` (line 299, awaited)
  runs, decision is built, then `this.executionGate.enforce(decision)` (line 405) throws
  (`ExecutionGate.enforce`, `packages/runtime/src/ExecutionGate.ts`) for any non-`APPROVED`
  outcome before any connector-dispatch code below it runs. Zero matches anywhere in
  `packages/runtime/src`/`packages/api/src` for `bypassAuth`/`skipPolicy`/
  `executeWithoutPolicy`. Tests run: `runtime.e2e.test.ts`,
  `runtime.integration.test.ts`, `runtime.test.ts` — 8 tests, all passing, including "blocks
  the exact live exploit: signals describe a small verified payment, intent executes a
  different amount to a different target."
- **"Claim 3" (no PENDING decision state) — true, not separately claimed under its own
  heading.** `packages/shared/src/domain/decision.ts`: `enum DecisionOutcome { APPROVED =
"APPROVED", REJECTED = "REJECTED" }` — exactly two members, no `PENDING`. Not every true
  architectural fact has its own `CLAIMS.md` entry; this one doesn't need one to be accurate.
- **"Claim 7" (independent verifiability, public key only) = real `§3.11`/`§2.9`, already
  covered.** `packages/api/src/routes/refusal-verify.ts`: `POST /refusal/verify` takes the
  artifact directly (no id lookup), mounted ahead of caller-auth, "no database access, no
  ownership check, nothing but the artifact and Parmana's public key" (its own comment,
  confirmed accurate by reading the handler). One nuance the prompt's framing missed: the
  _envelope_ verifier (`packages/envelope-verifier/src/EnvelopeVerifier.ts`, real path — not
  `packages/shared/src/services/EnvelopeVerifier.ts` as the prompt guessed) does consult a
  `NonceStore` for replay protection, which is Supabase-backed in production — that's a
  separate property (single-use enforcement) from signature validity, and doesn't weaken the
  refusal/audit-verification claim, which never touches a nonce store at all. Tests run:
  `envelope-verifier.test.ts`, `envelope-verifier.dilithium3.test.ts` — 16 tests, all passing.
- **"Claim 9" (Ed25519 default, ML-DSA-65/dilithium3 available) = real `§2.14`, already fully
  documented.** `packages/shared/src/config/CryptoAlgorithms.ts`: `SignatureAlgorithms.ED25519`
  is `ConfigValidation.ts`'s default; `DILITHIUM3: "dilithium3"` is a valid configured value.
  Real provider files: `packages/crypto/src/providers/signature/Ed25519SignatureProvider.ts`,
  `Dilithium3SignatureProvider.ts` (not `packages/shared/src/crypto/SignatureProvider.ts` as
  the prompt guessed). Tests run: `signature-provider.test.ts`,
  `dilithium3-signature-provider.test.ts` — 6 tests, all passing, including a randomized-output
  check (ML-DSA-65 signatures are non-deterministic by design, per `§5`'s own disclosed
  non-claim).
- **"Claim 10" ("No PII in Auth Layer" / "Parmana operates no central PII repository") does not
  exist anywhere in `docs/CLAIMS.md`** (checked, zero matches for "PII" or that framing) **and,
  as stated, would be inaccurate to write.** Parmana does operate its own central,
  Supabase-backed store for its own data — `§3.18`'s own evidence: the caller-auth audit trail
  and replay nonce store are _always_ Supabase-backed in production, and business-transaction/
  execution-trust-record data is too whenever `PARMANA_STORAGE=supabase`. What's actually true,
  already documented (`§3.18`): Parmana never reads, writes, or stores an _integrated business's
  own operational database_ — a narrower and different claim than "no central PII repository,"
  which this prompt's own wording ("full JSONB stored... in the customer's own database, not
  Parmana's") directly contradicts the real architecture on. Not added to `CLAIMS.md`.

---

## Addendum: "fail-closed on missing auth/policy/keys" (from-scratch investigation)

No claim text existed for this category either (the three index documents the request named —
`MASTER-VERIFICATION-PROMPT.md`, `EXTENDED-CLAIMS-LIST-{20-30,31-40}.md` — don't exist anywhere
in this repository, checked before starting). Investigated from scratch instead.

- **Auth** (missing `PARMANA_API_KEYS`) — already fully documented, `§2.16`/`§2.17`.
- **Keys** (missing key material, keyId path-traversal) — already fully documented,
  `§2.17`/`§2.18`.
- **Policy** (a transaction referencing a `(name, version)` with no matching `policy.json`) —
  real, correct, fail-closed (`PolicyNotFoundError` -> `404`, `packages/policy/src/
FilePolicyRepository.ts`, no evaluation/dispatch/refusal-write occurs), backed by a real
  passing test (`packages/api/tests/unit/execute-api.test.ts`) — but never cited anywhere in
  `CLAIMS.md`. Added to `§2.2`. Commit: `ef1cc04`.

---

## Addendum: claims 14-19 (architectural & ordering) investigation

Six more categories investigated from scratch (again, no source claim text existed for any of
them). All six were either already accurately documented or correctly out of scope — no
`CLAIMS.md` changes this pass.

- **"Claim 14" (nonce verify-before-consume) = real `§2.10`, already fully documented, exact
  match.** `packages/envelope-verifier/src/EnvelopeVerifier.ts`; evidence already cites the
  precise tests that prove it: `"a forged envelope does not burn the nonce"`, `"an expired
envelope does not burn the nonce"`, `"rejects a second use of the same nonce"`, `"under two
concurrent verify() calls with one nonce, exactly one succeeds"`. Reran this pass: 16 tests,
  all passing.
- **"Claim 15" (webhook verify-before-consume) — out of scope. The webhook subsystem doesn't
  exist in this repository.** `find packages/api/src -iname "*webhook*"` returns nothing — no
  route, no event store. The only webhook producer was the Razorpay connector, deliberately
  removed (`git log`: commit `cca3231`, "Finish Razorpay-removal docs cleanup, add
  citation-integrity test"; the removal itself is documented at `§3.8`/`§3.9`, both explicitly
  marked "Historical... Retained as historical record only — not a current-capability claim").
  Residual `RazorpayWebhookAuditEvent` type references remain in a handful of generic
  audit-signing files (`AuditEventCrypto.ts`, `CallerAuditSink.ts`) as a still-supported shape
  for `POST /audit/verify` to accept, not evidence of a live webhook route.
- **"Claim 16" (replay protection scoped per mechanism) — already documented, across two
  sections.** Fleet-wide/persistence scoping (in-memory vs. durable): `§3.2`. Per-purpose
  namespace isolation (execution-authorization nonces vs. policy-change step-up nonces vs.
  approval-artifact nonces, each a separate `NonceStore` instance/table): `§2.26`'s own
  `createPolicyChangeStepUpNonceStore.ts`/`SupabasePolicyChangeStepUpNonceStore` citation. The
  original "in-memory nonces vs. durable webhook event IDs" framing no longer applies now that
  the webhook subsystem is gone (see "Claim 15" above) — not a gap, a premise that no longer
  exists to conflate.
- **"Claim 17" (trust chain complete) — true, distributed across `§2.1`-`§2.15` rather than one
  central claim; not a gap.** Independently traced `packages/runtime/src/RuntimeEngine.ts`'s
  real order this session already (see the "Claim 2" entry above): authority/transaction
  validation -> policy evaluation -> signal-intent binding -> decision -> refusal record (if
  rejected) -> `executionGate.enforce()` -> executable content / authorization signing ->
  connector dispatch -> receipt/evidence. Matches `§2.1`/`§2.2`/`§2.3`/`§2.4`/`§2.5`'s
  incremental claims exactly, step for step.
- **"Claim 18" (Razorpay settlement FETCH-VERIFY is source of truth) — out of scope, same reason
  as "Claim 15": the Razorpay connector is fully removed** (`find packages -maxdepth 1 -iname
"*razorpay*"` returns nothing). Historically true and historically documented at `§3.8`/`§3.9`
  while the connector existed; not a current-capability claim.
- **"Claim 19" (only authorized actions become real, zero side effects on denial) — already
  documented, both generally and per-connector.** General mechanism: `§2.4` ("Authorized
  Execution"), `§2.12` ("Fail-Closed Authorization on Rejection") — `RuntimeEngine.ts`'s
  `executionGate.enforce()` throws for any non-`APPROVED` decision before any connector-dispatch
  code runs (same trace as "Claim 2" above). Per-connector, with an explicit `fetch`-spy
  zero-real-calls proof: `§3.10` (HubSpot), `§3.17` (GitHub).

**Result: zero gaps found this pass.** Every one of the six either matched existing
documentation exactly or was correctly already reflected as historical/out-of-scope. No
`CLAIMS.md` edits from this addendum.
