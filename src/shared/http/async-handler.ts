import type { NextFunction, Request, Response } from 'express'

export type AsyncHandler<Req extends Request = Request> = (
  req: Req,
  res: Response,
  next: NextFunction,
) => Promise<unknown>

export const asyncHandler =
  <Req extends Request = Request>(fn: AsyncHandler<Req>) =>
  (req: Req, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
