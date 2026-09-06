\# PHASE 1/2 EXECUTION PROMPT — Ready When Documents Arrive



\*\*Status:\*\* TEMPLATE READY  

\*\*Blocking:\*\* Actual requirements documents (FCA, NFRA, investor, or any formal spec)  

\*\*Trigger:\*\* Pavan pastes requirements document + says "run phase 1/2"  

\*\*Timeline:\*\* 2-4 hours execution (requirements parsing + code audit + gap assessment)  



\---



\## WHAT THIS PROMPT DOES



Takes actual requirements documents and produces:

1\. \*\*Parsed Requirements\*\* (structured list)

2\. \*\*Requirements Matrix\*\* (coverage: COVERED/PARTIAL/GAP for each)

3\. \*\*Code Audit\*\* (file locations, test citations)

4\. \*\*Gap Assessment\*\* (real gaps, accepted risks, deferred work)

5\. \*\*Submission Readiness Check\*\* (what's done, what's not)



\---



\## EXECUTION INSTRUCTIONS (FOR PAVAN)



\### When Ready to Execute



1\. \*\*Gather documents:\*\*

&#x20;  - FCA Supercharged Sandbox criteria (or acceptance letter, or email spec)

&#x20;  - NFRA RFP / pilot requirements

&#x20;  - Investor checklist (if available)

&#x20;  - Any other formal requirement (RBI guidance, NPCI spec, etc.)



2\. \*\*Paste documents here\*\* (use this conversation or new one)



3\. \*\*Say:\*\* "Run Phase 1/2 Claude Code prompt against \[requirements]"



4\. \*\*I will:\*\*

&#x20;  - Parse requirements into structured list

&#x20;  - Clone/audit parmana-exp repo against each requirement

&#x20;  - Find real code + test locations

&#x20;  - Produce coverage matrix (COVERED/PARTIAL/GAP)

&#x20;  - Output REQUIREMENTS\_MAPPING.md + GAPS\_AND\_MITIGATIONS.md



\### Document Format (Doesn't Matter)



\- Email from FCA

\- PDF guidance doc

\- Meeting notes (if specific)

\- RFP checklist

\- Investor one-pager

\- Even informal "here's what they asked for" is fine



\*\*I will extract the actual requirements from whatever format you provide.\*\*



\---



\## PHASE 1/2 EXECUTION FLOW (CLAUDE CODE)



\### Step 1: Parse Requirements Document



\*\*Input:\*\* Pasted document (any format)  

\*\*Output:\*\* Structured list



```typescript

// Example output structure

const requirements = \[

&#x20; {

&#x20;   source: 'FCA Sandbox',

&#x20;   requirement: 'Audit trail must capture every agent interaction',

&#x20;   category: 'audit-trail',

&#x20;   priority: 'critical',

&#x20;   regulatory\_cite: 'FCA AI Governance Evidence § Audit Trail'

&#x20; },

&#x20; {

&#x20;   source: 'NFRA',

&#x20;   requirement: 'Fraud prevention must be provable',

&#x20;   category: 'fraud-prevention',

&#x20;   priority: 'critical',

&#x20;   regulatory\_cite: 'NFRA AI Framework § Outcome-Based'

&#x20; },

&#x20; // ... more requirements

]

```



\### Step 2: Clone Repo \& Audit Code



\*\*For each requirement:\*\*

1\. Search parmana-exp repo for relevant code

2\. Find test that covers it (if exists)

3\. Determine: COVERED, PARTIAL, or GAP



```typescript

// Example audit result

const audit = \[

&#x20; {

&#x20;   requirement: 'Audit trail captures every interaction',

&#x20;   code\_location: 'packages/api/src/audit/CallerAuditChain.ts',

&#x20;   test\_location: 'packages/api/src/audit/\_\_tests\_\_/audit-chain.test.ts',

&#x20;   test\_names: \['should record every caller auth', 'should detect tampering'],

&#x20;   status: 'COVERED',

&#x20;   confidence: 'high',

&#x20;   test\_citation: 'audit-chain.test.ts:45-120',

&#x20; },

&#x20; {

&#x20;   requirement: 'Fraud prevention provable',

&#x20;   code\_location: 'packages/execution-control/src/connector/ConnectorExecutionGateway.ts',

&#x20;   test\_location: 'packages/execution-control/src/\_\_tests\_\_/gateway.test.ts',

&#x20;   status: 'COVERED',

&#x20;   confidence: 'high',

&#x20; },

&#x20; {

&#x20;   requirement: 'Real-time intervention capability',

&#x20;   code\_location: 'packages/policy/src/engine/PolicyEngine.ts',

&#x20;   test\_location: 'packages/policy/src/\_\_tests\_\_/policy.test.ts',

&#x20;   status: 'PARTIAL',

&#x20;   gap\_description: 'Policy can deny, but no independent re-check at connector layer',

&#x20;   confidence: 'medium',

&#x20;   gap\_severity: 'medium',

&#x20; }

]

```



\### Step 3: Create Requirements Matrix



```markdown

| REQUIREMENT | CODE | TEST | STATUS | GAP? | PRIORITY |

|---|---|---|---|---|---|

| Audit trail 100% | CallerAuditChain.ts | audit.test.ts | COVERED | NO | CRITICAL |

| Real-time detection | PolicyEngine.ts | policy.test.ts | COVERED | NO | CRITICAL |

| Agent accountability | (deployment-level) | N/A | COVERED | NO | CRITICAL |

| Independent verify | ConnectorGateway.ts | gateway.test.ts | PARTIAL | YES (Gap #4) | HIGH |

| Tamper-proof chain | CallerAuditChain.ts | chain.test.ts | COVERED | NO | CRITICAL |

| ...more rows | | | | | |

```



\### Step 4: Gap Assessment



For each GAP:

\- \*\*Real gap:\*\* Does this actually break a regulatory requirement?

\- \*\*Accepted risk:\*\* Is this a design limitation (like key compromise)?

\- \*\*Future work:\*\* Roadmap item for later?



```markdown

\## Real Gaps Found



\### Gap 1: Independent Verification at Connector (Medium Severity)

\*\*Requirement:\*\* \[cite from document]

\*\*Current:\*\* Policy layer verifies, connector trusts policy boolean

\*\*Impact:\*\* If policy layer compromised, connector has no independent check

\*\*Fix:\*\* Thread signed capabilities claim, re-verify at connector

\*\*Timeline:\*\* 27-36 hours (Sep 13-21 window)

\*\*Decision:\*\* Fix now or defer to Q4?



\## Accepted Risks



\### Key Compromise (Cryptography Limit)

\*\*What this is:\*\* \[honest explanation]

\*\*Current mitigation:\*\* Revocation (§2.28)

\*\*Future mitigation:\*\* KMS/HSM (Q4 2026)

\*\*Regulatory position:\*\* Honest about limitation

```



\### Step 5: Produce Submission Readiness Check



```markdown

\## Submission Readiness (Against Requirements)



\### FCA Requirements Coverage

\- \[✓] Audit trail 100% → CLAIMS.md §X, test: audit.test.ts:45-120

\- \[✓] Real-time detection → CLAIMS.md §Y, test: policy.test.ts:203-250

\- \[✓] Agent accountability → deployment-level (customer responsibility)

\- \[⚠] Independent verify → Gap #4, deferred to Q4

\- \[✓] Tamper-proof audit → CLAIMS.md §Z, test: chain.test.ts:\*



\*\*Status:\*\* 4/5 covered now, 5/5 if Gap #4 fixed Sep 13-21



\### NFRA Requirements Coverage

\[similar structure]



\### Investor Checklist Coverage

\[similar structure]



\### Overall Readiness

\- \*\*Now:\*\* Can submit 4/5 requirements

\- \*\*Sep 21:\*\* Can submit 5/5 if Gap #4 fixed

\- \*\*Jan 1, 2027:\*\* All regulatory requirements met

```



\### Step 6: Output Files



\*\*Produces:\*\*

1\. \*\*REQUIREMENTS\_PARSED.md\*\* — Structured requirement list

2\. \*\*REQUIREMENTS\_MATRIX.md\*\* — Coverage matrix (COVERED/PARTIAL/GAP)

3\. \*\*CODE\_AUDIT\_RESULTS.md\*\* — File locations + test citations

4\. \*\*GAPS\_AND\_MITIGATIONS.md\*\* — Real gaps + decisions needed

5\. \*\*SUBMISSION\_READINESS.md\*\* — What's done, what's not



\---



\## WHAT THIS IS NOT



\- ❌ Doesn't invent requirements

\- ❌ Doesn't create fake test scenarios

\- ❌ Doesn't produce compliance theater

\- ❌ Doesn't assume any requirement is implied



\## WHAT THIS IS



\- ✅ Honest assessment against real requirements

\- ✅ Fast audit (2-4 hours)

\- ✅ Actionable output (gap decisions, timeline estimates)

\- ✅ Ready for submission/investor conversations



\---



\## TIMING



\*\*From requirements document to output:\*\* 2-4 hours  

\*\*Execution method:\*\* Claude Code (repo audit + test search + coverage analysis)  

\*\*Output format:\*\* Markdown files (ready for regulatory submission)



\---



\## READY



This prompt is ready to execute.



\*\*Waiting for:\*\* Pavan to paste actual requirements documents.



\*\*When you have them:\*\*

1\. Paste document(s)

2\. Say "run Phase 1/2"

3\. I execute Claude Code with this prompt

4\. 2-4 hours later: honest assessment (covered/partial/gap) against real requirements



No fabrication. No invented tests. No assumptions.



Just: "Here's what regulators asked for. Here's what your code does. Here's the gap analysis."

