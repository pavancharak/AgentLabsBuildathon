> **STATUS: DRAFTING AID FOR ATTORNEY REVIEW — NOT A FILED OR FILING-READY APPLICATION.**
> Written 2026-08-25 directly from this repository's actual source code (cited throughout). No
> patent attorney, patent agent, or prior-art search has reviewed this document. Do not submit
> this to the Indian Patent Office or any other patent office in its current form. See
> [`PATENT_FILING_MASTER_PROMPT.md`](./PATENT_FILING_MASTER_PROMPT.md) for why this exists —
> the original prompt cited `packages/api/src/execution/executeTransaction.ts` as the complete,
> ready-to-file source for this patent; that file does not exist anywhere in this repository.
> This draft is grounded in the real files instead.

# Provisional Patent Specification (Draft) — Cryptographically Signed, Independently Verifiable Execution Trust Record

## Field

Systems and methods for producing a cryptographically signed, tamper-evident record of an
automated system's (including an AI agent's) execution decision and outcome, verifiable by a
third party without requiring that party to trust the originating system's own runtime or
database.

## Background / Problem

When an automated system (an AI agent, an orchestration platform) executes an action against a
regulated or otherwise consequential real-world system, the record of "what was authorized, and
what actually happened" is typically stored in the executing system's own database, and a party
that wants to verify the record's integrity after the fact has no choice but to trust that
database and that system's own reporting — the record and the verifier of the record are the same
party. This is inadequate for regulated contexts where an auditor, regulator, or counterparty
needs to verify a claimed execution independent of the system that performed it.

## Summary of the Invention

The invention constructs an immutable **Execution Trust Record** by (a) deterministically and
canonically serializing the record's content, independent of key ordering or incidental
formatting; (b) cryptographically hashing that canonical serialization to produce a
content-addressed integrity value; (c) signing the hash-inclusive record with a private key
under the control of the executing system; and (d) exposing a companion verification component
that can recompute the canonical hash and validate the signature **without access to the
executing system's runtime or database** — enabling independent, third-party verification.

## Detailed Description

**Record construction** (`packages/runtime/src/BusinessTrustRecordBuilder.ts`):

1. A draft `ExecutionTrustRecord` is assembled from the current `RuntimeContext` — the business
   transaction, any override, the execution artifact itself (required — the builder throws if
   absent), any verification and receipt artifacts, and timestamps.
2. The draft is hashed via `TrustRecordHasher`/`VerificationCrypto`, which first passes the value
   through a `CanonicalSerializer` (`packages/crypto/src/CanonicalSerializer.ts`) — producing a
   deterministic byte sequence regardless of object-key insertion order — before hashing those
   bytes (`packages/crypto/src/TrustRecordHasher.ts`).
3. The resulting `trustRecordHash` is folded into the record, and the hash-inclusive record is
   then signed (`this.crypto.sign(recordWithHash)`), producing a `signature` naming its
   `algorithm` and `keyId` (`DEFAULT_KEY_ID` by default; see hybrid mode below).
4. **Dual-algorithm / post-quantum signing.** When `CRYPTO_MODE=hybrid`, a second, independent
   signature pass (`this.crypto.signHybrid(recordWithHash)`) is added additively — the original
   (classical, Ed25519-by-default) signature is unaffected either way, and the record's
   `schemaVersion` is bumped to 2 to carry both. This is a structural hedge against future
   cryptographic breaks: a record signed today remains verifiable under a post-quantum algorithm
   without having been re-signed retroactively.

**Independent verification** (`@parmana/envelope-verifier`): a separate package, deliberately
decoupled from the runtime/storage that produced the record, recomputes the canonical hash from
the record's own content and validates the signature against a public key — proving the record
has not been altered since signing, and that it was genuinely signed by the claimed key, without
querying Parmana's own database or trusting Parmana's own runtime to self-report honestly.

## Novel Elements (candidate claims — informal, for attorney refinement)

1. A method for producing a verifiable record of an automated execution, comprising:
   deterministically canonicalizing the record's content independent of field ordering;
   cryptographically hashing the canonicalized content to produce a content-addressed integrity
   value; folding that hash into the record; and signing the hash-inclusive record with a private
   key, such that any subsequent alteration of the record's content is detectable by
   recomputation of the hash, independent of the signature check.
2. The method of claim 1, further comprising an independently distributable verification
   component, decoupled from the system that produced the record, capable of recomputing the
   canonical hash and validating the signature using only the record's own content and a public
   key — without querying or trusting the originating system's runtime or database.
3. The method of claim 1, wherein a second, algorithmically distinct signature (e.g.,
   post-quantum) is additively attached to an already-hashed record without invalidating or
   requiring re-computation of the first signature, allowing a single record to carry
   verifiability under multiple cryptographic regimes simultaneously.
4. The method of claim 1, applied specifically to an AI-agent-initiated execution against a
   regulated third-party system (e.g., a financial transaction), where the signed record covers
   the full authorization-to-outcome chain (transaction, any human override, the execution
   artifact, verification, and receipt) as a single hashed-and-signed unit rather than
   independently signed fragments.

## What would need attorney/prior-art input before this is filing-ready

- Signed audit logs and Merkle-style tamper-evidence are known art broadly (e.g., certificate
  transparency logs, blockchain-adjacent systems) — the attorney will need to sharpen what's
  specifically novel here versus that prior art. Candidate distinguishing elements: the
  _AI-agent-execution-specific_ framing (claim 4), and the additive dual-signature hybrid
  mechanism (claim 3) that doesn't require re-signing under a new algorithm.
- Formal drawings: a sequence diagram of canonicalize → hash → sign → (optionally) hybrid-sign,
  and a system diagram showing the verifier as a separate, untrusted-relationship component from
  the runtime.
- The original prompt's claim language mentioned "webhook delivery to stakeholders" as part of
  this patent — that's a distinct mechanism (event notification) from record signing/verification
  itself; confirm with Pavan whether webhook delivery should be folded in here or treated as a
  separate, unpatented operational detail. Not included in the claims above because it isn't the
  same invention as the signing/verification mechanism.

## Source Code Reference

- `packages/runtime/src/BusinessTrustRecordBuilder.ts` — record construction, hashing, signing,
  hybrid signature logic (read in full 2026-08-25).
- `packages/crypto/src/TrustRecordHasher.ts` — canonical-serialize-then-hash.
- `packages/crypto/src/CanonicalSerializer.ts` — deterministic serialization.
- `@parmana/envelope-verifier` (`packages/envelope-verifier/src/EnvelopeVerifier.ts`) —
  independent verification component.
- `docs/CLAIMS.md` §"Independently Verifiable" claims and the envelope-verifier package README —
  cited as corroborating documentation, not verified line-by-line for this draft.
