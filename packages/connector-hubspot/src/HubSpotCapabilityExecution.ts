import type { KeyObject } from "node:crypto";
import { randomUUID } from "node:crypto";

import { AuthorizationSigner, type CryptoProvider } from "@parmana/crypto";
import type { ExecutionSystem } from "@parmana/execution-system";
import type { ExecutableContent, ExecutionResult } from "@parmana/shared";

export interface HubSpotCapabilityExecutionOptions {
  readonly gateway: ExecutionSystem;
  readonly signerPrivateKey: KeyObject;
  readonly signerKeyId: string;
  readonly policyName: string;
  readonly policyVersion: string;
  readonly crypto: CryptoProvider;
  readonly authorizationTtlSeconds?: number;
}

export interface HubSpotCapabilityExecutionContent {
  readonly businessTransactionId: string;
  readonly action: string;
  readonly target: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

/**
 * Signs and executes one HubSpot capability call: fresh authorization,
 * signed with the caller-supplied key, submitted through the caller-
 * supplied ExecutionSystem (envelope verification, nonce consumption,
 * connector dispatch -- unmodified, the same gateway every other
 * execution goes through).
 *
 * Extracted from HubSpotDealUpdateService, mirroring exactly how
 * executeRazorpayCapability was extracted from RazorpayRefundService.
 * Both HubSpotDealUpdateService (authorizing the deal update it is
 * about to place) and HubSpotSignalStateVerifier (independently
 * re-fetching deal state before policy evaluation) call this, so the
 * sign-then-execute shape exists in exactly one place.
 */
export async function executeHubSpotCapability(
  options: HubSpotCapabilityExecutionOptions,
  content: HubSpotCapabilityExecutionContent,
): Promise<ExecutionResult> {
  const signer = new AuthorizationSigner(options.crypto);

  const executableContent: ExecutableContent = Object.freeze({
    ...content,
    parameters: Object.freeze({ ...content.parameters }),
  });

  const authorization = await signer.sign(
    {
      decisionId: randomUUID(),
      businessTransactionId: content.businessTransactionId,
      policyName: options.policyName,
      policyVersion: options.policyVersion,
      executableContent,
    },
    options.signerPrivateKey,
    options.signerKeyId,
    options.authorizationTtlSeconds ?? 60,
  );

  return options.gateway.execute({
    businessTransactionId: content.businessTransactionId,
    action: content.action,
    target: content.target,
    parameters: content.parameters,
    authorization,
  });
}

/** Unwraps the connector-reported metadata a capability response carries. */
export function hubSpotConnectorResponseMetadata(
  result: ExecutionResult,
): Record<string, unknown> {
  const connector = result.metadata?.connector as
    { responseSummary?: { metadata?: Record<string, unknown> } } | undefined;
  return connector?.responseSummary?.metadata ?? {};
}
