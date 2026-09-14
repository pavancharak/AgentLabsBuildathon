import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GITHUB_PR_FETCH_CAPABILITY,
  GITHUB_PR_MERGE_CAPABILITY,
  GITHUB_TEST_MODE_PLACEHOLDER_TOKEN,
  MockGitHubServer,
  redactGitHubToken,
} from "@parmana/connector-github";
import {
  brandCredentialHandle,
  connectorCapabilities,
  type ConnectorExecutionContext,
} from "@parmana/connector-sdk";

import { GatewayGitHubAdapter } from "../../src/connector-execution/index.js";

const TOKEN = "test-mock-installation-token-a1b2c3d4e5f6";

let server: MockGitHubServer;

beforeEach(async () => {
  server = new MockGitHubServer({ installationToken: TOKEN });
  await server.listen();
});

afterEach(async () => {
  await server.close();
});

function context(
  overrides: Partial<ConnectorExecutionContext> = {},
): ConnectorExecutionContext {
  return {
    credential: brandCredentialHandle({
      providerId: "github-app",
      credentialId: "installation:154863462",
      value: { installationToken: TOKEN },
    }),
    timeoutMs: 2_000,
    requestedAt: new Date(),
    ...overrides,
  };
}

function connector(): GatewayGitHubAdapter {
  return new GatewayGitHubAdapter({
    connectorId: "github",
    capabilities: connectorCapabilities([
      GITHUB_PR_FETCH_CAPABILITY,
      GITHUB_PR_MERGE_CAPABILITY,
    ]),
    baseUrl: server.baseUrl,
  });
}

function seedPr(
  overrides: Partial<{
    mergeable: boolean | null;
    headSha: string;
    baseRef: string;
  }> = {},
) {
  server.setPullRequest("acme", "widgets", {
    number: 42,
    mergeable: true,
    mergedAt: null,
    headSha: "abc123",
    baseRef: "main",
    ...overrides,
  });
}

describe("GatewayGitHubAdapter", () => {
  it("fetches a pull request's state", async () => {
    seedPr();

    const result = await connector().execute(
      {
        capability: GITHUB_PR_FETCH_CAPABILITY,
        businessTransactionId: "txn-1",
        action: GITHUB_PR_FETCH_CAPABILITY,
        target: "acme/widgets#42",
        parameters: {},
      },
      context(),
    );

    expect(result.success).toBe(true);
    const pr = result.metadata?.pullRequest as {
      number: number;
      mergeable: boolean | null;
      headSha: string;
    };
    expect(pr.number).toBe(42);
    expect(pr.mergeable).toBe(true);
    expect(pr.headSha).toBe("abc123");
  });

  it("merges a pull request", async () => {
    seedPr();

    const result = await connector().execute(
      {
        capability: GITHUB_PR_MERGE_CAPABILITY,
        businessTransactionId: "txn-merge-1",
        action: GITHUB_PR_MERGE_CAPABILITY,
        target: "acme/widgets#42",
        parameters: { mergeMethod: "squash" },
      },
      context(),
    );

    expect(result.success).toBe(true);
    expect(
      server.getPullRequest("acme", "widgets", 42)?.mergedAt,
    ).not.toBeNull();
    expect(server.mergeCalls).toBe(1);
  });

  it("refuses a merge whose expectedHeadSha no longer matches the PR's real head, before trusting a stale decision", async () => {
    seedPr({ headSha: "abc123" });

    await expect(
      connector().execute(
        {
          capability: GITHUB_PR_MERGE_CAPABILITY,
          businessTransactionId: "txn-stale-head",
          action: GITHUB_PR_MERGE_CAPABILITY,
          target: "acme/widgets#42",
          parameters: {
            mergeMethod: "squash",
            expectedHeadSha: "stale-sha-999",
          },
        },
        context(),
      ),
    ).rejects.toThrow("HTTP 422");

    expect(server.mergeCalls).toBe(0);
  });

  it("deny-by-default: refuses an unsupported merge method before any network call", async () => {
    seedPr();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    let caught: unknown;
    try {
      await connector().execute(
        {
          capability: GITHUB_PR_MERGE_CAPABILITY,
          businessTransactionId: "txn-bad-method",
          action: GITHUB_PR_MERGE_CAPABILITY,
          target: "acme/widgets#42",
          parameters: { mergeMethod: "force-push-and-pray" },
        },
        context(),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("force-push-and-pray");
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("fails closed on a non-2xx response", async () => {
    await expect(
      connector().execute(
        {
          capability: GITHUB_PR_FETCH_CAPABILITY,
          businessTransactionId: "txn-missing",
          action: GITHUB_PR_FETCH_CAPABILITY,
          target: "acme/widgets#9999",
          parameters: {},
        },
        context(),
      ),
    ).rejects.toThrow("HTTP 404");
  });

  it("fails closed on a timeout, never returning a partial success", async () => {
    seedPr();
    // MockGitHubServer has no configurable delay hook (unlike MockHubSpotServer);
    // exercise timeout by pointing at an address that never responds instead.
    const unroutable = new GatewayGitHubAdapter({
      connectorId: "github",
      capabilities: connectorCapabilities([GITHUB_PR_FETCH_CAPABILITY]),
      baseUrl: "http://10.255.255.1",
    });

    await expect(
      unroutable.execute(
        {
          capability: GITHUB_PR_FETCH_CAPABILITY,
          businessTransactionId: "txn-timeout",
          action: GITHUB_PR_FETCH_CAPABILITY,
          target: "acme/widgets#42",
          parameters: {},
        },
        context({ timeoutMs: 50 }),
      ),
    ).rejects.toThrow(/timed out after 50ms/);
  }, 10_000);

  it("rejects a credential that is not a resolved GitHub installation token", async () => {
    seedPr();

    await expect(
      connector().execute(
        {
          capability: GITHUB_PR_FETCH_CAPABILITY,
          businessTransactionId: "txn-bad-cred",
          action: GITHUB_PR_FETCH_CAPABILITY,
          target: "acme/widgets#42",
          parameters: {},
        },
        context({
          credential: brandCredentialHandle({
            providerId: "github-app",
            credentialId: "installation:154863462",
            value: { token: "wrong-shape" },
          }),
        }),
      ),
    ).rejects.toThrow(/resolved GitHub App installation token/);
  });

  it("never leaks the token into a thrown error, even on an authentication failure against the mock server", async () => {
    seedPr();

    let caught: unknown;
    try {
      await connector().execute(
        {
          capability: GITHUB_PR_FETCH_CAPABILITY,
          businessTransactionId: "txn-wrong-token",
          action: GITHUB_PR_FETCH_CAPABILITY,
          target: "acme/widgets#42",
          parameters: {},
        },
        context({
          credential: brandCredentialHandle({
            providerId: "github-app",
            credentialId: "installation:154863462",
            value: { installationToken: "wrong-token-value" },
          }),
        }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("HTTP 401");
    expect((caught as Error).message).not.toContain(TOKEN);
    expect((caught as Error).message).not.toContain("wrong-token-value");
  });

  it("never places the token or any substring of it in connector response metadata, only a one-way fingerprint", async () => {
    seedPr();

    const result = await connector().execute(
      {
        capability: GITHUB_PR_FETCH_CAPABILITY,
        businessTransactionId: "txn-redaction",
        action: GITHUB_PR_FETCH_CAPABILITY,
        target: "acme/widgets#42",
        parameters: {},
      },
      context(),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain(TOKEN.slice(0, 12));
    expect(result.metadata?.tokenRedacted).toBe(redactGitHubToken(TOKEN));
    expect(result.metadata?.tokenRedacted).toMatch(/^fp_[0-9a-f]{12}$/);
  });

  it("refuses to send the built-in test-mode placeholder credential to GitHub's real API, before any network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const realBaseUrlConnector = new GatewayGitHubAdapter({
      connectorId: "github",
      capabilities: connectorCapabilities([GITHUB_PR_FETCH_CAPABILITY]),
    });

    let caught: unknown;
    try {
      await realBaseUrlConnector.execute(
        {
          capability: GITHUB_PR_FETCH_CAPABILITY,
          businessTransactionId: "txn-placeholder-guard",
          action: GITHUB_PR_FETCH_CAPABILITY,
          target: "acme/widgets#42",
          parameters: {},
        },
        context({
          credential: brandCredentialHandle({
            providerId: "github-app",
            credentialId: "installation:154863462",
            value: { installationToken: GITHUB_TEST_MODE_PLACEHOLDER_TOKEN },
          }),
        }),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("refuses to send");
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("holds no credential-shaped instance field at construction -- the token exists only as an execute()-scoped local", () => {
    const instance = connector();
    for (const value of Object.values(instance)) {
      expect(String(value)).not.toContain(TOKEN);
    }
  });

  it("never reuses a prior call's credential across two sequential execute() calls with two different tokens", async () => {
    const tokenA = "test-call-a-token-0000000000000000000000";
    const tokenB = "test-call-b-token-1111111111111111111111";

    const scopedServer = new MockGitHubServer({ installationToken: tokenB });
    await scopedServer.listen();

    try {
      scopedServer.setPullRequest("acme", "widgets", {
        number: 7,
        mergeable: true,
        mergedAt: null,
        headSha: "def456",
        baseRef: "main",
      });

      const instance = new GatewayGitHubAdapter({
        connectorId: "github",
        capabilities: connectorCapabilities([GITHUB_PR_FETCH_CAPABILITY]),
        baseUrl: scopedServer.baseUrl,
      });

      const request = {
        capability: GITHUB_PR_FETCH_CAPABILITY,
        businessTransactionId: "txn-lifecycle-1",
        action: GITHUB_PR_FETCH_CAPABILITY,
        target: "acme/widgets#7",
        parameters: {},
      };

      await expect(
        instance.execute(
          request,
          context({
            credential: brandCredentialHandle({
              providerId: "github-app",
              credentialId: "installation:154863462",
              value: { installationToken: tokenA },
            }),
          }),
        ),
      ).rejects.toThrow("HTTP 401");

      const result = await instance.execute(
        request,
        context({
          credential: brandCredentialHandle({
            providerId: "github-app",
            credentialId: "installation:154863462",
            value: { installationToken: tokenB },
          }),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.tokenRedacted).toBe(redactGitHubToken(tokenB));
    } finally {
      await scopedServer.close();
    }
  });
});
