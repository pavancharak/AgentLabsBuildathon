# Parmana Documentation

This index covers the documents that matter for evaluating or operating
Parmana. `docs/` also contains a much larger archive of specifications,
RFCs, audits, and session notes accumulated during development; those are
not indexed here and are not required reading.

## Start here

1. **[../README.md](../README.md)** — what Parmana is, the authorize to
   verify to execute to confirm chain, and a 90-second overview.
2. **[CLAIMS.md](CLAIMS.md)** — the technical claims register. Every claim
   is scoped to what is actually implemented and tested, with file and
   test references as evidence. This is the source of truth for what
   Parmana does and does not do today.
3. **[../DEPLOYMENT.md](../DEPLOYMENT.md)** — how to run `@parmana/api` as
   a container, what configuration is required, and what was verified
   against the two real Fly.io deployments (test mode and live mode).

## Package documentation

- **[packages/api/README.md](../packages/api/README.md)** — the REST API
  surface: routes, authentication, webhooks.
- **[packages/envelope-verifier/README.md](../packages/envelope-verifier/README.md)**
  — verifying a Parmana execution authorization independently, without
  trusting Parmana's runtime or database.

## Building a connector

- **[architecture/CONNECTOR_ISOLATION.md](architecture/CONNECTOR_ISOLATION.md)**
  — how credential isolation actually works: `GatewayConnectorRegistry`
  wraps every connector in `SessionCredentialSecureConnector` by default,
  what that wrapper does, and where scope/amount enforcement actually
  lives (`PolicyEngine`, upstream — not the connector).
- **[connectors/BUILDING_A_CONNECTOR.md](connectors/BUILDING_A_CONNECTOR.md)**
  — the concrete steps to add a new connector, using the real HubSpot and
  GitHub connectors as reference.
- **[connectors/CODE_REVIEW_CHECKLIST.md](connectors/CODE_REVIEW_CHECKLIST.md)**
  and **[connectors/CONNECTOR_FAQ.md](connectors/CONNECTOR_FAQ.md)**.

## Reading order by role

- **Evaluating Parmana**: README.md, then CLAIMS.md.
- **Deploying it**: DEPLOYMENT.md, then packages/api/README.md.
- **Integrating a receiving system**: packages/envelope-verifier/README.md.
- **Building a connector**: architecture/CONNECTOR_ISOLATION.md, then
  connectors/BUILDING_A_CONNECTOR.md.

## License and security

- [../LICENSE](../LICENSE) — proprietary, source-available for evaluation.
- [../SECURITY.md](../SECURITY.md) — reporting a vulnerability.
