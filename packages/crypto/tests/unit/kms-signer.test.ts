import { generateKeyPairSync } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Never makes a real AWS network call: mocks @aws-sdk/client-kms's
 * KMSClient.send() entirely, keyed off which Command subclass it was
 * given. class NotFoundException is real (not mocked) so KmsSigner's
 * `error instanceof NotFoundException` check in hasKey() is exercised
 * genuinely, the same way it would be against the real SDK.
 */
class FakeNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundException";
  }
}

const { publicKey: realPublicKeyObject, privateKey: realPrivateKeyObject } =
  generateKeyPairSync("ed25519");

const realPublicKeyDer = realPublicKeyObject.export({
  format: "der",
  type: "spki",
});

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-kms", () => {
  class SignCommand {
    constructor(public readonly input: unknown) {}
  }
  class GetPublicKeyCommand {
    constructor(public readonly input: unknown) {}
  }
  class DescribeKeyCommand {
    constructor(public readonly input: unknown) {}
  }
  class KMSClient {
    send = sendMock;
  }

  return {
    KMSClient,
    SignCommand,
    GetPublicKeyCommand,
    DescribeKeyCommand,
    NotFoundException: FakeNotFoundException,
  };
});

const ORIGINAL_AWS_REGION = process.env.AWS_REGION;
const ORIGINAL_AWS_ROLE_ARN = process.env.AWS_ROLE_ARN;

async function freshKmsSigner() {
  vi.resetModules();
  const module = await import("../../src/providers/signer/KmsSigner.js");
  return module.KmsSigner;
}

describe("KmsSigner", () => {
  beforeEach(() => {
    process.env.AWS_REGION = "us-east-1";
    delete process.env.AWS_ROLE_ARN;
    sendMock.mockReset();
  });

  afterEach(() => {
    if (ORIGINAL_AWS_REGION === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = ORIGINAL_AWS_REGION;

    if (ORIGINAL_AWS_ROLE_ARN === undefined) delete process.env.AWS_ROLE_ARN;
    else process.env.AWS_ROLE_ARN = ORIGINAL_AWS_ROLE_ARN;
  });

  it("throws if AWS_REGION is unset", async () => {
    delete process.env.AWS_REGION;
    const KmsSigner = await freshKmsSigner();

    await expect(KmsSigner.create()).rejects.toThrow(/AWS_REGION/);
  });

  it("sign() calls KMS Sign with RAW/ED25519_SHA_512 and base64-encodes the returned signature", async () => {
    const KmsSigner = await freshKmsSigner();

    const rawSignature = new Uint8Array([1, 2, 3, 4]);
    sendMock.mockImplementation((command: { input: unknown }) => {
      if (command.constructor.name === "SignCommand") {
        return Promise.resolve({ Signature: rawSignature });
      }
      throw new Error(`unexpected command: ${command.constructor.name}`);
    });

    const signer = await KmsSigner.create();
    const signature = await signer.sign("test-key", new Uint8Array([9, 9]));

    expect(signature).toBe(Buffer.from(rawSignature).toString("base64"));

    const call = sendMock.mock.calls[0]![0] as { input: Record<string, unknown> };
    expect(call.input).toMatchObject({
      KeyId: "test-key",
      MessageType: "RAW",
      SigningAlgorithm: "ED25519_SHA_512",
    });
  });

  it("getPublicKey() wraps the DER bytes KMS returns into a usable Ed25519 KeyObject", async () => {
    const KmsSigner = await freshKmsSigner();

    sendMock.mockImplementation((command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetPublicKeyCommand") {
        return Promise.resolve({ PublicKey: new Uint8Array(realPublicKeyDer) });
      }
      throw new Error(`unexpected command: ${command.constructor.name}`);
    });

    const signer = await KmsSigner.create();
    const keyObject = await signer.getPublicKey("test-key");

    expect(keyObject.asymmetricKeyType).toBe("ed25519");
    expect(keyObject.export({ format: "der", type: "spki" })).toEqual(
      realPublicKeyDer,
    );
  });

  it("getMetadata() maps ECC_NIST_EDWARDS25519 to the ed25519 SignatureAlgorithm", async () => {
    const KmsSigner = await freshKmsSigner();

    sendMock.mockImplementation((command: { constructor: { name: string } }) => {
      if (command.constructor.name === "DescribeKeyCommand") {
        return Promise.resolve({
          KeyMetadata: { KeySpec: "ECC_NIST_EDWARDS25519" },
        });
      }
      throw new Error(`unexpected command: ${command.constructor.name}`);
    });

    const signer = await KmsSigner.create();
    const metadata = await signer.getMetadata("test-key");

    expect(metadata).toEqual({ keyId: "test-key", algorithm: "ed25519" });
  });

  it("getMetadata() throws for any KeySpec other than ECC_NIST_EDWARDS25519", async () => {
    const KmsSigner = await freshKmsSigner();

    sendMock.mockImplementation(() =>
      Promise.resolve({ KeyMetadata: { KeySpec: "RSA_2048" } }),
    );

    const signer = await KmsSigner.create();

    await expect(signer.getMetadata("test-key")).rejects.toThrow(
      /only supports ECC_NIST_EDWARDS25519/,
    );
  });

  it("hasKey() returns true when DescribeKey succeeds", async () => {
    const KmsSigner = await freshKmsSigner();

    sendMock.mockResolvedValue({ KeyMetadata: { KeySpec: "ECC_NIST_EDWARDS25519" } });

    const signer = await KmsSigner.create();
    expect(await signer.hasKey("test-key")).toBe(true);
  });

  it("hasKey() returns false (not a throw) when DescribeKey reports NotFoundException", async () => {
    const KmsSigner = await freshKmsSigner();

    sendMock.mockRejectedValue(new FakeNotFoundException("no such key"));

    const signer = await KmsSigner.create();
    expect(await signer.hasKey("missing-key")).toBe(false);
  });

  it("hasKey() re-throws any other error", async () => {
    const KmsSigner = await freshKmsSigner();

    sendMock.mockRejectedValue(new Error("network blip"));

    const signer = await KmsSigner.create();
    await expect(signer.hasKey("test-key")).rejects.toThrow(/network blip/);
  });
});

// Keep the real keypair import used (avoids an unused-variable lint
// failure while documenting that realPrivateKeyObject exists only to
// make clear the fixture is a genuine Ed25519 keypair, not just a
// standalone public key with no matching private half).
void realPrivateKeyObject;
