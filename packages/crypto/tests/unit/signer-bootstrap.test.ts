import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SignerBootstrap.create() caches its result in a private static
 * field, so each test needs its own module instance -- same pattern
 * as key-bootstrap.test.ts. @aws-sdk/client-kms's KmsSigner.create()
 * is mocked so the aws-kms branch never makes a real network call;
 * kms-signer.test.ts already covers KmsSigner's own behavior in
 * isolation.
 */
const kmsSignerCreateMock = vi.fn();

vi.mock("../../src/providers/signer/KmsSigner.js", () => ({
  KmsSigner: { create: kmsSignerCreateMock },
}));

async function freshSignerBootstrap() {
  vi.resetModules();
  const module = await import("../../src/SignerBootstrap.js");
  return module.SignerBootstrap;
}

const ORIGINAL_KEY_PROVIDER = process.env.KEY_PROVIDER;
const ORIGINAL_KEY_DIR = process.env.PARMANA_KEY_DIR;

describe("SignerBootstrap", () => {
  beforeEach(() => {
    process.env.PARMANA_KEY_DIR ??= "./keys";
    kmsSignerCreateMock.mockReset();
  });

  afterEach(() => {
    if (ORIGINAL_KEY_PROVIDER === undefined) delete process.env.KEY_PROVIDER;
    else process.env.KEY_PROVIDER = ORIGINAL_KEY_PROVIDER;

    if (ORIGINAL_KEY_DIR === undefined) delete process.env.PARMANA_KEY_DIR;
    else process.env.PARMANA_KEY_DIR = ORIGINAL_KEY_DIR;
  });

  it("constructs a LocalFileSigner when KEY_PROVIDER is unset (defaults to local)", async () => {
    delete process.env.KEY_PROVIDER;

    const SignerBootstrap = await freshSignerBootstrap();
    const signer = await SignerBootstrap.create();

    expect(signer.constructor.name).toBe("LocalFileSigner");
    expect(kmsSignerCreateMock).not.toHaveBeenCalled();
  });

  it("constructs a LocalFileSigner when KEY_PROVIDER=local", async () => {
    process.env.KEY_PROVIDER = "local";

    const SignerBootstrap = await freshSignerBootstrap();
    const signer = await SignerBootstrap.create();

    expect(signer.constructor.name).toBe("LocalFileSigner");
  });

  it("constructs a KmsSigner when KEY_PROVIDER=aws-kms", async () => {
    process.env.KEY_PROVIDER = "aws-kms";
    const fakeKmsSigner = { marker: "fake-kms-signer" };
    kmsSignerCreateMock.mockResolvedValue(fakeKmsSigner);

    const SignerBootstrap = await freshSignerBootstrap();
    const signer = await SignerBootstrap.create();

    expect(signer).toBe(fakeKmsSigner);
    expect(kmsSignerCreateMock).toHaveBeenCalledTimes(1);
  });

  it("caches the resolved signer across repeated calls (does not re-invoke KmsSigner.create())", async () => {
    process.env.KEY_PROVIDER = "aws-kms";
    kmsSignerCreateMock.mockResolvedValue({ marker: "fake" });

    const SignerBootstrap = await freshSignerBootstrap();

    await SignerBootstrap.create();
    await SignerBootstrap.create();

    expect(kmsSignerCreateMock).toHaveBeenCalledTimes(1);
  });

  it.each(["azure-key-vault", "gcp-kms", "hsm"])(
    "fails loudly instead of silently falling back to LocalFileSigner when KEY_PROVIDER=%s",
    async (provider) => {
      process.env.KEY_PROVIDER = provider;

      const SignerBootstrap = await freshSignerBootstrap();

      await expect(SignerBootstrap.create()).rejects.toThrow(/not implemented/);
      await expect(SignerBootstrap.create()).rejects.toThrow(new RegExp(provider));
    },
  );
});
