> **STATUS: DRAFTING AID FOR ATTORNEY REVIEW — NOT A FILED OR FILING-READY APPLICATION.**
> Written 2026-08-25 directly from this repository's actual source code (cited throughout). No
> patent attorney, patent agent, or prior-art search has reviewed this document. Do not submit
> this to the Indian Patent Office or any other patent office in its current form. See
> [`PATENT_FILING_MASTER_PROMPT.md`](./PATENT_FILING_MASTER_PROMPT.md) for why this exists —
> it corrects an earlier claim that a complete, ready-to-file specification already existed,
> which was false; nothing existed until this draft.

# Provisional Patent Specification (Draft) — Runtime Credential Isolation via Single-Use, Session-Scoped Execution Credentials

## Field

Systems and methods for isolating access credentials from an automated caller (including but not
limited to an AI agent) when that caller directs a real-world execution against a third-party
system, such that the caller never possesses a credential capable of being reused, replayed, or
exfiltrated for a purpose other than the single execution it was issued for.

## Background / Problem

Existing integration architectures — API gateways, OAuth-scoped tokens, role-based access control
— grant a caller a credential (an API key, an OAuth token, a service-account secret) that remains
valid for a period of time or a number of uses extending beyond any single action. This creates
two structural risks regardless of how tightly the credential's *scope* is restricted:

1. **Credential persistence risk.** A credential that outlives the action it was issued for is a
   standing target: if leaked, logged, or exfiltrated by a compromised or malicious caller
   (including an AI agent that has been prompt-injected or otherwise induced to misbehave), it
   remains usable until manually revoked.
2. **No cryptographic binding between "this credential was authorized" and "this credential was
   used for the thing it was authorized for."** Scope restrictions (e.g., an OAuth scope of
   `refunds:write`) constrain *what kind* of action a credential can perform, not *which specific,
   individually-authorized action* it was issued to perform.

## Summary of the Invention

The invention issues a **single-use, session-scoped execution credential** per individually
authorized execution, immediately before the execution occurs, and unconditionally destroys that
credential upon exit from the execution — regardless of whether the execution succeeded, the
downstream system failed, or a policy check rejected the request after the credential was issued.
The caller (connector) never holds a long-lived credential; it holds, at most, one single-use
credential for the duration of exactly one execution.

## Detailed Description

The implementation (`packages/execution-control/src/SessionCredentialSecureConnector.ts`) wraps
every registered connector in a `SessionCredentialSecureConnector`. Its `execute()` method
performs the following sequence for every execution request:

1. **Policy assertion first.** `this.options.policy.assertAllowed(request, this,
   gatewayAuthentication)` is evaluated before any credential is issued — no credential exists
   yet at this point, so a rejected request never causes a credential to be minted at all.
2. **Issue.** `this.options.sessionCredentials.issue(connectorId, authorizationId)` mints a new
   session credential scoped to the connector and the specific `authorizationId` of the execution
   being performed, returning a `sessionCredentialId` — an opaque handle, not the credential
   material itself.
3. **Consume, inside try/finally.** `sessionCredentials.consume(sessionCredentialId)` resolves the
   handle to actual usable credential material, immediately handed to
   `this.options.executor.execute(...)`.
4. **Unconditional revoke.** The `finally` block calls `sessionCredentials.revoke(sessionCredentialId)`
   regardless of whether `executor.execute()` succeeded or threw — meaning a downstream execution
   failure does not leave a usable credential outstanding.
5. **Audit on both paths.** Every `execute()` call — success or failure — writes exactly one audit
   event (`execution.completed` or `execution.rejected`) naming the connector, the authorization,
   the session, and the credential's *id* (never its value), via `ExecutionAuditSink`.

The credential vault itself (`packages/execution-control/src/CredentialVault.ts`,
`SessionCredentialVault`) is the layer that actually enforces single-use semantics — a second
`consume()` call against an already-consumed or already-revoked `sessionCredentialId` fails,
which is independently proven by this repository's own test suite
(`packages/api/tests/integration/credential-isolation.integration.test.ts`, per
`docs/VERIFICATION-GAPS.md`'s gap-closure record: "credential issued + destroyed, proven by a
second `consume()` throwing `'has been revoked'`").

## Novel Elements (candidate claims — informal, for attorney refinement)

1. A method for authorizing execution of an action against a third-party system, comprising:
   evaluating a deterministic policy against the requested action *before* issuing any
   credential; upon approval, issuing a session-scoped credential bound to both the specific
   connector and the specific authorization identifier of the approved action; consuming that
   credential exactly once to perform the action; and unconditionally destroying the credential
   upon completion of the action, whether by success or failure, via a structural
   exception-safe (try/finally) guarantee rather than an application-level cleanup step that could
   be skipped.
2. The method of claim 1, wherein destruction of the credential is enforced independent of the
   outcome of the downstream action, such that a failure in the third-party system does not leave
   a reusable credential outstanding.
3. The method of claim 1, wherein an audit record is generated for every execution attempt,
   whether approved-and-completed or rejected, identifying the credential by an opaque identifier
   distinct from the credential's own material, such that the audit trail never itself becomes a
   secondary credential-leakage surface.
4. A system comprising a connector registry in which every registered connector is wrapped, by
   default and without per-connector opt-in, in a credential-isolating adapter implementing
   claims 1-3 — such that no connector can be registered into the production execution path
   without this isolation applying to it.

## What would need attorney/prior-art input before this is filing-ready

- Whether "single-use session credential, issued after policy approval and destroyed via
  structural try/finally regardless of outcome" is novel over existing OAuth/short-lived-token
  patterns, or whether the distinguishing element needs sharper framing (e.g., the *binding to a
  specific authorizationId*, not just short lifetime, may be the actual novel element).
- Whether claim 4 (default-wrapping at the registry level, not opt-in) is separately claimable or
  should fold into claim 1 as an implementation detail.
- Formal patent drawings (a sequence diagram of issue → consume → execute → revoke, and a
  system diagram of the connector registry wrapping pattern) — described above in prose only.

## Source Code Reference

- `packages/execution-control/src/SessionCredentialSecureConnector.ts` — the wrapping adapter and
  execute() sequence described above (read in full 2026-08-25).
- `packages/execution-control/src/CredentialVault.ts` — the credential-storage interface.
- `packages/execution-control/src/types.ts` — `SecureConnector`, `ConnectorExecutor`,
  `GatewayExecutionRequest` interfaces referenced above.
- `packages/api/tests/integration/credential-isolation.integration.test.ts` — the test proving
  single-use enforcement (cited via `docs/VERIFICATION-GAPS.md`).
