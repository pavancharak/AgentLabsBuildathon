# 04 — INCIDENTS & DEFECTS LOG

_Security incidents and latent defects discovered during Sessions 1–8, with resolutions._
_Snapshot: July 5, 2026. INC-6 and INC-7 added 2026-08-03, from later sessions this log had
not been updated to reflect — this document's own gap, not a new incident; see RFC-0022
(docs/rfcs/RFC-0022-Challenge-Record.md) for the durable, structured record type going
forward. INC-8 added 2026-08-09, for an incident that itself dates from the ML-DSA-65
signature provider work (same gap pattern this note already describes); independently
re-verified against the actual current state of both remotes as part of adding it, not
transcribed from a prior report on faith._

The pattern worth noting: three of the five arrived from work done **outside the
review loop**, and the test suite (or a review stop-gate) caught each. The recurring
lesson — _full suite green before every commit, whoever produced the change_ — is now a
standing rule.

---

## INC-1 — Exposed signing private key (SECURITY, highest severity)

**What:** `keys/default.private.pem` was committed and pushed to the public GitHub repo.
Confirmed downloadable by anonymous clone.

**Impact:** anyone could mint valid signatures. Every signature by that key carried zero
authenticity guarantee while in use.

**Resolution:** treated as permanently compromised. `git rm --cached` + root `.gitignore`
(`keys/`, `*.pem`), rotated to a fresh Ed25519 pair via the hardened keygen script, full
suite re-verified green with the new key, compromise notice added to `docs/CLAIMS.md`.

**Still open:** history purge (`git filter-repo --path-glob '*.pem'` + force-push) and
archiving the sibling `pavancharak/parmana` repo, which has the same exposure.

**Silver lining:** with zero external users, practical damage was nil — the cheapest this
incident could ever be. It is now the lead argument for prioritizing KMS custody (a key
that never leaves the HSM cannot be committed to a repo).

---

## INC-2 — Fake permit hash, released under a version tag (INTEGRITY)

**What:** commit `39c89e9`, tagged `v1.1.0-execution-permit`, added an "execution permit"
whose `transactionHash` was `Buffer.from(canonical).toString("base64")` — the entire
content, reversibly encoded, labeled `"sha256"`, with `createHash` never called. Shipped
with empty stub files, an empty class exported from the public API, and a "tutorial 14"
that was a verbatim copy of tutorial 13.

**Impact:** a counterfeit security primitive on `main`, tagged as a release, that _looked_
like content binding but bound nothing.

**Resolution:** reverted file-by-file with proof, and replaced with the real gateway
(Session 8) — genuine single-sourced canonical hashing.

**Still open:** delete or re-point the `v1.1.0-execution-permit` tag on the remote.

---

## INC-3 — Ephemeral Dilithium3 keys (CRYPTO)

**What:** `Dilithium3SignatureProvider` called `ml_dsa65.keygen()` in its constructor —
a fresh throwaway keypair per instantiation — while its doc comment claimed persistent
keys. Nothing it signed could be verified by any other instance.

**Impact:** with `dilithium3` selected, the entire trust model would silently break —
different ephemeral key per signer, verification impossible across instances/restarts.

**Resolution:** rewritten on native Node 24 `ml-dsa-65` with caller-supplied persistent
PEM keys; cross-instance verification test added; key/algorithm binding guards added to
both providers.

---

## INC-4 — TypeScript bivariance hole (TYPE SAFETY)

**What:** the broken Dilithium3 provider (INC-3) type-checked cleanly despite its methods
having the wrong arity, because TypeScript's parameter bivariance let a
`sign(data)`/`verify(data, sig)` satisfy the `sign(data, key)`/`verify(data, sig, key)`
interface — silently discarding the caller-supplied key.

**Impact:** explains how a broken crypto component sat undetected: the compiler never had
a chance to flag it, and it had zero tests.

**Resolution:** provider rewritten to the correct interface; 20 real crypto tests added
where there had been zero.

---

## INC-5 — `df5d060` return-contract break (REGRESSION)

**What:** a commit changed `Runtime.execute()`'s return shape from the trust record
directly to a `{transaction, context, trustRecord}` wrapper, without updating consumers.

**Impact:** 9 consumers silently broke — 2 tests plus 6 public tutorials and 3 scenario
scripts, several printing the wrong object or crashing. No test noticed, because example
scripts aren't in the suite.

**Resolution:** all consumers updated to the wrapper contract (a one-line destructuring
each); confirmed no externally visible HTTP-API change (routes go through
`ExecutionTrustApplication`, which re-fetches from storage).

**Follow-up on the list:** a CI smoke-run of the example runners, so a contract change
can never again silently break the public-facing walkthroughs.

---

## INC-6 — Signal/Intent binding gap: policy evaluated caller-declared signals never bound to the executed Intent (SECURITY, highest severity)

**What:** `BusinessTransactionMapper.fromRequest` took `policy` and `signals` verbatim from
the client request body, and `PolicyEngine.evaluate` decided APPROVED/REJECTED against
exactly those caller-declared signals. `ExecutableContent` — what `ExecutionGateway`
actually signs and executes — was built from `intent.action`/`intent.target`/
`intent.parameters`, a completely disjoint set of fields. Nothing cross-checked that the
two described the same real-world action. Found via an external adversarial security
exercise, not this project's own internal audit process.

**Impact:** live, reproducible bypass of the core "no unauthorized execution" invariant.
Proof-of-concept: `signals` declared a fully verified, policy-approved $5,000 payment to a
known vendor while `intent` targeted an attacker-controlled account for $999,999,999 —
before the fix, `200`, `APPROVED`, `COMPLETED`, with a real signed Execution Trust Record
and receipt issued for it. A compounding finding from the same session: any caller holding
any valid API key could claim to be any human or role in `authority.principalId`
("impersonate the CEO"), and any authenticated caller could read any other caller's
complete transaction/trust-record/receipt history (IDOR).

**Resolution:** `Policy.boundSignals` (an opt-in signal-key → intent-dot-path map) plus
`SignalIntentBinder`, run immediately before `PolicyEngine.evaluate` over the exact signals
and intent about to be used — a mismatch becomes an ordinary policy REJECT, so no
authorization is ever generated for it. `isPrincipalAllowed` gates `authority.principalId`
against the caller's own grant; `metadata.submittedBy` is now stamped server-side, never
client-supplied; `isOwnedByCaller` scopes every read route. A related path-traversal bug in
`FilePolicyRepository.load` (same unvalidated-input class as an earlier `FileKeyProvider`
finding) was fixed alongside these since it was already well-scoped. Full detail, PoC
figures, and the residual (unbound signals remain caller-declared attestations, not yet
independently re-verified) are in `docs/VERIFICATION-GAPS.md` G-24.

**Verified:** 28 new tests reproducing the exact live exploit shapes (signal/intent
mismatch, principal spoofing, path traversal, cross-caller read), plus positive controls
for legitimate requests; the exploit sequence was re-run via real HTTP against a fresh,
isolated clone with the fix applied and confirmed blocked in every case.

**Update (2026-08-04):** the residual named above ("unbound signals remain caller-declared
attestations, not yet independently re-verified") is now closed for both `razorpay-refund`
and `hubspot-deal-update`, via a new, additive `SignalStateVerifier` port (one capability-
scoped implementation each, combined via `CompositeSignalStateVerifier`) that independently
re-fetches real vendor state before a caller-declared APPROVE is trusted, proven by a
failing-then-passing regression test for each. `vendor-payment` was investigated per-fact and
confirmed genuinely blocked, not merely unattempted: none of its five unbound facts
(`vendorVerified`, `invoiceVerified`, `paymentApproved`, `sufficientFunds`, `riskScore`) has a
real, fetchable source anywhere in this codebase -- every candidate connector (vendor-payment,
SAP, Oracle, Workday) is a write-only, in-memory `MockConnector` explicitly documented as a
placeholder, not a production-capable integration the way Razorpay's and HubSpot's connectors
already are. No code was changed for `vendor-payment`. Separately, the daily-cumulative-cap
ledger TOCTOU race flagged alongside the razorpay-refund residual is also now closed: an
optimistic-concurrency guard (`RazorpayCumulativeRefundLedger
.recordApprovedRefundIfWithinCap`) reserves the ledger slot atomically immediately before the
refund actually executes, rather than reading the total early and writing unconditionally
after success, proven by a concurrent-request regression test confirmed failing (both requests
approved) against the pre-fix code before the fix, then passing after it. Full detail:
`docs/VERIFICATION-GAPS.md` G-24's updates.

---

## INC-7 — Audit-sink events were durable but unsigned (INTEGRITY)

**What:** `caller_audit_events` and `razorpay_webhook_audit_events` (the durable
replacements for the in-memory caller-auth and webhook audit trails, G-13) were plain rows
once written: durable against a process restart, but anyone with direct database access
could alter one afterward with no way to detect it — the same exposure `ExecutionTrustRecord`
had before it carried a signature.

**Impact:** the caller-authentication and Razorpay-webhook audit trails were tamper-evident
against nothing. An altered row (a rejection quietly rewritten to look like a success, or
vice versa) would have been indistinguishable from a genuine one.

**Resolution:** `SupabaseCallerAuditSink` and `SupabaseRazorpayWebhookAuditSink` now sign
every event at write time with `AuditEventCrypto`, the same signing stack and `DEFAULT_KEY_ID`
`ExecutionTrustRecord`/`RefusalRecord` already use — one root of trust, not a third key. A
`signature_json JSONB` column was added to both tables (nullable, additive; existing
unsigned rows stay unsigned, honestly, every row from the migration forward is signed).

**Still open:** shortly after this shipped, Supabase's PostgREST layer got stuck refusing to
recognize `signature_json` in its schema cache on `INSERT` (confirmed at the PostgREST layer
specifically — not the database, not this codebase; PostgREST support ticket SU-437429).
Worked around by writing both sinks via a direct Postgres connection
(`PostgresPoolFactory`), bypassing PostgREST's REST layer and its schema cache entirely —
flagged in both sink files as temporary, revertible once Supabase confirms the cache issue
is resolved.

---

## INC-8 — Exposed Dilithium3 signing private keys on a feature branch (SECURITY)

**What:** four real ML-DSA-65 (Dilithium3) private signing keys (`keys/dilithium3-private.key`,
`packages/api/keys/dilithium3-private.key`, `packages/crypto/keys/dilithium3-private.key`,
`packages/runtime/keys/dilithium3-private.key`) were committed to `feature/pqc-dilithium3` and
pushed to `origin` (`github.com/pavancharak/parmana-exp`) during the ML-DSA-65 signature
provider work. Confirmed present in the pre-purge history (commit `a68c99d`/`e76debd`, "feat(crypto):
add ML-DSA-65 (Dilithium3) post-quantum signature provider" / merge of the same branch),
independently re-derived directly from `main-pre-purge-backup` (a local-only branch retained
specifically to make this incident auditable, never itself pushed anywhere).

**Confirmation nothing live trusted the exposed key:** reported (not independently
re-derivable by this session, since it requires the actual production key material at the
time, which is out of scope for this repository to hold or reconstruct) as confirmed via raw
private-key-byte SHA-256 comparison against the key actually in use — the exposed key did not
match. A fresh Dilithium3 keypair was generated and verified through the real signing chain
regardless, on the same fail-closed discipline as every other key-handling decision in this
codebase: treat exposed material as compromised and replace it, independent of whether
anything can be shown to have actually relied on it.

**Resolution:** history purged via `git filter-repo --path-glob '*.key'` (equivalently scoped
to `.pem`/key material, matching INC-1's own tooling choice), `feature/pqc-dilithium3` deleted,
`main` force-pushed to `origin`.

**Independently re-verified this session, against the actual current state of both remotes —
not taken on the original report's word:**

- `origin`: `git ls-remote --refs` shows no `feature/pqc-dilithium3` and no ref referencing
  `a68c99d`/`e76debd`. A plain fresh clone does not resolve either hash.
- `backup` (`github.com/pavancharak/parmana-exp-backup`, private): **found NOT actually clean**
  during this re-verification — a stray ref, `refs/remotes/origin/feature/pqc-dilithium3`,
  was still live on the remote, pointing directly at `a68c99d`, along with four other
  `refs/remotes/*`-namespaced refs (`origin/HEAD`, `origin/main`, `origin/master`,
  `backup/main`) that should never exist on a remote server at all — apparently pushed
  wholesale from a local working copy's own tracking refs (`--mirror` or `--all`), silently
  undoing the purge on this one remote while `backup`'s actual `refs/heads/main` remained
  clean throughout (confirmed: `a0c725e`'s tree contains none of the four key files). Fixed
  in this session: all five stray refs deleted (`git push backup :refs/remotes/...` for each).
  Re-verified via a fresh, independent bare clone of `backup` immediately after: `git cat-file
-e a68c99d...` fails (exit 1) — the fresh-clone-unresolvable standard this incident's
  original closure claimed now genuinely holds on both remotes.
- **Residual, not fully closed:** even on `origin`, an explicit `git fetch origin
a68c99d...` (asking the server for that exact hash directly, not discovering it via any
  ref) still succeeds — GitHub does not guarantee a force-pushed-over commit is truly deleted
  server-side, only that it's no longer advertised or discoverable through ordinary
  clone/browse paths; full removal requires a GitHub support "sensitive data removal"
  request against the repository, not requested as part of this session (out of scope: it
  requires the repository owner's account, not something achievable via `git`). This is a
  known, generic limitation of any GitHub-hosted `git filter-repo` cleanup, not evidence this
  specific purge was done incorrectly.

---

## INC-9 — `main`'s entire commit history replaced with a single parentless root commit on GitHub (SECURITY)

**What:** `origin/main` (`github.com/pavancharak/parmana-exp`) was found pointing at a single
commit, `dcc9312` ("Initial Parmana backup") — a parentless root with the whole working tree
(1,461 files, 274,468 insertions) committed at once, plus one commit on top of it (`70ce7aa`).
The real history — 202 commits reaching back through `00dc491` to `ecc91db` (`master`'s last
known-good point) — was gone from every ref GitHub advertised. Found incidentally, while
verifying an unrelated commit during this session, not via proactive monitoring or a scheduled
audit.

**Impact:** GitHub's `main` showed "1 Commit" in place of the project's real 202-commit history.
Confirmed **zero data loss**: the real commits were never actually deleted, only unreferenced by
any branch GitHub exposed — see Recovery. No working-tree content, signing keys, or audit records
were altered or lost; this was a history/provenance incident, not a data-integrity one.

**Recovery:** the local git object database still had the real commits as reachable objects
(`00dc491`'s commit object confirmed well-formed via `git cat-file`; its ancestry confirmed via
`git merge-base ecc91db 00dc491` returning `ecc91db` itself — a genuine 128-commit chain, not
coincidence). Three groups of real work that existed only in the broken `70ce7aa` tree — a
HubSpot placeholder-token hygiene fix, the already-reviewed Batch 3 docs cleanup, and the
principal-binding audit fix (INC-7's follow-on) — were re-derived as three fresh commits on a new
branch (`recovery/main-from-00dc491`) off `00dc491`, each file diffed and verified byte-identical
to `70ce7aa`'s tree before committing, so nothing was retyped or paraphrased from memory. The
reconstructed branch was independently verified clean before touching `origin`: full test suite
(146 files / 1,063 tests passed, 13/36 skipped, 0 failed), `tsc -b`, `npm run typecheck`, `npm run
lint`, and the citation-integrity test (`tests/architecture/documentation-references.test.ts`,
94/94) all green. Local `main` was then fast-forwarded to the verified branch and pushed with
`git push --force-with-lease` (lease-protected — would have failed safely had `origin/main`
changed again since the last fetch, rather than blindly overwriting). Restoration was confirmed
by direct visual inspection on GitHub itself (202 commits, `ed50acd` at `HEAD`), not solely on the
strength of local tool output.

**Likely cause (unconfirmed):** a GitHub App integration for OpenAI's Codex had write access to
this repository. The commit message ("Initial Parmana backup") and the parentless-root shape are
consistent with an agentic tool performing a naive backup/reinitialize operation against the repo
rather than working within its existing history. This is circumstantial: no direct log, API
record, or admission ties Codex to this specific event, and no other explanation has been ruled
out. Recorded here as the leading hypothesis, not a confirmed root cause.

**Resolution:** Codex's GitHub App access has been uninstalled at the account level (not merely
revoked for this one repository), removing the suspected access path regardless of whether it was
the actual cause.

**Still open:** root cause is unconfirmed, so nothing rules out a different integration or access
path producing the same failure mode again. A periodic audit of installed GitHub Apps and OAuth
integrations with write access, across all Parmana repositories (not just this one — `backup2`
remains a separate remote with its own access grants), is not yet a standing practice and should
become one.

---

## INC-10 — Two shipped 1.1.0 SDK bugs, plus a stale version-constant bug forcing a 1.1.1 republish (RELEASE)

**What:** During a pre-publish staleness check of `@parmana/sdk` (TypeScript) and `parmana`
(Python) against current `parmana-exp`, two real bugs were found and fixed before publishing:
`RateLimitError` was misclassified as `InternalServerError`, and `AuthorizationError`'s
`serverCode` silently dropped `CAPABILITY_NOT_ALLOWED`. Both SDKs were then published clean as
`@parmana/sdk@1.1.0` and `parmana@1.1.0`.

A second, independent bug was found only after that publish: each SDK maintained its own
manually-set version constant (`typescript/src/version.ts`'s `VERSION`,
`python/parmana/version.py`'s `__version__`) alongside its real package manifest
(`package.json` / `pyproject.toml`), and the two had never been kept in sync. Both published
`1.1.0` packages therefore reported a stale, wrong version at runtime (TypeScript: `1.0.0`;
Python: `1.0.5`) despite correct manifest metadata.

**Impact:** anyone importing either package and checking its reported version (`VERSION`
in TypeScript, `parmana.__version__` in Python) saw a wrong answer, with no indication from
the package manifest that anything was off. Neither npm nor PyPI permits re-uploading a
published version once live, so the only fix was a new release.

**Near-miss (caught, not a failure):** separately, a first `npm publish` attempt was run from
the repo root instead of `typescript/`, which would have published the entire proprietary
monorepo publicly. It never went out — blocked by that root `package.json`'s own
`private: true` flag, an existing safeguard doing exactly the job it was there for.

**Resolution:** both SDKs were fixed and republished as `1.1.1`. A root-cause fix then landed
so this class of bug can't recur: each language now derives its exported version from its own
manifest at runtime instead of a second hardcoded string. TypeScript's `version.ts` reads
`package.json` via `fs.readFileSync` resolved relative to `import.meta.url` (works unchanged
from `src/`, from compiled `dist/`, and from an installed npm package, since npm always ships
`package.json` regardless of the `files` field); a static JSON import was ruled out because
`tsconfig.json`'s `rootDir: "src"` would reject a compile-time import of the parent directory's
`package.json` without restructuring the build's output layout. Python's `version.py` reads
`importlib.metadata.version("parmana")` at runtime, which setuptools already populates from
`pyproject.toml`'s `version` field at install time, with a `PackageNotFoundError` fallback for
an uninstalled source checkout.

**Verified:** proven with a real throwaway-version test, not just asserted — both manifests
were bumped to a scratch version (`9.9.9-test` / PEP 440's `9.9.9.dev0`), rebuilt/reinstalled,
and the runtime-exported version was confirmed to follow automatically with zero edits to
`version.py`/`version.ts`, before both manifests were reverted to `1.1.1`. Full test suites,
typecheck, and lint were re-run clean for both packages afterward (Python: 67/67 tests, ruff,
black, mypy strict; TypeScript: 145/145 tests, `tsc --noEmit`, eslint).

**Current state:** `@parmana/sdk@1.1.1` and `parmana@1.1.1` are live and correct on npm and
PyPI respectively; the root-cause fix is committed on `main`.

---

## Minor / dead-code findings (logged, non-urgent)

- `LedgerSerializer.serialize()` — replacer-array misuse silently drops nested payload
  keys. In dead, unreachable code; documented via a behavior test, not fixed.
- Orphaned Replay/Storage subsystems exported but unreachable from the live `/replay`
  route.
- `execution-failure.integration.test.ts` — permanently skipped on a now-stale
  justification; resurrect via the gateway's failure-injection point.
- `.env` sets `DATABASE_PROVIDER=supabase` unconditionally; api repos throw at
  module-import before skip gates run (needs lazy construction).
- `PARMANA_POLICY_DIR` has no repo-relative fallback — fresh clones 500 on execution
  routes.
