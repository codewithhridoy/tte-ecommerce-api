import type { OrderStatus } from '../value-objects/OrderStatus.js'

export interface OrderItem {
  id: string
  orderId: string
  variantId: string
  sku: string
  name: string
  quantity: number
  unitPriceMinor: number
  totalMinor: number
}

export interface Order {
  id: string
  orderNumber: string
  userId: string | null
  status: OrderStatus
  currency: string
  subtotalMinor: number
  discountMinor: number
  taxMinor: number
  shippingMinor: number
  totalMinor: number
  couponCode: string | null
  shippingAddress: Record<string, string> | null
  billingAddress: Record<string, string> | null
  metadata: Record<string, unknown>
  items: OrderItem[]
  createdAt: Date
  updatedAt: Date
}
