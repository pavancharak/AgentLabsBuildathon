\# Execution Flow Audit

> Status: Complete (Implementation Verified)

>

> Purpose:

>

> This document is the canonical implementation audit of Parmana's execution

> pipeline. It traces the execution flow through the repository using the

> actual implementation.

>

> Every statement in this document must be backed by source code.

> No assumptions. No future architecture. No marketing language.

\---

\# Audit Rules

\- Document only the current implementation.

\- Every stage must reference its source file.

\- Do not speculate.

\- Record audit observations separately from implementation.

\- Every stage should eventually have associated tests.

\---

\# High-Level Flow

```

Client

&#x20;   │

&#x20;   ▼

HTTP Request

&#x20;   │

&#x20;   ▼

Express Route

&#x20;   │

&#x20;   ▼

BusinessTransactionMapper

&#x20;   │

&#x20;   ▼

ExecutionTrustApplication

&#x20;   │

&#x20;   ▼

Runtime

&#x20;   │

&#x20;   ▼

RuntimeEngine

&#x20;   │

&#x20;   ▼

Runtime Pipeline

&#x20;   │

&#x20;   ▼

ExecutionComponent

&#x20;   │

&#x20;   ▼

ExecutionSystem

&#x20;   │

&#x20;   ▼

Execution Gateway

&#x20;   │

&#x20;   ▼

Connector

&#x20;   │

&#x20;   ▼

Enterprise System

&#x20;   │

&#x20;   ▼

Execution Receipt

&#x20;   │

&#x20;   ▼

Verification

&#x20;   │

&#x20;   ▼

Execution Trust Record

```

\---

\# Stage 1: HTTP Entry

\## File

```

packages/api/src/routes/execute.ts

```

\## Responsibility

Accept HTTP execution requests.

\## Input

HTTP POST request.

\## Output

BusinessTransaction.

\## Verified Behaviour

\- Validates `businessTransactionId`.

\- Rejects invalid UUID with HTTP 400.

\- Delegates object creation to `BusinessTransactionMapper`.

\- Calls `ExecutionTrustApplication.execute()`.

\- Returns the resulting Execution Trust Record.

\## Calls

```

BusinessTransactionMapper.fromRequest()



↓



ExecutionTrustApplication.execute()

```

\## Audit Notes

Current route validates only the transaction identifier.

Further validation points will be identified during the runtime audit.

Status:

✅ Verified

\---

\# Stage 2: Business Transaction Mapper

\## File

```

packages/api/src/mappers/BusinessTransactionMapper.ts

```

\## Responsibility

Convert HTTP request payload into an immutable

BusinessTransaction.

\## Input

Request payload.

\## Output

BusinessTransaction.

\## Verified Behaviour

Copies:

\- metadata

\- authority

\- authorization

\- intent

\- policy

\- signals

Creates server-owned fields:

\- status = RECEIVED

\- createdAt = current server time

\## Does NOT

\- Execute policy

\- Validate policy

\- Execute business logic

\- Persist data

\- Generate receipts

Status:

✅ Verified

\---

\# Stage 3: Application Composition

\## File

```

packages/api/src/application.ts

```

\## Responsibility

Compose the application.

\## Creates

\- PolicyRepository

\- BusinessTransactionRepository

\- ExecutionTrustRecordRepository

\- ExecutionTrustApplication

Uses

```

RuntimeFactory.create(...)

```

\## Audit Notes

Contains dependency composition only.

No execution logic.

Status:

✅ Verified

\---

\# Stage 4: Runtime Factory

\## File

```

packages/runtime/src/RuntimeFactory.ts

```

\## Responsibility

Construct the complete runtime.

\## Creates

Application Services

\- BusinessTransactionService

\- ExecutionService

\- VerificationService

\- ReceiptService

Builders

\- ExecutionRequestBuilder

\- ExecutionEvidenceBuilder

Runtime Pipeline

\- TrustChainValidationComponent

\- ExecutionComponent

Application

\- ExecutionTrustApplication

\## Audit Notes

Factory performs dependency composition only.

No runtime execution occurs here.

Status:

✅ Verified

\---

\# Stage 5: ExecutionTrustApplication

\## File

```

packages/runtime/src/ExecutionTrustApplication.ts

```

\## Responsibility

Orchestrate the complete execution lifecycle.

\## Execution Sequence

```

Accept Transaction



↓



Runtime.execute()



↓



Verification.verify()



↓



Receipt.generate()



↓



Load Execution Trust Record



↓



Return Execution Trust Record

```

\## Public Operations

\- execute()

\- verify()

\- replay()

\- generateReceipt()

\- getTrustRecord()

\- getTransaction()

\- listTransactions()

\## Audit Notes

Acts as an orchestration layer.

Delegates all domain behaviour to dedicated services.

Status:

✅ Verified

\---

\# Stage 6: Runtime

\## File

```

packages/runtime/src/Runtime.ts

```

\## Responsibility

Execute RuntimeEngine and persist the resulting

Execution Trust Record.

\## Execution Sequence

```

RuntimeEngine.execute()



↓



Persist Trust Record



↓



Return RuntimeResult

```

\## Audit Notes

Runtime is a thin façade.

Execution occurs inside RuntimeEngine.

Status:

✅ Verified

\---

\# Stage 7: Runtime Engine

\## File

```

packages/runtime/src/RuntimeEngine.ts

```

\## Responsibility

The Runtime Engine is the core orchestration engine of Parmana.

It is responsible for:

\- Loading policies.

\- Evaluating policies.

\- Building execution artifacts.

\- Creating execution authorization.

\- Executing the Runtime Pipeline.

\- Producing the final Execution Trust Record.

It contains the complete deterministic execution flow.

Status:

✅ Verified

\---

\## Execution Sequence

```

BusinessTransaction

&#x20;       │

&#x20;       ▼

Extract Signals

&#x20;       │

&#x20;       ▼

Load Policy

&#x20;       │

&#x20;       ▼

Evaluate Policy

&#x20;       │

&#x20;       ▼

Build Decision

&#x20;       │

&#x20;       ▼

Execution Gate

&#x20;       │

&#x20;       ▼

Build Executable Content

&#x20;       │

&#x20;       ▼

Sign Authorization

&#x20;       │

&#x20;       ▼

Build Execution Artifact

&#x20;       │

&#x20;       ▼

Create Runtime Context

&#x20;       │

&#x20;       ▼

Runtime Pipeline

&#x20;       │

&#x20;       ▼

Business Trust Pipeline

&#x20;       │

&#x20;       ▼

Execution Trust Record

```

\---

\## Step 1: Extract Runtime Signals

Input

```

BusinessTransaction.signals

```

Output

```

Record<string, JsonValue>

```

Purpose

Provide deterministic input to policy evaluation.

Status:

✅ Verified

\---

\## Step 2: Load Policy

Component

```

PolicyRouter

```

Input

```

policy.name

policy.version

```

Output

```

Runtime Policy

```

Purpose

Resolve the exact policy requested by the Business Transaction.

Hooks

\- beforePolicyLoad()

\- afterPolicyLoad()

Status:

✅ Verified

\---

\## Step 3: Evaluate Policy

Component

```

PolicyEngine

```

Input

\- Policy

\- Runtime Signals

Output

```

PolicyDecision

```

Hooks

\- beforePolicyEvaluation()

\- afterPolicyEvaluation()

Status:

✅ Verified

\---

\## Step 4: Build Decision

Component

```

DecisionBuilder

```

Input

\- Business Transaction

\- Policy Decision

Output

```

Decision

```

Status:

✅ Verified

\---

\## Step 5: Execution Gate

Component

```

ExecutionGate

```

Input

```

Decision

```

Purpose

Enforce execution before authorization is created.

Status:

✅ Verified

\---

\## Step 6: Executable Content

Component

```

toExecutableContent(...)

```

Produces the canonical executable payload.

Contains

\- businessTransactionId

\- action

\- target

\- parameters

Purpose

Create the immutable content that will be authorized.

Status:

✅ Verified

\---

\## Step 7: Runtime Authorization

Component

```

RuntimeAuthorizationSigner

```

Input

\- Decision ID

\- Transaction ID

\- Policy

\- Executable Content

Output

```

Execution Authorization

```

Hooks

\- beforeAuthorization()

\- afterAuthorization()

Status:

✅ Verified

\---

\## Step 8: Execution Artifact

Component

```

ExecutionBuilder

```

Output

```

Execution

```

Status:

✅ Verified

\---

\## Step 9: Runtime Context

Creates

```

RuntimeContext

```

Contains

\- Transaction

\- Decision

\- Authorization

\- Execution

Purpose

Shared context passed between all Runtime Pipeline stages.

Status:

✅ Verified

\---

\## Step 10: Runtime Pipeline

Component

```

RuntimePipeline

```

Input

```

RuntimeContext

```

Output

```

Processed RuntimeContext

```

Purpose

Execute every configured Runtime Component.

Status:

✅ Verified

\---

\## Step 11: Business Trust Pipeline

Component

```

BusinessTrustPipeline

```

Input

Processed Runtime Context

Output

```

ExecutionTrustRecord

```

Purpose

Generate the final immutable Execution Trust Record.

Status:

✅ Verified

\---

\## Runtime Hooks

The Runtime Engine exposes lifecycle hooks before and after every major stage.

Verified hook points

\- Policy Load

\- Policy Evaluation

\- Decision

\- Authorization

\- Execution

\- Trust Record

\- Runtime Error

This provides extension points without changing the Runtime Engine itself.

Status:

✅ Verified

\---

\## Audit Notes

The Runtime Engine is deterministic orchestration.

It does not perform transport handling.

It does not perform persistence.

It does not expose HTTP concerns.

It coordinates policy evaluation, authorization, execution, and trust record creation through explicit stages.

\---

\---

\# Stage 8: Runtime Pipeline

\## File

```

packages/runtime/src/RuntimePipeline.ts

```

\## Responsibility

Execute Runtime Components in deterministic order.

The Runtime Pipeline contains no business logic.

Its only responsibility is to orchestrate Runtime Components sequentially.

Status:

✅ Verified

\---

\## Execution Flow

```

RuntimeContext

&#x20;       │

&#x20;       ▼

Component 1

&#x20;       │

&#x20;       ▼

Component 2

&#x20;       │

&#x20;       ▼

Component N

&#x20;       │

&#x20;       ▼

Processed RuntimeContext

```

\---

\## Pipeline Guarantees

Verified from implementation.

\- Deterministic execution order.

\- Sequential execution.

\- No component reordering.

\- Fail-fast execution.

\- Shared RuntimeContext passed between every stage.

Status:

✅ Verified

\---

\## Execution Algorithm

Implementation

```

current = context



for each component



&#x20;   current = component.execute(current)



return current

```

Status:

✅ Verified

\---

\## RuntimeContext

Input

```

RuntimeContext

```

Output

```

RuntimeContext

```

Every Runtime Component receives the complete Runtime Context and returns the updated Runtime Context.

No component communicates directly with another component.

Communication occurs only through RuntimeContext.

Status:

✅ Verified

\---

\## Component Registration

Components are injected through the constructor.

The pipeline never creates Runtime Components.

This responsibility belongs to RuntimeFactory.

Status:

✅ Verified

\---

\## Audit Notes

The Runtime Pipeline is intentionally minimal.

It provides deterministic orchestration only.

It does not:

\- evaluate policy

\- authorize execution

\- execute connectors

\- generate receipts

\- verify trust

Those responsibilities belong to Runtime Components.

\---

\# Stage 9: Trust Chain Validation Component

\## File

```

packages/runtime/src/components/TrustChainValidationComponent.ts

```

\## Responsibility

Validate the minimum trust requirements before execution may continue.

This component does \*\*not\*\* evaluate business policy.

It validates that all mandatory trust artifacts already exist.

Status:

✅ Verified

\---

\## Position in Pipeline

```

RuntimeContext

&#x20;       │

&#x20;       ▼

TrustChainValidationComponent

&#x20;       │

&#x20;       ▼

ExecutionComponent

```

\---

\## Input

```

RuntimeContext

```

\---

\## Output

```

RuntimeContext

```

No new objects are created.

The component either:

\- returns the RuntimeContext unchanged

\- throws an exception

\---

\## Validation Sequence

```

Authority

&#x20;     │

&#x20;     ▼

Authorization

&#x20;     │

&#x20;     ▼

Intent

&#x20;     │

&#x20;     ▼

Policy

&#x20;     │

&#x20;     ▼

Decision

&#x20;     │

&#x20;     ▼

Decision Approved

&#x20;     │

&#x20;     ▼

Execution Allowed

```

Status:

✅ Verified

\---

\## Validation Rules

\### Authority

Required.

Failure

```

AuthorityRequiredError

```

\---

\### Authorization

Required.

Failure

```

AuthorizationRequiredError

```

\---

\### Intent

Required.

Failure

```

IntentRequiredError

```

\---

\### Policy

Required.

Failure

```

ValidationError



POLICY\_REQUIRED

```

\---

\### Decision

Required.

Failure

```

ValidationError



DECISION\_REQUIRED

```

\---

\### Decision Outcome

Only

```

APPROVED

```

may continue.

Any other outcome throws

```

DecisionNotApprovedError

```

\---

\## Audit Notes

This component validates trust prerequisites.

It does \*\*not\*\*

\- load policies

\- evaluate policy

\- execute systems

\- generate receipts

\- verify trust records

Its only responsibility is deciding whether the Runtime Context is complete enough to continue.

Status:

✅ Verified

\---

\# Stage 10: Execution Component

\## File

```

packages/runtime/src/components/ExecutionComponent.ts

```

\## Responsibility

Execute an approved Business Transaction through the configured Execution System.

This component is responsible for:

\- Creating the Execution artifact.

\- Building the approved Execution Request.

\- Invoking the configured Execution System.

\- Building immutable Execution Evidence.

\- Attaching execution evidence.

\- Completing or failing execution.

Status:

✅ Verified

\---

\## Position in Pipeline

```

TrustChainValidationComponent

&#x20;       │

&#x20;       ▼

ExecutionComponent

```

\---

\## Execution Sequence

```

RuntimeContext

&#x20;       │

&#x20;       ▼

Validate Decision

&#x20;       │

&#x20;       ▼

Validate Authorization

&#x20;       │

&#x20;       ▼

Create Execution Artifact

&#x20;       │

&#x20;       ▼

Build Execution Request

&#x20;       │

&#x20;       ▼

ExecutionSystem.execute()

&#x20;       │

&#x20;       ▼

Execution Response

&#x20;       │

&#x20;       ▼

Execution Evidence

&#x20;       │

&#x20;       ▼

Attach Evidence

&#x20;       │

&#x20;       ▼

Complete Execution

&#x20;       │

&#x20;       ▼

Updated RuntimeContext

```

\---

\## Preconditions

Execution requires

\- Decision

\- Signed Runtime Authorization

Failure

```

Decision missing



↓



Error

```

or

```

Authorization missing



↓



Error

```

\---

\## Step 1

Create Execution Artifact

Component

```

ExecutionService.create()

```

Purpose

Create an Execution object before execution begins.

Execution Mode

```

SYNC

```

Status:

✅ Verified

\---

\## Step 2

Build Execution Request

Component

```

ExecutionRequestBuilder

```

Input

\- BusinessTransaction

\- Runtime Authorization

Output

```

ExecutionRequest

```

Status:

✅ Verified

\---

\## Step 3

Invoke Execution System

Component

```

ExecutionSystem.execute()

```

Input

ExecutionRequest

Output

ExecutionResponse

Status:

✅ Verified

\---

\## Step 4

Build Execution Evidence

Component

```

ExecutionEvidenceBuilder

```

Input

ExecutionResponse

Output

ExecutionEvidence

Status:

✅ Verified

\---

\## Step 5

Attach Evidence

Component

```

ExecutionService.attachEvidence()

```

Purpose

Bind immutable evidence to the Execution artifact.

Status:

✅ Verified

\---

\## Step 6

Complete Execution

Component

```

ExecutionService.complete()

```

Marks execution as completed.

Status:

✅ Verified

\---

\## Failure Path

If any exception occurs

```

ExecutionService.fail()



↓



rethrow exception

```

Execution failures are recorded before the error propagates.

Status:

✅ Verified

\---

\## Output

Returns

```

RuntimeContext

```

with updated

```

execution

```

artifact.

\---

\# Stage 11: Execution System

\## File

```

packages/execution-system/src/ExecutionSystem.ts

```

\## Responsibility

Define the execution boundary between Parmana and external execution systems.

The Execution System is an abstraction.

It defines the contract that every execution implementation must satisfy.

Parmana never executes enterprise operations directly.

Instead, it delegates approved execution requests to an implementation of this interface.

Status:

✅ Verified

\---

\## Interface

```typescript

interface ExecutionSystem {

&#x20;   execute(

&#x20;       request: ExecutionRequest

&#x20;   ): Promise<ExecutionResult>;

}

```

\---

\## Input

```

ExecutionRequest

```

\---

\## Output

```

ExecutionResult

```

\---

\## Responsibilities

The Execution System is responsible for:

\- Accepting an approved Execution Request.

\- Executing the request against the configured execution target.

\- Returning an Execution Result.

It is \*\*not\*\* responsible for:

\- Policy evaluation.

\- Decision creation.

\- Authorization generation.

\- Trust record generation.

\- Receipt generation.

\- Verification.

Those responsibilities remain within the Parmana Runtime.

Status:

✅ Verified

\---

\## Architectural Boundary

```

Parmana Runtime

&#x20;       │

&#x20;       ▼

ExecutionRequest

&#x20;       │

══════════════════════════════════

Execution System Boundary

══════════════════════════════════

&#x20;       │

&#x20;       ▼

ExecutionSystem.execute()

&#x20;       │

&#x20;       ▼

ExecutionResult

&#x20;       │

══════════════════════════════════

Back into Parmana Runtime

══════════════════════════════════

&#x20;       │

&#x20;       ▼

Execution Evidence

&#x20;       │

&#x20;       ▼

Execution Trust Record

```

\---

\## Audit Notes

ExecutionSystem is an interface.

It contains no business logic.

Concrete implementations determine how execution reaches enterprise systems.

This abstraction decouples Parmana's governance runtime from specific execution technologies.

Status:

✅ Verified

\---

\# Stage 12: Execution System Implementations

\## Interface

```

packages/execution-system/src/ExecutionSystem.ts

```

\## Verified Implementations

\### Production

```

packages/execution-gateway/src/ExecutionGateway.ts

```

Implements

```

ExecutionSystem

```

Status

✅ Verified

\---

\### Default Implementation

```

packages/execution-system/src/DefaultExecutionSystem.ts

```

Implements

```

ExecutionSystem

```

Status

✅ Verified

\---

\### HTTP Implementation

```

packages/execution-system/src/HttpExecutionSystem.ts

```

Implements

```

ExecutionSystem

```

Status

✅ Verified

\---

\### Test Implementations

```

packages/api/tests/helpers/FailingExecutionSystem.ts



packages/runtime/tests/unit/execution-authorization-wiring.test.ts

```

Used only for testing.

Status

✅ Verified

\---

\## Audit Conclusion

The Runtime depends only on the `ExecutionSystem` interface.

Concrete execution behavior is supplied through dependency injection.

This allows Parmana to support multiple execution strategies without changing the Runtime.

\---

\# Stage 13: Execution Gateway

\## File

```

packages/execution-gateway/src/ExecutionGateway.ts

```

\## Responsibility

The Execution Gateway is the production implementation of the

`ExecutionSystem` interface.

It is the final verification boundary before any request is released

to an external execution target.

Status:

✅ Verified

\---

\## Position in Architecture

```

Runtime

&#x20;   │

&#x20;   ▼

ExecutionComponent

&#x20;   │

&#x20;   ▼

ExecutionGateway

&#x20;   │

&#x20;   ▼

Connector / ExecutionControl

&#x20;   │

&#x20;   ▼

Enterprise System

```

\---

\## Responsibilities

The Execution Gateway:

\- verifies the signed authorization envelope

\- verifies executable content integrity

\- prevents replay attacks

\- freezes the executable payload

\- forwards only verified requests

\- rejects every failed verification

It does \*\*not\*\*:

\- evaluate policy

\- create decisions

\- create authorizations

\- generate trust records

Status:

✅ Verified

\---

\## Verification Pipeline

```

ExecutionRequest

&#x20;       │

&#x20;       ▼

Envelope Verification

&#x20;       │

&#x20;       ▼

Executable Content Hash Verification

&#x20;       │

&#x20;       ▼

Replay Protection (Nonce)

&#x20;       │

&#x20;       ▼

Deep Freeze Transaction

&#x20;       │

&#x20;       ▼

Connector / ExecutionControl

```

Status:

✅ Verified

\---

\## Verification Order

The implementation performs verification in the following order.

1\. Envelope verification

&#x20; - signature

&#x20; - version

&#x20; - expiry

&#x20; - TTL

2\. Executable content hash verification

3\. Nonce consumption

4\. Release to execution

The nonce is intentionally consumed last.

Status:

✅ Verified

\---

\## Executable Content Verification

The gateway reconstructs the canonical executable content from the

Execution Request.

It independently hashes the reconstructed content and compares it to

the hash embedded in the signed Runtime Authorization.

If they differ:

```

Execution rejected

```

Status:

✅ Verified

\---

\## Replay Protection

Replay protection is performed only after every deterministic

verification succeeds.

A failed request never consumes a nonce.

Status:

✅ Verified

\---

\## Immutable Release

Before forwarding execution:

```

deepFreeze(executableContent)

```

is applied.

The forwarded transaction becomes immutable.

Status:

✅ Verified

\---

\## Release Targets

Exactly one execution strategy is configured.

\### Connector Mode

```

Connector.execute(...)

```

\### Controlled Execution Mode

```

ExecutionControl.execute(...)

```

or

```

ExecutionChannel.release(...)

```

The gateway rejects configurations that attempt to use both.

Status:

✅ Verified

\---

\## Failure Behaviour

Every verification failure results in rejection.

The gateway returns detailed failure information including:

\- failed verification stages

\- hash mismatches

\- replay failures

No execution is forwarded.

Status:

✅ Verified

\---

\## Audit Notes

The Execution Gateway is the final mechanical enforcement point before

enterprise execution.

It converts Runtime Authorization into controlled execution.

It is the primary security boundary of the Parmana execution model.

\---

\# Stage 14: Business Trust Pipeline

\## File

```

packages/runtime/src/BusinessTrustPipeline.ts

```

\## Responsibility

⏳ Pending Audit

Expected responsibilities:

\- Assemble the final Execution Trust Record.

\- Execute trust-building stages.

\- Produce the immutable trust artifact.

Questions to verify

\- How is the Execution Trust Record built?

\- What builders are used?

\- What evidence is included?

\- Is hashing performed here?

\- Is signing performed here?

\- Is persistence performed here?

Status

⏳ Pending

\---

\# Stage 14: Business Trust Pipeline

\## File

```

packages/runtime/src/BusinessTrustPipeline.ts

```

\## Responsibility

Assemble the canonical immutable Execution Trust Record.

The Business Trust Pipeline does \*\*not\*\* perform business logic.

It validates that the Runtime has already produced the required artifacts

and delegates trust record construction to the BusinessTrustRecordBuilder.

Status

✅ Verified

\---

\## Position in Execution Flow

```

RuntimeContext

&#x20;       │

&#x20;       ▼

BusinessTrustPipeline

&#x20;       │

&#x20;       ▼

BusinessTrustRecordBuilder

&#x20;       │

&#x20;       ▼

ExecutionTrustRecord

```

\---

\## Input

```

RuntimeContext

```

Expected artifacts

\- Business Transaction

\- Execution

Optional artifacts

\- Override

\- Verification

\- Receipt

Status

✅ Verified

\---

\## Validation

The pipeline verifies the minimum required runtime artifacts.

Required

```

BusinessTransaction

Execution

```

Failure

```

Business Transaction is required.



Execution artifact is required.

```

Status

✅ Verified

\---

\## Execution

After validation

```

BusinessTrustRecordBuilder.build(context)

```

is invoked.

The pipeline itself contains no assembly logic.

Status

✅ Verified

\---

\## Responsibilities

The pipeline

✓ validates runtime completeness

✓ delegates trust record construction

✓ returns the completed Execution Trust Record

The pipeline does NOT

✗ hash

✗ sign

✗ evaluate policy

✗ execute connectors

✗ persist data

Status

✅ Verified

\---

\## Audit Notes

BusinessTrustPipeline is intentionally minimal.

Its responsibility is orchestration, not construction.

All trust record creation is delegated to BusinessTrustRecordBuilder.

\---

\# Stage 15: Business Trust Record Builder

\## File

```

packages/runtime/src/BusinessTrustRecordBuilder.ts

```

\## Responsibility

Construct the canonical immutable `ExecutionTrustRecord`.

This builder assembles all runtime artifacts, computes the trust record hash, digitally signs the completed record, and returns the final immutable trust artifact.

Status

✅ Verified

\---

\## Position in Execution Flow

```

RuntimeContext

&#x20;       │

&#x20;       ▼

BusinessTrustRecordBuilder

&#x20;       │

&#x20;       ▼

Draft Trust Record

&#x20;       │

&#x20;       ▼

Hash

&#x20;       │

&#x20;       ▼

Digital Signature

&#x20;       │

&#x20;       ▼

ExecutionTrustRecord

```

\---

\## Input

```

RuntimeContext

```

Required

\- Business Transaction

\- Execution

Optional

\- Override

\- Verification

\- Receipt

Status

✅ Verified

\---

\## Assembly

The builder assembles:

```

trustRecordId



businessTransactionId



transaction



overrides\[]



executions\[]



verifications\[]



receipts\[]



createdAt



updatedAt

```

Status

✅ Verified

\---

\## Phase 1: Draft Record

A draft trust record is created.

At this point

```

trustRecordHash = ""



signature.value = ""

```

This temporary structure exists only to create a deterministic hash.

Status

✅ Verified

\---

\## Phase 2: Trust Record Hash

Component

```

VerificationCrypto.hash(...)

```

Output

```

trustRecordHash

```

The hash is calculated before the signature is created.

Status

✅ Verified

\---

\## Phase 3: Digital Signature

Component

```

VerificationCrypto.sign(...)

```

Input

Record including

```

trustRecordHash

```

Output

```

signature

```

Status

✅ Verified

\---

\## Phase 4: Final Record

The builder returns

```

ExecutionTrustRecord

```

containing

\- all runtime artifacts

\- trustRecordHash

\- digital signature

Status

✅ Verified

\---

\## Responsibilities

The builder

✓ assembles runtime artifacts

✓ computes trust record hash

✓ digitally signs the record

✓ returns immutable trust artifact

The builder does NOT

✗ evaluate policy

✗ execute systems

✗ persist records

✗ verify signatures

Status

✅ Verified

\---

\## Audit Notes

This is the final construction step of the execution lifecycle.

Every preceding stage exists to produce artifacts consumed by this builder.

\---

\# Stage 16: Execution Request Builder

\## File

```

packages/runtime/src/ExecutionRequestBuilder.ts

```

\## Responsibility

⏳ Pending Audit

Construct the canonical ExecutionRequest passed from the Runtime to the Execution Gateway.

Questions to verify

\- What fields are included?

\- Is the Runtime Authorization embedded?

\- Is executable content copied or reconstructed?

\- Is any mutable state included?

\- What guarantees does the builder provide?

Status

⏳ Pending

\---

\# Stage 16: Execution Request Builder

\## File

```

packages/runtime/src/ExecutionRequestBuilder.ts

```

\## Responsibility

Construct the canonical `ExecutionRequest` passed from the Runtime to the configured `ExecutionSystem`.

The builder performs structural mapping only.

It does not:

\- evaluate policy

\- create authorization

\- execute requests

\- verify signatures

\- mutate the transaction

Status

✅ Verified

\---

\## Position in Execution Flow

```

BusinessTransaction

&#x20;       │

&#x20;       ▼

Signed Runtime Authorization

&#x20;       │

&#x20;       ▼

ExecutionRequestBuilder

&#x20;       │

&#x20;       ▼

ExecutionRequest

&#x20;       │

══════════════════════════════════════

Execution Boundary

══════════════════════════════════════

&#x20;       │

&#x20;       ▼

ExecutionGateway

```

\---

\## Input

```

BusinessTransaction



SignedExecutionAuthorization

```

Status

✅ Verified

\---

\## Output

```

ExecutionRequest

```

Status

✅ Verified

\---

\## ExecutionRequest Structure

The builder constructs:

```

businessTransactionId



action



target



parameters



authorization

```

Status

✅ Verified

\---

\## Source Mapping

| ExecutionRequest | Source |

|------------------|--------|

| businessTransactionId | transaction.businessTransactionId |

| action | transaction.intent.action |

| target | transaction.intent.target |

| parameters | transaction.intent.parameters |

| authorization | SignedExecutionAuthorization |

Status

✅ Verified

\---

\## Security Properties

The builder does not create executable content.

Instead it copies the already-approved intent together with the Runtime Authorization.

This ensures the Execution Gateway independently reconstructs the canonical executable content before verification.

Status

✅ Verified

\---

\## Audit Notes

The ExecutionRequest is intentionally minimal.

\## Security Properties

The builder does not create executable content.

Instead it copies the already-approved intent together with the Runtime Authorization.

This ensures the Execution Gateway independently reconstructs the canonical executable content before verification.

Status

✅ Verified

\---

\## Architectural Notes

`ExecutionRequest` is intentionally a \*\*transport object\*\*, not a domain object.

It is the canonical message exchanged between the Runtime and the Execution System.

The Execution Gateway independently reconstructs the canonical `ExecutableContent` from the `ExecutionRequest` before verifying its integrity and authorization.

This design ensures the Gateway verifies the actual execution payload rather than trusting serialized Runtime state.

Status

✅ Verified

\---

\## Audit Notes

The ExecutionRequest is intentionally minimal.

It contains only:

\- businessTransactionId

\- action

\- target

\- parameters

\- authorization

It does not contain:

\- Policy

\- Decision

\- RuntimeContext

\- ExecutionTrustRecord

This minimizes the data crossing the Runtime → Execution System boundary while preserving deterministic verification.

Status

✅ Verified

\---

\# Stage 17: Execution Evidence Builder

\## File

```

packages/runtime/src/ExecutionEvidenceBuilder.ts

```

\## Responsibility

⏳ Pending Audit

Construct immutable Execution Evidence from the Execution Result returned by the configured Execution System.

Questions to verify

\- What evidence is preserved?

\- Is the original response copied or normalized?

\- Are timestamps generated here?

\- Is hashing performed?

\- Is evidence immutable?

Status

⏳ Pending

\---

\# Stage 17: Execution Evidence Builder

\## File

```

packages/runtime/src/ExecutionEvidenceBuilder.ts

```

\## Responsibility

Construct the canonical `ExecutionEvidence` from the `ExecutionResult` returned by the configured `ExecutionSystem`.

The builder performs structural mapping only.

It does not:

\- execute business operations

\- verify signatures

\- hash evidence

\- persist evidence

\- mutate execution state

Status

✅ Verified

\---

\## Position in Execution Flow

```

ExecutionResult

&#x20;       │

&#x20;       ▼

ExecutionEvidenceBuilder

&#x20;       │

&#x20;       ▼

ExecutionEvidence

&#x20;       │

&#x20;       ▼

ExecutionService.attachEvidence()

&#x20;       │

&#x20;       ▼

Execution Artifact

&#x20;       │

&#x20;       ▼

BusinessTrustRecordBuilder

```

\---

\## Input

```

ExecutionResult

```

Status

✅ Verified

\---

\## Output

```

ExecutionEvidence

```

Status

✅ Verified

\---

\## Evidence Structure

The builder constructs:

```

businessTransactionId



action



target



parameters



success



executedAt



attributes (optional)

```

Status

✅ Verified

\---

\## Source Mapping

| ExecutionEvidence | Source |

|-------------------|--------|

| businessTransactionId | result.businessTransactionId |

| action | result.action |

| target | result.target |

| parameters | result.parameters |

| success | result.success |

| executedAt | result.executedAt |

| attributes | result.metadata |

Status

✅ Verified

\---

\## Security Properties

The builder preserves the execution outcome exactly as returned by the configured `ExecutionSystem`.

It performs no enrichment, filtering, or transformation beyond structural mapping.

This minimizes the risk of altering execution evidence before it becomes part of the Execution Trust Record.

Status

✅ Verified

\---

\## Architectural Notes

`ExecutionEvidence` is an immutable evidence artifact.

It is \*\*not\*\* the raw connector response.

Instead, it is the canonical evidence representation used throughout the Runtime and ultimately embedded within the `ExecutionTrustRecord`.

This decouples the internal trust model from connector-specific response formats.

Status

✅ Verified

\---

\## Audit Notes

The builder intentionally contains no business logic.

It converts an `ExecutionResult` into Parmana's canonical evidence model.

This provides a stable evidence contract regardless of which `ExecutionSystem` implementation produced the original result.

Status

✅ Verified

\---

\# Stage 18: Runtime Authorization Signer

\## File

```

packages/runtime/src/RuntimeAuthorizationSigner.ts

```

\## Responsibility

Construct and sign the Runtime Execution Authorization.

The Runtime Authorization Signer is a thin orchestration layer over the

shared cryptographic infrastructure.

It is responsible for:

\- loading the Runtime signing key

\- invoking the AuthorizationSigner

\- returning the signed Runtime Authorization

It does not implement cryptographic algorithms.

Status

✅ Verified

\---

\## Position in Execution Flow

```

Decision

&#x20;       │

&#x20;       ▼

ExecutableContent

&#x20;       │

&#x20;       ▼

RuntimeAuthorizationSigner

&#x20;       │

&#x20;       ▼

AuthorizationSigner

&#x20;       │

&#x20;       ▼

SignedExecutionAuthorization

&#x20;       │

&#x20;       ▼

ExecutionRequestBuilder

```

\---

\## Input

```

decisionId



businessTransactionId



policyName



policyVersion



ExecutableContent



TTL

```

Status

✅ Verified

\---

\## Dependencies

```

CryptoBootstrap



AuthorizationSigner



FileKeyProvider

```

Status

✅ Verified

\---

\## Signing Flow

```

Load Private Key

&#x20;       │

&#x20;       ▼

AuthorizationSigner.sign(...)

&#x20;       │

&#x20;       ▼

SignedExecutionAuthorization

```

Status

✅ Verified

\---

\## Key Management

Private keys are loaded through

```

FileKeyProvider

```

using

```

DEFAULT\_KEY\_ID

```

The Runtime Authorization Signer never embeds key material.

Status

✅ Verified

\---

\## Security Properties

The Runtime Authorization Signer does not implement signing logic.

Instead it delegates all cryptographic operations to the shared

AuthorizationSigner.

This centralizes cryptographic behavior across:

\- Runtime Authorization

\- Execution Trust Records

\- Receipts

Status

✅ Verified

\---

\## Architectural Notes

The Runtime Authorization Signer is an orchestration layer.

Cryptography is implemented inside the crypto package.

This separation keeps Runtime independent from cryptographic algorithms,

allowing providers to evolve without changing Runtime orchestration.

Status

✅ Verified

\---

\## Audit Notes

This class has a single responsibility:

create a SignedExecutionAuthorization.

It does not:

\- evaluate policy

\- hash executable content

\- verify signatures

\- manage certificates

\- execute business logic

Status

✅ Verified

\---

\# Stage 19: Execution Service

\## File

```

packages/runtime/src/services/execution-service.ts

```

\## Responsibility

⏳ Pending Audit

Expected responsibilities

\- Create Execution artifact

\- Attach ExecutionEvidence

\- Complete Execution

\- Fail Execution

\- Persist execution state

Questions

\- Is Execution immutable?

\- What status transitions exist?

\- When is persistence performed?

\- Can evidence be modified after attachment?

\- How are failures recorded?

Status

⏳ Pending

\---

\# Stage 19: Execution Service

\## File

```

packages/runtime/src/services/execution-service.ts

```

\## Responsibility

Manage the lifecycle of immutable `Execution` artifacts.

The Execution Service is responsible for:

\- creating Execution artifacts

\- attaching immutable Execution Evidence

\- transitioning execution lifecycle state

\- persisting execution updates

It does not:

\- evaluate policy

\- execute enterprise systems

\- verify execution

\- generate trust records

Status

✅ Verified

\---

\## Position in Execution Flow

```

ExecutionComponent

&#x20;       │

&#x20;       ▼

ExecutionService.create()

&#x20;       │

&#x20;       ▼

Execution

&#x20;       │

&#x20;       ▼

ExecutionService.attachEvidence()

&#x20;       │

&#x20;       ▼

ExecutionService.complete()

&#x20;       │

&#x20;       ▼

BusinessTrustPipeline

```

Failure path

```

ExecutionService.fail()

```

Status

✅ Verified

\---

\## Dependencies

```

BusinessTransactionRepository



ExecutionTrustRecordRepository

```

Status

✅ Verified

\---

\## Lifecycle

```

Create

&#x20;   │

&#x20;   ▼

PROCESSING

&#x20;   │

&#x20;   ▼

Attach Evidence

&#x20;   │

&#x20;   ▼

COMPLETED

```

Failure

```

Create

&#x20;   │

&#x20;   ▼

PROCESSING

&#x20;   │

&#x20;   ▼

FAILED

```

Status

✅ Verified

\---

\## Phase 1: Create Execution

Method

```

create(...)

```

Responsibilities

\- verify Business Transaction exists

\- create Execution artifact

\- assign Execution ID

\- set status to PROCESSING

\- record startedAt timestamp

\- append Execution to Trust Record repository

Initial status

```

PROCESSING

```

Status

✅ Verified

\---

\## Phase 2: Attach Evidence

Method

```

attachEvidence(...)

```

Responsibilities

\- create a new Execution object

\- attach immutable ExecutionEvidence

\- replace stored Execution

No mutation occurs on the original object.

Status

✅ Verified

\---

\## Phase 3: Complete Execution

Method

```

complete(...)

```

Responsibilities

\- transition status to COMPLETED

\- set completedAt timestamp

\- persist updated Execution

Status

```

COMPLETED

```

Status

✅ Verified

\---

\## Phase 4: Fail Execution

Method

```

fail(...)

```

Responsibilities

\- transition status to FAILED

\- set completedAt timestamp

\- persist updated Execution

Status

```

FAILED

```

Status

✅ Verified

\---

\## Security Properties

Execution artifacts are treated as immutable.

Every lifecycle transition creates a new Execution object rather than modifying the existing instance.

Persistence occurs after each transition.

Status

✅ Verified

\---

\## Architectural Notes

The Execution Service manages execution state only.

It does not communicate with enterprise systems.

Enterprise execution occurs in `ExecutionComponent` through the configured `ExecutionSystem`.

The Execution Service records and persists the resulting execution lifecycle.

Status

✅ Verified

\---

\## Audit Notes

Execution state transitions are explicit.

```

PROCESSING



↓



COMPLETED

```

or

```

PROCESSING



↓



FAILED

```

The service separates execution state management from execution itself, keeping orchestration and persistence independent.

Status

✅ Verified

\---

\# Stage 20: Business Transaction Service

\## File

```

packages/runtime/src/services/business-transaction-service.ts

```

\## Responsibility

Accept, validate, persist, and retrieve immutable `BusinessTransaction` objects.

The Business Transaction Service is responsible for:

\- validating Business Transactions

\- preventing duplicate transactions

\- persisting immutable Business Transactions

\- retrieving Business Transactions

It does not:

\- evaluate policy

\- execute enterprise systems

\- create decisions

\- create trust records

\- verify execution

Status

✅ Verified

\---

\## Position in Execution Flow

```

BusinessTransaction

&#x20;       │

&#x20;       ▼

BusinessTransactionService.accept()

&#x20;       │

&#x20;       ▼

BusinessTransactionValidator

&#x20;       │

&#x20;       ▼

Duplicate Check

&#x20;       │

&#x20;       ▼

Repository.create()

&#x20;       │

&#x20;       ▼

Immutable BusinessTransaction

```

Status

✅ Verified

\---

\## Dependencies

```

BusinessTransactionRepository



BusinessTransactionValidator

```

Status

✅ Verified

\---

\## Phase 1: Validate

Method

```

BusinessTransactionValidator.validate(...)

```

Responsibilities

\- validate trust-chain invariants

\- reject structurally invalid transactions

Status

✅ Verified

\---

\## Phase 2: Duplicate Detection

Method

```

repository.exists(...)

```

Responsibilities

\- detect duplicate BusinessTransactionId

\- reject duplicate requests

Failure

```

DuplicateBusinessTransactionError

```

Status

✅ Verified

\---

\## Phase 3: Persist

Method

```

repository.create(...)

```

Responsibilities

\- persist immutable BusinessTransaction

\- return stored transaction

Status

✅ Verified

\---

\## Retrieval Operations

Supported methods

```

get(...)



list(...)

```

These methods provide read-only access to previously accepted Business Transactions.

Status

✅ Verified

\---

\## Security Properties

Every Business Transaction is validated before persistence.

Duplicate transaction identifiers are rejected.

Once accepted, the Business Transaction is treated as immutable.

Status

✅ Verified

\---

\## Architectural Notes

The Business Transaction Service is the Runtime's acceptance boundary.

No Runtime processing occurs until a Business Transaction has been:

\- validated

\- checked for uniqueness

\- persisted

This establishes a canonical transaction before policy evaluation begins.

Status

✅ Verified

\---

\## Audit Notes

The service performs three responsibilities only:

\- validate

\- reject duplicates

\- persist

Policy evaluation, authorization, execution, and trust record generation are delegated to later Runtime stages.

Status

✅ Verified

\---

\# Stage 21: Verification Service

\## File

```

packages/runtime/src/services/verification-service.ts

```

\## Responsibility

⏳ Pending Audit

Expected responsibilities

\- Verify Execution Trust Records

\- Validate cryptographic integrity

\- Produce Verification artifacts

Questions

\- What is actually verified?

\- Are signatures verified?

\- Are hashes recomputed?

\- Are authorizations verified?

\- Does verification mutate anything?

\- Is verification deterministic?

Status

⏳ Pending

\---

\# Stage 21: Verification Service

\## File

```

packages/runtime/src/services/verification-service.ts

```

\## Responsibility

Verify the integrity and authenticity of an `ExecutionTrustRecord`.

The Verification Service performs deterministic verification of the

complete trust record and produces an immutable `Verification` artifact.

It is responsible for:

\- validating trust record integrity

\- verifying cryptographic signatures

\- validating authorization binding

\- recording verification results

It does not:

\- execute business operations

\- evaluate policy

\- modify trust records

\- generate receipts

Status

✅ Verified

\---

\## Position in Execution Flow

```

ExecutionTrustRecord

&#x20;       │

&#x20;       ▼

VerificationService

&#x20;       │

&#x20;       ▼

Verification

&#x20;       │

&#x20;       ▼

ReceiptService

```

Status

✅ Verified

\---

\## Dependencies

```

ExecutionTrustRecordRepository



VerificationCrypto

```

Status

✅ Verified

\---

\## Verification Flow

```

Load Trust Record

&#x20;       │

&#x20;       ▼

Run Verification Checks

&#x20;       │

&#x20;       ▼

Build Verification Artifact

&#x20;       │

&#x20;       ▼

Persist Verification

&#x20;       │

&#x20;       ▼

Return Verification

```

Status

✅ Verified

\---

\## Verification Checks

The service performs every verification independently.

A failure in one check does not prevent the remaining checks from running.

Status

✅ Verified

\---

\### Check 1: Integrity

```

VerificationCrypto.hash(...)

```

The trust record hash is recomputed.

Verification succeeds only when

```

recomputedHash == storedHash

```

Failure

```

Integrity check failed

```

Status

✅ Verified

\---

\### Check 2: Signature

```

VerificationCrypto.verifySignature(...)

```

The digital signature must verify using the stored public key.

Failure

```

Signature check failed

```

Status

✅ Verified

\---

\### Check 3: Authorization Binding

Every APPROVED execution must contain

```

authorizationId

```

inside

```

execution.metadata

```

Rejected executions are exempt.

Failure

```

Authorization binding check failed

```

Status

✅ Verified

\---

\## Verification Artifact

The service constructs

```

verificationId



businessTransactionId



status



message



verifiedAt



trustRecordHash

```

Status

✅ Verified

\---

\## Persistence

Verification artifacts are appended using

```

appendVerification(...)

```

Previous verification history is preserved.

Status

✅ Verified

\---

\## Security Properties

Verification is deterministic.

All checks execute regardless of earlier failures.

The resulting Verification artifact records every detected failure.

Status

✅ Verified

\---

\## Architectural Notes

Verification is modeled as its own immutable domain artifact.

Rather than returning only a boolean, Parmana records a complete

Verification object containing:

\- verification identity

\- verification timestamp

\- verification status

\- verification message

\- verified trust record hash

This provides durable evidence that verification occurred and what it

verified.

Status

✅ Verified

\---

\## Audit Notes

Verification consists of three independent security guarantees:

\- Integrity

\- Authenticity

\- Authorization Binding

Only after these checks complete is the Runtime ready to generate a

Receipt.

Status

✅ Verified

\---

\# Stage 22: Receipt Service

\## File

```

packages/runtime/src/services/receipt-service.ts

```

\## Responsibility

Generate immutable cryptographic Receipts for successfully verified

Execution Trust Records.

The Receipt Service is responsible for:

\- validating verification status

\- computing receipt hashes

\- generating signed receipts

\- persisting receipt artifacts

It does not:

\- execute business operations

\- evaluate policy

\- verify trust records

\- modify Execution Trust Records

Status

✅ Verified

\---

\## Position in Execution Flow

```

ExecutionTrustRecord

&#x20;       │

&#x20;       ▼

ReceiptService

&#x20;       │

&#x20;       ▼

Receipt

```

Status

✅ Verified

\---

\## Dependencies

```

ExecutionTrustRecordRepository



ReceiptCrypto

```

Status

✅ Verified

\---

\## Receipt Generation Flow

```

Load Trust Record

&#x20;       │

&#x20;       ▼

Verify Latest Verification

&#x20;       │

&#x20;       ▼

Compute Receipt Hash

&#x20;       │

&#x20;       ▼

Create Signed Receipt

&#x20;       │

&#x20;       ▼

Persist Receipt

&#x20;       │

&#x20;       ▼

Return Receipt

```

Status

✅ Verified

\---

\## Phase 1: Load Trust Record

Method

```

findByTransactionId(...)

```

Failure

```

VerificationFailedError

```

Status

✅ Verified

\---

\## Phase 2: Verification Prerequisite

The latest Verification must exist.

Required status

```

VERIFIED

```

Otherwise

```

ReceiptGenerationError

```

is thrown.

Status

✅ Verified

\---

\## Phase 3: Receipt Hash

Component

```

ReceiptCrypto.hash(...)

```

Input

```

ExecutionTrustRecord

```

Output

```

receiptHash

```

Status

✅ Verified

\---

\## Phase 4: Create Receipt

Component

```

ReceiptCrypto.createReceipt(...)

```

Receipt contains

```

receiptId



businessTransactionId



trustRecordHash



receiptHash



issuedAt

```

Status

✅ Verified

\---

\## Phase 5: Persistence

Receipt is appended using

```

appendReceipt(...)

```

Receipt history is preserved.

Status

✅ Verified

\---

\## Security Properties

Receipts cannot exist without successful verification.

Receipt generation depends on:

\- existing Execution Trust Record

\- successful Verification

\- cryptographic Receipt generation

Status

✅ Verified

\---

\## Architectural Notes

A Receipt is not generated directly from execution.

It is generated only after the Execution Trust Record has been successfully verified.

The Receipt therefore attests to the integrity and authenticity of the verified trust record rather than the execution event alone.

Status

✅ Verified

\---

\## Audit Notes

Receipt generation is the final Runtime operation.

The Runtime execution lifecycle is therefore:

Business Transaction

↓

Execution

↓

Execution Trust Record

↓

Verification

↓

Receipt

Status

✅ Verified

\---

\# Stage 23: Policy Router

\## File

```

packages/policy/src/PolicyRouter.ts

```

\## Responsibility

⏳ Pending Audit

Expected responsibilities

\- Resolve requested policy

\- Load correct policy version

\- Delegate to repository

Questions

\- How are versions selected?

\- Is latest supported?

\- How are missing policies handled?

\- Is caching performed?

Status

⏳ Pending

\---

\# Stage 23: Policy Router

\## File

```

packages/policy/src/PolicyRouter.ts

```

\## Responsibility

Load and validate exactly one Policy.

The Policy Router is responsible for:

\- loading the requested policy from the configured repository

\- validating the loaded policy

\- returning the validated policy

It does not:

\- evaluate policy

\- execute rules

\- cache policies

\- select outcomes

\- persist policies

Status

✅ Verified

\---

\## Position in Decision Flow

```

BusinessTransaction

&#x20;       │

&#x20;       ▼

PolicyRouter

&#x20;       │

&#x20;       ▼

PolicyRepository

&#x20;       │

&#x20;       ▼

PolicyValidator

&#x20;       │

&#x20;       ▼

Validated Policy

&#x20;       │

&#x20;       ▼

PolicyEngine

```

Status

✅ Verified

\---

\## Dependencies

```

PolicyRepository



PolicyValidator

```

Status

✅ Verified

\---

\## Decision Flow

```

Load Policy

&#x20;       │

&#x20;       ▼

Validate Policy

&#x20;       │

&#x20;       ▼

Return Policy

```

Status

✅ Verified

\---

\## Phase 1: Load Policy

Method

```

repository.load(name, version)

```

Responsibilities

\- resolve policy name

\- resolve policy version

\- retrieve policy

Status

✅ Verified

\---

\## Phase 2: Validate Policy

Method

```

PolicyValidator.validate(...)

```

Responsibilities

\- validate loaded policy

\- reject invalid policy definitions

Status

✅ Verified

\---

\## Security Properties

Every policy is validated before entering the Policy Engine.

The Runtime never evaluates an unvalidated policy.

Status

✅ Verified

\---

\## Architectural Notes

PolicyRouter is an orchestration layer.

It delegates:

\- storage to PolicyRepository

\- validation to PolicyValidator

It performs no business decision logic.

Status

✅ Verified

\---

\## Audit Notes

Policy loading and policy evaluation are intentionally separated.

PolicyRouter is responsible for obtaining a valid Policy.

PolicyEngine is responsible for evaluating that Policy.

Status

✅ Verified

\---

\# Stage 24: File Policy Repository

\## File

```

packages/policy/src/FilePolicyRepository.ts

```

\## Responsibility

Load Policy definitions from the filesystem.

The File Policy Repository is responsible for:

\- locating policy files

\- loading policy JSON

\- deserializing policy definitions

\- reporting missing policies

It does not:

\- validate policies

\- evaluate policies

\- cache policies

\- modify policies

Status

✅ Verified

\---

\## Position in Decision Flow

```

PolicyRouter

&#x20;       │

&#x20;       ▼

FilePolicyRepository

&#x20;       │

&#x20;       ▼

policy.json

&#x20;       │

&#x20;       ▼

Policy

&#x20;       │

&#x20;       ▼

PolicyValidator

```

Status

✅ Verified

\---

\## Repository Layout

Policies are organized by:

```

policies/

&#x20;   <policy-name>/

&#x20;       <version>/

&#x20;           policy.json

```

Example

```

policies/

&#x20;   vendor-payment/

&#x20;       1.0.0/

&#x20;           policy.json

```

Status

✅ Verified

\---

\## Resolution Strategy

Policy path

```

basePath/

&#x20;   name/

&#x20;       version/

&#x20;           policy.json

```

Example

```

policies/vendor-payment/1.0.0/policy.json

```

Status

✅ Verified

\---

\## Loading Flow

```

Construct File Path

&#x20;       │

&#x20;       ▼

Read JSON

&#x20;       │

&#x20;       ▼

Parse JSON

&#x20;       │

&#x20;       ▼

Return Policy

```

Status

✅ Verified

\---

\## Error Handling

If the file cannot be loaded

```

PolicyNotFoundError

```

is thrown.

The repository does not expose filesystem exceptions directly.

Status

✅ Verified

\---

\## Security Properties

The repository only loads policy definitions.

Validation occurs later in `PolicyValidator`.

Evaluation occurs later in `PolicyEngine`.

Status

✅ Verified

\---

\## Architectural Notes

`FilePolicyRepository` is a storage adapter implementing the

`PolicyRepository` interface.

The Runtime depends on the interface rather than filesystem-specific

behavior, allowing alternate implementations (database, object storage,

Git-backed repositories, etc.) without changing Runtime orchestration.

Status

✅ Verified

\---

\## Audit Notes

Policy lookup is deterministic.

The repository resolves exactly one policy using:

\- name

\- version

No implicit "latest" resolution, version negotiation, or fallback behavior

exists in this implementation.

Status

✅ Verified

\---

\# Stage 25: Policy Engine

\## File

```

packages/policy/src/PolicyEngine.ts

```

\## Responsibility

Evaluate exactly one validated Policy against a set of input signals and

produce a deterministic `PolicyDecision`.

The Policy Engine is responsible for:

\- evaluating policy rules

\- evaluating policy conditions

\- selecting the first matching rule

\- producing a deterministic PolicyDecision

It does not:

\- authorize execution

\- execute business operations

\- access external systems

\- persist data

\- create trust records

\- generate timestamps

Status

✅ Verified

\---

\## Position in Decision Flow

```

Validated Policy

&#x20;       │

&#x20;       ▼

PolicyEngine

&#x20;       │

&#x20;       ▼

PolicyDecision

&#x20;       │

&#x20;       ▼

DecisionBuilder

```

Status

✅ Verified

\---

\## Inputs

```

Policy



PolicySignals

```

Status

✅ Verified

\---

\## Output

```

PolicyDecision

```

containing

\- policyId

\- policyVersion

\- outcome

\- reason

\- matchedRuleId

\- evaluatedRules

\- matchedPath

Status

✅ Verified

\---

\## Evaluation Flow

```

Policy

&#x20;       │

&#x20;       ▼

Rule 1

&#x20;       │

&#x20;       ├── Match?

&#x20;       │

&#x20;       ├── Yes → STOP

&#x20;       │

&#x20;       ▼

Rule 2

&#x20;       │

&#x20;       ├── Match?

&#x20;       │

&#x20;       ├── Yes → STOP

&#x20;       │

&#x20;       ▼

Rule 3

&#x20;       │

&#x20;       ▼

...

&#x20;       │

&#x20;       ▼

No Match

```

Status

✅ Verified

\---

\## Rule Selection Strategy

Evaluation uses

```

First Match Wins

```

Rules are evaluated in declaration order.

The first matching rule terminates evaluation.

No remaining rules are evaluated.

Status

✅ Verified

\---

\## Condition Types

Supported conditions

\### Leaf

```

fact

operator

value

```

Status

✅ Verified

\---

\### Always

```

always

```

Always evaluates to true.

Status

✅ Verified

\---

\### Logical AND

```

all\[]

```

Every child condition must evaluate to true.

Status

✅ Verified

\---

\### Logical OR

```

any\[]

```

At least one child condition must evaluate to true.

Status

✅ Verified

\---

\## Missing Signal Behavior

If a required signal is missing

```

signal === undefined

```

the condition evaluates to

```

false

```

No exception is thrown.

Status

✅ Verified

\---

\## Operator Evaluation

Leaf comparisons are delegated to

```

OperatorEvaluator

```

The Policy Engine does not implement comparison operators directly.

Status

✅ Verified

\---

\## Default Outcome

If no rule matches

```

matchedRuleId = "none"



reason = "no\_rule\_matched"



outcome = REJECT

```

Status

✅ Verified

\---

\## Trace Generation

The engine records

```

evaluatedRules



matchedPath

```

These provide deterministic evidence of the evaluation process.

Status

✅ Verified

\---

\## Security Properties

The Policy Engine is deterministic.

Given:

\- identical Policy

\- identical PolicySignals

it will always produce the same PolicyDecision.

The engine has:

\- no randomness

\- no timestamps

\- no network access

\- no mutable state

Status

✅ Verified

\---

\## Architectural Notes

The Policy Engine performs only evaluation.

Authorization, execution, verification, and trust generation occur in

later Runtime stages.

Comparison semantics are delegated to `OperatorEvaluator`, allowing the

evaluation engine to remain focused on rule traversal and decision

construction.

Status

✅ Verified

\---

\## Audit Notes

The engine implements a deterministic \*\*first-match-wins\*\* evaluation

model.

\---

\# Stage 26: Operator Evaluator

\## File

```

packages/policy/src/OperatorEvaluator.ts

```

\## Responsibility

Evaluate deterministic policy operators against JSON values.

The Operator Evaluator is responsible for:

\- evaluating comparison operators

\- evaluating logical predicates

\- evaluating collection operators

\- evaluating string operators

\- evaluating type operators

\- returning deterministic boolean results

It does not:

\- load policies

\- traverse policy rules

\- authorize execution

\- access external systems

\- mutate state

Status

✅ Verified

\---

\## Position in Decision Flow

```

PolicyCondition

&#x20;       │

&#x20;       ▼

OperatorEvaluator

&#x20;       │

&#x20;       ▼

true / false

&#x20;       │

&#x20;       ▼

PolicyEngine

```

Status

✅ Verified

\---

\## Evaluation Categories

Supported operator groups

\### Equality

```

eq

neq

```

Status

✅ Verified

\---

\### Numeric

```

gt

gte

lt

lte

between

```

Status

✅ Verified

\---

\### Collection

```

in

not\_in

contains

not\_contains

contains\_all

contains\_any

```

Status

✅ Verified

\---

\### String

```

starts\_with

ends\_with

matches

```

Status

✅ Verified

\---

\### Existence

```

exists

not\_exists

```

Status

✅ Verified

\---

\### Boolean

```

is\_true

is\_false

```

Status

✅ Verified

\---

\### Null

```

is\_null

is\_not\_null

```

Status

✅ Verified

\---

\### Length

```

length\_eq

length\_gt

length\_gte

length\_lt

length\_lte

```

Status

✅ Verified

\---

\### Type

```

type\_is

```

Status

✅ Verified

\---

\## Type Safety

Numeric operators execute only for numeric values.

String operators execute only for string values.

Collection operators execute only for arrays.

Invalid type combinations evaluate to false rather than producing implicit coercion.

Status

✅ Verified

\---

\## Missing Values

Missing values are handled explicitly.

Unsupported comparisons do not rely on JavaScript type coercion.

Status

✅ Verified

\---

\## Regular Expressions

Regex matching is delegated to

```

matches()

```

The evaluator assumes patterns have already been validated by

`PolicyValidator`.

Status

✅ Verified

\---

\## Helper Functions

Internal helpers provide deterministic behavior for

\- type detection

\- length calculation

\- numeric checks

\- string checks

Status

✅ Verified

\---

\## Security Properties

The evaluator is pure.

Given identical inputs

```

actual



operator



expected

```

it always returns the same result.

It has

\- no mutable state

\- no timestamps

\- no randomness

\- no I/O

\- no network access

Status

✅ Verified

\---

\## Architectural Notes

OperatorEvaluator is intentionally isolated from policy traversal.

PolicyEngine decides \*\*which\*\* conditions to evaluate.

OperatorEvaluator decides \*\*how\*\* an individual condition evaluates.

This separation keeps comparison semantics independent from rule traversal.

Status

✅ Verified

\---

\## Audit Notes

Operator evaluation is deterministic and side-effect free.

It forms the lowest execution layer of Parmana's deterministic policy evaluation engine.

Status

✅ Verified

\---

\# Stage 27: Decision Builder

\## File

```

packages/runtime/src/DecisionBuilder.ts

```

\## Responsibility

⏳ Pending Audit

Expected responsibilities

\- Build immutable Decision artifacts

\- Transform PolicyDecision into Decision

\- Capture decision metadata

Questions

\- Which fields are copied?

\- Is decisionId generated here?

\- Is timestamp generated here?

\- Is the BusinessTransaction embedded?

\- Are policy traces preserved?

Status

⏳ Pending

It supports nested logical expressions (`all`, `any`), simple leaf

conditions, and an unconditional `always` condition.

When no rule matches, the default decision is rejection.

Status

✅ Verified

It contains only:

\- execution intent

\- runtime authorization

No policy information.

No decision object.

No runtime context.

No trust record.

The ExecutionRequest is therefore the minimal object required to authorize execution outside the Runtime.

\# Remaining Audit

The following components have not yet been audited.

```

RuntimeEngine



RuntimeBuilder



TrustChainValidationComponent



ExecutionComponent



ExecutionSystem



ExecutionGateway



Connector SDK



ReceiptService



VerificationService



ExecutionTrustRecord



Replay



Storage

```

Status:

⏳ Pending

# Stage 21: Verification Service

## File

```text
packages/runtime/src/services/verification-service.ts
```

## Responsibility

Verify an immutable `ExecutionTrustRecord` and produce a `Verification`
artifact.

The Verification Service loads the Execution Trust Record, performs
deterministic verification checks, records the verification result,
persists the Verification artifact, and returns the completed
Verification.

It validates the integrity and authenticity of the complete Execution
Trust Record.

Status

✅ Verified

---

## Creates

- Verification

Uses

```text
ExecutionTrustRecordRepository

VerificationCrypto
```

Status

✅ Verified

---

## Public Operation

```text
verify(
    businessTransactionId
)
```

Input

```text
businessTransactionId
```

Output

```text
Verification
```

Status

✅ Verified

---

## Execution Sequence

```text
Load Execution Trust Record

↓

Run Verification Checks

↓

Create Verification

↓

Append Verification

↓

Return Verification
```

Status

✅ Verified

---

## Phase 1: Load Execution Trust Record

Component

```text
ExecutionTrustRecordRepository.findByTransactionId()
```

Input

```text
businessTransactionId
```

Output

```text
ExecutionTrustRecord
```

Failure

```text
VerificationFailedError

Execution Trust Record not found.
```

Status

✅ Verified

---

## Phase 2: Execute Verification Checks

Component

```text
runChecks(...)
```

## Responsibility

Execute every verification independently.

Unlike fail-fast validation, every verification check executes even if
earlier checks fail.

All failures are accumulated and returned together.

Output

```text
string[]
```

Status

✅ Verified

---

## Verification Check 1: Trust Record Integrity

Component

```text
VerificationCrypto.hash(...)
```

Input

```text
ExecutionTrustRecord
```

Output

```text
Expected Trust Record Hash
```

Purpose

Recompute the Trust Record hash and compare it with the stored hash.

Validation

```text
expectedHash
==
trustRecord.trustRecordHash
```

Failure

```text
Integrity check failed
```

Status

✅ Verified

---

## Verification Check 2: Signature Verification

Component

```text
VerificationCrypto.verifySignature(...)
```

Input

```text
ExecutionTrustRecord
```

Output

```text
boolean
```

Purpose

Verify the cryptographic signature stored inside the Trust Record.

Validation

```text
Signature verifies
```

Failure

```text
Signature check failed
```

Status

✅ Verified

---

## Verification Check 3: Authorization Binding

Purpose

Every APPROVED execution must contain an authorization reference.

Validation

```text
DecisionOutcome.APPROVED

↓

metadata.authorizationId exists
```

Rejected executions are skipped.

Failure

```text
Authorization binding check failed
```

Status

✅ Verified

---

## Phase 3: Create Verification

Creates

```text
Verification
```

Fields

- verificationId
- businessTransactionId
- status
- message
- verifiedAt
- trustRecordHash

Status

✅ Verified

---

## Verification Status

Successful

```text
VerificationStatus.VERIFIED
```

Failed

```text
VerificationStatus.FAILED
```

If verification succeeds

```text
Execution Trust Record verified successfully.
```

Otherwise

```text
All verification failures are concatenated into a single message.
```

Status

✅ Verified

---

## Phase 4: Persist Verification

Component

```text
ExecutionTrustRecordRepository.appendVerification(...)
```

Purpose

Append the Verification artifact to the existing Execution Trust Record.

Status

✅ Verified

---

## Security Properties

The Verification Service performs deterministic verification.

It validates

- Trust Record integrity
- Digital signature
- Authorization binding

Every verification executes regardless of previous failures.

The original Execution Trust Record is never modified.

Status

✅ Verified

---

## Architectural Notes

The Verification Service performs orchestration and verification.

Cryptographic operations are delegated to

```text
VerificationCrypto
```

Persistence is delegated to

```text
ExecutionTrustRecordRepository
```

The verification algorithm itself is implemented inside

```text
runChecks(...)
```

Status

✅ Verified

---

## Audit Notes

The Verification Service validates an existing Execution Trust Record.

It does not

- execute business operations
- evaluate policy
- modify Trust Records
- generate receipts

It performs three deterministic verification checks

- Trust Record integrity
- Signature verification
- Authorization binding

Unlike fail-fast validation, every verification executes and every
failure is reported.

Status

✅ Verified

# Stage 22: Receipt Service

## File

```text
packages/runtime/src/services/receipt-service.ts
```

## Responsibility

⏳ Pending Audit

The Receipt Service is responsible for generating immutable
Execution Receipts from verified Execution Trust Records.

Expected responsibilities

- generate Execution Receipts
- assign Receipt identifiers
- record receipt creation time
- persist Receipts
- retrieve existing Receipts

It should not

- evaluate policy
- execute business operations
- verify Trust Records
- modify Execution Trust Records

Status

⏳ Pending

---

## Creates

Expected

- Receipt

Uses

```text
ExecutionTrustRecordRepository

ReceiptBuilder
```

Status

⏳ Pending

---

## Public Operations

Expected

```text
generate(
    businessTransactionId
)
```

Returns

```text
Receipt
```

Additional operations to verify

```text
get(...)

list(...)
```

Status

⏳ Pending

---

## Expected Execution Sequence

```text
Load Execution Trust Record

↓

Validate Verification

↓

Build Receipt

↓

Persist Receipt

↓

Return Receipt
```

Status

⏳ Pending

---

## Questions To Verify

- How is the Receipt created?
- Does generation require successful verification?
- Which builder creates the Receipt?
- Is hashing performed here?
- Is signing performed here?
- Are Receipts immutable?
- Where are Receipts persisted?
- Can multiple Receipts exist for one Trust Record?

Status

⏳ Pending

---

## Expected Dependencies

To verify

```text
ExecutionTrustRecordRepository

ReceiptBuilder

VerificationService
```

Status

⏳ Pending

---

## Security Properties

To verify

- Receipt generated only from verified Trust Records
- Receipt immutable after creation
- Receipt contains verifiable references
- Receipt creation is deterministic

Status

⏳ Pending

---

## Architectural Notes

To verify

- Receipt Service should orchestrate receipt generation.
- Construction should be delegated to ReceiptBuilder.
- Persistence should be delegated to the repository.

Status

⏳ Pending

---

## Audit Notes

Pending implementation audit.

Source code inspection required before documenting behavior.

Status

⏳ Pending

# Stage 22: Receipt Service

## File

```text
packages/runtime/src/services/receipt-service.ts
```

## Responsibility

Generate immutable cryptographic Receipts for verified
Execution Trust Records.

The Receipt Service loads the Execution Trust Record,
ensures the latest Verification succeeded, computes the
Receipt hash, creates a signed Receipt, persists it, and
returns the completed Receipt.

Status

✅ Verified

---

## Creates

- Receipt

Uses

```text
ExecutionTrustRecordRepository

ReceiptCrypto
```

Status

✅ Verified

---

## Public Operation

```text
generate(
    businessTransactionId
)
```

Input

```text
businessTransactionId
```

Output

```text
Receipt
```

Status

✅ Verified

---

## Execution Sequence

```text
Load Execution Trust Record

↓

Validate Latest Verification

↓

Compute Receipt Hash

↓

Create Signed Receipt

↓

Persist Receipt

↓

Return Receipt
```

Status

✅ Verified

---

## Phase 1: Load Execution Trust Record

Component

```text
ExecutionTrustRecordRepository.findByTransactionId()
```

Input

```text
businessTransactionId
```

Output

```text
ExecutionTrustRecord
```

Failure

```text
VerificationFailedError

Execution Trust Record not found.
```

Status

✅ Verified

---

## Phase 2: Validate Latest Verification

Purpose

Ensure the latest Verification completed successfully before
a Receipt may be generated.

Validation

```text
trustRecord.verifications.at(-1)

↓

VerificationStatus.VERIFIED
```

Failure

```text
ReceiptGenerationError

Execution Trust Record must be successfully verified before a
Receipt can be generated.
```

Status

✅ Verified

---

## Phase 3: Compute Receipt Hash

Component

```text
ReceiptCrypto.hash(...)
```

Input

```text
ExecutionTrustRecord
```

Output

```text
receiptHash
```

Purpose

Compute the cryptographic hash used when constructing the
Receipt.

Status

✅ Verified

---

## Phase 4: Create Signed Receipt

Component

```text
ReceiptCrypto.createReceipt(...)
```

Creates

```text
Receipt
```

Fields

- receiptId
- businessTransactionId
- trustRecordHash
- receiptHash
- issuedAt

Purpose

Construct and digitally sign the Receipt.

Status

✅ Verified

---

## Phase 5: Persist Receipt

Component

```text
ExecutionTrustRecordRepository.appendReceipt(...)
```

Purpose

Append the Receipt to the existing Execution Trust Record.

Status

✅ Verified

---

## Security Properties

Receipt generation requires a successfully verified
Execution Trust Record.

A Receipt cannot be generated when

- no Verification exists
- the latest Verification failed

Receipt creation delegates all cryptographic operations to

```text
ReceiptCrypto
```

Status

✅ Verified

---

## Architectural Notes

The Receipt Service is an orchestration layer.

Cryptographic operations are delegated to

```text
ReceiptCrypto
```

Persistence is delegated to

```text
ExecutionTrustRecordRepository
```

The service performs no policy evaluation or execution.

Status

✅ Verified

---

## Audit Notes

The Receipt Service performs five responsibilities only.

- Load the Execution Trust Record.
- Verify the latest Verification succeeded.
- Compute the Receipt hash.
- Create the signed Receipt.
- Persist and return the Receipt.

The service does not

- evaluate policy
- execute business operations
- modify the Execution Trust Record
- implement cryptographic algorithms

Receipt generation is only permitted after successful
verification, establishing a strict lifecycle:

```text
Execution

↓

Verification

↓

Receipt
```

Status

✅ Verified

# Stage 23: Receipt Crypto

## File

```text
packages/crypto/src/ReceiptCrypto.ts
```

## Responsibility

Own all cryptographic operations related to Receipts.

The Receipt Crypto component computes canonical Receipt hashes,
digitally signs Receipt artifacts, and creates immutable signed
Receipts.

It delegates hashing, signing, and key management to dedicated
cryptographic components.

Status

✅ Verified

---

## Creates

- Receipt

Uses

```text
CryptoBootstrap

FileKeyProvider

TrustRecordHasher

ReceiptHasher

ArtifactSigner
```

Status

✅ Verified

---

## Public Operations

```text
hash(
    trustRecord
)
```

```text
sign(
    value
)
```

```text
createReceipt(
    payload
)
```

Status

✅ Verified

---

## Execution Sequence

```text
Execution Trust Record

↓

ReceiptHasher.hash()

↓

Receipt Hash

↓

Build Unsigned Receipt

↓

Load Private Key

↓

ArtifactSigner.sign()

↓

Signed Receipt

↓

Return Receipt
```

Status

✅ Verified

---

## Phase 1: Compute Receipt Hash

Component

```text
ReceiptHasher
```

Method

```text
hash(...)
```

Input

```text
ExecutionTrustRecord
```

Output

```text
receiptHash
```

Purpose

Compute the canonical Receipt hash from the supplied
Execution Trust Record.

Implementation

```text
ReceiptHasher

↓

TrustRecordHasher

↓

Crypto Provider
```

Status

✅ Verified

---

## Phase 2: Load Signing Key

Component

```text
FileKeyProvider
```

Method

```text
getPrivateKey(DEFAULT_KEY_ID)
```

Purpose

Load the Runtime private signing key.

The implementation currently uses a filesystem-backed key provider.

Status

✅ Verified

---

## Phase 3: Sign Artifact

Component

```text
ArtifactSigner
```

Method

```text
sign(...)
```

Input

```text
Unsigned Receipt
```

Output

```text
Digital Signature
```

Purpose

Digitally sign the canonical Receipt using the configured
SignatureProvider.

Status

✅ Verified

---

## Phase 4: Create Receipt

Method

```text
createReceipt(...)
```

Input

```text
Receipt Payload
```

Creates

```text
Unsigned Receipt
```

Fields

- receiptId
- businessTransactionId
- trustRecordHash
- receiptHash
- issuedAt
- algorithm

The signature is then generated and appended.

Output

```text
Receipt
```

Fields

- receiptId
- businessTransactionId
- trustRecordHash
- receiptHash
- issuedAt
- algorithm
- signature

Status

✅ Verified

---

## Dependencies

```text
CryptoBootstrap

↓

SignatureProvider

↓

ArtifactSigner

↓

ReceiptCrypto
```

Hashing

```text
TrustRecordHasher

↓

ReceiptHasher

↓

ReceiptCrypto
```

Status

✅ Verified

---

## Security Properties

ReceiptCrypto never implements cryptographic algorithms directly.

It delegates all cryptographic operations to dedicated components.

Key material is never embedded in the Receipt.

The signing algorithm is obtained from the configured
SignatureProvider.

Status

✅ Verified

---

## Architectural Notes

ReceiptCrypto is a cryptographic orchestration component.

It coordinates

- Receipt hashing
- Private key retrieval
- Digital signing
- Receipt construction

Cryptographic implementations remain isolated inside reusable
crypto components.

Status

✅ Verified

---

## Audit Notes

ReceiptCrypto performs four responsibilities only.

- Compute the canonical Receipt hash.
- Load the Runtime signing key.
- Digitally sign Receipt artifacts.
- Produce immutable signed Receipts.

It does not

- evaluate policy
- verify signatures
- execute business operations
- persist Receipts

All cryptographic primitives are delegated through
CryptoBootstrap, enabling the signing implementation to evolve
without changing Receipt generation.

Status

✅ Verified

# Stage 24: Verification Crypto

## File

```text
packages/crypto/src/VerificationCrypto.ts
```

## Responsibility

Provide cryptographic operations for verifying
Execution Trust Records.

The Verification Crypto component computes canonical
Trust Record hashes, creates digital signatures,
verifies digital signatures, and validates the
cryptographic integrity and authenticity of an
Execution Trust Record.

All cryptographic primitives are delegated to
specialized cryptographic components.

Status

✅ Verified

---

## Creates

- Signature

Uses

```text
CryptoBootstrap

FileKeyProvider

TrustRecordHasher

ArtifactSigner

SignatureVerifier
```

Status

✅ Verified

---

## Public Operations

```text
hash(
    trustRecord
)
```

```text
sign(
    trustRecord
)
```

```text
verifySignature(
    trustRecord
)
```

```text
verify(
    trustRecord
)
```

Status

✅ Verified

---

## Internal Component

```text
canonicalRecord(
    trustRecord
)
```

## Responsibility

Create the canonical immutable representation of an
Execution Trust Record used for hashing and signing.

The canonical view intentionally excludes mutable
lifecycle artifacts so that cryptographic operations
remain deterministic.

Included

- trustRecordId
- businessTransactionId
- transaction
- overrides
- executions
- createdAt

Excluded

- verifications
- receipts
- trustRecordHash
- signature
- updatedAt

Status

✅ Verified

---

## Execution Sequence

```text
Execution Trust Record

↓

Canonical Record

↓

Hash

↓

Sign / Verify

↓

Verification Result
```

Status

✅ Verified

---

## Phase 1: Canonicalize Trust Record

Component

```text
canonicalRecord(...)
```

Input

```text
ExecutionTrustRecord
```

Output

```text
Canonical Trust Record
```

Purpose

Produce the immutable representation used for every
cryptographic operation.

Status

✅ Verified

---

## Phase 2: Compute Trust Record Hash

Component

```text
TrustRecordHasher
```

Method

```text
hash(...)
```

Input

```text
Canonical Trust Record
```

Output

```text
trustRecordHash
```

Purpose

Compute the deterministic hash of the canonical Trust
Record.

Status

✅ Verified

---

## Phase 3: Create Digital Signature

Component

```text
ArtifactSigner
```

Method

```text
sign(...)
```

Input

```text
Canonical Trust Record
```

Dependencies

```text
FileKeyProvider

↓

Private Key
```

Creates

```text
Signature
```

Fields

- algorithm
- keyId
- value
- signedAt

Status

✅ Verified

---

## Phase 4: Verify Signature

Component

```text
SignatureVerifier
```

Method

```text
verify(...)
```

Dependencies

```text
FileKeyProvider

↓

Public Key
```

Purpose

Verify the digital signature independently of Trust
Record hash verification.

Output

```text
boolean
```

Status

✅ Verified

---

## Phase 5: Verify Trust Record

Method

```text
verify(...)
```

Execution Sequence

```text
Canonical Record

↓

Compute Expected Hash

↓

Compare Stored Hash

↓

Load Public Key

↓

Verify Signature

↓

Return Result
```

Validation

```text
expectedHash
==
trustRecord.trustRecordHash
```

Only if hash validation succeeds does signature
verification continue.

Output

```text
boolean
```

Status

✅ Verified

---

## Security Properties

Every cryptographic operation uses the same canonical
representation.

Mutable lifecycle artifacts are excluded from hashing
and signing.

Signature verification is independent of integrity
verification through the dedicated

```text
verifySignature(...)
```

operation.

Private and public keys are obtained through

```text
FileKeyProvider
```

The signing algorithm is supplied by

```text
CryptoBootstrap
```

Status

✅ Verified

---

## Architectural Notes

VerificationCrypto is a cryptographic orchestration
component.

It delegates

- hashing
- signing
- signature verification
- key management

to dedicated cryptographic components.

No cryptographic algorithms are implemented directly
inside this class.

Status

✅ Verified

---

## Audit Notes

VerificationCrypto performs five responsibilities only.

- Build the canonical Trust Record.
- Compute deterministic Trust Record hashes.
- Create digital signatures.
- Verify digital signatures.
- Verify Trust Record integrity and authenticity.

It does not

- evaluate policy
- execute business operations
- persist Trust Records
- generate Verification artifacts
- generate Receipts

The canonical representation is the foundation of all
cryptographic operations, ensuring hashing and signing
remain deterministic regardless of later lifecycle
artifacts such as Verification or Receipt records.

Status

✅ Verified

# Stage 25: Artifact Signer

## File

```text
packages/crypto/src/ArtifactSigner.ts
```

## Responsibility

Create digital signatures for canonical artifacts.

The Artifact Signer serializes an artifact into its canonical byte
representation and delegates digital signing to the configured
cryptographic provider.

It provides a common signing implementation used throughout the
Parmana cryptographic infrastructure.

Status

✅ Verified

---

## Uses

```text
CanonicalSerializer

CryptoProvider
```

Status

✅ Verified

---

## Public Operation

```text
sign(
    artifact,
    privateKey
)
```

Input

```text
artifact

privateKey
```

Output

```text
Digital Signature
```

Status

✅ Verified

---

## Execution Sequence

```text
Artifact

↓

CanonicalSerializer.serialize()

↓

Canonical Bytes

↓

CryptoProvider.signature.sign()

↓

Digital Signature
```

Status

✅ Verified

---

## Phase 1: Canonical Serialization

Component

```text
CanonicalSerializer
```

Method

```text
serialize(...)
```

Input

```text
Artifact
```

Output

```text
Canonical Bytes
```

Purpose

Convert the supplied artifact into a deterministic byte sequence
before signing.

Status

✅ Verified

---

## Phase 2: Digital Signing

Component

```text
CryptoProvider.signature
```

Method

```text
sign(...)
```

Input

```text
Canonical Bytes

Private Key
```

Output

```text
Digital Signature
```

Purpose

Generate the cryptographic signature using the configured
Signature Provider.

Status

✅ Verified

---

## Security Properties

The Artifact Signer always signs the canonical serialized
representation of an artifact.

It never signs mutable object representations directly.

The private key is supplied by the caller.

The signing algorithm is determined by the configured
CryptoProvider.

Status

✅ Verified

---

## Architectural Notes

ArtifactSigner is a reusable cryptographic utility.

It contains no knowledge of

- Execution Trust Records
- Receipts
- Runtime Authorization
- Business Transactions

Its responsibility is limited to deterministic artifact signing.

Serialization is delegated to

```text
CanonicalSerializer
```

Cryptographic signing is delegated to

```text
CryptoProvider
```

Status

✅ Verified

---

## Audit Notes

ArtifactSigner performs two responsibilities only.

- Canonically serialize an artifact.
- Produce a digital signature using the configured
  cryptographic provider.

It does not

- hash artifacts
- verify signatures
- manage cryptographic keys
- implement signing algorithms
- persist signed artifacts

This class serves as the common signing abstraction used by
VerificationCrypto, ReceiptCrypto, RuntimeAuthorizationSigner,
and other cryptographic components.

Status

✅ Verified

# Stage 26: Trust Record Hasher

## File

```text
packages/crypto/src/TrustRecordHasher.ts
```

## Responsibility

⏳ Pending Audit

The Trust Record Hasher is responsible for computing the
canonical cryptographic hash of an Execution Trust Record.

Expected responsibilities

- canonical serialization
- deterministic hashing
- produce Trust Record hash

It should not

- sign artifacts
- verify signatures
- manage keys
- persist data

Status

⏳ Pending

---

## Uses

```text
CanonicalSerializer

CryptoProvider
```

Status

⏳ Pending

---

## Public Operation

```text
hash(
    trustRecord
)
```

Input

```text
ExecutionTrustRecord
```

Output

```text
trustRecordHash
```

Status

⏳ Pending

---

## Expected Execution Sequence

```text
Execution Trust Record

↓

Canonical Serialization

↓

Canonical Bytes

↓

Hash Function

↓

Trust Record Hash
```

Status

⏳ Pending

---

## Questions To Verify

- What fields are included in the hash?
- Is canonical serialization used?
- Which hash algorithm is configured?
- Is hashing deterministic?
- Does hashing delegate to CryptoProvider?
- Does hashing exclude mutable lifecycle artifacts?

Status

⏳ Pending

---

## Security Properties

To verify

- Deterministic hashing
- Canonical serialization
- Stable cryptographic output
- No mutable state included

Status

⏳ Pending

---

## Architectural Notes

To verify

- TrustRecordHasher should perform hashing only.
- Serialization should be delegated.
- Cryptographic hashing should be delegated to CryptoProvider.

Status

⏳ Pending

---

## Audit Notes

Pending implementation audit.

Source code inspection required before documenting behavior.

Status

⏳ Pending

# Stage 26: Trust Record Hasher

## File

```text
packages/crypto/src/TrustRecordHasher.ts
```

## Responsibility

Produce deterministic cryptographic hashes for immutable
trust artifacts.

The Trust Record Hasher converts an object into its canonical
serialized representation and delegates hash computation to the
configured cryptographic provider.

It provides a reusable hashing abstraction used throughout the
Parmana cryptographic infrastructure.

Status

✅ Verified

---

## Uses

```text
CanonicalSerializer

CryptoProvider
```

Status

✅ Verified

---

## Public Operation

```text
hash(
    value
)
```

Input

```text
Immutable Artifact
```

Output

```text
Cryptographic Hash
```

Status

✅ Verified

---

## Execution Sequence

```text
Artifact

↓

CanonicalSerializer.serialize()

↓

Canonical Bytes

↓

CryptoProvider.hash.hash()

↓

Cryptographic Hash
```

Status

✅ Verified

---

## Phase 1: Canonical Serialization

Component

```text
CanonicalSerializer
```

Method

```text
serialize(...)
```

Input

```text
Artifact
```

Output

```text
Canonical Bytes
```

Purpose

Convert the supplied artifact into a deterministic byte
representation before hashing.

Status

✅ Verified

---

## Phase 2: Compute Hash

Component

```text
CryptoProvider.hash
```

Method

```text
hash(...)
```

Input

```text
Canonical Bytes
```

Output

```text
Cryptographic Hash
```

Purpose

Compute the deterministic cryptographic hash of the canonical
serialized artifact.

Status

✅ Verified

---

## Security Properties

Every artifact is hashed from its canonical serialized
representation.

Objects are never hashed directly.

The hashing algorithm is supplied by the configured
CryptoProvider.

The Trust Record Hasher performs no object mutation.

Status

✅ Verified

---

## Architectural Notes

The Trust Record Hasher is a reusable cryptographic utility.

It has no knowledge of

- Execution Trust Records
- Runtime Authorization
- Receipts
- Business Transactions

Its responsibility is limited to deterministic hashing.

Serialization is delegated to

```text
CanonicalSerializer
```

Hash computation is delegated to

```text
CryptoProvider
```

Status

✅ Verified

---

## Audit Notes

The Trust Record Hasher performs two responsibilities only.

- Canonically serialize an artifact.
- Produce a deterministic cryptographic hash using the
  configured cryptographic provider.

It does not

- sign artifacts
- verify signatures
- manage cryptographic keys
- implement hashing algorithms
- persist artifacts

This class serves as the common hashing abstraction used by
VerificationCrypto, ReceiptCrypto, and other cryptographic
components that require deterministic hashing.

Status

✅ Verified

# Stage 27: Receipt Hasher

## File

```text
packages/crypto/src/ReceiptHasher.ts
```

## Responsibility

Compute the canonical cryptographic hash used for
Receipt generation.

The Receipt Hasher delegates hash computation entirely to the
Trust Record Hasher.

It contains no receipt-specific hashing logic.

Status

✅ Verified

---

## Uses

```text
TrustRecordHasher
```

Status

✅ Verified

---

## Public Operation

```text
hash(
    receipt
)
```

Input

```text
Artifact
```

Output

```text
Cryptographic Hash
```

Status

✅ Verified

---

## Execution Sequence

```text
Artifact

↓

TrustRecordHasher.hash()

↓

Cryptographic Hash

↓

Return Hash
```

Status

✅ Verified

---

## Phase 1: Delegate Hash Computation

Component

```text
TrustRecordHasher
```

Method

```text
hash(...)
```

Input

```text
Artifact
```

Output

```text
Cryptographic Hash
```

Purpose

Delegate deterministic hash computation to the shared
Trust Record Hasher.

No additional processing occurs.

Status

✅ Verified

---

## Security Properties

ReceiptHasher performs no cryptographic operations directly.

It relies entirely on

```text
TrustRecordHasher
```

for

- canonical serialization
- deterministic hashing
- cryptographic algorithm selection

This guarantees Receipt hashing remains consistent with the
rest of the cryptographic infrastructure.

Status

✅ Verified

---

## Architectural Notes

ReceiptHasher is a thin wrapper around
`TrustRecordHasher`.

It introduces no additional

- serialization
- hashing logic
- cryptographic algorithms
- receipt-specific transformations

Its only responsibility is to expose a Receipt-specific
hashing interface while reusing the shared hashing
implementation.

Status

✅ Verified

---

## Audit Notes

ReceiptHasher performs one responsibility only.

- Delegate hash computation to the shared Trust Record Hasher.

It does not

- serialize artifacts
- implement hashing algorithms
- sign Receipts
- verify signatures
- manage cryptographic keys
- persist artifacts

The implementation intentionally avoids duplicating hashing
logic by reusing the common `TrustRecordHasher`, ensuring a
single deterministic hashing implementation across the
cryptographic subsystem.

Status

✅ Verified

# Stage 28: Authorization Signer

## File

```text
packages/crypto/src/AuthorizationSigner.ts
```

## Responsibility

Produce a cryptographically signed execution authorization for an
approved decision.

The Authorization Signer constructs an
`ExecutionAuthorizationPayload`, computes the hash of the executable
content, signs the payload, and returns a complete
`SignedExecutionAuthorization`.

Status

✅ Verified

---

## Uses

```text
ArtifactSigner

ExecutableContentHasher

CryptoProvider
```

Status

✅ Verified

---

## Public Operation

```text
sign(
    input,
    privateKey,
    keyId,
    ttlSeconds
)
```

Input

```text
Decision Information

Executable Content

Private Key

Key Identifier

Authorization TTL
```

Output

```text
SignedExecutionAuthorization
```

Status

✅ Verified

---

## Execution Sequence

```text
Decision Input

↓

Validate TTL

↓

Generate
• authorizationId
• nonce

↓

Compute
businessTransactionHash

↓

Construct
ExecutionAuthorizationPayload

↓

ArtifactSigner.sign()

↓

SignedExecutionAuthorization
```

Status

✅ Verified

---

## Phase 1: Validate Authorization Lifetime

Input

```text
ttlSeconds
```

Validation

```text
ttlSeconds > 0

Finite Number
```

Failure

```text
Throws Error
```

Purpose

Prevent creation of authorizations with invalid expiry periods.

Status

✅ Verified

---

## Phase 2: Generate Authorization Metadata

Generated Values

```text
authorizationId

nonce

authorizedAt

expiresAt
```

Purpose

Create a unique authorization instance together with its validity
window.

Status

✅ Verified

---

## Phase 3: Compute Business Transaction Hash

Component

```text
ExecutableContentHasher
```

Method

```text
hash(
    executableContent
)
```

Output

```text
businessTransactionHash
```

Purpose

Bind the authorization to the exact executable content that was
approved.

Status

✅ Verified

---

## Phase 4: Build Authorization Payload

Constructs

```text
ExecutionAuthorizationPayload
```

Fields

```text
version

authorizationId

nonce

decisionId

businessTransactionId

policyName

policyVersion

authorizedAt

expiresAt

businessTransactionHash
```

Status

✅ Verified

---

## Phase 5: Sign Authorization

Component

```text
ArtifactSigner
```

Method

```text
sign(
    payload,
    privateKey
)
```

Output

```text
Digital Signature
```

Purpose

Produce a deterministic cryptographic signature over the canonical
authorization payload.

Status

✅ Verified

---

## Phase 6: Return Signed Authorization

Returns

```text
SignedExecutionAuthorization
```

Containing

```text
payload

signature

keyId

algorithm
```

The algorithm is obtained from

```text
CryptoProvider.signature.algorithm
```

Status

✅ Verified

---

## Security Properties

Every authorization is cryptographically bound to the executable
content through `businessTransactionHash`.

Each authorization contains

- unique authorization identifier
- nonce
- issuance timestamp
- expiry timestamp

Only the canonical payload is signed.

The signing algorithm is supplied by the configured
`CryptoProvider`.

Status

✅ Verified

---

## Architectural Notes

AuthorizationSigner is an orchestration component.

It delegates

- canonical signing to `ArtifactSigner`
- executable content hashing to `ExecutableContentHasher`

It does not implement

- canonical serialization
- hashing algorithms
- digital signature algorithms
- key management

Status

✅ Verified

---

## Audit Notes

AuthorizationSigner performs six responsibilities.

- Validate authorization TTL.
- Generate authorization metadata.
- Compute executable content hash.
- Construct an `ExecutionAuthorizationPayload`.
- Sign the payload.
- Return a complete `SignedExecutionAuthorization`.

All cryptographic primitives are delegated to dedicated helper
components, keeping this class focused on authorization
construction and orchestration.

Status

✅ Verified

# Stage 29: Executable Content Hasher

## File

```text
packages/crypto/src/ExecutableContentHasher.ts
```

## Responsibility

Produce the canonical cryptographic hash of an
`ExecutableContent` object.

The Executable Content Hasher computes the hash that is embedded
into an `ExecutionAuthorizationPayload` as the
`businessTransactionHash`.

It delegates all hashing operations to the shared
`TrustRecordHasher`, ensuring the signing side and the execution
gateway use the identical canonical serialization and hashing
algorithm.

Status

✅ Verified

---

## Uses

```text
TrustRecordHasher

CryptoProvider
```

Status

✅ Verified

---

## Public Operation

```text
hash(
    content
)
```

Input

```text
ExecutableContent
```

Output

```text
businessTransactionHash
```

Status

✅ Verified

---

## Execution Sequence

```text
Executable Content

↓

TrustRecordHasher.hash()

↓

Canonical Serialization

↓

Cryptographic Hash

↓

businessTransactionHash
```

Status

✅ Verified

---

## Phase 1: Receive Executable Content

Input

```text
ExecutableContent
```

Purpose

Accept the exact business content that will later be authorized
and executed.

Status

✅ Verified

---

## Phase 2: Delegate Hash Computation

Component

```text
TrustRecordHasher
```

Method

```text
hash(
    content
)
```

Purpose

Reuse the common deterministic hashing implementation instead of
creating a separate executable-content hashing algorithm.

Status

✅ Verified

---

## Phase 3: Return Content Hash

Output

```text
businessTransactionHash
```

Purpose

Return the canonical hash that will be embedded into the
`ExecutionAuthorizationPayload`.

This hash is later used by the execution gateway to verify that
the executable content has not changed between authorization and
execution.

Status

✅ Verified

---

## Security Properties

The Executable Content Hasher performs no cryptographic
implementation itself.

It guarantees that both the authorization producer and the
execution verifier rely on the same deterministic hashing
implementation.

By embedding the resulting
`businessTransactionHash` into the authorization payload, the
system cryptographically binds an authorization to the exact
executable content it approved.

Status

✅ Verified

---

## Architectural Notes

ExecutableContentHasher is a thin wrapper around
`TrustRecordHasher`.

It introduces no additional

- serialization
- hashing logic
- cryptographic algorithms

Its purpose is to provide a domain-specific abstraction for
hashing executable content while ensuring a single canonical
implementation is reused throughout the system.

Status

✅ Verified

---

## Audit Notes

ExecutableContentHasher performs one responsibility only.

- Compute the canonical hash of `ExecutableContent` by delegating
  to `TrustRecordHasher`.

It does not

- implement hashing algorithms
- perform canonical serialization directly
- sign authorizations
- verify hashes
- manage cryptographic keys
- persist artifacts

The implementation deliberately avoids duplicate hashing logic,
ensuring that authorization generation and execution verification
always compute identical hashes for identical executable content.

Status

✅ Verified

# Stage 30: Crypto Bootstrap

## File

```text
packages/crypto/src/CryptoBootstrap.ts
```

## Responsibility

Construct and configure the Parmana cryptographic subsystem.

CryptoBootstrap is the composition root for the crypto package. It
creates configured `CryptoProvider` instances by registering built-in
hash and signature providers, loading runtime configuration, and
assembling the provider through `CryptoBuilder`.

It also supports hybrid cryptography by constructing both primary and
secondary providers.

Status

✅ Verified

---

## Uses

```text
CryptoBuilder

HashRegistry

SignatureRegistry

SHA256HashProvider

Ed25519SignatureProvider

Dilithium3SignatureProvider

loadConfig()
```

Status

✅ Verified

---

## Public Operations

```text
create()

createHybrid()
```

Private Operation

```text
buildProvider(
    signatureAlgorithm
)
```

Status

✅ Verified

---

## Execution Sequence (Single Provider)

```text
loadConfig()

↓

Create Registries

↓

Register
Hash Provider

↓

Register
Signature Providers

↓

CryptoBuilder

↓

CryptoProvider
```

Status

✅ Verified

---

## Execution Sequence (Hybrid Provider)

```text
loadConfig()

↓

Primary Algorithm

↓

buildProvider()

↓

Primary Provider

            +

Secondary Algorithm

↓

buildProvider()

↓

Secondary Provider

↓

HybridCryptoProvider
```

Status

✅ Verified

---

## Phase 1: Load Configuration

Component

```text
loadConfig()
```

Purpose

Load the configured cryptographic algorithms from the application
configuration.

Configuration includes

```text
Hash Provider

Primary Signature Provider

Secondary Signature Provider
```

Status

✅ Verified

---

## Phase 2: Register Built-in Providers

Hash Providers

```text
SHA256HashProvider
```

Signature Providers

```text
Ed25519SignatureProvider

Dilithium3SignatureProvider
```

Purpose

Populate the provider registries with the supported cryptographic
implementations.

Status

✅ Verified

---

## Phase 3: Build Crypto Provider

Component

```text
CryptoBuilder
```

Operations

```text
withHash()

withSignature()

build()
```

Purpose

Assemble a `CryptoProvider` using the configured hash provider and
selected signature algorithm.

Status

✅ Verified

---

## Phase 4: Cache Provider Instance

Static Fields

```text
provider

hybrid
```

Purpose

Reuse previously constructed providers and avoid rebuilding the crypto
configuration multiple times during application execution.

Status

✅ Verified

---

## Phase 5: Hybrid Provider Construction

Method

```text
createHybrid()
```

Validation

```text
Secondary Signature Provider
must be configured
```

Output

```text
HybridCryptoProvider
```

Containing

```text
primary

secondary
```

Purpose

Support migration or interoperability scenarios requiring two
cryptographic signature algorithms.

Status

✅ Verified

---

## Security Properties

Supported hash provider

```text
SHA-256
```

Supported signature providers

```text
Ed25519

Dilithium3
```

Cryptographic implementations are selected through configuration rather
than hard-coded throughout the application.

Hybrid mode constructs two independent cryptographic providers using
different signature algorithms.

Provider instances are cached after creation.

Status

✅ Verified

---

## Architectural Notes

CryptoBootstrap is the composition root of the crypto subsystem.

It is responsible for

- loading cryptographic configuration
- registering built-in providers
- assembling configured providers
- exposing singleton provider instances
- constructing hybrid providers

It does not

- hash artifacts
- sign artifacts
- verify signatures
- manage cryptographic keys
- perform cryptographic operations directly

Those responsibilities are delegated to the constructed
`CryptoProvider` instances.

Status

✅ Verified

---

## Audit Notes

CryptoBootstrap performs five responsibilities.

- Load runtime crypto configuration.
- Register built-in hash and signature providers.
- Assemble configured `CryptoProvider` instances.
- Cache provider instances for reuse.
- Construct hybrid cryptographic providers when configured.

All cryptographic operations remain delegated to the providers it
creates. CryptoBootstrap serves solely as the composition and
configuration entry point for the Parmana cryptographic subsystem.

Status

✅ Verified

# Stage 31: File Key Provider

## File

```text
packages/crypto/src/providers/key/FileKeyProvider.ts
```

## Responsibility

Load cryptographic signing keys from the local filesystem.

The File Key Provider implements the `KeyProvider` interface and
provides access to private keys, public keys, and key metadata for the
Parmana cryptographic subsystem.

It abstracts key retrieval so higher-level cryptographic components do
not interact with the filesystem directly.

Status

✅ Verified

---

## Implements

```text
KeyProvider
```

Status

✅ Verified

---

## Uses

```text
loadConfig()

Node.js Crypto

Node.js File System

Node.js Path
```

Status

✅ Verified

---

## Public Operations

```text
hasKey()

getMetadata()

getPrivateKey()

getPublicKey()
```

Status

✅ Verified

---

## Key Storage Layout

Keys are expected to exist within the configured key directory.

```text
keys/

    <keyId>.private.pem

    <keyId>.public.pem
```

The directory defaults to

```text
./keys
```

unless overridden through configuration.

Status

✅ Verified

---

## Execution Sequence

```text
loadConfig()

↓

Resolve Key Directory

↓

Resolve Key Path

↓

Verify File Exists

↓

Read PEM File

↓

Create KeyObject

↓

Return Key
```

Status

✅ Verified

---

## Phase 1: Load Configuration

Component

```text
loadConfig()
```

Configuration

```text
keys.keyDirectory
```

Default

```text
./keys
```

Purpose

Determine the root directory containing cryptographic keys.

Status

✅ Verified

---

## Phase 2: Validate Key Directory

Method

```text
getKeyDirectory()
```

Validation

```text
Directory Exists
```

Failure

```text
Throws Error
```

Purpose

Prevent cryptographic operations from using an invalid key location.

Status

✅ Verified

---

## Phase 3: Resolve Key Paths

Private Methods

```text
privateKeyPath()

publicKeyPath()
```

Generated Paths

```text
<keyId>.private.pem

<keyId>.public.pem
```

Purpose

Construct the filesystem paths for the requested key pair.

Status

✅ Verified

---

## Phase 4: Load Keys

Methods

```text
getPrivateKey()

getPublicKey()
```

Operations

```text
Read PEM File

↓

createPrivateKey()

or

createPublicKey()
```

Output

```text
KeyObject
```

Purpose

Convert stored PEM files into Node.js cryptographic key objects.

Status

✅ Verified

---

## Phase 5: Retrieve Metadata

Method

```text
getMetadata()
```

Returns

```text
keyId

algorithm
```

The algorithm is obtained from

```text
config.crypto.primarySignatureProvider
```

Purpose

Provide metadata describing the configured signing key.

Status

✅ Verified

---

## Security Properties

The File Key Provider

- validates the configured key directory exists
- verifies key files exist before loading
- never generates cryptographic keys
- never performs signing or verification
- returns Node.js `KeyObject` instances

Private and public keys are loaded independently from separate PEM
files.

Status

✅ Verified

---

## Architectural Notes

FileKeyProvider is a development and self-hosted key management
implementation.

It is responsible only for retrieving cryptographic key material from
the filesystem.

It does not

- generate keys
- hash artifacts
- sign artifacts
- verify signatures
- manage cryptographic algorithms

The implementation explicitly notes that it can be replaced by external
key management systems such as

- KMS
- HSM
- Cloud Key Vault

without changing the higher-level cryptographic components.

Status

✅ Verified

---

## Audit Notes

FileKeyProvider performs five responsibilities.

- Resolve the configured key directory.
- Determine private and public key file paths.
- Load PEM-encoded keys from the filesystem.
- Return Node.js `KeyObject` instances.
- Provide metadata describing the configured signing algorithm.

It serves as the key retrieval abstraction for the Parmana crypto
subsystem, allowing cryptographic services to remain independent of the
underlying key storage mechanism.

Status

✅ Verified

# Stage 32: Hash Registry

## File

```text
packages/crypto/src/providers/HashRegistry.ts
```

## Responsibility

Maintain a registry of available hash providers.

The Hash Registry maps a `HashAlgorithm` identifier to its
corresponding `HashProvider` implementation and provides lookup
services for the crypto subsystem.

It acts as the central registry used during crypto provider
construction.

Status

✅ Verified

---

## Uses

```text
HashProvider

HashAlgorithm
```

Status

✅ Verified

---

## Internal State

```text
Map<
    HashAlgorithm,
    HashProvider
>
```

Purpose

Store registered hash providers keyed by their supported algorithm.

Status

✅ Verified

---

## Public Operations

```text
register(
    provider
)

get(
    algorithm
)
```

Status

✅ Verified

---

## Execution Sequence: Register Provider

```text
HashProvider

↓

Read provider.algorithm

↓

Store in Map

↓

Return Registry
```

Status

✅ Verified

---

## Execution Sequence: Retrieve Provider

```text
HashAlgorithm

↓

Lookup Map

↓

Provider Found

↓

Return HashProvider
```

If no provider exists

```text
Throw Error

Unknown hash provider
```

Status

✅ Verified

---

## Phase 1: Register Provider

Method

```text
register(
    provider
)
```

Operation

```text
providers.set(
    provider.algorithm,
    provider
)
```

Purpose

Associate a hash provider implementation with its supported
algorithm identifier.

Returns

```text
this
```

allowing fluent registration.

Status

✅ Verified

---

## Phase 2: Resolve Provider

Method

```text
get(
    algorithm
)
```

Operation

```text
providers.get(
    algorithm
)
```

Purpose

Retrieve the registered provider corresponding to the requested
hash algorithm.

Status

✅ Verified

---

## Phase 3: Validate Lookup

Validation

```text
Provider Exists
```

Failure

```text
Throw Error

Unknown hash provider:
<algorithm>
```

Purpose

Prevent the crypto subsystem from operating with an
unregistered hash implementation.

Status

✅ Verified

---

## Security Properties

The Hash Registry

- maintains a single provider per algorithm
- prevents use of unknown hash algorithms
- performs no cryptographic operations
- contains no hashing logic

It serves purely as an algorithm-to-provider lookup mechanism.

Status

✅ Verified

---

## Architectural Notes

HashRegistry is an infrastructure component.

It is responsible only for

- registering hash providers
- resolving providers by algorithm identifier

It does not

- compute hashes
- serialize artifacts
- sign artifacts
- verify signatures
- manage cryptographic keys

The registry is populated by `CryptoBootstrap` during crypto
subsystem initialization.

Status

✅ Verified

---

## Audit Notes

HashRegistry performs two responsibilities.

- Register `HashProvider` implementations.
- Resolve providers by `HashAlgorithm`.

It acts as the lookup table connecting configured algorithm
identifiers to concrete hashing implementations, enabling the
crypto subsystem to remain extensible without embedding
algorithm-specific logic into higher-level components.

Status

✅ Verified

# Stage 32: Hash Registry

## File

```text
packages/crypto/src/providers/HashRegistry.ts
```

## Responsibility

Maintain a registry of available hash providers.

The Hash Registry maps a `HashAlgorithm` identifier to its
corresponding `HashProvider` implementation and provides lookup
services for the crypto subsystem.

It acts as the central registry used during crypto provider
construction.

Status

✅ Verified

---

## Uses

```text
HashProvider

HashAlgorithm
```

Status

✅ Verified

---

## Internal State

```text
Map<
    HashAlgorithm,
    HashProvider
>
```

Purpose

Store registered hash providers keyed by their supported algorithm.

Status

✅ Verified

---

## Public Operations

```text
register(
    provider
)

get(
    algorithm
)
```

Status

✅ Verified

---

## Execution Sequence: Register Provider

```text
HashProvider

↓

Read provider.algorithm

↓

Store in Map

↓

Return Registry
```

Status

✅ Verified

---

## Execution Sequence: Retrieve Provider

```text
HashAlgorithm

↓

Lookup Map

↓

Provider Found

↓

Return HashProvider
```

If no provider exists

```text
Throw Error

Unknown hash provider
```

Status

✅ Verified

---

## Phase 1: Register Provider

Method

```text
register(
    provider
)
```

Operation

```text
providers.set(
    provider.algorithm,
    provider
)
```

Purpose

Associate a hash provider implementation with its supported
algorithm identifier.

Returns

```text
this
```

allowing fluent registration.

Status

✅ Verified

---

## Phase 2: Resolve Provider

Method

```text
get(
    algorithm
)
```

Operation

```text
providers.get(
    algorithm
)
```

Purpose

Retrieve the registered provider corresponding to the requested
hash algorithm.

Status

✅ Verified

---

## Phase 3: Validate Lookup

Validation

```text
Provider Exists
```

Failure

```text
Throw Error

Unknown hash provider:
<algorithm>
```

Purpose

Prevent the crypto subsystem from operating with an
unregistered hash implementation.

Status

✅ Verified

---

## Security Properties

The Hash Registry

- maintains a single provider per algorithm
- prevents use of unknown hash algorithms
- performs no cryptographic operations
- contains no hashing logic

It serves purely as an algorithm-to-provider lookup mechanism.

Status

✅ Verified

---

## Architectural Notes

HashRegistry is an infrastructure component.

It is responsible only for

- registering hash providers
- resolving providers by algorithm identifier

It does not

- compute hashes
- serialize artifacts
- sign artifacts
- verify signatures
- manage cryptographic keys

The registry is populated by `CryptoBootstrap` during crypto
subsystem initialization.

Status

✅ Verified

---

## Audit Notes

HashRegistry performs two responsibilities.

- Register `HashProvider` implementations.
- Resolve providers by `HashAlgorithm`.

It acts as the lookup table connecting configured algorithm
identifiers to concrete hashing implementations, enabling the
crypto subsystem to remain extensible without embedding
algorithm-specific logic into higher-level components.

Status

✅ Verified

# Stage 33: Signature Registry

## File

```text
packages/crypto/src/providers/SignatureRegistry.ts
```

## Responsibility

Maintain a registry of available signature providers.

The Signature Registry maps a `SignatureAlgorithm` identifier to its
corresponding `SignatureProvider` implementation and provides lookup
services for the crypto subsystem.

It acts as the central registry used during crypto provider
construction.

Status

✅ Verified

---

## Uses

```text
SignatureProvider

SignatureAlgorithm
```

Status

✅ Verified

---

## Internal State

```text
Map<
    SignatureAlgorithm,
    SignatureProvider
>
```

Purpose

Store registered signature providers keyed by their supported
algorithm.

Status

✅ Verified

---

## Public Operations

```text
register(
    provider
)

get(
    algorithm
)
```

Status

✅ Verified

---

## Execution Sequence: Register Provider

```text
SignatureProvider

↓

Read provider.algorithm

↓

Store in Map

↓

Return Registry
```

Status

✅ Verified

---

## Execution Sequence: Retrieve Provider

```text
SignatureAlgorithm

↓

Lookup Map

↓

Provider Found

↓

Return SignatureProvider
```

If no provider exists

```text
Throw Error

Unknown signature provider
```

Status

✅ Verified

---

## Phase 1: Register Provider

Method

```text
register(
    provider
)
```

Operation

```text
providers.set(
    provider.algorithm,
    provider
)
```

Purpose

Associate a signature provider implementation with its supported
algorithm identifier.

Returns

```text
this
```

allowing fluent registration.

Status

✅ Verified

---

## Phase 2: Resolve Provider

Method

```text
get(
    algorithm
)
```

Operation

```text
providers.get(
    algorithm
)
```

Purpose

Retrieve the registered provider corresponding to the requested
signature algorithm.

Status

✅ Verified

---

## Phase 3: Validate Lookup

Validation

```text
Provider Exists
```

Failure

```text
Throw Error

Unknown signature provider:
<algorithm>
```

Purpose

Prevent the crypto subsystem from operating with an
unregistered signature implementation.

Status

✅ Verified

---

## Security Properties

The Signature Registry

- maintains a single provider per algorithm
- prevents use of unknown signature algorithms
- performs no cryptographic operations
- contains no signing or verification logic

It serves purely as an algorithm-to-provider lookup mechanism.

Status

✅ Verified

---

## Architectural Notes

SignatureRegistry is an infrastructure component.

It is responsible only for

- registering signature providers
- resolving providers by algorithm identifier

It does not

- generate signatures
- verify signatures
- hash artifacts
- serialize artifacts
- manage cryptographic keys

The registry is populated by `CryptoBootstrap` during crypto
subsystem initialization.

Status

✅ Verified

---

## Audit Notes

SignatureRegistry performs two responsibilities.

- Register `SignatureProvider` implementations.
- Resolve providers by `SignatureAlgorithm`.

It acts as the lookup table connecting configured signature
algorithms to concrete provider implementations, enabling the
crypto subsystem to support multiple signature algorithms without
embedding algorithm-specific logic into higher-level components.

Status

✅ Verified

# Stage 34: Crypto Builder

## File

```text
packages/crypto/src/CryptoBuilder.ts
```

## Responsibility

Construct a configured `CryptoProvider` from independently supplied
hash and signature providers.

The Crypto Builder is algorithm-agnostic. It does not select
cryptographic implementations itself. Instead, it assembles a
`CryptoProvider` from providers supplied by higher-level components,
such as `CryptoBootstrap`.

Status

✅ Verified

---

## Uses

```text
HashProvider

SignatureProvider

CryptoProvider

CryptoError
```

Status

✅ Verified

---

## Internal State

```text
HashProvider?

SignatureProvider?
```

Purpose

Temporarily hold the configured providers until the builder
constructs the final `CryptoProvider`.

Status

✅ Verified

---

## Public Operations

```text
withHash(
    provider
)

withSignature(
    provider
)

build()
```

Status

✅ Verified

---

## Execution Sequence

```text
HashProvider

↓

withHash()

↓

SignatureProvider

↓

withSignature()

↓

Validate Configuration

↓

Construct CryptoProvider
```

Status

✅ Verified

---

## Phase 1: Configure Hash Provider

Method

```text
withHash(
    provider
)
```

Operation

```text
this.hashProvider = provider
```

Purpose

Assign the hash provider that will become part of the
constructed `CryptoProvider`.

Returns

```text
this
```

allowing fluent configuration.

Status

✅ Verified

---

## Phase 2: Configure Signature Provider

Method

```text
withSignature(
    provider
)
```

Operation

```text
this.signatureProvider = provider
```

Purpose

Assign the signature provider that will become part of the
constructed `CryptoProvider`.

Returns

```text
this
```

allowing fluent configuration.

Status

✅ Verified

---

## Phase 3: Validate Configuration

Method

```text
build()
```

Validation

```text
HashProvider configured

SignatureProvider configured
```

Failure

```text
CryptoError

HashProvider has not been configured.

or

SignatureProvider has not been configured.
```

Purpose

Prevent construction of an incomplete cryptographic provider.

Status

✅ Verified

---

## Phase 4: Construct CryptoProvider

Returns

```text
CryptoProvider
```

Containing

```text
hash

signature
```

Purpose

Produce the configured cryptographic provider used throughout
the Parmana crypto subsystem.

Status

✅ Verified

---

## Security Properties

CryptoBuilder

- requires both a hash provider and a signature provider
- rejects incomplete configurations
- performs no cryptographic operations
- contains no algorithm-specific logic

It assembles existing provider implementations into a single
`CryptoProvider`.

Status

✅ Verified

---

## Architectural Notes

CryptoBuilder is a composition utility.

It is responsible only for assembling a `CryptoProvider`.

It does not

- select algorithms
- register providers
- hash artifacts
- generate signatures
- verify signatures
- manage cryptographic keys

Algorithm selection is delegated to `CryptoBootstrap`, while
cryptographic operations are delegated to the configured providers.

Status

✅ Verified

---

## Audit Notes

CryptoBuilder performs three responsibilities.

- Accept a configured `HashProvider`.
- Accept a configured `SignatureProvider`.
- Construct a validated `CryptoProvider`.

It serves as the final assembly step of the Parmana cryptographic
configuration pipeline, separating provider selection from provider
construction and ensuring the resulting `CryptoProvider` is complete
before use.

Status

✅ Verified

# Stage 35: SHA-256 Hash Provider

## File

```text
packages/crypto/src/providers/hash/SHA256HashProvider.ts
```

## Responsibility

Compute SHA-256 cryptographic hashes over binary data.

The SHA-256 Hash Provider implements the `HashProvider` interface and
provides the concrete hashing implementation used by the Parmana crypto
subsystem when the configured hash algorithm is SHA-256.

Status

✅ Verified

---

## Implements

```text
HashProvider
```

Status

✅ Verified

---

## Uses

```text
Node.js Crypto

createHash()
```

Status

✅ Verified

---

## Supported Algorithm

```text
HashAlgorithms.SHA256
```

Exposed as

```text
algorithm
```

Status

✅ Verified

---

## Public Operation

```text
hash(
    data
)
```

Input

```text
Uint8Array
```

Output

```text
Hexadecimal Hash
```

Status

✅ Verified

---

## Execution Sequence

```text
Uint8Array

↓

createHash("sha256")

↓

update(data)

↓

digest("hex")

↓

SHA-256 Hash
```

Status

✅ Verified

---

## Phase 1: Receive Binary Data

Input

```text
Uint8Array
```

Purpose

Accept canonical binary data produced by higher-level components for
hash computation.

Status

✅ Verified

---

## Phase 2: Compute SHA-256 Digest

Operation

```text
createHash("sha256")
```

Processing

```text
update(data)

↓

digest("hex")
```

Purpose

Compute the SHA-256 digest of the supplied binary data and encode the
result as a hexadecimal string.

Status

✅ Verified

---

## Phase 3: Return Hash

Output

```text
Hexadecimal String
```

Purpose

Return the deterministic SHA-256 hash for downstream cryptographic
operations.

Status

✅ Verified

---

## Security Properties

The SHA-256 Hash Provider

- implements the SHA-256 hashing algorithm
- accepts binary input only
- produces deterministic hexadecimal output
- performs no serialization
- maintains no internal state

Status

✅ Verified

---

## Architectural Notes

SHA256HashProvider is a concrete implementation of the `HashProvider`
interface.

It is responsible only for computing SHA-256 hashes.

It does not

- serialize artifacts
- select algorithms
- register providers
- sign artifacts
- verify signatures
- manage cryptographic keys

Algorithm selection is performed by `CryptoBootstrap`; this class
implements only the hashing operation.

Status

✅ Verified

---

## Audit Notes

SHA256HashProvider performs one responsibility.

- Compute the SHA-256 hash of a supplied `Uint8Array` and return the
  digest as a hexadecimal string.

It is the concrete hash implementation registered with
`HashRegistry` and assembled into the `CryptoProvider` by
`CryptoBootstrap` when SHA-256 is configured as the active hash
algorithm.

Status

✅ Verified

# Stage 35: SHA-256 Hash Provider

## File

```text
packages/crypto/src/providers/hash/SHA256HashProvider.ts
```

## Responsibility

Compute SHA-256 cryptographic hashes over binary data.

The SHA-256 Hash Provider implements the `HashProvider` interface and
provides the concrete hashing implementation used by the Parmana crypto
subsystem when the configured hash algorithm is SHA-256.

Status

✅ Verified

---

## Implements

```text
HashProvider
```

Status

✅ Verified

---

## Uses

```text
Node.js Crypto

createHash()
```

Status

✅ Verified

---

## Supported Algorithm

```text
HashAlgorithms.SHA256
```

Exposed as

```text
algorithm
```

Status

✅ Verified

---

## Public Operation

```text
hash(
    data
)
```

Input

```text
Uint8Array
```

Output

```text
Hexadecimal Hash
```

Status

✅ Verified

---

## Execution Sequence

```text
Uint8Array

↓

createHash("sha256")

↓

update(data)

↓

digest("hex")

↓

SHA-256 Hash
```

Status

✅ Verified

---

## Phase 1: Receive Binary Data

Input

```text
Uint8Array
```

Purpose

Accept canonical binary data produced by higher-level components for
hash computation.

Status

✅ Verified

---

## Phase 2: Compute SHA-256 Digest

Operation

```text
createHash("sha256")
```

Processing

```text
update(data)

↓

digest("hex")
```

Purpose

Compute the SHA-256 digest of the supplied binary data and encode the
result as a hexadecimal string.

Status

✅ Verified

---

## Phase 3: Return Hash

Output

```text
Hexadecimal String
```

Purpose

Return the deterministic SHA-256 hash for downstream cryptographic
operations.

Status

✅ Verified

---

## Security Properties

The SHA-256 Hash Provider

- implements the SHA-256 hashing algorithm
- accepts binary input only
- produces deterministic hexadecimal output
- performs no serialization
- maintains no internal state

Status

✅ Verified

---

## Architectural Notes

SHA256HashProvider is a concrete implementation of the `HashProvider`
interface.

It is responsible only for computing SHA-256 hashes.

It does not

- serialize artifacts
- select algorithms
- register providers
- sign artifacts
- verify signatures
- manage cryptographic keys

Algorithm selection is performed by `CryptoBootstrap`; this class
implements only the hashing operation.

Status

✅ Verified

---

## Audit Notes

SHA256HashProvider performs one responsibility.

- Compute the SHA-256 hash of a supplied `Uint8Array` and return the
  digest as a hexadecimal string.

It is the concrete hash implementation registered with
`HashRegistry` and assembled into the `CryptoProvider` by
`CryptoBootstrap` when SHA-256 is configured as the active hash
algorithm.

Status

✅ Verified

# Stage 36: Ed25519 Signature Provider

## File

```text
packages/crypto/src/providers/signature/Ed25519SignatureProvider.ts
```

## Responsibility

Generate and verify digital signatures using the Ed25519 signature
algorithm.

The Ed25519 Signature Provider implements the `SignatureProvider`
interface and provides a stateless implementation of Ed25519 signing
and signature verification.

Key management is delegated to a `KeyProvider`.

Status

✅ Verified

---

## Implements

```text
SignatureProvider
```

Status

✅ Verified

---

## Uses

```text
Node.js Crypto

sign()

verify()

assertKeyType()
```

Status

✅ Verified

---

## Supported Algorithm

```text
SignatureAlgorithms.ED25519
```

Exposed as

```text
algorithm
```

Status

✅ Verified

---

## Public Operations

```text
sign(
    data,
    privateKey
)

verify(
    data,
    signature,
    publicKey
)
```

Status

✅ Verified

---

## Execution Sequence: Sign

```text
Uint8Array

↓

Validate Private Key Type

↓

Node.js sign()

↓

Base64 Encode

↓

Digital Signature
```

Status

✅ Verified

---

## Execution Sequence: Verify

```text
Uint8Array

↓

Validate Public Key Type

↓

Base64 Decode Signature

↓

Node.js verify()

↓

Boolean Result
```

Status

✅ Verified

---

## Phase 1: Validate Key Type

Component

```text
assertKeyType()
```

Expected Key Type

```text
ed25519
```

Purpose

Ensure the supplied key matches the Ed25519 algorithm before any
cryptographic operation is performed.

Status

✅ Verified

---

## Phase 2: Generate Signature

Method

```text
sign()
```

Operation

```text
Node.js sign(
    null,
    Buffer.from(data),
    privateKey
)
```

Output

```text
Base64 Signature
```

Purpose

Generate an Ed25519 digital signature over the supplied binary data.

Status

✅ Verified

---

## Phase 3: Verify Signature

Method

```text
verify()
```

Operation

```text
Node.js verify(
    null,
    Buffer.from(data),
    publicKey,
    Buffer.from(signature, "base64")
)
```

Output

```text
Boolean
```

Purpose

Verify that the supplied Base64-encoded signature matches the binary
data and public key.

Status

✅ Verified

---

## Security Properties

The Ed25519 Signature Provider

- validates key type before signing
- validates key type before verification
- accepts canonical binary input
- encodes signatures as Base64
- performs no serialization
- maintains no mutable internal state

The provider is frozen during construction using

```text
Object.freeze(this)
```

making the instance immutable after initialization.

Status

✅ Verified

---

## Architectural Notes

Ed25519SignatureProvider is a concrete implementation of the
`SignatureProvider` interface.

It is responsible only for Ed25519 signing and verification.

It does not

- load cryptographic keys
- serialize artifacts
- hash artifacts
- select signature algorithms
- register providers

Key management is delegated to a `KeyProvider`, while algorithm
selection is performed by `CryptoBootstrap`.

Status

✅ Verified

---

## Audit Notes

Ed25519SignatureProvider performs two responsibilities.

- Generate Ed25519 digital signatures.
- Verify Ed25519 digital signatures.

It delegates key lifecycle management outside the provider and relies
on Node.js cryptographic primitives for all signing and verification
operations. The provider remains stateless and immutable throughout its
lifecycle.

Status

✅ Verified

# Stage 37: Dilithium3 Signature Provider

## File

```text
packages/crypto/src/providers/signature/Dilithium3SignatureProvider.ts
```

## Responsibility

Generate and verify digital signatures using the Dilithium3
(ML-DSA-65) post-quantum signature algorithm.

The Dilithium3 Signature Provider implements the
`SignatureProvider` interface and provides a stateless
implementation of ML-DSA-65 signing and signature verification
using Node.js native cryptographic support.

Key management is delegated to a `KeyProvider`.

Status

✅ Verified

---

## Implements

```text
SignatureProvider
```

Status

✅ Verified

---

## Uses

```text
Node.js Crypto

sign()

verify()

assertKeyType()
```

Status

✅ Verified

---

## Supported Algorithm

```text
SignatureAlgorithms.DILITHIUM3
```

Node.js Key Type

```text
ml-dsa-65
```

Exposed as

```text
algorithm
```

Status

✅ Verified

---

## Public Operations

```text
sign(
    data,
    privateKey
)

verify(
    data,
    signature,
    publicKey
)
```

Status

✅ Verified

---

## Execution Sequence: Sign

```text
Uint8Array

↓

Validate Private Key Type

↓

Node.js sign()

↓

Base64 Encode

↓

Digital Signature
```

Status

✅ Verified

---

## Execution Sequence: Verify

```text
Uint8Array

↓

Validate Public Key Type

↓

Base64 Decode Signature

↓

Node.js verify()

↓

Boolean Result
```

Status

✅ Verified

---

## Phase 1: Validate Key Type

Component

```text
assertKeyType()
```

Expected Key Type

```text
ml-dsa-65
```

Purpose

Ensure the supplied key is an ML-DSA-65 key before any
cryptographic operation is performed.

Status

✅ Verified

---

## Phase 2: Generate Signature

Method

```text
sign()
```

Operation

```text
Node.js sign(
    null,
    Buffer.from(data),
    privateKey
)
```

Output

```text
Base64 Signature
```

Purpose

Generate an ML-DSA-65 digital signature over the supplied binary
data.

Status

✅ Verified

---

## Phase 3: Verify Signature

Method

```text
verify()
```

Operation

```text
Node.js verify(
    null,
    Buffer.from(data),
    publicKey,
    Buffer.from(signature, "base64")
)
```

Output

```text
Boolean
```

Purpose

Verify that the supplied Base64-encoded signature matches the
binary data and public key.

Status

✅ Verified

---

## Security Properties

The Dilithium3 Signature Provider

- validates key type before signing
- validates key type before verification
- accepts canonical binary input
- encodes signatures as Base64
- performs no serialization
- maintains no mutable internal state

The provider instance is frozen during construction using

```text
Object.freeze(this)
```

making it immutable after initialization.

Unlike Ed25519, ML-DSA-65 signatures are **randomized**. Signing the
same message multiple times with the same private key produces
different signatures, while each remains valid for verification.

Status

✅ Verified

---

## Architectural Notes

Dilithium3SignatureProvider is a concrete implementation of the
`SignatureProvider` interface.

It is responsible only for ML-DSA-65 signing and verification.

It does not

- load cryptographic keys
- serialize artifacts
- hash artifacts
- select signature algorithms
- register providers

Key management is delegated to a `KeyProvider`, while algorithm
selection is performed by `CryptoBootstrap`.

Status

✅ Verified

---

## Audit Notes

Dilithium3SignatureProvider performs two responsibilities.

- Generate ML-DSA-65 digital signatures.
- Verify ML-DSA-65 digital signatures.

The implementation relies entirely on Node.js native cryptographic
support. Compared to the Ed25519 provider, the primary behavioral
difference is that ML-DSA-65 signatures are intentionally
non-deterministic, producing different valid signatures for identical
inputs while preserving verification correctness.

Status

✅ Verified

# Stage 38: Hybrid Signer

## File

```text
packages/crypto/src/HybridSigner.ts
```

## Responsibility

Generate a bundle containing digital signatures from two independent
cryptographic providers.

The Hybrid Signer signs the same canonical artifact using both the
primary and secondary `CryptoProvider` instances and returns the
resulting signatures as a `SignatureBundle`.

This enables simultaneous support for multiple signature algorithms,
such as Ed25519 and Dilithium3.

Status

✅ Verified

---

## Uses

```text
ArtifactSigner

HybridCryptoProvider

SignatureBundle

SignatureEntry
```

Status

✅ Verified

---

## Public Operation

```text
sign(
    artifact,
    primaryPrivateKey,
    secondaryPrivateKey,
    primaryKeyId,
    secondaryKeyId
)
```

Input

```text
Artifact

Primary Private Key

Secondary Private Key

Primary Key Identifier

Secondary Key Identifier
```

Output

```text
SignatureBundle
```

Status

✅ Verified

---

## Execution Sequence

```text
Artifact

↓

Primary ArtifactSigner

↓

Primary Signature

          +

Secondary ArtifactSigner

↓

Secondary Signature

↓

Create Signature Entries

↓

SignatureBundle
```

Status

✅ Verified

---

## Phase 1: Create Signers

Construct

```text
ArtifactSigner(
    primary CryptoProvider
)

ArtifactSigner(
    secondary CryptoProvider
)
```

Purpose

Create independent signing components for each configured
cryptographic provider.

Status

✅ Verified

---

## Phase 2: Generate Primary Signature

Component

```text
ArtifactSigner
```

Provider

```text
Primary CryptoProvider
```

Output

```text
Primary Signature
```

Purpose

Generate the signature using the configured primary algorithm.

Status

✅ Verified

---

## Phase 3: Generate Secondary Signature

Component

```text
ArtifactSigner
```

Provider

```text
Secondary CryptoProvider
```

Output

```text
Secondary Signature
```

Purpose

Generate the signature using the configured secondary algorithm.

Status

✅ Verified

---

## Phase 4: Build Signature Entries

Each entry contains

```text
algorithm

keyId

signature
```

The algorithm value is obtained from the corresponding
`CryptoProvider.signature.algorithm`.

Status

✅ Verified

---

## Phase 5: Return Signature Bundle

Returns

```text
SignatureBundle
```

Containing

```text
signatures[]
```

where each element is a `SignatureEntry`.

Status

✅ Verified

---

## Security Properties

The Hybrid Signer

- signs the identical artifact twice
- uses independent cryptographic providers
- maintains separate key identifiers
- preserves the signature algorithm associated with each signature
- delegates canonical serialization and signing to `ArtifactSigner`

It performs no cryptographic implementation directly.

Status

✅ Verified

---

## Architectural Notes

HybridSigner is an orchestration component.

It is responsible only for coordinating multi-algorithm signing.

It does not

- serialize artifacts
- hash artifacts
- implement signature algorithms
- verify signatures
- manage cryptographic keys

All cryptographic operations are delegated to two independent
`ArtifactSigner` instances configured with separate
`CryptoProvider` implementations.

Status

✅ Verified

---

## Audit Notes

HybridSigner performs five responsibilities.

- Create signers for the primary and secondary crypto providers.
- Generate the primary signature.
- Generate the secondary signature.
- Associate each signature with its algorithm and key identifier.
- Return a `SignatureBundle` containing both signatures.

The implementation supports cryptographic migration and
multi-algorithm interoperability by producing signatures from two
independent providers over the same canonical artifact without
duplicating signing logic.

Status

✅ Verified

# Stage 39: Hybrid Verifier

## File

```text
packages/crypto/src/HybridVerifier.ts
```

## Responsibility

Verify a `SignatureBundle` using two independent cryptographic
providers.

The Hybrid Verifier validates that an artifact has been correctly
signed by both the primary and secondary signature algorithms. A
verification succeeds only when both signatures are present and both
verify successfully.

Status

✅ Verified

---

## Uses

```text
SignatureVerifier

HybridCryptoProvider

SignatureBundle
```

Status

✅ Verified

---

## Public Operation

```text
verify(
    artifact,
    bundle,
    primaryPublicKey,
    secondaryPublicKey
)
```

Input

```text
Artifact

SignatureBundle

Primary Public Key

Secondary Public Key
```

Output

```text
Boolean
```

Status

✅ Verified

---

## Execution Sequence

```text
SignatureBundle

↓

Validate Bundle Size

↓

Create Primary Verifier

↓

Create Secondary Verifier

↓

Verify Primary Signature

↓

Verify Secondary Signature

↓

Return

primaryVerified &&
secondaryVerified
```

Status

✅ Verified

---

## Phase 1: Validate Signature Bundle

Validation

```text
bundle.signatures.length == 2
```

Failure

```text
Return false
```

Purpose

Ensure the bundle contains exactly two signatures before attempting
verification.

Status

✅ Verified

---

## Phase 2: Create Verifiers

Construct

```text
SignatureVerifier(
    primary CryptoProvider
)

SignatureVerifier(
    secondary CryptoProvider
)
```

Purpose

Create independent verification components for each configured
cryptographic provider.

Status

✅ Verified

---

## Phase 3: Validate Signature Entries

Extract

```text
primarySignature

secondarySignature
```

Validation

```text
Both entries exist
```

Failure

```text
Return false
```

Purpose

Ensure both expected signature entries are present before
verification.

Status

✅ Verified

---

## Phase 4: Verify Primary Signature

Component

```text
SignatureVerifier
```

Provider

```text
Primary CryptoProvider
```

Input

```text
Artifact

Primary Signature

Primary Public Key
```

Output

```text
Boolean
```

Purpose

Verify the primary digital signature.

Status

✅ Verified

---

## Phase 5: Verify Secondary Signature

Component

```text
SignatureVerifier
```

Provider

```text
Secondary CryptoProvider
```

Input

```text
Artifact

Secondary Signature

Secondary Public Key
```

Output

```text
Boolean
```

Purpose

Verify the secondary digital signature.

Status

✅ Verified

---

## Phase 6: Return Verification Result

Operation

```text
primaryVerified &&
secondaryVerified
```

Output

```text
Boolean
```

Purpose

Return success only when both signatures verify successfully.

Status

✅ Verified

---

## Security Properties

The Hybrid Verifier

- requires exactly two signatures
- validates both signature entries exist
- independently verifies each signature
- fails closed by returning `false` if bundle validation fails
- requires both verifications to succeed

It performs no cryptographic implementation directly.

Status

✅ Verified

---

## Architectural Notes

HybridVerifier is an orchestration component.

It is responsible only for coordinating multi-algorithm verification.

It does not

- serialize artifacts
- hash artifacts
- implement signature algorithms
- manage cryptographic keys

All verification operations are delegated to two independent
`SignatureVerifier` instances configured with separate
`CryptoProvider` implementations.

Status

✅ Verified

---

## Audit Notes

HybridVerifier performs six responsibilities.

- Validate the signature bundle structure.
- Create verifiers for the primary and secondary crypto providers.
- Validate the presence of both signature entries.
- Verify the primary signature.
- Verify the secondary signature.
- Return a single verification result requiring both signatures to
  succeed.

The implementation follows a fail-closed approach: malformed bundles,
missing signatures, or any failed verification result in an overall
verification failure. This supports hybrid cryptographic deployments by
requiring successful verification across all configured signature
algorithms.

Status

✅ Verified

# Stage 40: End-to-End Execution Flow

## Purpose

Trace the complete execution lifecycle implemented by the Parmana
repository.

This section consolidates the audited implementation into a single
execution sequence, showing how business transactions move through
authorization, execution, verification, and receipt generation.

Every stage below references components previously verified during the
implementation audit.

Status

✅ Verified

---

## End-to-End Execution Pipeline

```text
Business Transaction

↓

Business Transaction Mapper

↓

Execution Request Builder

↓

Execution Trust Application

↓

Runtime

↓

Runtime Engine

↓

Runtime Pipeline

↓

Policy Evaluation

↓

Decision

↓

Execution Authorization

↓

AuthorizationSigner

↓

ExecutableContentHasher

↓

ArtifactSigner

↓

Execution Gateway

↓

Execution Service

↓

Execution System

↓

Business Trust Record Builder

↓

Execution Trust Record

↓

Verification Service

↓

VerificationCrypto

↓

Receipt Service

↓

ReceiptCrypto

↓

Execution Receipt
```

Status

✅ Verified

---

## Phase 1: Business Transaction

Component

```text
BusinessTransactionService
```

Responsibility

Receive the incoming business transaction and prepare it for runtime
processing.

Status

✅ Verified

---

## Phase 2: Runtime Evaluation

Components

```text
ExecutionTrustApplication

Runtime

RuntimeEngine

RuntimePipeline
```

Responsibility

Evaluate policy, execute runtime processing, and produce a
deterministic decision.

Output

```text
Decision
```

Status

✅ Verified

---

## Phase 3: Authorization

Components

```text
AuthorizationSigner

ExecutableContentHasher

ArtifactSigner
```

Responsibilities

- Validate authorization lifetime.
- Compute executable content hash.
- Construct authorization payload.
- Produce cryptographic signature.

Output

```text
SignedExecutionAuthorization
```

Status

✅ Verified

---

## Phase 4: Execution

Components

```text
Execution Gateway

Execution Service

Execution System
```

Responsibilities

Execute the approved business operation using the signed
authorization.

Output

```text
Execution
```

Status

✅ Verified

---

## Phase 5: Trust Record Construction

Components

```text
Business Trust Record Builder

Execution Trust Record Builder
```

Responsibilities

Create the immutable Execution Trust Record describing the completed
execution.

Output

```text
ExecutionTrustRecord
```

Status

✅ Verified

---

## Phase 6: Verification

Components

```text
VerificationService

VerificationCrypto
```

Responsibilities

Verify

- Trust Record hash
- Digital signature
- Authorization binding

Output

```text
Verification
```

Status

✅ Verified

---

## Phase 7: Receipt Generation

Components

```text
ReceiptService

ReceiptCrypto
```

Responsibilities

Generate the signed execution receipt after successful verification.

Output

```text
ExecutionReceipt
```

Status

✅ Verified

---

## Cryptographic Flow

```text
ExecutableContent

↓

ExecutableContentHasher

↓

businessTransactionHash

↓

AuthorizationSigner

↓

ArtifactSigner

↓

Ed25519 / Dilithium3

↓

Execution

↓

VerificationCrypto

↓

ReceiptCrypto
```

Status

✅ Verified

---

## Component Relationships

```text
CryptoBootstrap

↓

HashRegistry
SignatureRegistry

↓

CryptoBuilder

↓

CryptoProvider

↓

HashProvider
SignatureProvider

↓

ArtifactSigner
AuthorizationSigner
VerificationCrypto
ReceiptCrypto
HybridSigner
HybridVerifier
```

Status

✅ Verified

---

## Deterministic Properties

The implementation performs deterministic processing through

- Canonical serialization
- Shared hashing infrastructure
- Immutable trust artifacts
- Centralized cryptographic provider construction
- Shared authorization hashing
- Shared signature generation
- Shared signature verification

Status

✅ Verified

---

## Audit Notes

The implementation separates responsibilities into four major layers.

```text
Runtime

↓

Authorization

↓

Execution

↓

Verification & Receipt
```

Cryptographic primitives remain isolated within the crypto subsystem,
while runtime services orchestrate business execution. Shared
components such as `ArtifactSigner`, `TrustRecordHasher`, and
`CryptoBuilder` eliminate duplicated cryptographic logic and provide
consistent behavior across authorization, verification, and receipt
generation.

Status

✅ Verified

# Stage 41: Trust Boundaries

## Purpose

Identify the trust boundaries enforced by the Parmana execution
pipeline.

This chapter documents where trust changes within the implementation
and which components enforce each boundary.

Every boundary described below is derived from previously audited
components.

Status

✅ Verified

---

## Trust Boundary Overview

```text
Client

│
│ Untrusted Input
▼

Business Transaction Service

──────────────────────────────────
Boundary 1
Application Entry
──────────────────────────────────

↓

Runtime

↓

Policy Evaluation

↓

Decision

──────────────────────────────────
Boundary 2
Authorization
──────────────────────────────────

↓

AuthorizationSigner

↓

SignedExecutionAuthorization

──────────────────────────────────
Boundary 3
Execution
──────────────────────────────────

↓

Execution Gateway

↓

Enterprise System

↓

Execution Result

──────────────────────────────────
Boundary 4
Trust Record
──────────────────────────────────

↓

ExecutionTrustRecord

↓

VerificationService

──────────────────────────────────
Boundary 5
Verification
──────────────────────────────────

↓

ReceiptService

↓

ExecutionReceipt
```

Status

✅ Verified

---

## Boundary 1: Application Entry

Components

```text
BusinessTransactionService

BusinessTransactionMapper
```

Incoming Data

```text
Business Transaction
```

Responsibility

Convert external business requests into the internal execution model.

The implementation begins processing only after the transaction has
been mapped into the runtime domain model.

Status

✅ Verified

---

## Boundary 2: Authorization

Components

```text
AuthorizationSigner

ExecutableContentHasher

ArtifactSigner
```

Input

```text
Approved Decision
```

Output

```text
SignedExecutionAuthorization
```

Responsibility

Create a cryptographically signed authorization bound to the exact
executable content and constrained by an authorization lifetime.

Status

✅ Verified

---

## Boundary 3: Execution

Components

```text
Execution Gateway

Execution Service

Execution System
```

Input

```text
SignedExecutionAuthorization
```

Output

```text
Execution
```

Responsibility

Execute only operations that have been authorized by the runtime.

The execution boundary separates decision-making from external system
interaction.

Status

✅ Verified

---

## Boundary 4: Trust Record

Components

```text
BusinessTrustRecordBuilder

ExecutionTrustRecordBuilder
```

Output

```text
ExecutionTrustRecord
```

Responsibility

Capture an immutable record describing the completed execution.

This artifact becomes the authoritative evidence supplied to the
verification stage.

Status

✅ Verified

---

## Boundary 5: Verification

Components

```text
VerificationService

VerificationCrypto

ReceiptService

ReceiptCrypto
```

Responsibilities

- Validate trust record integrity.
- Verify digital signatures.
- Verify authorization binding.
- Produce a signed execution receipt.

The receipt is generated only after successful verification.

Status

✅ Verified

---

## Trust Transitions

```text
External Request

↓

Internal Runtime

↓

Authorized Execution

↓

Executed Operation

↓

Verified Evidence

↓

Signed Receipt
```

Status

✅ Verified

---

## Cryptographic Trust Boundaries

The implementation establishes cryptographic trust at three points.

### Authorization

```text
AuthorizationSigner
```

Produces

```text
SignedExecutionAuthorization
```

---

### Verification

```text
VerificationCrypto
```

Validates

- hash integrity
- digital signature
- authorization binding

---

### Receipt

```text
ReceiptCrypto
```

Produces

```text
ExecutionReceipt
```

Status

✅ Verified

---

## Audit Notes

The implementation separates trust into distinct stages rather than
relying on a single trusted component.

Trust progresses through five implementation-defined boundaries:

- Application Entry
- Authorization
- Execution
- Trust Record
- Verification

Each boundary is enforced by dedicated components that were verified
individually during the implementation audit.

Status

✅ Verified

# Stage 42: Security Invariants

## Purpose

Document the security guarantees that are enforced across the Parmana
implementation.

Unlike previous sections, this chapter does not introduce new
components. Instead, it consolidates the implementation-backed
properties established throughout the repository audit.

Each invariant is enforced by one or more audited components.

Status

✅ Verified

---

# Invariant 1: Deterministic Decisions

## Guarantee

The same execution request always produces the same decision when
evaluated against the same policy version and execution context.

Enforced By

```text
RuntimeEngine

Policy Evaluation

CanonicalSerializer
```

Purpose

Ensures policy evaluation is reproducible and replayable.

Status

✅ Verified

---

# Invariant 2: Canonical Data Representation

## Guarantee

Every artifact is serialized into a canonical byte sequence before
hashing or signing.

Enforced By

```text
CanonicalSerializer

ArtifactSigner

TrustRecordHasher
```

Purpose

Prevents different JSON representations from producing different
cryptographic results.

Status

✅ Verified

---

# Invariant 3: Content Integrity

## Guarantee

Cryptographic hashes represent the exact executable content that was
authorized.

Enforced By

```text
ExecutableContentHasher

TrustRecordHasher
```

Output

```text
businessTransactionHash
```

Purpose

Detects modification of execution content after authorization.

Status

✅ Verified

---

# Invariant 4: Authorization Integrity

## Guarantee

Only signed execution authorizations are considered valid.

Enforced By

```text
AuthorizationSigner

ArtifactSigner
```

Purpose

Ensures execution authorizations cannot be forged or modified without
detection.

Status

✅ Verified

---

# Invariant 5: Signature Authenticity

## Guarantee

Every signature is verified using the corresponding public key and
configured signature algorithm.

Enforced By

```text
SignatureVerifier

VerificationCrypto

HybridVerifier
```

Purpose

Confirms artifact authenticity and signer identity.

Status

✅ Verified

---

# Invariant 6: Authorization Binding

## Guarantee

Execution authorization is cryptographically bound to the executable
content through the business transaction hash.

Enforced By

```text
ExecutableContentHasher

AuthorizationSigner

VerificationCrypto
```

Purpose

Prevents reuse of an authorization for different executable content.

Status

✅ Verified

---

# Invariant 7: Immutable Trust Evidence

## Guarantee

Execution Trust Records are treated as immutable evidence once
constructed.

Enforced By

```text
ExecutionTrustRecordBuilder

TrustRecordHasher

VerificationService
```

Purpose

Provides reproducible evidence for auditing and verification.

Status

✅ Verified

---

# Invariant 8: Receipt Authenticity

## Guarantee

Execution receipts are generated only after successful verification.

Enforced By

```text
ReceiptService

ReceiptCrypto

VerificationService
```

Purpose

Ensures receipts represent verified executions rather than merely
completed executions.

Status

✅ Verified

---

# Invariant 9: Algorithm Isolation

## Guarantee

Cryptographic algorithms are interchangeable without changing business
logic.

Enforced By

```text
CryptoBuilder

CryptoBootstrap

HashRegistry

SignatureRegistry
```

Purpose

Separates cryptographic implementation from execution logic.

Status

✅ Verified

---

# Invariant 10: Key Separation

## Guarantee

Private keys are never embedded in business logic.

Enforced By

```text
FileKeyProvider

SignatureProvider

CryptoProvider
```

Purpose

Centralizes key access and separates key management from signing
operations.

Status

✅ Verified

---

# Invariant 11: Provider Validation

## Guarantee

Every cryptographic provider is validated before use.

Enforced By

```text
CryptoBuilder

HashRegistry

SignatureRegistry
```

Purpose

Prevents incomplete or unsupported cryptographic configurations.

Status

✅ Verified

---

# Invariant 12: Hybrid Cryptographic Consistency

## Guarantee

Hybrid signatures require successful processing by both configured
cryptographic providers.

Enforced By

```text
HybridSigner

HybridVerifier
```

Purpose

Supports cryptographic migration and multi-algorithm deployments while
maintaining equivalent protection across all configured algorithms.

Status

✅ Verified

---

# Invariant 13: Fail-Closed Verification

## Guarantee

Verification fails whenever required evidence is missing, malformed, or
invalid.

Enforced By

```text
VerificationService

SignatureVerifier

HybridVerifier
```

Examples

- Missing signatures
- Incorrect bundle structure
- Signature verification failure
- Hash mismatch

Purpose

Ensures execution evidence is never accepted on partial validation.

Status

✅ Verified

---

# Security Model

The implementation establishes security through multiple independent
controls rather than relying on a single mechanism.

```text
Canonical Serialization

↓

Hash Integrity

↓

Digital Signatures

↓

Authorization Binding

↓

Verification

↓

Receipt Generation
```

Each layer contributes independent protection against tampering,
forgery, or inconsistent execution evidence.

Status

✅ Verified

---

# Audit Notes

The Parmana implementation enforces security through a layered model of
deterministic processing, canonical representation, cryptographic
binding, and independent verification.

The repository consistently separates:

- Business logic from cryptographic operations.
- Key management from signing operations.
- Authorization from execution.
- Execution from verification.
- Verification from receipt generation.

These invariants collectively provide the foundation for reproducible,
auditable, and cryptographically verifiable execution authorization.

Status

✅ Verified

# Stage 43: Determinism Guarantees

## Purpose

Document the implementation mechanisms that ensure Parmana produces
reproducible execution results.

Determinism is a foundational property of the repository. It ensures
that identical execution inputs produce identical policy decisions,
cryptographic artifacts, and verification outcomes.

Every guarantee described below is derived from previously audited
components.

Status

✅ Verified

---

# Deterministic Execution Model

```text
Execution Request

↓

Canonical Representation

↓

Policy Evaluation

↓

Authorization

↓

Execution Trust Record

↓

Verification

↓

Execution Receipt
```

Every stage operates on deterministic inputs and produces reproducible
outputs.

Status

✅ Verified

---

# Guarantee 1: Canonical Serialization

## Components

```text
CanonicalSerializer

ArtifactSigner

TrustRecordHasher
```

Guarantee

Every artifact is converted into a canonical byte representation before
being hashed or signed.

Purpose

Eliminate differences caused by object ordering, formatting, or JSON
encoding variations.

Result

```text
Identical Artifact

↓

Identical Bytes
```

Status

✅ Verified

---

# Guarantee 2: Stable Hash Generation

## Components

```text
TrustRecordHasher

ExecutableContentHasher

SHA256HashProvider
```

Guarantee

The same canonical byte sequence always produces the same SHA-256 hash.

Result

```text
Canonical Bytes

↓

SHA-256

↓

Deterministic Hash
```

Status

✅ Verified

---

# Guarantee 3: Stable Authorization Content

## Components

```text
AuthorizationSigner

ExecutableContentHasher
```

Guarantee

The executable content hash is calculated from the exact business
content being authorized, ensuring that authorization is bound to a
specific executable payload.

Result

```text
Executable Content

↓

businessTransactionHash
```

Status

✅ Verified

---

# Guarantee 4: Deterministic Signature Input

## Components

```text
ArtifactSigner

SignatureProvider
```

Guarantee

Every signature operation receives the same canonical byte sequence for
an identical artifact.

This ensures the input to the signature algorithm is deterministic,
regardless of the algorithm itself.

Status

✅ Verified

---

# Guarantee 5: Deterministic Verification

## Components

```text
SignatureVerifier

VerificationCrypto

HybridVerifier
```

Guarantee

Verification always evaluates the canonical artifact together with the
provided signatures and public keys.

Given identical inputs, verification produces the same boolean result.

Status

✅ Verified

---

# Guarantee 6: Immutable Trust Evidence

## Components

```text
ExecutionTrustRecordBuilder

TrustRecordHasher

VerificationService
```

Guarantee

Verification operates against immutable trust evidence rather than
reconstructed execution state.

Purpose

Ensure replayability and reproducibility.

Status

✅ Verified

---

# Guarantee 7: Shared Cryptographic Infrastructure

## Components

```text
CryptoBootstrap

CryptoBuilder

HashRegistry

SignatureRegistry
```

Guarantee

All cryptographic consumers use centrally constructed providers rather
than creating independent implementations.

Purpose

Ensure consistent hashing and signing behavior across the repository.

Status

✅ Verified

---

# Guarantee 8: Algorithm Independence

## Components

```text
CryptoProvider

Ed25519SignatureProvider

Dilithium3SignatureProvider

HybridSigner

HybridVerifier
```

Guarantee

Business logic is independent of the underlying signature algorithm.

Changing algorithms affects the cryptographic output but does not alter
the execution flow or repository behavior.

Status

✅ Verified

---

# Guarantee 9: Deterministic Verification Pipeline

The verification process always follows the same sequence.

```text
ExecutionTrustRecord

↓

Canonical Serialization

↓

Hash Verification

↓

Signature Verification

↓

Authorization Validation

↓

Verification Result
```

Every verification evaluates the same evidence in the same order.

Status

✅ Verified

---

# Guarantee 10: Deterministic Receipt Generation

## Components

```text
ReceiptService

ReceiptCrypto
```

Guarantee

Execution receipts are derived from verified execution evidence rather
than reconstructed execution state.

Purpose

Ensure receipts consistently represent the outcome of the verified
execution.

Status

✅ Verified

---

# Determinism Boundaries

The implementation enforces deterministic behavior within the
repository's control while relying on cryptographic primitives for
security.

```text
Business Input

↓

Canonical Serialization

↓

Hash Generation

↓

Policy Evaluation

↓

Authorization Construction

↓

Verification

↓

Receipt Generation
```

These stages are deterministic for identical inputs.

**Implementation Note**

The audited repository also includes `Dilithium3SignatureProvider`,
whose source code explicitly documents that **ML-DSA-65 signatures are
randomized**. Signing the same canonical artifact twice produces
different valid signatures. Therefore, determinism applies to the
artifact, hash, authorization content, and verification outcome, not to
the raw signature bytes produced by randomized signature algorithms.

Status

✅ Verified

---

# Audit Notes

The Parmana implementation achieves reproducibility by combining
canonical serialization, shared cryptographic infrastructure, immutable
execution evidence, and deterministic processing of business artifacts.

The audit confirms that determinism is enforced at the data,
authorization, verification, and evidence layers. Where cryptographic
algorithms intentionally introduce randomness (such as ML-DSA-65), the
repository preserves deterministic verification by operating over
canonical inputs and validating signatures against the corresponding
public keys rather than requiring identical signature values.

Status

✅ Verified

# Stage 44: Repository Cross-Reference Matrix

## Purpose

Provide a consolidated index of the major implementation components
audited throughout the Parmana repository.

This matrix summarizes each component's primary responsibility, its key
dependencies, its principal consumers, and the audit stage in which it
was examined. It serves as the master reference for navigating the
implementation.

Status

✅ Verified

---

# Runtime Layer

| Component                  | Primary Responsibility                    | Primary Dependencies | Primary Consumers | Audit Stage |
| -------------------------- | ----------------------------------------- | -------------------- | ----------------- | ----------: |
| BusinessTransactionService | Receive and prepare business transactions | Mapper layer         | Runtime           |     Earlier |
| BusinessTransactionMapper  | Convert business input into runtime model | Domain models        | Runtime           |     Earlier |
| ExecutionTrustApplication  | Entry point for execution trust           | Runtime              | RuntimeEngine     |     Earlier |
| Runtime                    | Execute runtime orchestration             | RuntimeEngine        | Application       |     Earlier |
| RuntimeEngine              | Coordinate execution pipeline             | RuntimePipeline      | Runtime           |     Earlier |
| RuntimePipeline            | Execute runtime stages                    | Policy engine        | RuntimeEngine     |     Earlier |

Status

✅ Verified

---

# Policy Layer

| Component         | Primary Responsibility    | Primary Dependencies | Primary Consumers | Audit Stage |
| ----------------- | ------------------------- | -------------------- | ----------------- | ----------: |
| Policy Evaluation | Evaluate execution policy | Rules                | RuntimePipeline   |     Earlier |
| Decision          | Produce execution outcome | Policy Evaluation    | Authorization     |     Earlier |

Status

✅ Verified

---

# Authorization Layer

| Component               | Primary Responsibility                | Primary Dependencies                    | Primary Consumers                                                    | Audit Stage |
| ----------------------- | ------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- | ----------: |
| AuthorizationSigner     | Create signed execution authorization | ArtifactSigner, ExecutableContentHasher | Execution                                                            |          28 |
| ExecutableContentHasher | Hash executable content               | TrustRecordHasher                       | AuthorizationSigner                                                  |          29 |
| ArtifactSigner          | Canonically sign artifacts            | CryptoProvider                          | AuthorizationSigner, ReceiptCrypto, VerificationCrypto, HybridSigner |          25 |

Status

✅ Verified

---

# Execution Layer

| Component         | Primary Responsibility     | Primary Dependencies | Primary Consumers  | Audit Stage |
| ----------------- | -------------------------- | -------------------- | ------------------ | ----------: |
| Execution Gateway | Control outbound execution | ExecutionService     | Enterprise Systems |     Earlier |
| ExecutionService  | Execute approved operation | Gateway              | Runtime            |     Earlier |
| Execution System  | External business platform | Outside repository   | ExecutionService   |    External |

Status

✅ Verified

---

# Trust Record Layer

| Component                   | Primary Responsibility            | Primary Dependencies                | Primary Consumers                      | Audit Stage |
| --------------------------- | --------------------------------- | ----------------------------------- | -------------------------------------- | ----------: |
| BusinessTrustRecordBuilder  | Build business execution evidence | Execution result                    | Trust Record                           |     Earlier |
| ExecutionTrustRecordBuilder | Construct immutable trust record  | BusinessTrustRecordBuilder          | Verification                           |     Earlier |
| TrustRecordHasher           | Canonically hash trust artifacts  | CanonicalSerializer, CryptoProvider | ReceiptHasher, ExecutableContentHasher |          26 |
| ReceiptHasher               | Hash receipt artifacts            | TrustRecordHasher                   | ReceiptCrypto                          |          27 |

Status

✅ Verified

---

# Verification Layer

| Component           | Primary Responsibility              | Primary Dependencies              | Primary Consumers                  | Audit Stage |
| ------------------- | ----------------------------------- | --------------------------------- | ---------------------------------- | ----------: |
| VerificationService | Coordinate verification             | VerificationCrypto                | ReceiptService                     |     Earlier |
| VerificationCrypto  | Verify signatures and authorization | SignatureVerifier, ArtifactSigner | VerificationService                |     Earlier |
| SignatureVerifier   | Verify digital signatures           | CryptoProvider                    | VerificationCrypto, HybridVerifier |     Earlier |

Status

✅ Verified

---

# Receipt Layer

| Component      | Primary Responsibility     | Primary Dependencies          | Primary Consumers  | Audit Stage |
| -------------- | -------------------------- | ----------------------------- | ------------------ | ----------: |
| ReceiptService | Produce execution receipts | ReceiptCrypto                 | External consumers |     Earlier |
| ReceiptCrypto  | Generate signed receipts   | ArtifactSigner, ReceiptHasher | ReceiptService     |     Earlier |

Status

✅ Verified

---

# Cryptographic Infrastructure

| Component                   | Primary Responsibility                  | Primary Dependencies            | Primary Consumers   | Audit Stage |
| --------------------------- | --------------------------------------- | ------------------------------- | ------------------- | ----------: |
| CryptoBootstrap             | Register and construct crypto providers | CryptoBuilder, Registries       | Application startup |          30 |
| CryptoBuilder               | Assemble CryptoProvider                 | HashRegistry, SignatureRegistry | CryptoBootstrap     |          34 |
| HashRegistry                | Register hash providers                 | HashProvider                    | CryptoBuilder       |          32 |
| SignatureRegistry           | Register signature providers            | SignatureProvider               | CryptoBuilder       |          33 |
| SHA256HashProvider          | SHA-256 hashing                         | Node.js crypto                  | CryptoProvider      |          35 |
| Ed25519SignatureProvider    | Ed25519 signatures                      | Node.js crypto                  | CryptoProvider      |          36 |
| Dilithium3SignatureProvider | ML-DSA-65 signatures                    | Node.js crypto                  | CryptoProvider      |          37 |
| FileKeyProvider             | Load cryptographic keys                 | Filesystem                      | Signature providers |          31 |

Status

✅ Verified

---

# Hybrid Cryptography

| Component      | Primary Responsibility                    | Primary Dependencies | Primary Consumers  | Audit Stage |
| -------------- | ----------------------------------------- | -------------------- | ------------------ | ----------: |
| HybridSigner   | Produce multi-algorithm signature bundles | ArtifactSigner       | Hybrid deployments |          38 |
| HybridVerifier | Verify multi-algorithm signature bundles  | SignatureVerifier    | Hybrid deployments |          39 |

Status

✅ Verified

---

# Repository Dependency Flow

```text
Business Layer

↓

Runtime Layer

↓

Policy Layer

↓

Authorization Layer

↓

Execution Layer

↓

Trust Record Layer

↓

Verification Layer

↓

Receipt Layer

↓

Audit Evidence
```

Status

✅ Verified

---

# Cryptographic Dependency Flow

```text
CryptoBootstrap

↓

CryptoBuilder

↓

CryptoProvider

↓

HashProvider
SignatureProvider

↓

ArtifactSigner

↓

AuthorizationSigner
VerificationCrypto
ReceiptCrypto
HybridSigner

↓

HybridVerifier
```

Status

✅ Verified

---

# Repository Architecture Summary

The audited implementation is organized into six functional domains.

```text
Runtime

↓

Authorization

↓

Execution

↓

Trust Evidence

↓

Verification

↓

Receipt Generation
```

Cross-cutting cryptographic services are isolated within the crypto
subsystem and reused consistently throughout the repository.

This separation minimizes duplicated logic while ensuring that
authorization, verification, and receipt generation all rely on the
same canonical serialization, hashing, and signing infrastructure.

Status

✅ Verified

---

# Audit Notes

The Repository Cross-Reference Matrix consolidates the complete
implementation audit into a single navigational reference.

It identifies:

- each major implementation component,
- its primary responsibility,
- its principal dependencies,
- its primary consumers, and
- the audit stage where its implementation was verified.

This matrix provides the linkage between detailed component audits and
the overall repository architecture, making it easier to trace how
individual classes contribute to the end-to-end execution authorization
pipeline.

Status

✅ Verified

# Stage 45: Architecture Summary

## Purpose

Provide a consolidated architectural assessment of the Parmana
repository based exclusively on the audited implementation.

This chapter summarizes the repository's structure, design principles,
major subsystems, and implementation characteristics without
introducing new technical details.

Status

✅ Verified

---

# Architectural Overview

The Parmana repository implements an execution authorization platform that
controls, authorizes, verifies, and records business operations through
deterministic processing and cryptographically verifiable evidence.

Rather than combining business logic, cryptography, and auditing into a
single subsystem, the implementation separates these responsibilities
into distinct layers with clearly defined interfaces.

At a high level, the repository follows the execution lifecycle:

```text
Business Request

↓

Runtime Evaluation

↓

Policy Decision

↓

Execution Authorization

↓

Business Execution

↓

Execution Trust Record

↓

Verification

↓

Execution Receipt
```

Each stage is implemented by dedicated components that communicate
through well-defined artifacts rather than shared mutable state.

Status

✅ Verified

---

# Architectural Layers

The repository is organized into six primary functional layers.

## Runtime

Responsible for evaluating business requests and coordinating execution.

Primary responsibilities include:

- runtime orchestration
- policy evaluation
- decision production

---

## Authorization

Responsible for converting runtime decisions into signed execution
authorizations.

Primary responsibilities include:

- executable content hashing
- authorization construction
- digital signing

---

## Execution

Responsible for performing approved business operations.

Primary responsibilities include:

- execution coordination
- gateway-controlled execution
- interaction with enterprise systems

---

## Trust Evidence

Responsible for constructing immutable execution evidence.

Primary responsibilities include:

- execution trust record generation
- deterministic hashing
- evidence preservation

---

## Verification

Responsible for independently validating execution evidence.

Primary responsibilities include:

- signature verification
- authorization validation
- integrity verification

---

## Receipt Generation

Responsible for producing cryptographically verifiable execution
receipts after successful verification.

Status

✅ Verified

---

# Cross-Cutting Infrastructure

Several shared infrastructure components support every architectural
layer.

These include:

```text
Canonical Serialization

↓

Cryptographic Providers

↓

Hash Providers

↓

Signature Providers

↓

Artifact Signing

↓

Verification
```

Centralizing these capabilities eliminates duplicated cryptographic
logic while ensuring consistent behavior across authorization,
verification, and receipt generation.

Status

✅ Verified

---

# Cryptographic Architecture

The repository abstracts cryptographic functionality behind provider
interfaces.

```text
CryptoBootstrap

↓

CryptoBuilder

↓

CryptoProvider

↓

Hash Provider

Signature Provider
```

Concrete implementations are registered during bootstrap and consumed
through shared interfaces.

The audited implementation includes support for:

- SHA-256 hashing
- Ed25519 digital signatures
- ML-DSA-65 (Dilithium3) digital signatures
- Hybrid multi-algorithm signing and verification

This architecture enables algorithm replacement or extension without
modifying higher-level business logic.

Status

✅ Verified

---

# Evidence Model

The repository consistently treats execution evidence as immutable.

Key evidence artifacts include:

```text
SignedExecutionAuthorization

↓

ExecutionTrustRecord

↓

Verification Result

↓

ExecutionReceipt
```

Each artifact is constructed, signed or verified, and then consumed by
the next stage of the execution pipeline.

This chained evidence model supports traceability across the execution
lifecycle.

Status

✅ Verified

---

# Design Principles Observed

The audited implementation consistently applies the following design
principles:

- Separation of concerns.
- Layered architecture.
- Deterministic processing.
- Canonical data representation.
- Shared cryptographic infrastructure.
- Interface-driven component design.
- Immutable execution evidence.
- Independent verification.
- Provider-based cryptographic abstraction.
- Fail-closed validation.

These principles appear consistently across runtime, authorization,
verification, and cryptographic components.

Status

✅ Verified

---

# Security Characteristics

The implementation establishes security through multiple complementary
mechanisms rather than a single control.

These mechanisms include:

```text
Canonical Serialization

↓

Deterministic Hashing

↓

Digital Signatures

↓

Authorization Binding

↓

Independent Verification

↓

Receipt Generation
```

Each mechanism protects a different aspect of execution integrity,
providing defense in depth throughout the execution lifecycle.

Status

✅ Verified

---

# Implementation Assessment

Based on the audited implementation, the repository exhibits several
notable architectural characteristics:

### Strong Layering

Business logic, execution control, cryptographic operations, and audit
evidence are separated into dedicated subsystems with clear
responsibilities.

### Reusable Infrastructure

Core cryptographic services such as serialization, hashing, signing,
and verification are reused across multiple workflows instead of being
reimplemented.

### Extensibility

Provider registries and builder patterns allow additional
cryptographic algorithms or implementations to be introduced with
minimal changes to business logic.

### Auditability

Execution artifacts are transformed into verifiable evidence through
deterministic hashing, digital signatures, and independent
verification, supporting reproducible audit trails.

### Maintainability

Shared abstractions, explicit interfaces, and layered dependencies
reduce coupling between functional domains, simplifying future
maintenance and evolution.

Status

✅ Verified

---

# Overall Architectural Assessment

The audited repository implements a modular execution authorization
architecture centered on deterministic processing and cryptographically
verifiable execution evidence.

Its primary architectural strengths are:

- Clear separation between business execution and cryptographic
  services.
- Consistent use of shared infrastructure for hashing, signing, and
  verification.
- Strong evidence lifecycle from authorization through receipt
  generation.
- Support for algorithm agility through provider abstractions.
- Layered trust model with independent verification.

The implementation demonstrates a coherent design in which execution
authorization, trust evidence, verification, and receipt generation
form a continuous chain of verifiable artifacts.

Status

✅ Verified

---

# Audit Conclusion

This implementation audit examined the Parmana repository component by
component, validating responsibilities, dependencies, execution flows,
and architectural relationships directly from the source code.

The audit covered:

- Runtime orchestration.
- Policy evaluation.
- Execution authorization.
- Business execution.
- Trust record construction.
- Verification.
- Receipt generation.
- Cryptographic infrastructure.
- Hybrid cryptography.
- Security invariants.
- Determinism guarantees.
- Repository architecture.

The resulting architecture is structured around a deterministic
execution pipeline in which business decisions are transformed into
cryptographically protected evidence that can be independently verified
after execution.

Status

✅ Verified
