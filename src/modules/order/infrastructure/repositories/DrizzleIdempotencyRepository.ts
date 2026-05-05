import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db, type DbClient, type DbExecutor } from '@infra/db/client.js'
import { idempotencyKeys } from '@infra/db/schema/index.js'
import { newId } from '@shared/id.js'

export interface IdempotencyHit<T> {
  hit: true
  statusCode: number
  body: T
}
export interface IdempotencyMiss {
  hit: false
  rowId: string
}
export type IdempotencyLookup<T> = IdempotencyHit<T> | IdempotencyMiss

export class DrizzleIdempotencyRepository {
  constructor(private readonly client: DbClient = db) {}

  hashRequest(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  }

  async beginOrReplay<T>(
    tx: DbExecutor,
    args: { key: string; scope: string; userId: string | null; requestHash: string },
  ): Promise<IdempotencyLookup<T>> {
    const [existing] = await tx
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.key, args.key), eq(idempotencyKeys.scope, args.scope)))
      .limit(1)

    if (existing) {
      if (existing.requestHash !== args.requestHash) {
        // Same key reused with a different payload — refuse.
        throw new Error('IDEMPOTENCY_KEY_CONFLICT')
      }
      if (existing.responseBody !== null && existing.statusCode !== null) {
        return { hit: true, statusCode: existing.statusCode, body: existing.responseBody as T }
      }
      // In-flight from another request; treat as conflict.
      throw new Error('IDEMPOTENCY_KEY_IN_FLIGHT')
    }

    const id = newId()
    await tx.insert(idempotencyKeys).values({
      id,
      key: args.key,
      scope: args.scope,
      userId: args.userId,
      requestHash: args.requestHash,
    })
    return { hit: false, rowId: id }
  }

  async complete(tx: DbExecutor, rowId: string, statusCode: number, body: unknown): Promise<void> {
    await tx
      .update(idempotencyKeys)
      .set({ statusCode, responseBody: body as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(idempotencyKeys.id, rowId))
  }
}

export const orderIdempotencyScope = 'order:create'
