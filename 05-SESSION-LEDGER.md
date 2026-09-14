# 05 — SESSION LEDGER

_Session-by-session record of what changed and why. Snapshot: July 5, 2026._

All work was done via Claude Code under a strict protocol: investigation stop-gates
before implementation, full diffs presented, no recursive deletes (file-by-file with
proof), and review before commit.

---

## Session 1 — The proof artifact

**Packages:** `shared`, `crypto`

- `ExecutionAuthorizationPayload` + `SignedExecutionAuthorization` wire types (ISO-string
  timestamps for JSON-transport stability).
- `AuthorizationSigner` / `AuthorizationVerifier` delegating to existing Ed25519 +
  canonical serialization.
- 7 tests — the **first real test coverage the crypto package ever had**.

## Session 2 — Wired into the runtime

**Packages:** `runtime`, `execution-system`, config

- Authorization constructed, signed, and attached to the outgoing request after
  `ExecutionGate` approves; rejected decisions produce none.
- `authorizationId` bound inside the hashed/signed trust record — proven by a
  tamper-breaks-the-hash test.
- Same key path as receipts/trust records (no second key-loading fork); TTL configurable.

## Session 3 — The receiving side

**Package:** `@parmana/envelope-verifier` (new)

- Signature + expiry + TTL cap + single-use nonce checks; Express middleware.
- The subtle property, tested: forged/expired envelopes do **not** burn the nonce.
- README written for an external engineer with honest scoping.

## Session 3.5 — Post-quantum fix (unplanned)

**Package:** `crypto`

- Discovered and fixed INC-3 (ephemeral keys) and INC-4 (bivariance hole).
- Dilithium3 rewritten on native Node 24 `ml-dsa-65`; persistent keys; cross-instance
  test; key/algorithm binding guards on both providers; keygen script corrected.
- Post-quantum signing became a genuinely true claim.

## Session 4 — Proof & paper

**Docs / examples**

- Example 04 (4-scenario verified-execution demo), `docs/CLAIMS.md` established, PQ docs
  corrected, root-README "Verification ✅ Complete" flagged for correction.

## Incident response — Key exposure (unplanned)

- INC-1: private key found public → rotated, gitignored, compromise documented.

## Incident response — `df5d060` regression (unplanned)

- INC-5: return-contract break → all 9 consumers fixed; first full-workspace green run
  (172 tests) established as the real baseline.

## Session 5 — Verification consolidation

**Packages:** `runtime`, deletes `packages/verification`

- Investigation found the six-stage pipeline was **unwired scaffolding** beside the live
  path. Chose Option B: delete the scaffolding, add the authorization-binding check to
  the real `verification-service.ts`.
- Three live checks: integrity, signature, authorization binding. Tamper-catching proven
  end-to-end against live storage. 6 example scripts rewired to the live path.

## Session 7 — Cleanup pass

**Repo-wide**

- Dead code deleted (file-by-file with proof); `@noble/post-quantum` removed; **all
  placeholder tests replaced with real ones** (zero `expect(true)` remaining); test suite
  made hermetic (temp key dirs, repo-relative fixtures, graceful Supabase skips);
  `DEFAULT_KEY_ID` centralized; example runners consolidated; stale "six-stage pipeline"
  language swept; root README status table corrected; root-directory fossils removed.
- New baseline: 188 passed + 1 skipped, 11 packages.

## Session 6 Phase 1 — Authority/Intent/Evidence design (investigation)

- Produced the decision table. Key finding: Intent verification is best done as content
  binding at the execution boundary — which became Session 8. Authority's honest status:
  verifies nothing new until a key registry exists.

## Session 8 — Execution Gateway

**Packages:** `shared`, `crypto`, `envelope-verifier`, `execution-gateway` (new)

- Reverted INC-2 (fake permit) first, with a green-suite checkpoint before new code.
- Payload v1: `version` (fail-closed) + `businessTransactionHash` (content binding).
- Single-sourced `ExecutableContentHasher` used by both signer and gateway.
- `envelope-verifier` split into `verifyChecks()` + `consumeNonce()` so the gateway
  inserts its content check in the correct nonce-ordering position.
- `@parmana/execution-gateway`: the sole release boundary; 18 tests (9 × 2 algorithms).
- Example 04 gained the 5th scenario: authorized + modified payload → rejected.
- New baseline: **208 passed + 1 skipped, 12 packages**.

---

## Open at snapshot time

- Session 8 close-out: duplicated-extraction deviation + full CLAIMS.md application.
- Git history purge + tag deletion + sibling-repo archival.
- See `02-REMAINING.md` for the forward roadmap.
