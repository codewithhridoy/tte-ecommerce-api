import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { loadEnv } from '@shared/env.js'
import * as schema from './schema/index.js'

const env = loadEnv()

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
})

export const db = drizzle(pool, { schema })

export type DbClient = typeof db
export type DbTransaction = Parameters<Parameters<DbClient['transaction']>[0]>[0]
export type DbExecutor = DbClient | DbTransaction
