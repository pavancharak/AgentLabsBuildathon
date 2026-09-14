# 03 — CLAIMS POSITION

_What can be said about Parmana today, and what must stay future tense._
_Snapshot: July 5, 2026. The authoritative source is `docs/CLAIMS.md` in the repo —
this is the plain-language companion._

---

## The headline

**AI proposes. Parmana authorizes — with proof. Enterprise systems verify and execute.**

Every word is now backed by tested code. The upgraded version after the gateway:

**AI proposes. Parmana authorizes — with proof, bound to the exact action. Enterprise
systems verify, and execute exactly what was authorized — byte-for-byte.**

---

## CLAIMABLE NOW (present tense, test-cited)

1. Every approved execution request carries a cryptographically signed, single-use,
   time-bounded, **content-bound** authorization (Ed25519 default; ML-DSA-65 configurable).
2. Receiving systems verify authorization independently via `@parmana/envelope-verifier`
   / `@parmana/execution-gateway` — without trusting Parmana's runtime or database.
3. Forged, tampered, expired, replayed, and **content-modified** requests are rejected,
   each named check reported.
4. The trust record is cryptographically bound to the authorization it produced
   (authorizationId inside the hashed/signed content).
5. Parmana's own verification catches tampering — proven end-to-end against live storage.
6. A rejected decision never produces an authorization (fail-closed).
7. Key/algorithm binding is guarded — mismatched key material fails closed with a clear
   error.
8. Post-quantum signing (ML-DSA-65 / FIPS 204) selectable via one env var, persistent
   keys, Node ≥ 24, fail-closed on missing/mismatched keys.
9. The enterprise system executes exactly the authorized executable content
   (`businessTransactionId`, `action`, `target`, `parameters`) — byte-for-byte, verified
   at the gateway.
10. No prompt injection can alter what the AI may do — deterministic policy, no model in
    the enforcement path.

---

## CONDITIONAL CLAIMS (the scope clause is mandatory)

- **"For any system running the Parmana verifier/gateway, execution requests not
  authorized by Parmana — or authorized but content-modified — are cryptographically
  impossible to accept."** With the clause: strongest claim (impossibility). Without it:
  false.
- **"Within Parmana-mediated execution, for systems integrated behind the gateway, no
  request reaches a connector without passing full verification."** — the sole-release
  claim, scoped to Parmana's own boundary.
- **Content binding "for execution routed through the gateway"** — requests that bypass
  the gateway are explicitly not covered.
- **Single-use is per NonceStore** — fleet-wide requires a shared persistent store.

---

## NOT YET CLAIMABLE (future tense — roadmap only)

- "AI never possesses execution credentials" — no credential brokering exists yet.
- "Non-bypassable" / "single execution authority" (unscoped) — verification is opt-in
  per endpoint; no network-level enforcement.
- "Enterprise-grade key custody" — keys are local PEM; KMS/HSM pending.
- Authority / Evidence verification checks — not implemented (Intent IS done via the
  gateway).
- "Deterministic signatures" under ML-DSA-65 — those signatures are randomized;
  verification is deterministic, signing is not (determinism is Ed25519-only).
- Algorithm migration (Ed25519 → Dilithium3 with existing records) — unsolved.

---

## CLAIMS WE INTENTIONALLY DO NOT MAKE (permanent)

- Unscoped "non-bypassable" / "single execution authority."
- "Universal" credential isolation (it is per-system-class, earned per integration).
- "The policy is correct" (Parmana proves rules were _followed_, never _wise_).

---

## Positioning notes

- **Category:** "verifiable execution authorization for AI systems" today; "Agentic PAM"
  becomes honest only after credential brokering ships. Lead with the property
  competitors lack (independent verifiability), not a bigger category than you can hold.
- **The name earns itself:** _pramāṇa_ = a valid means of knowing. Post-gateway, the
  product is named after exactly what it produces — proof, bound to the exact action.
- **The discipline is the moat:** every claim traceable to a test, every limit written
  down. Competitors can copy an envelope; they cannot retroactively acquire the habit of
  never having overclaimed.
- **Volunteer the limits** in technical diligence — doing so performs the CLAIMS.md
  philosophy, which for a trust-infrastructure vendor is itself the product.
