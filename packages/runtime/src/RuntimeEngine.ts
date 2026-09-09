import { DecisionBuilder } from "./DecisionBuilder.js";
import { ExecutionBuilder } from "./ExecutionBuilder.js";
import { ExecutionGate } from "./ExecutionGate.js";
import { RuntimeAuthorizationSigner } from "./RuntimeAuthorizationSigner.js";
import { RefusalRecordBuilder } from "./RefusalRecordBuilder.js";

import { CryptoBootstrap, TrustRecordHasher } from "@parmana/crypto";

import {
  BusinessTransaction,
  BusinessTransactionStatus,
  Decision,
  DecisionOutcome,
  ExecutableContent,
  ExecutionTrustRecord,
  JsonValue,
  RefusalRecordRepository,
  toExecutableContent,
} from "@parmana/shared";

import {
  PolicyEngine,
  PolicyOutcome,
  PolicyRouter,
  SignalIntentBinder,
  type CapabilityPolicyBinder,
  type PolicyDecision,
  type PolicyExecutionVerifier,
  type SignalIntentBindingViolation,
  type SignalStateVerifier,
  type SignalStateViolation,
} from "@parmana/policy";

import type {
  RuntimeContext,
} from "./context/RuntimeContext.js";

import { RuntimePipeline } from "./RuntimePipeline.js";
import { BusinessTrustPipeline } from "./BusinessTrustPipeline.js";

import {
  RuntimeHookRunner,
} from "./hooks/RuntimeHookRunner.js";

import type {
  RuntimeHook,
} from "./hooks/RuntimeHook.js";

/**
 * Canonical Runtime Engine.
 *
 * Responsibilities:
 * - Load the requested policy.
 * - Evaluate the policy deterministically.
 * - Create the Decision artifact.
 * - Create the initial Execution artifact.
 * - Execute the Runtime Pipeline.
 * - Produce the Execution Trust Record.
 */
export class RuntimeEngine {
  private readonly hookRunner: RuntimeHookRunner;

  /**
   * G-24 content-addressed evidence (policy-governance milestone).
   * Self-contained, the same idiom RefusalCrypto/VerificationCrypto
   * use, rather than another optional trailing constructor param --
   * this is a pure, in-memory, side-effect-free computation over an
   * already-loaded Policy document, never a dependency that can be
   * "not configured" the way refusalRecordBuilder/signalStateVerifier
   * legitimately can. Same TrustRecordHasher (canonicalize + sha256)
   * every other content hash in this codebase uses, so this value is
   * directly comparable to PolicyChangeCrypto.hashPolicyContent()'s
   * output for the identical content -- see PolicyReference.contentHash's
   * own doc comment and the deploy-time verification that reads it.
   */
  private readonly policyContentHasher =
    new TrustRecordHasher(CryptoBootstrap.create());

  /**
   * Hashes the runtime PolicySignals evaluated for a decision (G-31,
   * execution-boundary signal freshness). Same TrustRecordHasher idiom as
   * policyContentHasher above -- deterministic canonical hash, directly
   * comparable to the value ExecutionGateway's signalsStillCurrent check
   * recomputes from the signals carried on the ExecutionRequest.
   */
  private readonly signalsHasher =
    new TrustRecordHasher(CryptoBootstrap.create());

  constructor(
    private readonly pipeline: RuntimePipeline,
    private readonly policyRouter: PolicyRouter,
    private readonly policyEngine: PolicyEngine,
    private readonly signalIntentBinder: SignalIntentBinder,
    private readonly decisionBuilder: DecisionBuilder,
    private readonly executionGate: ExecutionGate,
    private readonly executionBuilder: ExecutionBuilder,
    private readonly trustPipeline: BusinessTrustPipeline,
    private readonly authorizationSigner: RuntimeAuthorizationSigner,
    private readonly authorizationTtlSeconds: number,
    private readonly hooks: RuntimeHook[] = [],
    /**
     * RFC-0021 Refusal Record dependencies. Optional and trailing
     * deliberately: every pre-existing call site that constructs
     * RuntimeEngine directly (with exactly 10 positional args, no
     * hooks) must keep compiling and behaving identically. When
     * either is omitted, refusal-record writing is skipped exactly
     * the same way a write failure is handled (see execute()) --
     * "not configured" and "failed" are treated identically, never
     * blocking or altering the REJECT itself.
     */
    private readonly refusalRecordBuilder?: RefusalRecordBuilder,
    private readonly refusalRecordRepository?: RefusalRecordRepository,
    /**
     * G-24 residual closure (RFC-0022). Optional and trailing for the
     * same reason the RFC-0021 pair above is: every pre-existing call
     * site (exactly 12 positional args) must keep compiling and
     * behaving identically. When omitted, no independent state
     * verification runs -- current behavior, unchanged. When
     * supplied, a violation is treated exactly like a
     * SignalIntentBinder violation: an ordinary policy REJECT, no
     * rule evaluated, no authorization ever generated for it.
     */
    private readonly signalStateVerifier?: SignalStateVerifier,
    /**
     * TD-22 (capability/policy binding). Optional and trailing for the
     * same backward-compatibility reason as signalStateVerifier above:
     * every pre-existing call site must keep compiling and behaving
     * identically. When omitted, no capability/policy binding is
     * enforced -- current behavior, unchanged. When supplied, a
     * capability with a canonical policy binding (see
     * CapabilityPolicyBinding.ts) rejects any request that declares a
     * different policy for it, before that policy is ever loaded or
     * evaluated -- an ordinary policy REJECT, no authorization ever
     * generated.
     */
    private readonly capabilityPolicyBinder?: CapabilityPolicyBinder,
    /**
     * Policy Governance execution-time verification (2026-09-07
     * hardening pass). Optional and trailing for the same
     * backward-compatibility reason as capabilityPolicyBinder above:
     * every pre-existing call site must keep compiling and behaving
     * identically. When omitted, no policy is checked against Policy
     * Governance at execution time -- current behavior, unchanged.
     * When supplied, a policy with no approval record, an approval
     * record whose signature does not verify, or live content that no
     * longer matches its approval record is rejected before
     * PolicyEngine ever evaluates a single rule in it -- an ordinary
     * policy REJECT, no authorization ever generated. Runs before
     * capabilityPolicyBinder/signalIntentBinder for the same reason
     * capabilityPolicyBinder runs before signalIntentBinder: checking
     * a narrower guarantee against a policy that might itself be
     * illegitimate is meaningless. Deliberately not wired to run
     * unconditionally -- see createPolicyExecutionVerifier.ts
     * (packages/api) for why this defaults to unconfigured.
     */
    private readonly policyExecutionVerifier?: PolicyExecutionVerifier,
  ) {
    if (!pipeline) {
      throw new Error("RuntimePipeline is required.");
    }

    if (!policyRouter) {
      throw new Error("PolicyRouter is required.");
    }

    if (!policyEngine) {
      throw new Error("PolicyEngine is required.");
    }

    if (!signalIntentBinder) {
      throw new Error("SignalIntentBinder is required.");
    }

    if (!trustPipeline) {
      throw new Error("BusinessTrustPipeline is required.");
    }

    if (!authorizationSigner) {
      throw new Error("RuntimeAuthorizationSigner is required.");
    }

    this.hookRunner =
      new RuntimeHookRunner(
        hooks,
      );

    //
    // Observability: which optional protections are wired for this
    // instance. Construction-time only, not per-request -- the
    // configuration doesn't change per transaction.
    //
    console.log({
      event: "runtime_engine_constructed",
      signalStateVerifierConfigured:
        this.signalStateVerifier !== undefined,
      capabilityPolicyBinderConfigured:
        this.capabilityPolicyBinder !== undefined,
      policyExecutionVerifierConfigured:
        this.policyExecutionVerifier !== undefined,
      refusalRecordingConfigured:
        this.refusalRecordBuilder !== undefined &&
        this.refusalRecordRepository !== undefined,
    });
  }

  public async execute(
    transaction: BusinessTransaction,
  ): Promise<{
    transaction: BusinessTransaction;
    context: RuntimeContext;
    trustRecord: ExecutionTrustRecord;
  }> {

    //
    // Runtime signals
    //

    const signals =
      (transaction.signals ?? {}) as Record<
        string,
        JsonValue
      >;

    //
    // Policy loading
    //

    await this.hookRunner.beforePolicyLoad(
      transaction,
    );

    const policy =
      await this.policyRouter.load(
        transaction.policy.name,
        transaction.policy.version,
      );

    await this.hookRunner.afterPolicyLoad(
      transaction,
      policy,
    );

    //
    // Content hash of the real loaded Policy document (G-24,
    // policy-governance milestone) -- proves exactly what policy
    // *content*, not merely which version string, was in force for
    // this decision. Computed here, from `policy` (what actually
    // loaded), never from `transaction.policy` (what the caller
    // declared) -- see PolicyReference.contentHash's own doc comment.
    //

    const policyContentHash =
      await this.policyContentHasher.hash(policy);

    //
    // Policy Governance execution-time verification (2026-09-07)
    //
    // Runs before capability/signal-intent binding, over the loaded
    // policy's own declared identity (policy.policyId/policyVersion,
    // never transaction.policy -- what the caller declared) and the
    // content hash just computed above, so no extra hash is computed.
    // See policyExecutionVerifier's own constructor doc comment for
    // why this defaults to unconfigured.
    //

    const policyExecutionViolation =
      await this.policyExecutionVerifier?.verify(
        policy.policyId,
        policy.policyVersion,
        policyContentHash,
      );

    //
    // Signal/Intent binding
    //
    // Runs before policy evaluation, over the exact signals
    // PolicyEngine is about to evaluate and the exact Intent
    // ExecutionGateway will sign and execute if this is approved.
    // A policy that declares boundSignals is asserting that these
    // particular signals must describe the same real-world action
    // as Intent — closing the gap where a caller could declare a
    // small, fully-verified signals payload while Intent silently
    // targets something else. A violation is treated as an ordinary
    // policy rejection: no rule is evaluated, no authorization is
    // ever generated for it.
    //

    //
    // Capability/Policy binding (TD-22)
    //
    // Some policies' boundSignals/SignalStateVerifier protections are
    // scoped to one specific policy — those protections only apply
    // when that specific policy is the one evaluated. Nothing
    // upstream of this check enforces that a capability is only ever
    // evaluated under its intended policy; a caller could otherwise
    // pair a real capability with an unrelated, unprotected policy and
    // bypass that capability's protections entirely. Runs before
    // SignalIntentBinder for the same reason SignalIntentBinder runs
    // before PolicyEngine: checking a narrower guarantee against an
    // already-wrong policy is meaningless. A violation is treated as
    // an ordinary policy rejection: no rule is evaluated, no
    // authorization is ever generated for it. Capabilities with no
    // canonical binding (every test/tutorial/example action) are
    // entirely unaffected.
    //

    const capabilityBindingViolation =
      policyExecutionViolation === undefined
        ? this.capabilityPolicyBinder?.findViolation(
            transaction.intent.action,
            transaction.policy,
          )
        : undefined;

    const bindingViolations =
      policyExecutionViolation === undefined && capabilityBindingViolation === undefined
        ? this.signalIntentBinder.findViolations(
            policy,
            signals,
            {
              target: transaction.intent.target,
              parameters: transaction.intent.parameters,
            },
          )
        : [];

    //
    // Policy evaluation
    //

    await this.hookRunner.beforePolicyEvaluation(
      transaction,
      policy,
    );

    const provisionalDecision: PolicyDecision =
      policyExecutionViolation !== undefined
        ? {
            policyId: policy.policyId,
            policyVersion: policy.policyVersion,
            outcome: PolicyOutcome.REJECT,
            reason: `Rejected: ${policyExecutionViolation.reason}.`,
            matchedRuleId: "policy-execution-verification-violation",
            evaluatedRules: 0,
            matchedPath: [],
          }
        : capabilityBindingViolation !== undefined
        ? {
            policyId: policy.policyId,
            policyVersion: policy.policyVersion,
            outcome: PolicyOutcome.REJECT,
            reason:
              `Rejected: capability "${capabilityBindingViolation.action}" requires policy ` +
              `"${capabilityBindingViolation.expected.name}"@"${capabilityBindingViolation.expected.version}", but ` +
              `"${capabilityBindingViolation.declared.name}"@"${capabilityBindingViolation.declared.version}" was declared.`,
            matchedRuleId: "capability-policy-binding-violation",
            evaluatedRules: 0,
            matchedPath: [],
          }
        : bindingViolations.length > 0
        ? {
            policyId: policy.policyId,
            policyVersion: policy.policyVersion,
            outcome: PolicyOutcome.REJECT,
            reason:
              "Rejected: declared signal(s) do not match the executed intent (" +
              bindingViolations
                .map(
                  (violation) =>
                    `${violation.signalKey}=${JSON.stringify(violation.signalValue)} != intent.${violation.intentPath}=${JSON.stringify(violation.intentValue)}`,
                )
                .join(", ") +
              ").",
            matchedRuleId: "signal-intent-binding-violation",
            evaluatedRules: 0,
            matchedPath: [],
          }
        : this.policyEngine.evaluate(
            policy,
            signals,
          );

    //
    // Signal/State verification (G-24 residual closure, RFC-0022)
    //
    // SignalIntentBinder (above) proves signals describe the same
    // action as Intent; it never proves those signals are *true*.
    // Runs only once the provisional decision is APPROVE: a request
    // already rejected (by binding or by an ordinary policy rule)
    // needs no independent re-fetch of real state -- REJECT is REJECT
    // regardless of whether the underlying facts were also true, and
    // skipping the fetch here preserves "a policy denial makes zero
    // calls to the external system" for every REJECT that isn't
    // itself a state mismatch. When a signalStateVerifier is
    // configured and the provisional decision is APPROVE, it
    // independently re-derives the relevant facts from a real
    // external source; a mismatch overrides the decision to REJECT --
    // no authorization is ever generated for an approval resting on a
    // caller-declared signal that verified state contradicts.
    //

    const stateViolations: readonly SignalStateViolation[] =
      provisionalDecision.outcome === PolicyOutcome.APPROVE &&
      this.signalStateVerifier
        ? await this.signalStateVerifier.findViolations(
            {
              action: transaction.intent.action,
              businessTransactionId:
                transaction.businessTransactionId,
              intentParameters:
                transaction.intent.parameters,
            },
            signals,
          )
        : [];

    const policyDecision: PolicyDecision =
      stateViolations.length > 0
        ? {
            policyId: policy.policyId,
            policyVersion: policy.policyVersion,
            outcome: PolicyOutcome.REJECT,
            reason:
              "Rejected: declared signal(s) do not match independently verified state (" +
              stateViolations
                .map(
                  (violation) =>
                    `${violation.signalKey}=${JSON.stringify(violation.declaredValue)} != verified ${violation.signalKey}=${JSON.stringify(violation.actualValue)}`,
                )
                .join(", ") +
              ").",
            matchedRuleId: "signal-state-verification-violation",
            evaluatedRules: 0,
            matchedPath: [],
          }
        : provisionalDecision;

    await this.hookRunner.afterPolicyEvaluation(
      transaction,
      policy,
      policyDecision,
    );

    //
    // Decision
    //

    await this.hookRunner.beforeDecision(
      transaction,
      policyDecision,
    );

    const decision =
      this.decisionBuilder.build(
        transaction,
        policyDecision,
      );

    //
    // Refusal Record (RFC-0021)
    //
    // Evidentiary write only -- must never affect, delay past this
    // synchronous attempt, or block the enforce() call below in any
    // way. Scope is deliberately narrow: only decision.outcome !==
    // APPROVED reaches here at all, which for this method means
    // exactly the two paths RFC-0021 covers (an ordinary
    // PolicyEngine.evaluate REJECT, or the signal-intent-binding
    // REJECT built above) -- not PolicyNotFoundError,
    // PolicyValidationError, or any other couldn't-evaluate failure,
    // none of which reach this point at all.
    //
    if (decision.outcome !== DecisionOutcome.APPROVED) {
      await this.writeRefusalRecord(
        transaction,
        decision,
        bindingViolations,
      );
    }

    //
    // Enforce
    //

    this.executionGate.enforce(
      decision,
    );

    const executableContent: ExecutableContent =
      toExecutableContent({
        businessTransactionId:
          transaction.businessTransactionId,
        action: transaction.intent.action,
        target: transaction.intent.target,
        parameters: transaction.intent.parameters,
      });

    //
    // Authorization
    //

    await this.hookRunner.beforeAuthorization(
      transaction,
      policyDecision,
    );

    const signalsHash =
      await this.signalsHasher.hash(signals);

    const authorization =
      await this.authorizationSigner.sign(
        {
          decisionId:
            decision.decisionId,
          businessTransactionId:
            transaction.businessTransactionId,
          policyName:
            transaction.policy.name,
          policyVersion:
            transaction.policy.version,
          policyContentHash,
          signalsHash,
          ...(transaction.metadata?.submittedBy !== undefined && {
            submittedBy: transaction.metadata.submittedBy,
          }),
          ...(transaction.metadata?.grantedCapability !== undefined && {
            grantedCapability: transaction.metadata.grantedCapability,
          }),
          ...(transaction.metadata?.tenantId !== undefined && {
            tenantId: transaction.metadata.tenantId,
          }),
          executableContent,
        },
        this.authorizationTtlSeconds,
      );

    await this.hookRunner.afterAuthorization(
      transaction,
      policyDecision,
      authorization,
    );

    //
    // Execution
    //

    const execution =
      this.executionBuilder.build(
        transaction,
        decision,
      );

    //
    // Runtime Context
    //

    const context: RuntimeContext = {
      transaction: {
        ...transaction,
        status:
          transaction.status ??
          BusinessTransactionStatus.RECEIVED,
        // A copy, not a mutation of the caller-supplied transaction.policy
        // (already persisted, contentHash-free, by BusinessTransactionService.accept
        // before RuntimeEngine.execute ever runs) -- this contentHash-bearing
        // version exists only on the copy embedded in the Execution Trust
        // Record produced from this context.
        policy: {
          ...transaction.policy,
          contentHash: policyContentHash,
        },
      },
      decision,
      authorization,
      execution,
    };

    await this.hookRunner.afterDecision(
      context,
    );

    await this.hookRunner.beforeExecution(
      context,
    );

    try {
      //
      // Runtime Pipeline
      //

      const processedContext =
        await this.pipeline.execute(
          context,
        );

      await this.hookRunner.afterExecution(
        processedContext,
      );

      await this.hookRunner.beforeTrustRecord(
        processedContext,
      );

      //
      // Business Trust Pipeline
      //

      const trustRecord =
        await this.trustPipeline.execute(
          processedContext,
        );

      await this.hookRunner.afterTrustRecord(
        processedContext,
        trustRecord,
      );

      return {
        transaction:
          processedContext.transaction,
        context:
          processedContext,
        trustRecord,
      };
    } catch (error) {
      await this.hookRunner.onRuntimeError(
        context,
        error as Error,
      );

      throw error;
    }
  }

  /**
   * Builds and persists a Refusal Record for a rejected Decision
   * (RFC-0021 §6).
   *
   * This is the single most important property in this method: a
   * failure here -- refusalRecordBuilder/refusalRecordRepository not
   * configured, a signing error, a storage outage, anything -- is
   * caught here and never rethrown. The caller (execute(), right
   * before executionGate.enforce()) always proceeds to enforce the
   * REJECT exactly as if this method did not exist. The refusal
   * itself must never depend on its own evidence being writable;
   * only the opposite (evidence depends on the refusal) would ever
   * be acceptable. A failure is still loud, not silent: logged via
   * console.error so an operator can find and reconcile the gap,
   * matching this codebase's existing severity-flagging pattern for
   * evidentiary write failures.
   */
  private async writeRefusalRecord(
    transaction: BusinessTransaction,
    decision: Decision,
    bindingViolations: SignalIntentBindingViolation[],
  ): Promise<void> {
    if (!this.refusalRecordBuilder || !this.refusalRecordRepository) {
      return;
    }

    try {
      const refusalRecord =
        await this.refusalRecordBuilder.build(
          transaction.businessTransactionId,
          decision,
          {
            target: transaction.intent.target,
            parameters: transaction.intent.parameters,
          },
          bindingViolations,
          transaction.metadata?.submittedBy,
        );

      await this.refusalRecordRepository.create(
        refusalRecord,
      );
    } catch (error) {
      console.error({
        event: "refusal_record_write_failed",
        businessTransactionId:
          transaction.businessTransactionId,
        decisionId:
          decision.decisionId,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  /**
   * Returns true if the runtime pipeline is empty.
   */
  public isEmpty(): boolean {
    return this.pipeline.isEmpty();
  }

  /**
   * Returns the number of runtime stages.
   */
  public size(): number {
    return this.pipeline.size();
  }
}