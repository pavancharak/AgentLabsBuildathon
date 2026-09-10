/**
 * Vendored verbatim (logic unchanged) from
 * packages/crypto/src/providers/signature/Ed25519SignatureProvider.ts.
 * This is the real Ed25519 signer Parmana uses to sign execution
 * authorizations in production.
 */
import { sign, verify, type KeyObject } from 'node:crypto';
import type { SignatureProvider } from './SignatureProvider';
import { assertKeyType } from './assertKeyType';

const NODE_KEY_TYPE = 'ed25519';

/**
 * Ed25519 Signature Provider.
 *
 * Stateless implementation of Ed25519 signing.
 * Key management is delegated to the caller.
 */
export class Ed25519SignatureProvider implements SignatureProvider {
  public readonly algorithm = 'ed25519' as const;

  constructor() {
    Object.freeze(this);
  }

  async sign(data: Uint8Array, privateKey: KeyObject): Promise<string> {
    assertKeyType(privateKey, NODE_KEY_TYPE, 'sign');

    const signature = sign(null, Buffer.from(data), privateKey);

    return signature.toString('base64');
  }

  async verify(data: Uint8Array, signature: string, publicKey: KeyObject): Promise<boolean> {
    assertKeyType(publicKey, NODE_KEY_TYPE, 'verify');

    return verify(null, Buffer.from(data), publicKey, Buffer.from(signature, 'base64'));
  }
}
