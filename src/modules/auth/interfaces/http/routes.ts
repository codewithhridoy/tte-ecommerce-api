import { Router } from 'express'
import { asyncHandler } from '@shared/http/async-handler.js'
import { authRateLimiter } from '@shared/http/middleware/rate-limit.js'
import type { AuthController } from './AuthController.js'

export const authRoutes = (controller: AuthController): Router => {
  const r = Router()
  r.post('/register', authRateLimiter, asyncHandler(controller.register))
  r.post('/login', authRateLimiter, asyncHandler(controller.login))
  r.post('/refresh', asyncHandler(controller.refreshSession))
  r.post('/logout', asyncHandler(controller.logoutSession))
  return r
}
