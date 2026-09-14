import { MemoryExecutionTrustRecordRepository } from "@parmana/storage";

import { FilePolicyRepository } from "@parmana/policy";

import { RuntimeBuilder } from "@parmana/runtime";

import transaction from "./transaction.json" with { type: "json" };

async function main(): Promise<void> {
  console.log();
  console.log("==================================================");
  console.log("Tutorial 22 - Idempotent Execution");
  console.log("==================================================");
  console.log();

  //
  // Repository
  //

  const repository = new MemoryExecutionTrustRecordRepository();

  //
  // Runtime
  //

  const runtime = new RuntimeBuilder()
    .withPolicyRepository(new FilePolicyRepository("policies"))
    .build(repository);

  let originalExecutions = 0;
  let retries = 0;

  //
  // First execution
  //

  console.log("First execution...");

  try {
    const { context } = await runtime.execute(transaction);

    console.log(`✓ ${context.decision.outcome}`);

    originalExecutions++;
  } catch (error) {
    console.log(`✗ ${(error as Error).message}`);
  }

  console.log();

  //
  // Retry #1
  //

  console.log("Retry #1...");

  try {
    await runtime.execute(transaction);

    console.log("✓ Transaction executed again.");
  } catch (error) {
    console.log(`✓ Retry handled: ${(error as Error).message}`);
  }

  retries++;

  console.log();

  //
  // Retry #2
  //

  console.log("Retry #2...");

  try {
    await runtime.execute(transaction);

    console.log("✓ Transaction executed again.");
  } catch (error) {
    console.log(`✓ Retry handled: ${(error as Error).message}`);
  }

  retries++;

  console.log();

  console.log("==================================================");
  console.log("Summary");
  console.log("==================================================");
  console.log();

  console.log(`Original Executions : ${originalExecutions}`);

  console.log(`Retries             : ${retries}`);

  console.log();

  console.log("Tutorial completed successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
