/**
 * Vendored verbatim from packages/crypto/src/errors/CryptoError.ts.
 */
export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
