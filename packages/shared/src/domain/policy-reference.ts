export interface PolicyReference {
  /**
   * Policy identifier.
   */
  readonly name: string;

  /**
   * Business policy version.
   */
  readonly version: string;

  /**
   * Policy schema version.
   */
  readonly schemaVersion: string;

  /**
   * sha256 of the canonicalized policy.json content actually loaded
   * for this decision (G-24 remediation). Optional and caller-
   * unsettable: a request-supplied PolicyReference never carries this
   * -- it is computed by RuntimeEngine from the real loaded Policy
   * document, after policyRouter.load, and merged into the copy of
   * this reference embedded in ExecutionTrustRecord.transaction.policy
   * only. Lets a later audit confirm exactly which policy *content*
   * (not merely which version string) was in force for a specific
   * past decision, closing the gap where an in-place edit to an
   * existing version's file (see VERIFICATION-GAPS.md G-24's own
   * precedent for this) would otherwise be undetectable from the
   * trust record alone.
   */
  readonly contentHash?: string;
}
