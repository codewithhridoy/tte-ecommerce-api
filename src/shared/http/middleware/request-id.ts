import type { NextFunction, Request, Response } from "express";
import { newId } from "@shared/id";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const incoming = req.header("x-request-id") ?? req.header("x-correlation-id");
  const id = incoming && incoming.length <= 64 ? incoming : newId();
  req.correlationId = id;
  res.setHeader("x-request-id", id);
  next();
};
