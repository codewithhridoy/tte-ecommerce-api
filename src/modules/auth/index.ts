import type { Router } from "express";
import { db } from "@infra/db/client";
import { loadEnv } from "@shared/env";
import { DrizzleUserRepository } from "@modules/user/infrastructure/repositories/DrizzleUserRepository";
import { argon2Hasher } from "./domain/services/PasswordHasher";
import { TokenService } from "./domain/services/TokenService";
import { DrizzleRefreshTokenRepository } from "./infrastructure/repositories/DrizzleRefreshTokenRepository";
import { RegisterUser } from "./application/use-cases/RegisterUser";
import { LoginUser } from "./application/use-cases/LoginUser";
import { RefreshSession } from "./application/use-cases/RefreshSession";
import { Logout } from "./application/use-cases/Logout";
import { AuthController } from "./interfaces/http/AuthController";
import { authRoutes } from "./interfaces/http/routes";

export interface AuthModule {
  routes: Router;
  tokenService: TokenService;
}

export const buildAuthModule = (): AuthModule => {
  const env = loadEnv();
  const tokenService = new TokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtlSeconds: env.JWT_ACCESS_TTL,
    refreshTtlSeconds: env.JWT_REFRESH_TTL,
  });

  const userRepo = new DrizzleUserRepository(db);
  const refreshRepo = new DrizzleRefreshTokenRepository(db);

  const controller = new AuthController(
    new RegisterUser(userRepo, argon2Hasher),
    new LoginUser(userRepo, refreshRepo, argon2Hasher, tokenService),
    new RefreshSession(userRepo, refreshRepo, tokenService),
    new Logout(refreshRepo),
  );
  return { routes: authRoutes(controller), tokenService };
};

export { authenticate } from "./interfaces/http/middleware/authenticate";
export { authorize } from "./interfaces/http/middleware/authorize";
export type { AuthenticatedPrincipal } from "./interfaces/http/middleware/authenticate";
