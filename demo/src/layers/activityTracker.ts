/**
 * Shared in-memory activity history, used by the fraud and policy layers
 * to compute velocity and amount-deviation signals per agent. Demo-tier
 * storage only (resets on cold start) — a real deployment would back this
 * with a durable store.
 */

interface Attempt {
  timestamp: number;
  amount: number;
}

const history = new Map<string, Attempt[]>();

const VELOCITY_WINDOW_MS = 60_000;
const MAX_HISTORY_PER_AGENT = 50;

export function recordAttempt(agentId: string, amount: number, timestamp = Date.now()): void {
  const attempts = history.get(agentId) ?? [];
  attempts.push({ timestamp, amount });

  if (attempts.length > MAX_HISTORY_PER_AGENT) {
    attempts.shift();
  }

  history.set(agentId, attempts);
}

export function recentAttemptCount(agentId: string, windowMs = VELOCITY_WINDOW_MS, now = Date.now()): number {
  const attempts = history.get(agentId) ?? [];
  return attempts.filter((a) => now - a.timestamp <= windowMs).length;
}

/** Prior amounts only (excludes the current in-flight attempt). */
export function priorAmounts(agentId: string): number[] {
  return (history.get(agentId) ?? []).map((a) => a.amount);
}
