/**
 * Layer 2 — Fraud Detection (demo-tier, purpose-built for this demo).
 *
 * No fraud-detection module exists anywhere in this repository, so unlike
 * the Policy and Proof layers this one is not vendored from production
 * code — it is a small, real (not hardcoded-pass) heuristic scorer written
 * for the buildathon: it actually varies its output with amount-vs-limit
 * ratio, request velocity, and deviation from the agent's own history.
 */
import { priorAmounts, recentAttemptCount } from './activityTracker';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface FraudLayerResult {
  score: number;
  riskLevel: RiskLevel;
  signals: {
    amountToLimitRatio: number;
    recentAttempts: number;
    amountDeviationFactor: number;
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function scoreTransaction(input: {
  agentId: string;
  amount: number;
  limit: number;
}): FraudLayerResult {
  const { agentId, amount, limit } = input;

  const amountToLimitRatio = limit > 0 ? amount / limit : amount > 0 ? Infinity : 0;
  const recentAttempts = recentAttemptCount(agentId);

  const history = priorAmounts(agentId);
  const baseline = average(history);
  const amountDeviationFactor = baseline > 0 ? amount / baseline : 1;

  // Over-limit spend is the strongest signal; velocity and sudden deviation
  // from the agent's own historical spend pattern add to it.
  const overLimitComponent = Math.min(Math.max(amountToLimitRatio - 1, 0), 1);
  const velocityComponent = Math.min(recentAttempts / 10, 1);
  const deviationComponent = Math.min(Math.max(amountDeviationFactor - 1, 0) / 5, 1);

  const score = Math.min(
    0.6 * overLimitComponent + 0.25 * velocityComponent + 0.15 * deviationComponent,
    1,
  );

  const riskLevel: RiskLevel = score >= 0.7 ? 'high' : score >= 0.3 ? 'medium' : 'low';

  return {
    score: Number(score.toFixed(3)),
    riskLevel,
    signals: {
      amountToLimitRatio: Number.isFinite(amountToLimitRatio)
        ? Number(amountToLimitRatio.toFixed(3))
        : amountToLimitRatio,
      recentAttempts,
      amountDeviationFactor: Number(amountDeviationFactor.toFixed(3)),
    },
  };
}
