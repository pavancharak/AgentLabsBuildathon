# Latency & Voice-AI Readiness Investigation — 2026-08-10

_Investigation session. Snapshot: 2026-08-10, `main` @ `d04ba88`. One source
change from this documentation pass: `fly.toml`'s stale `primary_region`
corrected to match the app's actual deployed region (see §3 and the closing
config note). The Postgres pool fix described in §Finding 1 was implemented
and tested earlier the same day, as a working-tree change at the time of
writing; it lands in the same commit as this document per this repo's
"one session, one commit" convention._

---

## Trigger

Evaluating whether Parmana could serve a voice-AI integration — a caller
authorizing an action by voice, with the authorization round-trip needing to
stay well under 300-500ms end-to-end for the interaction to feel
conversational rather than laggy. That budget is much tighter than anything
Parmana's existing use cases (API-to-API authorization checks, refusals,
receipts, connector execution) have ever needed to hit, since none of them
are latency-sensitive in a human-perceptible, real-time sense. This
investigation exists to find out how far off that budget Parmana's current
deployment shape is, and why.

---

## Findings, in the order investigated

### 1. Cold Postgres connections (no minimum pool size) — FIXED

**What was measured:** interleaved curl A/B testing and Globalping runs
against `parmana-api.fly.dev` showed that routes gated by
`middleware/caller-auth.ts` (which awaits an audit write on every request,
see Finding 2) cost consistently **0.4–1.1s more** than the auth-exempt
`/health` baseline, on both accepted and rejected requests alike — a pattern
inconsistent with app-level processing and consistent with a connection
being re-established from cold on the audit-database side of the request.

**Root cause:** `PostgresPoolFactory.create()` (`packages/storage/src/
postgres/PostgresPoolFactory.ts`) constructed a `pg` `Pool` with no `min`
option, so it defaulted to `min: 0`. At the request volumes this
investigation was run against, the pool's one idle connection was
consistently closed by `idleTimeoutMillis` (10s, `pg`'s default) between
requests, so nearly every caller-auth-gated request re-paid a full
TCP+TLS handshake to Postgres before its audit `INSERT` could even run.

**Fix:** `PostgresPoolFactory.create()` now passes `min: 1` and
`keepAlive: true`, and issues a best-effort priming `connect()` +
`release()` immediately at pool creation rather than waiting for the first
real request to pay that cost.

**Evidence:**

- `packages/storage/src/postgres/PostgresPoolFactory.ts` — the fix itself, with the reasoning recorded in the file's own header comment
- `packages/storage/tests/unit/postgres-pool-factory.test.ts` — 5 tests, confirmed passing this session (`min`/`keepAlive` options are actually passed to `Pool`; the pool is a process-wide singleton; the priming connect+release happens; a priming failure doesn't throw or block the factory)

**What this claim does and doesn't cover:** the fix eliminates the specific
cost of a _cold connection setup_ — confirmed by the code path and unit
tests, not by a fresh live re-measurement against the deployed app as part
of this documentation pass. It does not, and was never intended to, remove
the audit write itself from the request's critical path (see Finding 2) —
once the connection is warm, the `INSERT` still has to complete before the
response does. This working-tree change had not been committed to git as of
this writing; whether it is already running on `parmana-api.fly.dev`
(possible, since a `fly deploy` from a dirty working tree ships whatever is
on disk, not just what's committed) is unconfirmed by this documentation
pass and should be checked before treating the 0.4–1.1s figure above as
resolved in production.

---

### 2. Synchronous audit-write in caller-auth middleware — NOT a bug

**What was investigated:** whether the `await` on `CallerAuditSink.record()`
inside `middleware/caller-auth.ts`, which blocks the response on every
single request (accepted or rejected) until the audit write completes,
should be changed to fire-and-forget to cut latency.

**Finding:** this is not incidental — it's documented, deliberate design,
already covered by `docs/CLAIMS.md` §2.19 ("Fail-Closed
Caller-Authentication Audit Writes"): _"A caller-authentication event
(accepted or rejected) that fails to be recorded fails the request... This
is a deliberate design decision (an action that executes without an audit
record contradicts independently verifiable execution), not an incidental
side effect; the availability cost is accepted."_

**Why fire-and-forget was rejected as a latency fix:** making the audit
write asynchronous would mean a request could be authorized (or
rejected) and return to the caller _before_ Parmana knows whether that
decision was durably recorded. If the write then failed, there would be no
mechanism to retroactively fail a response that had already gone out — the
core guarantee §2.19 exists to provide (every authorization decision is
provably auditable, or the request never succeeds) would be silently
broken for exactly the failure case it exists to catch. This investigation
did not find, and did not go looking for, a reason to revisit that
trade-off — it's treated here as settled prior art, not re-litigated.

**Evidence:**

- `docs/CLAIMS.md` §2.19
- `packages/api/src/middleware/caller-auth.ts` (`recordOrFailClosed`)
- `packages/api/tests/unit/middleware/caller-auth.test.ts`

---

### 3. Audit database (Sydney) vs. app region (London) mismatch — CONFIRMED, accidental

**What was measured:** direct network measurement this session between the
app's deployed region and the audit database's region showed a **~267ms
round-trip** floor, present on every caller-auth-gated request regardless
of anything else — a physical-distance cost, not a code or connection-pool
issue, and not fixable by anything in Finding 1.

**Confirmed region mismatch:**

- App: `flyctl status -a parmana-api` (this session) shows both running
  machines in `lhr` (London). `flyctl regions list -a parmana-api` confirms
  `lhr` as the only configured region.
- Audit database: `docs/operations/phase2a-deployment-verification.md`
  (an earlier, independent session) records the Supabase project backing
  `DATABASE_URL` — `REDACTED-PROJECT-REF`, "REDACTED-PROJECT-NAME" — as
  provisioned in region `ap-southeast-2` (Sydney), confirmed via
  `supabase projects list` and cross-checked against the `DATABASE_URL`
  hostname in `.env`.

**This is accidental infrastructure drift, not a deliberate placement
decision.** Nothing in `docs/CLAIMS.md`, the Phase 2A verification records,
or anywhere else found during this investigation documents a reason the
audit database should be in Sydney while the app runs in London — no
compliance, data-residency, or cost rationale is on record anywhere. The
most likely explanation is that the Supabase project was provisioned with
whatever region was default or convenient at creation time
(2026-06-17, per the same Phase 2A record), independent of where the Fly
app would later end up running. This session did not attempt to relocate
either resource — a live audit database, in a non-production but
real-data environment, is not something to move without a deliberate
migration plan, which is out of scope for a documentation pass.

**Evidence:**

- `docs/operations/phase2a-deployment-verification.md` (Supabase project region)
- `flyctl status -a parmana-api`, `flyctl regions list -a parmana-api` (this session, app region)
- Direct network round-trip measurement, this session (~267ms, London↔Sydney)

---

### 4. Fly anycast edge relay — CONFIRMED via sustained sampling

**What was measured:** every response from `parmana-api.fly.dev` carries
`via: 1.1 fly.io` (one hop) or `via: 1.1 fly.io, 1.1 fly.io` (two hops).
Two hops means the request landed at a Fly anycast edge point-of-presence
other than `lhr` (where the app's machines actually run) and had to be
internally relayed. A first pass of point-in-time Globalping checks (GB/SG)
didn't reproduce a consistent 0.4-0.5s baseline, so this was re-run as a
**sustained sample**: 12 rounds, ~2 minutes apart, over ~23 minutes,
against `/health` (an auth-exempt, database-free route, isolating this
specific cost from Findings 1–3 entirely), from Globalping probes physically
located in GB and SG.

**Results:**

| Probe → edge reached         | Fraction of requests | Mean total latency |
| ---------------------------- | -------------------- | ------------------ |
| GB → `lhr` (direct, 1 hop)   | 4/12 (33%)           | 126ms              |
| GB → `ams` (relayed, 2 hops) | 8/12 (67%)           | 240ms              |
| SG → `sin` (relayed, 2 hops) | 12/12 (100%)         | 388ms (max 827ms)  |

The relay is not an occasional fluke for either probe location — it's the
majority path for GB (67%) and the _only_ observed path for SG (100% over
12 consecutive rounds) — and it roughly doubles GB's latency when it
occurs, while dominating SG's number entirely.

**Root cause:** the app runs in exactly one Fly region (`lhr`). Fly's
anycast network routes an inbound connection to whichever edge
point-of-presence a client's ISP's BGP path favors, which is a function of
network topology, not application configuration — a client whose nearest
practical edge isn't `lhr` pays an internal relay hop to reach the region
where the app machines actually live. This is documented, known Fly
platform behavior (Fly community forum threads describe the same pattern —
e.g. residential ISP traffic routed to a distant edge before reaching the
app's real region, adding on the order of 100–150ms), not a Parmana-specific
misconfiguration.

**Why a dedicated IPv4 was ruled out without spending the $2/mo to test
it:** the mechanism above is anycast edge _selection_, driven by the
client's network path to Fly's announced IP block — it is the same
mechanism regardless of whether that IP is shared among multiple Fly
apps or dedicated to this one. Fly's dedicated-IPv4 offering does not, per
its own documentation and community discussion, pin a client to a specific
region; it changes address ownership, not anycast routing behavior. A
dedicated IPv4 would not change which edge a given client's ISP routes to,
and therefore would not remove the relay hop. (This app already holds a
dedicated IPv6 alongside its shared IPv4, for unrelated reasons predating
this investigation — that dedicated address showed the identical two-hop
pattern in earlier ad hoc testing, which is consistent with, though not
sufficient on its own to fully prove, this reasoning.)

**Evidence:**

- Sustained sampling results, this session: 24 data points (12 rounds × GB + SG) via the Globalping HTTP API against `/health`, correlating `via` hop count, `fly-request-id` edge suffix, and total latency per request
- `flyctl ips list -a parmana-api`, `flyctl regions list -a parmana-api` (this session)
- Fly community forum threads on anycast edge selection and ISP BGP routing (referenced for architectural context, not independently re-verified against Parmana's specific traffic)

---

## What's still unmeasured

**No real, fully-authorized `POST /execute` request has been timed
end-to-end.** Every measurement in this investigation used either `/health`
(no auth, no database, no business logic — deliberately, to isolate
Finding 4 from Findings 1–3) or a rejection/unauthenticated call against a
caller-auth-gated route (isolating Finding 1's connection-pool cost, but
still not a full authorize → verify → execute → confirm cycle). This is the
largest remaining unknown in this investigation, not a minor gap: the
actual number a voice-AI integration would experience — full authorization
envelope verification, policy evaluation, the audit write, and (for a
connector-backed action) the downstream connector call — has not been
measured at all. Everything above establishes _components_ of the budget,
not the total.

---

## Comparison point used

`schema.executiongovernance.org`'s discovery endpoint was measured the same
day, from the same GB/SG probe locations, at 130–192ms. This is a useful
reference point for "what a request to a comparable region can cost on
Fly-adjacent infrastructure," but it is not a fair target to hold Parmana's
numbers against directly: that endpoint runs on a single box, no
anycast/multi-region proxy layer, no networked durable audit store — it has
no architectural equivalent to Findings 1–4 to pay for, because it makes
none of the durability or multi-hop-routing guarantees those findings are
the cost of. It's a ceiling on what's achievable with a fundamentally
simpler architecture, not a same-guarantees baseline Parmana is failing to
meet.

---

## Deferred plan (not started)

Deliberately not started this session — this is a non-production
environment, and none of this blocks any currently-shipped capability (see
Scope note below). In order:

1. **Benchmark a real, fully-authorized `POST /execute` request**,
   end-to-end, closing the gap identified in "What's still unmeasured"
   above. Nothing below should be prioritized ahead of actually knowing
   this number.
2. **Add a second Fly region** — default candidate `iad` (US East), reasoning
   being that voice-AI integration platforms are predominantly US-based, so
   `iad` is the more likely candidate to reduce the anycast relay cost
   (Finding 4) for that traffic than adding a region chosen for any other
   reason.
3. **Re-benchmark against the voice-AI latency budget** (well under
   300-500ms) with both changes in place.
4. **Only if still insufficient:** build a durable-local-write-then-
   async-drain architecture for the caller-auth audit write, removing
   Finding 3's Sydney round-trip from the request's critical path
   entirely, mirroring the pattern `RazorpaySettlementProcessor.ts`
   already implements for settlement confirmations — write locally and
   durably first, return to the caller, then drain to the audit store
   out-of-band (`RazorpaySettlementProcessor`'s own header comment:
   _"Out-of-band from the webhook request cycle by design — M4a's 200 has
   already returned by the time this runs"_). This is explicitly the
   _last_ resort in this plan, not the first, because it's the only item
   here that would touch §2.19's fail-closed guarantee and would need its
   own design session to preserve that guarantee's intent under a
   different execution shape, rather than removing it.

---

## Explicit scope note

This entire investigation is specific to the voice-AI vertical's latency
requirement. It does not affect, and should not be read as casting doubt
on, any other already-shipped Parmana capability: authorization checks,
refusals, receipts, the Razorpay and HubSpot connectors, and general API
usage as described elsewhere in `docs/CLAIMS.md` all remain accurately
described exactly as they are today. None of them need sub-second latency
to function correctly — every finding above is about a budget that only a
real-time, human-perceptible interaction (like voice) imposes, not about
correctness, durability, or any other property those existing claims speak
to.
