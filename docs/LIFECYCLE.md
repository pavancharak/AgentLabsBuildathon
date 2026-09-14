\# Parmana Development Lifecycle

Every Parmana capability follows the same lifecycle.

Idea

↓

Architecture

↓

Implementation

↓

Unit Tests

↓

Integration Tests

↓

Audit

↓

Guarantee

↓

Proof

↓

Release

No feature is considered complete until it has:

\- implementation

\- automated tests

\- audit evidence

\- documented guarantee

\- documented proof

\---

\# Release Gate

A release is permitted only when every guarantee satisfies:

Implementation

✅

Tests

✅

Audit

✅

Independent Verification

✅

Otherwise the guarantee remains partially proven.
