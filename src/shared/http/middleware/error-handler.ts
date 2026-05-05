import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError } from '@shared/errors.js'
import { fail } from '@shared/http/response.js'
import { logger } from '@shared/logger.js'

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const correlationId = req.correlationId

  if (err instanceof ZodError) {
    res.status(400).json(fail('VALIDATION_ERROR', 'Invalid request', err.flatten()))
    return
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, correlationId, code: err.code }, err.message)
    } else {
      logger.warn({ correlationId, code: err.code }, err.message)
    }
    const body = fail(err.code, err.message, err.details)
    res.status(err.status).json(body)
    return
  }

  logger.error({ err, correlationId }, 'unhandled error')
  res.status(500).json(fail('INTERNAL', 'Internal server error'))
}

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json(fail('NOT_FOUND', `Route ${req.method} ${req.path} not found`))
}
