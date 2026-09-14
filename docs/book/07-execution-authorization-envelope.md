[← Book Index](README.md) · [← Previous: Chapter 6, Cryptography](06-cryptography.md)

# Chapter 7: The Execution Authorization Envelope

`packages/shared/src/domain/execution-authorization.ts`, `packages/crypto/src/AuthorizationSigner.ts`,
`AuthorizationVerifier.ts`, `packages/envelope-verifier/src/EnvelopeVerifier.ts`.

## What gets signed, and why it's shaped this way

`SignedExecutionAuthorization` is the artifact a `PolicyEngine`-approved `Decision` becomes:
a signed envelope proving Parmana authorized exactly one execution, of exactly this content,
within a bounded time window, usable exactly once.

```typescript
// packages/shared/src/domain/execution-authorization.ts (current shape)
export interface ExecutionAuthorizationPayload {
  readonly version: 1;
  readonly authorizationId: string;
  readonly nonce: string;
  readonly decisionId: string;
  readonly businessTransactionId: string;
  readonly policyName: string;
  readonly policyVersion: string;
  readonly authorizedAt: string; // ISO-8601 UTC string, never a Date
  readonly expiresAt: string; // required
  readonly businessTransactionHash: string;
  readonly policyContentHash?: string; // optional, §2.27
  readonly signalsHash?: string; // optional, §2.29 / G-31
}
```

Every field in this payload participates in the signature. Read top to bottom, this is a
history of the codebase discovering, one at a time, the ways an ID-only authorization fails
to be tamper-evident:

- **`nonce`**: single-use. A receiving system MUST reject an authorization whose nonce it's
  already seen.
- **`expiresAt`**: required, not optional. A receiving system MUST reject an expired
  authorization. All timestamps are ISO-8601 UTC strings, deliberately never `Date` objects,
  because that keeps the artifact byte-identical before signing and after JSON transport.
  The whole point of a signature is meaningless if serialization can silently change the
  bytes it covers.
- **`businessTransactionHash`**: the original TOCTOU fix. A canonical hash of the
  `ExecutableContent` (`businessTransactionId`, `action`, `target`, `parameters`) approved
  for execution, computed identically by the signing side (from the runtime's in-memory
  transaction) and the verifying side (from the JSON-parsed request) via the same
  `ExecutableContentHasher`. Without this, an authorization naming only an ID
  (`businessTransactionId: "tx-001"`) could accompany _any_ payload carrying that same ID.
  A receiving gateway recomputes this hash from the exact content it's about to forward and
  rejects any mismatch.
- **`policyContentHash`** (optional): proves _which policy content_, not merely which
  version string, produced this decision. Policy governance (Chapter 14) permits in-place
  content edits to an existing version string, so a version-string comparison alone can't
  detect every real policy change. Optional so every authorization signed before this field
  existed keeps verifying unchanged; absent means "not covered by this check," never "policy
  is stale."
- **`signalsHash`** (optional, newest field): the direct sibling of `policyContentHash`, one
  layer further out. A canonical hash of the runtime `PolicySignals` the decision was
  evaluated against. `businessTransactionHash` proves _what_ gets executed hasn't changed;
  `policyContentHash` proves _which rules_ approved it haven't changed; `signalsHash` proves
  the _real-world facts_ those rules were evaluated against haven't changed either. Chapter 8
  covers the check that actually uses it.

## Signing

`AuthorizationSigner.sign(input, privateKey, keyId, ttlSeconds)` supplies the parts the
caller can't (`authorizationId`, `nonce`, `authorizedAt`, `expiresAt`, `businessTransactionHash`)
and delegates the raw signature to `ArtifactSigner` over `CanonicalSerializer` (Chapter 6).
It validates `ttlSeconds` before computing `expiresAt`. A non-positive TTL throws
immediately rather than producing an authorization that's already expired or expires
instantly. `RuntimeAuthorizationSigner` (in `packages/runtime`) is the thin wrapper
`RuntimeEngine` actually calls, using the same `CryptoBootstrap`/`FileKeyProvider` mechanism
already used to sign trust records and receipts, keyId `"default"`.

## Verifying: `EnvelopeVerifier`'s ordered checks

`EnvelopeVerifier.verify()` runs, in this exact order:

1. **`keyValid`** (optional, only when a `keyProvider` is supplied): resolves the
   authorization's own `keyId` via the provider, checking a `keyExpiryStore` for
   `revoked`/`expiresAt`. A missing, unreadable, expired, or revoked key resolves to
   `undefined` rather than falling back to a static key. Fails closed, never silently
   degrades to a weaker check.
2. **`versionSupported`**, **`signatureVerified`**, **`notExpired`**: delegated to
   `AuthorizationVerifier.verify()` using whichever key resolved in step 1.
3. **`ttlWithinPolicy`**: recomputed independently, `(expiresAt - authorizedAt) / 1000 <=
maxTtlSeconds` (default 300s). This isn't redundant with `notExpired`. An authorization
   can be unexpired _and_ have been issued with a TTL a receiving system's own policy
   considers too long, and this check catches that case specifically.
4. **`nonceUnseen`**: deliberately isolated into its own method, `consumeNonce()`, called
   only if every check above passed. The reasoning is explicit in the source: running nonce
   consumption earlier risks an attacker poisoning a legitimate nonce with a forged or
   expired envelope, burning the real caller's single use before their genuine request
   arrives. Side effects go last, always, in this codebase. Chapter 8's `ExecutionGateway`
   and Chapter 15's `ApprovalVerifier` both repeat this exact ordering discipline
   independently, for the same reason each time.

`verifyChecks()` exposes the four side-effect-free checks without consuming the nonce,
specifically so a caller like `ExecutionGateway` can insert its _own_ additional checks
(`businessTransactionHash`, `policyStillCurrent`, `signalsStillCurrent`, Chapter 8) into the
sequence before the one side-effecting step runs. `NonceStore` (interface: a single
`checkAndRecord(nonce, expiresAt): Promise<boolean>`) carries its own explicit production
warning in its doc comment: an in-memory implementation loses all state on restart, meaning a
replay is possible again within the original TTL after any restart. The persistence window
only needs to cover the max TTL, but it does need to exist in production (Chapter 11 covers
which store is actually used where).

---

[← Book Index](README.md) · [← Previous: Chapter 6, Cryptography](06-cryptography.md) · [Next: Chapter 8, The Execution Gateway →](08-execution-gateway.md)
