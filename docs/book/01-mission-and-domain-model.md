# Chapter 1 — Mission and the Domain Model

## What Parmana is

Parmana calls itself **Execution Trust Infrastructure**. The category name is deliberate: it
is not a payments product, not an AI-agent framework, and not a policy engine in isolation —
it is the layer that sits between something that *wants* an action to happen (an AI agent, a
human, a script, a third-party system) and something that can *make* it happen (a connector
to an external system), and it exists to make one property true: only what was actually
authorized becomes real, and that fact is provable afterward by an independent party who
trusts nothing about Parmana's own runtime process except a public key.

## Caller-type-agnosticism is structural, not a policy

A recurring temptation in this space is to build special handling for "AI-initiated"
actions — extra scrutiny, extra logging, a different code path. Parmana deliberately does
not. `docs/CLAIMS.md` §2.24 states the claim; the interesting part is how it's proven, not
asserted:

- `BusinessTransactionMapper.fromRequest` (`packages/api/src/mappers/BusinessTransactionMapper.ts:28`)
  casts the caller-declared `authority` field with **no runtime validation** against the
  `AuthorityType` enum. An arbitrary string reaches the runtime completely unfiltered.
- `RuntimeEngine`, `PolicyEngine`, `SignalIntentBinder`, and `CapabilityPolicyBinder`
  contain **zero references** to `authority` or caller identity anywhere in their source —
  confirmed by direct grep across all four files, not inferred from absence of a feature
  flag.
- `packages/api/tests/integration/authority-type-agnostic-execution.integration.test.ts`
  makes this an executable proof, not an inference: two transactions, identical except for
  `authority.authorityType` — one declaring the conventional `"USER"`, the other declaring
  `"FULLY_AUTONOMOUS_AI_AGENT_NEVER_SEEN_BEFORE"` (a string that isn't a member of the
  `AuthorityType` enum at all) — produce byte-identical decisions on both the APPROVE and
  REJECT paths (same `outcome`, same `reason` text). `examples/tutorials/100-authorization-caller-type-agnostic/run.ts`
  demonstrates the same thing at the library level, standalone.

The practical consequence: there is no code path anywhere in the authorization pipeline that
*could* discriminate by caller kind, even accidentally, because none of it ever reads caller
identity in the first place. The one deliberate exception — policy governance, where a human
credential is structurally required — is covered in Chapter 14, and its own design comment
explains exactly why it's the one place this discipline is broken on purpose.

## The domain model: a chain of custody, not a database schema

Everything in `packages/shared/src/domain/` is written as an immutable trust artifact, not a
CRUD entity. The chain, in the order a request actually moves through it:

### Authority — *who is asking, in the caller's own words*

```typescript
// packages/shared/src/domain/authority.ts:11-36
export interface Authority {
  readonly authorityId: string;
  readonly authorityType: AuthorityType;   // USER | ROLE | SERVICE | ORGANIZATION — advisory, not enforced (see above)
  readonly principalId: string;
  readonly displayName?: string;
  readonly issuedAt: Date;
}
```

`authorityType` looks like an enum-constrained field. It is not enforced as one anywhere in
the pipeline that matters — see the previous section. Treat it as a label the caller
supplies, useful for display and for the one place (policy governance) that actually checks
it, not as a structural guarantee.

### Authorization — *the business purpose under which the ask is made*

```typescript
// packages/shared/src/domain/authorization.ts:22-31 (abridged)
export interface Authorization {
  readonly authorizationId: string;
  readonly authorityId: string;   // must match the Authority that issued it
  readonly purpose: string;       // e.g. "Q3 vendor payment run"
}
```

### Intent — *the actual action being requested*

```typescript
// packages/shared/src/domain/intent.ts:27-47 (abridged)
export interface Intent {
  readonly intentId: string;
  readonly authorizationId: string;
  readonly action: string;    // "TransferFunds", "hubspot:deal-update", ...
  // target, parameters follow
}
```

### BusinessTransaction — *the whole request, bundled with its trust chain*

`packages/shared/src/domain/business-transaction.ts` ties `businessTransactionId`,
`metadata`, `authority`, `authorization`, `intent`, `policy` (a `PolicyReference`), and
`signals` (opaque runtime facts the policy will evaluate — Parmana assigns no business
meaning to them, per that field's own doc comment) into one object.
`BusinessTransactionValidator.validate()` (`packages/runtime/src/validators/BusinessTransactionValidator.ts`)
enforces the trust-chain invariants across these fields *before* anything else runs:
`metadata.businessTransactionId === businessTransactionId`,
`authorization.authorityId === authority.authorityId`,
`intent.authorizationId === authorization.authorizationId`. A `BusinessTransaction` whose
own internal references don't line up is rejected before a policy is ever loaded.

### Decision — *the pure output of evaluating a Policy against Signals*

```typescript
// packages/shared/src/domain/decision.ts:20-58 (abridged)
export interface Decision {
  readonly decisionId: string;
  readonly intentId: string;
  readonly policy: PolicyReference;
  readonly signals: Record<string, JsonValue>;   // captured for replay/independent verification
  readonly outcome: DecisionOutcome;              // APPROVED | REJECTED
  readonly reason?: string;
  readonly evaluatedAt: Date;
}
```

The class doc comment is explicit about what a `Decision` deliberately is *not*: "Decision
does not create authority. Decision does not grant authorization. Decision does not modify
intent. Decision records only the outcome of deterministic Policy evaluation." Chapter 2
covers why this restraint matters architecturally, not just as a style preference.

### Execution — *what actually happened*

```typescript
// packages/shared/src/domain/execution.ts:21-104 (abridged)
export interface Execution {
  readonly executionId: string;
  readonly businessTransactionId: string;
  readonly decision: Decision;              // exactly one, immutable
  readonly status: ExecutionStatus;         // PROCESSING | COMPLETED | FAILED
  readonly mode: ExecutionMode;             // SYNC | ASYNC
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly evidence?: ExecutionEvidence;
  readonly previousChainHash?: string | null;
  readonly chainHash?: string;
  readonly chainSignature?: Signature;
}
```

The `previousChainHash`/`chainHash`/`chainSignature` triple (added later than the rest of
this interface — hence optional, so old rows without them still verify) is a signed hash
chain across every `Execution` belonging to one `BusinessTransactionId`, via
`ExecutionChainCrypto` in `@parmana/crypto`. A plain hash alone would only guard against
accidental corruption; because it's *signed*, an actor with raw database write access still
can't forge a replacement link without Parmana's private key. `previousChainHash` is fixed
once, at creation; `chainHash`/`chainSignature` are recomputed on every legitimate mutation
of the row (attaching evidence, completing, failing), since those change what the hash
covers. Tutorial 97 (`examples/tutorials/97-execution-chain-integrity/run.ts`) exercises
this directly, including tampering with an already-chained execution's `status` afterward to
show the tamper gets caught.

### ExecutionTrustRecord — *the whole aggregate, signed*

```typescript
// packages/shared/src/domain/execution-trust-record.ts:21-123 (abridged)
export interface ExecutionTrustRecord {
  readonly trustRecordId: string;
  readonly businessTransactionId: string;
  readonly transaction: BusinessTransaction;
  readonly overrides: readonly Override[];
  readonly executions: readonly Execution[];
  readonly verifications: readonly Verification[];
  readonly receipts: readonly Receipt[];
  readonly trustRecordHash: string;
  readonly signature: Signature;
  readonly schemaVersion?: number;          // absent = v1; >=2 means `signatures` below is populated
  readonly signatures?: readonly SignatureEntry[];  // hybrid (Ed25519 + ML-DSA-65) additive proof
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

This is "the authoritative source for replay, verification, audit, and receipt generation,"
per its own doc comment — everything downstream (Chapters 15–17) reads from this object, not
from the live `BusinessTransaction` or a database join across smaller tables. The
`schemaVersion`/`signatures` pair is worth noting for how this codebase evolves signed
formats without breaking old data: absent `schemaVersion` means "verify with `signature`
alone, exactly as before"; a present value `>= 2` means a verifier **must** independently
verify every entry in `signatures` too, never silently fall back to the single-signature
path. Chapter 6 covers why (hybrid/post-quantum signing).

## Why this shape, not a simpler one

It would be structurally simpler to store one row per transaction with a status column. The
reason it isn't: every one of these objects is designed to be handed to a party that trusts
nothing about Parmana's database — only a public key and, for the objects with a
`trustRecordHash`, the canonical serialization used to compute it (`@parmana/crypto`'s
`CanonicalSerializer`, Chapter 6). An `Execution` records "what happened" separately from
`ExecutionTrustRecord` recording "everything Parmana knows about the whole transaction"
specifically so that a signed hash chain across executions (fine-grained: did this specific
step happen, in this order) and a signed hash over the whole aggregate (coarse-grained: is
this entire record, as returned by the API, unmodified) can both exist, be verified
independently, and fail independently. Chapter 8 shows the same discipline one layer up, in
how `ExecutionGateway` orders its own checks.
