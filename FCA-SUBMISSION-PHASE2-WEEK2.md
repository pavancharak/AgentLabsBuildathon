# Parmana: Authorization Layer for Agentic AI in Regulated Finance
## Evidence Package: Phase 2 Week 2 (Aug 26, 2026)

**A note on framing, before anything else.** This document is titled per the originating
prompt's request ("FCA Submission"), but it has not been through legal or compliance review, and
this session has no authority or expertise to certify that it satisfies the Financial Conduct
Authority's actual requirements for agentic-AI systems in regulated finance. What follows is
accurately an **evidence package** — real architecture, real code citations, real live test
results — assembled honestly from what exists in this repository today. Whether it is
*sufficient* for an actual FCA submission is a determination for Pavan and, before this goes to a
real regulator, qualified legal/compliance counsel. Treat the "Ready for FCA Submission"
question at the end accordingly.

Also note: the source prompt cited two artifacts by name that don't match this repo —
`GITHUB-CALLER-SCOPING-ARCHITECTURE.md` (the real file is `SCOPED-CREDENTIAL-ARCHITECTURE.md`,
commit `c6844bd`) and referred to "Supabase initialized" and "3 live scenarios" generically. This
document cites the real filenames and only the specific evidence actually gathered.

---

### Executive Summary

Parmana is an execution-authorization layer that sits between an AI agent and the external
systems it tries to act on (currently: GitHub, HubSpot). Every action an agent attempts is routed
through a single, mandatory checkpoint: the caller's credential is checked against an explicit,
fail-closed allowlist of capabilities *before* any connector is invoked and *before* policy
evaluation runs. A caller with no capability grant, or the wrong one, is rejected — deterministically,
with no code path that lets a client-supplied field override the check. Every action that does
execute produces a cryptographically signed record (ed25519) covering who requested it, what was
requested, what was decided, and what happened. FCA should care because this is a structural claim,
not a policy claim: the boundary does not depend on the agent's own code behaving correctly, and the
resulting evidence is independently verifiable without trusting Parmana's own say-so after the fact.

---

### 1. Authorization: Hard Boundaries

**Mechanism.** Each API caller is configured with an explicit `allowedCapabilities: string[]`
(`ApiKeyEntry.allowedCapabilities`, `packages/shared/src/config/ApiKeyEntry.ts:71`). The check —
`isCapabilityAllowed()`, `packages/api/src/auth/isCapabilityAllowed.ts` — is a pure, four-line,
stateless function:

```typescript
export function isCapabilityAllowed(
  action: string | undefined,
  allowedCapabilities: readonly string[] | undefined,
): boolean {
  if (!action) return false;
  if (!allowedCapabilities || allowedCapabilities.length === 0) return false;
  if (allowedCapabilities.includes("*")) return true;
  return allowedCapabilities.includes(action);
}
```

It is called from the route handler (`packages/api/src/routes/execute.ts`) before
`application.execute()` — i.e., before the connector registry, before `PolicyEngine.evaluate()`
ever run. Default is fail-closed: an unset or empty list denies every capability. The field being
checked (`intent.action`) is the same field the connector registry and policy engine key on
downstream — there is no separate client-asserted "scope" field a caller could forge instead.

**Live evidence (Scenario 2, from `GITHUB-CALLER-SCOPING-PHASE2-WEEK2-RESULTS.md`, commit
`9993940`).** A caller scoped only to `github:pr-fetch` attempted `github:pr-merge` against a real
pull request on `parmana-api.fly.dev`:

```
POST https://parmana-api.fly.dev/execute
Authorization: Bearer fca-fetch-only-...
→ HTTP 403
{"error":"Caller is not permitted to invoke this capability.","code":"CAPABILITY_NOT_ALLOWED"}
```

The request never reached the GitHub connector — no credential-mint exchange, no call to GitHub's
API. Scenario 3 (same repo/commit) repeated the same attempt with every policy signal set to the
value that would make the request maximally *policy*-favorable, and got the identical rejection —
demonstrating the boundary's outcome does not depend on anything the caller controls in the
request body, only on the credential's own configured grant.

**Why this matters for post-compromise protection.** If an agent's own reasoning or code is
manipulated into deciding a merge is justified, it has no lever to make that decision succeed —
the capability grant lives outside the agent's control, on the credential, checked server-side,
before any of the agent's assertions are evaluated.

---

### 2. Authenticity: Signed Audit Trails

**What gets signed.** Every execution that completes produces an `ExecutionTrustApplication`
record with an ed25519 `chainSignature` over the execution (action, target, decision, evidence,
timestamps) and a separate ed25519-signed `receipt`. From Scenario 1's live response (same commit):

```json
{
  "trustRecordId": "2f1321b1-021f-4e95-8179-7eb7c282de3a",
  "executions": [{
    "status": "COMPLETED",
    "decision": { "outcome": "APPROVED" },
    "evidence": { "action": "github:pr-fetch", "success": true },
    "chainSignature": { "algorithm": "ed25519", "value": "H90RG..." }
  }],
  "receipts": [{ "algorithm": "ed25519", "signature": "lwEdz..." }]
}
```

**Independent verifiability.** The signature is over the record content, keyed to a named signing
key (`keyId: "default"`); verifying it requires only the public key and the record — not access to
Parmana's own systems, and not trust in Parmana's own after-the-fact account of what happened.
This repository ships a dedicated `/verify` route (`packages/api/src/routes/verify.ts`) and a
`verify-get`/`refusal-verify` pair for the same purpose on rejected/refused transactions.

**Caveat, stated plainly:** this session confirmed the signature *fields exist and are populated*
in a real response; it did not independently re-verify the signature bytes against the public key
using a separate tool outside Parmana (e.g., a standalone `parmana-sign --verify` run), because no
such standalone verification was exercised in this session. That is a real, distinct next step
before claiming "independently verified" rather than "designed to be independently verifiable."

---

### 3. Accountability: Complete Records

**What gets logged.** Every request — success or rejection — is either an
`ExecutionTrustApplication` (successful executions, Scenario 1) or a caller-audit event
(`caller.capability_denied` for Scenarios 2/3, recorded via `CallerAuditSink`,
`packages/api/src/auth/recordCallerAuditEvent.ts`) with caller id, capability requested, and
timestamp — explicitly confirmed (per `SCOPED-CREDENTIAL-ARCHITECTURE.md`) to never contain the
raw API key.

**Storage.** Backed by Supabase in production (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
present as deployed Fly secrets on `parmana-api`, confirmed this session via `flyctl secrets
list` — presence/deploy status only, values not read).

**Fault-line clarity.** For any given request, the record shows: what the caller's credential was
scoped to, what action was requested, whether it was rejected at the scope boundary or proceeded
to policy evaluation, and — if it proceeded — what the policy decision and connector result were.
There is no code path in which an out-of-scope action executes without record; the rejection
itself is the record.

---

### 4. Technical Architecture (Appendix A)

**Enforcement pipeline (production, app-wide, not connector-specific):**

```
Request → Bearer-token authentication (StaticKeyAuthenticator, SHA-256 hash, timing-safe compare)
        → isCapabilityAllowed(intent.action, caller.allowedCapabilities)   [FAIL-CLOSED]
        → PolicyEngine.evaluate()   [caller-agnostic by design]
        → Connector dispatch (credential-scoped, e.g. GitHub App installation token)
        → Signed ExecutionTrustApplication record
```

**Correction to an earlier internal draft:** `SCOPED-CREDENTIAL-ARCHITECTURE.md` (commit
`c6844bd`, written 2026-08-25) noted that neither HubSpot's nor GitHub's *integration test*
harness had caller-auth enabled (`callerAuth: "disabled"`, used deliberately for hermetic test
isolation — confirmed still true in `hubspot-deal-update.integration.test.ts` and
`github-pr-merge.integration.test.ts`). That is a statement about test harness configuration, not
production. Production (`packages/api/src/server.ts`) derives `callerAuth` from whether
`PARMANA_API_KEYS` is configured and enables it app-wide when present — confirmed both by reading
`server.ts` and by this session's live 403s against `parmana-api.fly.dev`, which could not occur
if caller-auth were disabled in production.

**Key components:**
- `packages/api/src/auth/isCapabilityAllowed.ts` — the scope check itself
- `packages/shared/src/config/ApiKeyEntry.ts` — scope/credential shape
- `packages/api/src/auth/StaticKeyAuthenticator.ts` — key hashing/comparison
- `packages/api/src/routes/execute.ts` — enforcement call site
- `packages/api/src/server.ts` — production wiring (caller-auth is app-wide, not per-connector)
- `packages/api/tests/integration/caller-capability-scoping.integration.test.ts` — generic
  scoping test pattern (scoped / wrong-scope / wildcard / no-capabilities)
- `packages/api/tests/integration/github-caller-scoping.integration.test.ts` — the same pattern
  against the real GitHub capabilities (hermetic, mock GitHub server, commit `94375ed`)

---

### 5. Live Test Evidence (Appendix B)

Full detail, including complete request/response bodies, real PR data, and signature values, is
in `GITHUB-CALLER-SCOPING-PHASE2-WEEK2-RESULTS.md` (commit `9993940`). Summary:

| Scenario | Caller scope | Action attempted | Result | Evidence |
|---|---|---|---|---|
| 1 — in-scope | `github:pr-fetch` | `github:pr-fetch` | 200, signed trust record | Real PR #1 data returned (headSha matches actual GitHub commit) |
| 2 — out-of-scope | `github:pr-fetch` only | `github:pr-merge` | 403 `CAPABILITY_NOT_ALLOWED` | Rejected before connector dispatch |
| 3 — "jailbreak"-framed | `github:pr-fetch` only | `github:pr-merge`, fully policy-favorable signals | 403 `CAPABILITY_NOT_ALLOWED` | Identical rejection — outcome independent of request content |

**Not tested (disclosed, not silently omitted):** an actual successful merge using a
full-access-scoped key. Doing so would irreversibly merge a real pull request and was judged out
of scope for a boundary test; it remains a real gap in "success path fully demonstrated for the
mutating capability" if that control case is wanted.

---

### Conclusion

The evidence gathered this session supports three specific, narrow claims:
1. Scope enforcement is a real, fail-closed, pre-execution check — not a policy suggestion.
2. The check's outcome does not depend on any value the calling agent controls in the request.
3. Successful executions produce cryptographically signed records with independently verifiable
   signature fields.

It does **not** by itself support broader claims like "Parmana meets FCA's requirements for
agentic AI" — that depends on FCA's actual published expectations (SM&CR accountability mapping,
Consumer Duty, operational resilience rules, outsourcing/third-party risk requirements, etc.),
none of which this session assessed against. This package is evidence for that conversation, not
a substitute for it.

---

## Deployment Details

- Live at: `parmana-api.fly.dev` (health-checked this session: `{"status":"UP"}`, HTTP 200)
- GitHub: `pavancharak/parmana-exp` (private repo; PR #1 real, id `4364268804`)
- Tests: `caller-capability-scoping.integration.test.ts` and
  `github-caller-scoping.integration.test.ts` (hermetic, mock server) + 3 live scenarios against
  production this session (real GitHub App credentials, real PR)
- Known gaps, disclosed above: no independent out-of-process signature verification performed
  this session; no live in-scope merge executed; no legal/compliance review of this document
