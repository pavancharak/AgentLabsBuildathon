import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where the SDK code sample for each OpenAPI operation lives: one
 * TypeScript and one Python file per operationId. Shared by
 * scripts/add-openapi-code-samples.ts, which puts them in the bundle,
 * and the test that typechecks them.
 */

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const TYPESCRIPT_SAMPLES_DIR = path.join(
  root,
  "typescript",
  "examples",
  "api-reference",
);
export const PYTHON_SAMPLES_DIR = path.join(
  root,
  "python",
  "examples",
  "api_reference",
);

export function pythonSampleName(operationId: string): string {
  return `${operationId.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}.py`;
}

export function samplePaths(operationId: string): {
  typescript: string;
  python: string;
} {
  return {
    typescript: path.join(TYPESCRIPT_SAMPLES_DIR, `${operationId}.ts`),
    python: path.join(PYTHON_SAMPLES_DIR, pythonSampleName(operationId)),
  };
}
