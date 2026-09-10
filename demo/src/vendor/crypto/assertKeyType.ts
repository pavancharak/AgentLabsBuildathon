/**
 * Vendored verbatim from packages/crypto/src/providers/signature/assertKeyType.ts.
 */
import type { KeyObject } from 'node:crypto';
import { CryptoError } from './CryptoError';

/**
 * Asserts that a supplied KeyObject matches the
 * signature provider's expected native key type.
 *
 * node:crypto's sign()/verify() dispatch on the key's
 * own asymmetricKeyType, not on which SignatureProvider
 * happens to be configured. Without this check, a
 * differently-configured process holding the wrong key
 * material on disk would silently sign with the wrong
 * algorithm while labeling the envelope otherwise.
 */
export function assertKeyType(
  key: KeyObject,
  expected: string,
  operation: 'sign' | 'verify',
): void {
  if (key.asymmetricKeyType !== expected) {
    throw new CryptoError(
      `${operation}() expected a "${expected}" key but received "${key.asymmetricKeyType}". ` +
        'The configured signature algorithm does not match the supplied key material.',
    );
  }
}
