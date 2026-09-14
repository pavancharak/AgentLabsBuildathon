import type { ExecutionSystem } from "@parmana/execution-system";

import { createExecutionGateway } from "./createExecutionGateway.js";

/**
 * Creates the execution system used by the API.
 *
 * This is the single architectural entry point for
 * execution-system composition.
 */
export function createExecutionSystem(): ExecutionSystem {
  return createExecutionGateway();
}
