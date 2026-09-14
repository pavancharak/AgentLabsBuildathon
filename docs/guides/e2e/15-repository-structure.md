\# 15 – Repository Structure

This guide describes the organization of the Parmana monorepo and the responsibility of each package.

\---

\# Repository Overview

```text

parmana-exp/

│

├── packages/

├── docs/

├── examples/

├── scripts/

├── keys/

├── .github/

└── package.json

```

\---

\# packages/

The `packages` directory contains the implementation of the Parmana platform.

| Package | Responsibility |

|----------|----------------|

| api | REST API and HTTP endpoints |

| runtime | Business execution and orchestration |

| crypto | Hashing, signing, verification, key management |

| governance | Policy evaluation and execution authorization |

| execution | Execution pipeline and execution models |

| verifier | Trust Record verification |

| sdk-client | TypeScript SDK |

| audit-db | Audit persistence |

| core | Shared runtime services |

\---

\# docs/

Documentation for developers, operators, and users.

```text

docs/

├── guides/

│   └── e2e/

├── architecture/

├── api/

└── security/

```

\---

\# examples/

Reference implementations demonstrating common workflows.

Examples include:

\- Hello World

\- Execute Transaction

\- Verify

\- Receipt

\- Replay

These examples are intended for learning and testing.

\---

\# scripts/

Repository automation.

Typical scripts include:

\- Build

\- Test

\- OpenAPI generation

\- Documentation generation

\- Verification utilities

\- CI validation

\---

\# keys/

Development cryptographic keys used for local testing.

Production deployments should replace these with secure key management solutions.

\---

\# .github/

GitHub Actions workflows for:

\- Build

\- Test

\- Lint

\- Documentation validation

\- Release automation

\---

\# Package Relationships

```text

&#x20;         API

&#x20;          │

&#x20;          ▼

&#x20;      Runtime

&#x20;          │

&#x20;┌─────────┼─────────┐

&#x20;▼         ▼         ▼

Crypto  Governance  Execution

&#x20;          │

&#x20;          ▼

&#x20;      Verifier

&#x20;          │

&#x20;          ▼

&#x20;      Audit DB

```

\---

\# Dependency Principles

The repository follows these principles:

\- Single responsibility per package

\- Shared models through common libraries

\- Deterministic runtime behavior

\- Clear separation between API, runtime, cryptography, and persistence

\- Reusable packages for SDKs and tooling

\---

\# Summary

The Parmana monorepo separates HTTP APIs, runtime execution, cryptographic services, governance logic, verification, and persistence into focused packages, making the platform easier to understand, maintain, and extend.
