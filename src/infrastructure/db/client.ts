import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { ENV } from "@shared/env";
import * as schema from "./schema/index";

export const pool = new pg.Pool({
  connectionString: ENV.DATABASE_URL,
  max: ENV.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });

export type DbClient = typeof db;
export type DbTransaction = Parameters<
  Parameters<DbClient["transaction"]>[0]
>[0];
export type DbExecutor = DbClient | DbTransaction;
