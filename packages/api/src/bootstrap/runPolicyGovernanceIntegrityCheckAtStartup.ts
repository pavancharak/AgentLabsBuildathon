import { runPolicyGovernanceIntegrityCheckOnce } from "./policyGovernanceIntegrityCheckRunner.js";

/**
 * Kicks off the Policy Governance deploy/startup integrity check
 * (see verifyPolicyGovernanceIntegrityAtStartup.ts) without awaiting
 * it -- deliberately: this check must never delay the server from
 * binding its port and accepting traffic, only run alongside that.
 *
 * The checker function itself never throws once invoked -- but
 * *constructing* its dependencies (`new PolicyChangeCrypto()` below)
 * happens synchronously, as part of building the argument object,
 * before verifyPolicyGovernanceIntegrityAtStartup ever returns a
 * promise for `.catch()` to attach to. A `.catch()` alone does not
 * cover a throw from that construction step. The try/catch below
 * does: it wraps construction and invocation together, so a
 * synchronous throw here (e.g. from a future change to
 * PolicyChangeCrypto's constructor, or a signature-provider /
 * hash-provider registry gap) is logged and swallowed the exact same
 * way as an asynchronous failure inside the check itself -- never
 * propagated, never able to block server startup.
 *
 * A single one-time run -- see schedulePolicyGovernanceIntegrityCheck.ts
 * for the periodic re-run that catches drift introduced after startup,
 * during a long-lived process's uptime.
 */
export function runPolicyGovernanceIntegrityCheckAtStartup(): void {
  runPolicyGovernanceIntegrityCheckOnce();
}
