/** Machine-readable error codes returned to clients. */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  AI_PROVIDER_ERROR: "AI_PROVIDER_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Application-level error carrying an HTTP status and a stable code. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCodeValue;
  readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCodeValue = ErrorCode.INTERNAL_ERROR,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 400, ErrorCode.VALIDATION_ERROR, details);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError(message, 401, ErrorCode.UNAUTHORIZED);
  }
  static forbidden(message = "You do not have permission to perform this action") {
    return new AppError(message, 403, ErrorCode.FORBIDDEN);
  }
  static notFound(message = "Resource not found") {
    return new AppError(message, 404, ErrorCode.NOT_FOUND);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError(message, 409, ErrorCode.CONFLICT, details);
  }
  static business(message: string, details?: unknown) {
    return new AppError(message, 422, ErrorCode.BUSINESS_RULE_VIOLATION, details);
  }
  static internal(message = "Something went wrong") {
    return new AppError(message, 500, ErrorCode.INTERNAL_ERROR);
  }
}
