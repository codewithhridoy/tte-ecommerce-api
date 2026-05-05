import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './client.js'
import { logger } from '@shared/logger.js'

async function run(): Promise<void> {
  logger.info('running migrations')
  await migrate(db, { migrationsFolder: './src/infrastructure/db/migrations' })
  logger.info('migrations complete')
  await pool.end()
}

run().catch((err: unknown) => {
  logger.error({ err }, 'migration failed')
  process.exit(1)
})
