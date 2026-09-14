import type {
  ExecutableContent,
  ExecutionResult,
  SignedExecutionAuthorization,
} from "@parmana/shared";

export interface GatewayIdentity {
  readonly gatewayId: string;
  readonly publicIdentity: string;
  readonly authenticationMetadata: Readonly<Record<string, string>>;
}

export interface ConnectorIdentity {
  readonly connectorId: string;
  readonly publicIdentity: string;
  readonly authenticationMetadata: Readonly<Record<string, string>>;
}

export interface VerifiedTransaction {
  readonly authorizationVerified: true;
  readonly executableContentVerified: true;
  readonly replayCheckPassed: true;
}

export interface GatewaySession {
  readonly sessionId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly authorizationId: string;
}

export interface GatewayExecutionRequest {
  readonly authorization: SignedExecutionAuthorization;
  readonly executableContent: Readonly<ExecutableContent>;
  readonly verifiedTransaction: VerifiedTransaction;
  readonly executionTimestamp: string;
  readonly gatewayIdentity: GatewayIdentity;
  readonly gatewaySession: GatewaySession;
}

export interface ExecutionCredential {
  /** Opaque to the Runtime, Gateway, AI, and request. Used only by a connector executor. */
  readonly value: unknown;
}

export interface CredentialVault {
  getCredential(connectorId: string): Promise<ExecutionCredential>;
}

export interface ConnectorExecutor {
  execute(
    content: Readonly<ExecutableContent>,
    credential: ExecutionCredential,
  ): Promise<ExecutionResult>;
}

export interface SecureConnector {
  readonly connectorId: string;
  readonly capabilities: readonly string[];
  readonly identity: ConnectorIdentity;
  execute(request: GatewayExecutionRequest): Promise<ExecutionResult>;
}

export interface ConnectorRegistry {
  get(name: string): SecureConnector;

  resolveCapability(capability: string): SecureConnector;
}

export interface ConnectorAuthenticator {
  authenticateGateway(
    identity: GatewayIdentity,
    authentication: unknown,
  ): boolean;
  authenticateConnector(identity: ConnectorIdentity): boolean;
}

export interface ConnectorPolicy {
  assertAllowed(
    request: GatewayExecutionRequest,
    connector: SecureConnector,
    authentication: unknown,
  ): Promise<void>;
}

/**
 * Re-exported from @parmana/shared, not defined here, so
 * packages/storage's SupabaseExecutionAuditSink can use the same
 * shape without importing @parmana/execution-control —
 * tests/architecture/execution-boundary.test.ts enforces a closed
 * dependent set for that package (execution-control, execution-gateway,
 * and api only), and storage is not on that list, deliberately. See
 * ExecutionAuditEvent's own doc comment in @parmana/shared for why.
 */
export type { ExecutionAuditEvent, ExecutionAuditSink } from "@parmana/shared";

export interface ExecutionRelease {
  readonly authorization: SignedExecutionAuthorization;
  readonly executableContent: Readonly<ExecutableContent>;
  readonly verifiedTransaction: VerifiedTransaction;
  readonly executionTimestamp: string;
}
export interface ExecutionControl {
  execute(
    release: ExecutionRelease,
    gatewayAuthentication: unknown,
  ): Promise<ExecutionResult>;
}
