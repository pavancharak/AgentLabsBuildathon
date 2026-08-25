# Scoped Credential Architecture (2026-08-26)

**Redirected from the originating prompt's premise.** The prompt this document was drafted
from asked about a `ScopedCredential` model, a `packages/api/src/providers/credentialScope/`
directory, `scoped-credential.test.ts`, and scoping a "live `parmana-prod` Razorpay connector."
None of those exist. Checked directly before writing anything below:

```
MISSING: packages/api/src/models/ScopedCredential.ts
MISSING: packages/api/src/providers/credentialScope/
MISSING: packages/api/tests/unit/scoped-credential.test.ts
MISSING: packages/razorpay-connector/src/RazorpayConnector.ts  (Razorpay removed 2026-08-12, d8a6ded)
```

What actually exists, and answers the same underlying question — "can an authenticated caller
be restricted to a subset of capabilities, enforced independently of policy" — is
`docs/CLAIMS.md` §3.16, **Caller-to-Capability Scoping**. This document answers the originating
prompt's five questions against that real mechanism.

---

## 1. How are scopes defined?

**A list of capability-identifier strings, not role-based and not a bitmask.**

`ApiKeyEntry.allowedCapabilities` (`packages/shared/src/config/ApiKeyEntry.ts:71`):

```typescript
readonly allowedCapabilities?: readonly string[];
```

Each string is exactly an `Intent.action` value — the same identifier
`CANONICAL_CAPABILITY_POLICY_BINDINGS` (`@parmana/capability-registry`, see the G-30 work) keys
on: `"hubspot:deal-fetch"`, `"hubspot:deal-update"`, `"github:pr-fetch"`,
`"github:pr-merge"`. One reserved literal, `"*"`, means "every capability" — an explicit,
auditable wildcard grant, never an implicit default.

**Fail-closed default, and it's the opposite default from the sibling `allowedPrincipalIds`
field on the same entry:** an unset or empty `allowedCapabilities` denies *every* capability.
(`allowedPrincipalIds`, by contrast, defaults to "may only assert itself" — there's a
meaningful non-empty fallback for principal identity that doesn't exist for capabilities, per
that field's own doc comment.)

## 2. How is scope enforced?

**Hard boundary, at the route-handler level — before `application.execute()`, i.e. before
`CapabilityPolicyBinder`/`PolicyEngine.evaluate` are ever reached.** Not inside a "vault," and
not inside `PolicyEngine` (which is explicitly, by design, caller-agnostic — see
`docs/CLAIMS.md` §2.24).

Call site (`packages/api/src/routes/execute.ts:156`, mirrored in `transactions.ts:230`):

```typescript
if (req.callerId !== undefined) {
  const action = transaction.intent?.action;

  if (!isCapabilityAllowed(action, req.callerAllowedCapabilities)) {
    // 403, code: "CAPABILITY_NOT_ALLOWED", audited as caller.capability_denied,
    // returns before application.execute() is ever called.
  }
}
```

`isCapabilityAllowed` itself (`packages/api/src/auth/isCapabilityAllowed.ts`) is a pure,
four-line function — no state, no I/O, trivially auditable:

```typescript
export function isCapabilityAllowed(
  action: string | undefined,
  allowedCapabilities: readonly string[] | undefined,
): boolean {
  if (!action) return false;
  if (!allowedCapabilities || allowedCapabilities.length === 0) return false;
  if (allowedCapabilities.includes("*")) return true;
  return allowedCapabilities.includes(action);
}
```

**Why "hard" is the right word, and why there's no client-supplied "requested scope" to
spoof:** `action` here is `transaction.intent.action` — the actual capability the request is
asking to invoke, parsed server-side from the Business Transaction body, the same field
`CapabilityPolicyBinder`/`PolicyEngine`/the connector registry all key on downstream. There is
no separate, client-asserted "capabilities" field checked *instead* of the real action (unlike,
say, a JWT scope claim a client could try to forge). A caller cannot smuggle an out-of-scope
action past this check by declaring something different in a side channel — the thing being
checked is the thing that would actually execute. This matters directly for the "three
scenarios" demo in §5 below.

**Skipped, not bypassed, when caller-auth is disabled entirely** (`req.callerId === undefined`)
— `createApp`'s `callerAuth` option is mandatory (`"disabled"` or a real
authenticator/auditSink pair, no default; `docs/CLAIMS.md` §2.16), so this is always an
explicit deployment choice, never a silent gap.

## 3. What capabilities do the connectors that actually exist support?

Razorpay's capability list (`refund`, `charge`, `reverse`, `dispute`, etc., per the originating
prompt) describes a connector that isn't here. The real, currently registered capabilities
(`packages/api/src/bootstrap/createConnectorRegistry.ts`, `docs/CLAIMS.md` §3.10/§3.17):

| Connector | Capabilities | Nature |
|---|---|---|
| HubSpot | `hubspot:deal-fetch` | read-only |
| HubSpot | `hubspot:deal-update` | mutates `dealstage`/`amount` on an existing deal |
| GitHub | `github:pr-fetch` | read-only (PR state) |
| GitHub | `github:pr-merge` | mutates: merges a pull request, irreversible |

`test-fixture` also registers `test:fixture-execute` (`NODE_ENV=test`-only, unbound from
`CapabilityPolicyBinder`'s governance, no production implication) — this is the capability
every existing scoping test (`caller-capability-scoping.integration.test.ts`) currently
exercises, since it's the one path where caller-auth is actually turned on in a test today (see
§4 below for why that matters).

## 4. How do you create a scoped credential?

There is no `createCredential(...)` factory. A scoped caller is a plain `ApiKeyEntry` object,
constructed directly (in tests) or provisioned via `PARMANA_API_KEYS`/
`scripts/generate-api-key.ts` (in a real deployment):

```typescript
import { hashApiKey } from "../../src/auth/hashApiKey.js";
import { StaticKeyAuthenticator } from "../../src/auth/StaticKeyAuthenticator.js";

const RAW_KEY = "some-caller-raw-key"; // shown to the operator once, never stored

const authenticator = new StaticKeyAuthenticator([
  {
    callerId: "github-pr-fetch-only-caller",
    keyHash: hashApiKey(RAW_KEY),
    allowedPrincipalIds: ["some-principal"],
    allowedCapabilities: ["github:pr-fetch"], // narrowest scope: read-only, single capability
  },
]);

const app = createApp(application, {
  callerAuth: { authenticator, auditSink },
});
```

Only the SHA-256 hash of the raw key is ever held (`StaticKeyAuthenticator`, constant-time
comparison via `timingSafeEqual`) — the same mechanism `docs/CLAIMS.md` §2.16 already
documents.

**The critical gap for a live FCA demo, already disclosed in `docs/CLAIMS.md` §4 (`[FUTURE]`)
and restated in the G-30 audit-fix pass's own correction to that item:** neither HubSpot's nor
GitHub's *production* integration path has caller-auth turned on. Both integration test
suites construct their app with `callerAuth: "disabled"` (`hubspot-deal-update.integration.
test.ts`, `hubspot-live.integration.test.ts`, `github-pr-merge.integration.test.ts`,
`github-pr-merge-live.integration.test.ts`) — confirmed directly, not assumed. Today, this
scoping mechanism is real, tested, and enforced, but only for the generic
`test:fixture-execute` capability. It is not yet wired to either capability that actually
moves real state.

## 5. How do you test scope enforcement?

**Existing pattern, directly reusable:**
`packages/api/tests/integration/caller-capability-scoping.integration.test.ts` — HTTP-level,
against the real `createApp`/`POST /execute` route, four caller shapes (scoped, wrong-scope,
wildcard, no-capabilities), asserting `403`/`CAPABILITY_NOT_ALLOWED` on denial (not
`POLICY_DENIED` — proves capability denial runs *before* policy evaluation, not merely also
rejecting), and that the audit trail (`caller.capability_denied`) never contains the raw key.
Companion unit-level coverage in `packages/api/tests/unit/isCapabilityAllowed.test.ts` for the
pure function itself.

**Mapping the originating prompt's "three scenarios" onto what this mechanism actually does:**

1. **Valid, in-scope** — caller scoped to exactly the invoked capability → `200`/`201`.
   (`caller-capability-scoping.integration.test.ts`'s `SCOPED_KEY` case, verbatim.)
2. **Out-of-scope** — caller scoped to a different capability, or none → `403`,
   `CAPABILITY_NOT_ALLOWED`, zero execution-control audit events (never reached that far).
   (`UNSCOPED_KEY`/`NO_CAPABILITIES_KEY` cases, verbatim.)
3. **"Jailbreak attempt"** — per §2 above, there is no separate client-asserted scope field to
   forge; the check runs against the actual `intent.action` that would execute. The honest
   version of this scenario is: an out-of-scope caller retries the *same* request against the
   mutating capability while the read-only one is allowed (e.g., scoped to `github:pr-fetch`
   only, attempts `github:pr-merge`) — same `403`/`CAPABILITY_NOT_ALLOWED` result as scenario 2,
   but a clearer "compromised low-privilege agent tries to escalate to the dangerous action"
   narrative for an FCA reviewer than a generic wrong-capability case. This is a stronger claim
   than "policy-checked" precisely *because* there's nothing to jailbreak — worth stating
   plainly in the proof artifact rather than manufacturing a synthetic bypass attempt that
   doesn't correspond to how the check actually works.

---

## Recommendation for the Week 2 demo

**Use GitHub (`github:pr-fetch` / `github:pr-merge`), not HubSpot.** Structurally either
connector works identically — this is a caller-identity mechanism, not connector-specific — but
GitHub's read/mutate pair (fetch a PR's state vs. merge it, irreversible) maps more directly
onto the originating prompt's own "refund-only" framing (a safe read/inspect action vs. a
high-consequence mutating one) than HubSpot's fetch/update-amount pair does, and "an agent that
can check PR status but cannot merge" is an easier scenario for a non-technical reviewer to
follow than a CRM field update.

**Two honest paths for Week 2, not one — this needs a decision, not an assumption:**

- **(a) Demo against `test:fixture-execute`, today, no code change.** Fast, uses the exact
  mechanism and test pattern already proven in `caller-capability-scoping.integration.test.ts`,
  but is not a demo against a connector that actually moves real state — same caveat
  `docs/CLAIMS.md` §3.16 already carries.
- **(b) Wire caller-auth onto the GitHub connector integration path first**, then demo against
  real `github:pr-fetch`/`github:pr-merge`. This is real, currently-`[FUTURE]`,
  previously-undocumented-as-started work (`docs/CLAIMS.md` §4's own item, restated in the
  G-30 audit-fix pass) — a genuinely more convincing FCA artifact, but materially more scope
  than "write a demo," and touches the one connector path (GitHub, production-wired) that
  actually merges pull requests, which is worth doing carefully, not under a two-week
  compressed timeline's back half.

Not deciding between (a) and (b) here — that's the actual Week 2 decision this document exists
to set up, not something to assume on Pavan's behalf.
