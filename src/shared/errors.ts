export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'BAD_GATEWAY'

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: unknown
  readonly cause?: unknown

  constructor(code: ErrorCode, message: string, status: number, opts?: { details?: unknown; cause?: unknown }) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    if (opts?.details !== undefined) this.details = opts.details
    if (opts?.cause !== undefined) this.cause = opts.cause
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details !== undefined ? { details } : undefined)
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, 409, details !== undefined ? { details } : undefined)
  }
}

export class PreconditionFailedError extends AppError {
  constructor(message: string) {
    super('PRECONDITION_FAILED', message, 412)
  }
}
