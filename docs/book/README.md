# The Parmana Architecture Book

A complete, current, code-verified explanation of how Parmana is built and why — not what
it should do, what it *does*, traced to the actual source as of **2026-09-05**.

## Why this exists

This repository already has a large architecture-documentation effort: `docs/000-CONSTITUTION.md`
through `docs/017-CONFORMANCE.md`, plus root-level `ARCHITECTURE.md`, `SPECIFICATION.md`,
`TRUST_MODEL.md`, `GUARANTEES.md`, and `PROOFS.md`. All of it is frozen from late June/early
July 2026. Since then: the Razorpay connector was built, run in production, and removed in
full (2026-08-12); HubSpot and GitHub connectors were added; caller authentication,
principal/capability scoping, and policy governance (maker-checker) were built; and the
signal-freshness and policy-freshness execution-boundary checks (G-24 through G-31) were
added. None of that exists in the older documents. They are **superseded by date, not
deleted** — the same discipline this codebase already applies to removed code (see Chapter
18) — but they should not be read as current.

This book is the current replacement for "how does this actually work and why." It is not a
replacement for two other documents, which serve different jobs:

- **`docs/CLAIMS.md`** is the audit ledger: one entry per claim, each with an Evidence
  section citing exact files and tests. Read it to check whether a specific claim is
  currently proven.
- **`docs/VERIFICATION-GAPS.md`** is the dated incident and gap log: what was found missing,
  when, how severe, and how (or whether) it was closed. Read it for the history of a
  specific gap.
- **This book** is the narrative in between: how the pieces connect, and the reasoning
  behind each design choice — the thing neither a ledger nor an incident log is built to
  hold. Every factual claim here is traced to a file (and usually a line range); where a
  comment is quoted, it's quoted verbatim.

`docs/site/` (the customer-facing Mintlify docs) covers much of the same ground for an
external integrator, in a lighter register. This book goes deeper and is written for someone
who needs to *build on, audit, or extend* this codebase, not integrate against its HTTP API.

## Chapters

| # | Title | Covers |
|---|---|---|
| 00 | [Preface](00-preface.md) | How to read this book |
| 01 | [Mission and the Domain Model](01-mission-and-domain-model.md) | Positioning, caller-type-agnosticism, the trust chain of custody |
| 02 | [Policy Engine and Evaluation](02-policy-engine-and-evaluation.md) | `Policy`, `boundSignals`, determinism, `SignalIntentBinder` |
| 03 | [Signal-State Verification](03-signal-state-verification.md) | Proving declared signals are *true*, not just consistent |
| 04 | [Capability/Policy Binding](04-capability-policy-binding.md) | TD-22/G-30, the canonical binding table |
| 05 | [The Runtime Pipeline](05-runtime-pipeline.md) | `RuntimeEngine.execute()` end to end |
| 06 | [Cryptography](06-cryptography.md) | Signature providers, hashing, keys, the compromise incident |
| 07 | [The Execution Authorization Envelope](07-execution-authorization-envelope.md) | What gets signed, and why each field exists |
| 08 | [The Execution Gateway](08-execution-gateway.md) | The sole release boundary, its full check order |
| 09 | [Credential Isolation](09-credential-isolation.md) | How a connector executes without ever seeing a leaked credential |
| 10 | [Connectors](10-connectors.md) | The `Connector` contract, HubSpot, GitHub, and the Razorpay case study |
| 11 | [Storage](11-storage.md) | The repository facade, memory vs. Supabase, why some stores are never in-memory |
| 12 | [The API and HTTP Boundary](12-api-http-boundary.md) | Routes, error mapping, rate limiting |
| 13 | [Caller Authentication and Scoping](13-caller-authentication-and-scoping.md) | Identity, principal scoping, capability scoping, fail-closed audit |
| 14 | [Policy Governance](14-policy-governance.md) | Maker-checker, step-up authorization, `governance-ui` |
| 15 | [Audit and Evidence Trails](15-audit-and-evidence-trails.md) | Refusal records, signed audit events, approval artifacts |
| 16 | [Verification, and Two Orphaned Models](16-verification-and-orphaned-models.md) | Independent verification, and an honest look at `@parmana/replay`/`@parmana/receipt` |
| 17 | [Testing Philosophy](17-testing-philosophy.md) | Hermetic-first, the tutorial suite as documentation, citation integrity |
| 18 | [History and Open Questions](18-history-and-open-questions.md) | The incidents, the reversals, and what's genuinely still unresolved |

## A note on honesty

Two packages that look load-bearing from their names — `@parmana/receipt` and
`@parmana/replay` — are, as of this writing, not imported by `packages/api` at all. They are
real, tested, tutorial-only code with no production wiring. Chapter 16 explains this
directly rather than presenting every package as equally central; a "bible" that overstates
its own system is worse than no documentation at all, and this codebase's own citation-
integrity discipline (Chapter 17) exists precisely to catch that kind of drift.
