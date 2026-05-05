export type CartStatus = 'active' | 'converted' | 'abandoned'

export interface CartItem {
  id: string
  cartId: string
  variantId: string
  quantity: number
  unitPriceMinor: number
  createdAt: Date
  updatedAt: Date
}

export interface Cart {
  id: string
  userId: string | null
  guestToken: string | null
  currency: string
  status: CartStatus
  couponCode: string | null
  metadata: Record<string, unknown>
  items: CartItem[]
  createdAt: Date
  updatedAt: Date
}

export const subtotalMinor = (cart: Cart): number =>
  cart.items.reduce((acc, i) => acc + i.unitPriceMinor * i.quantity, 0)
