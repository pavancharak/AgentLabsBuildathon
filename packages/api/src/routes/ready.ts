import { Router } from "express";

import { PostgresPoolFactory } from "@parmana/storage";

/**
 * GET /ready
 *
 * Readiness probe, distinct from /health's pure liveness check: this
 * one actually touches Postgres with one cheap query (`SELECT 1`,
 * transferring no table rows, just confirming the connection and
 * credentials work) so a PaaS orchestrator can tell a process that is
 * up but backed by dead storage apart from one that is genuinely
 * ready to serve traffic — and route around it accordingly.
 *
 * When storage is not Supabase-backed (NODE_ENV=test, or
 * PARMANA_STORAGE=memory outside test), there is no external
 * dependency to probe, so this reports ready unconditionally — the
 * same distinction assertStorageConfigured.ts already draws at boot.
 *
 * Queries via a direct Postgres connection (PostgresPoolFactory), not
 * supabase-js/PostgREST — this probe previously depended on
 * PostgREST for a `consumed_nonces` HEAD request, which meant a
 * PostgREST-layer outage (the exact incident class this migration
 * removes) could make the readiness probe itself unreliable.
 */
export interface CreateReadyRouterOptions {
  /**
   * True when this process was started with PARMANA_AUTH_DISABLED=true
   * (see createCallerAuthenticator.ts). Surfaced here, not just as a
   * startup console.warn, because a log line is easy to miss in a
   * log-aggregation tool after the fact -- a field on the readiness
   * probe every PaaS orchestrator already polls every 30s is something
   * an operator's own monitoring/synthetic checks can assert on and
   * alert on directly, catching a "copied .env.example without reading
   * every line" misconfiguration before it becomes an incident rather
   * than after.
   */
  readonly authDisabled: boolean;
}

export function createReadyRouter(options: CreateReadyRouterOptions): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const authWarning = options.authDisabled
      ? {
          authDisabled: true,
          warning:
            "PARMANA_AUTH_DISABLED=true -- this deployment is accepting requests with no " +
            "caller authentication. Must never be set in a real deployment.",
        }
      : { authDisabled: false };

    if (
      process.env.NODE_ENV === "test" ||
      process.env.PARMANA_STORAGE !== "supabase"
    ) {
      res.json({
        status: "READY",
        storage: "not-supabase-backed",
        ...authWarning,
      });
      return;
    }

    try {
      const pool = PostgresPoolFactory.create();
      await pool.query("SELECT 1");

      res.json({ status: "READY", ...authWarning });
    } catch (error) {
      res.status(503).json({
        status: "NOT_READY",
        reason:
          error instanceof Error ? error.message : "unknown storage error",
        ...authWarning,
      });
    }
  });

  return router;
}
