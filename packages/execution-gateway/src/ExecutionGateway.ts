import type { KeyObject } from "node:crypto";

import {
  CryptoBootstrap,
  ExecutableContentHasher,
  TrustRecordHasher,
  type KeyExpiryStore,
  type KeyProvider,
} from "@parmana/crypto";

import type { PolicyRepository } from "@parmana/policy";

import { EnvelopeVerifier, type NonceStore } from "@parmana/envelope-verifier";

import type { ExecutionControl } from "@parmana/execution-control";

import type {
  ExecutionRequest,
  ExecutionSystem,
} from "@parmana/execution-system";

import {
  toExecutableContent,
  NonceAlreadyConsumedError,
  type ExecutableContent,
  type ExecutionResult,
} from "@parmana/shared";

import type { Connector } from "./Connector.js";
import { deepFreeze } from "./deepFreeze.js";
import type { GatewayVerificationResult } from "./GatewayVerificationResult.js";
import type { ExecutionChannel, GatewayIdentityProvider } from "./connector-runtime/types.js";

export interface ExecutionControlOptions {
  /** New package-level control service. */
  readonly service?: ExecutionControl;
  readonly gatewayAuthentication?: unknown;

  /**
   * When present, called once per execute() call with the
   * authorizationId of the request being released, to mint a fresh,
   * request-bound gatewayAuthentication value instead of reusing the
   * static gatewayAuthentication field above. Takes precedence over it
   * when both are supplied.
   */
  readonly mintGatewayAuthentication?: (authorizationId: string) => unknown;

  /** @deprecated Embedded prototype retained for backward compatibility. */
  readonly channel?: ExecutionChannel;
  /** @deprecated Use gatewayAuthentication with service. */
  readonly gatewayIdentity?: GatewayIdentityProvider;

  /** Deterministic deployment routing. It must not inspect credentials. */
  readonly route: (content: Readonly<ExecutableContent>) => string;
}

export interface ExecutionGatewayOptions {
  /**
   * Parmana's public key. Supplied by the caller,
   * exactly as @parmana/envelope-verifier requires —
   * this package never reads key material itself.
   */
  readonly publicKey: KeyObject;

  /**
   * Optional keyId-aware key lookup, forwarded to EnvelopeVerifier.
   * When supplied, each authorization's own `keyId` is resolved
   * through this provider instead of the single static `publicKey`
   * above -- enabling verification against a rotated or additional
   * key without a restart, since a new keyId only needs a new key
   * file the provider can read. `publicKey` above remains the
   * fallback when this is omitted, so every caller that doesn't
   * supply it keeps today's exact behavior.
   */
  readonly keyProvider?: KeyProvider;

  /**
   * Optional key-expiry/revocation check, forwarded to
   * EnvelopeVerifier. Only consulted when keyProvider is also
   * supplied; a keyId with no entry (or when this is omitted
   * entirely) is treated as always valid.
   */
  readonly keyExpiryStore?: KeyExpiryStore;

  readonly nonceStore: NonceStore;

  /**
   * Optional policy repository used for the policy-freshness check:
   * recomputing the current content hash of the policy an
   * authorization was signed under, and comparing it to the
   * authorization's own signed `policyContentHash`. When omitted, or
   * when an authorization carries no `policyContentHash` (signed
   * before this check existed), the check is skipped rather than
   * failed -- see ExecutionGateway's class doc comment.
   */
  readonly policyRepository?: PolicyRepository;

  /**
   * The Connector this Gateway is the sole release
   * boundary for.
   */
  readonly connector?: Connector;

  /**
   * Additive controlled-execution mode. When present, verified content is
   * released through an authenticated ExecutionChannel instead of a legacy
   * directly injected Connector.
   */
  readonly executionControl?: ExecutionControlOptions;

  /**
   * Forwarded to the underlying EnvelopeVerifier.
   * Defaults to 300 seconds.
   */
  readonly maxTtlSeconds?: number;
}

/**
 * Execution Gateway.
 *
 * Implements @parmana/execution-system's ExecutionSystem, so
 * it plugs into the existing RuntimeFactory.create() seam
 * exactly like DefaultExecutionSystem or HttpExecutionSystem —
 * no change to RuntimeEngine, RuntimePipeline, or any other
 * core decision-flow component is required.
 *
 * Composes @parmana/envelope-verifier's EnvelopeVerifier
 * rather than reimplementing signature/expiry/TTL/nonce
 * checks, and adds two more side-effect-free checks:
 * recomputing the ExecutableContent hash and comparing it to
 * the authorization's businessTransactionHash (closing the
 * gap where a valid envelope could accompany a modified
 * payload carrying the same businessTransactionId), and --
 * when a PolicyRepository is supplied -- recomputing the
 * current content hash of the policy the authorization was
 * signed under and comparing it to the authorization's own
 * signed policyContentHash, so a stale-policy authorization
 * cannot execute after the policy it relied on has changed.
 *
 * Verification order (Session 3's ordering rule: side-effect-
 * free checks first, nonce consumed last and only on success):
 *   version -> signature -> expiry -> TTL policy
 *     -> businessTransactionHash recompute-and-compare
 *     -> policyStillCurrent recompute-and-compare (when wired)
 *     -> nonce
 *
 * Stateless and deterministic: there is no pause/resume state.
 * A mismatch is a rejection naming the mismatch; a new
 * authorization is simply a new proposal through the runtime.
 */
export class ExecutionGateway implements ExecutionSystem {
  private readonly envelopeVerifier: EnvelopeVerifier;
  private readonly contentHasher: ExecutableContentHasher;
  private readonly policyContentHasher: TrustRecordHasher;
  private readonly policyRepository: PolicyRepository | undefined;
  private readonly connector: Connector | undefined;
  private readonly executionControl: ExecutionControlOptions | undefined;

  constructor(options: ExecutionGatewayOptions) {
    this.envelopeVerifier = new EnvelopeVerifier({
      publicKey: options.publicKey,
      nonceStore: options.nonceStore,
      ...(options.keyProvider === undefined
        ? {}
        : { keyProvider: options.keyProvider }),
      ...(options.keyExpiryStore === undefined
        ? {}
        : { keyExpiryStore: options.keyExpiryStore }),
      ...(options.maxTtlSeconds === undefined
        ? {}
        : { maxTtlSeconds: options.maxTtlSeconds }),
    });

    this.contentHasher = new ExecutableContentHasher(
      CryptoBootstrap.create(),
    );

    this.policyContentHasher = new TrustRecordHasher(
      CryptoBootstrap.create(),
    );

    this.policyRepository = options.policyRepository;

    if (options.connector === undefined && options.executionControl === undefined) {
      throw new Error("ExecutionGateway requires a connector or executionControl.");
    }
    if (options.connector !== undefined && options.executionControl !== undefined) {
      throw new Error("ExecutionGateway accepts connector or executionControl, not both.");
    }

    this.connector = options.connector;
    this.executionControl = options.executionControl;
  }

  /**
   * Runs the full verification sequence without forwarding to
   * the Connector and without throwing. Exposed so callers
   * (and tests) can inspect the structured result directly.
   */
  async verify(
    request: ExecutionRequest,
    now: Date = new Date(),
  ): Promise<{
    result: GatewayVerificationResult;
    executableContent: ExecutableContent;
  }> {
    const executableContent: ExecutableContent =
      toExecutableContent(request);

    const { passed, checks } =
      await this.envelopeVerifier.verifyChecks(
        request.authorization,
        now,
      );

    let businessTransactionHashMatches = false;
    let hashMismatch: GatewayVerificationResult["hashMismatch"];

    if (passed) {
      const actualHash =
        await this.contentHasher.hash(executableContent);

      const expectedHash =
        request.authorization.payload.businessTransactionHash;

      businessTransactionHashMatches = actualHash === expectedHash;

      if (!businessTransactionHashMatches) {
        hashMismatch = {
          expected: expectedHash,
          actual: actualHash,
        };
      }
    }

    let policyStillCurrent: boolean | undefined;
    let policyContentMismatch: GatewayVerificationResult["policyContentMismatch"];

    const { policyName, policyVersion, policyContentHash } =
      request.authorization.payload;

    if (
      passed &&
      businessTransactionHashMatches &&
      this.policyRepository !== undefined &&
      policyContentHash !== undefined
    ) {
      try {
        const currentPolicy = await this.policyRepository.load(
          policyName,
          policyVersion,
        );

        const currentHash =
          await this.policyContentHasher.hash(currentPolicy);

        policyStillCurrent = currentHash === policyContentHash;

        if (!policyStillCurrent) {
          policyContentMismatch = {
            expected: policyContentHash,
            actual: currentHash,
          };
        }
      } catch {
        //
        // The policy no longer exists at this name/version (e.g. a
        // governed change replaced it in place) -- treated the same
        // as a content mismatch: this authorization's policy is no
        // longer verifiably current.
        //
        policyStillCurrent = false;
        policyContentMismatch = {
          expected: policyContentHash,
          actual: "policy not found",
        };
      }
    }

    const priorChecksPassed =
      passed &&
      businessTransactionHashMatches &&
      policyStillCurrent !== false;

    //
    // The nonce check is the only check with a side effect,
    // so it runs last and only if every side-effect-free
    // check — including the content hash — passed. A
    // mismatched or forged request must not burn a nonce.
    //
    const nonceUnseen = priorChecksPassed
      ? await this.envelopeVerifier.consumeNonce(
          request.authorization,
        )
      : false;

    const result: GatewayVerificationResult = {
      valid: priorChecksPassed && nonceUnseen,

      checks: {
        ...checks,
        businessTransactionHashMatches,
        ...(policyStillCurrent === undefined ? {} : { policyStillCurrent }),
        nonceUnseen,
      },

      ...(hashMismatch ? { hashMismatch } : {}),
      ...(policyContentMismatch ? { policyContentMismatch } : {}),
    };

    return { result, executableContent };
  }

  /**
   * Verifies the request, then forwards the verified, frozen
   * content to the Connector. Throws when verification fails —
   * naming every failing check, and both hashes on a content
   * mismatch — so the caller (ExecutionComponent) marks the
   * Execution failed rather than silently dropping it.
   */
  async execute(
    request: ExecutionRequest,
  ): Promise<ExecutionResult> {
    const { result, executableContent } =
      await this.verify(request);

    if (!result.valid) {
      if (this.isSoleFailureNonceReplay(result)) {
        throw new NonceAlreadyConsumedError(executableContent.businessTransactionId);
      }
      throw new Error(this.describeFailure(result));
    }

    const transaction = deepFreeze(executableContent);

    if (this.executionControl !== undefined) {
      if (this.executionControl.service !== undefined) {
        const gatewayAuthentication =
          this.executionControl.mintGatewayAuthentication !== undefined
            ? this.executionControl.mintGatewayAuthentication(
                request.authorization.payload.authorizationId,
              )
            : this.executionControl.gatewayAuthentication;

  return this.executionControl.service.execute({
  authorization: request.authorization,
          executableContent: transaction,
          verifiedTransaction: {
            authorizationVerified: true,
            executableContentVerified: true,
            replayCheckPassed: true,
          },
          executionTimestamp: new Date().toISOString(),
        }, gatewayAuthentication);
      }
      if (this.executionControl.channel === undefined ||
        this.executionControl.gatewayIdentity === undefined) {
        throw new Error("Execution Gateway executionControl is incomplete.");
      }
      return this.executionControl.channel.release({
        executionId: request.authorization.payload.authorizationId,
        connectorId: this.executionControl.route(transaction),
        transaction,
        authorization: request.authorization,
        verification: result,
      }, this.executionControl.gatewayIdentity.present());
    }

    return this.connector!.execute({
      transaction,
      authorization: request.authorization,
      verification: result,
    });
  }

  /**
   * True only when every check other than nonce consumption passed —
   * version, signature, expiry, TTL policy, and the businessTransactionHash
   * recompute-and-compare all succeeded, and nonceUnseen alone is false.
   * Because nonce consumption is attempted only after every prior check
   * passes (see verify()'s priorChecksPassed gating above), this is the
   * one unambiguous signal that the request is an isolated replay of an
   * already-executed authorization, not a forged or malformed one.
   *
   * policyStillCurrent is optional -- undefined means the check was
   * skipped (no PolicyRepository wired, or no policyContentHash on the
   * authorization), not that it failed, so undefined counts as passing
   * here exactly like an absent check always has.
   */
  private isSoleFailureNonceReplay(
    result: GatewayVerificationResult,
  ): boolean {
    const { nonceUnseen, ...otherChecks } = result.checks;

    return (
      !nonceUnseen &&
      Object.values(otherChecks).every(
        (checkPassed) => checkPassed === true || checkPassed === undefined,
      )
    );
  }

  private describeFailure(
    result: GatewayVerificationResult,
  ): string {
    const failedChecks = Object.entries(result.checks)
      .filter(([, checkPassed]) => checkPassed === false)
      .map(([name]) => name);

    const hashDetail = result.hashMismatch
      ? ` businessTransactionHash mismatch: expected ${result.hashMismatch.expected}, got ${result.hashMismatch.actual}.`
      : "";

    const policyDetail = result.policyContentMismatch
      ? ` policyContentHash mismatch: expected ${result.policyContentMismatch.expected}, got ${result.policyContentMismatch.actual}.`
      : "";

    return (
      `Execution Gateway rejected request: failed checks ` +
      `[${failedChecks.join(", ")}].${hashDetail}${policyDetail}`
    );
  }
}
