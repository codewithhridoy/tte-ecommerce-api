import { eq } from 'drizzle-orm'
import type { DbClient } from '@infra/db/client.js'
import { payments } from '@infra/db/schema/index.js'
import type { Payment } from '../../domain/entities/Payment.js'
import type {
  CreatePaymentDto,
  PaymentRepository,
} from '../../domain/repositories/PaymentRepository.js'
import type { PaymentStatus } from '../../domain/entities/Payment.js'

const toPayment = (row: typeof payments.$inferSelect): Payment => ({
  id: row.id,
  orderId: row.orderId,
  provider: row.provider,
  providerRef: row.providerRef,
  status: row.status,
  amountMinor: row.amountMinor,
  currency: row.currency,
  rawResponse: row.rawResponse,
  failureReason: row.failureReason,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export class DrizzlePaymentRepository implements PaymentRepository {
  constructor(private readonly db: DbClient) {}

  async create(dto: CreatePaymentDto): Promise<Payment> {
    const [row] = await this.db
      .insert(payments)
      .values({
        id: dto.id,
        orderId: dto.orderId,
        provider: dto.provider,
        providerRef: dto.providerRef,
        status: dto.status,
        amountMinor: dto.amountMinor,
        currency: dto.currency,
        rawResponse: dto.rawResponse ?? null,
        failureReason: dto.failureReason ?? null,
      })
      .returning()
    if (!row) throw new Error('Payment insert returned no row')
    return toPayment(row)
  }

  async findByOrder(orderId: string): Promise<Payment[]> {
    const rows = await this.db.select().from(payments).where(eq(payments.orderId, orderId))
    return rows.map(toPayment)
  }

  async setStatus(id: string, status: PaymentStatus, raw?: Record<string, unknown>): Promise<void> {
    await this.db
      .update(payments)
      .set({ status, rawResponse: raw ?? null, updatedAt: new Date() })
      .where(eq(payments.id, id))
  }
}
