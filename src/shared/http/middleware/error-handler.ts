import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "@shared/errors";
import { fail } from "@shared/http/response";
import { logger } from "@shared/logger";
import { ENV } from "@shared/env";

const isDev = ENV.NODE_ENV === "development";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const correlationId = req.correlationId;

  if (err instanceof ZodError) {
    res
      .status(400)
      .json(fail("VALIDATION_ERROR", "Invalid request", err.flatten()));
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, correlationId, code: err.code }, err.message);
    } else {
      logger.warn({ correlationId, code: err.code }, err.message);
    }
    const details = isDev
      ? { ...(err.details != null && typeof err.details === "object" ? err.details : { details: err.details }), stack: err.stack }
      : err.details;
    res.status(err.status).json(fail(err.code, err.message, details));
    return;
  }

  logger.error({ err, correlationId }, "unhandled error");
  const stack = isDev && err instanceof Error ? err.stack : undefined;
  res.status(500).json(fail("INTERNAL", "Internal server error", isDev ? { stack } : undefined));
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res
    .status(404)
    .json(fail("NOT_FOUND", `Route ${req.method} ${req.path} not found`));
};
