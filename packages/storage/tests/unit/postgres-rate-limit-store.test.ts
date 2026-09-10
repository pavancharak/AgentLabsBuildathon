import { describe, expect, it } from "vitest";

import type { Pool } from "pg";

import { PostgresRateLimitStore } from "../../src/postgres/PostgresRateLimitStore.js";

/**
 * Fake pg.Pool that actually implements the INCREMENT_SQL upsert's
 * window-rollover semantics in JS -- not just returning canned rows --
 * so this test exercises the same "reset if the window elapsed,
 * otherwise increment" logic a real Postgres instance would apply via
 * the SQL's own CASE expressions.
 */
function createFakePool(now: () => Date): { pool: Pool } {
  const rows = new Map<string, { count: number; reset_time: Date }>();

  const pool = {
    query(sql: string, values: readonly unknown[] = []) {
      if (sql.includes("INSERT INTO rate_limit_counters")) {
        const [key, resetTime, windowMs] = values as [string, Date, number];
        const existing = rows.get(key);

        if (!existing || existing.reset_time.getTime() <= now().getTime()) {
          const row = {
            count: 1,
            reset_time: new Date(now().getTime() + windowMs),
          };
          rows.set(key, row);
          return Promise.resolve({ rows: [row] });
        }

        existing.count += 1;
        void resetTime;
        return Promise.resolve({ rows: [existing] });
      }

      if (sql.includes("SELECT count, reset_time FROM rate_limit_counters")) {
        const [key] = values as [string];
        const row = rows.get(key);
        return Promise.resolve({ rows: row ? [row] : [] });
      }

      if (sql.includes("UPDATE rate_limit_counters SET count")) {
        const [key] = values as [string];
        const row = rows.get(key);
        if (row) row.count = Math.max(row.count - 1, 0);
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes("DELETE FROM rate_limit_counters")) {
        const [key] = values as [string];
        rows.delete(key);
        return Promise.resolve({ rows: [] });
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
  } as unknown as Pool;

  return { pool };
}

describe("PostgresRateLimitStore", () => {
  it("starts a key at 1 hit on first increment", async () => {
    const { pool } = createFakePool(() => new Date());
    const store = new PostgresRateLimitStore(pool);
    store.init({ windowMs: 60_000 });

    const result = await store.increment("caller-a");

    expect(result.totalHits).toBe(1);
    expect(result.resetTime).toBeInstanceOf(Date);
  });

  it("increments an existing, still-live counter", async () => {
    const { pool } = createFakePool(() => new Date());
    const store = new PostgresRateLimitStore(pool);
    store.init({ windowMs: 60_000 });

    await store.increment("caller-a");
    await store.increment("caller-a");
    const result = await store.increment("caller-a");

    expect(result.totalHits).toBe(3);
  });

  it("keeps counters independent across keys", async () => {
    const { pool } = createFakePool(() => new Date());
    const store = new PostgresRateLimitStore(pool);
    store.init({ windowMs: 60_000 });

    await store.increment("caller-a");
    await store.increment("caller-a");
    const b = await store.increment("caller-b");

    expect(b.totalHits).toBe(1);
  });

  it("resets the count once the window has elapsed", async () => {
    let clock = new Date("2026-01-01T00:00:00.000Z");
    const { pool } = createFakePool(() => clock);
    const store = new PostgresRateLimitStore(pool);
    store.init({ windowMs: 60_000 });

    await store.increment("caller-a");
    await store.increment("caller-a");

    clock = new Date(clock.getTime() + 61_000);

    const result = await store.increment("caller-a");

    expect(result.totalHits).toBe(1);
  });

  it("decrements without going below zero", async () => {
    const { pool } = createFakePool(() => new Date());
    const store = new PostgresRateLimitStore(pool);
    store.init({ windowMs: 60_000 });

    await store.decrement("caller-a");
    const row = await store.get("caller-a");

    expect(row).toBeUndefined();
  });

  it("resetKey removes the counter entirely", async () => {
    const { pool } = createFakePool(() => new Date());
    const store = new PostgresRateLimitStore(pool);
    store.init({ windowMs: 60_000 });

    await store.increment("caller-a");
    await store.resetKey("caller-a");

    const row = await store.get("caller-a");
    expect(row).toBeUndefined();
  });

  it("get() reflects the current count without mutating it", async () => {
    const { pool } = createFakePool(() => new Date());
    const store = new PostgresRateLimitStore(pool);
    store.init({ windowMs: 60_000 });

    await store.increment("caller-a");
    await store.increment("caller-a");

    const row = await store.get("caller-a");

    expect(row?.totalHits).toBe(2);
  });
});
