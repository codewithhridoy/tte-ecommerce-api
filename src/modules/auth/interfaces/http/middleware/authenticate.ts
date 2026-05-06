import type { NextFunction, Request, Response } from "express";
import { UnauthenticatedError } from "@shared/errors";
import type { TokenService } from "../../../domain/services/TokenService";
import type { UserRole } from "@modules/user/index.js";
import { COOKIE_ACCESS } from "../helpers/cookies";

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
    // Cookie takes precedence; Authorization header is the fallback for API clients.
    const cookieToken = req.cookies?.[COOKIE_ACCESS] as string | undefined;
    let token: string | undefined = cookieToken;

    if (!token) {
      const header = req.header("authorization");
      if (header) {
        const [scheme, headerToken] = header.split(" ");
        if (scheme !== "Bearer" || !headerToken) {
          return next(new UnauthenticatedError("Malformed Authorization header"));
        }
        token = headerToken;
      }
    }

    if (!token) {
      if (opts.optional) return next();
      return next(new UnauthenticatedError());
    }

    try {
      const claims = tokens.verifyAccess(token);
      req.auth = { userId: claims.sub, role: claims.role };
      next();
    } catch {
      next(new UnauthenticatedError("Invalid or expired token"));
    }
  };
