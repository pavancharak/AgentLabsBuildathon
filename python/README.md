# Parmana

> **Proof of Human Authority in AI Systems**

[![PyPI](https://img.shields.io/pypi/v/parmana)](https://pypi.org/project/parmana/)
[![Python](https://img.shields.io/pypi/pyversions/parmana)](https://pypi.org/project/parmana/)
[![License](https://img.shields.io/pypi/l/parmana)](https://github.com/pavancharak/parmana-exp/blob/main/LICENSE)

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

| Method              | Description                        |
| ------------------- | ---------------------------------- |
| `health()`          | Runtime health check               |
| `execute()`         | Execute a Business Transaction     |
| `verify()`          | Verify an execution                |
| `replay()`          | Deterministic replay               |
| `receipt()`         | Generate an execution receipt      |
| `transaction()`     | Retrieve a Business Transaction    |
| `trust_record()`    | Retrieve an Execution Trust Record |
| `validate_policy()` | Validate a policy definition       |

Each of these is also available under its own namespace (e.g. `client.execution.execute()`, `client.verification.verify()`, `client.replay.replay()`) for finer-grained access to that API's other operations, such as `client.verification.get_latest()` or `client.transactions.list()`.

## Documentation

- Documentation: https://docs.parmanasystems.com
- GitHub: https://github.com/pavancharak/parmana-exp
- Issues: https://github.com/pavancharak/parmana-exp/issues

## License

Apache License 2.0

---

**Parmana**

**Proof of Human Authority in AI Systems**
