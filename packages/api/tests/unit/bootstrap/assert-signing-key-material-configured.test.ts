import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assertSigningKeyMaterialConfigured } from "../../../src/bootstrap/assertSigningKeyMaterialConfigured.js";

const ENV_KEYS = [
  "NODE_ENV",
  "PARMANA_KEY_DIR",
  "PARMANA_KEY_MATERIAL_JSON",
] as const;

describe("assertSigningKeyMaterialConfigured", () => {
  const original = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "parmana-key-test-"));
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("is a no-op when NODE_ENV=test, regardless of key material presence", () => {
    process.env.NODE_ENV = "test";
    process.env.PARMANA_KEY_DIR = join(tempDir, "does-not-exist");

    expect(() => assertSigningKeyMaterialConfigured()).not.toThrow();
  });

  it("refuses to start when PARMANA_KEY_DIR is unset", () => {
    process.env.NODE_ENV = "production";
    delete process.env.PARMANA_KEY_DIR;

    expect(() => assertSigningKeyMaterialConfigured()).toThrow(
      /PARMANA_KEY_DIR is not set/,
    );
  });

  it("refuses to start when PARMANA_KEY_DIR is blank", () => {
    process.env.NODE_ENV = "production";
    process.env.PARMANA_KEY_DIR = "   ";

    expect(() => assertSigningKeyMaterialConfigured()).toThrow(
      /PARMANA_KEY_DIR is not set/,
    );
  });

  it("fails closed with a named, actionable error when the default key pair is absent", () => {
    process.env.NODE_ENV = "production";
    process.env.PARMANA_KEY_DIR = tempDir;
    delete process.env.PARMANA_KEY_MATERIAL_JSON;

    expect(() => assertSigningKeyMaterialConfigured()).toThrow(
      /default\.private\.pem/,
    );
    expect(() => assertSigningKeyMaterialConfigured()).toThrow(
      /Refusing to start/,
    );
  });

  it("does not throw when the default key pair already exists on disk", () => {
    process.env.NODE_ENV = "production";
    process.env.PARMANA_KEY_DIR = tempDir;
    delete process.env.PARMANA_KEY_MATERIAL_JSON;

    writeFileSync(
      join(tempDir, "default.private.pem"),
      "-----BEGIN PRIVATE KEY-----\nexisting\n-----END PRIVATE KEY-----\n",
    );
    writeFileSync(
      join(tempDir, "default.public.pem"),
      "-----BEGIN PUBLIC KEY-----\nexisting\n-----END PUBLIC KEY-----\n",
    );

    expect(() => assertSigningKeyMaterialConfigured()).not.toThrow();
  });

  it("materializes key material from PARMANA_KEY_MATERIAL_JSON when the key directory is empty", () => {
    process.env.NODE_ENV = "production";
    process.env.PARMANA_KEY_DIR = join(tempDir, "materialized");
    process.env.PARMANA_KEY_MATERIAL_JSON = JSON.stringify({
      default: {
        privateKeyPem:
          "-----BEGIN PRIVATE KEY-----\nfrom-env\n-----END PRIVATE KEY-----\n",
        publicKeyPem:
          "-----BEGIN PUBLIC KEY-----\nfrom-env\n-----END PUBLIC KEY-----\n",
      },
    });

    expect(() => assertSigningKeyMaterialConfigured()).not.toThrow();

    const privateContent = readFileSync(
      join(tempDir, "materialized", "default.private.pem"),
      "utf8",
    );
    expect(privateContent).toContain("from-env");
  });

  it("never overwrites a pre-mounted key file with PARMANA_KEY_MATERIAL_JSON's value", () => {
    process.env.NODE_ENV = "production";
    process.env.PARMANA_KEY_DIR = tempDir;
    writeFileSync(
      join(tempDir, "default.private.pem"),
      "-----BEGIN PRIVATE KEY-----\nmounted\n-----END PRIVATE KEY-----\n",
    );
    writeFileSync(
      join(tempDir, "default.public.pem"),
      "-----BEGIN PUBLIC KEY-----\nmounted\n-----END PUBLIC KEY-----\n",
    );
    process.env.PARMANA_KEY_MATERIAL_JSON = JSON.stringify({
      default: {
        privateKeyPem:
          "-----BEGIN PRIVATE KEY-----\nfrom-env\n-----END PRIVATE KEY-----\n",
        publicKeyPem:
          "-----BEGIN PUBLIC KEY-----\nfrom-env\n-----END PUBLIC KEY-----\n",
      },
    });

    expect(() => assertSigningKeyMaterialConfigured()).not.toThrow();

    const privateContent = readFileSync(
      join(tempDir, "default.private.pem"),
      "utf8",
    );
    expect(privateContent).toContain("mounted");
    expect(privateContent).not.toContain("from-env");
  });

  it("fails closed with a named, actionable error when PARMANA_KEY_MATERIAL_JSON is not valid JSON", () => {
    process.env.NODE_ENV = "production";
    process.env.PARMANA_KEY_DIR = tempDir;
    process.env.PARMANA_KEY_MATERIAL_JSON = "{not valid json";

    expect(() => assertSigningKeyMaterialConfigured()).toThrow(
      /not valid JSON/,
    );
  });

  it("fails closed with a named, actionable error when an entry is malformed", () => {
    process.env.NODE_ENV = "production";
    process.env.PARMANA_KEY_DIR = tempDir;
    process.env.PARMANA_KEY_MATERIAL_JSON = JSON.stringify({
      default: { privateKeyPem: 123 },
    });

    expect(() => assertSigningKeyMaterialConfigured()).toThrow(/privateKeyPem/);
  });
});
