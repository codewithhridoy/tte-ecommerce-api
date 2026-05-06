import type { NextFunction, Request, Response } from "express";
import { UnauthenticatedError } from "@shared/errors";
import type { TokenService } from "../../../domain/services/TokenService";
import type { UserRole } from "@modules/user/domain/entities/User";

export interface AuthenticatedPrincipal {
  userId: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthenticatedPrincipal;
    }
  }
}

export const authenticate =
  (tokens: TokenService, opts: { optional?: boolean } = {}) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.header("authorization");
    if (!header) {
      if (opts.optional) return next();
      return next(new UnauthenticatedError());
    }
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token)
      return next(new UnauthenticatedError("Malformed Authorization header"));
    try {
      const claims = tokens.verifyAccess(token);
      req.auth = { userId: claims.sub, role: claims.role };
      next();
    } catch {
      next(new UnauthenticatedError("Invalid or expired token"));
    }
  };
