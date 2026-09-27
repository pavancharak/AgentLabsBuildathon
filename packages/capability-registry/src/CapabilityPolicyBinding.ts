import type { PolicyReference } from "@parmana/shared";

/**
 * One violation of the capability/policy binding: the caller declared
 * a policy reference other than the one bound to this capability, or
 * the version in effect could not be established.
 */
export interface CapabilityPolicyBindingViolation {
  readonly action: string;
  readonly expected: PolicyReference;
  readonly declared: PolicyReference;

  /**
   * Set when no version in effect could be established for the bound
   * policy name (none approved, or the lookup failed). The request is
   * refused either way; this says why.
   */
  readonly reason?: string;
}

/**
 * Where the version in effect for a bound policy name comes from when
 * policy governance decides it (G-66): the version with the most recent
 * approval record for that name. Returns undefined when no version of
 * the name was ever approved. Throws when it cannot tell.
 */
export interface CurrentPolicyVersionSource {
  currentVersion(policyName: string): Promise<string | undefined>;
}

/**
 * The single authoritative mapping from a production capability
 * (`Intent.action`) to the one policy that governs it.
 *
 * Every entry here corresponds to a capability actually registered in
 * production bootstrap (`packages/api/src/bootstrap/createConnectorRegistry.ts`)
 * and the one policy file already purpose-built to authorize it
 * (`policies/<name>/<version>/policy.json`).
 *
 * The policy NAME is fixed here and changes only with a deploy. The
 * VERSION here is used only where policy governance does not decide it
 * (NODE_ENV test and development, see CapabilityPolicyBinder). Where it
 * does, production included, the version in effect is the one most
 * recently approved through policy governance (G-66), so a new version
 * goes live when it is approved, with no deploy. Actions with no entry here
 * (every test/tutorial/example fixture action, and any future capability
 * not yet given a canonical policy) are entirely unaffected by
 * `CapabilityPolicyBinder` -- this table is additive, not a replacement
 * for `PolicyRouter`/`PolicyEngine`, and does not change how a policy,
 * once selected, is loaded or evaluated.
 *
 * Lives in its own package (`@parmana/capability-registry`), not
 * `@parmana/policy`, specifically so that a package which needs to know
 * "is this capability bound, and to what" -- including, eventually,
 * `packages/api`'s own connector-registration bootstrap -- can depend on
 * this map without depending on all of `@parmana/policy` (`PolicyEngine`,
 * `SignalIntentBinder`, etc.), and so `@parmana/policy` itself can depend
 * on this map without creating a cycle back through any connector package.
 * `@parmana/connector-hubspot` (directly) and `@parmana/connector-github`
 * (via `@parmana/connector-sdk`) both already depend on `@parmana/policy`,
 * so this package deliberately depends on nothing except `@parmana/shared`
 * -- not on either connector package -- to keep it a true leaf. See
 * `docs/VERIFICATION-GAPS.md` G-30 and `G-30-ARCHITECTURE-OPTIONS.md`
 * (repo root) for the full history of why this extraction happened and
 * what it does and doesn't close.
 */
export const CANONICAL_CAPABILITY_POLICY_BINDINGS: ReadonlyMap<
  string,
  PolicyReference
> = new Map([
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
  [
    "paytm:refund",
    { name: "customer-refund", version: "1.1.0", schemaVersion: "1.0.0" },
  ],
  [
    "slack:post-message",
    { name: "slack-post-message", version: "1.0.0", schemaVersion: "1.0.0" },
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
   * With currentVersions, the declared version must equal the version
   * in effect for the bound name, as policy governance decides it: an
   * older version, even one approved in the past, is refused, and so is
   * any request when none is approved or the lookup fails. Without it,
   * the declared version must equal the version in the binding above.
   */
  constructor(private readonly currentVersions?: CurrentPolicyVersionSource) {}

  /**
   * Returns the binding violation for this action/declared-policy pair,
   * or undefined when there is nothing to enforce (no canonical entry
   * for this action) or the declared policy already matches it.
   */
  public async findViolation(
    action: string,
    declared: PolicyReference,
  ): Promise<CapabilityPolicyBindingViolation | undefined> {
    const bound = CANONICAL_CAPABILITY_POLICY_BINDINGS.get(action);

    if (bound === undefined) {
      return undefined;
    }

    if (this.currentVersions === undefined) {
      return bound.name === declared.name && bound.version === declared.version
        ? undefined
        : { action, expected: bound, declared };
    }

    let currentVersion: string | undefined;

    try {
      currentVersion = await this.currentVersions.currentVersion(bound.name);
    } catch (error) {
      return {
        action,
        expected: bound,
        declared,
        reason:
          `the version of policy "${bound.name}" in effect for capability "${action}" ` +
          `could not be looked up: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    if (currentVersion === undefined) {
      return {
        action,
        expected: bound,
        declared,
        reason:
          `no version of policy "${bound.name}", which capability "${action}" requires, ` +
          "has been approved through policy governance",
      };
    }

    const expected: PolicyReference = { ...bound, version: currentVersion };

    return bound.name === declared.name && currentVersion === declared.version
      ? undefined
      : { action, expected, declared };
  }
}
