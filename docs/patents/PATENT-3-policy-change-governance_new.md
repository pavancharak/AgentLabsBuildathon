\# PATENT-3: Method and System for Deployment-Time and CI-Time Cryptographic Verification of Authorization-Policy Integrity

\*\*STATUS:\*\* Drafting aid for attorney review — NOT a filed or filing-ready application.

\*\*Written:\*\* September 1, 2026

\*\*Verified against:\*\* Source code line-by-line and documentation

\*\*Filing Status:\*\* Nothing filed yet. No patent attorney or prior-art search has reviewed this document. Do not submit to any patent office in current form.

\---

\## TITLE

Method and System for Cryptographic Verification of Authorization-Policy Integrity at Deployment and Continuous-Integration Gates, Detecting Out-of-Band Policy Modifications that Bypass Approval Workflow APIs

\---

\## FIELD OF THE INVENTION

\[0001] This invention relates to enforcement of authorization-policy integrity in systems where the policy artifact can be modified through multiple paths (approved API workflow, direct file edit, database modification, version-control system, deployment tooling). Specifically, this invention relates to a mechanism that cryptographically detects, at deployment and CI-time gates independent of the approval workflow itself, whether a policy file in force matches a content hash recorded at the time of approval, surfacing unauthorized modifications as a detectable signal rather than allowing them to pass unnoticed.

\---

\## BACKGROUND OF THE INVENTION

\[0002] A system that evaluates automated execution requests against a policy document relies on that policy being the one that was actually reviewed and approved. However, the approval workflow typically governs only one code path: an API that processes, approves, and records a policy change.

\[0003] A policy artifact (a JSON file, a database row) can be modified through other paths entirely:

(a) Direct file edits in the repository.

(b) Manual database modifications.

(c) Backup-and-restore operations.

(d) Configuration-management tools.

(e) Accidental or malicious modifications by someone with filesystem or database access who never interacts with the approval API at all.

\[0004] Nothing in a conventional approval workflow's own logs detects that the artifact it believes it approved has, in fact, been altered by a different path. An operator reviewing approval logs sees only the history of API decisions, completely blind to any out-of-band modifications.

\[0005] Two distinct failure modes exist: (a) unapproved changes are allowed to reach production (deployment lacks a gate), and (b) approved changes are later modified in place without detection (runtime is blind to post-approval tampering).

\[0006] What is needed is a verification mechanism that:

(a) At deployment time (fail-closed): detects whether the policy files being deployed were actually approved through the governed workflow, and blocks deployment if they were not.

(b) At runtime startup (fail-open): detects whether the policy files currently in force have been modified since the most recent approval, surfacing any divergence as an audit signal without blocking service availability.

(c) Operates independently of the approval workflow's own API and request path, using only the policy artifacts themselves and their recorded content hashes.

\---

\## SUMMARY OF THE INVENTION

\[0007] The invention comprises two complementary verification mechanisms:

\*\*Deployment Gate (CI-time, fail-closed):\*\* Before a policy change reaches production, a CI job cryptographically verifies that every policy file being deployed matches a content hash of a recorded approval for that exact policy content. If no approval record exists, or if the content hash diverges, deployment is blocked.

\*\*Runtime Integrity Check (startup-time, fail-open):\*\* At process startup (before accepting requests, but without blocking startup itself), a separate verification job compares the content hash of every policy file actually in force against the content hash recorded at the time of its most recent approval. Any divergence is logged as a governance-integrity alert, enabling operators to investigate after the fact.

\[0008] Both mechanisms use the same canonicalize-then-hash procedure (identical to the procedure used for all other cryptographic artifacts in the system), ensuring deterministic, reproducible hashing independent of file formatting, key ordering, or other incidental variations.

\---

\## DETAILED DESCRIPTION OF THE INVENTION

\### Component 1: Policy Content Hashing (Canonicalization)

\[0009] Before any verification can occur, policy content must be converted to a stable, reproducible hash. A `PolicyChangeCrypto.hashPolicyContent()` method:

(a) Takes the raw policy file content (JSON).

(b) Routes it through `CanonicalSerializer` to normalize it: recursively sorting object keys lexicographically, preserving array order, converting dates to ISO strings, passing primitives through unchanged.

(c) JSON-encodes the normalized content.

(d) Cryptographically hashes the canonical bytes.

(e) Returns a single hash string.

\[0010] This canonicalization ensures that two policy files describing identical rules but with keys inserted in different orders will hash identically. The hash becomes a content-addressed fingerprint, independent of formatting.

\[0011] The same canonicalize-then-hash procedure is used throughout the system (for trust records, refusal records, execution artifacts), ensuring consistency and enabling cross-artifact hash verification.

\### Component 2: Recording Content Hash at Approval Time

\[0012] When a policy change is approved (through whatever approval workflow exists), the system records not just the approval decision, but also the content hash of the policy as it existed at approval time.

\[0013] A `PolicyChangeApprovalRecord` stores:

(a) Policy name and version.

(b) Proposing actor (human-authenticated identity).

(c) Approving actor (human-authenticated identity).

(d) The full policy content in its entirety.

(e) `contentHashAfter` — the cryptographic hash of that content, computed via the procedure of Component 1.

(f) Timestamps and audit information.

\[0014] This record is persisted before the live policy file is written, ensuring that if a failure occurs during file write, the approval record exists even if the live file is corrupted.

\[0015] The record is treated as immutable: once created, it is never modified or deleted (append-only audit trail).

\### Component 3: Deployment-Time Verification (Fail-Closed)

\[0016] Before deployment, a CI job (`verify-policy-changes-approved.ts`) runs on every commit that touches policy files. The job:

(a) Identifies all policy files being deployed (diff against main, or full-scan mode).

(b) For each policy file, computes its content hash using the same procedure as Component 1.

(c) Queries the approval-record store for a record matching `(policyName, policyVersion, contentHashAfter == computed hash)`.

(d) If a matching record exists, the check passes for that policy.

(e) If no matching record exists — either no approval record for this policy at all, or the approval hash diverges from the current content — the job logs an error and blocks deployment.

(f) If the approval-record store is unreachable, the job fails loudly and blocks deployment (fail-closed: "unable to verify" is treated as "not verified").

\[0017] This gate ensures that unapproved policies, or policies modified after approval, never reach production through the normal CI/CD pipeline.

\[0018] A deliberate scope boundary: this gate protects only the CI/deploy path. Direct SSH access to production, filesystem edits, or database modifications bypass this gate entirely. Detection of such bypasses is addressed by Component 4.

\### Component 4: Runtime Integrity Check (Fail-Open)

\[0019] At process startup, independently of whether the deployment gate passed, a separate verification routine (`verifyPolicyGovernanceIntegrityAtStartup`) runs.

\[0020] For every distinct `(policyName, policyVersion)` pair in the approval-record store:

(a) Load the live policy file currently in force on disk.

(b) Compute its content hash using the procedure of Component 1.

(c) Retrieve the most recent approval record for that policy.

(d) Compare the computed hash against the `contentHashAfter` recorded in the approval.

(e) If they match, continue (no alert).

(f) If they diverge, or if no live file exists but an approval record does, log a `policy\_governance\_integrity\_alert` event identifying which policy diverged, what was recorded, and what was found.

\[0021] Crucially, the integrity check is designed to be fail-\*\*open\*\*:

(a) It never throws an exception that blocks process startup.

(b) If the approval-record store is unreachable, it logs a distinct event (`policy\_governance\_integrity\_check\_unavailable`) and continues startup (rather than silently succeeding with "no divergences found").

(c) Divergence is logged as an alert, not an error — it surfaces to operators and auditors, but does not halt service.

\[0022] This fail-open design reflects the different stakes: deployment should fail closed to prevent unapproved changes from reaching production; runtime should fail open to preserve availability while loudly alerting operators to investigate.

\### Component 5: Scope Boundary — What This Mechanism Does NOT Prevent

\[0023] This invention detects out-of-band policy modifications, but does not prevent them. The mechanisms of Components 1-4 operate on the policy artifacts themselves and their hashes.

\[0024] An attacker or operator with direct filesystem, database, or git access can:

(a) Edit a policy file after deployment.

(b) Modify the approval record's stored hash.

(c) Delete both the policy file and its approval record.

(d) Perform a backup-restore that overwrites both.

All of these will be \*\*detected\*\* by Component 4 at the next startup, but they cannot be \*\*prevented\*\* by this mechanism alone. Prevention requires access controls on the filesystem, database, and version-control system itself.

\### Component 6: Structural Independence from Policy Evaluation

\[0025] The mechanisms of Components 1-4 verify policy integrity and governance. They are structurally distinct from the mechanism that actually \*evaluates\* a policy at request time.

\[0026] `PolicyEngine.evaluate(policy, signals)` takes a policy and an execution request's signals, and deterministically evaluates whether the request matches any rule in the policy. The engine is architected to never:

(a) Authorize execution (evaluation is advisory only).

(b) Perform execution.

(c) Access external systems.

(d) Create trust records.

(e) Consume nonces or perform replay checks.

(f) Generate timestamps.

\[0027] Policy integrity verification (this patent) and policy evaluation (Component 6) are two distinct mechanisms that must never be confused. Integrity verification answers "was this policy properly reviewed and approved?"; evaluation answers "does this request match this policy's rules?"

\---

\## CLAIMS

\### Independent Claims

\*\*Claim 1 (Deployment-Gate Claim):\*\* A computer-implemented method for verifying that policy artifacts being deployed match approved policy content, comprising:

(a) maintaining an immutable approval-record store containing, for each approved policy: policy name, policy version, the full policy content, and a cryptographic content hash of that content (`contentHashAfter`) computed via a canonical serialization and deterministic hashing procedure;

(b) at deployment time, for each policy file being deployed, computing a cryptographic content hash of that file using the same canonical serialization and deterministic hashing procedure as paragraph (a);

(c) comparing the computed hash of step (b) against the `contentHashAfter` values in the approval-record store, searching for a matching approval record;

(d) if a matching record is found, permitting that policy to be deployed;

(e) if no matching record is found — either no approval record exists for this policy, or all existing approval records have a different `contentHashAfter` — blocking deployment and logging the rejection;

(f) if the approval-record store is unreachable or unavailable, treating this as an approval-verification failure and blocking deployment;

such that deployment acts as a fail-closed gate preventing unapproved policies and post-approval-modified policies from reaching production through the normal CI/CD path.

\*\*Claim 2 (Runtime-Integrity-Check Claim):\*\* A computer-implemented method for detecting out-of-band policy modifications, comprising:

(a) at process startup, independent of deployment gates or approval workflows, retrieving the set of all policies that have approval records in an immutable approval-record store;

(b) for each such policy, loading the live policy file currently in force on the deployment's filesystem;

(c) computing a cryptographic content hash of each live policy file using the same canonical serialization and deterministic hashing procedure used to compute the approval records' `contentHashAfter` values;

(d) comparing each computed hash against the `contentHashAfter` of the most recent approval record for that policy;

(e) if a match is found, recording no alert (policy is consistent with its approval);

(f) if no match is found, or if no live file exists for a policy that has an approval record, logging a `policy\_governance\_integrity\_alert` event identifying the policy and the mismatch (missing file vs. content divergence);

(g) if the approval-record store is unreachable, logging a distinct event (`policy\_governance\_integrity\_check\_unavailable`) and continuing startup without blocking;

such that startup is fail-open: policies are not verified to be approved before accepting requests, but divergences are loudly logged for operator investigation.

\*\*Claim 3 (Unified Hashing Claim):\*\* The methods of Claims 1 and 2, wherein the canonical serialization and deterministic hashing procedure:

(a) recursively normalizes the policy content by sorting object keys lexicographically, preserving array order, converting dates to ISO strings, and passing primitives through unchanged;

(b) JSON-encodes the normalized content and cryptographically hashes the resulting bytes;

(c) is identical to the procedure used for all other cryptographic artifacts in the system (execution trust records, refusal records, policy-change records, etc.);

(d) ensures that two policies describing identical rules but with keys inserted in different orders hash identically, and that policy-integrity verification uses the same hashing discipline as every other artifact-verification mechanism in the system.

\### Dependent Claims

\*\*Claim 4:\*\* The method of Claim 1, wherein the approval-record store is append-only: approval records are never modified or deleted after creation, and all historical approvals are retained (not pruned or archived).

\*\*Claim 5:\*\* The method of Claim 1, wherein the approval record includes not just the `contentHashAfter` but the full policy content in its entirety, enabling recovery and audit of the exact policy that was approved (not just a hash).

\*\*Claim 6:\*\* The method of Claim 1, wherein policy name and version are distinct identifiers, allowing multiple versions of the same-named policy to coexist and be approved independently.

\*\*Claim 7:\*\* The method of Claim 2, wherein the distinction between "missing file" and "content mismatch" is preserved in the logged alert, enabling operators to diagnose whether a policy was deleted, modified, or lost to a data-integrity failure.

\*\*Claim 8:\*\* The method of Claim 2, wherein the integrity check is deliberately fail-open: a failure to verify does not block process startup, and an unavailable approval-record store is logged as a distinct event (not conflated with "no divergences found").

\*\*Claim 9:\*\* The method of Claim 2, applied to a system where authorization policies govern AI-agent-initiated execution, wherein the integrity check detects whether the machine-evaluated ruleset an autonomous agent is checked against has been tampered with after approval.

\*\*Claim 10:\*\* The method of Claim 1, wherein blocking deployment due to approval-verification failure is enforced as a CI job that runs before any artifact reaches a production environment, preventing the need for manual gates or operator judgment.

\*\*Claim 11:\*\* The method of Claim 2, wherein detection of a policy divergence occurs independently of the approval workflow's own API and request path — solely by comparing artifacts and hashes, without requiring any approval-workflow state.

\*\*Claim 12:\*\* The method of Claim 1, wherein the canonical serialization procedure prevents hash collisions and formatting-dependent divergences, ensuring that a policy that has been approved is detected as approved even if the file's formatting, key order, or whitespace has changed incidentally.

\---

\## ATTORNEY REVIEW REQUIRED

1\. \*\*Prior-art search:\*\* Continuous deployment verification, policy-as-code integrity checking, configuration-management audit trails (Puppet, Chef, Terraform state hashing), CI/CD deployment gates.

2\. \*\*Claim scope refinement:\*\* Determine whether Claims 1 and 2 are better prosecuted as:

&#x20; \* Independent claims (deployment verification vs. runtime detection are distinct problems)

&#x20; \* Dependent claims on a single unified verification system

&#x20; \* Separate patent applications (one for CI gate, one for runtime check)

3\. \*\*Formal drawings:\*\*

&#x20; \* Deployment gate flow: policy file → compute hash → query approval store → approve or block

&#x20; \* Runtime check flow: startup → iterate policies → load files → compute hashes → compare → log divergences

&#x20; \* Fail-closed vs. fail-open design distinction diagram

4\. \*\*Scope clarification:\*\* Confirm whether "approval workflow" is in scope or out of scope for this patent.

5\. \*\*Relationship to PATENT-1 and PATENT-2:\*\* Clarify whether this patent is independent or dependent.

6\. \*\*International filing strategy:\*\* India only or PCT/US/EU?

\---

\## CONCLUSION

This patent describes a specific, verified-in-code mechanism for detecting out-of-band modifications to authorization policies by comparing cryptographic content hashes at two independent gates: deployment time (fail-closed, preventing unapproved changes from reaching production) and runtime startup (fail-open, detecting post-approval tampering without blocking service).

The novelty lies in the dual-gate architecture (deployment prevention + runtime detection), the unified canonicalize-then-hash procedure ensuring consistency across all artifacts, and the deliberate fail-closed vs. fail-open design distinction reflecting different operational stakes.

\*\*Status:\*\* Complete draft. Ready for attorney review. Not filing-ready.
