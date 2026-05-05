import type { Router } from 'express'
import { db } from '@infra/db/client.js'
import { loadEnv } from '@shared/env.js'
import { DrizzleUserRepository } from '@modules/user/infrastructure/repositories/DrizzleUserRepository.js'
import { argon2Hasher } from './domain/services/PasswordHasher.js'
import { TokenService } from './domain/services/TokenService.js'
import { DrizzleRefreshTokenRepository } from './infrastructure/repositories/DrizzleRefreshTokenRepository.js'
import { RegisterUser } from './application/use-cases/RegisterUser.js'
import { LoginUser } from './application/use-cases/LoginUser.js'
import { RefreshSession } from './application/use-cases/RefreshSession.js'
import { Logout } from './application/use-cases/Logout.js'
import { AuthController } from './interfaces/http/AuthController.js'
import { authRoutes } from './interfaces/http/routes.js'

export interface AuthModule {
  routes: Router
  tokenService: TokenService
}

export const buildAuthModule = (): AuthModule => {
  const env = loadEnv()
  const tokenService = new TokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtlSeconds: env.JWT_ACCESS_TTL,
    refreshTtlSeconds: env.JWT_REFRESH_TTL,
  })

  const userRepo = new DrizzleUserRepository(db)
  const refreshRepo = new DrizzleRefreshTokenRepository(db)

  const controller = new AuthController(
    new RegisterUser(userRepo, argon2Hasher),
    new LoginUser(userRepo, refreshRepo, argon2Hasher, tokenService),
    new RefreshSession(userRepo, refreshRepo, tokenService),
    new Logout(refreshRepo),
  )
  return { routes: authRoutes(controller), tokenService }
}

export { authenticate } from './interfaces/http/middleware/authenticate.js'
export { authorize } from './interfaces/http/middleware/authorize.js'
export type { AuthenticatedPrincipal } from './interfaces/http/middleware/authenticate.js'
