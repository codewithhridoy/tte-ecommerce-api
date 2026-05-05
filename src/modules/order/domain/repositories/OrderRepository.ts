import type { DbExecutor } from '@infra/db/client.js'
import type { Order, OrderItem } from '../entities/Order.js'
import type { OrderStatus } from '../value-objects/OrderStatus.js'

export interface CreateOrderDto {
  id: string
  orderNumber: string
  userId: string | null
  currency: string
  subtotalMinor: number
  discountMinor: number
  taxMinor: number
  shippingMinor: number
  totalMinor: number
  couponCode: string | null
  shippingAddress?: Record<string, string> | null
  billingAddress?: Record<string, string> | null
  items: Omit<OrderItem, 'id' | 'orderId'>[]
}

export interface OrderRepository {
  createInTx(tx: DbExecutor, dto: CreateOrderDto): Promise<Order>
  findById(id: string): Promise<Order | null>
  setStatus(id: string, status: OrderStatus): Promise<void>
}
