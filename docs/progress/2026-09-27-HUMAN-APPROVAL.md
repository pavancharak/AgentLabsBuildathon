# Progress: human approval for agent actions

Started: 2026-09-27. Last updated: 2026-09-28.

This page is the resume point for the human approval work. It records what is done and verified, what is open, and what comes next. Gap numbers refer to `docs/VERIFICATION-GAPS.md`. Claims stay governed by `docs/CLAIMS.md`: the claim for this work is 2.42, and nothing here is a claim until it is there.

## Where things stand

| Item                              | State                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branches                          | Both merged and deleted.                                                                                                                                                                                                                                                                                                                                                       |
| Pull requests                     | #47 (G-66) merged into #46 at `77df35e`; #46 merged into `main` at `4eebd5f`, 2026-09-27.                                                                                                                                                                                                                                                                                      |
| Tests at the last commit          | `npx vitest run` through the pre commit hook, 2026-09-27: 2,195 passed, 42 skipped, 0 failed, 253 files (238 passed, 15 skipped). Typecheck, lint, format, build, examples pass.                                                                                                                                                                                               |
| CI on #46                         | 2026-09-27: `build-and-test`, `build-and-boot`, `self-hosted` (the Docker quickstart check and the offline check, with `customer-refund` 1.1.0) and the Python SDK jobs passed. `verify-policy-approvals` failed without checking anything: `SUPABASE_URL is not set` in CI. With the secret set, it would still fail until `customer-refund` 1.1.0 is approved in production. |
| Deployed                          | Yes, 2026-09-27: Vercel deployed the `main` merge; `/health` UP, `/ready` READY with auth on, unauthenticated `POST /execute` returns `401`. `customer-refund` 1.1.0 was approved in production at 2026-09-27 18:53:40 UTC, so refunds now run under 1.1.0 (see below).                                                                                                        |
| Earlier pull request, same thread | #45, merged: recorded G-65 and G-66, added the Human approval page, three claims Parmana does not make.                                                                                                                                                                                                                                                                        |

**Why approving 1.1.0 mattered:** under `customer-refund` 1.0.0, a `paytm:refund` agent can send `managerApproved: true` with no manager and nothing checks it (G-51), so `customer-refund` 1.0.0 approves any eligible, fraud checked refund up to 10000. On 2026-09-27 the production Vercel project was found to have `PAYTM_CONNECTOR_URL`, `PAYTM_CONNECTOR_SHARED_SECRET` and `PAYTM_CONNECTOR_TIMEOUT_MS` set (variable names checked with the Vercel CLI, values not read), and a `paytm-refund-agent` API key existed, so this was live in production until the key rotation and the approval below closed it. Where `PAYTM_CONNECTOR_URL` points (a real Paytm connector service or a stand in) was not checked.

## How this started

A positioning draft (2026-09-27) promised "critical decisions escalate to humans on demand" and "rule violations are structurally impossible". Checked against the source code only:

- Policy had two outcomes, approve or refuse; nothing held a request for a person.
- `managerApproved` on refunds was a value the agent sent and nothing checked, so an agent could approve its own refund.
- `customer-refund` 1.0.0 refused anything above 10000 with no approval path.
- The only checked approval (HubSpot) could never pass the gateway (found later, G-67), and no approver was configured.

The agreed flow instead of escalation: a refused request is recorded with a signed Refusal Record, a manager finds it by query, signs an approval, and the agent sends a new request with the approval attached.

## Done and verified

| What                                         | Where                                                                                                                             | Evidence                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Approvals declared by policy, for any action | `Policy.approvalSignals` (`packages/policy/src/types/Policy.ts`), validated in `PolicyValidator.ts`                               | `packages/policy/tests/unit/PolicyValidator-approvalSignals.test.ts` (14)                                                                 |
| One verifier for every action                | `packages/approval/src/ApprovalSignalVerifier.ts`, wired in `packages/api/src/application.ts`                                     | `packages/approval/tests/unit/ApprovalSignalVerifier.test.ts` (24). With it removed from the app, 7 refund integration tests fail.        |
| Checked twice, used once                     | `SignalStateVerificationRequest.stage` and `.policy`; the gateway passes the policy it loaded and hash checked                    | With the gateway not passing the policy, a valid approval is refused there (fails closed).                                                |
| G-67: approvals could never pass the gateway | `ApprovalVerificationRequest.consumeNonce`; `HubSpotSignalStateVerifier`                                                          | HubSpot and refund success tests fail with the fix reverted and pass with it.                                                             |
| Refund policy 1.1.0                          | `policies/customer-refund/1.1.0/policy.json`, bound in `packages/capability-registry/src/CapabilityPolicyBinding.ts`              | `packages/policy/tests/unit/CustomerRefundPolicy110.test.ts` (11); `packages/api/tests/integration/paytm-refund.integration.test.ts` (15) |
| Approvals verified with Ed25519 only         | `packages/crypto/src/ApprovalArtifactCrypto.ts`, `packages/api/src/bootstrap/createApprovalVerifier.ts`                           | `packages/crypto/tests/unit/approval-artifact-signer.test.ts` (6)                                                                         |
| Approver tools                               | `scripts/generate-approver-key.ts`, `scripts/sign-approval.ts` (any action, amount optional, 15 minutes default, one day at most) | `scripts/tests/approver-scripts.test.ts` (14), and both run from the command line                                                         |
| Docs                                         | `docs/site/concepts/human-approval.mdx`, `docs/site/concepts/policies-and-the-decision.mdx`, quickstart, guides, changelog        | Docs tests pass; LLM index regenerated                                                                                                    |

Refund rules in `customer-refund` 1.1.0: up to 10000 automatic after the eligibility and fraud checks; above 10000 and up to 100000 only with a verified manager approval for that order, covering that amount; above 100000 refused. The 100000 maximum was chosen during the build and is waiting for the operator to confirm.

## To make it take effect in production (needs the operator)

In this order:

1. **Approve `customer-refund` 1.1.0 in production: DONE 2026-09-27 18:53:40 UTC** (see the next section). No deploy was needed.
2. **Add a real approver.** Still open: `TRUSTED_APPROVAL_ISSUERS` is empty, so in production every refund above 10000 is refused, with or without an approval. The manager runs `scripts/generate-approver-key.ts` on their own machine and sends the `.public.pem` file. The operator adds `{ approverId, keyId, revoked: false, publicKeyPem }` to `TRUSTED_APPROVAL_ISSUERS` in `packages/api/src/bootstrap/createApprovalIssuerRegistry.ts`, opens a pull request, and deploys. The inline `publicKeyPem` is what makes this possible on Vercel (G-68).
3. **Confirm the numbers:** 10000 automatic limit, 100000 maximum.
4. **CI:** everything passed on #46 except `verify-policy-approvals`, which needs the `SUPABASE_URL` and `SUPABASE_ANON_KEY` secrets in GitHub Actions (none are set) and an approved 1.1.0. #46 was merged with that check failing.
5. **Know the behavior change:** refunds up to 10000 no longer need `managerApproved: true`.

## State of the production approval (updated 2026-09-28)

- **Approved:** `customer-refund` 1.1.0, pending change `008f504d-0efd-4bec-b33a-2991bb84099f`, status `APPROVED`, resolved at 2026-09-27 18:53:40 UTC by `reviewer-charak1987` with a step up signature. The change was proposed on 2026-09-27 10:37:48 UTC by the caller `policy-maker` (not `charak1987`, as this page said before). Checked after the approval with both human keys: `GET /policies/pending-changes` shows it `APPROVED`.
- **One person holds both roles.** The operator decided on 2026-09-27 to hold the maker, checker and refund manager roles for now, instead of waiting for a second person. The server enforces that the approving caller differs from the proposing one; it cannot tell that both credentials belong to one person. So this approval, like the earlier approvals by `policy-reviewer-1` (whose keys were also held by the proposer), is two credentials held by one person, not two people. Nothing may claim two person control for production until a second person holds the checker key.
- **API keys rotated, 2026-09-27.** Every production API key was replaced: `PARMANA_API_KEYS` on Vercel now holds exactly `charak1987` (human, proposer), `reviewer-charak1987` (human, with a step up key) and `paytm-refund-agent` (`paytm:refund` only). The keys shown in a chat transcript (the proposer's and `policy-reviewer-1`'s), `policy-maker`, and the old `paytm-refund-agent` key are revoked. Checked after the final redeploy: each new key authenticates as its own caller, unauthenticated `POST /execute` returns `401`. The refund agent's own Vercel project (`parmana-paytm-agent`) was given its new key.
- **Old reviewer key file deleted:** `reviewer.step-up.private.pem` is gone from the operator's machine.
- **Open for the refund agent:** its code is not in this repository. It must send `customer-refund` version 1.1.0 (requests naming 1.0.0 are now refused, G-66), and its `PARMANA_PRINCIPAL_ID` must be `paytm-refund-agent` (the new key may only act as itself). Neither was checked.
- **Open, not diagnosed:** a malformed approve request (placeholder change id, empty body) to production returned `500 Internal Server Error`. The same request to a local server returns `400 Malformed JSON body`. Production logs were not available from the working session.

## Go live commands for production

Production API: `https://parmana-api-real.vercel.app`. The 2026-09-20 inventory showed policies proposed by `charak1987` and approved by `policy-reviewer-1` (`docs/REMAINING-WORK.md`, B.6). Each person runs their own part with their own key; the server refuses an approval from the proposer.

**The proposer**, from a clone of `main`:

```bash
export PARMANA_URL=https://parmana-api-real.vercel.app
export PROPOSER_KEY=<the proposer's API key>

printf '{"reason":"Refunds above 10000 need a verified manager approval (G-65).","proposedContent":%s}'   "$(cat policies/customer-refund/1.1.0/policy.json)" > proposal.json

curl -s -X POST $PARMANA_URL/policies/customer-refund/1.1.0/pending-changes   -H "Authorization: Bearer $PROPOSER_KEY" -H "Content-Type: application/json"   --data @proposal.json
```

The response holds `pendingPolicyChangeId`; send it to the approver.

**The approver**, on their own machine with their step up private key:

```bash
export PARMANA_URL=https://parmana-api-real.vercel.app
export APPROVER_KEY=<the approver's API key>
export CHANGE_ID=<the pendingPolicyChangeId>

npx tsx scripts/sign-policy-change-step-up.ts   --private-key-file <path to the approver's step up private key> --key-id <the approver's caller id>   --pending-policy-change-id "$CHANGE_ID" --action approve > signed.txt

curl -s -X POST $PARMANA_URL/policies/pending-changes/$CHANGE_ID/approve   -H "Authorization: Bearer $APPROVER_KEY" -H "Content-Type: application/json"   -d "{\"stepUpAuthorization\":$(grep '^{' signed.txt)}"
```

The signature is valid for 120 seconds, so send it right after signing. On Windows PowerShell, which has no `export` or `printf`, use `$url = "..."`, `Read-Host -AsSecureString` for the key, `Get-Content ... -Raw` to build the body, and `Invoke-RestMethod` with the body sent as UTF-8 bytes. The response says `"status":"APPROVED"`. From then on refunds must name `customer-refund` 1.1.0.

## Open, in order of what to do next

1. **G-66: BUILT and deployed 2026-09-27 (PR #47 via #46).** The version for a live action now comes from policy governance: the most recently approved version for the bound name. Approving a version makes it current, approving an older one again rolls back. Evidence in G-66 and `docs/CLAIMS.md` 2.43. **New follow up from it:** agents name the version in each request, so after an approval requests naming the previous version are refused (the message names the version in effect). An endpoint that returns the version in effect, or agents reading it before sending, is open.
2. **Approvers without a deploy.** `TRUSTED_APPROVAL_ISSUERS` is a list in code. Moving it into the database behind maker and checker would let an operator add or revoke an approver without a deploy.
3. **Notification.** Nothing tells a manager a request is waiting. They find it with the query on the Human approval page (filter `matchedRuleId = 'reject-manager-approval-required'`).
4. **SDK support for approvals.** Signing is a repository script. The SDKs could offer `signApproval()` the way they offer `signPolicyChangeStepUp()`.
5. **G-51, what remains.** `refundEligible` and `fraudCheckPassed`, and the GitHub and Slack signals, are still the caller's word.
6. **Positioning copy: drafted 2026-09-27** in the doc "Parmana positioning, checked against the code" (https://claude.ai/code/artifact/15f5fda0-d9a0-4652-be87-7df69268da3c): master statement, three promises, investor opener, email, homepage hero, LinkedIn post and a nine slide outline, each line mapped to a claim. Its "Before Tuesday" list repeats steps 1 and 2 above.

## Decisions made on 2026-09-27

1. No escalation state. A refused request stays refused; the agent sends a new one with the approval.
2. Approvals are declared in the policy (`approvalSignals`), not written per action in code. The refund specific verifier built first was replaced before merge.
3. HubSpot keeps its own check: its limit applies to an amount change worked out from a live read of the deal, not to a value in the request.
4. An approval is checked at both points (before authorization, and at the gateway before release) and used once, at authorization.
5. Approver keys are Ed25519 whatever the server signs with, like step up keys.

## How to resume

```bash
git fetch && git checkout feat/refund-manager-approval
npm install
npx vitest run packages/approval packages/policy packages/api/tests/integration/paytm-refund.integration.test.ts
```

Then read, in order: this page, `docs/VERIFICATION-GAPS.md` G-65 to G-67, `docs/CLAIMS.md` 2.42, and `docs/site/concepts/human-approval.mdx`.
