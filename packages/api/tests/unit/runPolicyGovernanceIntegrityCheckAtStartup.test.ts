import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * PolicyChangeCrypto's real constructor cannot be made to throw in an
 * ordinary test run -- CryptoBootstrap.create() caches its result in
 * a static field, so once any earlier test in this process has
 * constructed one successfully, every later construction just
 * returns the cached provider. Mocking @parmana/crypto here is the
 * only way to exercise a genuine synchronous constructor throw
 * against the real (unmocked) runPolicyGovernanceIntegrityCheckAtStartup
 * code -- this is the exact path the independent audit found had zero
 * test coverage.
 */
vi.mock("@parmana/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@parmana/crypto")>();

  return {
    ...actual,
    PolicyChangeCrypto: class {
      constructor() {
        throw new Error("simulated PolicyChangeCrypto construction failure");
      }
    },
  };
});

describe("runPolicyGovernanceIntegrityCheckAtStartup: construction-time failure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never propagates a throw from constructing its dependencies, and logs it instead", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { runPolicyGovernanceIntegrityCheckAtStartup } =
      await import("../../src/bootstrap/runPolicyGovernanceIntegrityCheckAtStartup.js");

    // The real regression check: calling this must not throw, even
    // though PolicyChangeCrypto's constructor -- invoked synchronously
    // as part of building the options object, before any promise
    // exists for .catch() to attach to -- throws for real here.
    expect(() => runPolicyGovernanceIntegrityCheckAtStartup()).not.toThrow();

    expect(
      consoleError.mock.calls.some(
        ([entry]) =>
          typeof entry === "object" &&
          entry !== null &&
          (entry as { event?: unknown }).event ===
            "policy_governance_integrity_check_unexpected_failure",
      ),
    ).toBe(true);
  });
});
