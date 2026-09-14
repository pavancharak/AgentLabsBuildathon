/**
 * Fail-closed startup config, matching this codebase's existing
 * discipline (e.g. Config.ts's requirePolicyDirectory()): refuses to
 * start rather than let an unset value surface later as a confusing
 * runtime error.
 */

export interface GovernanceUiConfig {
  readonly apiBaseUrl: string;
  readonly sessionSecret: string;
  readonly port: number;
  readonly isProduction: boolean;
}

function required(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(
      `${name} is not set. Refusing to start without it -- see this ` +
        "package's README for required environment variables.",
    );
  }

  return value;
}

export function loadGovernanceUiConfig(): GovernanceUiConfig {
  const apiBaseUrl = required("PARMANA_API_BASE_URL").replace(/\/+$/, "");
  const sessionSecret = required("SESSION_SECRET");

  const port = Number(process.env.PORT ?? "4100");

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `PORT must be a positive integer, got '${process.env.PORT}'.`,
    );
  }

  return {
    apiBaseUrl,
    sessionSecret,
    port,
    isProduction: process.env.NODE_ENV === "production",
  };
}
