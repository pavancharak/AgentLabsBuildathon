import type { CredentialHandle } from "./CredentialProvider.js";

/**
 * Namespaced verb capability, e.g. "http:get", "crm:read", "payments:refund".
 *
 * By convention in this SDK, ExecutableContent.action IS the capability
 * string — this is what execution-control's DefaultConnectorPolicy already
 * checks (`connector.capabilities.includes(request.executableContent.action)`).
 * Namespacing is enforced by isNamespacedCapability, not by a new type.
 */
export type ConnectorCapability = string;

const NAMESPACED_CAPABILITY_PATTERN =
  /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*:[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;

export function isNamespacedCapability(value: string): boolean {
  return NAMESPACED_CAPABILITY_PATTERN.test(value);
}

/**
 * A connector's declared, namespaced capabilities.
 *
 * Validates namespacing eagerly so a malformed capability (e.g. a bare
 * action instead of a namespaced verb) fails at connector construction
 * time, not at execution time.
 */
export interface ConnectorCapabilities {
  readonly declared: readonly ConnectorCapability[];
  includes(capability: ConnectorCapability): boolean;
}

export function connectorCapabilities(
  declared: readonly ConnectorCapability[],
): ConnectorCapabilities {
  for (const capability of declared) {
    if (!isNamespacedCapability(capability)) {
      throw new Error(
        `Connector capability must be a namespaced verb (e.g. "http:get"): "${capability}".`,
      );
    }
  }
  const frozen = Object.freeze([...declared]);
  return Object.freeze({
    declared: frozen,
    includes: (capability: ConnectorCapability): boolean =>
      frozen.includes(capability),
  });
}

/**
 * Request handed to a Connector by SdkConnectorExecutor.
 *
 * Derived, field for field, from the Gateway-verified ExecutableContent —
 * never re-derived or re-interpreted. Connectors receive exactly the
 * authorized operation, resource, and parameters.
 */
export interface ConnectorRequest {
  readonly capability: ConnectorCapability;
  readonly businessTransactionId: string;
  readonly action: string;
  readonly target: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

/**
 * Deterministic result returned by a Connector.
 *
 * `metadata` is connector-specific evidence merged into ConnectorEvidence's
 * responseSummary (subject to redaction — see ConnectorEvidence.ts). It must
 * never contain credential material.
 */
export interface ConnectorResponse {
  readonly success: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Execution context supplied to a Connector alongside a ConnectorRequest.
 *
 * `credential` is an opaque, already-resolved CredentialHandle — credential
 * resolution has already happened inside the Execution Gateway by the time a
 * Connector sees this context. Connectors never resolve credentials
 * themselves.
 */
export interface ConnectorExecutionContext {
  readonly credential: CredentialHandle;
  readonly timeoutMs: number;
  readonly requestedAt: Date;
}

/**
 * Canonical Connector contract for the Connector SDK.
 *
 * Connectors NEVER evaluate policy, authorize execution, interpret AI
 * output, perform business decisions, or resolve credentials. They ONLY
 * validate requests, execute operations using an already-resolved
 * credential, and return a deterministic response.
 *
 * A Connector never receives a request directly from the Runtime or AI —
 * only from SdkConnectorExecutor, itself only reachable through
 * execution-control's SecureConnector, itself only reachable through the
 * Execution Gateway.
 */
export interface Connector {
  readonly connectorId: string;
  readonly capabilities: ConnectorCapabilities;
  execute(
    request: ConnectorRequest,
    context: ConnectorExecutionContext,
  ): Promise<ConnectorResponse>;
}
