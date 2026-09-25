// Prints a complete POST /execute request body for a `paytm:refund` under
// the shipped `customer-refund` policy, with fresh UUIDs, for trying the self
// hosted deployment. Runs inside the API image, so the host needs only
// Docker:
//
//   docker compose run --rm --no-deps --entrypoint node setup \
//     /app/docker/local/examples/refund-request.mjs \
//     --amount 50000 --manager-approved false > refund.json
//
// Options:
//   --amount <number>                 refund amount (required)
//   --manager-approved true|false     the managerApproved signal (required)
//   --principal-id <id>               who the request acts for (default
//                                     local-operator). An API key may only
//                                     act for its own caller ID unless it
//                                     lists other principal IDs.
//
// With the shipped policy, a refund is authorized when the refund is
// eligible, a manager approved it, the fraud check passed and the amount is
// within the policy's threshold. Every other combination is refused.

import { randomUUID } from "node:crypto";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message) {
  console.error(`[refund-request] ${message}`);
  process.exit(1);
}

const amount = Number(option("--amount"));
if (!Number.isFinite(amount) || amount <= 0) {
  fail("--amount must be a positive number.");
}

const managerApprovedOption = option("--manager-approved");
if (managerApprovedOption !== "true" && managerApprovedOption !== "false") {
  fail("--manager-approved must be true or false.");
}

const principalId = option("--principal-id") ?? "local-operator";

const businessTransactionId = randomUUID();
const authorityId = randomUUID();
const authorizationId = randomUUID();
const orderId = `order-${businessTransactionId.slice(0, 8)}`;
const now = new Date().toISOString();

const request = {
  businessTransactionId,
  metadata: {
    businessTransactionId,
    correlationId: randomUUID(),
    createdBy: principalId,
    createdAt: now,
  },
  authority: {
    authorityId,
    authorityType: "USER",
    principalId,
    displayName: principalId,
    issuedAt: now,
  },
  authorization: {
    authorizationId,
    authorityId,
    purpose: "Customer refund",
    authorizedAt: now,
  },
  intent: {
    intentId: randomUUID(),
    authorizationId,
    action: "paytm:refund",
    target: `paytm://orders/${orderId}`,
    parameters: { orderId, transactionId: `txn-${orderId}`, amount },
    createdAt: now,
  },
  policy: { name: "customer-refund", version: "1.0.0", schemaVersion: "1.0.0" },
  signals: {
    refundEligible: true,
    managerApproved: managerApprovedOption === "true",
    fraudCheckPassed: true,
    refundAmount: amount,
  },
};

console.log(JSON.stringify(request, null, 2));
