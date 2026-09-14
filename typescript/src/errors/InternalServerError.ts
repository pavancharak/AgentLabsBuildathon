import { ErrorCode, ParmanaError } from "./ParmanaError.js";

/**
 * Raised when the Runtime encounters an internal error.
 */
export class InternalServerError extends ParmanaError {
  constructor(
    message: string,
    options?: {
      requestId?: string;
      cause?: unknown;
    },
  ) {
    super({
      code: ErrorCode.INTERNAL_SERVER_ERROR,

      message,

      ...(options?.requestId !== undefined && {
        requestId: options.requestId,
      }),

      ...(options?.cause !== undefined && {
        cause: options.cause,
      }),
    });

    this.name = "InternalServerError";
  }
}
