import type { PolicyReference } from "@parmana/shared";

/**
 * One violation of the capability/policy binding: the caller declared
 * a policy reference other than the one canonically bound to this
 * capability.
 */
export interface CapabilityPolicyBindingViolation {
  readonly action: string;
  readonly expected: PolicyReference;
  readonly declared: PolicyReference;
}

/**
 * The single authoritative mapping from a production capability
 * (`Intent.action`) to the one policy that governs it.
 *
 * Every entry here corresponds to a capability actually registered in
 * production bootstrap (`packages/api/src/bootstrap/createConnectorRegistry.ts`)
 * and the one policy file already purpose-built to authorize it
 * (`policies/<name>/<version>/policy.json`). Actions with no entry here
 * (every test/tutorial/example fixture action, and any future capability
 * not yet given a canonical policy) are entirely unaffected by
 * `CapabilityPolicyBinder` -- this table is additive, not a replacement
 * for `PolicyRouter`/`PolicyEngine`, and does not change how a policy,
 * once selected, is loaded or evaluated.
 */
export const CANONICAL_CAPABILITY_POLICY_BINDINGS: ReadonlyMap<string, PolicyReference> = new Map([
  [
    "hubspot:deal-fetch",
    { name: "hubspot-deal-update", version: "1.0.0", schemaVersion: "1.0.0" },
  ],
  [
    "hubspot:deal-update",
    { name: "hubspot-deal-update", version: "1.0.0", schemaVersion: "1.0.0" },
  ],
  [
    "github:pr-fetch",
    { name: "github-pr-approval", version: "1.0.0", schemaVersion: "1.0.0" },
  ],
  [
    "github:pr-merge",
    { name: "github-pr-approval", version: "1.0.0", schemaVersion: "1.0.0" },
  ],
]);

/**
 * Capability/Policy Binder.
 *
 * A capability whose `boundSignals`/`SignalStateVerifier` protections
 * are scoped to one specific policy is only actually protected by them
 * when that specific policy is the one evaluated. Nothing upstream of
 * this class enforces that: `PolicyRouter`/`FilePolicyRepository` load
 * whatever `policy.name`/`policy.version` the caller declares,
 * `PolicyEngine.evaluate` takes no `action` parameter at all, and
 * `DefaultConnectorPolicy.assertAllowed` checks only that the resolved
 * connector declares the capability, never which policy authorized it.
 * A caller could therefore pair a real capability (e.g.
 * `hubspot:deal-update`) with an unrelated, unprotected policy that
 * has no `boundSignals` for it, evaluate that policy's own (looser)
 * rules against self-declared signals, and have the real, unrelated
 * `intent.parameters` executed -- bypassing the capability's intended
 * protections entirely, not merely weakening them.
 *
 * This class closes that gap structurally: for any capability present
 * in `CANONICAL_CAPABILITY_POLICY_BINDINGS`, the declared policy
 * reference MUST equal the canonical one, or the request is rejected
 * before a policy file is even evaluated against it. Capabilities with
 * no canonical entry are unaffected -- caller-declared policy selection
 * for those is unchanged.
 */
export class CapabilityPolicyBinder {
  /**
   * Returns the binding violation for this action/declared-policy pair,
   * or undefined when there is nothing to enforce (no canonical entry
   * for this action) or the declared policy already matches it.
   */
  public findViolation(
    action: string,
    declared: PolicyReference,
  ): CapabilityPolicyBindingViolation | undefined {
    const expected = CANONICAL_CAPABILITY_POLICY_BINDINGS.get(action);

    if (expected === undefined) {
      return undefined;
    }

    if (
      expected.name === declared.name &&
      expected.version === declared.version
    ) {
      return undefined;
    }

    return { action, expected, declared };
  }
}
