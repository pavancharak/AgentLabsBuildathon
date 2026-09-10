# Building Parmana: From a Claim We Couldn't Defend to a System That Proves Itself

*A founder's account of taking an AI-execution-security platform from prototype to a live, real-money demonstration — and of what it taught us about building trustworthy software with AI.*

---

## The question that started it

Parmana exists to answer one question that every enterprise deploying AI agents eventually has to face: when an autonomous AI decides to do something — issue a refund, move money, change a record — what stops it from doing the wrong thing, and how do you prove what it did?

Our answer is an authorization layer that sits between the AI's decision and the real system it acts on. The AI proposes an action. A separate layer, holding credentials the AI never sees, checks that action against policy, executes it only if approved, and signs a tamper-proof record of exactly what happened. The AI can be brilliant or compromised; either way, it cannot act outside the policy, and everything it does leaves proof.

That is easy to describe and hard to earn the right to claim. This is the account of how we earned it.

## Starting point: a claim we could not defend

Early on, I did what most founders do: I described what the system would do in the present tense, because I could see the architecture clearly and the pieces mostly existed. But "mostly exists" and "works against a real financial system" are different statements, and conflating them is how technical credibility dies in a due-diligence meeting.

So we adopted a rule that has governed everything since: **no capability is described in the present tense unless it is backed by code and passing tests.** We keep a claims file in the repository, next to the code, and every sentence in it maps to a test that proves it. If the test does not exist, the sentence does not exist.

To find out where we actually stood, we did something uncomfortable. We commissioned an adversarial audit of our own codebase — a review whose explicit job was to *refute* our readiness claim using code and test evidence only, giving no credit for intentions, architecture diagrams, or roadmap.

The first audit rejected the claim. Its verdict was blunt: the connector to the real payment system had never actually touched a live endpoint, the settlement-confirmation layer did not exist, and the highest readiness level the evidence could defend was well below what we had been implying. Our own claims file, held to the same standard, agreed.

That was the honest starting line. Not the story we wanted to tell — the one we could prove.

## How we closed the gap

What followed was roughly three weeks of disciplined, incremental work, and the discipline mattered more than the speed. Every change was scoped small, fully verified, and only then followed by the next. The chain we had to prove has four links, and we proved them one at a time against Razorpay, a real payment gateway operating under Indian financial regulation:

**Authorize.** A deterministic policy engine evaluates each requested action and, only on approval, issues a signed, one-time authorization bound to the exact content of that action.

**Verify.** Before anything runs, that authorization is independently verified and consumed exactly once. A replayed or tampered request is rejected before a single network call is made.

**Execute.** The approved action runs against the real system, using credentials the AI never holds, sees, or transmits.

**Confirm.** The outcome is not taken on faith. When the payment provider reports settlement, we verify the report's cryptographic signature, then independently fetch the outcome from the provider's own API before signing a settlement confirmation. A webhook is a doorbell, not a delivery.

Along the way we proved the properties that matter under adversarial conditions, live rather than in theory: a replayed request rejected with zero downstream calls; an over-policy request denied with zero calls to the payment provider; and a settlement confirmed only after independent verification, never on the provider's word alone.

Then we reran the original audit, word for word. This time it returned a supported verdict — and during the audit run itself, the system created a real refund, rejected a replay, denied an over-limit request, and produced a signed settlement confirmation. The claim was no longer a claim. It was a demonstration.

## From "it works" to "it runs in production"

Proving the chain in a controlled environment was necessary but not sufficient. Software that only works on the builder's machine has not been proven in any sense a partner should care about. So we took the last two steps that separate a working prototype from an operational one.

We deployed the platform to real cloud infrastructure: authenticated APIs on the public internet, durable database-backed storage for authorizations and evidence, configuration that refuses to start if it is incomplete rather than booting in a half-broken state, a readiness check that verifies live storage before accepting traffic, and graceful shutdown. On that deployed instance, a refund ran from authorization to signed settlement evidence in forty-eight seconds, its confirmation closed by a webhook the payment provider delivered to our permanent public endpoint.

Then we did it with real money. A real payment on live payment rails. One rupee refunded through the entire chain on the deployed live instance — deterministic policy approval, a one-time signed authorization, execution with credentials the requesting side never held, a live webhook delivered by the provider's own production servers, independent verification of the outcome, and a signed settlement confirmation. Authorization to evidence: sixty-four seconds.

At that point our claims file reached a state it had never been in: nothing left unproven on that chain. Every sentence, present tense, backed by code and evidence.

## How this was actually built — and why that is the point

Here is the part I want to be direct about, because it is both true and, for a company in our specific business, unusually relevant.

I built this platform largely by directing AI coding agents. I defined the product, wrote the specifications, made the architectural decisions, and reviewed every change — but a great deal of the implementation was produced by AI, working at a speed no small team could match. That is not a confession. It is the most honest demonstration I can offer of the thesis Parmana is built on.

Because the hard part of building with AI agents is not getting them to produce code. It is *not trusting them by default.* An AI agent will write something plausible, claim it works, and move on — exactly the failure mode that makes autonomous AI dangerous in production. The entire method that produced this system was built to counter that: scope each task narrowly, demand that nothing counts as done until tests and evidence back it, and hold the AI's output to an external standard it cannot talk its way around. When the AI claimed a capability, the claims file and the test suite decided whether the claim was true — not the AI's confidence, and not mine.

The adversarial audit was that principle applied to the whole system at once. The claims-file discipline was that principle applied to every sentence. The result is a platform whose own construction is a working proof of what it sells: **AI output is valuable, but it must be verified, not trusted — and the verification has to sit outside the thing being verified.** I did not just build a system that enforces that principle. I used that principle to build the system.

Along the way, the discipline caught real problems that trust would have missed: a configuration flag that would have quietly run the deployed system on the wrong storage, caught by a readiness check before any money moved; capability gaps surfaced by tests failing loudly rather than by incidents in production; and, more than once, the tooling itself refusing to let me overstate a claim until the evidence actually existed in the repository. Each of those is the method working as designed.

## What exists today

Everything below is present tense because it is backed by code, tests, and recorded evidence, and none of it is a projection:

- The full authorize-verify-execute-confirm chain, proven end to end against a real payment gateway, including a real-money refund on live rails settled in about a minute.
- Deployed on public cloud infrastructure, authenticated, with durable evidence storage and fail-closed configuration.
- Deterministic policy enforcement: whether an action executes is decided by rules you write, not by the AI's judgment.
- Credential isolation: the requesting AI never holds the credentials that perform actions, so a compromised agent has nothing to spend.
- Signed, append-only, tamper-evident records for every action, with support for both classical and post-quantum signatures so evidence remains verifiable across the regulatory transition timelines now being set for financial systems.
- Exactly-once execution and replay protection as properties of the storage design, not as heuristics.
- Over five hundred automated tests, an independent adversarial audit on record, and a claims file where every capability maps to its evidence.

## What we do not claim

The same discipline that lets us state the above requires us to state its edges. The live-money demonstration was a single small refund, not sustained volume. The current deployment is provisioned for capability proof, not for high availability or load. And our promise is deliberately precise: no *unauthorized* execution, with proof of everything that ran. An action your policy permits will execute — writing sound policy remains, by design, in human hands. Parmana's job is to make the policy the only thing that decides, and to make everything that happens provable.

## Where this goes next

There is a natural ceiling to what any team can prove alone. We have reached it. The next levels of maturity are, by definition, about operation inside a real institution — real processes, real requirements, real sign-off — and that is not something a founder can manufacture in a repository. It requires a partner.

We are now selecting a small number of design partners in Indian financial services — payments, insurance, and capital markets — to run their first production processes through Parmana. A design partner is not an early customer. A design partner is the co-author of the proof: every level of maturity from here is a milestone reached together, with their name on it.

If your institution has bought AI it is not yet willing to switch on, and wants to be the first to switch it on safely and provably, that is the conversation worth having.

**founder@parmanasystems.com**

---

*Parmana Systems. The authorization layer for AI execution. Every claim in this document maps to code, tests, and recorded evidence maintained alongside the platform.*
