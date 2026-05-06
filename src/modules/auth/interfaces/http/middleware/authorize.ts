import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthenticatedError } from "@shared/errors";
import type { UserRole } from "@modules/user/domain/entities/User";

export const authorize =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(new UnauthenticatedError());
    if (!roles.includes(req.auth.role))
      return next(new ForbiddenError(`Requires role: ${roles.join(", ")}`));
    next();
  };
