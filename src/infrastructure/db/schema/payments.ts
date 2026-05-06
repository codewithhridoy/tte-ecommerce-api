import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./_helpers";
import { orders } from "./orders";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "authorized",
  "captured",
  "failed",
  "refunded",
]);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerRef: varchar("provider_ref", { length: 128 }),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    rawResponse: jsonb("raw_response")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (t) => ({
    orderIdx: index("payments_order_idx").on(t.orderId),
    statusIdx: index("payments_status_idx").on(t.status),
    providerRefIdx: index("payments_provider_ref_idx").on(t.providerRef),
  }),
);
