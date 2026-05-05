import type { Cart, CartItem } from '../entities/Cart.js'

export interface CreateCartDto {
  id: string
  userId: string | null
  guestToken: string | null
  currency: string
}

export interface UpsertCartItemDto {
  cartId: string
  variantId: string
  quantity: number
  unitPriceMinor: number
}

export interface CartRepository {
  create(dto: CreateCartDto): Promise<Cart>
  findById(id: string): Promise<Cart | null>
  findActiveByUser(userId: string): Promise<Cart | null>
  findActiveByGuestToken(token: string): Promise<Cart | null>
  upsertItem(dto: UpsertCartItemDto): Promise<CartItem>
  removeItem(cartId: string, variantId: string): Promise<void>
  setCoupon(cartId: string, code: string | null): Promise<void>
  markConverted(cartId: string): Promise<void>
}
