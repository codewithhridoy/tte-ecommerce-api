import type { Router } from "express";
import { db } from "@infra/db/client";
import { ENV } from "@shared/env";
import { DrizzleUserRepository } from "@modules/user/index";
import { argon2Hasher } from "./domain/services/PasswordHasher";
import { TokenService } from "./domain/services/TokenService";
import { OtpService } from "./domain/services/OtpService";
import { DrizzleRefreshTokenRepository } from "./infrastructure/repositories/DrizzleRefreshTokenRepository";
import { DrizzleOtpTokenRepository } from "./infrastructure/repositories/DrizzleOtpTokenRepository";
import { RegisterUser } from "./application/use-cases/RegisterUser";
import { LoginUser } from "./application/use-cases/LoginUser";
import { RefreshSession } from "./application/use-cases/RefreshSession";
import { Logout } from "./application/use-cases/Logout";
import { SendOtp } from "./application/use-cases/SendOtp";
import { VerifyOtp } from "./application/use-cases/VerifyOtp";
import { AuthController } from "./interfaces/http/AuthController";
import { authRoutes } from "./interfaces/http/routes";

export interface AuthModule {
  routes: Router;
  tokenService: TokenService;
  sendOtp: SendOtp;
  verifyOtp: VerifyOtp;
}

export const buildAuthModule = (): AuthModule => {
  const tokenService = new TokenService({
    accessSecret: ENV.JWT_ACCESS_SECRET,
    refreshSecret: ENV.JWT_REFRESH_SECRET,
    accessTtlSeconds: ENV.JWT_ACCESS_TTL,
    refreshTtlSeconds: ENV.JWT_REFRESH_TTL,
  });

  const otpService = new OtpService({
    codeLength: 6,
    ttlSeconds: 600,
    resendCooldownSeconds: 60,
  });

  const userRepo = new DrizzleUserRepository(db);
  const refreshRepo = new DrizzleRefreshTokenRepository(db);
  const otpRepo = new DrizzleOtpTokenRepository(db);

  const sendOtp = new SendOtp(userRepo, otpRepo, otpService);
  const verifyOtp = new VerifyOtp(userRepo, otpRepo);

  const controller = new AuthController(
    new RegisterUser(userRepo, argon2Hasher),
    new LoginUser(userRepo, refreshRepo, argon2Hasher, tokenService),
    new RefreshSession(userRepo, refreshRepo, tokenService),
    new Logout(refreshRepo),
  );
  return { routes: authRoutes(controller), tokenService, sendOtp, verifyOtp };
};

export { authenticate } from "./interfaces/http/middleware/authenticate";
export { authorize } from "./interfaces/http/middleware/authorize";
export type { AuthenticatedPrincipal } from "./interfaces/http/middleware/authenticate";
export type { OtpVerifier, OtpVerifyInput } from "./application/services/OtpVerifier";
export type { VerifyOtp } from "./application/use-cases/VerifyOtp";
