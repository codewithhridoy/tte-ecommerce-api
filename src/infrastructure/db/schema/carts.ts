import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { id, timestamps } from './_helpers.js'
import { users } from './users.js'
import { productVariants } from './products.js'

export const cartStatusEnum = pgEnum('cart_status', ['active', 'converted', 'abandoned'])

export const carts = pgTable(
  'carts',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    guestToken: varchar('guest_token', { length: 64 }),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    status: cartStatusEnum('status').notNull().default('active'),
    couponCode: varchar('coupon_code', { length: 64 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (t) => ({
    userIdx: index('carts_user_idx').on(t.userId),
    guestUnique: uniqueIndex('carts_guest_token_unique').on(t.guestToken),
    statusIdx: index('carts_status_idx').on(t.status),
  }),
)

export const cartItems = pgTable(
  'cart_items',
  {
    id: id(),
    cartId: uuid('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').notNull().references(() => productVariants.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitPriceMinor: integer('unit_price_minor').notNull(),
    ...timestamps,
  },
  (t) => ({
    cartIdx: index('cart_items_cart_idx').on(t.cartId),
    cartVariantUnique: uniqueIndex('cart_items_cart_variant_unique').on(t.cartId, t.variantId),
  }),
)
