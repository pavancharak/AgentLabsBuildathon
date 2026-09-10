# Production-readiness fixes — 2026-09-10

**Commit range:** `624adf7`..`4b22d8b` (14 commits)
**Scope:** response to an external, code-derived production-readiness audit (13 items,
none critical). Every item was independently re-verified against current source before
being acted on; one item was overturned by that re-verification (see below).

This is a fix/hardening pass, not a version bump — no new git tag was created, and none
of this changes the existing `v1.0.0` tag, which refers specifically to the Python SDK's
own release, not the system as a whole. `README.md`'s own scope statement
("sustained volume, load-bearing traffic, high availability, or multi-tenant production
operation" not claimed) is unchanged by this session.

---

## Gaps closed (`docs/VERIFICATION-GAPS.md`, G-40–G-49)

| Gap | Fix | Commit |
|---|---|---|
| G-40 | `KEY_PROVIDER=aws-kms`/`azure-key-vault`/`gcp-kms`/`hsm` now fails closed at startup instead of silently constructing `FileKeyProvider`. No real cloud KMS/HSM provider was implemented — this closes the *silent-fallback* failure mode, not the absence of those providers. | `624adf7` |
| G-41 | New `PostgresRateLimitStore` closes the fleet-wide gap in `/execute` and `/health`,`/ready` rate limiting — durable when `DATABASE_URL` is configured, in-process fallback with a loud warning otherwise. **Postgres, not Redis.** | `2d643ca` |
| G-42 | `.env.example` no longer ships `PARMANA_AUTH_DISABLED=true` uncommitted; `GET /ready` now returns `authDisabled`/`warning` fields. | `263387b` |
| G-43 | Gateway identity now configurable via `PARMANA_GATEWAY_ID` (was hardcoded); session-issuance capability token is a real generated value instead of `{}`. | `2761548` |
| G-44 | New startup warning when `HUBSPOT_PRIVATE_APP_TOKEN` hasn't been rotated in 90 days or has no recorded rotation date. This is a **log warning**, not automated rotation or credential revocation — HubSpot tokens still require manual rotation via HubSpot's own settings. | `33d96b3` |
| G-45 | New `GET /trust-records` — bulk export of full signed Execution Trust Records (JSON array; no CSV/JSONL), caller-scoped and paginated like `GET /transactions`, with `since`/`until` date filtering. On the main API (`packages/api`), not `governance-ui`. | `2aa585f` |
| G-46 | `governance-ui`'s `POST /login` (its only unauthenticated route) is now rate-limited (10/minute, IP-keyed). Reviewed the rest of its security posture in the same pass — session-fixation hardening, cookie flags, XSS escaping — and found it already correct. | `373a020` |
| G-47 | New structured, level-gated logger (`@parmana/shared`'s `createLogger`/`getLogger`) — `LOG_LEVEL` was read into config but gated nothing; this is the tested gating infrastructure. Not yet threaded through the ~17 existing `console.*` call sites (follow-up work). | `147a366` |
| G-48 | `npm audit`: 12 vulnerabilities (3 high) → 3 moderate, via a `qs` override and a `vitest` patch bump. Residual 3 are in this session's own new dev-only load-test dependency chain, never installed in the production image. | `669b198` |
| G-49 | New `npm run loadtest` (`scripts/load-test.ts`) — no load testing existed before this. One real run: `POST /execute` sustained ~51 req/s, p50 188ms/p99 444ms at 10 connections. One benchmark run, not a volume/SLA proof. | `c32a861` |

**Found not applicable, contrary to the source audit's framing:** the session-credential
vault and gateway-session store do not need persistent storage. Both are strictly
intra-request, single-process objects — traced directly: neither `sessionCredentialId`
nor `GatewaySession.sessionId` ever appears in an HTTP response, and no second endpoint
exists that could consume one later. Independently corroborated by this repo's own prior
Phase 3D audit (§12.6), reached the same conclusion for the same reason. Not fixed;
nothing to fix.

**Found and fixed along the way, not part of the original 13 items:** the Dashboard-only
Supabase migration-apply script (`scripts/apply-all-migrations.sql`) was three migrations
behind `supabase/migrations/` — two predating this session. A Dashboard-only deployment
following `DEPLOYMENT.md`'s own documented steps would have gotten an incomplete schema.
Fixed (`1361f52`).

**Not closed, blocked on an external constraint, not a code fix:** CI's
`verify-policy-approvals` maker-checker gate remains advisory only, not a required GitHub
branch-protection status check. Confirmed live via `gh api repos/{owner}/{repo}/branches/
main/protection` — a `403`, "Upgrade to GitHub Pro or make this repository public to
enable this feature." This needs the repository owner's decision (billing or
visibility), not a code change. See `docs/VERIFICATION-GAPS.md` D-6.

**Deferred, matching the source audit's own framing as low-priority:** automated
key-rotation tooling, and splitting the Razorpay settlement poll loop into its own
container.

---

## `docs/CLAIMS.md` updates

- **§2.16** (Caller Authentication at the API Boundary) — `.env.example` default and `GET
  /ready`'s new `authDisabled` field.
- **§2.18** (Key Provider Input Validation) — `KEY_PROVIDER` fail-closed behavior.
- **§2.26** (Policy Governance, `governance-ui` subsection) — `POST /login` rate limiting.
- **§3.14** (Per-Caller Rate Limiting on `/execute`) — the fleet-wide durability gap that
  section's own "Scope, precisely" paragraph named is now closable via `DATABASE_URL`.
- **New §3.21** (Bulk/Compliance Export of Execution Trust Records, Scoped).

## Documentation

- `docs/site/changelog.mdx`: entries for all 13 commits.
- `DEPLOYMENT.md`: operator notes for `KEY_PROVIDER`, `PARMANA_GATEWAY_ID`, HubSpot
  rotation, `GET /ready`'s `authDisabled` field, and rate-limiter `DATABASE_URL`
  durability.

---

## Environment variables

New, all optional with working defaults — nothing here is required to keep an existing
deployment running:

| Variable | Default | Effect |
|---|---|---|
| `PARMANA_GATEWAY_ID` | `parmana-gateway` | Gateway's logical identity |
| `HUBSPOT_PRIVATE_APP_TOKEN_ROTATED_AT` | unset | Enables the staleness warning; a missing value just logs a reminder, nothing fails |

No new required variables. `KEY_PROVIDER` remains optional (defaults to `local`) — it is
**not** a new required variable, and setting it to `aws-kms`/`azure-key-vault`/`gcp-kms`/
`hsm` will make the process refuse to start, since none of those providers are
implemented yet.

## Breaking changes

None. Every change is additive or a stricter startup check on a value that was already
being silently ignored (`KEY_PROVIDER`).

---

## Verification

```
✅ npm run typecheck   — clean
✅ npm run lint         — clean
✅ npm run lint:openapi — clean
✅ npx vitest run       — 1631 passed, 38 skipped (gated live/DB suites), 0 failed
✅ working tree         — clean, nothing pushed to any remote
```

*Grounded in `git log 624adf7..4b22d8b`, `docs/VERIFICATION-GAPS.md`, and `docs/CLAIMS.md`
as committed at `4b22d8b`. No commit hash, gap mapping, or feature claim in this document
was carried over from an earlier draft without independent verification against source.*
