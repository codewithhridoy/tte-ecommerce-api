import pino from 'pino'
import { loadEnv } from './env.js'

const env = loadEnv()

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'tte-ecommerce-api', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
})

export type Logger = typeof logger
