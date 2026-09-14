import { createPublicKey, type KeyObject } from "node:crypto";

import { existsSync, readFileSync } from "node:fs";

import { join } from "node:path";

import { loadConfig } from "@parmana/shared";

/**
 * Loads the gateway verification public key.
 *
 * The gateway always loads the public key from the
 * configured Parmana key directory.
 */
export function createGatewayPublicKey(): KeyObject {
  const config = loadConfig();

  if (!config.keys.keyDirectory) {
    throw new Error("PARMANA_KEY_DIR is not configured.");
  }

  const keyPath = join(config.keys.keyDirectory, "default.public.pem");

  if (!existsSync(keyPath)) {
    throw new Error(`Gateway public key not found: ${keyPath}`);
  }

  const pem = readFileSync(keyPath, "utf8");

  return createPublicKey(pem);
}
