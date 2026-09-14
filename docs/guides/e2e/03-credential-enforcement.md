\# E2E Step 3 – Credential Enforcement

\## Objective

Verify that Parmana enforces credential isolation during execution and fails closed when the required connector credential is unavailable.

\---

\## Preconditions

\- API running

\- Caller authentication configured

\- Authenticated request accepted

\- Valid Business Transaction submitted to `/execute`

\---

\## Request

```http

POST /execute

Authorization: Bearer <api-key>

Content-Type: application/json

```

Business Transaction:

\- Valid UUID

\- Authority

\- Authorization

\- Intent

\- Policy

\- Signals

\---

\## Runtime Progress

The request successfully passed the following stages:

```

\[ROUTE] before execute

\[APP] 1 - accept

\[APP] 2 - runtime

```

This confirms the transaction entered the Runtime Engine and progressed into the execution pipeline.

\---

\## Failure

Execution stopped before connector invocation.

```

Error:

Environment variable "VENDOR\_PAYMENT\_TOKEN"

for connector "vendor-payment"

is not set.

```

Stack trace (truncated):

```

EnvironmentCredentialProvider.resolve()



CredentialVaultAdapter.getCredential()



SessionCredentialVault.issue()



SessionCredentialSecureConnector.execute()



ExecutionControlService.execute()



ExecutionComponent.execute()



RuntimePipeline.execute()



RuntimeEngine.execute()



Runtime.execute()

```

\---

\## Expected Behaviour

\*\*PASS\*\*

Parmana intentionally refused to execute because the connector credential was unavailable.

No connector credential was fabricated.

No fallback credential was used.

No execution was attempted.

The platform failed closed.

\---

\## Security Guarantee

This validates Parmana's credential isolation architecture.

The Runtime Engine cannot execute protected business actions unless the required connector credential is explicitly available.

AI agents never possess execution credentials.

Execution credentials are resolved only by the Credential Vault immediately before execution.

\---

\## Evidence

Authentication: PASS

Business Transaction Mapping: PASS

Runtime Pipeline: PASS

Execution Control: PASS

Credential Vault: PASS

Connector Authentication: BLOCKED

External Execution: NOT ATTEMPTED

\---

\## Result

\*\*PASS\*\*

Credential isolation successfully prevented unauthorized execution.

This demonstrates that Parmana enforces execution security even after a request has been accepted and authorized.

\---

\## Next Step

Configure the required connector credential:

```

VENDOR\_PAYMENT\_TOKEN=<test-token>

```

Restart the API and repeat the `/execute` request to verify successful execution through the connector and generation of the Execution Trust Record.
