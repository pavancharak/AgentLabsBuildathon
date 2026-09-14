\# 015 — Platform Architecture

\## Status

\*\*Version:\*\* 0.1.0

\*\*Status:\*\* Draft

\---

\# Purpose

This document defines the logical architecture of the Parmana platform.

It describes the major platform components, their responsibilities, and the boundaries between them.

This document is normative.

\---

\# Platform Overview

Parmana is an Execution Trust Platform.

It establishes a verifiable trust chain between:

\* Authority

\* Intent

\* Authorization

\* Execution

\* Evidence

\* Verification

The platform is organized as a set of independent packages that collaborate through immutable domain models.

\---

\# High-Level Architecture

```text

&#x20;                   Applications

&#x20;                         │

&#x20;                         ▼

&#x20;                ┌─────────────────┐

&#x20;                │       SDK       │

&#x20;                └─────────────────┘

&#x20;                         │

&#x20;                         ▼

&#x20;                ┌─────────────────┐

&#x20;                │     Runtime     │

&#x20;                └─────────────────┘

&#x20;                         │

&#x20;                         ▼

&#x20;             ExecutionTransaction

&#x20;                         │

&#x20;         ┌───────────────┼───────────────┐

&#x20;         ▼               ▼               ▼

&#x20;    Evidence        Verification     Cryptography

&#x20;         │               │               │

&#x20;         └───────────────┼───────────────┘

&#x20;                         ▼

&#x20;                     Storage

```

\---

\# Core Package

The Core package defines the canonical domain model.

Responsibilities:

\* Domain entities

\* Value objects

\* Aggregate roots

\* Shared types

The Core package contains no business execution logic.

\---

\# Runtime Package

The Runtime orchestrates execution.

Responsibilities:

\* Runtime pipeline

\* Stage orchestration

\* Transaction lifecycle

The Runtime does not perform verification.

\---

\# Verification Package

The Verification package independently evaluates completed transactions.

Responsibilities:

\* Verification pipeline

\* Trust evaluation

\* Verification reports

The Verification package never executes transactions.

\---

\# Evidence Package

The Evidence package manages immutable execution artifacts.

Responsibilities:

\* Evidence artifacts

\* Evidence collections

\* Evidence serialization

\---

\# Cryptography Package

The Cryptography package provides integrity services.

Responsibilities:

\* Hashing

\* Signatures

\* Integrity verification

\* Cryptographic providers

Cryptographic algorithms remain replaceable.

\---

\# Storage Package

The Storage package persists immutable artifacts.

Responsibilities:

\* Transaction persistence

\* Evidence persistence

\* Verification persistence

Storage implementations remain independent of the Runtime.

\---

\# SDK Package

The SDK provides the public developer API.

Responsibilities:

\* Client APIs

\* Builders

\* Convenience abstractions

The SDK hides internal implementation details.

\---

\# API Package

The API exposes Parmana over HTTP.

Responsibilities:

\* REST endpoints

\* Request validation

\* Response serialization

The API delegates execution to the Runtime.

\---

\# CLI Package

The CLI provides command-line access to the platform.

Responsibilities:

\* Local execution

\* Verification

\* Diagnostics

\* Administration

\---

\# Dependency Rules

Dependencies flow inward.

```text

CLI

API

SDK

&#x20;   │

&#x20;   ▼

Runtime

Verification

Evidence

Cryptography

Storage

&#x20;   │

&#x20;   ▼

Core

```

Core has no dependency on higher-level packages.

Verification never depends on Runtime internals.

Runtime never depends on Verification.

\---

\# Architectural Principles

The platform is governed by the following principles:

\* Immutability

\* Determinism

\* Independent verification

\* Separation of concerns

\* Replaceable implementations

\* Technology independence

\---

\# Summary

Parmana is organized as a layered execution trust platform.

Each package has a single responsibility.

Together, they provide deterministic execution, immutable evidence, and independently verifiable trust.
