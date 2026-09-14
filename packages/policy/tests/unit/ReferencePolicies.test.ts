import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { PolicyValidator } from "../../src/PolicyValidator.js";
import type { Policy } from "../../src/types/Policy.js";

function findPolicyFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findPolicyFiles(fullPath));
    } else if (entry.isFile() && entry.name === "policy.json") {
      files.push(fullPath);
    }
  }

  return files.sort();
}

describe("Reference Policy Library", () => {
  const validator = new PolicyValidator();

  const policiesRoot = path.resolve(
    import.meta.dirname,
    "../../../../policies",
  );

  const policyFiles = findPolicyFiles(policiesRoot);

  expect(policyFiles.length).toBeGreaterThan(0);

  for (const file of policyFiles) {
    const relativePath = path.relative(policiesRoot, file);

    it(relativePath, () => {
      console.log("Validating:", relativePath);

      const text = readFileSync(file, "utf8");

      expect(text.trim().length).toBeGreaterThan(0);

      let policy: Policy;

      try {
        policy = JSON.parse(text) as Policy;
      } catch (error) {
        throw new Error(`Failed to parse JSON in ${relativePath}`, {
          cause: error,
        });
      }

      expect(() => validator.validate(policy)).not.toThrow();
    });
  }
});
