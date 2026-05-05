import type { Config } from 'drizzle-kit'

export default {
  schema: './src/infrastructure/db/schema/*.ts',
  out: './src/infrastructure/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/tte_ecommerce',
  },
  strict: true,
  verbose: true,
} satisfies Config
