# Parmana — The Unavoidability Arc

_The path from "verify it yourself" to "AI structurally cannot act alone."_
_Strategy document. Snapshot: July 5, 2026._

> **The north star for this arc:**
> _"It does not yet make Parmana unavoidable — that's the next arc, where AI systems
> stop holding execution credentials at all and the authorized path becomes the only
> reachable one. We'll write about that as we build it, not before."_

---

## Where this arc starts

The provability layer is done: every approved action carries a signed, content-bound,
single-use authorization that receiving systems verify independently, byte-for-byte.

What that does NOT yet do: it makes Parmana's authorization **verifiable**, not
**unavoidable**. Today an AI still holds whatever execution credentials it was given;
Parmana authorizes, but the AI _could_ act without asking. This arc closes that gap.

---

## The three moves, in dependency order

### Move 1 — KMS / HSM key custody (~2 weeks, safe to build now, standalone)

**What:** Parmana's signing key moves into a KMS/HSM and never exists in an application
process. Signing becomes an operation Parmana _requests_, not a secret it _holds_.

**Why first — three reasons:**

1. It's the only one of the three genuinely safe to build well in isolation — no
   dependency on a partner's environment, known interface, clear correctness criteria.
2. It's the prerequisite that makes "sole execution authority" coherent. The first
   question any security architect asks about a single authority is "what protects its
   key?" Today's answer — a PEM file on disk — is inadequate, and there is a live
   incident (the key was committed to public GitHub) proving it.
3. It retroactively hardens every signature claim already made.

**The claim it unlocks:** _"Parmana's signing key cannot be exfiltrated from the
application process."_

**Known design questions (Phase 1 investigation resolves these):**

- Interface inversion: today `ArtifactSigner.sign(artifact, privateKey)` requires the
  caller to HOLD the key; KMS inverts this (the provider signs, key never leaves). Likely
  a `SigningService` abstraction with `LocalKeySigner` (current behavior, byte-for-byte)
  and `KmsSigner` implementations, behind the existing provider seam.
- Algorithm support: does AWS KMS support Ed25519? If not, the `ecdsa-p256` enum value
  already in `SignatureAlgorithms` becomes relevant, with envelope/receipt
  algorithm-field implications. ML-DSA in KMS is not yet broadly available — PQ + KMS is
  a matrix to document, not assume.
- CI without live AWS: an in-repo fake implementing the same `SigningService` interface
  for the default suite, plus a separately-runnable live integration test. The claim
  flips to Supported only when the LIVE test has run against a real KMS key — a fake
  passing is not the claim.

---

### Move 2 — Credential brokering, one system class (~4–8 weeks, needs a design partner)

**What:** the architectural leap. A verified envelope causes the GATEWAY to mint a
short-lived, action-scoped credential (AWS STS first), use it against the target system,
and discard it. The AI never receives the credential — structurally, not by instruction.
This is where "AI systems stop holding execution credentials" becomes literally true, for
one system class.

**Why it needs a partner, not a mock:** built against a fake AWS account, this proves
nothing a diligence review would trust — you'd be guessing at the STS session-policy
shape, the action taxonomy, and the real failure modes, then rebuilding when a real
environment contradicts them. For a trust-infrastructure company, "we built it against a
fake account" is worse than "it's the next thing we build": the first invites the
question of whether it works in reality; the second is honest roadmap.

**Schema impact:** extending the envelope with resource/action fields is a signed-artifact
format change → a dedicated versioned session, never a rider. (The v1 `version` field
added in the gateway work is exactly what makes this clean.)

**The claim it unlocks (scoped):** _"For [action class] on AWS, AI never possesses
execution credentials."_ Scoped to the integrated system class — never universal.

---

### Move 3 — Network enforcement + bypass detection (per-deployment; needs a red team)

**What:** making the authorized path the ONLY reachable one. Network-policy templates
(firewall / security-group / K8s NetworkPolicy) so the target's ingress accepts traffic
only from the gateway, plus a reconciliation loop comparing the target system's own
activity log against issued authorizations — any action without a matching envelope
raises an alert.

**Why last:** it's a property of a customer's deployment, not of code alone, and it's
proven by a partner's security team trying to break it, not by a unit test.

**The claim it unlocks (permanently scoped):** _"Non-bypassable per integrated system
under the reference deployment; bypass detected everywhere."_

---

## The recommended sequencing (both tracks)

```
CODE TRACK                          BUSINESS TRACK (parallel, starts NOW)
──────────                          ────────────────────────────────────
Move 1: KMS custody   ───────────►  Start design-partner conversations
  (build now, ~2 wks)                 (Move 2 needs a real AWS workflow)
        │                                        │
        ▼                                        ▼
   KMS lands  ────────── AND ──────────  a partner workflow in hand
        │                                        │
        └────────────────┬───────────────────────┘
                         ▼
        Move 2: Credential brokering
        (shaped by the partner's real environment)
                         │
                         ▼
        Move 3: Network enforcement + bypass detection
        (proven by the partner's red team)
```

**The rule that holds the whole arc together:** when you build the "unavoidable" layer,
every piece rests on something solid — an un-stealable key (Move 1), a real workflow
(partner), and a red team (Move 3). Nothing built on a guess you'll tear out.

**What NOT to do:** build credential brokering against a mock just to have it done, or
down-tools engineering to go find a partner. The partner search runs in parallel on the
business track; KMS is the thing that's safe to build while those conversations develop.

---

## The permanent ceiling (say it proudly, in every version of this arc)

- **"Non-bypassable, period"** — never claimable. Break-glass, SSH, vendor consoles, and
  legacy static credentials are load-bearing enterprise requirements, not gaps. The
  honest ceiling is always "per integrated system under the reference deployment."
- **"Universal credential isolation"** — never. It is per-system-class, earned per
  integration.
- **"The policy is correct"** — never. Parmana proves rules were _followed_, not _wise_.

---

## Immediate next artifact

**Session 8-KMS Phase 1 — investigation prompt** (report-only): interface impact of
KMS-holds-the-key, which algorithms KMS supports, the fake-vs-live CI test strategy, the
config surface (the `aws-kms` enum value already exists — wire it for real), and the
signing-latency question (every approval gains a KMS round trip — locate hot-path vs
cold-path signing calls).

Ready to generate on request.
