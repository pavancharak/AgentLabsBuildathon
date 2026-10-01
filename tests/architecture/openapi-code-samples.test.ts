import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  PYTHON_SAMPLES_DIR,
  TYPESCRIPT_SAMPLES_DIR,
  pythonSampleName,
  samplePaths,
} from "../../scripts/openapi/codeSamples.js";

/**
 * Every operation in the API reference shows an SDK sample in TypeScript
 * and in Python (scripts/add-openapi-code-samples.ts). These tests keep
 * the samples true: each one exists, the bundle holds exactly the file's
 * text, no sample is left for an operation that no longer exists, and
 * every TypeScript sample typechecks against the SDK. The Python samples
 * are checked by mypy --strict in python/tests/test_api_reference_samples.py.
 */

const root = process.cwd();
const bundle = parse(
  readFileSync(path.join(root, "openapi", "openapi.bundled.yaml"), "utf8"),
) as {
  paths: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        "x-codeSamples"?: { lang: string; label: string; source: string }[];
      }
    >
  >;
};

const operations = Object.values(bundle.paths).flatMap((item) =>
  ["get", "put", "post", "delete", "patch"]
    .map((method) => item[method])
    .filter((operation) => operation !== undefined),
);

describe("API reference code samples", () => {
  it("covers every operation with TypeScript and Python, as in the files", () => {
    expect(operations.length).toBeGreaterThan(0);

    for (const operation of operations) {
      const id = operation.operationId ?? "(no operationId)";
      const files = samplePaths(id);
      const samples = operation["x-codeSamples"] ?? [];

      expect(
        samples.map((sample) => sample.lang),
        id,
      ).toEqual(["typescript", "python"]);
      expect(samples[0]?.source, id).toBe(
        readFileSync(files.typescript, "utf8").trimEnd(),
      );
      expect(samples[1]?.source, id).toBe(
        readFileSync(files.python, "utf8").trimEnd(),
      );
    }
  });

  it("has no sample for an operation that does not exist", () => {
    const ids = operations.map((operation) => operation.operationId);

    const typescript = readdirSync(TYPESCRIPT_SAMPLES_DIR)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => file.slice(0, -3));
    const python = readdirSync(PYTHON_SAMPLES_DIR).filter((file) =>
      file.endsWith(".py"),
    );

    expect(typescript.sort()).toEqual([...ids].sort());
    expect(python.sort()).toEqual(
      ids.map((id) => pythonSampleName(id ?? "")).sort(),
    );
  });

  it("typechecks every TypeScript sample against the SDK", () => {
    // Throws, with the compiler's errors, when any sample does not typecheck.
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules", "typescript", "bin", "tsc"),
        "-p",
        path.join(TYPESCRIPT_SAMPLES_DIR, "tsconfig.json"),
      ],
      { stdio: "pipe" },
    );
  }, 120_000);
});
