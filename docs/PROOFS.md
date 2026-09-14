\# Parmana Proofs

Version: 1.0

Status: Evidence Registry

\---

\# Purpose

This document records the implementation evidence supporting each Parmana guarantee.

A guarantee is considered proven only when sufficient evidence exists across implementation, testing, audit, and independent verification.

This document serves as the evidence registry for the Parmana architecture.

\---

\# Proof Model

Every guarantee progresses through the following lifecycle.

```text

Specification

&#x20;     ↓

Implementation

&#x20;     ↓

Unit Tests

&#x20;     ↓

Integration Tests

&#x20;     ↓

Negative Tests

&#x20;     ↓

Audit

&#x20;     ↓

Independent Verification

&#x20;     ↓

Release

```

A guarantee SHOULD NOT be marked as proven until all applicable evidence has been completed.

\---

\# Evidence Types

\## Implementation

Source code implementing the guarantee.

\---

\## Unit Tests

Component-level validation.

\---

\## Integration Tests

End-to-end validation across packages.

\---

\## Negative Tests

Verification that invalid inputs or violations are rejected.

\---

\## Audit

Manual architectural review confirming that the implementation satisfies the intended guarantee.

\---

\## Independent Verification

Evidence can be validated without trusting the original runtime.

\---

\# Proof Matrix

| Guarantee | Implementation | Unit | Integration | Negative | Audit | Independent Verification | Status |

| ------------------------------------- | :------------: | :--: | :---------: | :------: | :---: | :----------------------: | :-----: |

| G-00 Trust Architecture | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | Partial |

| G-01 Trusted Business Transaction | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | Partial |

| G-02 Deterministic Policy Selection | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | Partial |

| G-03 Deterministic Policy Evaluation | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | Partial |

| G-04 Authorized Execution | ✅ | ✅ | ⬜ | ⬜ | ✅ | ⬜ | Partial |

| G-05 Execution Trust Record Integrity | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | Partial |

| G-06 Receipt Authenticity | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | Partial |

| G-07 Independent Verification | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | Partial |

| G-08 Deterministic Replay | ✅ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ | Partial |

| G-09 API Enforcement | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Pending |

| G-10 End-to-End Execution Trust | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | Pending |

\---

\# Proof Requirements

A guarantee may be promoted to \*\*Proven\*\* only when all of the following are satisfied:

\* Implementation complete

\* Unit tests passing

\* Integration tests passing

\* Negative tests passing

\* Architectural audit completed

\* Independent verification available (where applicable)

\---

\# Audit References

Architectural audits are maintained separately.

Examples:

\* AS-001 — Trusted Vendor Payment

\* Future audits covering additional execution scenarios

Audits provide qualitative evidence that complements automated testing.

\---

\# Independent Verification

Independent verification demonstrates that execution evidence can be validated without trusting the runtime that produced it.

Examples include:

\* Trust Record integrity verification

\* Receipt signature verification

\* Replay verification

\* Hash validation

\---

\# Conformance

The Conformance Suite provides executable evidence that an implementation satisfies the Parmana specification.

Conformance testing is documented separately in `CONFORMANCE.md`.

\---

\# Evidence Promotion Policy

Evidence progresses through the following maturity levels.

| Level | Meaning |

| ----------- | ------------------------------------------ |

| Planned | Design exists, implementation not complete |

| Implemented | Source code exists |

| Tested | Automated tests exist |

| Audited | Manual architectural review completed |

| Verified | Independent verification available |

| Proven | All required evidence complete |

Guarantees SHOULD advance through these levels in order.

\---

\# Relationship to Other Documents

\* `SPECIFICATION.md` defines expected behavior.

\* `GUARANTEES.md` defines the guarantees.

\* `PROOFS.md` records the evidence supporting those guarantees.

\* `CLAIMS.md` defines which guarantees are promoted to public technical claims.

\---

\# Engineering Principle

Parmana distinguishes between implementation and proof.

Implementation demonstrates that a capability exists.

Proof demonstrates that the capability is supported by evidence.

Only evidence-backed guarantees should become public technical claims.
