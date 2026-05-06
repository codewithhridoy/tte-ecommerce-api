import type { Response } from "express";
import { ENV } from "@shared/env";

export const COOKIE_ACCESS = "access_token";
export const COOKIE_REFRESH = "refresh_token";

// Refresh token is only sent to auth endpoints — reduces exposure window.
const REFRESH_COOKIE_PATH = "/api/v1/auth";

export interface TokenCookiePayload {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function setAuthCookies(res: Response, tokens: TokenCookiePayload): void {
  const secure = ENV.NODE_ENV === "production";
  res.cookie(COOKIE_ACCESS, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ENV.JWT_ACCESS_TTL * 1000,
  });
  res.cookie(COOKIE_REFRESH, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    expires: tokens.refreshExpiresAt,
  });
}

export function clearAuthCookies(res: Response): void {
  const secure = ENV.NODE_ENV === "production";
  res.clearCookie(COOKIE_ACCESS, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  res.clearCookie(COOKIE_REFRESH, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
}
