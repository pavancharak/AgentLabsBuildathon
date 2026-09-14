\# RFC-0004 — Post-Quantum Cryptography

\*\*Status:\*\* Draft

\*\*Author:\*\* Parmana Architecture Team

\*\*Created:\*\* 2026-06-25

\*\*Target Version:\*\* 0.3.0

\---

\# Summary

Introduce support for post-quantum cryptographic providers while preserving backward compatibility with existing cryptographic algorithms.

The objective is to ensure that execution records remain independently verifiable throughout the expected lifetime of the platform, even as cryptographic standards evolve.

This RFC extends the Cryptographic Agility principle established in ADR-0006.

\---

\# Motivation

Execution records may need to remain trustworthy for decades.

Future advances in quantum computing may weaken or break widely deployed public-key cryptographic algorithms.

Parmana should be capable of adopting new cryptographic standards without requiring changes to the Core domain model or invalidating historical execution records.

\---

\# Goals

\* Support multiple generations of cryptographic algorithms.

\* Preserve historical verification.

\* Enable gradual migration.

\* Avoid changes to the Core domain model.

\* Maintain deterministic verification.

\---

\# Non-Goals

This RFC does not:

\* Mandate a specific post-quantum algorithm.

\* Replace existing algorithms immediately.

\* Define key management.

\* Define certificate infrastructure.

\* Define hardware security modules.

Those concerns remain implementation specific.

\---

\# Architectural Principles

The Core domain remains cryptography agnostic.

Cryptographic providers remain replaceable.

Historical execution records remain valid.

New executions may adopt newer providers without affecting previous records.

\---

\# Provider Architecture

```text

ExecutionTransaction

&#x20;       │

&#x20;       ▼

Cryptography Interfaces

&#x20;       │

&#x20;       ▼

Provider Registry

&#x20;       │

&#x20;┌──────┼──────────────┐

&#x20;▼      ▼              ▼

Classical Hybrid     Post-Quantum

Providers Providers   Providers

```

The Runtime and Verification Engine interact only with provider interfaces.

\---

\# Supported Provider Classes

\## Classical Providers

Examples include:

\* SHA-256

\* SHA-3

\* BLAKE3

\* Ed25519

\* ECDSA

\---

\## Hybrid Providers

Hybrid providers combine classical and post-quantum algorithms during the migration period.

Example:

```text

SHA-256

&#x20;       +

ML-DSA

```

Hybrid verification succeeds only when the configured verification policy is satisfied.

\---

\## Post-Quantum Providers

Examples may include:

\* ML-DSA

\* SLH-DSA

\* Future NIST-standardized algorithms

The specification intentionally avoids hard-coding algorithm names.

\---

\# Cryptographic Metadata

Execution records SHOULD preserve:

\* Hash Algorithm

\* Signature Algorithm

\* Provider Identifier

\* Algorithm Version

\* Key Identifier

\* Provider Version

This metadata enables long-term verification.

\---

\# Migration Strategy

Migration occurs gradually.

```text

Generation 1



SHA-256

Ed25519



&#x20;       │



Generation 2



SHA-256

Ed25519

ML-DSA



&#x20;       │



Generation 3



SHA-3

ML-DSA



&#x20;       │



Generation 4



Future Providers

```

Older execution records remain verifiable.

\---

\# Verification

The Verification Engine SHALL:

\* Select the correct provider.

\* Validate signatures.

\* Validate hashes.

\* Report unsupported algorithms.

\* Preserve deterministic behavior.

Verification SHALL NOT rewrite cryptographic metadata.

\---

\# Replay

Replay SHALL use the algorithms recorded with the original execution.

Replay SHALL NOT substitute newer algorithms automatically.

This preserves historical correctness.

\---

\# Runtime

The Runtime delegates all cryptographic operations to provider interfaces.

The Runtime SHALL remain independent of concrete cryptographic algorithms.

\---

\# Storage

Storage preserves cryptographic metadata exactly as recorded.

Storage SHALL NOT regenerate hashes or signatures.

\---

\# Package Mapping

```text

packages/



crypto/

&#x20;   src/

&#x20;       providers/

&#x20;           classical/

&#x20;           hybrid/

&#x20;           postquantum/



&#x20;       HashProvider.ts

&#x20;       SignatureProvider.ts

&#x20;       ProviderRegistry.ts

```

No changes are required to the Core package.

\---

\# Compatibility

This RFC is fully backward compatible.

Existing execution records remain valid.

Existing providers continue to function.

New providers may be introduced without changing the execution model.

\---

\# Alternatives Considered

\## Immediate Algorithm Replacement

Rejected because it would invalidate historical verification workflows and complicate long-term archival.

\---

\## Hard-Coded Post-Quantum Algorithms

Rejected because cryptographic standards continue to evolve.

Parmana should depend upon provider interfaces rather than specific algorithms.

\---

\## Runtime-Specific Cryptography

Rejected because interoperability requires a common cryptographic abstraction.

\---

\# Open Questions

\* Should hybrid signatures become the default during migration?

\* Should cryptographic policy become configurable?

\* Should provider trust policies be standardized?

\* Should algorithm deprecation be represented within protocol metadata?

\---

\# Acceptance Criteria

\* Provider registry supports multiple algorithm families.

\* Runtime remains algorithm independent.

\* Verification supports multiple provider generations.

\* Historical execution records remain verifiable.

\* Replay preserves original cryptographic metadata.

\* No Core domain changes are required.

\---

\# References

\* 005-CRYPTOGRAPHY.md

\* 010-EVIDENCE.md

\* 013-VERIFICATION-ENGINE.md

\* 014-EXECUTION-TRUST-MODEL.md

\* 016-PLATFORM-GUARANTEES.md

\* ADR-0006 — Cryptographic Agility
