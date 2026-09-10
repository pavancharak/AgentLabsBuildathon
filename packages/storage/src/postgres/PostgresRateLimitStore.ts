import type { Pool } from "pg";

/**
 * Structural subset of express-rate-limit's `Store` interface (v8).
 * Defined locally rather than importing `express-rate-limit` into
 * @parmana/storage (a package that has no other reason to depend on an
 * HTTP middleware library) -- TypeScript's structural typing makes this
 * class assignable wherever express-rate-limit's own `Store` type is
 * expected, with no runtime coupling.
 */
export interface ClientRateLimitInfo {
  readonly totalHits: number;
  readonly resetTime: Date | undefined;
}

export interface RateLimitStoreLike {
  init?(options: { windowMs: number }): void;
  get?(key: string): Promise<ClientRateLimitInfo | undefined>;
  increment(key: string): Promise<ClientRateLimitInfo>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
}

/**
 * Durable, Postgres-backed rate-limit store, shared across every
 * process pointed at the same database. Closes the fleet-wide half of
 * the gap tracked for POST /execute's rate limiter (PARMANA-EXP
 * production-readiness pass, 2026-09-10): express-rate-limit's default
 * MemoryStore is correct for a single process, but each machine in a
 * horizontally-scaled deployment counts independently, so the
 * effective ceiling for a caller becomes `limitPerMinute * machineCount`
 * rather than the configured fleet-wide limit. See
 * packages/api/src/bootstrap/createRateLimitStore.ts for why this is
 * only used when DATABASE_URL is configured -- a single-instance or
 * local deployment (today's actual deployment shape, per fly.toml's
 * `min_machines_running = 1`) keeps working with the in-memory default,
 * no database required.
 *
 * Atomicity: increment() is a single INSERT ... ON CONFLICT DO UPDATE,
 * so two concurrent increments for the same key never race outside the
 * database -- Postgres serializes the row-level update itself, the
 * same guarantee SupabaseNonceStore relies on for its INSERT-only
 * uniqueness check, applied here via an upsert instead because a rate
 * limit counter (unlike a nonce) is legitimately written more than
 * once per key.
 *
 * A window rollover is detected and handled in the same statement: when
 * the stored `reset_time` has already passed, the row is reset to a
 * fresh count of 1 with a new reset_time, rather than requiring a
 * separate read-then-decide round trip.
 */
export class PostgresRateLimitStore implements RateLimitStoreLike {
  private windowMs = 60_000;

  constructor(private readonly pool: Pool) {}

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const { rows } = await this.pool.query(SELECT_SQL, [key]);
    const row = rows[0] as RateLimitRow | undefined;

    if (!row) {
      return undefined;
    }

    return { totalHits: row.count, resetTime: new Date(row.reset_time) };
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const resetTime = new Date(Date.now() + this.windowMs);

    const { rows } = await this.pool.query(INCREMENT_SQL, [
      key,
      resetTime,
      this.windowMs,
    ]);
    const row = rows[0] as RateLimitRow;

    return { totalHits: row.count, resetTime: new Date(row.reset_time) };
  }

  async decrement(key: string): Promise<void> {
    await this.pool.query(DECREMENT_SQL, [key]);
  }

  async resetKey(key: string): Promise<void> {
    await this.pool.query(DELETE_SQL, [key]);
  }
}

interface RateLimitRow {
  readonly count: number;
  readonly reset_time: string | Date;
}

const SELECT_SQL = `
  SELECT count, reset_time FROM rate_limit_counters WHERE key = $1
`;

/**
 * $3 (windowMs, milliseconds) is used inside the SQL itself rather than
 * computed in JS, so the "has the window elapsed" comparison and the
 * "what's the new reset_time" value are both derived from the same
 * database clock (`now()`), avoiding any skew between this process's
 * clock and Postgres's.
 */
const INCREMENT_SQL = `
  INSERT INTO rate_limit_counters (key, count, reset_time)
  VALUES ($1, 1, $2)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN rate_limit_counters.reset_time <= now() THEN 1
      ELSE rate_limit_counters.count + 1
    END,
    reset_time = CASE
      WHEN rate_limit_counters.reset_time <= now() THEN now() + make_interval(secs => $3::float8 / 1000)
      ELSE rate_limit_counters.reset_time
    END
  RETURNING count, reset_time
`;

const DECREMENT_SQL = `
  UPDATE rate_limit_counters SET count = GREATEST(count - 1, 0) WHERE key = $1
`;

const DELETE_SQL = `
  DELETE FROM rate_limit_counters WHERE key = $1
`;
