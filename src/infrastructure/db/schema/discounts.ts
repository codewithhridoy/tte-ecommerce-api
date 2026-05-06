import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_helpers";

export const couponTypeEnum = pgEnum("coupon_type", ["percent", "fixed"]);

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: varchar("code", { length: 64 }).notNull(),
    type: couponTypeEnum("type").notNull(),
    value: integer("value").notNull(),
    minSubtotalMinor: integer("min_subtotal_minor").notNull().default(0),
    maxRedemptions: integer("max_redemptions"),
    redeemedCount: integer("redeemed_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    codeUnique: uniqueIndex("coupons_code_unique").on(t.code),
    activeIdx: index("coupons_active_idx").on(t.isActive),
  }),
);
