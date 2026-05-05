import { eq } from 'drizzle-orm'
import { db, type DbClient, type DbExecutor } from '@infra/db/client.js'
import { orderItems, orders } from '@infra/db/schema/index.js'
import { newId } from '@shared/id.js'
import type { Order, OrderItem } from '../../domain/entities/Order.js'
import type {
  CreateOrderDto,
  OrderRepository,
} from '../../domain/repositories/OrderRepository.js'
import type { OrderStatus } from '../../domain/value-objects/OrderStatus.js'

const toItem = (row: typeof orderItems.$inferSelect): OrderItem => ({
  id: row.id,
  orderId: row.orderId,
  variantId: row.variantId,
  sku: row.sku,
  name: row.name,
  quantity: row.quantity,
  unitPriceMinor: row.unitPriceMinor,
  totalMinor: row.totalMinor,
})

const toOrder = (row: typeof orders.$inferSelect, items: OrderItem[]): Order => ({
  id: row.id,
  orderNumber: row.orderNumber,
  userId: row.userId,
  status: row.status,
  currency: row.currency,
  subtotalMinor: row.subtotalMinor,
  discountMinor: row.discountMinor,
  taxMinor: row.taxMinor,
  shippingMinor: row.shippingMinor,
  totalMinor: row.totalMinor,
  couponCode: row.couponCode,
  shippingAddress: row.shippingAddress,
  billingAddress: row.billingAddress,
  metadata: row.metadata,
  items,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly client: DbClient = db) {}

  async createInTx(tx: DbExecutor, dto: CreateOrderDto): Promise<Order> {
    const [orderRow] = await tx
      .insert(orders)
      .values({
        id: dto.id,
        orderNumber: dto.orderNumber,
        userId: dto.userId,
        currency: dto.currency,
        subtotalMinor: dto.subtotalMinor,
        discountMinor: dto.discountMinor,
        taxMinor: dto.taxMinor,
        shippingMinor: dto.shippingMinor,
        totalMinor: dto.totalMinor,
        couponCode: dto.couponCode,
        shippingAddress: dto.shippingAddress ?? null,
        billingAddress: dto.billingAddress ?? null,
      })
      .returning()
    if (!orderRow) throw new Error('Order insert returned no row')

    const itemsToInsert = dto.items.map((i) => ({
      id: newId(),
      orderId: orderRow.id,
      variantId: i.variantId,
      sku: i.sku,
      name: i.name,
      quantity: i.quantity,
      unitPriceMinor: i.unitPriceMinor,
      totalMinor: i.totalMinor,
    }))
    const insertedItems = itemsToInsert.length === 0 ? [] : await tx.insert(orderItems).values(itemsToInsert).returning()
    return toOrder(orderRow, insertedItems.map(toItem))
  }

  async findById(id: string): Promise<Order | null> {
    const [row] = await this.client.select().from(orders).where(eq(orders.id, id)).limit(1)
    if (!row) return null
    const items = await this.client.select().from(orderItems).where(eq(orderItems.orderId, id))
    return toOrder(row, items.map(toItem))
  }

  async setStatus(id: string, status: OrderStatus): Promise<void> {
    await this.client.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id))
  }
}
