import {
  check,
  index,
  integer,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, timestamps } from "./_helpers";
import { productVariants } from "./products";

export const inventory = pgTable(
  "inventory",
  {
    id: id(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    version: integer("version").notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    variantUnique: uniqueIndex("inventory_variant_unique").on(t.variantId),
    onHandPositive: check("inventory_on_hand_nonneg", sql`${t.onHand} >= 0`),
    reservedPositive: check(
      "inventory_reserved_nonneg",
      sql`${t.reserved} >= 0`,
    ),
    reservedLeOnHand: check(
      "inventory_reserved_le_on_hand",
      sql`${t.reserved} <= ${t.onHand}`,
    ),
  }),
);

export const inventoryLedger = pgTable(
  "inventory_ledger",
  {
    id: id(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    delta: integer("delta").notNull(),
    reason: varchar("reason", { length: 64 }).notNull(),
    reasonRef: varchar("reason_ref", { length: 64 }),
    ...timestamps,
  },
  (t) => ({
    variantIdx: index("ledger_variant_idx").on(t.variantId),
    reasonIdx: index("ledger_reason_idx").on(t.reason),
  }),
);
