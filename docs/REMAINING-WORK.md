# Remaining work

Snapshot: 2026-09-20. This is the current list of what is left. It replaces `02-REMAINING.md` (a July 5 snapshot) for current status.

Every item says how it was verified. Items marked **not re audited** are copied from `docs/VERIFICATION-GAPS.md` as written there, and were not checked again on this date. The full record of what was found and closed stays in `docs/VERIFICATION-GAPS.md` and `docs/CLAIMS.md`.

## What was finished on 2026-09-20

Both SDKs are published as 1.1.6. The docs site is restructured with an environment variable reference, an integration specification for AI agents, a production runbook and a deployment specification for AI agents. Production fails closed on policy binding, signing works under AWS KMS beyond 4096 bytes, and an approved action with no configured connector now returns `503 CONNECTOR_NOT_REGISTERED`. The Docker image builds and boots in CI on every change that can break it.

## A. Needs the operator

| Item                                                 | Why                                                                                                                                                                                                                                                                 | How to finish                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redeploy production                                  | Code merged after the last deploy (for example `CONNECTOR_NOT_REGISTERED`, and everything below) is not live until the next deployment.                                                                                                                             | `vercel deploy --prod`, then check `/health`, `/ready` (`authDisabled` false) and that an unauthenticated `POST /execute` returns `401`.                        |
| Remove `PARMANA_KEY_MATERIAL_JSON_B64` from Vercel   | It is set for Production, Preview and Development, and nothing in the repository reads it (searched all `.ts`, `.js`, `.mjs`, `.json`, `.md` and `.mdx` files outside `node_modules` and `dist`). The server reads `PARMANA_KEY_MATERIAL_JSON`.                     | Confirm your deployment does not depend on it, then `vercel env rm PARMANA_KEY_MATERIAL_JSON_B64 production --yes` and the same for the other two environments. |
| Local Docker Desktop has no internet from containers | Containers cannot reach any address (ping to `1.1.1.1` from an `alpine` container gets 100% loss). A WSL restart, a Docker restart and mirrored networking did not fix it. This only affects running containers on that machine, and CI builds and boots the image. | Untried: `netsh winsock reset` and `netsh int ip reset` in an admin PowerShell with a reboot, or a Docker Desktop factory reset. Optional.                      |

## B. Engineering follow up

Done on 2026-09-20 after the first version of this page:

1. **`npm run generate:endpoint-pages` no longer reorders `docs/site/docs.json`.** It serialized without indentation and let Prettier re wrap it. It now indents first, and a run produces no diff. No field was ever lost.
2. **The unused `npm install -g tsx@4` step is removed from the `Dockerfile`**, with the stale Razorpay comments. Nothing in the image used it. Scripts in the runbook run from a clone, not from inside the container.
3. **The CI job that builds the image now also boots it in production mode** against a real Postgres with every migration applied. It requires `/ready` to say READY with `authDisabled` false, an unauthenticated `POST /execute` to return `401`, and a request with a valid key and an empty body to return `400` (it passed authentication and reached validation). It runs when the Dockerfile, the migrations or the bundle change.
4. **`createConnectorRoute.ts` is not reachable on the live path.** It only supplies the route for the deprecated `executionControl.channel` dispatch, and the API supplies no channel, so the gateway stops with "Execution Gateway executionControl is incomplete" before calling it.
5. **`scripts/verify-policy-changes-approved.ts` needing `SUPABASE_URL` and `SUPABASE_ANON_KEY` is deliberate.** It uses the low privilege `anon` role with a read only policy (migration `20260818150000`) so a CI credential cannot write. The production runbook now says so. It works only on a Supabase project (it needs the REST layer). A plain Postgres deployment can check approvals with SQL against `policy_change_approval_records`.
6. **Production policy approvals were inventoried on 2026-09-20.** The production `policy_change_approval_records` table has approval records for all 14 policies in the `policies/` directory (25 rows in total, because some policies were approved more than once). Every record was proposed by `charak1987` and approved by `policy-reviewer-1`, and none was created by a `system:` identity, so no policy relies on the system backfill. The query shows names and approvers only. It does not show whether the latest approval hash still equals the live policy content. The server's startup integrity check does that, and logs `policy_governance_integrity_check_passed`.
7. **The full success path of a real request was exercised end to end on 2026-09-20, locally.** A fresh clone of `main` ran in `NODE_ENV=production` against a real Postgres with every migration applied, with the refund connector configured over HTTPS (the repository's `MockPaytmConnectorServer` behind a self signed TLS proxy, with `NODE_EXTRA_CA_CERTS`). With `customer-refund` approved by a human maker and checker, an authenticated `execute` through `@parmana/sdk@1.1.6` returned a signed Execution Trust Record. The mock service was called exactly once. The same `businessTransactionId` again returned `409`, the record read back with `GET /trust-records/{id}`, and `scripts/verify-trust-record.ts` verified its signature with only the public key (`legacySignatureValid` true, no errors). That run used local signing keys and a mock refund service. The KMS run below repeats it with KMS signing. It does not cover the real `parmana-paytm-agent`.
8. **AWS KMS signing was verified on 2026-09-20 against the production key `alias/default` (`ap-south-1`, `ECC_NIST_EDWARDS25519`, enabled).** Through the repository's own `KmsSigner`, messages of 300 and 4096 bytes were signed as they are, and messages of 5000 and 60000 bytes were signed as the 97 byte commitment. All four signatures verified locally against the key's public key, a signature over different data did not verify, and sending 5000 raw bytes straight to KMS was rejected with `ValidationException`, which confirms the 4096 byte limit. Then the same end to end run as item 7 was repeated with `KEY_PROVIDER=aws-kms`, and the server signed a full Execution Trust Record of about 5.6 KB (over the limit that failed in production). The record verified offline with `scripts/verify-trust-record.ts` against the KMS public key only, and failed against the local key, as it should. The server log had no signing errors. This used the local AWS credential chain with the `parmana` profile, not the Vercel OIDC role that production uses (`AWS_ROLE_ARN`), so the OIDC role itself is not covered by this check.

Still open:

1. **The container image is not deployed anywhere.** Production runs on Vercel, and Fly.io is not used. CI proves the image builds and boots in production mode. `fly.toml` and the Fly section of the runbook are kept for anyone who wants a container host, and have not been exercised since the Dockerfile was fixed.

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
