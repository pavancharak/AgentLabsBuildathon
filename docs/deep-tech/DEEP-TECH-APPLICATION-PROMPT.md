# Parmana Deep Tech Category: Documentation & Progress Master Prompt

**Owner:** Pavan (CEO, System Architect)
**Company:** Parmana (authorization layer for AI execution)
**DPIIT Certificate:** DPP27254 (issued Aug 24, 2026 - regular startup)
**Incorporation Date:** ~~April 2024~~ **April 20, 2026** (corrected by Pavan, 2026-08-25 — see note below)
**Goal:** Upgrade to Deep Tech recognition (20-year runway, ₹300 Cr turnover cap)

> **Note (2026-08-25):** This file is a verbatim archive of the master prompt as supplied by
> Pavan, saved here so it persists in the repo instead of only in chat history. On first review,
> none of the supporting documents it references (`/areas/parmana-product.md`,
> `/areas/parmana-architecture-docs.md`, `/areas/parmana-security-incidents.md`,
> `/areas/parmana-latency-investigation.md`, `/areas/uk-aisi-agentic-incident-2026.md`,
> `/areas/parmana-scoped-identity-gap.md`, `/areas/parmana-policy-governance-gap.md`,
> `/areas/mastercard-submission.md`, `/profile.md`) exist in this repository or in this Claude
> Code session's memory store — they appear to live in a different Claude.ai project/workspace,
> if they exist at all. Per Pavan (2026-08-25): treat all of that supporting material, patent
> filing status, R&D spend figures, and the Mastercard/AISI claims as **not yet documented —
> TODO**, not as established fact. Do not draft application content that asserts specifics
> (patent numbers, dollar figures, incident details) that haven't been supplied and verified.
>
> **Correction (2026-08-25):** the original prompt's incorporation date ("April 2024") was wrong.
> Pavan confirmed the actual incorporation date is **April 20, 2026**. This is corroborated by
> this repository's own git history — the earliest commit (`ba7bc45`, "feat: initialize Parmana
> architecture v1") is dated 2026-06-25, about two months after incorporation, which is
> consistent with a company that started building in mid-2026, not one with a two-year-old
> incorporation date and no code to show for most of it. Every place below that derives from
> "April 2024" (the "2+ years" eligibility framing, R&D-spend date ranges) is stale and is
> corrected in the drafted narrative documents in this folder — do not use the "2+ years" framing
> from this archived copy. As of 2026-08-25, Parmana is **about 4 months old**, not 2+ years —
> which is still comfortably within DPIIT's 20-year Deep Tech window, but changes the honest
> framing from "established track record" to "high R&D velocity in a very short window": TRL 6-7
> evidence, a live real-money regulated-payments validation, and 1,313 automated tests were all
> produced within roughly two months of the first commit. That is arguably a *stronger* R&D-
> intensity data point for the application than the original "2+ years" claim, not a weaker one —
> see [01-INNOVATION-NARRATIVE.md](./01-INNOVATION-NARRATIVE.md).

---

## Purpose of This Document

This prompt guides Claude to systematically:
1. Track what Deep Tech documentation is complete vs. missing
2. Identify R&D spend, IP, and technical evidence gaps
3. Draft narratives that connect Parmana's work to DPIIT Deep Tech criteria
4. Monitor application readiness and timeline

Use this when you need to:
- Audit Deep Tech eligibility
- Build the innovation narrative
- Gather R&D proof
- Track patent status
- Prepare supporting documentation
- Verify compliance with additional scrutiny requirements

---

## DPIIT Deep Tech Criteria (Feb 2026 Notification)

A Deep Tech Startup must demonstrate:

**Mandatory attributes:**
- Core scientific or engineering innovation (not incremental)
- Significant R&D expenditure and intensity
- Novel intellectual property (patents, registered designs, proprietary tech)
- Clear commercialization plan
- Long development cycles, capital-intensive requirements, technical uncertainty
- Focus on AI, semiconductors, biotech, quantum, robotics, advanced materials, advanced engineering

**Legal/structural:**
- Incorporated in India (Private Ltd, LLP, Partnership, Cooperative)
- Within 20 years of incorporation (Parmana: incorporated April 20, 2026 — about 4 months old as of Aug 2026, comfortably within range)
- Turnover: up to ₹300 crore in any financial year (Parmana: currently under cap)
- Not a reconstruction or split of existing business

**Process requirements:**
- Submit standard DPIIT recognition docs
- PLUS additional technical documentation demonstrating Deep Tech attributes
- Enhanced scrutiny from DPIIT with domain-specific assessment
- May require Inter-Ministerial Board review

---

## Parmana's Deep Tech Narrative

### Core Innovation (R&D-Intensive)

**Execution Authorization Layer for AI in Regulated Finance**

Parmana builds cryptographic runtime governance for AI-executed transactions in regulated financial services. The innovation is NOT a policy engine or API gateway—it's a **credential isolation and execution audit architecture** that prevents unauthorized execution even when initial permissions are granted.

**Technical depth:**
- Cryptographic credential vault (SessionCredentialSecureConnector wraps all connectors)
- Execution audit trail with signed decisions (webhook mechanics)
- Policy governance (maker-checker system, not just role-based access)
- Zero-trust execution model (credential isolation is automatic, not manual)

**R&D challenges addressed:**
- How to isolate credentials at runtime without breaking connector semantics
- How to audit execution without replay vulnerability or latency overhead
- How to enforce policy at execution time when initial permission doesn't guarantee safe behavior
- How to make credential revocation atomic across distributed connectors

### IP & Patents (Evidence of Core Tech)

**Status to clarify:**
- [ ] Patent application filed on credential isolation + execution audit? (If yes, reference number + filing date)
- [ ] Patent application filed on policy governance (maker-checker)? (If yes, reference number + filing date)
- [ ] Design registrations for webhook audit format or vault API?
- [ ] Proprietary architecture (not open-source equivalent available)?

**If patents NOT yet filed:**
- Urgently file provisional applications before Deep Tech submission
- Focus on: credential isolation mechanism, policy enforcement at execution time, audit trail structure
- Reference: UK AISI incident (Aug 2026) as validation that this invention addresses real attack surface

### R&D Spend & Effort (Proof of Intensity)

**Questions to answer for application:**

1. **Total R&D investment since Apr 2026 (incorporation):**
   - Team headcount on engineering/research?
   - Months of effort on credential isolation (M7/M8)?
   - Months on policy governance (maker-checker)?
   - Infrastructure spend on testing/validation?
   - Actual ₹ spent on R&D (salary, infra, external consultants)?

2. **R&D as % of revenue/burn:**
   - If bootstrapped or early-stage, what % of runway is allocated to R&D?
   - Document burn rate and R&D allocation

3. **Documentation of R&D process:**
   - Architecture docs (already in /areas/parmana-architecture-docs.md)
   - Security audits conducted (reference /areas/parmana-security-incidents.md)
   - Evidence of iterative refinement (version history, design decisions)
   - Testing frameworks built (unit tests, integration tests, security tests)

4. **External validation of R&D:**
   - Security audit findings (independent validation)
   - AISI incident as proof of real-world need
   - Academic citations (if SSRN papers published)
   - Vendor/partner technical feedback

### Commercialization Plan (Not Just R&D Lab)

**Clear market path required:**

1. **Immediate (0-12 months):**
   - Razorpay connector + policy governance in production
   - 2-3 regulated financial institution pilots lined up
   - Mastercard AI Defense Lab submission (proof of enterprise interest)

2. **Medium-term (12-24 months):**
   - HubSpot connector or secondary connector deployed
   - Compliance framework documented (RBI-aligned for India focus)
   - Customer revenue or pilot contracts signed

3. **Long-term (2-5 years):**
   - Scalable to multiple vendors (execution agnostic)
   - Regulatory endorsement pathway (CERT-In, RBI awareness)
   - Export-ready for global regulated markets

**Deliverable:** 1-page commercialization roadmap highlighting how R&D translates to market traction

### Long Gestation & Technical Uncertainty (Why 20 Years Needed)

**Argument for Deep Tech category:**

1. **Execution governance is nascent:**
   - Not a solved problem in industry (no standard, unlike auth/API gateways)
   - Regulatory acceptance not yet established in India/globally
   - Requires ongoing R&D as financial regulation evolves

2. **Parmana's specific challenges:**
   - Latency constraints (voice-AI readiness deferred Aug 2026, still to solve)
   - Connector reliability and audit atomicity (ongoing)
   - Policy authoring UX (still optimizing maker-checker)
   - Scoped identity gap (identified Aug 2026, needs research & build)

3. **Why 10 years isn't enough:**
   - 4+ years to reach sustainable revenue in regulated enterprise (industry standard for deep tech)
   - 2-3 additional years for regulatory pathway (CERT-In, RBI guidance)
   - 2+ years to expand beyond financial services (if successful)
   - Safety margin for market adoption and product-market fit

**Deliverable:** 1-page document titled "Why Parmana Needs 20-Year Recognition" addressing each point

---

## Documentation Checklist

### Immediately Available (Already in Memory)

- [x] /areas/parmana-product.md — Core architecture & positioning
- [x] /areas/parmana-architecture-docs.md — Execution, storage, webhook, connector, security mechanics
- [x] /areas/parmana-exp-complete-documentation.md — Line-by-line code reference (credential isolation)
- [x] /areas/parmana-security-incidents.md — G-24 audit findings (validates security claims)
- [x] /areas/parmana-latency-investigation.md — Proof of technical challenge (voice-AI readiness deferred)
- [x] /areas/uk-aisi-agentic-incident-2026.md — Real-world validation of runtime authority thesis
- [x] /areas/parmana-scoped-identity-gap.md — Ongoing research gap identified
- [x] /areas/parmana-policy-governance-gap.md — Maker-checker system build & audit history
- [x] /areas/mastercard-submission.md — Enterprise interest proof (Mastercard AI Defense Lab)

> **2026-08-25 verification note:** the "[x]" marks above are as supplied in the original
> prompt. None of these files were found in this repository or in this Claude Code session's
> memory during an actual check. Confirmed by Pavan as not yet real/TODO — see the note at the
> top of this file.

### Need to Create/Clarify

- [ ] **Patent Filing Status:** Confirm if applications filed; get reference numbers & dates
- [ ] **R&D Spend Statement:** Compile total investment (salary, infra, consultant) Apr 2026 - Aug 2026
- [ ] **Innovation Narrative (1 page):** "Why Parmana is Deep Tech, Not a Regular Startup"
- [ ] **Commercialization Roadmap (1 page):** 0-12m, 12-24m, 2-5y milestones with revenue expectations
- [ ] **Long Gestation Argument (1 page):** Why 20-year recognition is justified for execution governance
- [ ] **IP & Patent Summary (1 page):** Patents filed/pending + proprietary tech inventory
- [ ] **R&D Evidence Dossier:** Security audits + AISI validation + latency investigation + scoped-identity research gap
- [ ] **Team & Expertise (0.5 page):** Pavan's background (13+ years, founding, MakeMyTrip/Shaadi PM experience) + co-founder credibility

### Supporting Documents to Reference

When drafting, link to:
- Competitive landscape analysis (AGT, execution-authority-gate, etc.) — proof of novel positioning
- SSRN papers (if published) — academic validation
- Investor materials (pitch deck) — commercial viability
- India AI regulatory tracking — regulatory tailwind

---

## Application Timeline & Milestones

**Current status:** Regular DPIIT certificate issued Aug 24, 2026

| Date | Milestone | Owner | Status |
|------|-----------|-------|--------|
| Aug 25, 2026 | Audit Deep Tech eligibility & gaps | Pavan + CA | IN PROGRESS |
| Aug 28, 2026 | Patent filing status confirmed | Pavan | TODO |
| Sep 01, 2026 | R&D spend statement compiled | Finance/Pavan | TODO |
| Sep 05, 2026 | Innovation narrative drafted | Pavan + Claude | TODO |
| Sep 08, 2026 | Commercialization roadmap drafted | Pavan + Product | TODO |
| Sep 10, 2026 | All supporting docs collected | Pavan + Admin | TODO |
| Sep 12, 2026 | Application reviewed by CA/legal | External | TODO |
| Sep 15, 2026 | Deep Tech recognition application submitted | Pavan | TODO |
| Sep 20 - Oct 20, 2026 | DPIIT review & potential clarifications | DPIIT | TODO |
| Oct 25, 2026 | Expected: Deep Tech certificate issued | DPIIT | TARGET |

---

## Key Talking Points (For Application)

Use these phrases when drafting the innovation write-up:

1. **"Runtime authority protection"** — Parmana solves the gap where initial permission doesn't guarantee safe execution
2. **"Cryptographic execution audit"** — Signed decisions, tamper-proof audit trail
3. **"Credential isolation at execution time"** — Not permission-time, but actual transaction time
4. **"Long R&D runway needed"** — Regulatory acceptance in financial services takes 3-5 years
5. **"Validated by real incident"** — UK AISI agentic supply-chain attack (Aug 2026) proves the threat model
6. **"Scalable beyond Razorpay"** — HubSpot connector roadmap shows platform ambition

---

## Red Flags to Avoid

- ❌ Claiming "authorization" without clarifying it's execution-time, not permission-time
- ❌ Overselling Razorpay as "main revenue" if still pilot-stage
- ❌ Understating R&D spend (shows lack of seriousness)
- ❌ Missing patent filings (kills "novel IP" claim)
- ❌ Vague on commercialization (looks like lab project)
- ❌ Not addressing latency gap (shows lack of technical honesty)
- ❌ Forgetting scoped-identity research gap (shows incomplete product)

---

## Next Call with Claude

When you return to this work, use this prompt to:

1. **Audit state:** "What's the current status of each checklist item?"
2. **Draft narratives:** "Write the innovation narrative (1 page) for Deep Tech application"
3. **Validate claims:** "Does our R&D evidence support 'deep tech' classification per DPIIT 2026?"
4. **Close gaps:** "What's the fastest path to get [patent filing / R&D statement / etc.]?"
5. **Review application:** "Does this draft meet DPIIT Deep Tech criteria? Any vulnerabilities?"

---

## References

- DPIIT 2026 Notification (Feb 4, 2026): Gazette G.S.R. 108(E)
- Parmana memory files: See /areas/ and /profile.md
- DPIIT portal: startupindia.gov.in
- Startup India playbook: https://www.startupindia.gov.in

---

**Last updated:** Aug 25, 2026
**Maintained by:** Claude (in conversation with Pavan)
**Status:** Active — preparing for Deep Tech application submission
