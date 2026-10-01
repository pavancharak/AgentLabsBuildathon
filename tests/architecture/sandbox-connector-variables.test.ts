import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BUILT_IN_CONNECTOR_VARIABLES } from "../../packages/api/src/bootstrap/createSandboxOptions.js";

/**
 * Sandbox mode refuses to start while a built in connector is configured
 * (ADR-0014). That guard is only as good as its list of variables, so
 * this keeps the list equal to every PAYTM_, HUBSPOT_, GITHUB_ and SLACK_
 * variable the server's source reads.
 */

const root = process.cwd();

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);

    if (statSync(full).isDirectory()) {
      return entry === "node_modules" || entry === "dist" || entry === "tests"
        ? []
        : sourceFiles(full);
    }

    return full.endsWith(".ts") && !full.endsWith(".test.ts") ? [full] : [];
  });
}

describe("sandbox mode's built in connector variables", () => {
  it("lists every connector variable the server reads", () => {
    const read = new Set<string>();
    const packages = path.join(root, "packages");

    for (const name of readdirSync(packages)) {
      const src = path.join(packages, name, "src");

      if (!statSync(packages + path.sep + name).isDirectory()) continue;

      try {
        statSync(src);
      } catch {
        continue;
      }

      for (const file of sourceFiles(src)) {
        for (const match of readFileSync(file, "utf8").matchAll(
          /\b((?:PAYTM|HUBSPOT|GITHUB|SLACK)_[A-Z0-9_]+)\b/g,
        )) {
          const variable = match[1] ?? "";

          if (
            new RegExp(`process\\.env(?:\\.|\\[")${variable}\\b`).test(
              readFileSync(file, "utf8"),
            ) ||
            new RegExp(`env(?:\\.|\\[")${variable}\\b`).test(
              readFileSync(file, "utf8"),
            )
          ) {
            read.add(variable);
          }
        }
      }
    }

    expect(read.size).toBeGreaterThan(0);
    expect([...BUILT_IN_CONNECTOR_VARIABLES].sort()).toEqual(
      expect.arrayContaining([...read].sort()),
    );
  });
});
