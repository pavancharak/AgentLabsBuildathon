# KMS Migration Troubleshooting Guide (2026-09-15 / 2026-09-16)

> **Status of this document: a completed incident/debugging record, kept
> as a troubleshooting reference.** Every issue below was real, found
> against this project's actual production deployment
> (`parmana-api-real.vercel.app`), and fixed the same session. If you hit
> one of these symptoms again — in this project or a similar KMS
> migration elsewhere — start here before re-diagnosing from scratch.
>
> Companion document: `docs/operations/aws-kms-vercel-oidc-setup-guide.md`
> is the step-by-step "do this from scratch" guide. This document is the
> "here's what went wrong and why" postmortem. Full technical detail on
> each bug (root cause, fix, verification) lives in `docs/VERIFICATION-GAPS.md`
> G-48 and G-49; this document is the narrative, chronological version —
> useful for understanding the _order_ things were discovered in and why
> each fix was scoped the way it was.
>
> Runnable, hermetic proof of the three most significant bugs (no AWS
> credentials needed): `examples/tutorials/113-kms-key-id-resolution/`,
> `examples/tutorials/114-signing-verification-key-agreement/`, and
> `examples/tutorials/115-per-limiter-rate-limit-stores/` — each
> reproduces the real failure against the real code, then confirms the
> real fix. Run all three with `npm run examples` (part of the full
> tutorial suite) or individually with `npx tsx examples/tutorials/<name>/run.ts`.

## Summary

The task was: fix a bug where `KmsSigner` couldn't resolve AWS KMS keys by
their logical name, then get the gateway's Ed25519 signing key fully onto
AWS KMS in production, then unblock a real integration partner (Pfinite)
that was getting HTTP 401s calling Parmana. What actually happened: five
more real, previously-undiscovered bugs surfaced, each one only visible by
testing against live production traffic — none of them were visible from
code review or the existing 1800+ test suite, because the test suite
mocks exactly the boundary (AWS KMS, Vercel's OIDC runtime, real
concurrent cold starts) where each bug lived.

**Lesson underlying most of this document:** a migration that changes
_where_ a system's trust boundary sits (local file → AWS KMS,
always-running process → serverless cold starts) needs to be verified
against the real target platform's actual runtime behavior, not just
against a mocked test double of it. Every bug below is a place where the
mock and the real platform disagreed.

## Timeline and each issue

### 1. `KmsSigner` couldn't resolve a logical keyId against real AWS KMS

**Symptom:** none yet observed in production — found by code review before
deployment, while verifying `Signer`/`SignerBootstrap`/`KmsSigner`
(already implemented in a prior session, commit `43fd5dc`) actually worked
end-to-end.

**Root cause:** every signing call site in this codebase passes a
_logical_ keyId (`DEFAULT_KEY_ID = "default"`) to `Signer.sign(keyId, data)`.
`KmsSigner` passed that string straight through as AWS KMS's `KeyId`
parameter. AWS KMS requires `KeyId` to be a real key ID (UUID), a full key
ARN, or an alias name/ARN (which must carry the `alias/` prefix) — a bare
`"default"` is none of those and is rejected outright.

**Fix:** `KmsSigner` now maps `keyId` → `alias/<keyId>` (mirroring
`FileKeyProvider`'s own `keyId` → `<keyId>.private.pem` convention),
passing an already-qualified alias, ARN, or raw key UUID through
unchanged. This is why `alias/default` must exist in AWS (see the setup
guide, Part 2) — it's not a naming convenience, it's what the logical
keyId `"default"` resolves to.

**Verified:** `packages/crypto/tests/unit/kms-signer.test.ts` (mocked
AWS SDK) plus a real, one-time end-to-end test against actual AWS KMS
(sign/verify/getPublicKey/getMetadata, deleted after confirming — see
`packages/crypto/tests/unit/kms-signer.test.ts`'s permanent mocked
coverage for the regression test that stayed).

### 2. `createGatewayPublicKey()` read a local file unconditionally

**Symptom:** every request to production 500'd immediately after
`KEY_PROVIDER=aws-kms` was first set, including `/health`.

**Root cause:** this call site was outside ADR-0009's original
seven-call-site audit. It read `default.public.pem` from
`PARMANA_KEY_DIR` directly, with no `KEY_PROVIDER` branch at all — under
`aws-kms`, no local key directory is materialized for the default key, so
this threw `Gateway public key not found` at the first line of module
construction.

**Fix:** resolve through `SignerBootstrap`, same as every other call site.

**Cascading consequence:** `createGatewayPublicKey()`/`createExecutionGateway()`/
`createExecutionSystem()` all had to become `async` (KMS calls are
inherently network I/O, unlike a synchronous file read) — which meant
~20 call sites across `server.ts`, `api/index.ts`, test files, and
tutorial scripts needed `await` added. Mechanical but wide-reaching; see
the actual diff for the full file list. Two categories: module-top-level
calls in ESM files (just add `await`, top-level await already works —
`packages/api/src/server.ts` already used it for
`assertKmsSigningKeyReachable()`), and calls inside a function that
itself needed to become `async`.

### 3. Vercel Functions can't get the OIDC token at cold start

**Symptom:** after fixing #2, a _different_ crash: `VercelOidcTokenError:
The 'x-vercel-oidc-token' header is missing from the request.`

**Root cause:** `@vercel/oidc`'s `getVercelOidcToken()` reads the OIDC
token from the current HTTP request's `x-vercel-oidc-token` header — this
is only available while Vercel's runtime is actually handling a request.
`api/index.ts` built the entire `ExecutionSystem` (including the KMS
`GetPublicKey` call) **eagerly at module top level**, before Vercel's
runtime had ever handed it a request to read a header from. This is a
hard platform constraint, documented by Vercel, not something to route
around with more `await`s — see `docs/oidc/reference`: "you cannot execute
`getVercelOidcToken()` directly at the module level."

**Fix:** restructured `api/index.ts` to export a lazy handler function.
The app is built once, on the **first real incoming request** (inside
`handler()`, with an actual request in flight and therefore a real OIDC
header available), memoized (`appPromise`) for reuse by subsequent
requests to the same warm container. A build failure resets the memo so
the next request gets a fresh attempt rather than a permanently-poisoned
rejected promise.

**Note for anyone repeating this on a different platform:** this
constraint is specific to Vercel's request-scoped OIDC token delivery. A
different serverless platform (or a long-running process like `server.ts`,
which is not subject to this — it calls `assertKmsSigningKeyReachable()`
at real process startup, which is fine because that process never needs a
_request's_ header, just the environment's long-lived `VERCEL_OIDC_TOKEN`)
may not have this restriction at all.

### 4. `assertSigningKeyMaterialConfigured()` silently broke a _different_ key

**Symptom:** after fixing #3, yet another crash: `Gateway private key not
found: /tmp/keys/gateway.private.pem`.

**Root cause:** this function's `KEY_PROVIDER=aws-kms` branch returned
early, skipping `materializeFromEnvIfConfigured()` entirely. That function
writes _every_ keyId present in `PARMANA_KEY_MATERIAL_JSON` to local disk
— not just the `"default"` signing key ADR-0009 actually moved to KMS.
The gateway's separate attestation key (`createGatewayKeyPair.ts`,
keyId `"gateway"` — a deliberately distinct key from `"default"`, "different
trust domain" per its own doc comment) was never meant to move to KMS at
all, but returning early meant it never got materialized to disk either,
even though `PARMANA_KEY_MATERIAL_JSON` still contained it.

**Fix:** `materializeFromEnvIfConfigured()` now always runs (as long as a
key directory is configured); only the `"default"`-key-specific _existence
check_ is skipped for `aws-kms` (that specific key genuinely has no local
file under that provider — `assertKmsSigningKeyReachable()`, called
separately, is its fail-closed equivalent).

**Lesson:** "does this env var control one key's custody, or every key
that happens to flow through the same materialization function" is easy
to get wrong when a fail-fast check's scope silently changes.

### 5. `express-rate-limit`'s `ERR_ERL_STORE_REUSE` (unrelated to KMS — and NOT actually the cause of the 500s it was found next to)

**Symptom:** a `ValidationError: A Store instance must not be shared across
multiple rate limiters` log line appeared next to a request that returned
HTTP 500, on a Vercel cold start.

**Root cause:** pre-existing bug, exposed (not caused) by this migration.
`createApp()` passed one shared `PostgresRateLimitStore` instance to both
the `/execute` and `/health`/`/ready` rate limiters, which
`express-rate-limit`'s documentation says a Store must never back more than
one of. It was always latent; it surfaced (as a log line) now because
Vercel's serverless model constructs the app fresh on every cold start, far
more often than the previous always-running deployment target did.

**Correction — verified directly against the installed library's source
(`node_modules/express-rate-limit/dist/index.mjs`, `wrappedValidations`):
this validation does not throw.** Every validation in `express-rate-limit`
v8 is wrapped in a try/catch that catches `ValidationError` and only logs
it (`console.error` by default) — it never crashes the process. **The
original version of this document (and of `docs/VERIFICATION-GAPS.md`
G-49) stated this validation "crashed the whole request" — that was an
unverified assumption from seeing the log line next to a 500, not a
confirmed mechanism, and it does not hold up.** The 500 that request
actually returned was caused by item #7 below (the signing/verification
key divergence), which was still unfixed at that point in the session and
was logged in the same request. `examples/tutorials/115-per-limiter-rate-limit-stores/run.ts`
reproduces the real, corrected behavior directly: constructing two
limiters against one shared store logs a warning and returns normally, it
does not throw.

Still worth fixing regardless of the corrected causal story: sharing one
`Store` instance violates the library's own documented contract, which
could become fatal in a future version or under a stricter `validate`
config, and may cause subtler non-crashing bookkeeping issues that weren't
separately investigated once the crash theory was corrected.

**Fix:** two separate `PostgresRateLimitStore` instances (one per
limiter), each with a distinct `prefix` — matching `express-rate-limit`'s
own documented `Store.prefix` field (used by its own double-count
detection), not an invented mechanism. `RateLimitOption.store` (singular)
became `executeStore`/`healthStore` (plural, distinct) at the type level,
so a future call site literally cannot pass one shared instance again
without a type error.

**Non-obvious TypeScript wrinkle hit while fixing this:** adding a
`private readonly prefix: string` field to `PostgresRateLimitStore` broke
its structural assignability to `express-rate-limit`'s `Store` type with
`Property 'prefix' is private in type 'X' but not in type 'Store'` — not
because private fields are generally incompatible with plain object
types, but because `Store` itself declares an optional **public**
`prefix?: string` field for exactly this purpose. Making the field public
(not a private implementation detail) fixed the type error and was the
semantically correct choice anyway.

### 6. Pfinite's HTTP 401 — nothing to do with KMS

**Symptom:** the original ask. Pfinite calling Parmana got a 401.

**Root cause:** `PARMANA_API_KEYS` (the caller-authentication credential
store — entirely separate from the Ed25519 _signing_ key; one gates
inbound requests, the other signs outbound records) had no entry at all
for a `pfinite` caller. This was never a KMS issue.

**Fix:** generated a new caller key (`scripts/generate-api-key.ts
--caller-id pfinite --credential-holder-type SERVICE --allowed-capabilities
"paytm:refund"`) and added its hash-only entry to `PARMANA_API_KEYS`.

**Follow-on issue:** manually editing the Vercel dashboard's raw JSON
value for `PARMANA_API_KEYS` is error-prone — one edit replaced the
_entire_ array with a single un-wrapped object (not an array at all),
breaking JSON parsing for every request; another edit lost the
pre-existing `charak1987` entry entirely because "add an entry" was
interpreted as "replace the value" rather than "append to the array."
**When editing this value by hand, always paste the complete array back,
never a single entry.**

**Follow-on issue 2:** even after authenticating successfully, Pfinite got
a 403 (`Caller is not permitted to assert this authority.principalId`).
`ApiKeyEntry.allowedPrincipalIds` defaults, when unset, to "this caller
may only assert itself as principal" — Pfinite was asserting
`principalId: "parmana-refund-agents"`, not `"pfinite"`. Fixed by adding
`allowedPrincipalIds: ["parmana-refund-agents"]` to its entry. This is
the system's fail-closed default working as designed, not a bug — a new
caller integration should expect to hit this and know to ask "what
principalId will this caller actually assert."

### 7. The "ambiguous outcome" bug — signing and verification silently used different keys

**Symptom:** after everything above was fixed, a _real_ Pfinite refund
request still got a 500, this time from deep inside the execution
pipeline: `Execution Gateway rejected request: failed checks
[signatureVerified, businessTransactionHashMatches, nonceUnseen]`.

**This looked like three independent failures. It was one.**
`businessTransactionHashMatches` and `nonceUnseen` both hard-default to
`false` inside `ExecutionGateway.verify()` whenever `signatureVerified` is
`false` (see the `passed`/`priorChecksPassed` short-circuit) — they never
actually got evaluated. The only real failure was `signatureVerified`.

**Root cause:** `createExecutionGateway.ts` passed an unconditional `new
FileKeyProvider()` as `ExecutionGateway`'s `keyProvider` option, regardless
of `KEY_PROVIDER`. `EnvelopeVerifier.resolveKey()` uses `keyProvider` —
when supplied at all — to resolve the verification key for **every**
authorization it checks, not only ones signed under a non-default
(tenant-scoped) keyId. This exact call site had been flagged the night
before as a "known gap," explicitly assessed as _"currently inert under
KEY_PROVIDER=aws-kms... no tenant key has been provisioned"_ — **that
assessment was wrong.** It is exercised on every single request, because
`"default"` is itself a keyId that flows through the same resolution
path. Parmana was signing every authorization with the real KMS key
(`RuntimeAuthorizationSigner` → `SignerBootstrap` → `KmsSigner`) but
verifying every authorization against whichever stale local
`default.public.pem` happened to still exist on disk from before the KMS
migration (kept alive, ironically, by the fix in #4 above, which
correctly resumed materializing _other_ keys from `PARMANA_KEY_MATERIAL_JSON`
but had the side effect of also keeping this now-wrong key file present).
Signing key and verifying key silently diverged — permanently, on every
request, with no startup error (`assertKmsSigningKeyReachable()` only
checks that the KMS key itself is reachable, not that every consumer is
actually configured to use it).

**Fix:** `SignerKeyProviderAdapter` (new,
`packages/crypto/src/providers/SignerKeyProviderAdapter.ts`) adapts a
`Signer` to the read-only surface of `KeyProvider` (`getPrivateKey()`
always throws — a `Signer` never releases private key material by
design). `createExecutionGateway.ts` now resolves **one** `Signer`
instance and shares it between the static `publicKey` and the
`keyProvider` adapter, so both paths are structurally guaranteed to agree
on the same backend, rather than being two independent resolutions that
happen to usually match.

**Why the earlier assessment was wrong, specifically, for anyone doing a
similar audit:** "is this code path exercised" needs to be checked against
what the _interface_ does by default, not just against what values are
currently configured. `keyProvider` being _supplied at all_ changes
`EnvelopeVerifier`'s behavior for every authorization, regardless of which
specific keyId shows up in practice — the presence of the option matters,
not just the diversity of keyIds seen so far.

**How it was actually found:** not by code review — by directly querying
the shared `execution_audit_events` Postgres table (both this repo and
the separate `parmana-paytm-agent` repo write to the same table,
correlated by `businessTransactionId`) for a real failed transaction ID
pulled straight from Pfinite's own error message, and reading the exact
recorded failure reason.

## What's still open after this session

- **`ExecutionGateway.execute()`'s uncaught-exception-to-500 pattern for
  verification failures is deliberate, documented design** — see
  `packages/api/src/middleware/error-handler.ts`'s own comment: nonce
  replay gets a distinguishable response; every other Gateway
  verification failure (forged signature, expired envelope, tampered
  content) deliberately falls through to an opaque 500, apparently to
  avoid giving an attacker a signature-verification oracle. This was
  **not changed** in this session — it's a real security tradeoff someone
  made on purpose, not obviously a bug, and changing it needs its own
  deliberate review of the threat model, not a quick patch bundled into a
  KMS migration.
- **`parmana-paytm-agent`'s own `verifyPaytmAuthorizationSignature()` has
  the identical pattern** (throws on any failure, uniformly surfaced as 500) — same reasoning applies, not touched, and it's a separate
  repository/deployment.
- **Tenant-scoped KMS keys (`tenant.<id>`) are not automated.** The
  `SignerKeyProviderAdapter` fix in #7 makes tenant-key verification
  _correct_ under KMS (it was already correct under local-file mode), but
  provisioning a real per-tenant KMS key/alias is still a fully manual
  `aws kms create-alias --alias-name alias/tenant.<id> ...` step per
  tenant, same as it was manual for local files before.
- **The `GatewayAttestationSigner`/`createGatewayKeyPair()` path stays
  local-file-only**, deliberately not migrated to KMS in this session.
  `GatewayAttestationSigner.sign()` is synchronous by design (`ConnectorAuthenticator.authenticateGateway()`
  is a synchronous interface), and KMS calls are inherently async — moving
  this to KMS means changing that interface's signature and following the
  ripple, a larger, separate piece of work.
- **`PARMANA_KEY_MATERIAL_JSON` is still set** in both `.env` and Vercel.
  ADR-0009 explicitly treats deleting it as a final, separate step, only
  after the KMS path has been live and stable for a real period — not
  rushed the same night it was first deployed.
- **Paytm merchant credentials are not yet configured** in
  `parmana-paytm-agent`'s environment. Once Parmana's own signing/
  verification chain was fixed (item #7), real refund requests correctly
  reach the actual Paytm API and fail there with an HTTP 503 (non-JSON
  response) — this is external to both repositories and needs real
  `PAYTM_MERCHANT_ID`/`PAYTM_MERCHANT_KEY`/`PAYTM_ENVIRONMENT` values from
  an actual Paytm merchant account before real refunds can execute.

## Issue found 2026-09-20: KMS rejects a message over 4096 bytes

**Symptom.** `POST /execute` returns `500 {"error":"Internal Server Error"}`. The runtime log shows:

```
ValidationException: 1 validation error detected: Value at 'message' failed to satisfy
constraint: Member must have length less than or equal to 4096
  at async KmsSigner.sign (.../providers/signer/KmsSigner.js)
  at async VerificationCrypto.sign (.../VerificationCrypto.js)
```

**Cause.** AWS KMS refuses a raw Ed25519 message over 4096 bytes, and `KmsSigner.sign()` sent the full
canonical bytes of the Execution Trust Record, which with its bound authorization, connector evidence
and governance anchor is larger. It did not show up in earlier KMS testing because the
`test:fixture-execute` record is small. A refund through the real Paytm connector is not.

**Fix.** ADR-0010. A message over 4096 bytes is signed as a fixed 97 byte commitment (the prefix
`PARMANA-ED25519-LARGE-MESSAGE-V1`, a NUL byte, and the SHA-512 digest), and verifiers accept it.
Nothing needs re-signing, and signatures issued earlier verify unchanged.

**Since ADR-0011 this is prevented and made explicit.** Before release the runtime proves signing works and returns `503 SIGNING_UNAVAILABLE` if not, and a failure after release is `500 EXECUTION_RECORD_INCOMPLETE`. On a build without that change, the following applied: the connector had already been called when the failure happened
(the Paytm connector service logged `POST /connector/paytm-refund` before `/execute` returned `500`).
The action was released and no signed trust record was produced, see G-52 in
`docs/VERIFICATION-GAPS.md`. For any `500` on `/execute` after this class of failure, query
`execution_audit_events` by `business_transaction_id` to see whether the connector executed, and do not
assume nothing happened.

**Confirm the fix is live.** After deploying, run one small `paytm:refund` through `/execute` and check
that the response is a full `ExecutionTrustRecord` with `verifications[0].status` of `VERIFIED` and a
signed receipt, and that the log contains no `ValidationException`.

## Quick diagnostic checklist for "something's wrong with KMS signing"

1. `curl https://YOUR-PROJECT.vercel.app/keys/default` — 200 with a real
   key means the basic KMS path (auth + key resolution) works. 500 means
   start with Vercel's runtime logs (`vercel logs <url>`).
2. If the log shows `VercelOidcTokenError` — something is calling AWS
   _before_ a real request is being handled (cold-start/module-top-level
   issue, see #3 above).
3. If the log shows `Gateway public key not found` / `Gateway private key
not found: .../gateway.private.pem` — a materialization gap, see #2/#4.
4. If a _real_ execution reaches the Gateway and fails with `failed checks
[signatureVerified, ...]` — check `createExecutionGateway.ts`'s
   `keyProvider` construction first (see #7); this is the highest-signal
   symptom for "signing and verification are using different keys."
5. If you see `ERR_ERL_STORE_REUSE` in the logs — it's a real, worth-fixing
   contract violation (see #5), but it only logs a warning, it does not
   throw or cause the request to fail. Don't stop investigating a 500 just
   because this line is nearby; find the actual thrown error in the same
   log output.
6. To find the _exact_ reason a real cross-repository transaction failed
   (when Parmana's own logs only show a generic "connector service failed
   with HTTP 500"), query the shared `execution_audit_events` table by
   `business_transaction_id` — both repos write detailed `reason` fields
   there even when the HTTP-level error is opaque.
7. If the log shows `ValidationException ... length less than or equal to 4096` from
   `KmsSigner.sign` means a message over the KMS raw limit was signed without the commitment scheme,
   see the 2026-09-20 section above. Check that the deployed build includes ADR-0010, and check
   `execution_audit_events` for whether the connector already ran.
8. If `/execute` returns `503 SIGNING_UNAVAILABLE`, the pre release signing probe failed and nothing was executed. Read the cause in the message, check the KMS key state and the role's `kms:Sign` and `kms:GetPublicKey` permissions, then retry with a new `businessTransactionId`.
9. If `/execute` returns `500 EXECUTION_RECORD_INCOMPLETE`, the action was released and the record failed. Do not retry as a new transaction. Query `execution_audit_events` by `business_transaction_id` and check the connector's own record first.
