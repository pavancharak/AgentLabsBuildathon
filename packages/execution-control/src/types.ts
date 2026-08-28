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

  resolveCapability(
    capability: string,
  ): SecureConnector;
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

export interface ExecutionAuditEvent {
  readonly type: "session.created" | "execution.rejected" | "execution.completed";
  readonly occurredAt: string;
  readonly connectorId: string;
  readonly authorizationId: string;
  readonly sessionId: string;
  readonly reason?: string;

  /** Metadata only — never the credential's secret value. */
  readonly credentialId?: string;
  readonly gatewayId?: string;

  /** ExecutableContent.action this event concerns — the capability granted or rejected. */
  readonly action?: string;
}

export interface ExecutionAuditSink {
  record(event: ExecutionAuditEvent): Promise<void>;
}

export interface ExecutionRelease {
  readonly authorization: SignedExecutionAuthorization;
  readonly executableContent: Readonly<ExecutableContent>;
  readonly verifiedTransaction: VerifiedTransaction;
  readonly executionTimestamp: string;
}
export interface ExecutionControl {
  execute(release: ExecutionRelease, gatewayAuthentication: unknown): Promise<ExecutionResult>;
}
