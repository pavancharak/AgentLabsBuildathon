import { describe, expect, it } from "vitest";

import {
  CANONICAL_CAPABILITY_POLICY_BINDINGS,
  CapabilityPolicyBinder,
} from "../../src/CapabilityPolicyBinding.js";
import type { PolicyReference } from "@parmana/shared";

/**
 * Found by an independent repository verification (Phase 2K, TD-22):
 * nothing bound a capability to the one policy that authorizes it.
 * boundSignals/SignalStateVerifier protections are declared per-policy
 * and per-action respectively, so a caller could pair a real capability
 * (e.g. hubspot:deal-update) with an unrelated, unprotected policy
 * (e.g. vendor-payment/2.0.0, which declares no boundSignals for it)
 * and bypass those protections entirely, since PolicyEngine.evaluate
 * takes no action parameter and nothing else cross-checks policy
 * identity against capability identity. This is the regression suite
 * proving that gap is now closed.
 *
 * Moved here from packages/policy/tests/unit (G-30 architecture follow-up,
 * Option C: docs/VERIFICATION-GAPS.md G-30, G-30-ARCHITECTURE-OPTIONS.md)
 * when CapabilityPolicyBinding.ts itself moved into its own package,
 * @parmana/capability-registry, specifically so a future consumer that
 * needs to know "is this capability bound, and to what" doesn't have to
 * depend on all of @parmana/policy to find out.
 */
describe("CapabilityPolicyBinder", () => {
  it("reports no violation for an action with no canonical binding (every test/tutorial action)", () => {
    const binder = new CapabilityPolicyBinder();

    const violation = binder.findViolation("PAY", {
      name: "payment-approval",
      version: "1.0.0",
      schemaVersion: "1.0.0",
    });

    expect(violation).toBeUndefined();
  });

  it("reports no violation when the declared policy matches the canonical binding", () => {
    const binder = new CapabilityPolicyBinder();

    const violation = binder.findViolation("hubspot:deal-update", {
      name: "hubspot-deal-update",
      version: "1.0.0",
      schemaVersion: "1.0.0",
    });

    expect(violation).toBeUndefined();
  });

  it("blocks the exact live-shaped exploit: a real capability paired with an unrelated, unprotected policy", () => {
    const binder = new CapabilityPolicyBinder();

    // The exact attack found during verification: hubspot:deal-update
    // (a data-mutating capability whose stage/amount protections are
    // scoped to hubspot-deal-update/1.0.0's own boundSignals) paired
    // with vendor-payment/2.0.0, a real, loadable policy that declares
    // no boundSignals for it.
    const declared: PolicyReference = {
      name: "vendor-payment",
      version: "2.0.0",
      schemaVersion: "1.0.0",
    };

    const violation = binder.findViolation("hubspot:deal-update", declared);

    expect(violation).toEqual({
      action: "hubspot:deal-update",
      expected: {
        name: "hubspot-deal-update",
        version: "1.0.0",
        schemaVersion: "1.0.0",
      },
      declared,
    });
  });

  it("blocks the same shape of substitution for hubspot:deal-fetch", () => {
    const binder = new CapabilityPolicyBinder();

    const violation = binder.findViolation("hubspot:deal-fetch", {
      name: "customer-refund",
      version: "1.0.0",
      schemaVersion: "1.0.0",
    });

    expect(violation?.expected).toEqual({
      name: "hubspot-deal-update",
      version: "1.0.0",
      schemaVersion: "1.0.0",
    });
  });

  it("reports a violation for a version mismatch even when the policy name matches", () => {
    const binder = new CapabilityPolicyBinder();

    const violation = binder.findViolation("hubspot:deal-update", {
      name: "hubspot-deal-update",
      version: "9.9.9",
      schemaVersion: "1.0.0",
    });

    expect(violation).toBeDefined();
  });

  it("has exactly one canonical policy per bound capability", () => {
    const seenActions = new Set<string>();

    for (const action of CANONICAL_CAPABILITY_POLICY_BINDINGS.keys()) {
      expect(seenActions.has(action)).toBe(false);
      seenActions.add(action);
    }

    expect(CANONICAL_CAPABILITY_POLICY_BINDINGS.size).toBe(seenActions.size);
  });

  it("binds every capability the production connector registry actually registers", () => {
    const boundActions = new Set(CANONICAL_CAPABILITY_POLICY_BINDINGS.keys());

    //
    // razorpay:payment-fetch / razorpay:refund-create /
    // razorpay:refund-fetch were in this set until the Razorpay
    // connector was deliberately removed (see the removal commit and
    // CLAIMS.md's historical §3.4-3.9/3.8/3.9). A capability that no
    // connector resolves to has nothing for this binder to protect.
    //
    // github:pr-fetch / github:pr-merge (packages/api/src/bootstrap/
    // createConnectorRegistry.ts, wired 2026-08-19) were missing from
    // this set for six days before this test's own name was checked
    // against it (docs/VERIFICATION-GAPS.md G-30) -- this asserts a
    // hardcoded expected set, not a live read of createConnectorRegistry.ts,
    // so it could not and did not catch that omission on its own. Extracting
    // this file into its own package (Option C) does not change that: the
    // set below is still hand-maintained and must still be kept in sync by
    // hand whenever a connector is registered or removed -- the same
    // duplicated-list tradeoff terminology-guard.test.ts's own comment
    // documents for its independent exclusion list. Moving this file into
    // its own package does not, by itself, reduce how many places these
    // four capability strings are spelled (still here, in
    // CapabilityPolicyBinding.ts, and separately in
    // connector-github/connector-hubspot's own *Capabilities.ts files --
    // this package deliberately does not depend on either, see
    // CapabilityPolicyBinding.ts's own comment for why). What the move
    // removes is the packages/policy -> packages/api coupling Option B
    // would have required, and gives a future consumer (createConnectorRegistry.ts
    // itself, eventually) a leaf package to depend on instead of all of
    // @parmana/policy. This assertion is still not self-updating.
    //
    // paytm:refund (packages/api/src/bootstrap/createConnectorRegistry.ts,
    // wired alongside the remote Paytm connector) is bound to
    // customer-refund/1.0.0 -- the same policy customer-refund's own
    // unit/reference-policy tests already exercise directly (see
    // packages/policy/tests/unit/ReferencePolicies*.test.ts).
    expect(boundActions).toEqual(
      new Set([
        "hubspot:deal-fetch",
        "hubspot:deal-update",
        "github:pr-fetch",
        "github:pr-merge",
        "paytm:refund",
      ]),
    );
  });
});
