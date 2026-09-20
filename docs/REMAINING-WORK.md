# Remaining work

Snapshot: 2026-09-20. This is the current list of what is left. It replaces `02-REMAINING.md` (a July 5 snapshot) for current status.

Every item says how it was verified. Items marked **not re audited** are copied from `docs/VERIFICATION-GAPS.md` as written there, and were not checked again on this date. The full record of what was found and closed stays in `docs/VERIFICATION-GAPS.md` and `docs/CLAIMS.md`.

## What was finished on 2026-09-20

Both SDKs are published as 1.1.6. The docs site is restructured with an environment variable reference, an integration specification for AI agents, a production runbook and a deployment specification for AI agents. Production fails closed on policy binding, signing works under AWS KMS beyond 4096 bytes, and an approved action with no configured connector now returns `503 CONNECTOR_NOT_REGISTERED`. The Docker image builds and boots in CI on every change that can break it.

## A. Needs the operator

| Item                                                    | Why                                                                                                                                                                                                                                                                      | How to finish                                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Redeploy production                                     | Code merged after the last deploy (for example `CONNECTOR_NOT_REGISTERED`) is not live until the next deployment.                                                                                                                                                        | `vercel deploy --prod`, then check `/health`, `/ready` (`authDisabled` false) and that an unauthenticated `POST /execute` returns `401`.                                                         |
| Remove `PARMANA_KEY_MATERIAL_JSON_B64` from Vercel      | It is set for Production, Preview and Development, and nothing in the repository reads it (searched all `.ts`, `.js`, `.mjs`, `.json`, `.md` and `.mdx` files outside `node_modules` and `dist`). The server reads `PARMANA_KEY_MATERIAL_JSON`.                          | Confirm your deployment does not depend on it, then `vercel env rm PARMANA_KEY_MATERIAL_JSON_B64 production --yes` and the same for the other two environments.                                  |
| Decide about `npm install -g tsx@4` in the `Dockerfile` | It existed to run a settlement script that was deleted, and `docker/entrypoint.sh` only starts the API, so nothing in the image uses it. Removing it also removes a download from the build. It would remove a tool someone could use from a shell inside the container. | Say whether to remove it.                                                                                                                                                                        |
| Local Docker Desktop has no internet from containers    | Containers cannot reach any address (ping to `1.1.1.1` from an `alpine` container gets 100% loss). A WSL restart, a Docker restart and mirrored networking did not fix it. This only affects running containers on that machine.                                         | Untried: `netsh winsock reset` and `netsh int ip reset` in an admin PowerShell with a reboot, or a Docker Desktop factory reset. GitHub already builds and boots the image, so this is optional. |

## B. Engineering follow up, verified on 2026-09-20

1. **`scripts/verify-policy-changes-approved.ts` needs `SUPABASE_URL` and `SUPABASE_ANON_KEY`.** The server itself only uses `DATABASE_URL`. The production runbook (the check in step 7) tells the operator to set those two variables for that script. This was not run against a real Supabase project, because the scratch database had no PostgREST. Fix: make the script read `DATABASE_URL` like the rest of the system, then drop the extra step from the runbook.
2. **`npm run generate:endpoint-pages` rewrites `docs/site/docs.json` with a different key order.** No field is lost (checked: `colors` and `fonts` are still present), but the diff is large and noisy until the file is restored. Fix: make the generator preserve the existing key order.
3. **The container path is not proven in a production configuration.** CI boots the image with `NODE_ENV=test`, authentication off and no database. No Fly.io deployment has been made since the Dockerfile was fixed. A fuller check would start the image in production mode against a Postgres service container.
4. **The success path of the first real request (runbook step 9) was not exercised end to end.** With no connector configured the request passes policy and approval and stops at release. Proving the full path needs a configured connector, or a local HTTPS mock of the refund service.
5. **`packages/api/src/bootstrap/createConnectorRoute.ts` still throws a plain `Error` (`No connector registered for action`).** Not checked whether any request can reach it. If it can, it would still produce a bare `500`.
6. **Policy approvals in production are not inventoried in the docs.** `scripts/backfill-legacy-policy-approvals.ts` can create approvals under a fixed system identity, which records no human decision. A list of which production policies have human approvals and which (if any) have system approvals does not exist.

## C. Open items in the verification record (not re audited)

Read the entry in `docs/VERIFICATION-GAPS.md` before relying on any of these.

| Gap                                                                                      | Status as written there                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G-52, the runtime released an action before proving it could record it                   | Mitigated on 2026-09-20 by the signing readiness check and the explicit `EXECUTION_RECORD_INCOMPLETE` failure. Not closed.                                               |
| G-53, no way to rebuild a missing Execution Trust Record for an action that was released | Open. The response names the `businessTransactionId` and `authorizationId`, and the outcome must be recorded by hand.                                                    |
| G-4, hybrid signatures                                                                   | Partly resolved. Trust Records and Receipts support hybrid signing. Execution authorization signing, gateway attestation and connector signing are single provider only. |
| G-5, `OverrideService` is unreachable                                                    | Open as written. It is neither a documented future capability nor a tested reachable one. Do not connect it to a route in its current form.                              |
| G-3, live database rows left behind by opted in tests                                    | The silent use was fixed. The cleanup half is open.                                                                                                                      |

## D. Documented as not implemented

Taken from `docs/site/deployment/environment-variables.mdx`. These values pass validation but have no working implementation, and the server refuses to start with the key providers, or fails at first use:

1. `KEY_PROVIDER`: `azure-key-vault`, `gcp-kms`, `hsm`.
2. `PRIMARY_SIGNATURE_PROVIDER` and `SECONDARY_SIGNATURE_PROVIDER`: `ecdsa-p256`, `dilithium5`, `sphincs-plus`.
3. `HASH_PROVIDER`: `sha3-512`, `blake3`.
4. `PARMANA_STORAGE=postgres`. Use `supabase`.
5. `CRYPTO_MODE=pq` behaves the same as `single`.

## E. Tooling limits

1. `mint validate` and `mint score` cannot run on the Windows development machine used so far. `mint openapi-check` works. `mint broken-links` reports 412 false positives for paths under `/sdks/reference`. Run the Mintlify checks in a Linux environment before treating the docs site as validated.
2. Prettier and the SDK docs guard tests run in the pre commit hook and CI, so a docs change that breaks them cannot be committed.
