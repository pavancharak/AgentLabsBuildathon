# The Parmana Handbook

Every capability this codebase has, no matter how small, explained by reading the actual
source rather than trusting existing documentation. This is a new document, written
2026-09-16, independent of the older `docs/book/` (dated 2026-09-05, not updated here) and
independent of the frozen root-level architecture documents from mid-2026. Where this book
disagrees with either, this book was written later and checked against the code that exists
today; say so if you find a place where that turns out not to be true.

## How each chapter is structured

Every chapter answers the same six questions, in the same order:

1. **What it is.** One paragraph, plain language.
2. **Why it was built.** The real problem, usually quoted from the source's own comments.
3. **How it works.** Traced to real files, usually with line numbers.
4. **How it enables things, with an example.** A real tutorial or test that proves the
   behavior, or an honest note that none exists yet.
5. **How to validate it yourself.** The exact files to open.
6. **Integration requirements**, where applicable: env vars, config, external dependencies.

## Chapters

| #   | Title                                                                                              |
| --- | -------------------------------------------------------------------------------------------------- |
| 1   | [The Trust Model and Domain Model](01-trust-model-and-domain.md)                                   |
| 2   | [Configuration and Bootstrapping](02-configuration-and-bootstrapping.md)                           |
| 3   | [Cryptography](03-cryptography.md)                                                                 |
| 4   | [The Policy Engine and Evaluation](04-policy-engine-and-evaluation.md)                             |
| 5   | [Signal-Intent Binding and Signal-State Verification](05-signal-binding-and-state-verification.md) |
| 6   | [Capability and Policy Binding](06-capability-policy-binding.md)                                   |
| 7   | [Policy Governance and the Maker-Checker Flow](07-policy-governance-maker-checker.md)              |
| 8   | [The Runtime Pipeline](08-runtime-pipeline.md)                                                     |
| 9   | [The Execution Authorization Envelope](09-execution-authorization-envelope.md)                     |
| 10  | [The Execution Gateway](10-execution-gateway.md)                                                   |
| 11  | [Credential Isolation](11-credential-isolation.md)                                                 |
| 12  | [Connectors](12-connectors.md)                                                                     |
| 13  | [The Storage Layer](13-storage-layer.md)                                                           |
| 14  | [The API and HTTP Boundary](14-api-http-boundary.md)                                               |
| 15  | [Caller Authentication and Scoping](15-caller-authentication-and-scoping.md)                       |
| 16  | [Rate Limiting](16-rate-limiting.md)                                                               |
| 17  | [Audit and Evidence Trails](17-audit-and-evidence-trails.md)                                       |
| 18  | [Independent Verification](18-independent-verification.md)                                         |
| 19  | [Health and Readiness](19-health-and-readiness.md)                                                 |
| 20  | [Integrating Parmana (Requirements and Getting Started)](20-integrating-parmana.md)                |
| 21  | [Deployment](21-deployment.md)                                                                     |
| 22  | [Testing Philosophy](22-testing-philosophy.md)                                                     |
| 23  | [History and Open Questions](23-history-and-open-questions.md)                                     |

## Corrections found while writing this book

Every chapter above was written by reading the actual current source, not by trusting
existing documentation, tutorial comments, or `.env.example`. That process surfaced real
places where something written down elsewhere in this repository no longer matches the
code. Listed here, in one place, rather than only buried inside the chapter that happened to
find each one:

- **`.env.example` claims `KEY_PROVIDER=aws-kms` "does nothing."** False. `SignerBootstrap.ts`
  implements it for real, via `KmsSigner`. See Chapter 2 and Chapter 3.
- **A live `.env` sets `KMS_REGION` and `KMS_KEY_ALIAS`.** Neither is read anywhere in
  `packages/*/src`. The real environment variables `KmsSigner.ts` actually reads are
  `AWS_REGION` and `AWS_ROLE_ARN`. Confirmed independently by two separate chapters (2/3 and
  20/21) reading the source directly. See Chapter 2 and Chapter 21.
- **`KeyBootstrap` is effectively legacy.** Its own sibling, `SignerBootstrap.ts`, states in
  its own comment that nothing in this codebase's production paths actually calls
  `KeyBootstrap` today. See Chapter 2.
- **A prior architecture assumption placed `ExecutionGateway` at
  `packages/api/src/execution-gateway/ExecutionGateway.ts`.** That path does not exist. The
  real location is `packages/execution-gateway/src/ExecutionGateway.ts`, a separate top-level
  package. See Chapter 10.
- **An older claim that `@parmana/replay` and `@parmana/receipt` are both unwired,
  tutorial-only packages is only half true.** `@parmana/replay` is confirmed genuinely
  unimported by `packages/api/src`. `@parmana/receipt` does not exist as a standalone
  package at all; receipt functionality is real and production-wired inside
  `@parmana/crypto` (`ReceiptCrypto`/`ReceiptHasher`). See Chapter 18.
- **`SupabasePolicyRepository` sits outside the `StorageProvider` facade** every other
  Supabase-backed repository in this codebase uses. This is intentional, not an oversight:
  `PolicyRepository` is an interface owned by `@parmana/policy`, not `@parmana/shared`/
  `@parmana/storage`, and predates the governance/storage split by design. Noted here so a
  reader comparing Chapter 13 against `StorageProvider.ts` doesn't mistake the asymmetry for
  a bug.
- **The rate-limiter store-reuse incident (`examples/tutorials/115`) has a documented,
  corrected misdiagnosis worth repeating here**, since it's a real lesson about not trusting
  a log line's proximity to a failure as proof of causation: the observed HTTP 500 was
  originally blamed on the `ERR_ERL_STORE_REUSE` warning; the real cause was the unrelated
  `SignerKeyProviderAdapter` signing/verification key divergence (G-48/G-49) logged in the
  same request. See Chapter 16 and Chapter 23.

## Other formats

- **Docs site (Mintlify):** the same chapters, published at `docs/site/handbook/`, discoverable
  from the main navigation.
- **PDF:** a single-file download, gated behind an email address (no verification email sent,
  see the download page for why). Generated from these same chapter files by
  `scripts/generate-handbook-pdf.ts`.

## What this book is not

It is not `docs/CLAIMS.md` (the audit ledger, one entry per claim with cited evidence) or
`docs/VERIFICATION-GAPS.md` (the dated incident and gap log). Read those for the history of a
specific claim or gap. This book is the narrative connecting the pieces, written for someone
who needs to build on, audit, or extend this codebase, or integrate against it for the first
time.
