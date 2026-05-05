import { and, eq, sql } from 'drizzle-orm'
import type { DbClient } from '@infra/db/client.js'
import { cartItems, carts } from '@infra/db/schema/index.js'
import { newId } from '@shared/id.js'
import type { Cart, CartItem } from '../../domain/entities/Cart.js'
import type {
  CartRepository,
  CreateCartDto,
  UpsertCartItemDto,
} from '../../domain/repositories/CartRepository.js'

const toItem = (row: typeof cartItems.$inferSelect): CartItem => ({
  id: row.id,
  cartId: row.cartId,
  variantId: row.variantId,
  quantity: row.quantity,
  unitPriceMinor: row.unitPriceMinor,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const toCart = (row: typeof carts.$inferSelect, items: CartItem[]): Cart => ({
  id: row.id,
  userId: row.userId,
  guestToken: row.guestToken,
  currency: row.currency,
  status: row.status,
  couponCode: row.couponCode,
  metadata: row.metadata,
  items,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export class DrizzleCartRepository implements CartRepository {
  constructor(private readonly db: DbClient) {}

  private async loadItems(cartId: string): Promise<CartItem[]> {
    const rows = await this.db.select().from(cartItems).where(eq(cartItems.cartId, cartId))
    return rows.map(toItem)
  }

  async create(dto: CreateCartDto): Promise<Cart> {
    const [row] = await this.db
      .insert(carts)
      .values({
        id: dto.id,
        userId: dto.userId,
        guestToken: dto.guestToken,
        currency: dto.currency,
      })
      .returning()
    if (!row) throw new Error('Cart insert returned no row')
    return toCart(row, [])
  }

  async findById(id: string): Promise<Cart | null> {
    const [row] = await this.db.select().from(carts).where(eq(carts.id, id)).limit(1)
    if (!row) return null
    return toCart(row, await this.loadItems(row.id))
  }

  async findActiveByUser(userId: string): Promise<Cart | null> {
    const [row] = await this.db
      .select()
      .from(carts)
      .where(and(eq(carts.userId, userId), eq(carts.status, 'active')))
      .limit(1)
    if (!row) return null
    return toCart(row, await this.loadItems(row.id))
  }

  async findActiveByGuestToken(token: string): Promise<Cart | null> {
    const [row] = await this.db
      .select()
      .from(carts)
      .where(and(eq(carts.guestToken, token), eq(carts.status, 'active')))
      .limit(1)
    if (!row) return null
    return toCart(row, await this.loadItems(row.id))
  }

  async upsertItem(dto: UpsertCartItemDto): Promise<CartItem> {
    const [row] = await this.db
      .insert(cartItems)
      .values({
        id: newId(),
        cartId: dto.cartId,
        variantId: dto.variantId,
        quantity: dto.quantity,
        unitPriceMinor: dto.unitPriceMinor,
      })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.variantId],
        set: {
          quantity: sql`${cartItems.quantity} + ${dto.quantity}`,
          unitPriceMinor: dto.unitPriceMinor,
          updatedAt: new Date(),
        },
      })
      .returning()
    if (!row) throw new Error('Cart item upsert returned no row')
    return toItem(row)
  }

  async removeItem(cartId: string, variantId: string): Promise<void> {
    await this.db
      .delete(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)))
  }

  async setCoupon(cartId: string, code: string | null): Promise<void> {
    await this.db
      .update(carts)
      .set({ couponCode: code, updatedAt: new Date() })
      .where(eq(carts.id, cartId))
  }

  async markConverted(cartId: string): Promise<void> {
    await this.db
      .update(carts)
      .set({ status: 'converted', updatedAt: new Date() })
      .where(eq(carts.id, cartId))
  }
}
