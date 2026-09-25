# Parmana

> **Proof of Human Authority in AI Systems**

[![PyPI](https://img.shields.io/pypi/v/parmana)](https://pypi.org/project/parmana/)
[![Python](https://img.shields.io/pypi/pyversions/parmana)](https://pypi.org/project/parmana/)
[![License](https://img.shields.io/pypi/l/parmana)](https://github.com/pavancharak/parmana/blob/main/LICENSE)

The official Python SDK for **Parmana Execution Trust Infrastructure**.

Parmana enables organizations to confidently deploy AI in high-impact workflows by ensuring that **only authorized actions are executed** and every execution is accompanied by verifiable execution evidence.

## Why Parmana

Modern AI systems can:

- Plan
- Reason
- Call tools
- Invoke APIs
- Execute business workflows

However, most AI systems cannot answer critical governance questions:

- Who authorized this execution?
- Which policy approved it?
- Was the execution independently verified?
- Can the execution be replayed?
- Is there cryptographic evidence of what occurred?

Parmana provides the execution trust layer that answers these questions.

## Installation

```bash
pip install parmana
```

### Requirements

- Python 3.10 or later
- Parmana Runtime

## Quick Start

```python
from parmana import ParmanaClient

client = ParmanaClient(
    endpoint="http://localhost:3000",
)

print(client.version)
```

## Runtime Health

```python
status = client.health()

print(status)
```

## Execute a Business Transaction

```python
from parmana.models import BusinessTransaction

transaction = BusinessTransaction(
    business_transaction_id="txn-001",
)

trust_record = client.execute(transaction)

print(trust_record.trust_record_id)
```

## Verify an Execution

```python
verification = client.verify("txn-001")

print(verification.status)
```

## Replay an Execution

```python
result = client.replay("txn-001")

print(result.success)
```

## Execution Lifecycle

```text
Business Transaction
        |
        v
Execution
        |
        v
Verification
        |
        v
Receipt
        |
        v
Execution Trust Record
```

## Python SDK

| Method                    | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `health()`                | Runtime health check                                |
| `execute()`               | Execute a Business Transaction                      |
| `verify()`                | Verify an execution                                 |
| `replay()`                | Deterministic replay                                |
| `receipt()`               | Generate an execution receipt                       |
| `latest_receipt()`        | Read the latest receipt (1.3.0)                     |
| `transaction()`           | Retrieve a Business Transaction                     |
| `trust_record()`          | Retrieve an Execution Trust Record                  |
| `validate_policy()`       | Check a policy name and version can be loaded       |
| `refusal_record()`        | Retrieve a Refusal Record                           |
| `execution_intent()`      | Retrieve an Execution Intent and its status         |
| `caller()`                | Who the API key belongs to (1.3.0)                  |
| `public_key()`            | A signing public key, for offline checks (1.3.0)    |
| `propose_policy_change()` | Propose a policy change (1.3.0)                     |
| `policy_changes()`        | List policy changes for review (1.3.0)              |
| `approve_policy_change()` | Approve with a signed step up authorization (1.3.0) |
| `reject_policy_change()`  | Reject with a signed step up authorization (1.3.0)  |

`parmana.crypto` (install `parmana[verify]`) verifies Trust Records and Execution Intents with only the public key, and signs step up authorizations (`sign_policy_change_step_up()`, 1.3.0).

Each of these is also available under its own namespace (e.g. `client.execution.execute()`, `client.verification.verify()`, `client.replay.replay()`) for finer-grained access to that API's other operations, such as `client.verification.get_latest()` or `client.transactions.list()`.

## Documentation

- Website: https://parmanasystems.com/
- Documentation: https://docs.parmanasystems.com
- Every operation and its TypeScript equivalent: https://docs.parmanasystems.com/sdks/api-coverage
- GitHub: https://github.com/pavancharak/parmana
- Issues: https://github.com/pavancharak/parmana/issues

## License

Apache License 2.0

---

**Parmana**

**Proof of Human Authority in AI Systems**
