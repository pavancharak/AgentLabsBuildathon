\# Parmana Glossary

\*\*Version:\*\* 0.1.0

\---

\# Purpose

This glossary defines the canonical terminology used throughout the Parmana Specification.

Unless explicitly stated otherwise, these definitions are normative.

\---

\# Authority

The entity responsible for initiating or approving an execution.

Authority answers the question:

> Who decided?

\---

\# Intent

The explicit description of the desired outcome.

Intent answers:

> What should happen?

\---

\# Authorization

The decision permitting or denying execution.

Authorization answers:

> Was execution allowed?

\---

\# Execution

The actual realization of the authorized intent.

Execution answers:

> What happened?

\---

\# Evidence

Immutable artifacts describing execution.

Evidence enables replay, audit, and verification.

\---

\# Verification

The independent evaluation of an execution record.

Verification answers:

> Can the recorded execution be trusted?

\---

\# Execution Trust

The architectural property established when an independent verifier can demonstrate that execution faithfully reflects authorized intent using immutable evidence.

Execution Trust is the primary objective of Parmana.

\---

\# ExecutionTransaction

The immutable aggregate root representing a single execution lifecycle.

It contains:

\* Authority

\* Intent

\* Authorization

\* Execution

\* Evidence

\---

\# Runtime

The subsystem responsible for orchestrating execution.

The Runtime produces execution records.

The Runtime does not establish trust.

\---

\# Runtime Pipeline

An ordered sequence of Runtime Components that transform an immutable `ExecutionTransaction`.

\---

\# Runtime Component

A deterministic execution stage participating in the Runtime Pipeline.

Each component accepts an immutable transaction and returns a new immutable transaction.

\---

\# Verification Engine

The subsystem responsible for independently evaluating execution records.

The Verification Engine consumes immutable transactions and produces verification reports.

\---

\# Verification Report

The immutable result produced by the Verification Engine.

A report summarizes the outcome of verification without modifying the execution record.

\---

\# Replay

The deterministic reconstruction of execution semantics using preserved execution records and evidence.

Replay is used to validate that execution can be reproduced from recorded facts.

\---

\# Deterministic Execution

Execution in which equivalent recorded inputs produce equivalent observable results.

Deterministic execution is required for replay and independent verification.

\---

\# Append-Only Evidence

An evidence model in which historical artifacts are never modified or deleted.

New information is represented by appending additional evidence rather than altering existing records.

\---

\# Cryptographic Agility

The architectural principle that cryptographic algorithms are replaceable implementation details rather than fixed domain concepts.

\---

\# Platform Guarantee

A behavior that every conformant Parmana implementation must preserve.

Examples include deterministic execution, immutable records, and independent verification.

\---

\# Conformance

The property of satisfying the Parmana Specification and Platform Guarantees.

Conformance is demonstrated through implementation behavior rather than implementation details.

\---

\# Reference Implementation

The official implementation maintained by the Parmana project.

The reference implementation demonstrates one correct realization of the specification but is not the specification itself.

\---

\# Specification

The normative set of documents that define Parmana's architecture, behavior, and contracts.

Implementations conform to the specification rather than to a particular codebase.
