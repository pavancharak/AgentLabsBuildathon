import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  buildApprovalIssuerRegistry,
  createApprovalIssuerRegistry,
} from "../../../src/bootstrap/createApprovalIssuerRegistry.js";

function ed25519Pem(): string {
  return generateKeyPairSync("ed25519")
    .publicKey.export({ format: "pem", type: "spki" })
    .toString();
}

const noDirectory = () => {
  throw new Error("the key directory should not be needed");
};

describe("buildApprovalIssuerRegistry", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "parmana-approvers-"));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("trusts an approver whose public key is written in the entry, without reading any directory", () => {
    const registry = buildApprovalIssuerRegistry(
      [
        {
          approverId: "manager-priya",
          keyId: "manager-priya-key-1",
          revoked: false,
          publicKeyPem: ed25519Pem(),
        },
      ],
      noDirectory,
    );

    const resolved = registry.resolve("manager-priya", "manager-priya-key-1");
    expect(resolved?.revoked).toBe(false);
    expect(resolved?.publicKey.asymmetricKeyType).toBe("ed25519");
    expect(registry.resolve("manager-priya", "other-key")).toBeUndefined();
  });

  it("reports a revoked approver as revoked", () => {
    const registry = buildApprovalIssuerRegistry(
      [
        {
          approverId: "manager-priya",
          keyId: "k1",
          revoked: true,
          publicKeyPem: ed25519Pem(),
        },
      ],
      noDirectory,
    );

    expect(registry.resolve("manager-priya", "k1")?.revoked).toBe(true);
  });

  it("still reads the key from approval-issuers/ when the entry has none", () => {
    mkdirSync(path.join(dir, "approval-issuers"), { recursive: true });
    writeFileSync(
      path.join(dir, "approval-issuers", "lead-sam__k1.public.pem"),
      ed25519Pem(),
    );

    const registry = buildApprovalIssuerRegistry(
      [{ approverId: "lead-sam", keyId: "k1", revoked: false }],
      () => dir,
    );

    expect(registry.resolve("lead-sam", "k1")).toBeDefined();
  });

  it("stops at startup when the file is missing", () => {
    expect(() =>
      buildApprovalIssuerRegistry(
        [{ approverId: "nobody", keyId: "k1", revoked: false }],
        () => dir,
      ),
    ).toThrow("Approval issuer public key not found");
  });

  it("stops at startup on a key that is not a public key", () => {
    expect(() =>
      buildApprovalIssuerRegistry(
        [
          {
            approverId: "a",
            keyId: "k1",
            revoked: false,
            publicKeyPem: "not a key",
          },
        ],
        noDirectory,
      ),
    ).toThrow("not a valid PEM public key");
  });

  it("stops at startup on a key that is not Ed25519", () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 })
      .publicKey.export({ format: "pem", type: "spki" })
      .toString();

    expect(() =>
      buildApprovalIssuerRegistry(
        [{ approverId: "a", keyId: "k1", revoked: false, publicKeyPem: rsa }],
        noDirectory,
      ),
    ).toThrow("must be Ed25519");
  });

  it("stops at startup when the same approver and key id are listed twice", () => {
    const pem = ed25519Pem();

    expect(() =>
      buildApprovalIssuerRegistry(
        [
          { approverId: "a", keyId: "k1", revoked: false, publicKeyPem: pem },
          { approverId: "a", keyId: "k1", revoked: true, publicKeyPem: pem },
        ],
        noDirectory,
      ),
    ).toThrow("listed twice");
  });

  it("is empty, and needs no key directory, with no entries", () => {
    const registry = buildApprovalIssuerRegistry([], noDirectory);

    expect(registry.resolve("anyone", "any")).toBeUndefined();
  });
});

describe("createApprovalIssuerRegistry (the list deployed to production)", () => {
  // Every configured entry carries its key inline, so building the real
  // list reads no key directory and cannot fail at startup on Vercel.
  const registry = createApprovalIssuerRegistry();

  it("trusts the refund manager's Ed25519 key, not revoked", () => {
    const manager = registry.resolve(
      "manager-charak1987",
      "manager-charak1987-key-1",
    );

    expect(manager).toBeDefined();
    expect(manager?.revoked).toBe(false);
    expect(manager?.publicKey.asymmetricKeyType).toBe("ed25519");
    expect(
      manager?.publicKey
        .export({ format: "der", type: "spki" })
        .toString("base64"),
    ).toBe("MCowBQYDK2VwAyEAVMs/E6N2XEQfEEWlwMg0wRS0L4svbZ0W785aAxUP78M=");
  });

  it("trusts no other key id for that approver, and no unknown approver", () => {
    expect(
      registry.resolve("manager-charak1987", "manager-charak1987-key-2"),
    ).toBeUndefined();
    expect(
      registry.resolve("manager-priya", "manager-priya-key-1"),
    ).toBeUndefined();
  });
});
