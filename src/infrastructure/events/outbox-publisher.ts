import { eq, isNull, sql } from 'drizzle-orm'
import { db, type DbExecutor } from '@infra/db/client.js'
import { outbox } from '@infra/db/schema/index.js'
import { logger } from '@shared/logger.js'
import type { DomainEvent, EventPublisher } from './types.js'

export const enqueueOutbox = async (tx: DbExecutor, event: DomainEvent): Promise<void> => {
  await tx.insert(outbox).values({
    id: event.id,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventType: event.type,
    payload: event.payload,
    correlationId: event.correlationId ?? null,
  })
}

export class OutboxPublisher implements EventPublisher {
  constructor(private readonly downstream: EventPublisher) {}

  async publish(event: DomainEvent): Promise<void> {
    await enqueueOutbox(db, event)
  }

  async drain(batchSize = 100): Promise<number> {
    const rows = await db
      .select()
      .from(outbox)
      .where(isNull(outbox.publishedAt))
      .orderBy(outbox.createdAt)
      .limit(batchSize)

    let published = 0
    for (const row of rows) {
      try {
        await this.downstream.publish({
          id: row.id,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          type: row.eventType,
          payload: row.payload,
          correlationId: row.correlationId ?? undefined,
          occurredAt: row.createdAt,
        })
        await db.update(outbox).set({ publishedAt: new Date() }).where(eq(outbox.id, row.id))
        published++
      } catch (err) {
        logger.error({ err, eventId: row.id }, 'outbox publish failed')
        await db
          .update(outbox)
          .set({ attempts: sql`(${outbox.attempts}::int + 1)::text`, lastError: String(err) })
          .where(eq(outbox.id, row.id))
      }
    }
    return published
  }
}
