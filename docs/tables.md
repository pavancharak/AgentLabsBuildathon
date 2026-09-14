I agree. This is exactly the point to \*\*freeze the persistence model\*\*. Everything above it (API, Runtime, Crypto, Verification) is now stable, so the storage schema should become a long-term contract.

\# Parmana Persistence Model v1.0 (Frozen)

\## Design Principles

1\. \*\*Append-only by default\*\*

2\. \*\*Business Transaction is the aggregate root\*\*

3\. \*\*Execution Trust Record is the trust aggregate\*\*

4\. \*\*Artifacts are immutable\*\*

5\. \*\*No storage-specific assumptions\*\*

6\. \*\*Works with PostgreSQL, Supabase, SQLite, MySQL\*\*

\---

\# Tables

\## 1. business\_transactions

One row per transaction.

```text

business\_transaction\_id   PK



status



metadata\_json



policy\_json



signals\_json



decision\_json



created\_at

```

Purpose:

```

BusinessTransactionRepository

```

\---

\## 2. execution\_trust\_records

Exactly one Trust Record per Business Transaction.

```text

trust\_record\_id          PK



business\_transaction\_id  UNIQUE FK



transaction\_json



trust\_record\_hash



created\_at



updated\_at

```

Purpose:

```

ExecutionTrustRecordRepository.create()



findByTransactionId()

```

\---

\## 3. executions

Append-only.

```text

execution\_id        PK



business\_transaction\_id FK



execution\_json



created\_at

```

Purpose:

```

appendExecution()



replaceExecution()

```

\---

\## 4. overrides

Append-only.

```text

override\_id



business\_transaction\_id



override\_json



created\_at

```

Purpose:

```

appendOverride()

```

\---

\## 5. verifications

Append-only.

```text

verification\_id



business\_transaction\_id



verification\_json



verified\_at

```

Purpose:

```

appendVerification()

```

\---

\## 6. receipts

Append-only.

```text

receipt\_id



business\_transaction\_id



receipt\_json



issued\_at

```

Purpose:

```

appendReceipt()

```

\---

\# Relationships

```

Business Transaction

&#x20;       │

&#x20;       │ 1

&#x20;       ▼

Execution Trust Record

&#x20;       │

&#x20;       ├──────────────┐

&#x20;       │              │

&#x20;       ▼              ▼

Executions      Overrides

&#x20;       │

&#x20;       ▼

Verifications

&#x20;       │

&#x20;       ▼

Receipts

```

\---

\# StorageProvider (Frozen)

```text

StorageProvider



&#x20;   businessTransactions



&#x20;   trustRecords

```

No other repositories.

Everything flows through the aggregate.

\---

\# Runtime (Frozen)

```

Runtime



↓



BusinessTransactionRepository



↓



ExecutionTrustRecordRepository

```

Runtime never knows about:

\* PostgreSQL

\* Supabase

\* SQLite

\* MySQL

\---

\# StorageFactory (Frozen)

```

MemoryStorageProvider



↓



SupabaseStorageProvider



↓



PostgresStorageProvider



↓



SQLiteStorageProvider



↓



MySQLStorageProvider

```

Selection happens only in:

```

StorageFactory

```

\---

\# Supabase Mapping (Frozen)

```

BusinessTransactionRepository

&#x20;           │

&#x20;           ▼

business\_transactions





ExecutionTrustRecordRepository

&#x20;           │

&#x20;           ▼

execution\_trust\_records



appendExecution()

&#x20;           ▼

executions



appendVerification()

&#x20;           ▼

verifications



appendReceipt()

&#x20;           ▼

receipts



appendOverride()

&#x20;           ▼

overrides

```

\---

\# Canonical Persistence Flow (Frozen)

```

Business Transaction



&#x20;       │



&#x20;       ▼



Execution Trust Record



&#x20;       │



&#x20;       ▼



Execution



&#x20;       │



&#x20;       ▼



Override (optional)



&#x20;       │



&#x20;       ▼



Verification



&#x20;       │



&#x20;       ▼



Receipt

```

This sequence is immutable.

\---

\# What is now frozen

\* ✅ Repository interfaces

\* ✅ StorageProvider abstraction

\* ✅ StorageFactory pattern

\* ✅ Six-table persistence model

\* ✅ One Trust Record per Business Transaction

\* ✅ Append-only artifact tables

\* ✅ Provider-based architecture (Memory, Supabase, PostgreSQL, etc.)

\* ✅ Runtime independent of storage implementation

\## Next implementation phase

With the architecture frozen, I recommend implementing in this order:

1\. \*\*Supabase schema (SQL migration)\*\* — create the six tables, primary keys, foreign keys, and indexes.

2\. \*\*`SupabaseClientFactory`\*\* — centralized client creation from environment variables.

3\. \*\*`SupabaseBusinessTransactionRepository`\*\* — implement the simpler repository first.

4\. \*\*`SupabaseExecutionTrustRecordRepository`\*\* — implement trust record creation and append-only artifact operations.

5\. \*\*Update `StorageFactory`\*\* to select `MemoryStorageProvider` or `SupabaseStorageProvider` based on configuration (for example, `PARMANA\_STORAGE=memory` or `PARMANA\_STORAGE=supabase`).

I recommend \*\*freezing this architecture as v1.0\*\* and treating future changes as additive rather than modifying these core persistence contracts.
