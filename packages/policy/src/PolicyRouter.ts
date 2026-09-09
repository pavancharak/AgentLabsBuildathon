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

    //
    // validate() itself now fails closed on any rule-referenced fact
    // with neither a boundSignals entry nor an unboundSignalReasons
    // entry (see PolicyValidator.findUncoveredFacts' own doc comment)
    // -- an uncovered, unacknowledged fact throws here rather than
    // merely logging a warning nobody loading this policy would see.
    //
    this.validator.validate(
      policy,
    );

    return policy;
  }
}