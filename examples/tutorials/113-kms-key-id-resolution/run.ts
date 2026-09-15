import { resolveKmsKeyId } from "@parmana/crypto";

//
// docs/VERIFICATION-GAPS.md G-48 / docs/operations/2026-09-15-kms-migration-troubleshooting-guide.md
// item 1: every signing call site in this codebase passes a logical
// keyId ("default", "tenant.acme") to Signer.sign(keyId, data).
// KmsSigner used to pass that string straight through as AWS KMS's
// KeyId parameter -- which AWS rejects outright, since a bare word is
// neither a key ID (UUID), a key ARN, nor an alias (which must carry
// the "alias/" prefix). This tutorial exercises the REAL fix
// (resolveKmsKeyId, exported from packages/crypto/src/providers/signer/KmsSigner.ts)
// directly -- no AWS credentials or network access needed, since this
// is a pure string-mapping function, the same one KmsSigner.sign() /
// .getPublicKey() / .getMetadata() / .hasKey() all call internally
// before making a real AWS API call.
//

console.log();
console.log("==================================================");
console.log("Tutorial 113 - KMS Key ID Resolution");
console.log("==================================================");
console.log();

interface Case {
  readonly description: string;
  readonly input: string;
  readonly expected: string;
}

const cases: Case[] = [
  {
    description:
      'A bare logical keyId ("default", KeyProvider.DEFAULT_KEY_ID) -- the value every signing call site actually passes',
    input: "default",
    expected: "alias/default",
  },
  {
    description:
      'A tenant-scoped logical keyId (TenantKeyResolver\'s "tenant.<id>" naming convention)',
    input: "tenant.acme-corp",
    expected: "alias/tenant.acme-corp",
  },
  {
    description:
      "An already-qualified alias name -- passed through unchanged, never double-prefixed",
    input: "alias/parmana-ed25519-signer",
    expected: "alias/parmana-ed25519-signer",
  },
  {
    description: "A full KMS key ARN -- passed through unchanged",
    input:
      "arn:aws:kms:ap-south-1:013659367671:key/2787acce-db19-4cd6-88ed-ce2c1319096b",
    expected:
      "arn:aws:kms:ap-south-1:013659367671:key/2787acce-db19-4cd6-88ed-ce2c1319096b",
  },
  {
    description: "A raw KMS key ID (UUID) -- passed through unchanged",
    input: "2787acce-db19-4cd6-88ed-ce2c1319096b",
    expected: "2787acce-db19-4cd6-88ed-ce2c1319096b",
  },
];

let allPassed = true;

for (const testCase of cases) {
  const actual = resolveKmsKeyId(testCase.input);
  const passed = actual === testCase.expected;
  allPassed = allPassed && passed;

  console.log(testCase.description);
  console.log("--------------------------------------------------");
  console.log(`Input    : ${testCase.input}`);
  console.log(`Resolved : ${actual}`);
  console.log(`Expected : ${testCase.expected}`);
  console.log(passed ? "✓ matches" : "✗ MISMATCH");
  console.log();
}

console.log(
  'Before the fix, KmsSigner.sign("default", data) called AWS KMS\'s SignCommand with',
);
console.log(
  '{ KeyId: "default", ... } -- AWS rejects this immediately (ValidationException),',
);
console.log(
  'since "default" matches none of KeyId\'s accepted formats. Every real signing',
);
console.log(
  "and verification call failed the moment KEY_PROVIDER=aws-kms was set.",
);
console.log();

if (allPassed) {
  console.log(
    "✓ Every keyId shape resolves to what AWS KMS actually accepts, and an already-correct identifier is never re-prefixed.",
  );
} else {
  console.log("✗ Expected every case above to match.");
}

console.log();
console.log("Tutorial Complete");
console.log(
  "Next: Tutorial 114 - Signing and Verification Must Agree on One Key Source",
);
