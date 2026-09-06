import type { Policy } from "./types/Policy.js";
import type { PolicyRepository } from "./PolicyRepository.js";

import { PolicyValidator } from "./PolicyValidator.js";

/**
 * Loads exactly one policy.
 */
export class PolicyRouter {
  private readonly validator =
    new PolicyValidator();

  constructor(
    private readonly repository: PolicyRepository,
  ) {}

  public async load(
    name: string,
    version: string,
  ): Promise<Policy> {
    const policy =
      await this.repository.load(
        name,
        version,
      );

    this.validator.validate(
      policy,
    );

    const uncoveredFacts =
      this.validator.findUncoveredFacts(
        policy,
      );

    if (uncoveredFacts.length > 0) {
      console.warn({
        event: "policy_boundSignals_coverage_incomplete",
        policyId: policy.policyId,
        policyVersion: policy.policyVersion,
        uncoveredFacts,
        detail:
          "These rule facts have no boundSignals entry, so " +
          "SignalIntentBinder will not verify them against the " +
          "executed Intent. If a fact has a genuine Intent-side " +
          "equivalent (e.g. an amount or target identifier), add " +
          "it to boundSignals; otherwise this warning can be " +
          "ignored.",
      });
    }

    return policy;
  }
}