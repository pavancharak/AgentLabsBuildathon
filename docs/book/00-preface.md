# Preface

## What this book is

An explanation of how Parmana is built, written for someone who needs to extend, audit, or
reason about failure modes in this codebase — not a marketing document, not a spec of what
the system should eventually do, and not a duplicate of `docs/CLAIMS.md`'s evidence ledger.
Every factual claim in these chapters is traced to a file, usually to a line range, and
where a source comment is quoted, it is quoted verbatim rather than paraphrased — this
codebase writes unusually substantive "why" comments, and paraphrasing them loses the exact
reasoning a future reader needs.

## How to read it

The chapters are ordered the way a request actually flows through the system: a policy gets
loaded and evaluated (Chapters 2–4), a decision becomes a signed authorization (Chapters
5–7), that authorization gets independently re-verified and released (Chapter 8), a
connector executes without ever holding a leaked credential (Chapter 9), and the result is
durably stored and auditable (Chapters 11, 15). Chapters 10, 12–14, 16–18 branch out from
that spine: connectors, the HTTP surface, identity and governance, and the honest state of
things that don't fit the spine cleanly.

You don't need to read start to finish. Each chapter names the files it's about in its first
paragraph, so it works as a reference — "what does `ExecutionGateway` actually check, in
what order, and why" is answerable from Chapter 8 alone.

## Epistemic standard

This book was written by reading the actual source on 2026-09-05, in the same session that
closed G-31 (signal-freshness verification at the execution boundary), audited and cleaned
up a large amount of stale Razorpay-connector documentation across `docs/site/` and
`examples/tutorials/`, and extended this repo's own citation-integrity test
(`tests/architecture/documentation-references.test.ts`) to check `docs/CLAIMS.md`'s own file
citations for the first time. That last fact matters for how to treat this book itself: it
is a snapshot, not a living document that updates itself. Treat any code excerpt or line
number here the way `documentation-references.test.ts` treats a citation — as a claim that
was true when written, worth re-checking against the file directly before relying on it for
something consequential, especially as the codebase continues to change.

## Relationship to everything else

- **`docs/CLAIMS.md`** — supported and conditional claims, each with an Evidence section.
  Read it to check whether something specific is currently proven, and by what test.
- **`docs/VERIFICATION-GAPS.md`** — a dated log of gaps found and closed (or not). Read it
  for the history of a specific weakness, including ones later fixed.
- **`docs/site/`** — the customer-facing docs (Mintlify). Lighter register, written for an
  integrator calling the HTTP API, not someone reading the TypeScript source.
- **`docs/000-CONSTITUTION.md` through `docs/017-CONFORMANCE.md`, root-level `ARCHITECTURE.md`,
  `SPECIFICATION.md`, `TRUST_MODEL.md`, `GUARANTEES.md`, `PROOFS.md`** — superseded by date
  (last touched late June/early July 2026, before most of what this book describes existed).
  Kept as historical record, not deleted, matching this codebase's own convention for
  describing removed or superseded things (see Chapter 18) — but do not treat them as
  current.
- **`examples/tutorials/`** — not documentation about the system so much as executable proof
  of it: over 100 small, runnable scripts, each demonstrating one concept directly against
  real code. Chapter 17 treats the tutorial suite as a first-class part of the testing
  philosophy, not an afterthought.

## What "unambiguous" means here

Where the codebase itself is unambiguous — a check either runs before another or it doesn't,
a field is either optional or required — this book states it plainly and cites the line.
Where the codebase is *itself* still undecided — internal vs. external policy authoring
(Chapter 14), the human-vs-AI-agent identity problem underneath step-up authorization
(Chapter 14), whether `@parmana/replay`/`@parmana/receipt` should be wired in or retired
(Chapter 16) — this book says so explicitly, in Chapter 18, rather than picking a side the
code hasn't picked. An honest "this is still open" is more useful than a confident
overstatement, and overstatement is exactly the failure mode this whole documentation
ecosystem has repeatedly had to catch and correct in itself (the Razorpay-staleness cleanup
earlier in this same session is one instance of many; `docs/VERIFICATION-GAPS.md` records
several more).
