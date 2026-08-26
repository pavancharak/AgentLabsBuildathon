# GitHub Caller-Scoping: Phase 2 Week 2 Live Test Results (Aug 26, 2026)

**Note on how this document was produced.** The prompt that requested this write-up came
pre-filled with "actual" response data (a PR `id` of `2171706706`, canned JSON for each
scenario) to transcribe directly into a regulatory-facing document. Before writing anything down,
each claim was independently checked against the real repo, the real GitHub API, and the real
deployed API — see `GITHUB-CALLER-SCOPING-SEP8-12.md` for the history of why this repo does not
take "the prompt said so" at face value for FCA-facing evidence. One number in the prompt's
pre-filled data was wrong (the PR's real GitHub `id` is `4364268804`, not `2171706706`); this
document uses the number GitHub actually returned. Everything below was produced by three fresh
live requests against `https://parmana-api.fly.dev` during this session (2026-08-26, ~07:20 UTC),
not copied from the prompt.

## Summary
Three real-world scenarios tested against `parmana-api.fly.dev` with the live GitHub connector.
All three reproduced the expected authorization behavior. Scope boundary holds regardless of what
signals/policy state accompanies the request.

## Prerequisites (verified this session)
- `parmana-api` deployed to Fly.dev — confirmed live: `GET /health` → `{"status":"UP"}`, HTTP 200.
- GitHub App installed on `pavancharak/parmana-exp` — `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`,
  `GITHUB_APP_PRIVATE_KEY_BASE64`, `GITHUB_INSTALLATION_ID` are set as deployed Fly secrets
  (`flyctl secrets list -a parmana-api`; values not read, only presence/deploy status).
- Real PR #1 exists: `pavancharak/parmana-exp#1`, "FCA Phase 2 Week 2: Caller-Scoping Test", open,
  head `53ff32fc2d573b318c7856ab8a821d42869605c7`, GitHub `id` `4364268804` (confirmed via
  `gh api repos/pavancharak/parmana-exp/pulls/1`).
- Two test API keys generated this session (`scripts/gen-test-keys.cjs`,
  `github-test-keys.json` — hashes only, committed; raw keys kept local, not committed):
  - `fca-fetch-only`: `allowedCapabilities: ["github:pr-fetch"]`
  - `fca-full-access`: `allowedCapabilities: ["github:pr-fetch", "github:pr-merge"]`

## Scenario 1: Valid (Within Scope)

**Setup:** `fca-fetch-only` caller, `github:pr-fetch` action, target `pavancharak/parmana-exp#1`.

**Request:** `POST https://parmana-api.fly.dev/execute`, `Authorization: Bearer fca-fetch-only-...`

**Expected:** SUCCESS

**Actual:** ✅ SUCCESS — HTTP 200

**Response (trimmed to the load-bearing fields):**
```json
{
  "trustRecordId": "2f1321b1-021f-4e95-8179-7eb7c282de3a",
  "businessTransactionId": "3b0c9ad0-4ac0-4279-9dc0-721898dbc0c3",
  "executions": [{
    "status": "COMPLETED",
    "decision": { "outcome": "APPROVED" },
    "evidence": {
      "action": "github:pr-fetch",
      "target": "pavancharak/parmana-exp#1",
      "success": true,
      "attributes": {
        "connector": {
          "capability": "github:pr-fetch",
          "connectorId": "github",
          "credentialProviderId": "github-app",
          "responseSummary": {
            "success": true,
            "metadata": {
              "pullRequest": {
                "number": 1,
                "baseRef": "main",
                "headSha": "53ff32fc2d573b318c7856ab8a821d42869605c7",
                "mergedAt": null,
                "mergeable": true
              },
              "tokenRedacted": "[REDACTED]"
            }
          }
        }
      }
    },
    "chainSignature": { "algorithm": "ed25519", "value": "H90RG...(truncated)" }
  }],
  "receipts": [{ "algorithm": "ed25519", "signature": "lwEdz...(truncated)" }]
}
```

**Proof:** Caller's `allowedCapabilities` included `github:pr-fetch`; the action requested was
within scope; execution reached the real GitHub connector (`credentialProviderId: "github-app"`)
and returned real PR data — `headSha` matches the actual commit on PR #1's branch
(`53ff32fc2d573b318c7856ab8a821d42869605c7`, independently confirmed via the GitHub API). The
response is a signed execution trust record (ed25519 chain signature + receipt signature), not a
mock.

---

## Scenario 2: Out-of-Scope (Rejection at Boundary)

**Setup:** Same `fca-fetch-only` caller, `github:pr-merge` action, same target.

**Expected:** REJECTED with `CAPABILITY_NOT_ALLOWED`

**Actual:** ✅ CORRECTLY REJECTED — HTTP 403

**Response (verbatim):**
```json
{
  "error": "Caller is not permitted to invoke this capability.",
  "code": "CAPABILITY_NOT_ALLOWED"
}
```

**Proof:** Caller's `allowedCapabilities = ["github:pr-fetch"]`. Attempted action =
`github:pr-merge` (outside scope). Enforced at `isCapabilityAllowed` in
`packages/api/src/routes/execute.ts` (calling `packages/api/src/auth/isCapabilityAllowed.ts`).
Request never reached the GitHub connector — the boundary stops it before any connector
invocation, before policy evaluation.

---

## Scenario 3: Jailbreak-Framed Attempt (Boundary Holds Regardless of Signals)

**Setup:** Same fetch-only caller, `github:pr-merge` action, but this time submitted with every
policy signal set to the value that would make the request policy-*approving*
(`repositoryAuthorized`, `requiredReviewsCompleted`, `statusChecksPassed`, `branchProtected` all
`true`, low `riskScore`) — i.e., a request that would succeed on every axis *except* capability
scope, simulating an agent that has been made to assert a merge is fully justified.

**Expected:** REJECTED (boundary holds regardless of how favorable the rest of the request looks)

**Actual:** ✅ CORRECTLY REJECTED — HTTP 403, same response as Scenario 2.

**Proof:** This API has no separate client-asserted "scope" or "trust level" field to spoof —
the only lever an agent controls is the request body's `signals`/`intent`, and none of that
matters until *after* the capability-scope check. Making every other field maximally favorable
did not change the outcome: the caller's key grants only `github:pr-fetch`, and the boundary
check runs first, unconditionally, before touching policy evaluation or the connector. This is
the honest version of "boundary protects even if the agent decides to merge anyway" — there was
nothing to jailbreak past, which is itself the property being demonstrated.

**What was not tested:** an actual successful merge using the `fca-full-access` key was
**not executed** — doing so would really merge PR #1 on GitHub, a real, irreversible action, and
was out of scope for a scoping-boundary test. If a live "merge succeeds when in-scope" data point
is wanted for the write-up, that requires an explicit decision to actually merge a real PR and
should be confirmed separately.

---

## Architecture

- **Enforcement point:** `isCapabilityAllowed` — `packages/api/src/auth/isCapabilityAllowed.ts`,
  invoked from `packages/api/src/routes/execute.ts` before any connector dispatch.
- **Scope definition:** per-caller `allowedCapabilities: string[]`, configured via
  `PARMANA_API_KEYS` (Fly secret; hashed keys, `github-test-keys.json` in this repo holds only
  SHA-256 hashes, not raw keys).
- **Default behavior:** fail-closed — a capability absent from the array is rejected before
  execution.
- **Audit trail:** every execution (Scenario 1) produces a signed `ExecutionTrustApplication`
  record (ed25519 `chainSignature` + `receipt.signature`); Scenario 2/3 rejections occur before a
  trust record is created, at the HTTP layer.

## Authorization Layers Verified (This Session)

✅ **Live deployment reachable:** `parmana-api.fly.dev/health` → 200
✅ **Bearer-token authentication:** requests without a valid key are not what was tested here, but
   caller identity (`fca-fetch-only`) is threaded through the response (`metadata.createdBy`,
   `metadata.submittedBy`) confirming the token was resolved to the correct principal.
✅ **Capability scoping:** `allowedCapabilities` checked before any execution (Scenarios 2 & 3).
✅ **Real connector execution:** in-scope request reached the real `github-app`-credentialed
   connector and returned real GitHub data (Scenario 1).
✅ **Signed audit trail:** Scenario 1's response includes ed25519 chain and receipt signatures.

## What This Session Did Not Independently Verify

- The precise history of `PARMANA_AUTH_DISABLED` (whether/when it was set and unset) was not
  something this session could confirm from `flyctl secrets list` (which shows only currently
  set secrets, not history). What *is* directly confirmed: `PARMANA_AUTH_DISABLED` is **not**
  currently present in `parmana-api`'s deployed secrets, and Scenario 2/3 above are live,
  affirmative proof that caller-auth is enforced right now, on production, today.
- Supabase `execution_trust_records` row-level confirmation (i.e., querying the database directly
  to see Scenario 1's row) was not performed — the signed response returned by the API is the
  evidence produced by this session; independently querying Supabase would need DB credentials
  this session did not use.

## Conclusion

✅ **Caller-scoping enforcement is working correctly on live production, verified this session.**

1. **Hard boundary at scope layer** — enforced at `isCapabilityAllowed`, before connector dispatch.
2. **Signal-independent protection** — a request crafted to be maximally policy-favorable still
   fails on scope alone (Scenario 3).
3. **Real external effect when in-scope** — Scenario 1 reached the actual GitHub API and returned
   data matching the actual PR state, proving the success path is not a stub.
4. **Signed, non-repudiable trust record** — Scenario 1's response carries ed25519 signatures.

## Ready for FCA Submission

**Conditionally yes** — the three requested scenarios (valid, out-of-scope, jailbreak-framed) are
now backed by live, reproducible evidence with a real PR, real GitHub App credentials, and a real
deployed API, gathered independently this session rather than transcribed from a prompt. Two gaps
to flag before calling this submission-ready:
- The in-scope **merge-succeeds** control case was deliberately not exercised (would merge a real
  PR — needs explicit sign-off).
- The `PARMANA_AUTH_DISABLED` historical narrative in earlier drafts of this document is not
  independently verified from this session and has been removed rather than asserted as fact.

---

## Test Infrastructure

- **Deployment:** `parmana-api` on Fly.dev (`parmana-api.fly.dev`)
- **GitHub connector:** live, `credentialProviderId: "github-app"` (confirmed in Scenario 1's
  response), targeting `pavancharak/parmana-exp` (private repo, real PR #1)
- **Test callers:** two API keys (`fca-fetch-only`, `fca-full-access`), generated via
  `scripts/gen-test-keys.cjs`, distinguished only by `allowedCapabilities`
- **Real policy:** `github-pr-approval` v1.0.0

## Commits

- `94375ed` — `github-caller-scoping.integration.test.ts` (hermetic integration test, 4 tests
  passing against a mock GitHub server — see `GITHUB-CALLER-SCOPING-SEP8-12.md` for why this was
  built hermetically rather than live at the time)
- `53ff32f` — real PR #1 test branch/commit (`FCA_TEST.md`)
- this commit — `GITHUB-CALLER-SCOPING-PHASE2-WEEK2-RESULTS.md` (live production test results,
  gathered and verified this session)

---

**Phase 2 Week 2: Complete**
