import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CryptoBootstrap, ArtifactSigner } from "@parmana/crypto";
import { MemoryNonceStore } from "@parmana/envelope-verifier";
import type { ApprovalPayload, SignedApproval } from "@parmana/shared";

import { ApprovalVerifier } from "../../src/ApprovalVerifier.js";
import { StaticApprovalIssuerRegistry } from "../../src/ApprovalIssuerRegistry.js";

/**
 * TD-23 closure, Phase 3C. Implements the exact deterministic
 * verification algorithm frozen in
 * docs/architecture/phase3a-authorization-artifact-design.md §10.
 */
const crypto = CryptoBootstrap.create();

function generateKeyPair() {
  return generateKeyPairSync("ed25519");
}

async function signPayload(
  payload: ApprovalPayload,
  privateKey: ReturnType<typeof generateKeyPair>["privateKey"],
): Promise<SignedApproval> {
  const signer = new ArtifactSigner(crypto);
  const value = await signer.sign(payload, privateKey);

  return {
    payload,
    signature: {
      algorithm: crypto.signature.algorithm,
      keyId: payload.issuer.keyId,
      value,
      signedAt: new Date(),
    },
  };
}

function buildPayload(
  overrides: Partial<ApprovalPayload> = {},
): ApprovalPayload {
  const now = new Date("2026-08-05T12:00:00.000Z");
  const later = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    version: 1,
    approvalId: "approval-1",
    issuer: { approverId: "manager-jane", keyId: "manager-jane-key-1" },
    issuedAt: now.toISOString(),
    expiresAt: later.toISOString(),
    capability: "hubspot:deal-update",
    resourceId: "9005",
    scope: { field: "amountDeltaAbs", comparator: "lte", value: 50_000 },
    nonce: "nonce-1",
    ...overrides,
  };
}

describe("ApprovalVerifier", () => {
  it("verifies a well-formed artifact from a trusted, unrevoked issuer, within scope", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(buildPayload(), privateKey);

    const result = await verifier.verify(
      artifact,
      {
        action: "hubspot:deal-update",
        resourceId: "9005",
        requestedValue: 40_000,
      },
      new Date("2026-08-05T12:30:00.000Z"),
    );

    expect(result.valid).toBe(true);
    expect(result.checks).toEqual({
      versionSupported: true,
      issuerKnown: true,
      signatureVerified: true,
      notExpired: true,
      notRevoked: true,
      capabilityMatches: true,
      resourceMatches: true,
      scopeSatisfied: true,
      nonceUnseen: true,
    });
  });

  it("rejects a malformed artifact: unsupported payload version, before any other check runs", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(
      buildPayload({ version: 2 as unknown as 1 }),
      privateKey,
    );

    const result = await verifier.verify(artifact, {
      action: "hubspot:deal-update",
      resourceId: "9005",
      requestedValue: 40_000,
    });

    expect(result.valid).toBe(false);
    expect(result.checks.versionSupported).toBe(false);
  });

  it("(unknown issuer) rejects an artifact whose (approverId, keyId) is not registered", async () => {
    const { privateKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(buildPayload(), privateKey);

    const result = await verifier.verify(artifact, {
      action: "hubspot:deal-update",
      resourceId: "9005",
      requestedValue: 40_000,
    });

    expect(result.valid).toBe(false);
    expect(result.checks.issuerKnown).toBe(false);
    expect(result.checks.signatureVerified).toBe(false);
  });

  it("(revoked issuer) rejects an otherwise-valid artifact whose issuer key is marked revoked", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: true,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(buildPayload(), privateKey);

    const result = await verifier.verify(
      artifact,
      {
        action: "hubspot:deal-update",
        resourceId: "9005",
        requestedValue: 40_000,
      },
      new Date("2026-08-05T12:30:00.000Z"),
    );

    expect(result.valid).toBe(false);
    expect(result.checks.notRevoked).toBe(false);
    // The signature itself is genuinely valid -- revocation is a
    // distinct, independent check, not merely a signature failure.
    expect(result.checks.signatureVerified).toBe(true);
  });

  it("(invalid signature) rejects an artifact whose payload was modified after signing", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(buildPayload(), privateKey);

    const tampered: SignedApproval = {
      ...artifact,
      payload: {
        ...artifact.payload,
        scope: { ...artifact.payload.scope, value: 999_999_999 },
      },
    };

    const result = await verifier.verify(
      tampered,
      {
        action: "hubspot:deal-update",
        resourceId: "9005",
        requestedValue: 40_000,
      },
      new Date("2026-08-05T12:30:00.000Z"),
    );

    expect(result.valid).toBe(false);
    expect(result.checks.signatureVerified).toBe(false);
  });

  it("(forged signature) rejects an artifact signed by a key never registered for that approverId", async () => {
    const legitimate = generateKeyPair();
    const forger = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey: legitimate.publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    // Forged: claims to be manager-jane-key-1 but is actually signed
    // by an entirely different keypair the AI (or an attacker) holds.
    const forged = await signPayload(buildPayload(), forger.privateKey);

    const result = await verifier.verify(
      forged,
      {
        action: "hubspot:deal-update",
        resourceId: "9005",
        requestedValue: 40_000,
      },
      new Date("2026-08-05T12:30:00.000Z"),
    );

    expect(result.valid).toBe(false);
    expect(result.checks.signatureVerified).toBe(false);
  });

  it("(expired) rejects an artifact past its expiresAt", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(buildPayload(), privateKey);

    const result = await verifier.verify(
      artifact,
      {
        action: "hubspot:deal-update",
        resourceId: "9005",
        requestedValue: 40_000,
      },
      new Date("2026-08-05T14:00:00.000Z"), // one hour after expiresAt
    );

    expect(result.valid).toBe(false);
    expect(result.checks.notExpired).toBe(false);
  });

  it("(capability substitution) rejects an artifact presented for a different capability than it was issued for", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(buildPayload(), privateKey);

    const result = await verifier.verify(
      artifact,
      {
        action: "razorpay:refund-create",
        resourceId: "9005",
        requestedValue: 40_000,
      },
      new Date("2026-08-05T12:30:00.000Z"),
    );

    expect(result.valid).toBe(false);
    expect(result.checks.capabilityMatches).toBe(false);
  });

  it("(authorization transfer) rejects an artifact presented for a different business object than it was issued for", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(buildPayload(), privateKey);

    const result = await verifier.verify(
      artifact,
      {
        action: "hubspot:deal-update",
        resourceId: "SOME-OTHER-DEAL",
        requestedValue: 40_000,
      },
      new Date("2026-08-05T12:30:00.000Z"),
    );

    expect(result.valid).toBe(false);
    expect(result.checks.resourceMatches).toBe(false);
  });

  it("(scope escalation / amount modification) rejects when the real requested value exceeds the approved bound", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    // Approved for up to 50,000; the real request asks for 999,999 --
    // proves the bound is checked against the real, independently
    // derived value, not merely present/absent.
    const artifact = await signPayload(buildPayload(), privateKey);

    const result = await verifier.verify(
      artifact,
      {
        action: "hubspot:deal-update",
        resourceId: "9005",
        requestedValue: 999_999,
      },
      new Date("2026-08-05T12:30:00.000Z"),
    );

    expect(result.valid).toBe(false);
    expect(result.checks.scopeSatisfied).toBe(false);
  });

  it("(between comparator) supports a range bound", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(
      buildPayload({
        scope: {
          field: "amountDeltaAbs",
          comparator: "between",
          value: { min: 10_000, max: 60_000 },
        },
      }),
      privateKey,
    );

    const within = await verifier.verify(
      artifact,
      {
        action: "hubspot:deal-update",
        resourceId: "9005",
        requestedValue: 40_000,
      },
      new Date("2026-08-05T12:30:00.000Z"),
    );
    expect(within.checks.scopeSatisfied).toBe(true);
  });

  it("(replay) rejects a second presentation of the same artifact after a successful first verification", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(buildPayload(), privateKey);
    const request = {
      action: "hubspot:deal-update",
      resourceId: "9005",
      requestedValue: 40_000,
    };
    const now = new Date("2026-08-05T12:30:00.000Z");

    const first = await verifier.verify(artifact, request, now);
    expect(first.valid).toBe(true);

    const second = await verifier.verify(artifact, request, now);
    expect(second.valid).toBe(false);
    expect(second.checks.nonceUnseen).toBe(false);
  });

  it("a request rejected on an unrelated ground never burns the nonce, so a corrected retry can still succeed", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const verifier = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const artifact = await signPayload(buildPayload(), privateKey);
    const now = new Date("2026-08-05T12:30:00.000Z");

    // First attempt: wrong resourceId -- rejected on resourceMatches,
    // never reaches the nonce check.
    const rejected = await verifier.verify(
      artifact,
      {
        action: "hubspot:deal-update",
        resourceId: "WRONG-DEAL",
        requestedValue: 40_000,
      },
      now,
    );
    expect(rejected.valid).toBe(false);
    expect(rejected.checks.nonceUnseen).toBe(false);

    // Second attempt, same artifact, corrected resourceId -- succeeds,
    // proving the first rejection never consumed the nonce.
    const corrected = await verifier.verify(
      artifact,
      {
        action: "hubspot:deal-update",
        resourceId: "9005",
        requestedValue: 40_000,
      },
      now,
    );
    expect(corrected.valid).toBe(true);
  });

  it("(cross-process replay) rejects a second presentation to an independent ApprovalVerifier instance sharing the same durable nonce store", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    // Simulates two separate processes/requests, each constructing
    // their own ApprovalVerifier, but both backed by the same durable
    // NonceStore (e.g. SupabaseApprovalNonceStore in production) --
    // replay protection must be a property of the shared store, not
    // of any single verifier instance's in-process state.
    const sharedNonceStore = new MemoryNonceStore();
    const artifact = await signPayload(buildPayload(), privateKey);
    const request = {
      action: "hubspot:deal-update",
      resourceId: "9005",
      requestedValue: 40_000,
    };
    const now = new Date("2026-08-05T12:30:00.000Z");

    const verifierProcessA = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: sharedNonceStore,
    });
    const verifierProcessB = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: sharedNonceStore,
    });

    const first = await verifierProcessA.verify(artifact, request, now);
    expect(first.valid).toBe(true);

    const second = await verifierProcessB.verify(artifact, request, now);
    expect(second.valid).toBe(false);
    expect(second.checks.nonceUnseen).toBe(false);
  });

  it("is deterministic: identical (artifact, request, now) inputs always produce identical checks", async () => {
    const { privateKey, publicKey } = generateKeyPair();

    const registry = new StaticApprovalIssuerRegistry([
      {
        approverId: "manager-jane",
        keyId: "manager-jane-key-1",
        publicKey,
        revoked: false,
      },
    ]);

    const artifact = await signPayload(buildPayload(), privateKey);
    const request = {
      action: "hubspot:deal-update",
      resourceId: "9005",
      requestedValue: 40_000,
    };
    const now = new Date("2026-08-05T12:30:00.000Z");

    // Two independent verifiers, each with their own fresh nonce
    // store, verifying the same inputs once each -- since nonce state
    // is the only stateful exception, a single verification against
    // two fresh stores must agree exactly.
    const verifierA = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });
    const verifierB = new ApprovalVerifier({
      crypto,
      issuerRegistry: registry,
      nonceStore: new MemoryNonceStore(),
    });

    const resultA = await verifierA.verify(artifact, request, now);
    const resultB = await verifierB.verify(artifact, request, now);

    expect(resultA).toEqual(resultB);
  });
});
