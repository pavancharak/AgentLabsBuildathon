/**
 * Canonical JSON, byte for byte the same as the server's
 * packages/crypto/src/CanonicalSerializer.ts and the Python SDK's
 * parmana/crypto/canonical.py: object keys sorted, no whitespace, non ASCII
 * characters written as they are, UTF-8.
 *
 * Input is already decoded JSON (a record from the API or a file). Every
 * timestamp in it is already the string the signer produced, so no Date
 * handling is needed here.
 */

function normalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  const object = value as Record<string, unknown>;

  return Object.keys(object)
    .sort()
    .reduce<Record<string, unknown>>((normalized, key) => {
      normalized[key] = normalize(object[key]);
      return normalized;
    }, {});
}

/**
 * Returns the canonical UTF-8 bytes of a decoded JSON value.
 */
export function canonicalSerialize(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(normalize(value)));
}
