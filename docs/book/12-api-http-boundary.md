[← Book Index](README.md) · [← Previous: Chapter 11, Storage](11-storage.md)

# Chapter 12: The API and HTTP Boundary

`packages/api/src/app.ts`, `routes/`, `middleware/{error-handler,caller-auth,rate-limit}.ts`.

## Composition order matters here too

`createApp()` builds one Express app: `express.json()` first (so every route below it
inherits the same body-parsing failure handling), then `/health`/`/ready` behind a
deliberately permissive rate limiter (Chapter 13 covers why they're rate-limited at all and
why separately from everything else), `/openapi.yaml` and `/documentation` unauthenticated
(the API describes itself without a credential), then caller-auth middleware (Chapter 13),
then the routes that actually do something: `execute.ts`, `transactions.ts`, `policies.ts`,
`pending-policy-changes.ts` (Chapter 14), `verify.ts`/`verify-get.ts`, `replay.ts`,
`receipt.ts`/`receipt-get.ts`, `refusal-get.ts`/`refusal-verify.ts`, `audit-verify.ts`,
`trust-records.ts`, `callers-me.ts`, `version.ts`. The centralized error handler is mounted
last, as Express requires for an error-handling middleware to actually catch what's thrown
above it.

## Turning internal errors into the right status code, deliberately

`error-handler.ts` is where this codebase's internal error types become the HTTP responses
Chapter 8's `NonceAlreadyConsumedError` and Chapter 5's `RuntimeError` were designed to
produce. It handles a short, explicit list, each mapped by `instanceof`, not by inspecting a
generic `.status` property on anything.

- `RuntimeError` (and its subclasses, including `AuditUnavailableError`, Chapter 13) reads
  `.status`/`.code` dynamically off the error itself.
- `NonceAlreadyConsumedError` gets its own dedicated branch (`409`).
- `PolicyNotFoundError`/`PolicyValidationError`/`SignalValidationError`,
  `BusinessTransactionValidationError`, `DuplicateBusinessTransactionError` each map to their
  own specific status.
- Malformed or oversized bodies are caught even earlier, by a small helper
  (`bodyParserErrorStatus`) that recognizes Express's own body-parser failure shapes
  (`entity.too.large` to `413`, `entity.parse.failed` to `400`). These happen *before* any
  route handler runs at all, since `express.json()` itself throws, so this handler exists
  specifically to give them a clean, coded response instead of falling through to the
  generic `500` below.
- Everything else is a plain, uncoded `500`, and that's deliberate, not an oversight: a
  genuinely unexpected failure should look different from every one of the cases above, so a
  caller (or its SDK) can tell "this was a coded, expected rejection" from "something is
  actually broken." Chapter 8 and Chapter 5 both cover the specific coded cases this
  distinction serves: `403 POLICY_DENIED`, `409 NONCE_ALREADY_CONSUMED`, `503
  AUDIT_UNAVAILABLE`. Tutorial 102 (`examples/tutorials/102-distinguishable-http-status`)
  demonstrates all three shapes, plus the generic `500`, side by side against a real server.

## Rate limiting: per-caller, not per-IP, and only when there's a caller to key on

`POST /execute` is rate-limited by authenticated caller identity (`req.callerId`, set by
caller-auth), not by IP. A design-partner integration commonly calls from a shared backend
IP, where an IP-keyed limit would either starve every caller behind it or be loose enough to
mean nothing. It's mounted only when caller authentication is enabled at all: with no caller
identity to key off, falling back to IP would silently become the exact IP-keyed control this
design avoids. `GET /health`/`GET /ready` get a separate, far more permissive limit, since
both are cheap, unauthenticated, and legitimately polled on a fixed interval by PaaS
health-check infrastructure. A rate-limited request returns `429` with a `Retry-After` header
and never reaches policy evaluation or signing: no nonce consumed, nothing signed, for a
request this middleware rejects on its own.

**Scope, honestly stated:** by default the limiter's store is `express-rate-limit`'s
in-memory, single-process store. A deployment running multiple machines has each one
counting independently, an effective ceiling of `RATE_LIMIT_EXECUTE_PER_MINUTE ×
machineCount`, not a fleet-wide limit enforced once — the same caveat Chapter 7 raised
about `NonceStore`, for the same underlying reason: a single-process data structure is
only a fleet-wide guarantee if there's exactly one process.

**Update, 2026-09-10:** unlike `NonceStore` (correctly and deliberately always
Supabase-backed, never in-memory, in a real deployment), the rate limiter's durability is
now conditional: when `DATABASE_URL` is configured, both limiters share counts fleet-wide
via `PostgresRateLimitStore`, an atomic `INSERT ... ON CONFLICT` upsert against a
`rate_limit_counters` table. Without `DATABASE_URL`, the in-process fallback above still
applies, now with a startup warning naming the gap rather than silence. Deliberately not
fail-closed like `NonceStore` — a looser-than-configured rate ceiling degrades a capacity
control, it doesn't remove a security check, so refusing to start over a missing database
would break every correctly-working single-instance deployment. See
`docs/VERIFICATION-GAPS.md` G-41.

## The API describes itself

`GET /openapi.yaml` serves a fully-dereferenced OpenAPI 3.1 document with no unresolved
`$ref`s, unauthenticated. Tutorial 90 exercises this directly. `GET /ready` distinguishes
"up but backed by dead storage" from genuinely ready: when storage is Supabase-backed, it
makes one cheap read against `consumed_nonces` to confirm the connection and credentials
actually work, returning `503` if not, so an orchestrator can route around a machine that's
technically running but can't reach its own database, a distinction `GET /health` (pure
liveness, no external dependency touched at all) deliberately doesn't make.

---

[← Book Index](README.md) · [← Previous: Chapter 11, Storage](11-storage.md) · [Next: Chapter 13, Caller Authentication and Scoping →](13-caller-authentication-and-scoping.md)
