[← Book Index](README.md) · [← Previous: Chapter 16, Verification, and Two Orphaned Models](16-verification-and-orphaned-models.md)

# Chapter 17: Testing Philosophy

`tests/architecture/documentation-references.test.ts`, `examples/tutorials/`, and the
hermetic/live split visible throughout `packages/*/tests/`.

## Three layers, and a fourth this codebase treats as a first-class layer too

Unit tests exercise one class in isolation (`packages/*/tests/unit/`). Integration tests
exercise a real HTTP server built from the real production bootstrap functions
(`createExecutionSystem()`, `createApplication()`, `createApp()`) rather than calling
internal functions directly, `packages/api/tests/integration/`. A smaller set of e2e tests
exercise a full request through the real database layer. The fourth layer, easy to
under-value from outside this codebase, is `examples/tutorials/`: over a hundred small,
runnable scripts, each demonstrating exactly one concept directly against real code, checked
into the repository and run as a suite (`npm run examples`, via `scripts/run-examples.ts`)
the same way a test suite is. A tutorial isn't a substitute for a unit test. It has no
assertions library, no CI gate on its own. But it is executable documentation in the
strongest sense: the claim "here is how signal freshness verification actually behaves" is
backed by a script anyone can run and read the real output of, not a prose description that
could silently drift from the code it describes.

## Hermetic first, then live, never the reverse

The HubSpot connector's own test suite is the clearest example of a pattern this codebase
applies consistently: hermetic tests first (`packages/connector-hubspot/tests/unit/`, no
network calls beyond localhost, run on every `npm test`), then a gated live suite second
(`hubspot-live.integration.test.ts`), behind an explicit opt-in env var
(`ALLOW_LIVE_HUBSPOT=1`) plus a credential shape check (`TEST_HUBSPOT_PRIVATE_APP_TOKEN` must
start with `pat-`, checked _before_ any network call), skipped by default so it never
becomes part of ordinary `npm test` behavior. The Razorpay connector's own now-historical
test suite mirrored this exact structure (`RAZORPAY_TEST_KEY_ID`'s `rzp_test_` check, the
same idea). Live tests exist and are run periodically, deliberately, not as a substitute for
hermetic coverage but as a check that the hermetic coverage's assumptions about the real
external API still hold.

## Citation integrity: catching documentation that quietly stopped being true

`tests/architecture/documentation-references.test.ts` is a small, deliberately
narrow-scoped test with an unusually direct mandate, stated in its own header comment: "not
a prose/content checker (too heavyweight, too brittle for what this needs to catch). Just the
cheap, high-value check: every backtick-quoted file path these architecture docs cite as
evidence must actually exist." It does two things: checks that every cited file path in a
fixed list of architecture docs resolves to a real file, and separately, checks that every
`CLAIMS.md §N.M`-style section citation found anywhere in `docs/CLAIMS.md` itself,
`docs/site/**/*.mdx`, `README.md`, `DEPLOYMENT.md`, or `SECURITY.md` resolves to a header that
actually exists in `docs/CLAIMS.md` today (read live, never a hardcoded copy that could
itself drift).

It maintains two deliberate exemption sets rather than trying to be exhaustive:
`HYPOTHETICAL_EXAMPLE_PATHS` (paths that were _never_ real, a worked "how you'd add a Stripe
connector" walkthrough) and `HISTORICALLY_REAL_NOW_REMOVED_PATHS` (paths that _were_ real,
are cited as an accurate historical record of something later deliberately removed, and
whose citation is explicitly self-caveated in the surrounding prose as historical). The
distinction matters: a hypothetical was never a claim about the present; a historical
citation was true when written and the prose around it says so. Rewriting either kind of
citation to point somewhere else would falsify the record rather than fix a bug.

**This test's own history is itself the best evidence for why it exists.** It was extended
twice, months apart, each time because a real gap in its own coverage let something rot
silently. First, when the Razorpay connector's removal (Chapter 10) left roughly twenty stale
citations scattered across `docs/site/` and `examples/tutorials/*/README.md`, files this
test didn't check at all, since its `docsToCheck` list was five architecture docs, not the
customer-facing site or the tutorial suite. Second, in the same session that produced this
book, when a re-examination of the test noticed that `docs/CLAIMS.md` itself, despite being
the single largest source of file-path citations in the entire repository (its Evidence
sections cite roughly 180 of them), was never in `docsToCheck` at all, and the pattern used to
extract citations didn't even match the path shapes CLAIMS.md actually uses (`examples/`,
`scripts/`). Adding it and widening the pattern surfaced five real, previously-undetected
citations, four Razorpay-historical, one describing a file moved during an earlier refactor,
all legitimate once traced to their surrounding prose, none previously caught, because
nothing had ever checked them. Both extensions found real drift the moment they were pointed
at content that hadn't been checked before. That's the pattern worth internalizing more than
either specific fix: **a citation nobody automatically checks will eventually go stale, and a
"complete" documentation set is only as complete as what its own tests actually cover.**

## What this means for reading any documentation in this repository, including this book

This book itself is not covered by `documentation-references.test.ts` as of this writing.
Its own Preface says so directly: treat any code excerpt or line number here as a claim that
was true when written, and, especially before relying on it for something consequential,
worth re-checking against the file directly, the same way this chapter just described the
codebase checking itself.

---

[← Book Index](README.md) · [← Previous: Chapter 16, Verification, and Two Orphaned Models](16-verification-and-orphaned-models.md) · [Next: Chapter 18, History and Open Questions →](18-history-and-open-questions.md)
