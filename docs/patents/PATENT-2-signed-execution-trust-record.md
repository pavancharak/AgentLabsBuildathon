> **STATUS: DRAFTING AID FOR ATTORNEY REVIEW — NOT A FILED OR FILING-READY APPLICATION.**
> Written 2026-09-01, re-verified line-by-line against this repository's current source
> (`packages/runtime/src/BusinessTrustRecordBuilder.ts`, `packages/crypto/src/CanonicalSerializer.ts`,
> `packages/crypto/src/TrustRecordHasher.ts`, `packages/envelope-verifier/src/EnvelopeVerifier.ts`).
> Every file, class, method, and code path below was read directly from the working tree on that
> date. No patent attorney, patent agent, or prior-art search has reviewed this document. Do not
> submit this to the Indian Patent Office, the USPTO, or any other patent office in its current
> form. This document formalizes and supersedes the informal candidate claims in
> [`DRAFT-02-signed-execution-audit-trail.md`](./DRAFT-02-signed-execution-audit-trail.md) into
> patent-application structure; the underlying technical content is the same verified mechanism.
> See [`PATENT_FILING_REGISTER.md`](./PATENT_FILING_REGISTER.md) for real filing status.

# Patent Application (Draft) — Method and System for a Cryptographically Signed, Independently Verifiable, Crypto-Agile Execution Trust Record

## Title

Method and System for Producing an Independently Verifiable, Canonically-Hashed, Multi-Algorithm-Signed
Record of an Automated System's Execution Decision and Outcome

## Field of the Invention

[0001] This invention relates to the generation of tamper-evident evidentiary records of actions
taken by an automated system — including but not limited to an AI agent — against a real-world
target, and specifically to a record structure and companion verification mechanism that allows a
third party to verify the record's integrity and authenticity without trusting the runtime,
database, or self-reporting of the system that produced it, and without requiring the record to be
re-issued when the signing algorithm changes.

## Background

[0002] When an automated system executes a consequential action, the record of "what was
authorized, and what actually happened" is conventionally stored in that same system's own
database. A party wishing to verify the record's integrity after the fact — an auditor, a
regulator, a counterparty — has no choice but to trust that database and that system's own
reporting: the producer of the record and the only available verifier of the record are the same
party. This is structurally inadequate wherever an independent party needs to verify a claimed
execution without relying on the executing party's honesty or operational continuity.

[0003] A further problem is cryptographic obsolescence: a record signed under one algorithm (for
example, a classical elliptic-curve scheme) becomes unverifiable, or requires a disruptive
re-signing campaign across historical records, if that algorithm is later broken or deprecated —
a live concern given the anticipated arrival of practical quantum cryptanalysis against classical
schemes.

[0004] What is needed is a record structure in which (a) the record's evidentiary content is
serialized in a manner that produces byte-identical output independent of field insertion order or
incidental formatting, so that a hash of that serialization is a stable, reproducible fingerprint
of the content; (b) that fingerprint is folded into the record and the resulting hash-inclusive
record is signed; (c) a second, algorithmically independent signature can be added to an
already-hashed record additively, without invalidating or requiring recomputation of the first
signature; and (d) verification of (a)–(c) can be performed by a component with no access to, and
no dependency on, the runtime or database that produced the record.

## Summary of the Invention

[0005] The invention constructs an immutable Execution Trust Record by: deterministically and
canonically serializing the record's content independent of key ordering; cryptographically
hashing that canonical serialization to produce a content-addressed integrity value; folding the
resulting hash into the record; signing the hash-inclusive record with a private key under the
control of the executing system; and, optionally and additively, attaching a second signature
produced by an algorithmically distinct signing scheme over the identical hash-inclusive record,
without altering or requiring recomputation of the first signature. A companion verification
component, packaged and distributable independently of the executing system's runtime and
database, recomputes the canonical hash from the record's own content and validates the
signature(s) using only the record and a public key.

## Detailed Description

### Canonical serialization (paragraph references to `CanonicalSerializer`)

[0006] `CanonicalSerializer.serialize(value)` (`packages/crypto/src/CanonicalSerializer.ts`)
recursively normalizes an arbitrary value before JSON-encoding it: `null` and primitives pass
through unchanged; arrays preserve their existing order (order is evidentiarily significant for a
sequence of executions and is not itself normalized); `Date` instances are rendered to their ISO
string form; and, critically, every plain object has its own keys sorted lexicographically
(`Object.keys(object).sort()`) before being rebuilt, recursively, key by key. The result is passed
to `JSON.stringify` and encoded to UTF-8 bytes. Because this normalization is applied recursively
and independent of the original object's own property-insertion order, two logically identical
records constructed by different code paths, in different field orders, produce byte-identical
canonical output — a precondition for a hash of that output to serve as a stable content
fingerprint.

### Hashing (`TrustRecordHasher`)

[0007] `TrustRecordHasher.hash(value)` (`packages/crypto/src/TrustRecordHasher.ts`) passes `value`
through exactly this `CanonicalSerializer` and then through a configured `CryptoProvider`'s
`hash.hash(bytes)` function, returning a single hash string. Every hashing operation in the
system — trust records, refusal records, and policy-change approval records alike — is required
to route through this same class, so that "the hash of X" always means the same canonicalize-then-
hash procedure regardless of which artifact X is.

### Record construction (`BusinessTrustRecordBuilder`)

[0008] `BusinessTrustRecordBuilder.build(context)`
(`packages/runtime/src/BusinessTrustRecordBuilder.ts`) assembles a draft record from the current
`RuntimeContext`: the business transaction, any human override (as an array, empty if none), the
execution artifact itself — required; the method throws if `context.execution` is absent, so no
Trust Record can be built for a runtime context that has not actually executed — any verification
and receipt artifacts already produced, and timestamps. This draft, together with an _empty_
placeholder signature block (algorithm and keyId populated, `value: ""`), is passed as a single
unit into `this.crypto.hash(trustRecord)`, producing `trustRecordHash`.

[0009] The hash is folded back into the record (`recordWithHash`), and _that_ hash-inclusive
object — not the original draft — is what gets signed: `this.crypto.sign(recordWithHash)`. This
ordering is significant: the signature covers the hash itself, not merely the pre-hash content, so
a party holding only the record can (i) recompute the hash from the content, (ii) confirm it
matches the record's own `trustRecordHash` field, and (iii) independently confirm the signature
covers a record consistent with that same hash — three checks over the same object, catching both
content tampering (hash mismatch) and record substitution (signature mismatch) independently of
each other.

[0010] **Additive dual-algorithm signing.** When system configuration (`loadConfig().crypto.mode`)
is `"hybrid"`, the builder additionally calls `this.crypto.signHybrid(recordWithHash)` — over the
_identical_ `recordWithHash` object already used for the first, "classical" signature — producing
a second, independent `signatures` collection, and bumps `schemaVersion` to `2` to signal the
record carries both. Crucially, this second signing pass takes the already-hash-inclusive record
as its input and does not alter, invalidate, or require recomputation of the first `signature`
value computed in paragraph [0009]: the two signatures are additive, over the same canonical
content, under independently distinct algorithms. When hybrid mode is not configured, the method
returns with only the first signature — a record built in classical-only mode is a strict subset,
in structure, of one built with hybrid signing added, not a differently-shaped artifact.

### Independent verification (`@parmana/envelope-verifier`)

[0011] `EnvelopeVerifier` (`packages/envelope-verifier/src/EnvelopeVerifier.ts`) is packaged as a
separate distributable component from the runtime and storage layer that produces the record. It
performs four side-effect-free checks — payload-version support, signature validity, expiry, and
TTL-policy compliance — using only the caller-supplied public key (or a keyed lookup through an
injected `KeyProvider`) and the record/envelope's own content; it never queries Parmana's database
and never invokes Parmana's runtime. A fifth check, nonce consumption, is deliberately isolated
into its own method (`consumeNonce`) with a side effect, and the class's own `verify()` method
composes the two only in the safe order — side-effect-free checks first, nonce consumption only if
all four already passed — specifically so that a forged or expired envelope can never burn a
legitimate nonce (`EnvelopeVerifier.ts`'s own inline documentation, at the `consumeNonce`/`verify`
methods, states this rationale directly: an attacker who observes an in-transit nonce could otherwise poison it
with a forged envelope to cause the legitimate request to be rejected).

## Independent Claims (informal — for attorney refinement)

**Claim 1.** A computer-implemented method for producing a verifiable record of an action executed
by an automated system, comprising:

(a) assembling a record comprising content descriptive of the executed action and its outcome;

(b) deterministically canonicalizing the record's content by recursively normalizing it,
including sorting the keys of every nested object lexicographically, independent of the order in
which those keys were originally populated, to produce a canonical byte sequence;

(c) cryptographically hashing the canonical byte sequence of step (b) to produce a
content-addressed integrity value;

(d) folding the integrity value of step (c) into the record to produce a hash-inclusive record;
and

(e) generating a first digital signature over the hash-inclusive record of step (d) using a
private key, such that the signature covers both the record's content and its own claimed
integrity value as a single signed unit.

**Claim 2.** The method of claim 1, further comprising: generating a second digital signature over
the identical hash-inclusive record of step (d), using a signing algorithm that is cryptographically
distinct from the algorithm used to produce the first signature of step (e), without altering,
invalidating, or requiring recomputation of the first signature — such that a single record
carries independent verifiability under two distinct cryptographic regimes concurrently.

**Claim 3.** The method of claim 1, further comprising an independently distributable verification
component, packaged separately from a system that performs steps (a)–(e), configured to: recompute
the canonical byte sequence and integrity value of steps (b)–(c) from a received record's own
content; compare the recomputed integrity value against the value folded into the record at step
(d); and validate the signature of step (e) against a supplied public key — the entirety of the
verification requiring no query to, and no trust placed in, any runtime or data store operated by
the system that performed steps (a)–(e).

**Claim 4.** The method of claim 3, wherein the verification component performs a plurality of
independent checks including at least signature validity, record expiry, and a bounded
validity-window policy check, each producing its own pass/fail result reported without suppression
by the outcome of any other check, and wherein a further, side-effecting single-use check (a nonce
consumption) is deferred until all side-effect-free checks have independently passed, such that a
failing record cannot cause the single-use state to be consumed on behalf of a subsequent,
otherwise-valid record.

## Dependent Claims (informal)

**Claim 5.** The method of claim 1, wherein step (a)'s record content spans the full chain from
transaction through any human override, the execution artifact, verification, and receipt as a
single unit that is jointly hashed and signed, rather than as independently signed fragments.

**Claim 6.** The method of claim 1, applied specifically to an execution initiated by an AI agent
against a regulated third-party system, wherein the record produced by steps (a)–(e) is offered as
evidence of the agent's authorized execution independent of the agent's own subsequent testimony
or logs.

**Claim 7.** The method of claim 2, wherein the second signing algorithm of claim 2 is a
post-quantum signature scheme and the first signing algorithm of claim 1 is a classical
elliptic-curve scheme, such that the record remains verifiable under the post-quantum scheme
without having been re-signed after the fact should the classical scheme later be broken.

## What would need attorney/prior-art input before this is filing-ready

- Signed audit logs and hash-chained tamper-evidence are broadly known art (certificate
  transparency logs, blockchain-adjacent append-only ledgers). The attorney will need to sharpen
  what is specifically novel here relative to that art. Candidate distinguishing elements: the
  _additive, non-invalidating dual-algorithm signature over an identical hash-inclusive object_
  (Claim 2/7), and the _deliberate side-effect ordering_ in the verifier that prevents nonce
  poisoning by an invalid record (Claim 4) — as opposed to the general concept of a signed hash
  chain, which is not itself novel.
- Formal drawings: a sequence diagram of canonicalize → hash → fold → sign → (optionally)
  hybrid-sign, and a component diagram showing the verifier as architecturally decoupled from the
  runtime/storage layer.
- Whether "webhook delivery to stakeholders," referenced in an earlier, now-corrected internal
  prompt as part of this same patent, should be included here. It is a distinct mechanism (event
  notification of a record's existence) from the record's own construction and verification, and
  is deliberately excluded from the claims above; confirm with the founder whether it belongs in
  this application or a separate one.

## Source Code Reference (verified against working tree on 2026-09-01)

- `packages/runtime/src/BusinessTrustRecordBuilder.ts` — record assembly, hash-then-sign ordering,
  additive hybrid signing (paragraphs [0008]–[0010]).
- `packages/crypto/src/CanonicalSerializer.ts` — recursive key-sorting normalization (paragraph
  [0006]).
- `packages/crypto/src/TrustRecordHasher.ts` — canonicalize-then-hash, shared across all artifact
  types (paragraph [0007]).
- `packages/envelope-verifier/src/EnvelopeVerifier.ts` — independent verification component,
  four-check/fifth-side-effecting-check ordering (paragraph [0011]).
- `docs/CLAIMS.md` §2.5, §2.6, §2.9, §2.14 — corroborating claims documentation describing the same
  mechanism in product-facing language (cited as corroboration only, not independently re-verified
  line-by-line for every cross-reference in this draft).
