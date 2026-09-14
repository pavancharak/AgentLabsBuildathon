\# Parmana SDK Versioning

\*\*Version:\*\* 1.0

\*\*Status:\*\* Canonical

\*\*Applies To:\*\* All Official Parmana SDKs

\---

\# 1. Purpose

This document defines the canonical versioning strategy for all official Parmana SDKs.

The objective is to provide predictable API evolution while maintaining compatibility across SDK implementations and the Parmana platform.

Every official SDK MUST conform to this versioning policy.

\---

\# 2. Design Goals

The versioning strategy is designed to provide:

\* Stable public APIs

\* Predictable upgrades

\* Clear compatibility guarantees

\* Language parity

\* Independent implementation evolution

\* Long-term maintainability

\---

\# 3. Scope

This document governs the versioning of:

\* Official SDKs

\* Public SDK APIs

\* SDK documentation

\* SDK examples

\* SDK configuration

\* SDK error model

This document does not govern:

\* Internal Runtime packages

\* Internal Policy implementation

\* Internal verification algorithms

\* Internal replay algorithms

\---

\# 4. Semantic Versioning

Official Parmana SDKs MUST follow Semantic Versioning.

```text

MAJOR.MINOR.PATCH

```

Example

```text

1.0.0

```

\---

\# 5. Major Version

A major version change indicates one or more breaking changes.

Examples include:

\* Removing a public API

\* Changing a public method signature

\* Removing a public domain model

\* Changing canonical SDK behavior

\* Removing supported configuration

\* Breaking serialization compatibility

Example

```text

1.x.x



↓



2.0.0

```

Major version upgrades may require application changes.

\---

\# 6. Minor Version

A minor version introduces new functionality without breaking existing applications.

Examples include:

\* New SDK capability

\* New optional configuration

\* Additional convenience APIs

\* New supported authentication mechanism

\* Additional retry options

\* New documentation

Example

```text

1.2.0



↓



1.3.0

```

Existing applications should continue to work without modification.

\---

\# 7. Patch Version

Patch releases contain backward-compatible improvements.

Examples include:

\* Bug fixes

\* Documentation improvements

\* Performance improvements

\* Internal optimizations

\* Dependency updates

\* Test improvements

Example

```text

1.3.2



↓



1.3.3

```

Patch releases must not modify the public SDK contract.

\---

\# 8. Public API Stability

The following public components are considered stable.

```text

ParmanaClient



Configuration



Canonical Domain Models



Canonical Error Model



Public Configuration



Public Request Models



Public Response Models

```

These components are subject to semantic versioning.

\---

\# 9. Internal Components

Internal implementation is not part of the SDK contract.

Examples include:

```text

RuntimeEngine



PolicyEngine



ExecutionGate



DecisionBuilder



ExecutionBuilder



RuntimePipeline



ExecutionTrustPipeline



PolicyRouter

```

Internal components may evolve without affecting SDK versioning, provided the public contract remains unchanged.

\---

\# 10. Backward Compatibility

Minor and patch releases MUST preserve backward compatibility.

Applications written against a supported SDK version should continue to function without modification.

\---

\# 11. Deprecation Policy

Public APIs SHOULD be deprecated before removal.

Deprecation should include:

\* documentation

\* migration guidance

\* replacement API

\* planned removal version

Deprecated APIs should remain functional until the next major version whenever practical.

\---

\# 12. API Evolution

Public APIs may evolve by:

\* adding optional parameters

\* introducing new methods

\* adding new domain models

\* expanding configuration

\* introducing new error types

Existing behavior must remain unchanged unless a major version increment occurs.

\---

\# 13. Domain Model Evolution

Canonical domain models should evolve conservatively.

Allowed changes include:

\* adding optional fields

\* additional metadata

\* new related models

Breaking changes include:

\* removing fields

\* changing field semantics

\* renaming canonical fields

\* changing identifier formats

\---

\# 14. Error Model Evolution

Existing error types must preserve their semantics.

Future SDK versions may introduce additional error types.

Previously defined error categories must not change meaning.

\---

\# 15. Configuration Evolution

Configuration may expand through optional settings.

Existing configuration behavior must remain stable.

Removing configuration options requires a major version.

\---

\# 16. Documentation Versioning

SDK documentation should align with SDK releases.

Each documentation set should clearly indicate:

\* SDK version

\* publication date

\* compatibility information

Examples and tutorials should target the current stable SDK release.

\---

\# 17. Language Parity

Official SDKs should maintain feature parity across supported languages.

When a new SDK capability is introduced:

\* TypeScript should implement it.

\* Python should implement it.

\* Future official SDKs should implement it where practical.

Temporary implementation differences are acceptable during active development but should converge before stable release.

\---

\# 18. Runtime Compatibility

SDK versions should clearly state the supported Parmana Runtime versions.

Example

```text

SDK 1.x



Compatible with



Runtime 1.x

```

Compatibility information should be documented for every release.

\---

\# 19. Release Types

Official SDK releases may be classified as:

```text

Development



Alpha



Beta



Release Candidate



Stable



Long-Term Support

```

Pre-release versions should clearly indicate their status.

Example

```text

1.0.0-alpha.1



1.0.0-beta.2



1.0.0-rc.1



1.0.0

```

\---

\# 20. Version Identification

SDKs SHOULD expose their version programmatically.

Example

```text

client.version



↓



1.0.0

```

This assists with diagnostics and support.

\---

\# 21. Migration Guidance

Breaking changes must include migration documentation.

Migration guides should explain:

\* what changed

\* why it changed

\* how to migrate

\* deprecated alternatives

Migration documentation should accompany every major release.

\---

\# 22. Conformance Requirements

An official Parmana SDK MUST:

\* follow Semantic Versioning

\* preserve backward compatibility for minor and patch releases

\* document breaking changes

\* provide migration guidance for major releases

\* maintain version parity with official documentation

\* clearly document Runtime compatibility

\* expose SDK version information

\---

\# 23. Future Evolution

The versioning policy is designed to support future official SDKs, including:

\* Go

\* Java

\* .NET

\* Rust

\* Kotlin

\* Swift

\* Additional languages

All official SDKs must follow the same versioning principles while remaining idiomatic to their respective ecosystems.

\---

\# Summary

The Parmana SDK Versioning policy establishes a stable, predictable framework for evolving official SDKs without disrupting application development.

By adopting Semantic Versioning, preserving backward compatibility, and documenting all public changes, Parmana provides a consistent developer experience across languages and releases while allowing the platform to evolve responsibly.
