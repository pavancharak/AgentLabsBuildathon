import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { afterAll } from "vitest";

/**
 * Deterministic, once-per-worker .env load (G-14).
 *
 * Every vitest worker gets its own snapshot of process.env, so whether a
 * given test file "sees" SUPABASE_URL used to depend on whether that
 * file's own import graph happened to transitively trigger the
 * dotenv.config() side effect inside packages/shared/src/config/Config.ts
 * — a coincidence of import order, not a real gate decision. Loading here
 * instead, in the one file every worker always runs first, makes env
 * visibility identical across all workers regardless of which test files
 * they happen to execute. override:false matches Config.ts's own
 * dotenv.config() call, so neither load can clobber the other or an
 * already-set shell env var.
 */
const repoRoot = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: join(repoRoot, ".env"),
  override: false,
});

/**
 * Global hermetic key material.
 *
 * Every test file gets its own temporary Ed25519 keypair.
 * Both the Runtime signer and the Execution Gateway verifier
 * are configured to use this same keypair.
 */
const keyDir = mkdtempSync(join(tmpdir(), "parmana-vitest-keys-"));

const { privateKey, publicKey } = generateKeyPairSync("ed25519");

writeFileSync(
  join(keyDir, "default.private.pem"),
  privateKey.export({
    format: "pem",
    type: "pkcs8",
  }),
);

writeFileSync(
  join(keyDir, "default.public.pem"),
  publicKey.export({
    format: "pem",
    type: "spki",
  }),
);

/**
 * Separate hermetic keypair for the Execution Gateway's attestation
 * signing (createGatewayKeyPair.ts), distinct from the authorization
 * keypair above — same trust-domain separation as production.
 */
const gatewayKeyPair = generateKeyPairSync("ed25519");

writeFileSync(
  join(keyDir, "gateway.private.pem"),
  gatewayKeyPair.privateKey.export({
    format: "pem",
    type: "pkcs8",
  }),
);

writeFileSync(
  join(keyDir, "gateway.public.pem"),
  gatewayKeyPair.publicKey.export({
    format: "pem",
    type: "spki",
  }),
);

/**
 * Runtime (FileKeyProvider)
 */
process.env.PARMANA_KEY_DIR = keyDir;

/**
 * Compatibility if loadConfig() uses KEY_DIRECTORY.
 */
process.env.KEY_DIRECTORY = keyDir;

/**
 * Execution Gateway
 */
process.env.PUBLIC_KEY_PATH = join(keyDir, "default.public.pem");

afterAll(() => {
  rmSync(keyDir, {
    recursive: true,
    force: true,
  });
});
