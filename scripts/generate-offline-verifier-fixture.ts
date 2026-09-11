import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";

import { VerificationCrypto } from "@parmana/crypto";
import type { ExecutionTrustRecord } from "@parmana/shared";

/**
 * Generates a real, TypeScript-signed Execution Trust Record fixture
 * plus its public key, for the cross-language determinism proof
 * (PQC audit Layer 5) -- python/tests/test_offline_verifier.py signs
 * nothing itself; it reads exactly what this script produces and
 * proves the Python OfflineVerifier can independently verify it.
 *
 * Usage:
 *   npx tsx scripts/generate-offline-verifier-fixture.ts <out-dir>
 *
 * Writes <out-dir>/record.json and <out-dir>/public-key.pem. Uses an
 * ephemeral keypair (not PARMANA_KEY_DIR's "default" key) and its own
 * PARMANA_VERIFICATION_KEY_ID override so this never touches or
 * depends on any other key material on the machine running it.
 */

const [outDir] = process.argv.slice(2);

if (!outDir) {
  console.error("Usage: generate-offline-verifier-fixture.ts <out-dir>");
  process.exit(2);
}

const keyId = "cross-language-fixture";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");

// Self-contained: this fixture's key material lives only in outDir,
// never in the repo's real PARMANA_KEY_DIR.
process.env.PARMANA_KEY_DIR = outDir;
process.env.PARMANA_VERIFICATION_KEY_ID = keyId;

writeFileSync(
  `${outDir}/${keyId}.private.pem`,
  privateKey.export({ format: "pem", type: "pkcs8" }),
);

writeFileSync(
  `${outDir}/${keyId}.public.pem`,
  publicKey.export({ format: "pem", type: "spki" }),
);

const crypto = new VerificationCrypto();

const draft = {
  trustRecordId: "cross-language-fixture-txn",
  businessTransactionId: "cross-language-fixture-txn",
  transaction: {
    businessTransactionId: "cross-language-fixture-txn",
    status: "RECEIVED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    signals: { amount: 100, vendorId: "vendor-café" },
  },
  overrides: [],
  executions: [],
  verifications: [],
  receipts: [],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} as unknown as ExecutionTrustRecord;

const trustRecordHash = await crypto.hash(draft);

const withHash: ExecutionTrustRecord = {
  ...draft,
  trustRecordHash,
  signature: { algorithm: "ed25519", keyId, value: "", signedAt: new Date() },
};

const signature = await crypto.sign(withHash);
const record: ExecutionTrustRecord = { ...withHash, signature };

writeFileSync(`${outDir}/record.json`, JSON.stringify(record, null, 2));
writeFileSync(
  `${outDir}/public-key.pem`,
  publicKey.export({ format: "pem", type: "spki" }),
);

console.log(`Fixture written to ${outDir}`);
