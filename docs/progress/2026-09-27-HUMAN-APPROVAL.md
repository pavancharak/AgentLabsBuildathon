# Progress: human approval for agent actions

Started: 2026-09-27. Last updated: 2026-09-27.

This page is the resume point for the human approval work. It records what is done and verified, what is open, and what comes next. Gap numbers refer to `docs/VERIFICATION-GAPS.md`. Claims stay governed by `docs/CLAIMS.md`: the claim for this work is 2.42, and nothing here is a claim until it is there.

## Where things stand

| Item                              | State                                                                                                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branches                          | `feat/refund-manager-approval` (PR #46), and `feat/policy-version-from-governance` stacked on it (PR #47, G-66).                                                                                                       |
| Pull requests                     | #46 open, not merged: `90adade` (refunds, G-67 fix), `5c72204` (approvals declared by policy), `9557e93` (these docs). #47 open, not merged, based on #46: G-66. Merge #46 first; GitHub then retargets #47 to `main`. |
| Tests at the last commit          | `npx vitest run` through the pre commit hook, 2026-09-27: 2,195 passed, 42 skipped, 0 failed, 253 files (238 passed, 15 skipped). Typecheck, lint, format, build, examples pass.                                       |
| Not run yet                       | The Docker quickstart check and the offline check. Docker was not running on the development machine; both run in CI on the pull request.                                                                              |
| Deployed                          | No. Production still binds `paytm:refund` to `customer-refund` 1.0.0.                                                                                                                                                  |
| Earlier pull request, same thread | #45, merged: recorded G-65 and G-66, added the Human approval page, three claims Parmana does not make.                                                                                                                |

**Why merging #46 matters:** on `main`, a `paytm:refund` agent can send `managerApproved: true` with no manager and nothing checks it (G-51), so `customer-refund` 1.0.0 approves any eligible, fraud checked refund up to 10000. This is live wherever the Paytm connector is configured; whether production has it configured was not checked on 2026-09-27. #46 closes it.

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

## Before PR #46 can go live (needs the operator)

In this order:

1. **Approve `customer-refund` 1.1.0 in production** through policy governance: one person proposes, a second approves with a step up signature. This works before the deploy. **Order depends on #47:** with #46 alone, deploying first refuses every refund until 1.1.0 is approved (the version is fixed in code). With #47 too, refunds keep running under the version already approved (1.0.0, `managerApproved` unchecked) until 1.1.0 is approved, and approving it is what switches them over, with no deploy.
2. **Add a real approver.** The manager runs `scripts/generate-approver-key.ts` on their own machine. The operator puts the public key file under `$PARMANA_KEY_DIR/approval-issuers/`, adds the entry to `TRUSTED_APPROVAL_ISSUERS` in `packages/api/src/bootstrap/createApprovalIssuerRegistry.ts`, and deploys. It ships empty, so every approval is refused until then.
3. **Confirm the numbers:** 10000 automatic limit, 100000 maximum.
4. **Check CI on #46**, including the Docker quickstart and offline checks, then merge and deploy.
5. **Know the behavior change:** refunds up to 10000 no longer need `managerApproved: true`.

## Open, in order of what to do next

1. **G-66: BUILT 2026-09-27, PR #47, not merged.** The version for a live action now comes from policy governance: the most recently approved version for the bound name. Approving a version makes it current, approving an older one again rolls back. Evidence in G-66 and `docs/CLAIMS.md` 2.43. **New follow up from it:** agents name the version in each request, so after an approval requests naming the previous version are refused (the message names the version in effect). An endpoint that returns the version in effect, or agents reading it before sending, is open.
2. **Approvers without a deploy.** `TRUSTED_APPROVAL_ISSUERS` is a list in code. Moving it into the database behind maker and checker would let an operator add or revoke an approver without a deploy.
3. **Notification.** Nothing tells a manager a request is waiting. They find it with the query on the Human approval page (filter `matchedRuleId = 'reject-manager-approval-required'`).
4. **SDK support for approvals.** Signing is a repository script. The SDKs could offer `signApproval()` the way they offer `signPolicyChangeStepUp()`.
5. **G-51, what remains.** `refundEligible` and `fraudCheckPassed`, and the GitHub and Slack signals, are still the caller's word.
6. **Positioning copy.** The draft needs the wording the code supports: see `docs/CLAIMS.md` section 5 (three claims Parmana does not make) and 2.42.

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
