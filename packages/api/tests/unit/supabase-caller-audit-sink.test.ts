import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Pool } from "pg";

import { AuditEventCrypto } from "@parmana/crypto";

import { SupabaseCallerAuditSink } from "../../src/auth/SupabaseCallerAuditSink.js";
import type { CallerAuditEvent } from "../../src/auth/CallerAuditSink.js";

//
// Hermetic key material -- signing is now involved, matching
// runtime.test.ts's own convention.
//
let keyDir: string;
let previousKeyDir: string | undefined;

beforeEach(() => {
  keyDir = mkdtempSync(join(tmpdir(), "parmana-caller-audit-sink-keys-"));

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  writeFileSync(
    join(keyDir, "default.private.pem"),
    privateKey.export({ format: "pem", type: "pkcs8" }),
  );

  writeFileSync(
    join(keyDir, "default.public.pem"),
    publicKey.export({ format: "pem", type: "spki" }),
  );

  previousKeyDir = process.env.PARMANA_KEY_DIR;
  process.env.PARMANA_KEY_DIR = keyDir;
});

afterEach(() => {
  if (previousKeyDir === undefined) {
    delete process.env.PARMANA_KEY_DIR;
  } else {
    process.env.PARMANA_KEY_DIR = previousKeyDir;
  }

  rmSync(keyDir, { recursive: true, force: true });
});

function createFakePool(options?: {
  readonly insertError?: { code?: string; message: string };
  readonly onInsert?: (values: readonly unknown[]) => void;
}): Pool {
  const pool = {
    query(sql: string, values: readonly unknown[]) {
      expect(sql).toContain("INSERT INTO caller_audit_events");

      options?.onInsert?.(values);

      if (options?.insertError) {
        return Promise.reject(options.insertError);
      }

      return Promise.resolve({ rows: [], rowCount: 0 });
    },
  };

  return pool as unknown as Pool;
}

/**
 * Maps the positional $1.. values SupabaseCallerAuditSink passes to
 * pool.query() back to named columns, in the same order as
 * INSERT_CALLER_AUDIT_EVENT_SQL, for readable assertions.
 */
function toRow(values: readonly unknown[]): Record<string, unknown> {
  const [
    type,
    occurred_at,
    route,
    caller_id,
    reason,
    capability,
    principal_id,
    severity,
    business_transaction_id,
    signature_json_raw,
  ] = values;

  return {
    type,
    occurred_at,
    route,
    caller_id,
    reason,
    capability,
    principal_id,
    severity,
    business_transaction_id,
    signature_json: JSON.parse(signature_json_raw as string),
  };
}

const AUTHENTICATED_EVENT: CallerAuditEvent = {
  type: "caller.authenticated",
  occurredAt: "2026-01-01T00:00:00.000Z",
  route: "/execute",
  callerId: "caller-1",
};

const REJECTED_EVENT: CallerAuditEvent = {
  type: "caller.rejected",
  occurredAt: "2026-01-01T00:00:00.000Z",
  route: "/execute",
  reason: "missing credential",
};

const CAPABILITY_DENIED_EVENT: CallerAuditEvent = {
  type: "caller.capability_denied",
  occurredAt: "2026-01-01T00:00:00.000Z",
  route: "/execute",
  callerId: "caller-1",
  capability: "razorpay:refund-create",
  reason: "capability not allowed",
};

const PRINCIPAL_DENIED_EVENT: CallerAuditEvent = {
  type: "caller.principal_denied",
  occurredAt: "2026-01-01T00:00:00.000Z",
  route: "/execute",
  callerId: "caller-1",
  principalId: "someone-else",
  reason: "principal not allowed",
};

const STRUCTURAL_REJECTED_EVENT: CallerAuditEvent = {
  type: "caller.structural_rejected",
  occurredAt: "2026-01-01T00:00:00.000Z",
  route: "/execute",
  callerId: "caller-1",
  businessTransactionId: "11111111-1111-4111-8111-111111111111",
  reason: "Business Transaction '11111111-1111-4111-8111-111111111111' already exists.",
};

const NON_HUMAN_DENIED_EVENT: CallerAuditEvent = {
  type: "caller.non_human_denied",
  occurredAt: "2026-01-01T00:00:00.000Z",
  route: "/policies/pending-changes",
  callerId: "caller-1",
  reason: "credential is not provisioned as a verified human (credentialHolderType !== USER)",
  severity: "flagged",
};

describe("SupabaseCallerAuditSink", () => {
  it("resolves on a successful insert", async () => {
    const sink = new SupabaseCallerAuditSink(createFakePool());

    await expect(sink.record(AUTHENTICATED_EVENT)).resolves.toBeUndefined();
  });

  it("maps CallerAuditEvent fields to query params, nulling absent optional fields", async () => {
    let capturedRow: Record<string, unknown> | undefined;

    const sink = new SupabaseCallerAuditSink(
      createFakePool({
        onInsert: (values) => {
          capturedRow = toRow(values);
        },
      }),
    );

    await sink.record(AUTHENTICATED_EVENT);

    expect(capturedRow).toEqual({
      type: "caller.authenticated",
      occurred_at: "2026-01-01T00:00:00.000Z",
      route: "/execute",
      caller_id: "caller-1",
      reason: null,
      capability: null,
      principal_id: null,
      severity: null,
      business_transaction_id: null,
      signature_json: {
        algorithm: "ed25519",
        keyId: "default",
        value: expect.any(String),
        signedAt: expect.any(String),
      },
    });
  });

  it("maps a rejected event's reason, nulling the absent callerId", async () => {
    let capturedRow: Record<string, unknown> | undefined;

    const sink = new SupabaseCallerAuditSink(
      createFakePool({
        onInsert: (values) => {
          capturedRow = toRow(values);
        },
      }),
    );

    await sink.record(REJECTED_EVENT);

    expect(capturedRow).toEqual({
      type: "caller.rejected",
      occurred_at: "2026-01-01T00:00:00.000Z",
      route: "/execute",
      caller_id: null,
      reason: "missing credential",
      capability: null,
      principal_id: null,
      severity: null,
      business_transaction_id: null,
      signature_json: {
        algorithm: "ed25519",
        keyId: "default",
        value: expect.any(String),
        signedAt: expect.any(String),
      },
    });
  });

  it("maps a capability_denied event's capability and reason", async () => {
    let capturedRow: Record<string, unknown> | undefined;

    const sink = new SupabaseCallerAuditSink(
      createFakePool({
        onInsert: (values) => {
          capturedRow = toRow(values);
        },
      }),
    );

    await sink.record(CAPABILITY_DENIED_EVENT);

    expect(capturedRow).toEqual({
      type: "caller.capability_denied",
      occurred_at: "2026-01-01T00:00:00.000Z",
      route: "/execute",
      caller_id: "caller-1",
      reason: "capability not allowed",
      capability: "razorpay:refund-create",
      principal_id: null,
      severity: null,
      business_transaction_id: null,
      signature_json: {
        algorithm: "ed25519",
        keyId: "default",
        value: expect.any(String),
        signedAt: expect.any(String),
      },
    });
  });

  it("maps a principal_denied event's principalId and reason", async () => {
    let capturedRow: Record<string, unknown> | undefined;

    const sink = new SupabaseCallerAuditSink(
      createFakePool({
        onInsert: (values) => {
          capturedRow = toRow(values);
        },
      }),
    );

    await sink.record(PRINCIPAL_DENIED_EVENT);

    expect(capturedRow).toEqual({
      type: "caller.principal_denied",
      occurred_at: "2026-01-01T00:00:00.000Z",
      route: "/execute",
      caller_id: "caller-1",
      reason: "principal not allowed",
      capability: null,
      principal_id: "someone-else",
      severity: null,
      business_transaction_id: null,
      signature_json: {
        algorithm: "ed25519",
        keyId: "default",
        value: expect.any(String),
        signedAt: expect.any(String),
      },
    });
  });

  it("maps a non_human_denied event's severity, nulling capability and principal_id", async () => {
    let capturedRow: Record<string, unknown> | undefined;

    const sink = new SupabaseCallerAuditSink(
      createFakePool({
        onInsert: (values) => {
          capturedRow = toRow(values);
        },
      }),
    );

    await sink.record(NON_HUMAN_DENIED_EVENT);

    expect(capturedRow).toEqual({
      type: "caller.non_human_denied",
      occurred_at: "2026-01-01T00:00:00.000Z",
      route: "/policies/pending-changes",
      caller_id: "caller-1",
      reason: "credential is not provisioned as a verified human (credentialHolderType !== USER)",
      capability: null,
      principal_id: null,
      severity: "flagged",
      business_transaction_id: null,
      signature_json: {
        algorithm: "ed25519",
        keyId: "default",
        value: expect.any(String),
        signedAt: expect.any(String),
      },
    });
  });

  it("maps a structural_rejected event's businessTransactionId and reason (G-29)", async () => {
    let capturedRow: Record<string, unknown> | undefined;

    const sink = new SupabaseCallerAuditSink(
      createFakePool({
        onInsert: (values) => {
          capturedRow = toRow(values);
        },
      }),
    );

    await sink.record(STRUCTURAL_REJECTED_EVENT);

    expect(capturedRow).toEqual({
      type: "caller.structural_rejected",
      occurred_at: "2026-01-01T00:00:00.000Z",
      route: "/execute",
      caller_id: "caller-1",
      reason: "Business Transaction '11111111-1111-4111-8111-111111111111' already exists.",
      capability: null,
      principal_id: null,
      severity: null,
      business_transaction_id: "11111111-1111-4111-8111-111111111111",
      signature_json: {
        algorithm: "ed25519",
        keyId: "default",
        value: expect.any(String),
        signedAt: expect.any(String),
      },
    });
  });

  it("maps a structural_rejected event with no known caller (malformed body, ahead of caller-auth), nulling caller_id", async () => {
    let capturedRow: Record<string, unknown> | undefined;

    const sink = new SupabaseCallerAuditSink(
      createFakePool({
        onInsert: (values) => {
          capturedRow = toRow(values);
        },
      }),
    );

    await sink.record({
      type: "caller.structural_rejected",
      occurredAt: "2026-01-01T00:00:00.000Z",
      route: "/execute",
      reason: "malformed JSON body",
    });

    expect(capturedRow).toEqual({
      type: "caller.structural_rejected",
      occurred_at: "2026-01-01T00:00:00.000Z",
      route: "/execute",
      caller_id: null,
      reason: "malformed JSON body",
      capability: null,
      principal_id: null,
      severity: null,
      business_transaction_id: null,
      signature_json: {
        algorithm: "ed25519",
        keyId: "default",
        value: expect.any(String),
        signedAt: expect.any(String),
      },
    });
  });

  it("preserves existing failure semantics: a storage error rejects the returned promise, unchanged from InMemoryCallerAuditSink's contract", async () => {
    const sink = new SupabaseCallerAuditSink(
      createFakePool({
        insertError: { code: "08006", message: "connection failure" },
      }),
    );

    await expect(sink.record(AUTHENTICATED_EVENT)).rejects.toMatchObject({
      code: "08006",
    });
  });

  it("signs each event so it verifies against its own canonical bytes, and a tampered event fails verification", async () => {
    let capturedRow: Record<string, unknown> | undefined;

    const sink = new SupabaseCallerAuditSink(
      createFakePool({
        onInsert: (values) => {
          capturedRow = toRow(values);
        },
      }),
    );

    await sink.record(AUTHENTICATED_EVENT);

    const crypto = new AuditEventCrypto();
    const signature = (capturedRow!.signature_json as {
      algorithm: "ed25519";
      keyId: string;
      value: string;
      signedAt: Date;
    });

    // Genuine: verifying against the exact event that was signed.
    await expect(
      crypto.verify(AUTHENTICATED_EVENT, signature),
    ).resolves.toBe(true);

    // Tampered: one field changed after the fact (simulates a
    // database row edited directly, or an operator/attacker with
    // storage access) -- this is the proof signing here is not
    // decorative.
    const tamperedEvent: CallerAuditEvent = {
      ...AUTHENTICATED_EVENT,
      callerId: "attacker-controlled-caller-id",
    };

    await expect(
      crypto.verify(tamperedEvent, signature),
    ).resolves.toBe(false);
  });
});
