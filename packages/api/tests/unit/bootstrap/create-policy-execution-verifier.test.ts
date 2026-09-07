import { afterEach, describe, expect, it } from "vitest";

import { PolicyGovernanceExecutionVerifier } from "../../../src/governance/PolicyGovernanceExecutionVerifier.js";
import { createPolicyExecutionVerifier } from "../../../src/bootstrap/createPolicyExecutionVerifier.js";

const ENV_KEY = "POLICY_EXECUTION_VERIFICATION_ENFORCED";

describe("createPolicyExecutionVerifier", () => {
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it("returns undefined (unconfigured) when the env var is unset -- the safe default", () => {
    delete process.env[ENV_KEY];

    expect(createPolicyExecutionVerifier()).toBeUndefined();
  });

  it("returns undefined for any value other than the exact string 'true'", () => {
    process.env[ENV_KEY] = "1";
    expect(createPolicyExecutionVerifier()).toBeUndefined();

    process.env[ENV_KEY] = "TRUE";
    expect(createPolicyExecutionVerifier()).toBeUndefined();

    process.env[ENV_KEY] = "false";
    expect(createPolicyExecutionVerifier()).toBeUndefined();
  });

  it("returns a real PolicyGovernanceExecutionVerifier when explicitly enabled", () => {
    process.env[ENV_KEY] = "true";

    expect(createPolicyExecutionVerifier()).toBeInstanceOf(
      PolicyGovernanceExecutionVerifier,
    );
  });
});
