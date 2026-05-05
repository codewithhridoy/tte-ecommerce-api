import { sql } from 'drizzle-orm'
import { index, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { id, timestamps } from './_helpers.js'

export const outbox = pgTable(
  'event_outbox',
  {
    id: id(),
    aggregateType: varchar('aggregate_type', { length: 64 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 64 }).notNull(),
    eventType: varchar('event_type', { length: 128 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    correlationId: varchar('correlation_id', { length: 64 }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    attempts: text('attempts').notNull().default('0'),
    lastError: text('last_error'),
    ...timestamps,
  },
  (t) => ({
    unpublishedIdx: index('outbox_unpublished_idx').on(t.publishedAt, t.createdAt),
    aggregateIdx: index('outbox_aggregate_idx').on(t.aggregateType, t.aggregateId),
    eventTypeIdx: index('outbox_event_type_idx').on(t.eventType),
  }),
)
