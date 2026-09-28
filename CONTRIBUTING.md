# Contributing to Parmana

Parmana authorizes and evidences what automated systems do, so correctness, determinism and
verifiable evidence come before convenience.

## How a change is made

1. **Its own branch from `main`**, and a pull request. Nothing is pushed to `main` directly.
2. **Tests with the change.** A bug fix adds a test that fails without it; new behavior adds
   tests for it, including the refusal paths.
3. **The full check passes.** The pre commit hook runs gitleaks, typecheck, lint, format, every
   test, the build and the runnable examples; CI runs the same. If it reports stale build
   output, run `npx tsc -b` and commit again.
4. **The records are updated in the same pull request**:
   - [docs/CLAIMS.md](docs/CLAIMS.md) when what Parmana can claim changes. A claim is written
     in the present tense only when code and tests back it.
   - [docs/VERIFICATION-GAPS.md](docs/VERIFICATION-GAPS.md) when a gap is found or closed.
   - [docs/REMAINING-WORK.md](docs/REMAINING-WORK.md) when open work changes.
   - An ADR in [docs/adr/](docs/adr/) when an architectural decision is made or reversed.
   - The published docs in [docs/site/](docs/site/) when behavior a reader relies on changes,
     and the changelog (`docs/site/changelog.mdx`).

## Principles a change must keep

- The policy decides; nothing executes without an approved decision.
- Fail closed: missing configuration, a failed check or an unavailable dependency refuses,
  never degrades silently.
- Evidence is signed and append only, and can be verified without trusting Parmana.
- Policy evaluation is deterministic.

## Connectors

Read [docs/architecture/CONNECTOR_ISOLATION.md](docs/architecture/CONNECTOR_ISOLATION.md) and
[docs/connectors/BUILDING_A_CONNECTOR.md](docs/connectors/BUILDING_A_CONNECTOR.md) before
adding one. Every connector is registered through the standard path so it gets credential
isolation; a `legacyInsecure: true` registration outside a test is not acceptable.

## Security issues

Report them privately, as described in [SECURITY.md](SECURITY.md), not in a public issue.
