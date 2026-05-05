import { loadEnv } from '@shared/env.js'
import { logger } from '@shared/logger.js'
import { pool } from '@infra/db/client.js'
import { redis } from '@infra/cache/redis.js'
import { startOutboxRelay } from '@infra/events/outbox-relay.js'
import { buildApp } from './app.js'

const env = loadEnv()
const { app, outboxPublisher, shutdown } = buildApp()

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server listening')
})

const relay = startOutboxRelay(outboxPublisher)

const close = async (): Promise<void> => {
  logger.info('received shutdown signal')
  relay.stop()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await shutdown()
  await pool.end()
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', close)
process.on('SIGINT', close)
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled rejection')
})
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception')
  process.exit(1)
})
