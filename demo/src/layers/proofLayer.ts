/**
 * Layer 4 — Cryptographic Proof (real, vendored from packages/crypto).
 *
 * Signs every validation decision with Ed25519 using the actual
 * production CanonicalSerializer + Ed25519SignatureProvider. A fresh
 * keypair is generated per server instance (demo-appropriate; production
 * keys are managed by @parmana/crypto's KeyProvider/KeyStore, not
 * regenerated on boot).
 */
import { generateKeyPairSync, randomUUID, type KeyObject } from 'node:crypto';
import { CanonicalSerializer } from '../vendor/crypto/CanonicalSerializer';
import { Ed25519SignatureProvider } from '../vendor/crypto/Ed25519SignatureProvider';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const serializer = new CanonicalSerializer();
const signer = new Ed25519SignatureProvider();

export const PROOF_KEY_ID = `demo-key-${randomUUID()}`;

export const PROOF_PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

export interface Proof {
  proofId: string;
  timestamp: string;
  keyId: string;
  algorithm: string;
  signature: string;
  payload: Record<string, unknown>;
}

export async function signDecision(payload: Record<string, unknown>): Promise<Proof> {
  const proofId = `proof_${randomUUID()}`;
  const timestamp = new Date().toISOString();
  const signable = { proofId, timestamp, ...payload };

  const bytes = serializer.serialize(signable);
  const signature = await signer.sign(bytes, privateKey as KeyObject);

  return {
    proofId,
    timestamp,
    keyId: PROOF_KEY_ID,
    algorithm: signer.algorithm,
    signature,
    payload: signable,
  };
}

export async function verifyProof(proof: Proof): Promise<boolean> {
  const bytes = serializer.serialize(proof.payload);
  return signer.verify(bytes, proof.signature, publicKey as KeyObject);
}
