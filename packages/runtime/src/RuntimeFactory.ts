import type { SigningReadiness } from "./SigningReadiness.js";
import type {
  PolicyExecutionVerifier,
  PolicyGovernanceAnchorResolver,
  PolicyRepository,
  SignalStateVerifier,
} from "@parmana/policy";

import {
  BusinessTransactionRepository,
  ExecutionIntentRepository,
  ExecutionTrustRecordRepository,
  RefusalRecordRepository,
} from "@parmana/shared";

import type { ExecutionSystem } from "@parmana/execution-system";

import { ExecutionIntentFinalizer } from "./ExecutionIntentFinalizer.js";
import { ExecutionIntentService } from "./ExecutionIntentService.js";
import { ExecutionTrustApplication } from "./ExecutionTrustApplication.js";
import { Runtime } from "./Runtime.js";
import { RuntimeBuilder } from "./RuntimeBuilder.js";

import {
  ExecutionComponent,
  TrustChainValidationComponent,
} from "./components/index.js";

import { ExecutionEvidenceBuilder } from "./ExecutionEvidenceBuilder.js";
import { ExecutionRequestBuilder } from "./ExecutionRequestBuilder.js";

import { BusinessTransactionService } from "./services/business-transaction-service.js";
import { ExecutionService } from "./services/execution-service.js";
import { ReceiptService } from "./services/receipt-service.js";
import { VerificationService } from "./services/verification-service.js";

/**
 * Canonical Runtime Factory.
 *
 * Creates a fully configured
 * Execution Trust Application.
 */
export class RuntimeFactory {
  public static create(
    transactions: BusinessTransactionRepository,
    trustRecords: ExecutionTrustRecordRepository,
    policyRepository: PolicyRepository,
    executionSystem: ExecutionSystem,
    refusalRecords?: RefusalRecordRepository,
    signalStateVerifier?: SignalStateVerifier,
    policyExecutionVerifier?: PolicyExecutionVerifier,
    policyGovernanceAnchorResolver?: PolicyGovernanceAnchorResolver,
    signingReadiness?: SigningReadiness,
    executionIntents?: ExecutionIntentRepository,
  ): ExecutionTrustApplication {
    //
    // Application Services
    //
    const transactionService = new BusinessTransactionService(transactions);

    const executionService = new ExecutionService(transactions, trustRecords);

    const verificationService = new VerificationService(trustRecords);

    const receiptService = new ReceiptService(trustRecords);

    //
    // Execution subsystem
    //
    const requestBuilder = new ExecutionRequestBuilder();

    const evidenceBuilder = new ExecutionEvidenceBuilder();

    //
    // Runtime
    //
    const builder = new RuntimeBuilder().withPolicyRepository(policyRepository);

    if (signalStateVerifier) {
      builder.withSignalStateVerifier(signalStateVerifier);
    }

    if (policyExecutionVerifier) {
      builder.withPolicyExecutionVerifier(policyExecutionVerifier);
    }

    if (policyGovernanceAnchorResolver) {
      builder.withPolicyGovernanceAnchorResolver(
        policyGovernanceAnchorResolver,
      );
    }

    if (signingReadiness) {
      builder.withSigningReadiness(signingReadiness);
    }

    //
    // Execution Intents (ADR-0012). One service is shared by the runtime (which
    // signs and stores the intent before release) and the application (which
    // reads, verifies and finalizes intents).
    //
    const executionIntentService = executionIntents
      ? new ExecutionIntentService(executionIntents)
      : undefined;

    const executionIntentFinalizer = executionIntentService
      ? new ExecutionIntentFinalizer(executionIntentService, trustRecords)
      : undefined;

    if (executionIntentService) {
      builder.withExecutionIntents(executionIntentService);
    }

    const runtime: Runtime = builder
      .addStage(new TrustChainValidationComponent())
      .addStage(
        new ExecutionComponent(
          executionService,
          requestBuilder,
          executionSystem,
          evidenceBuilder,
        ),
      )
      .build(trustRecords, refusalRecords);

    //
    // Application
    //
    return new ExecutionTrustApplication(
      transactionService,
      runtime,
      verificationService,
      receiptService,
      trustRecords,
      refusalRecords,
      executionIntentService,
      executionIntentFinalizer,
    );
  }
}
