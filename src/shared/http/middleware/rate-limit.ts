import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redis } from '@infra/cache/redis.js'
import { loadEnv } from '@shared/env.js'
import { fail } from '@shared/http/response.js'

const env = loadEnv()

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<unknown>,
    prefix: 'rl:api:',
  }),
  handler: (_req, res) => {
    res.status(429).json(fail('RATE_LIMITED', 'Too many requests'))
  },
})

export const authRateLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<unknown>,
    prefix: 'rl:auth:',
  }),
  handler: (_req, res) => {
    res.status(429).json(fail('RATE_LIMITED', 'Too many authentication attempts'))
  },
})
