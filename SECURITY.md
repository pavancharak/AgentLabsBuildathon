# Security Policy

Parmana is execution trust infrastructure: it authorizes and evidences
what automated systems do. A vulnerability here has more impact than in a
typical application, so we take reports seriously and ask that you
report privately rather than through a public issue.

## Reporting a vulnerability

Email **founder@parmanasystems.com** with:

- A description of the issue and its impact.
- Steps to reproduce, or a proof of concept if you have one.
- The commit or version affected.

We will acknowledge your report within 3 business days and aim to give
you a fix timeline or a clarifying question within 10. Please give us a
reasonable window to fix and deploy before any public disclosure.

## Scope

In scope: the runtime, policy engine, execution gateway, cryptographic
signing and verification, the connector SDK and the HubSpot, GitHub,
Slack and Paytm connectors, the REST API and its authentication, and the
envelope verifier. See [docs/CLAIMS.md](docs/CLAIMS.md) for exactly what each of
these claims to do today.

Out of scope: findings that require a compromised signing key or
compromised infrastructure to demonstrate (see the
[security limitations](https://docs.parmanasystems.com/security/limitations) page),
denial-of-service against the demo deployments, and social engineering.

## Acknowledged reports

We are happy to credit reporters by name in release notes, with your
permission, once a fix ships.
