# Integrating Parmana

### A Practitioner's Guide to Wiring Execution Authorization into Real Systems

---

## Front Matter

**Premise.** This is a working engineer's book. It answers one question in as much
concrete detail as it can: how do you connect an execution-authorization layer to the
real systems of a real enterprise — the AI systems that propose actions, and the
enterprise systems that carry them out? It is not a book about why execution
authorization matters; that argument is made elsewhere. It assumes you have already
decided to adopt the pattern, and now you have to make it work against SAP, a payment
rail, a Salesforce org, a deployment pipeline, a homegrown service with an HTTP
endpoint and twelve years of accumulated quirks. This book is about the seams: where
Parmana touches the proposing side, where it touches the executing side, what each
side must implement, what each side gets for free, and — stated as plainly as the
strengths — what integration does not give you and what work remains yours.

**Intended reader.** The engineer or architect responsible for an integration.
Someone who will read an interface and implement against it, who wants to see the
actual method signatures rather than a marketing diagram, and who has been burned
before by "just drop in our SDK" promises that concealed months of work. This book
respects that reader by showing the real surface — the actual `Connector` interface,
the actual verification middleware, the actual contract a receiving system must
honor — and by being explicit about the parts that are foundational-but-incomplete in
the reference implementation today. You should be comfortable with TypeScript,
HTTP, public-key signatures at the level of "there is a private key that signs and a
public key that verifies," and the ordinary mess of enterprise integration.

**How to read this book.** Read Part I first; it establishes the mental model of the
two seams — the proposing seam and the executing seam — without which the rest is a
list of interfaces with no place to put them. After that the book is a manual: Part II
is the executing seam (how an enterprise system receives, verifies, and executes an
authorized action), Part III is the proposing seam (how the runtime turns a proposed
action into a signed authorization), Part IV is the operational reality (nonce
persistence, key custody, failure handling, what must be true in production), and
Part V walks three integration archetypes end to end. An engineer facing a specific
integration can read Part I, then jump to the archetype in Part V that most resembles
their situation, and back-reference the seam chapters as needed.

**A note on honesty.** Every claim in this book about what Parmana does today is
grounded in the actual reference implementation, and the book distinguishes rigorously
between three things: what is implemented and works, what is implemented but
foundational (present, but not yet production-grade — the in-memory nonce store is the
canonical example, and the reference implementation's own code comments flag it as
such), and what is designed but not yet built (execution-time re-verification of
external conditions, hardened credential brokering, a full connector SDK with
tooling). Where a capability is not production-ready or not built, this book says so in
the same breath as it describes the capability, because an integration guide that
hides the incomplete parts is worse than useless — it is a guide that will fail you at
exactly the moment you have committed. An appendix consolidates the status of every
capability discussed. Read it before you scope your project.

---

## Annotated Table of Contents

### Part I — The Two Seams

**Chapter 1. Where Parmana Touches Your World.**
Establishes the integration mental model. Parmana sits between two kinds of external
system: the proposing systems that generate actions (the AI, the agent, the
automation) and the executing systems that carry actions out (the payment rail, the
ERP, the deployment pipeline). Integration is the work of connecting to both seams
correctly. The chapter defines each seam, states what crosses it, and establishes the
one non-negotiable rule that shapes every integration decision that follows: the
executing system must be reachable only through the verified path.

**Chapter 2. What Crosses the Seam: The Authorized Action.**
The artifact that flows from Parmana to the executing system — the Signed Execution
Authorization and the exact content it authorizes. Walks the real fields an integrator
will handle: the executable content (businessTransactionId, action, target,
parameters), the authorization payload, the signature and key identifier. Establishes
what the integrator must never do (mutate the content between verification and
execution) and why the content is delivered frozen.

**Chapter 3. Trust Nobody: The Verification Contract.**
The core promise that makes integration safe — the executing system verifies the
authorization itself, against public keys, trusting neither Parmana nor the proposing
system. Introduces the verification sequence at a high level (the detail is in Part
II) and establishes why this "trust nobody" property is what lets an enterprise
integrate an autonomous system's actions without extending trust to the autonomous
system.

### Part II — The Executing Seam

**Chapter 4. Receiving an Authorized Action.**
How an enterprise system takes delivery of an authorized action. The two integration
styles the reference implementation supports: verify-in-your-own-service (you hold the
verifier and check the authorization inline) and verify-at-the-gateway (Parmana's
gateway verifies and forwards). Shows the real `Connector` interface and what
implementing it requires.

**Chapter 5. The Verification Sequence, Exactly.**
The precise, ordered checks the receiving side performs, reproduced from the reference
implementation: version, signature, expiry, TTL policy, and — at the gateway — the
content-hash recompute, with the single-use nonce consumed last and only on full
success. Explains why each check exists, why the order is what it is, and why a forged
request must never consume a nonce. This is the most important chapter for anyone
implementing the receiving side.

**Chapter 6. The Nonce Store You Must Provide.**
The one contract the receiving side must implement itself: the nonce store that
enforces single-use. Shows the real interface (an atomic check-and-record), explains
the honest and explicitly-documented limitation of the in-memory implementation (state
lost on restart; a restarted process will accept a replay still within its TTL), and
specifies what a production nonce store must guarantee and how the short TTL bounds the
persistence window.

**Chapter 7. Integrating a System You Don't Control.**
The hard case: an executing system you cannot modify — a SaaS API, a legacy mainframe,
a third-party rail. How to place verification in front of a system that cannot verify
for itself, using the connector pattern, and the honest limits of doing so (the
verification is only as strong as the mediation; a system reachable by other paths is
only partly governed).

### Part III — The Proposing Seam

**Chapter 8. From Proposed Action to Signed Authorization.**
How the proposing side connects: an AI or automation submits a proposed action, the
runtime evaluates it against policy, and — if permitted — mints the signed
authorization. Walks the path from a business transaction to a Signed Execution
Authorization, and what the proposing system must supply (the intent, the parameters,
the policy reference) and must not supply (its own verdict).

**Chapter 9. Policy as the Integration Boundary.**
Policy is where the enterprise's rules meet the integration. How policies are written,
versioned, and referenced; how the policy that authorized an action is bound into the
authorization (policyName, policyVersion) so the decision is reconstructable; and how
the eight reference policies illustrate real integration shapes (refunds, payments,
deployments, access, tool calls).

**Chapter 10. Credentials and the Executing System's Trust.**
How the executing system authenticates that a call is legitimately from the verified
path, and how credentials to the executing system are handled. States clearly what the
reference implementation provides today (a foundational, in-memory credential and
connector-authentication layer) versus the designed direction (brokered, per-action,
never-held-by-the-proposer credentials), so an integrator knows which guarantees to
rely on now and which to plan for.

### Part IV — Operational Reality

**Chapter 11. What Must Be True in Production.**
The consolidated production checklist: a persistent nonce store, key custody harder
than a file, the mediated path actually enforced at the network level, monitoring for
rejected authorizations. Separates what the reference implementation gives you from
what your deployment must add, with no softening.

**Chapter 12. Failure, Rejection, and What the Integrator Sees.**
Every way verification can fail and what the integrator receives when it does — the
named checks, the hash mismatch detail, the rejection responses — and how to handle
each without weakening the guarantee (never fail open; a rejected action is
re-proposed, not forced through).

**Chapter 13. Evidence and the Audit Path.**
How the integration produces the durable record — the append-only, hash-bound evidence
of what was authorized and executed — and how an integrator connects that record to
existing audit and compliance systems.

### Part V — Integration Archetypes

**Chapter 14. Archetype: The Modern HTTP Service.**
End to end, the easiest case: an internal service with an HTTP endpoint you control.
Uses the reference HTTP connector and the verification middleware. The template every
other integration adapts.

**Chapter 15. Archetype: The Legacy System Behind a Gateway.**
End to end, the hard case: a system you cannot modify, mediated by a connector that
verifies on its behalf, with the honest accounting of what is and isn't guaranteed.

**Chapter 16. Archetype: The Regulated Financial Action.**
End to end, the high-stakes case: a payment or trade where the evidence, the policy
versioning, and the audit path matter as much as the execution, and where the honest
ceilings (world-state timing, override handling) must be understood and planned
around.

### Back Matter

**Appendix A. The Integration Interfaces** — the real interfaces, collected for
reference.

**Appendix B. Production Readiness Checklist** — consolidated, with implemented vs.
deployment-supplied vs. designed status for every item.

**Appendix C. Capability Status** — what is implemented, what is foundational, what
is designed-not-built, as of the reference implementation this book is grounded in.

---

## Part I — The Two Seams

### Chapter 1. Where Parmana Touches Your World

Every integration guide is really a map of seams — the specific places where the thing
you are integrating meets the systems you already have. Get the map wrong and you will
spend weeks connecting to the wrong places, discovering the real seams only when
something fails in a way the documentation didn't predict. So before a single
interface, before any code, this chapter draws the map. It is a simple map — there are
only two seams — but everything in this book hangs on seeing them clearly and never
confusing them.

Parmana sits in one specific place in your architecture: the gap between where an
action is decided and where it is carried out. On one side of Parmana are the
systems that propose actions — an AI agent, an automation, any process that decides
something should happen. On the other side are the systems that execute actions — a
payment rail, an ERP, a deployment pipeline, a database, any system that makes the
thing actually happen in the world. Parmana's whole job is to stand between them: to
take a proposed action from the first kind of system, decide whether it is permitted,
and — only if it is — produce a proof that lets the second kind of system carry it out
with confidence that it was authorized.

That gives you exactly two seams to integrate, and they are not symmetric. They
involve different systems, different directions of data flow, different obligations,
and different code. Confusing them is the most common early mistake, so we name them
carefully and keep them separate for the rest of the book.

**The proposing seam.** The proposing seam is where the systems that generate actions
connect to Parmana. This is the AI's side, the agent's side, the automation's side —
whatever process in your architecture decides that an action should occur. Across this
seam flows a proposal: a description of an action someone wants to take. "Refund
customer C-123 five thousand rupees." "Deploy build 4021 to production." "Grant this
service read access to that dataset." The proposing system says what it wants to do;
it does not say whether it is allowed, and — this is the first rule of the proposing
seam — it must not be trusted to say whether it is allowed. The proposing system
proposes. Parmana decides. The separation is the entire point: the system that wants
the action is structurally not the system that authorizes it.

What crosses the proposing seam, then, is intent — an action a system would like to
take — flowing into Parmana. What comes back, when the action is permitted, is a
signed authorization: a proof that this specific action was evaluated against the
enterprise's rules and permitted. When the action is not permitted, what comes back is
a refusal, and nothing executes. Integrating the proposing seam is the work of
Part III: connecting your proposing systems so their actions flow through Parmana's
policy evaluation rather than around it.

**The executing seam.** The executing seam is where the systems that carry out
actions connect to Parmana. This is the payment rail's side, the ERP's side, the
deployment pipeline's side — whatever systems in your architecture actually make
things happen. Across this seam flows an authorized action: the signed authorization
Parmana produced, together with the exact content of the action it authorizes, flowing
out to the system that will execute it. The executing system receives this, verifies
it, and — only if verification passes — carries out the action.

The executing seam has a property that is the technical heart of this entire book, and
it is worth stating now even though its full development waits for Part II: the
executing system verifies the authorization itself, and in doing so, trusts no one.
It does not trust the proposing system that wanted the action. It does not even trust
Parmana that authorized it. It checks the authorization against public keys and
arithmetic it can run itself, and it proceeds only if the math holds. This is what
makes it safe for an enterprise to let autonomous systems drive real execution: the
executing system never has to extend trust to the autonomous proposer, because it never
has to trust anyone — it verifies. Integrating the executing seam is the work of
Part II: giving your executing systems the ability to receive an authorized action,
verify it independently, and execute only what passes.

**The rule that shapes every decision.** There is one rule that governs both seams
and every integration choice in this book, and it is worth fixing before anything
else, because a great many integration mistakes are really violations of this one rule
wearing different disguises:

> The executing system must be reachable only through the verified path.

Consider what the executing seam actually guarantees: an executing system that
verifies before it acts will refuse any action that lacks a valid authorization. That
is a strong guarantee — but only for actions that arrive at the verified entry point.
If the executing system can also be reached some other way — a standing credential the
proposing system still holds, a network path that skips the verifier, a legacy
interface no one migrated — then the autonomous proposer can simply take the other
path, and the entire apparatus of authorization and verification governs nothing,
because the action never went near it.

This is the difference between a system that is instructed to go through Parmana and
a system that is structurally unable to act any other way. The first is a policy
that holds until someone, or some agent, finds the way around it. The second is an
architecture. Real integration — the kind this book is about — aims at the second: not
"the AI is supposed to call the executing system through Parmana," but "the executing
system will not act on anything that did not come through the verified path, and there
is no other path." Every time this book discusses a connector, a credential, a network
placement, it is ultimately in service of this rule. An integration that gets every
interface right but leaves an unverified path to the executing system has not
integrated Parmana; it has installed it next to an open door.

Honesty requires the immediate corollary: closing every unverified path is deployment
work, and it is your work, not something an interface hands you. The reference
implementation gives you the verified path — the ability for an executing system to
receive and check an authorized action. It cannot, by itself, guarantee that no other
path to your executing systems exists; that depends on your credentials, your network,
your legacy surface. This book will be explicit, at every seam, about where the
provided guarantee ends and where your deployment work begins. The rule is stated now
so that you read every later chapter with it in mind: the interfaces make the verified
path possible; making it the only path is the integration.

**What integration is, and is not.** With the two seams and the one rule in hand, we
can state precisely what integrating Parmana is, and — just as usefully — what it is
not.

Integrating Parmana is: connecting your proposing systems so their actions flow into
policy evaluation rather than directly to execution (the proposing seam); giving your
executing systems the ability to independently verify an authorized action before they
act (the executing seam); and ensuring, through credentials and network placement, that
the verified path is the only path to execution (the rule). Do these three things and
you have integrated Parmana: autonomous systems propose, the enterprise's rules decide,
executing systems verify and carry out only what was authorized, and every step leaves
a provable record.

Integrating Parmana is not: making your AI better, safer, or more aligned — that is
valuable work, but it is not this work, and this integration neither requires it nor
provides it. It is not installing a monitoring layer that watches what your systems do
and warns you — Parmana does not observe and report, it authorizes and proves. It is
not a matter of dropping in a library and being done, because the executing seam
requires your executing systems to verify (Part II), the proposing seam requires your
proposing systems to route through policy (Part III), and the rule requires deployment
work only you can do (Part IV). Anyone who tells you an authorization layer integrates
without touching both the proposing and executing sides is describing a monitoring
tool, not an enforcement one — and the difference between watching and enforcing is the
difference between a record and a proof, which is the whole reason to adopt this pattern
at all.

**The shape of the rest of the book.** The map is now drawn, and the rest of the book
fills it in. Chapter 2 examines exactly what crosses the executing seam — the
authorized action, field by field, as an integrator will actually handle it — and
Chapter 3 develops the "trust nobody" property that makes the executing seam safe.
Those three chapters complete Part I: the mental model.

Then the manual begins. Part II is the executing seam in full detail — how a system
receives an authorized action, the exact verification sequence it performs, the nonce
store it must supply, and how to handle a system you cannot modify. Part III is the
proposing seam — how proposed actions become signed authorizations, how policy is the
integration boundary, and how credentials to the executing systems are handled. Part IV
is the operational reality that separates a demo from a production deployment — the
persistent nonce store, the key custody, the failure handling, the evidence path —
stated as a checklist with no softening of what your deployment must add. And Part V
walks three complete integrations end to end: the easy modern service, the hard legacy
system, and the high-stakes regulated financial action.

Throughout, the two seams stay separate and the one rule stays in view. If at any point
an integration decision feels ambiguous, return here: ask which seam you are on, ask
what crosses it, and ask whether the verified path is the only path. Most integration
confusion dissolves under those three questions, because most integration confusion is
really the loss of this map. Keep the map, and the interfaces in the chapters ahead
have an obvious place to go.

---

### Chapter 2. What Crosses the Seam: The Authorized Action

Chapter 1 named what flows across the executing seam — an authorized action — without
saying what one actually looks like. That was deliberate: you needed the map before
the artifact. Now you need the artifact, because everything in Part II is about
receiving, verifying, and executing this one thing, and an integrator who has not
looked closely at its shape will mishandle it in ways that are easy to make and hard to
notice. This chapter looks closely.

An authorized action, as it actually arrives at an executing system, is two things
traveling together: the **content** — what is to be done — and the
**authorization** — the proof that Parmana permitted it. They are separable in the
type system and inseparable in practice, because the entire point of the artifact is
that the authorization is a statement about _this specific content_ and no other. Take
them in turn.

**The content: ExecutableContent.** What an executing system is actually asked to do
is a narrow, four-field shape:

```typescript
export interface ExecutableContent {
  readonly businessTransactionId: string;
  readonly action: string;
  readonly target: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}
```

`businessTransactionId` ties this content back to the business transaction that
originated it — the same identifier a proposing system used when it submitted the
proposal in Chapter 8. `action` and `target` name the operation and what it operates
on — `"payments:refund"` against a customer account, `"deploy"` against a production
environment, `"http:post"` against an endpoint. `parameters` carries whatever the
action needs — an amount, a build number, a payload — as an opaque record Parmana does
not interpret.

Notice what is _not_ here. A `BusinessTransaction` inside Parmana carries a great deal
more: an `Authority`, an `Authorization`, an `Intent`, a `PolicyReference`, runtime
`signals`, a lifecycle `status`, a `createdAt`. None of that crosses the executing
seam. `ExecutableContent` is deliberately narrower than the full trust chain that
produced it, for two reasons that matter to an integrator. First, an executing system
does not need the trust chain to execute — it needs to know what to do, and the
authorization (below) is the proof that the trust chain already ran and approved it.
Second, and more subtly, binding the authorization to a narrow, stable shape avoids
depending on fields that are not stable across the signing and verification boundary —
a `status`, for instance, can be defaulted after signing but before other artifacts are
built, and a hash bound to a field like that would be fragile in ways that have nothing
to do with security and everything to do with sequencing bugs. The four fields above
are exactly what an execution system executes, and exactly what the authorization
below is a proof about. Nothing more crosses the seam because nothing more needs to.

**The authorization payload.** The proof itself is a signed payload with its own
fields, each pulling weight:

```typescript
export interface ExecutionAuthorizationPayload {
  readonly version: 1;
  readonly authorizationId: string;
  readonly nonce: string;
  readonly decisionId: string;
  readonly businessTransactionId: string;
  readonly policyName: string;
  readonly policyVersion: string;
  readonly authorizedAt: string;
  readonly expiresAt: string;
  readonly businessTransactionHash: string;
}
```

`version` is the payload format version, and it exists so that a future format change
is a deliberate, versioned break rather than a silent one — a verifier that sees
anything other than `1`, including a missing field, must reject before it even attempts
signature verification. `authorizationId` is this authorization's own identity, and
`decisionId` points back to the specific policy decision that produced it, which
matters when Chapter 13 discusses reconstructing, after the fact, exactly why an action
was permitted. `businessTransactionId` duplicates the identifier from the content, so
an executing system can match authorization to content without first trusting either
one. `policyName` and `policyVersion` record which policy, at which version, produced
this authorization — the subject of Chapter 9, and the reason a policy change six
months from now cannot retroactively change what an old authorization meant.
`authorizedAt` and `expiresAt` bound the authorization's lifetime; every timestamp in
this payload is an ISO-8601 UTC string rather than a language-native date type, and
that choice is not cosmetic — it is what lets the artifact serialize identically on the
signing side and the verifying side, which is the only way a signature over its
canonical serialization can mean anything at all.

Then there is `businessTransactionHash`, the field that does the most quiet work in
the entire artifact. It is the canonical content hash of the `ExecutableContent` —
computed, on the signing side, from the runtime's in-memory transaction, and
recomputed, on the verifying side, from the exact JSON-parsed content about to be
executed, using the same hasher on both ends. This is what closes a gap that an
authorization naming only an ID cannot close: if an authorization said only "execute
whatever is filed under transaction `tx-001`," nothing would stop a _different_
payload — a changed amount, a changed target — from being substituted under that same
ID between the moment of authorization and the moment of execution. A gateway that
recomputes the hash of the content it is about to forward, and rejects any mismatch
against the signed `businessTransactionHash`, closes exactly that gap. This is a real,
implemented mechanism in the reference implementation, not aspirational — Chapter 5
walks the exact point in the verification sequence where the recompute-and-compare
happens, and why it must run before the nonce is ever consumed.

**The envelope.** The payload above is wrapped in one more layer — the part that
actually makes it a proof rather than an assertion:

```typescript
export interface SignedExecutionAuthorization {
  readonly payload: ExecutionAuthorizationPayload;
  readonly signature: string;
  readonly keyId: string;
  readonly algorithm: string;
}
```

`signature` is computed over the canonical serialization of the payload — every field
in the payload participates, which is why the ISO-8601-string discipline above matters
so much; a signature is only as trustworthy as the guarantee that both sides compute
the same bytes. `keyId` tells the verifier which public key to check the signature
against, so key rotation (Chapter 11) doesn't require every verifier to guess. And
`algorithm` names the signature scheme — the reference implementation uses a
post-quantum scheme (ML-DSA-65) by default, which carries one practical consequence an
integrator should know before writing tooling around this artifact: the signature is
_randomized_, not deterministic. Signing the identical payload twice with the identical
key produces two different, both-valid signatures. Verification is deterministic;
signing is not. If you are tempted to deduplicate authorizations by comparing
signature bytes, or to write a test that asserts a specific signature value, this is
the paragraph that saves you the debugging session.

**What the integrator must never do.** Put the content and the envelope together and
one rule falls out immediately: once content has been verified against an
authorization, it must not be mutated before it is executed. Not reformatted, not
"normalized," not passed through a step that reasonably seems harmless. The reason is
not merely stylistic. The `businessTransactionHash` was computed over one exact
serialization of one exact content object; the moment executing code touches that
object, it no longer has any guarantee that what it eventually executes is what was
verified. The failure mode is not necessarily an attack — it is just as often a
well-meaning transformation, a library that "helpfully" reorders object keys, a
debugging shim that clones and reshapes a payload for logging. All of these silently
reopen the check-vs-use gap that the content hash exists to close.

The reference implementation does not leave this to discipline alone. The content
handed to a connector is **deep-frozen** — not merely `Object.freeze`, which only
locks the top level and leaves nested objects (like `parameters`) mutable, but a
recursive freeze applied the moment verification passes, before the content is ever
handed onward. A connector that tries to mutate a field of the content it received
does not get a subtly wrong execution; it gets a thrown `TypeError`, immediately, at
the point of the attempted write. This is a deliberate design choice worth naming
explicitly: the system prefers a loud failure at the mutation site over a quiet
divergence between what was authorized and what was executed. Downstream code that
needs a request shape reads fields straight off the frozen content — copying, never
reconstructing — for exactly this reason: a connector request builder that copies
`businessTransactionId`, `action`, `target`, and `parameters` directly off the verified
object cannot introduce a second, drifted copy of any of them, because there is only
ever the one.

Freezing is a safety net, not the guarantee itself — the guarantee is the hash
comparison in Chapter 5, which would catch a substituted payload with or without the
freeze. But a safety net that turns an entire class of accidental bugs into an
immediate, obvious exception, rather than a silent execution of the wrong thing, is
worth having, and worth knowing about before you write your first connector.

**What this sets up.** You now have the artifact: content that says what to do,
wrapped in a payload that says who approved it, under what policy, until when, bound
by hash to this exact content and nothing else, signed and keyed so any holder can
verify — and delivered frozen, so the executing side's own code cannot undermine the
guarantee by accident. What you do not yet have is _why_ an executing system can trust
this artifact without trusting Parmana or the proposing system that wanted the action
in the first place. That is the "trust nobody" property named in Chapter 1, and it is
the whole subject of Chapter 3.

---

_[RESUME POINT: Chapter 3 — "Trust Nobody: The Verification Contract." Chapters 1 and
2 complete at full publishable depth, grounded against repository HEAD `4740aee`. Both
`packages/execution-gateway/src/Connector.ts` (gateway-level, receives
`{ transaction, authorization, verification }`) and the newer
`packages/connector-sdk` (SDK-level `Connector`, receives a flattened
`ConnectorRequest { capability, businessTransactionId, action, target, parameters }`
plus a `ConnectorExecutionContext` carrying an already-resolved `CredentialHandle`)
coexist — the SDK sits downstream of the gateway's verification and never
re-derives content. This is directly relevant to Chapter 4 (two Connector shapes to
present) and Chapter 10 (credential brokering has a real, if foundational,
implementation now via `CredentialProvider`/`CredentialVaultAdapter` — verify their
actual maturity before writing Chapter 10, since the front matter's
"designed-not-built" framing for credentials may need updating). Also load-bearing for
later chapters: `docs/site/concepts/content-binding-toctou.mdx` confirms the
verification order (version → signature → expiry → TTL → businessTransactionHash
recompute-and-compare → nonce last) and states plainly that the default local API
server (`packages/api/src/application.ts`) does NOT wire an `ExecutionGateway` by
default — zero enforcement out of the box, a fact Chapter 4 and Chapter 11 must state
without softening.]_
