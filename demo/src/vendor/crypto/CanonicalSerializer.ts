/**
 * Vendored verbatim from packages/crypto/src/CanonicalSerializer.ts.
 * The original has zero dependencies and is copied unmodified here.
 */

/**
 * Canonical Serializer.
 *
 * Produces a deterministic byte representation of an
 * immutable object.
 *
 * Every cryptographic operation in Parmana MUST operate
 * on canonical serialized bytes produced by this class.
 *
 * This guarantees that hashing, signing, verification,
 * replay, and receipts all operate over identical data.
 */
export class CanonicalSerializer {
  serialize(value: unknown): Uint8Array {
    const canonical = JSON.stringify(this.normalize(value));
    return new TextEncoder().encode(canonical);
  }

  private normalize(value: unknown): unknown {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalize(item));
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    const object = value as Record<string, unknown>;

    return Object.keys(object)
      .sort()
      .reduce<Record<string, unknown>>((normalized, key) => {
        normalized[key] = this.normalize(object[key]);
        return normalized;
      }, {});
  }
}
