/**
 * Vendored from packages/crypto/src/providers/SignatureProvider.ts.
 * Only change: SignatureAlgorithm is inlined here instead of imported
 * from `@parmana/shared`, so this directory has no monorepo dependency.
 */
import type { KeyObject } from 'node:crypto';

export type SignatureAlgorithm =
  | 'ed25519'
  | 'ecdsa-p256'
  | 'dilithium3'
  | 'dilithium5'
  | 'sphincs-plus';

/**
 * Signature Provider.
 *
 * Performs cryptographic signature operations.
 *
 * Key management is intentionally external to the
 * provider and is handled by a KeyProvider.
 */
export interface SignatureProvider {
  readonly algorithm: SignatureAlgorithm;

  sign(data: Uint8Array, privateKey: KeyObject): Promise<string>;

  verify(data: Uint8Array, signature: string, publicKey: KeyObject): Promise<boolean>;
}
