/**
 * src/utils/errors.ts
 *
 * Custom error class hierarchy.
 * All errors extend AppError so the global error handler can catch them
 * and map to the correct HTTP status code without switch-casing on strings.
 */

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string = 'ERROR'
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 — Request body/params failed validation */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/** 401 — Missing, expired, or revoked auth token */
export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** 403 — Valid token but insufficient permission */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 404 — Resource does not exist */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/** 409 — Unique constraint violation (e.g., email already registered) */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

/** 422 — Valid format but failed business logic */
export class UnprocessableError extends AppError {
  constructor(message: string) {
    super(message, 422, 'UNPROCESSABLE');
  }
}

/** 429 — Rate limit exceeded */
export class RateLimitError extends AppError {
  constructor() {
    super('Too many requests — please slow down', 429, 'RATE_LIMITED');
  }
}
