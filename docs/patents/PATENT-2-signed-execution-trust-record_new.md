\# PATENT-2: Method and System for Producing an Independently Verifiable, Canonically-Hashed, Multi-Algorithm-Signed Record of an Automated System's Execution Decision and Outcome



\*\*Complete, Clean, Unambiguous Draft\*\*



\---



\## TITLE



Method and System for Producing an Independently Verifiable, Canonically-Hashed, Multi-Algorithm-Signed Record of an Automated System's Execution Decision and Outcome



\---



\## FIELD OF THE INVENTION



\[0001] This invention relates to the generation of tamper-evident evidentiary records of actions taken by an automated system, including but not limited to AI agents, against a real-world target. Specifically, this invention relates to a record structure and companion verification mechanism that allows a third party to verify the record's integrity and authenticity without trusting the runtime, database, or self-reporting of the system that produced it, and without requiring the record to be re-issued when the signing algorithm changes.



\---



\## BACKGROUND OF THE INVENTION



\[0002] When an automated system executes a consequential action, the record of "what was authorized, and what actually happened" is conventionally stored in that same system's own database. A party wishing to verify the record's integrity after the fact — an auditor, a regulator, a counterparty — has no choice but to trust that database and that system's own reporting. The producer of the record and the only available verifier of the record are the same party. This is structurally inadequate wherever an independent party needs to verify a claimed execution without relying on the executing party's honesty or operational continuity.



\[0003] A further problem arises from cryptographic obsolescence: a record signed under one algorithm (for example, a classical elliptic-curve scheme) becomes unverifiable, or requires a disruptive re-signing campaign across historical records, if that algorithm is later broken or deprecated. This is a live concern given the anticipated arrival of practical quantum cryptanalysis against classical schemes.



\[0004] What is needed is a record structure in which:



(a) The record's evidentiary content is serialized in a manner that produces byte-identical output independent of field insertion order or incidental formatting, so that a hash of that serialization is a stable, reproducible fingerprint of the content.



(b) That fingerprint is folded into the record and the resulting hash-inclusive record is signed.



(c) A second, algorithmically independent signature can be added to an already-hashed record additively, without invalidating or requiring recomputation of the first signature.



(d) Verification of (a), (b), and (c) can be performed by a component with no access to, and no dependency on, the runtime or database that produced the record.



\[0005] This invention addresses all four requirements.



\---



\## SUMMARY OF THE INVENTION



\[0006] The invention constructs an immutable Execution Trust Record through a five-step process:



1\. Deterministically and canonically serializes the record's content independent of key ordering.

2\. Cryptographically hashes that canonical serialization to produce a content-addressed integrity value.

3\. Folds the resulting hash into the record itself.

4\. Signs the hash-inclusive record with a private key under the control of the executing system.

5\. Optionally and additively, attaches a second signature produced by an algorithmically distinct signing scheme over the identical hash-inclusive record, without altering or requiring recomputation of the first signature.



\[0007] A companion verification component, packaged and distributable independently of the executing system's runtime and database, recomputes the canonical hash from the record's own content and validates the signature(s) using only the record and a public key.



\[0008] The key innovation is that a single record carries independent verifiability under two distinct cryptographic regimes concurrently, enabling seamless transitions from classical to post-quantum algorithms without historical re-signing.



\---



\## DETAILED DESCRIPTION OF THE INVENTION



\### Component 1: Canonical Serialization



\[0009] `CanonicalSerializer.serialize(value)` recursively normalizes an arbitrary value before JSON-encoding it.



\[0010] The normalization process follows these rules:



(a) \*\*Primitives and null:\*\* `null`, strings, numbers, booleans, and undefined pass through unchanged.



(b) \*\*Dates:\*\* `Date` instances are rendered to their ISO string form (e.g., `2026-09-01T12:00:00Z`).



(c) \*\*Arrays:\*\* Preserve their existing order. Order is evidentiary significant for a sequence of executions and is not itself normalized.



(d) \*\*Objects:\*\* Every plain object has its own keys sorted lexicographically using `Object.keys(object).sort()` before being recursively reconstructed, key by key.



\[0011] The normalized value is then passed to `JSON.stringify` and encoded to UTF-8 bytes. Because this normalization is applied recursively and independent of the original object's property-insertion order, two logically identical records constructed by different code paths, in different field orders, produce byte-identical canonical output.



\[0012] This byte-identity is a precondition for a hash of that output to serve as a stable content fingerprint. Two records describing the same execution, built by different code paths, will hash identically even if their object keys were originally inserted in different orders.



\### Component 2: Cryptographic Hashing



\[0013] `TrustRecordHasher.hash(value)` performs the following operations:



(a) Pass `value` through the `CanonicalSerializer` to produce canonical bytes.



(b) Pass those bytes through a configured `CryptoProvider`'s `hash.hash(bytes)` function.



(c) Return a single hash string.



\[0014] Every hashing operation in the system — trust records, refusal records, policy-change approval records — is required to route through this same class. This ensures that "the hash of X" always means the same canonicalize-then-hash procedure regardless of which artifact X is.



\[0015] This unified hashing ensures consistency across all record types and prevents hash collisions due to different serialization approaches.



\### Component 3: Record Assembly and Hash Folding



\[0016] `BusinessTrustRecordBuilder.build(context)` assembles a draft record from the current `RuntimeContext`:



(a) The business transaction.



(b) Any human override (as an array; empty array if none).



(c) The execution artifact itself (required; the method throws if absent).



(d) Any verification artifacts already produced.



(e) Timestamps (execution start, completion, record creation).



\[0017] This draft, together with an empty placeholder signature block, is passed as a single unit into `this.crypto.hash(trustRecord)`, producing `trustRecordHash`.



\[0018] The hash is then folded back into the record (`recordWithHash`). This step is critical: the record now contains its own integrity fingerprint.



\[0019] The hash-inclusive object — not the original unhashed draft — becomes the input to the signing step. This ordering is architecturally significant: the signature covers the hash itself, not merely the pre-hash content.



\[0020] An external party holding only the record can therefore perform three independent verification checks:



(a) Recompute the hash from the record's content.



(b) Confirm it matches the record's own `trustRecordHash` field.



(c) Independently confirm the signature covers a record consistent with that same hash.



\[0021] These three checks occur over the same object, catching both content tampering (hash mismatch) and record substitution (signature mismatch) independently of each other.



\### Component 4: First Signature (Classical Algorithm)



\[0022] The builder calls `this.crypto.sign(recordWithHash)`, producing the first digital signature over the hash-inclusive record using a classical cryptographic algorithm (typically elliptic-curve cryptography).



\[0023] The signature is stored in a `signatures` collection within the record, indexed by algorithm name.



\[0024] The record at this stage is fully verifiable under the classical algorithm using a public key.



\### Component 5: Optional Additive Dual-Algorithm Signing



\[0025] When system configuration (`loadConfig().crypto.mode`) is set to `"hybrid"`, the builder additionally calls `this.crypto.signHybrid(recordWithHash)` — over the identical `recordWithHash` object already used for the first signature.



\[0026] This second signing pass:



(a) Takes the already-hash-inclusive record as its input.



(b) Does not alter, invalidate, or require recomputation of the first `signature` value computed in paragraph \[0022].



(c) Produces a second, independent signature under a cryptographically distinct algorithm (typically a post-quantum signature scheme).



(d) Appends that signature to the same `signatures` collection without modifying other entries.



\[0027] Critically, the two signatures are additive and over the same canonical content. They are produced under independently distinct algorithms. The record's `schemaVersion` is bumped to `2` to signal that the record carries both signatures.



\[0028] A record built in classical-only mode (schemaVersion `1`) is a strict subset, in structure, of one built with hybrid signing added (schemaVersion `2`). An older system reading a version `1` record will find only the classical signature and can verify it. A newer system reading a version `2` record will find both signatures and can verify either or both.



\### Component 6: Independent Verification Component



\[0029] `EnvelopeVerifier` is packaged as a separate, independently distributable component from the runtime and storage layer that produces the record.



\[0030] The verifier performs verification without:



(a) Querying Parmana's database.



(b) Invoking Parmana's runtime.



(c) Trusting any state or self-reporting of the system that produced the record.



\[0031] The verifier requires only:



(a) The caller-supplied public key (or a keyed lookup through an injected `KeyProvider`).



(b) The record's own content.



\### Component 7: Verification Logic (Side-Effect-Free Checks)



\[0032] The verifier performs four side-effect-free checks:



(a) \*\*Payload-version support:\*\* Confirm the record's schema version is supported by this verifier instance.



(b) \*\*Signature validity:\*\* Recompute the canonical hash from the record's content, confirm it matches the record's claimed `trustRecordHash` field, and validate the signature(s) using the supplied public key(s).



(c) \*\*Expiry:\*\* Confirm the record has not expired based on its `expiresAt` timestamp.



(d) \*\*TTL-policy compliance:\*\* Confirm the record's time-to-live falls within configured policy bounds.



\[0033] Each of these checks produces its own pass/fail result reported without suppression by the outcome of any other check. An observer can therefore know precisely which checks passed and which failed, enabling granular error diagnosis.



\### Component 8: Verification Logic (Side-Effecting Check)



\[0034] A fifth check, nonce consumption, is deliberately isolated into its own method (`consumeNonce`) with a side effect (consuming a single-use nonce token, which cannot be undone).



\[0035] The class's `verify()` method composes the four side-effect-free checks and the nonce-consumption check in the safe order:



(a) All four side-effect-free checks execute and return their results.



(b) Only if all four checks have independently passed does the method proceed to nonce consumption.



(c) The nonce is consumed only after all side-effect-free checks have passed.



\[0036] This ordering is critical to prevent nonce poisoning: an attacker who observes an in-transit nonce and crafts a forged or expired envelope could otherwise burn a legitimate nonce, causing a valid subsequent request to be rejected. By deferring nonce consumption until after all independent checks pass, the system ensures that a forged envelope cannot poison nonces for legitimate requests.



\---



\## CLAIMS



\### Independent Claims



\*\*Claim 1 (Broadest Scope):\*\* A computer-implemented method for producing a verifiable record of an action executed by an automated system, comprising:



(a) assembling a record comprising content descriptive of the executed action and its outcome, including the transaction, execution artifact, any human override, verification artifacts, and timestamps;



(b) deterministically canonicalizing the record's content by recursively normalizing it, including sorting the keys of every nested object lexicographically, independent of the order in which those keys were originally populated, to produce a canonical byte sequence;



(c) cryptographically hashing the canonical byte sequence of step (b) to produce a content-addressed integrity value;



(d) folding the integrity value of step (c) into the record to produce a hash-inclusive record;



(e) generating a first digital signature over the hash-inclusive record of step (d) using a private key under control of the executing system, such that the signature covers both the record's content and its own claimed integrity value as a single signed unit; and



(f) storing the signature within the record in a signatures collection keyed by algorithm name.



\*\*Claim 2 (Dual-Algorithm Claim):\*\* The method of Claim 1, further comprising:



(a) generating a second digital signature over the identical hash-inclusive record of step (d), using a signing algorithm that is cryptographically distinct from the algorithm used to produce the first signature of step (e);



(b) appending the second signature to the signatures collection without altering, invalidating, or requiring recomputation of the first signature;



(c) updating the record's schemaVersion to indicate that multiple signatures are present;



such that a single record carries independent verifiability under two distinct cryptographic regimes concurrently, and remains verifiable under either regime independently.



\*\*Claim 3 (Verification Component Claim):\*\* A computer-implemented verification system, comprising:



(a) an `EnvelopeVerifier` component, packaged separately from the system that performs steps (a)–(f) of Claim 1, configured to perform the following operations using only a supplied public key and the record's content:



(i) recompute the canonical byte sequence and integrity value of steps (b)–(c) from the record's own content;



(ii) compare the recomputed integrity value against the value folded into the record at step (d);



(iii) validate the signature(s) of step (e) and/or step (f) against the supplied public key(s);



(b) wherein the verification component performs steps (i)–(iii) without querying, and without trusting any state from, any runtime or database operated by the system that performed steps (a)–(f) of Claim 1;



(c) wherein the verification component is independently distributable and may be deployed in an environment with no access to the original system.



\*\*Claim 4 (Verification Logic Claim):\*\* The verification system of Claim 3, further comprising:



(a) four side-effect-free verification checks: payload-version support, signature validity, expiry, and TTL-policy compliance;



(b) one side-effecting check: nonce consumption;



(c) a `verify()` method that executes all four side-effect-free checks first, reports their results independently, and only if all four have passed does it proceed to consume a nonce;



(d) such that a forged or expired record cannot consume a nonce that would otherwise be valid for a legitimate subsequent record.



\### Dependent Claims



\*\*Claim 5:\*\* The method of Claim 1, wherein the record content assembled in step (a) spans the full chain from transaction through any human override, the execution artifact, verification artifacts, and timestamps as a single unit that is jointly hashed and signed, rather than as independently signed fragments.



\*\*Claim 6:\*\* The method of Claim 1, applied specifically to an execution initiated by an AI agent against a regulated third-party system, wherein the record produced by steps (a)–(f) is offered as cryptographic evidence of the agent's authorized execution independent of the agent's own subsequent testimony or logs.



\*\*Claim 7:\*\* The method of Claim 2, wherein the first signing algorithm of Claim 1 is a classical elliptic-curve scheme and the second signing algorithm of Claim 2 is a post-quantum signature scheme, such that the record remains verifiable under the post-quantum scheme without requiring historical re-signing if the classical scheme is later broken or deprecated.



\*\*Claim 8:\*\* The method of Claim 1, wherein the canonical serialization of step (b) ensures that two records describing the same execution, constructed by different code paths with keys inserted in different orders, produce byte-identical output and therefore identical hashes, enabling deterministic verification independent of construction order.



\*\*Claim 9:\*\* The method of Claim 1, wherein the `trustRecordHash` field folded into the record at step (d) contains only the hash string itself, carrying no information about the hashing algorithm used, allowing transparent algorithm upgrades without record reformatting.



\*\*Claim 10:\*\* The method of Claim 3, wherein the verification component performs all four side-effect-free checks of Claim 4 (payload-version, signature validity, expiry, TTL-policy) and reports each result independently, enabling granular error diagnosis without suppression of any check's outcome by any other check's outcome.



\*\*Claim 11:\*\* The method of Claim 1, wherein the record's schemaVersion field enables version negotiation between producers and verifiers of different vintages, allowing older systems to ignore signature entries they do not understand while newer systems can verify multiple signatures on the same record.



\*\*Claim 12:\*\* The method of Claim 2, wherein both signatures in the signatures collection cover the identical hash-inclusive record, such that a verifier can trust that both signatures attest to the same content without requiring any secondary reconciliation or normalization step.



\---



\## ATTORNEY REVIEW REQUIRED



1\. \*\*Prior-art search:\*\* Certificate transparency logs (RFC 6962), blockchain audit logs, cryptographic timestamping (RFC 3161), ANSI X9.95, NIST PQC finalists

2\. \*\*Claim refinement:\*\* Determine independence, add specific canonicalization claims if needed

3\. \*\*Formal drawings:\*\* Sequence diagram, state diagram, component diagram, verification flow

4\. \*\*Scope clarification:\*\* Does "execution" include pre-execution authorization context? Only successful executions or also refused ones?

5\. \*\*International filing:\*\* India only or PCT/US/EU?

6\. \*\*Relationship to PATENT-1:\*\* Independent or interdependent (divisional/continuation-in-part)?



\---



\## CONCLUSION



This patent describes a specific, verified-in-code mechanism for producing tamper-evident execution records independently verifiable without trusting the executing system, transparently supporting cryptographic algorithm transitions without historical re-signing campaigns.



\*\*Status:\*\* Complete draft. Ready for attorney review. Not filing-ready.



