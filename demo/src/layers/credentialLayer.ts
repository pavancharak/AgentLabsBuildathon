/**
 * Layer 3 — Credential Scope (demo-tier, purpose-built for this demo).
 *
 * The real execution-control package's credential concept
 * (SessionCredentialVault / CredentialVault) scopes opaque connector
 * secrets, not payment amount/vendor bounds — there is no production
 * "maxAmount + authorizedVendors" credential in this repo. This is a
 * small, real bounds-checking module written for the payment scenario,
 * following the same shape (issue a time-bounded, scoped credential;
 * check a request against it before anything executes).
 */
import { randomUUID } from 'crypto';

export interface PaymentCredential {
  credentialId: string;
  agentId: string;
  maxAmount: number;
  authorizedVendors: string[];
  issuedAt: string;
  expiresAt: string;
}

export interface CredentialLayerResult {
  inScope: boolean;
  reason: string;
  credential: PaymentCredential;
}

const CREDENTIAL_TTL_MS = 5 * 60 * 1000;

export function issuePaymentCredential(
  agentId: string,
  maxAmount: number,
  authorizedVendors: string[],
): PaymentCredential {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CREDENTIAL_TTL_MS);

  return {
    credentialId: `cred_${randomUUID()}`,
    agentId,
    maxAmount,
    authorizedVendors,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function checkScope(
  credential: PaymentCredential,
  vendorId: string,
  amount: number,
): CredentialLayerResult {
  if (new Date(credential.expiresAt).getTime() <= Date.now()) {
    return { inScope: false, reason: 'credential has expired', credential };
  }

  if (!credential.authorizedVendors.includes(vendorId)) {
    return { inScope: false, reason: `vendor "${vendorId}" is outside credential scope`, credential };
  }

  if (amount > credential.maxAmount) {
    return {
      inScope: false,
      reason: `amount ${amount} exceeds credential maxAmount ${credential.maxAmount}`,
      credential,
    };
  }

  return { inScope: true, reason: 'within credential scope', credential };
}
