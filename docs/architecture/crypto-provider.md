\# Crypto Provider Architecture

\## Overview

Parmana separates cryptographic operations from business logic through a provider architecture.

The runtime never depends on a specific cryptographic algorithm. Instead, algorithms are selected through configuration and resolved at startup.

This architecture enables Parmana to support multiple hash functions, signature algorithms, and key management implementations without changing application code.

\---

\# Design Goals

The crypto subsystem is designed around the following principles:

\* Algorithm independence

\* Configuration-driven selection

\* Pluggable implementations

\* Immutable provider instances

\* Deterministic cryptographic operations

\---

\# Architecture

```text

&#x20;                   CryptoBootstrap

&#x20;                          │

&#x20;           ┌──────────────┴──────────────┐

&#x20;           ▼                             ▼

&#x20;    HashRegistry                 SignatureRegistry

&#x20;           │                             │

&#x20;     HashProvider                 SignatureProvider

&#x20;           │                             │

&#x20;    SHA-256 / SHA3             Ed25519 / ML-DSA-65

```

The application interacts only with the `CryptoProvider` abstraction.

\---

\# CryptoBootstrap

`CryptoBootstrap` is the composition root of the cryptography subsystem.

Responsibilities:

\* Load immutable configuration

\* Register built-in providers

\* Resolve configured providers

\* Build the `CryptoProvider`

\* Cache the configured provider for the process lifetime

The bootstrap is the only location that directly references concrete cryptographic implementations.

\---

\# CryptoBuilder

`CryptoBuilder` constructs the immutable `CryptoProvider`.

Responsibilities:

\* Accept configured hash provider

\* Accept configured signature provider

\* Produce immutable provider instances

Business code never constructs providers directly.

\---

\# Hash Registry

The `HashRegistry` maintains available hash implementations.

Current providers:

| Algorithm | Provider |

| --------- | ------------------ |

| SHA-256 | SHA256HashProvider |

Future providers may include:

\* SHA3-512

\* BLAKE3

Adding new providers does not require changes to business logic.

\---

\# Signature Registry

The `SignatureRegistry` maintains available signature implementations.

Current providers:

| Algorithm | Provider |

| --------- | --------------------------- |

| Ed25519 | Ed25519SignatureProvider |

| ML-DSA-65 | Dilithium3SignatureProvider |

The configured provider is selected using:

```dotenv

SIGNATURE\_PROVIDER=ed25519

```

or

```dotenv

SIGNATURE\_PROVIDER=dilithium3

```

\---

\# CryptoProvider

`CryptoProvider` exposes the active cryptographic implementation to the rest of Parmana.

Responsibilities:

\* Hash canonical data

\* Sign canonical data

\* Verify signatures

Higher-level services remain independent of concrete algorithms.

\---

\# Runtime Flow

```text

Application

&#x20;     │

&#x20;     ▼

CryptoBootstrap

&#x20;     │

&#x20;     ▼

Load Configuration

&#x20;     │

&#x20;     ▼

Register Providers

&#x20;     │

&#x20;     ▼

Resolve Configured Algorithms

&#x20;     │

&#x20;     ▼

Build CryptoProvider

&#x20;     │

&#x20;     ▼

ReceiptCrypto / VerificationCrypto

```

The runtime never directly instantiates individual algorithms after startup.

\---

\# Extending Parmana

To add a new signature algorithm:

1\. Implement `SignatureProvider`

2\. Register it with `SignatureRegistry`

3\. Add the algorithm identifier

4\. Extend configuration validation

No changes are required to:

\* Receipt generation

\* Verification

\* Runtime

\* Replay

\* Storage

This keeps cryptographic evolution isolated from business logic.

\---

\# Benefits

The provider architecture offers several advantages:

\* Configuration-driven cryptography

\* Easy migration to new algorithms

\* Support for post-quantum cryptography

\* Minimal impact on higher-level services

\* Consistent cryptographic interfaces across the platform

This design ensures that Parmana can evolve its cryptographic capabilities while preserving the stability of its execution trust infrastructure.
