import { createHash } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

import type { PaytmRefundExecutionStatus } from "./PaytmTypes.js";

export interface MockPaytmConnectorServerOptions {
  readonly sharedSecret: string;
}

interface ReceivedRequest {
  readonly businessTransactionId: unknown;
  readonly capability: unknown;
  readonly action: unknown;
  readonly target: unknown;
  readonly parameters: Record<string, unknown>;
}

/**
 * Local, in-memory stand-in for the trusted, out-of-process Paytm
 * connector service (parmana-paytm-agent)'s POST /connector/paytm-refund
 * endpoint. Hermetic and deterministic -- never makes or receives real
 * network traffic beyond localhost, and never talks to Paytm's real
 * /refund/apply endpoint. GatewayPaytmAdapter.test.ts and the
 * paytm-refund integration suite point PAYTM_CONNECTOR_URL at this
 * server instead of a real deployment.
 *
 * Deliberately models only the contract Parmana's side of the
 * integration depends on: shared-secret authentication, echoing the
 * identifying request fields back in the response (so
 * GatewayPaytmAdapter's response-validation guard has something real to
 * check), and deterministic refId derivation from (orderId,
 * transactionId) -- proving that a retried request for the same logical
 * refund gets back the same refId rather than a newly minted one. This
 * mock does not implement Paytm's own checksum scheme or wire format;
 * that lives entirely inside parmana-paytm-agent, a separate repository
 * this codebase does not have access to.
 */
export class MockPaytmConnectorServer {
  private server: Server | undefined;
  private baseUrlValue = "";
  private responseDelayMs = 0;
  private forcedStatus: PaytmRefundExecutionStatus | undefined;
  private forcedHttpStatus: number | undefined;
  private malformed = false;
  private responseFieldOverride: Readonly<Record<string, unknown>> = {};
  private readonly refIdsByLogicalRefund = new Map<string, string>();
  private readonly receivedRequests: ReceivedRequest[] = [];
  private paytmInvocations = 0;

  constructor(private readonly options: MockPaytmConnectorServerOptions) {}

  get baseUrl(): string {
    return this.baseUrlValue;
  }

  /** Number of times this mock would have forwarded a refund on to Paytm's real API. */
  get paytmInvocationCount(): number {
    return this.paytmInvocations;
  }

  get calls(): readonly ReceivedRequest[] {
    return this.receivedRequests;
  }

  /** Test-only hook: delays every response, used to exercise the connector's own timeout handling. */
  setResponseDelayMs(delayMs: number): void {
    this.responseDelayMs = delayMs;
  }

  /** Forces the next (and subsequent) responses to report this Paytm execution status. */
  setForcedStatus(status: PaytmRefundExecutionStatus | undefined): void {
    this.forcedStatus = status;
  }

  /** Forces a non-2xx HTTP response, simulating a connector-service-side failure. */
  setForcedHttpStatus(status: number | undefined): void {
    this.forcedHttpStatus = status;
  }

  /** Returns a response body that fails PaytmRefundExecutionResult's shape entirely. */
  setMalformedResponse(malformed: boolean): void {
    this.malformed = malformed;
  }

  /**
   * Overrides one or more identifying fields in the next response
   * (orderId, transactionId, businessTransactionId, capability) so a
   * test can simulate a connector-service response that does not
   * correspond to the request it was sent for.
   */
  setResponseFieldOverride(override: Readonly<Record<string, unknown>>): void {
    this.responseFieldOverride = override;
  }

  async listen(): Promise<void> {
    this.server = createServer((req, res) => {
      this.handle(req, res).catch((error: unknown) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: error instanceof Error ? error.message : "unknown error",
          }),
        );
      });
    });
    await new Promise<void>((resolve) =>
      this.server!.listen(0, "127.0.0.1", resolve),
    );
    const address = this.server!.address() as AddressInfo;
    this.baseUrlValue = `http://127.0.0.1:${address.port}`;
  }

  async close(): Promise<void> {
    if (this.server === undefined) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
  }

  private async handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (!this.authenticates(req)) {
      this.respond(res, 401, {
        message: "invalid or missing connector shared secret",
      });
      return;
    }

    const url = req.url ?? "";
    const method = req.method ?? "POST";
    const path = url.split("?")[0] ?? url;

    if (method !== "POST" || path !== "/connector/paytm-refund") {
      this.respond(res, 404, { message: "not found" });
      return;
    }

    const body = await this.readJsonBody(req);
    this.receivedRequests.push(body as unknown as ReceivedRequest);

    if (this.forcedHttpStatus !== undefined) {
      this.respond(res, this.forcedHttpStatus, { message: "forced failure" });
      return;
    }

    if (this.malformed) {
      this.respond(res, 200, { unexpected: "shape" });
      return;
    }

    const parameters =
      (body.parameters as Record<string, unknown> | undefined) ?? {};
    const orderId = String(parameters.orderId ?? "");
    const transactionId = String(parameters.transactionId ?? "");
    const status: PaytmRefundExecutionStatus = this.forcedStatus ?? "completed";

    const refId = this.refIdFor(orderId, transactionId);

    if (status === "completed") {
      this.paytmInvocations += 1;
    }

    this.respond(res, 200, {
      success: status === "completed",
      status,
      refId,
      businessTransactionId: body.businessTransactionId,
      capability: body.capability,
      orderId,
      transactionId,
      ...this.responseFieldOverride,
    });
  }

  /**
   * Deterministic refId derivation, keyed on the logical refund
   * (orderId, transactionId) -- not on businessTransactionId, which
   * changes across distinct Parmana authorization attempts for the
   * same logical refund. A second call for the same (orderId,
   * transactionId) always returns the same refId, simulating the
   * idempotency contract the real connector service must implement.
   */
  private refIdFor(orderId: string, transactionId: string): string {
    const key = `${orderId}:${transactionId}`;
    const existing = this.refIdsByLogicalRefund.get(key);
    if (existing !== undefined) return existing;
    const refId = `refid_${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
    this.refIdsByLogicalRefund.set(key, refId);
    return refId;
  }

  private authenticates(req: IncomingMessage): boolean {
    const header = req.headers.authorization;
    if (header === undefined || !header.startsWith("Bearer ")) return false;
    return header.slice("Bearer ".length) === this.options.sharedSecret;
  }

  private async readJsonBody(
    req: IncomingMessage,
  ): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of req as AsyncIterable<Buffer>) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    if (raw.length === 0) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  }

  private respond(res: ServerResponse, status: number, body: unknown): void {
    setTimeout(() => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    }, this.responseDelayMs);
  }
}
