# Core-API Findings from the TypeScript and Python SDK Audits

This note consolidates the findings from both SDK audits that are **core-API
or repo-tooling issues, not SDK bugs** — routed here instead of being fixed
inside either SDK, per instruction on both audits ("flag which items are SDK
fixes vs. core-API findings I should route to a separate upstream session").
Both audits point at this single list so they don't diverge into two
descriptions of the same underlying issue.

Status: findings only. Nothing in this document has been fixed — that is a
decision for a dedicated core-API session.

---

## 1. `POST /policies/validate` doesn't validate a policy document

**File:** `packages/api/src/routes/policies.ts:27-59`

The route reads only `req.body.policyId` and `req.body.policyVersion`, then
calls `policyRepository.load(policyId, policyVersion)`. It never accepts or
inspects a policy document body. The route name and the "validate a policy"
framing both SDKs originally used (a `validate(policy: dict)`-shaped method)
imply document validation — checking that a _submitted_ policy is
well-formed. What it actually checks is narrower: "does a policy with this
name+version already exist and load cleanly from disk."

Both SDKs have been corrected to call it as `validate(policy_id,
policy_version)` (Python) / equivalent (TypeScript), matching current
behavior. The open question for a core-API session: was document validation
the original intent, and if so, is it worth adding a real
"validate this document" endpoint separately? Or should the route/method be
renamed (e.g. `confirmPolicyExists`) so the name stops overpromising?

## 2. `POST /transactions` duplicates `POST /execute` with weaker validation

**Files:** `packages/api/src/routes/transactions.ts:83-108` vs.
`packages/api/src/routes/execute.ts:34-72`

Both routes ultimately call `application.execute(transaction)` and return an
`ExecutionTrustRecord`. But they differ in how the request body reaches that
call:

- `POST /execute` validates `businessTransactionId` is a UUID (`execute.ts:46-55`)
  and runs the body through `BusinessTransactionMapper.fromRequest` (`execute.ts:57-60`),
  which forces `status: RECEIVED` and `createdAt: new Date()` regardless of
  what the client sent.
- `POST /transactions` does neither: it spreads `req.body` directly (only
  converting `createdAt` to a `Date`) and calls `application.execute()` with
  the raw, unvalidated, unmapped body (`transactions.ts:91-101`).

So there are two execute-shaped entry points with different strictness, and
nothing in the codebase documents which one is the "real" one or why both
exist. A caller that discovers `/transactions` could bypass the UUID
validation and status/createdAt normalization that `/execute` enforces.

Open question for a core-API session: is this duplication intentional
(e.g. `/transactions` meant for a different, more trusted caller), or is
it an artifact of two implementations converging over time that should be
collapsed into one? Neither SDK exposes a method for `POST /transactions`
today — both were left calling `/execute` only, to avoid encouraging the
weaker-validation path.

## 3. Content-binding / envelope verification is not wired into the plain API server

**Files:**

- `packages/shared/src/domain/execution-authorization.ts` — defines
  `SignedExecutionAuthorization` (v1 envelope: `version` + `businessTransactionHash`).
- `packages/runtime/src/context/RuntimeContext.ts:40` — `authorization?:
SignedExecutionAuthorization` is produced internally by the runtime
  pipeline, but only lives on `RuntimeContext`, not on `ExecutionTrustRecord`
  or any route response.
- `packages/execution-gateway/src/ExecutionGateway.ts` — implements the real
  content-binding check: recomputes the executable-content hash via
  `ExecutableContentHasher` and compares it to
  `authorization.payload.businessTransactionHash` (`ExecutionGateway.ts:150-165`),
  rejecting a mismatch before the nonce is consumed.
- `packages/api/src/application.ts` — `createApplication(executionSystem?)`
  accepts an optional `ExecutionSystem`, but the server's own `application`
  singleton (`export const application = createApplication();`) is
  constructed with **no argument**, so it never uses `ExecutionGateway`.
- Confirmed via `grep`: `SignedExecutionAuthorization` / `ExecutionGateway`
  never appear anywhere in `packages/api/src/routes/*`.

**Net effect:** the plain HTTP API that both SDKs talk to has no
content-binding enforcement at all. `ExecutionGateway` is a fully
implemented, tested library class (see
`packages/execution-gateway/test/execution-gateway.test.ts`) with **no HTTP
server entry point anywhere in this repo** — it's designed to be composed
into a consuming service's own `Connector`, not run standalone.

This was demonstrated concretely in the Python SDK's `content_binding`
example (`python/examples/content_binding/`): resubmitting a modified
payload under the same `businessTransactionId` against the plain server is
rejected, but only via `DuplicateBusinessTransactionError` (simple ID
uniqueness, HTTP 409) — not via any hash/signature check. A modified payload
under a _new_ `businessTransactionId` would not be rejected at all.

**This is the same open question the original TypeScript SDK audit raised**
(does the plain server run the content-binding check, or is that
gateway-wired only) — now confirmed by direct source tracing rather than
inferred.

Open question for a core-API session: should `packages/api`'s default
server wire `ExecutionGateway` in as its `executionSystem` (requiring a
`Connector`/`NonceStore`/public key to be configured), or is the intended
deployment model that operators who need content-binding must build their
own gateway-fronted server using `@parmana/execution-gateway` as a library?
Either is defensible, but it should be a documented decision, not an
implicit gap two independent SDK audits had to rediscover.

---

## 4. (Repo tooling, not API) `npm run`/`npx` break at the repo root

Not an API finding, but discovered while wiring the Python SDK's model
drift-guard into CI, and worth the same "flag, don't fix here" treatment:

**Files:** `package.json:2` and `typescript/package.json:2` both declare
`"name": "parmana"`.

This duplicate workspace name makes plain `npm run <script>` at the repo
root cascade across every workspace instead of running only the root
script (reproduced with the pre-existing `lint` and `typecheck` scripts,
not just anything added during this session), and makes `npx <bin>` resolve
paths relative to an arbitrary workspace directory (observed: `packages/api`)
instead of the repo root. Root-level tooling (including the new
`.github/workflows/python-sdk.yml`) works around this by invoking
`./node_modules/.bin/<bin>` directly. A core-API/repo session should rename
one of the two packages.
