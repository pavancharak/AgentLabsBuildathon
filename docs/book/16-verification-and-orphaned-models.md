# Chapter 16 — Verification, and Two Orphaned Models

`packages/crypto/src/VerificationCrypto.ts`, `packages/replay/src/`, `packages/receipt/src/`,
`packages/shared/src/domain/receipt.ts`, `packages/crypto/src/ReceiptCrypto.ts`.

## Independent verification: recompute, don't trust the stored flag

`VerificationCrypto` (backing `POST /verify`/`GET /verify/{id}`) recomputes an
`ExecutionTrustRecord`'s canonical hash from scratch via the same `TrustRecordHasher`
(Chapter 6) every other artifact hash in this codebase uses, and checks it against the
stored `trustRecordHash` and `signature` — including, since the hybrid-signing milestone, the
schema-version-gated rule from Chapter 6: if `schemaVersion >= 2`, every entry in
`signatures[]` must independently verify too, no silent fallback to the primary `signature`
alone. This is what "independently verifiable" actually cashes out to in this codebase: not
a trusted boolean column in a database row, but a verifier that re-derives the hash and
re-checks the signature every time it's asked, using nothing but the record itself and a
public key.

## `@parmana/replay`: real, tested, and not wired into production

`ReplayEngine.replay()` re-runs `PolicyEngine.evaluate()` against an existing
`ExecutionTrustRecord`'s original `BusinessTransaction` signals and a resolved `Policy`, then
compares the freshly computed outcome to the `Decision` already recorded on that record —
**scoped, deliberately**: it never re-executes the connector or capability side, only the
policy decision. `ReplayVerifier.verify()` is a straightforward deep-equality check between
two `ReplayResult`s, not a cryptographic one.

This is a genuinely useful capability — "would this same transaction, evaluated again right
now against the exact same recorded inputs, still produce the same decision" is a real
question worth being able to ask, particularly after a policy change. But as of this
writing, **`packages/api` does not import `@parmana/replay` anywhere** — its only real
consumer is `examples/tutorials/06-replay/run.ts`. It is a standalone, tutorial-only package,
not part of any live request path. If you're looking for where replay actually happens in
production, it doesn't yet; this package is where it would plug in.

## `@parmana/receipt`: not the receipt this system actually issues

This is worth stating plainly because the naming is genuinely misleading if you don't check:
`packages/receipt/src/ReceiptEngine.generate()` produces a `Receipt` that is a **bare SHA-256
hash of `JSON.stringify(payload)`** — no digital signature, no algorithm field, no key
involved at all. It is not the `Receipt` this system actually issues. The real one lives in
`packages/shared/src/domain/receipt.ts`, carries `signature`/`algorithm` (and, since hybrid
signing, an optional `signatures[]`/`schemaVersion`), and is produced by `@parmana/crypto`'s
`ReceiptCrypto` — the same signing machinery, the same key material, as every other signed
artifact in this book. `examples/tutorials/07-receipt-generation` uses this real pipeline,
and its own description says so directly: "the real, wired Receipt... not `@parmana/receipt`'s
separate model."

Confirmed by grep, not assumed: zero imports of `@parmana/receipt` anywhere in
`packages/api`, and no other package's `package.json` depends on it either. There are also no
tests under `packages/receipt/` at all. It is orphaned — real code, presumably built earlier
as a first pass before `ReceiptCrypto` existed, never removed, never wired in, and never
covered by a test that would tell you it's not the mechanism actually in use.

## Why this chapter exists as written

A book claiming to be complete and unambiguous that quietly treated every package name as
equally load-bearing would itself become exactly the kind of overstatement this whole
documentation ecosystem keeps having to catch — the Razorpay-staleness cleanup (Chapter 10),
the CLAIMS.md citation-currency passes (Chapter 17), and this session's own extension of the
citation-integrity test are all instances of the same underlying failure mode: a document
asserting something is true or current that a direct check of the code would have refuted
immediately. `@parmana/replay` and `@parmana/receipt` are not bugs and not urgent — they are
real, tested, dead-in-production code, and the honest, useful thing to say about them is
exactly that, not to either omit them or present them as equivalent to the packages the rest
of this book describes as load-bearing.
