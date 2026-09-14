# 01 — ACHIEVED

_Sessions 1–8, plus two unplanned incident-response detours. Snapshot: July 5, 2026._

---

## 1. The transformation, at a glance

| Dimension            | Before                                                   | After                                                                             |
| -------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Core claim           | "Trust our audit log"                                    | **"Verify it yourself — byte-for-byte"**                                          |
| Execution boundary   | Unsigned plain JSON                                      | Signed, versioned, content-bound, single-use, expiring envelope                   |
| Receiving side       | Nothing to verify with                                   | `@parmana/envelope-verifier` + `@parmana/execution-gateway`                       |
| `/verify` endpoint   | Passed ANY well-formed record (stub stages)              | Real: integrity + signature + authorization-binding, tamper-proven end-to-end     |
| Content binding      | Bound to ID only (same-ID/different-payload attack open) | Closed — hash mismatch rejected at the gateway, both hashes named                 |
| Post-quantum         | Broken provider: throwaway keys, wrong interface         | ML-DSA-65 genuinely selectable, persistent keys, fail-closed key/algorithm guards |
| Key custody          | Private key committed & **public on GitHub**             | Rotated, gitignored, compromise documented                                        |
| Test suite           | Placeholder `expect(true)` stubs pervasive               | **208 passed + 1 skipped, 12 packages**, hermetic core                            |
| Claims discipline    | Aspirational README text                                 | `docs/CLAIMS.md` — every claim cites its test                                     |
| Public README status | "Verification ✅ Complete" (false)                       | Corrected to a truthful status table                                              |

---

## 2. Shipped artifacts

**New packages (2):**

- `@parmana/envelope-verifier` — receiving-side verification: signature, expiry, TTL cap,
  single-use nonce. ~10 lines of middleware to adopt. Now split into a two-phase API
  (`verifyChecks()` + `consumeNonce()`) so the gateway can insert its content check in
  the correct order.
- `@parmana/execution-gateway` — the sole release boundary within Parmana. Composes
  envelope verification + canonical content-hash comparison, forwards byte-identical
  content to a connector, stateless reject on mismatch. 18 tests (9 cases × 2 algorithms).

**Wire format:**

- `ExecutionAuthorizationPayload` v1: `version` (fail-closed on unknown), `nonce`,
  `businessTransactionHash` (content binding), identity + policy fields, ISO timestamps.
  Format locked _before_ any external consumer exists — the cheapest possible moment.

**Shared primitives:**

- `AuthorizationSigner` / `AuthorizationVerifier` (Ed25519 + ML-DSA-65)
- `ExecutableContentHasher` — single-sourced canonical hash of
  `{businessTransactionId, action, target, parameters}`, used by BOTH signer and gateway
- `DEFAULT_KEY_ID` centralized constant

**The demo (example 04) — five live scenarios:**

1. Valid envelope → HTTP 200 accepted
2. Replayed envelope → 403 (`nonceUnseen: false`)
3. Tampered payload → 403 (`signatureVerified: false`)
4. Missing authorization → 401
5. **Authorized + modified payload → rejected** (`businessTransactionHashMatches: false`,
   both hashes named)

---

## 3. Real verification, made live

The old six-stage `packages/verification` pipeline — discovered to be **entirely unwired
scaffolding** with placeholder stages beside the actually-live path — was deleted.
Verification now lives in one place (`verification-service.ts`) and performs three real
checks:

- **Integrity** — recompute canonical trust-record hash, compare to stored
- **Signature** — cryptographic Ed25519/ML-DSA verification
- **Authorization binding** — every APPROVED execution carries its authorizationId

Proven end-to-end: a transaction tampered in live storage → `/verify` returns FAILED.
This is the first time the endpoint's fail-closed behavior was demonstrated rather than
assumed.

---

## 4. Test baseline

**208 passed + 1 skipped, 12 packages** (strictly-hermetic variant: 190 passed +
19 skipped, with Supabase suites skipping gracefully).

Journey: crypto had **zero** real tests at the start (all placeholders) → now every
package carries real coverage. The determinism test, the tamper tests, the
nonce-ordering test, the same-ID/different-content test, and the byte-identity test are
each the code-level receipt for a specific public claim.

---

## 5. Defects found and eliminated

Five latent defects surfaced and were fixed during the arc — three of them arriving from
work done outside the review loop:

1. **Ephemeral Dilithium3 keys** — provider generated a throwaway keypair per
   instantiation while claiming persistence; nothing it signed could ever verify.
2. **TypeScript bivariance hole** — that same provider type-checked cleanly while
   silently discarding caller-supplied keys.
3. **Fake permit hash (commit 39c89e9, tag v1.1.0)** — a prior "execution permit" whose
   `transactionHash` was the entire content base64-encoded, labeled `sha256`, with
   `createHash` never called. Reverted.
4. **`df5d060` contract break** — a return-shape change that silently broke 9 consumers
   (tests + 6 public tutorials) with no test noticing, because examples aren't in the suite.
5. **Exposed signing key** — the private key committed and public on GitHub. Rotated,
   purged from the working tree, compromise documented.

Each is logged in detail in `04-INCIDENTS-LOG.md`.

---

## 6. Claims now supportable (present tense, test-cited)

1. Every approved execution carries a signed, single-use, time-bounded, **content-bound**
   authorization (Ed25519 default; ML-DSA-65 configurable).
2. Receiving systems verify independently — no trust in Parmana's runtime or database.
3. Forged / tampered / expired / replayed / **modified-content** requests are rejected,
   each named.
4. Parmana's own verification catches tampering (proven against live storage).
5. Post-quantum ready (FIPS 204, one env var, fail-closed).
6. No prompt injection can alter what the AI may do (deterministic policy, no model in
   the enforcement path).
7. The enterprise system executes exactly what was authorized — byte-for-byte, verified
   at the gateway boundary.
