\# Contributing to Parmana

Thank you for contributing to Parmana.

Parmana is an Execution Trust Infrastructure platform. The project prioritizes correctness, determinism, immutability, and verifiable execution over implementation convenience.

\## Architecture First

Every significant architectural change should begin with documentation.

Use the following decision process:

1\. Is this a bug fix?

&#x20; \* Implement the fix with tests.

2\. Is this a new feature?

&#x20; \* Create an RFC describing the proposal.

3\. Does the feature change architectural behavior?

&#x20; \* Create or update an Architecture Decision Record (ADR).

4\. Does the change modify a normative platform contract?

&#x20; \* Update the relevant specification in `docs/`.

\## Core Principles

Every contribution should preserve the following principles:

\* Deterministic execution

\* Immutable domain model

\* Independent verification

\* Append-only evidence

\* Cryptographic agility

\* Separation of concerns

\* Execution trust

Changes that violate these principles require an approved ADR.

\## Testing Requirements

All changes should include appropriate automated tests.

At a minimum:

\* Unit tests for new domain behavior.

\* Regression tests for bug fixes.

\* Conformance tests when platform contracts are affected.

The build should pass:

```bash

npm run build

npm run typecheck

npm test

```

\## Coding Standards

\* Use TypeScript strict mode.

\* Prefer immutable objects.

\* Avoid hidden side effects.

\* Keep classes focused on a single responsibility.

\* Document public APIs.

\## Pull Requests

Pull requests should include:

\* A clear description.

\* Linked issue or RFC (if applicable).

\* Updated documentation when required.

\* Passing build and test results.

\## Documentation

Normative specifications are located in:

```

docs/

```

Architecture decisions are located in:

```

docs/adr/

```

Future proposals are located in:

```

docs/rfcs/

```

Implementation guides belong in:

```

docs/guides/

```

Adding a new connector? See \`docs/architecture/CONNECTOR\_ISOLATION.md\` and \`docs/connectors/BUILDING\_A\_CONNECTOR.md\` before opening a PR — every connector must be registered through the standard path so it gets automatic credential isolation; a \`legacyInsecure: true\` registration outside a test is not acceptable.

\## Philosophy

Parmana is designed to establish trust between authority and execution.

Every contribution should strengthen that goal.
