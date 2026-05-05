import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { id, timestamps } from './_helpers.js'

export const productStatusEnum = pgEnum('product_status', ['draft', 'active', 'archived'])

export const products = pgTable(
  'products',
  {
    id: id(),
    sku: varchar('sku', { length: 64 }).notNull(),
    slug: varchar('slug', { length: 200 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    status: productStatusEnum('status').notNull().default('draft'),
    attributes: jsonb('attributes').$type<Record<string, string | number | boolean>>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (t) => ({
    skuUnique: uniqueIndex('products_sku_unique').on(t.sku),
    slugUnique: uniqueIndex('products_slug_unique').on(t.slug),
    statusIdx: index('products_status_idx').on(t.status),
    createdIdx: index('products_created_idx').on(t.createdAt),
  }),
)

export const productVariants = pgTable(
  'product_variants',
  {
    id: id(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    priceMinor: integer('price_minor').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    options: jsonb('options').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    skuUnique: uniqueIndex('variants_sku_unique').on(t.sku),
    productIdx: index('variants_product_idx').on(t.productId),
    activeIdx: index('variants_active_idx').on(t.isActive),
  }),
)
