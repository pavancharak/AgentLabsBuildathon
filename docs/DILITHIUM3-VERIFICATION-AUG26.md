# Dilithium3 + Crypto-Agility Verification Results

**Date run:** 2026-08-25 (results below are from an actual local run, not a template)
**Node version:** v24.18.0
**npm version:** 11.16.0
**Repository:** `D:\last\parmana-exp`, branch `main`

> Note on dating: this doc was prepared 2026-08-25 by running the real
> commands below directly, rather than waiting for pasted terminal output.
> The numbers here are measured, not assumed.

## Prerequisite fix: terminology guard

Before the suite could run fully green, `tests/architecture/terminology-guard.test.ts`
was failing (1 violation) because `docs/deep-tech/DEEP-TECH-APPLICATION-PROMPT.md`
used the retired phrase "execution governance" in two places. Fixed by replacing
both instances with the locked correct term, **"execution authorization"**
(per `docs/architecture/phase2c-terminology-guard.md` §6). This is a docs-only
change, unrelated to the crypto work, from the same-day commit `b983f03`.

## TEST 1: Dilithium3 test suite

**Command:** `npx vitest run packages/crypto/tests/unit/dilithium3-signature-provider.test.ts`
**Status:** PASS
**Pass count:** 4/4
**Failures:** 0

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

(A second, related file — `dilithium3-cross-instance.test.ts` — also exists and
passes; run together the two files total 6/6. The command above matches the
single named file only.)

## TEST 2: Full test suite

**Command:** `npm test`
**Status:** PASS
**Pass count:** 1274 passed
**Skip count:** 37
**Failures:** 0

```
 Test Files  167 passed | 14 skipped (181)
      Tests  1274 passed | 37 skipped (1313)
```

## TEST 3: Crypto-agility proof

**Script:** `packages/crypto/examples/crypto-agility-proof.ts` (new — no such
script existed in the repo before this verification; written against the
actual `@parmana/crypto` provider APIs and run with `tsx`, this repo's
convention, not `ts-node`)
**Command:** `npx tsx packages/crypto/examples/crypto-agility-proof.ts`
**Status:** PASS

```
TEST 1: Ed25519
Ed25519 signature created and verified: true

TEST 2: Dilithium3 (ML-DSA-65)
Dilithium3 signature created and verified: true

CRYPTO-AGILITY PROOF COMPLETE
==============================
- Same record, signed with Ed25519 -> verified
- Same record, signed with Dilithium3 -> verified
- Signatures differ (algorithms differ): true
- Both independently verifiable, no code changes between them
```

The script signs one canonical execution record (via `CanonicalSerializer`,
the same serialization every Parmana signing path uses) once with
`Ed25519SignatureProvider` and once with `Dilithium3SignatureProvider`,
each with its own freshly generated key pair, and verifies each signature
independently against its own provider.

## Executive summary

| Check | Result |
|---|---|
| Dilithium3 tests (named file, 4/4) | PASS |
| Full suite (1274 passed / 37 skipped / 0 failed) | PASS |
| Crypto-agility (both algorithms verify independently) | PASS |
| No regressions | PASS |

## Crypto-agility proof statement

Parmana can sign the same canonical record with either Ed25519 or
Dilithium3/ML-DSA-65, using the existing `SignatureProvider` interface.
Both verify independently, against their own keys, with no code changes
between the two runs — only the provider instance differs.

## Status for Phase 1

Ready for CLAIMS.md? YES, with the caveat below.

**Caveat:** the "14/14 passing" and "~597 passing / 35 skipped" figures
that appeared in the original verification checklist for this task did not
match this repository's actual state (measured: 4/4 in the named file, 6/6
including the related cross-instance file, 1274/37/0 for the full suite).
Cite the numbers in this document, not the checklist's, in `CLAIMS.md`.
