[← Book Index](README.md) · [← Previous: Chapter 17, Testing Philosophy](17-testing-philosophy.md)

# Chapter 18: History and Open Questions

A chronological account of the incidents and reversals that shaped the design choices in the
preceding chapters, followed by an honest list of what this codebase has not resolved.

## The key-compromise incident (before 2026-07-05)

The default signing key (`keys/default.private.pem`/`.public.pem`) was publicly exposed in a
Parmana Systems GitHub repository, not this repository's own history, but the key itself is
compromised regardless of which repository leaked it. Every signature that key ever produced
is void for authenticity purposes, retroactively. The key pair was rotated 2026-07-05.
Chapter 6's `FileKeyExpiryStore`/`EnvelopeVerifier` key-revocation check postdates this
incident and exists specifically so a future compromise doesn't require waiting for every
verifier in the field to notice a rotated public key on its own.

## The Razorpay arc: built, run live, removed in full (through 2026-08-12)

Chapter 10 covers the connector itself in depth. The arc is worth restating on its own here
because it's the single largest example in this codebase of a full build-operate-remove
cycle: a real connector, refund-creation capability, its own signal-state verifier, an
out-of-band settlement processor fetch-verifying webhook claims against Razorpay's own API
rather than trusting them, an atomic daily-cumulative-refund-cap ledger, live-mode
validation against a real ten-rupee payment with a genuine webhook and signed settlement
confirmation, then, on 2026-08-12, removed in full: code, tests, credential provider, docs
pages, environment variables, database migration references. The removal itself is outside
this book's scope to evaluate. What's in scope is what it revealed about the rest of the
system's design (nothing upstream referenced it by name, so removal required no changes to
`RuntimeEngine`/`PolicyEngine`/`ExecutionGateway`) and what it cost in ways that took months
to fully surface (the documentation-staleness cleanup, Chapters 10 and 17).

## G-24 through G-31: closing the "declared vs. true" and "true then vs. true now" gaps

These four gap numbers trace one continuous line of thinking, each closing a narrower version
of the same underlying question: the caller declared X; is X actually true, and is it still
true?

- **G-24** (RFC-0022, "residual closure"): established that `SignalIntentBinder` proves a
  declared signal describes the same *action* as Intent, but never proves the signal is
  *true*, and introduced the `SignalStateVerifier` port (Chapter 3) as the deliberately
  separate, optional mechanism for that.
- **G-27**: `payments:execute`/vendor-payment, a mock connector registered unconditionally
  in an earlier build, was never on the actual product roadmap as a real capability. Rather
  than building the independent verification that would have been required to keep it
  honestly, it was removed from the repository outright, a smaller, earlier instance of the
  same "remove rather than half-fix" instinct visible in the Razorpay removal.
- **G-30**: the capability-coverage test asserting "every registered capability is bound"
  didn't actually read the registry (Chapter 4); a real connector went unbound for six days
  before an unrelated audit noticed.
- **G-31**: the newest, closing the *temporal* half of the same question: a decision's
  signals were verified once, at decision time, but never re-checked at the moment of
  execution, meaningful specifically for a `SignedExecutionAuthorization` handed to a
  decoupled downstream receiver, verified independently, possibly much later (Chapter 8).

Read together, G-24 and G-31 are the same insight applied at two different moments: proving a
declared fact is true isn't a one-time property, it's a moment-in-time property, and a system
that only checks it once has a gap shaped exactly like the interval between that check and
whatever happens next.

## TD-22 / G-30's fix: extracting `@parmana/capability-registry`

Covered in Chapter 4 in depth. Worth restating the meta-lesson here: the fix didn't just add
a missing table entry, it also relocated the table and its binder into a new leaf package
specifically to remove a dependency-cycle risk the original location made structurally
unavoidable. A six-day production gap led to a package-boundary decision, not just a
one-line patch, because the shallow fix alone wouldn't have addressed why the gap was
possible to introduce unnoticed in the first place (Chapter 4's closing section is explicit
that even the fix's own coverage test remains a hand-maintained literal, not fully closed).

## Open questions this codebase has deliberately not resolved

**Internal vs. external policy authoring** (Chapter 14). Maker-checker governance answers
*how* a policy change gets approved, given Parmana is the system of record. It doesn't
answer whether Parmana *should* be that system of record. An architecture where policies
are authored and approved externally, with Parmana staying strictly enforcement-only, remains
undecided, not rejected.

**The human-vs-AI-agent identity problem underneath step-up authorization** (Chapter 14). A
`credentialHolderType === USER` flag is exactly as trustworthy as whoever set it at
provisioning time. Nothing in this codebase, or in bearer-token/asymmetric-key schemes
generally, can technically verify the entity holding a private key is human. The mitigation
is an operational rule (key generation on a device with no AI agent access) enforced by
nobody's code.

**Single-process scope on nonce stores and rate limiting** (Chapters 7, 11, 12). Both are
explicit about this rather than silent: an in-memory `NonceStore` loses all state on restart;
`express-rate-limit`'s default store means a fleet of N machines enforces N times the stated
per-caller limit, not one fleet-wide limit. Both are documented as known, not fixed.

**Whether `@parmana/replay`/`@parmana/receipt` should be wired in or retired** (Chapter 16).
Real, tested code with no production consumer. Nobody has decided to finish wiring them in or
to delete them; they exist in the state this book found them in.

**GitHub branch protection is technically ready but not enabled.** A fail-closed CI job
(`scripts/verify-policy-changes-approved.ts`) already catches a direct, unapproved edit to a
`policy.json` file bypassing the maker-checker API entirely, hashing the live file content
against the durable approval record for that `(policyName, policyVersion)` via a read-only,
RLS-scoped credential, and failing the build on any mismatch, missing record, or even a
failed check itself (fail-closed, the opposite discipline from the fail-open startup
integrity check in Chapter 14). What's missing is telling GitHub to treat that job's result as
a required condition for merging into `main`. Enabling branch protection was attempted
directly and failed with an externally-imposed constraint: `403 Upgrade to GitHub Pro or make
this repository public`, not a code or configuration gap on this project's side. Precise
current state: an unapproved edit landing directly on `main` will be caught and reported by
CI, visibly, but is not currently *prevented* from landing. Detection is real and automatic;
prevention needs either a paid plan or a visibility change, and neither decision has been
made.

## Why this chapter belongs in a book about architecture, not just a changelog

Every other chapter in this book describes a mechanism as it exists today. This one exists
because a mechanism's current shape is usually the residue of a specific incident or a
specific gap someone found. The check ordering in Chapters 7 and 8 (side-effect-free first,
nonce last) isn't an arbitrary style choice; it's a direct response to a named
replay-poisoning risk. The sign-before-write ordering in Chapter 14 isn't a preference; it's
proven by a test that injects failure at each step specifically because the alternative
ordering was considered and rejected as unsafe. Understanding *why* the code is shaped the
way it is, which is the whole premise of this book, requires knowing what it used to look
like, and what went wrong the one time it didn't look like this.

---

[← Book Index](README.md) · [← Previous: Chapter 17, Testing Philosophy](17-testing-philosophy.md)

*This is the final chapter.*
