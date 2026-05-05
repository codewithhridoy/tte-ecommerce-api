import { z } from 'zod'
import { ConflictError, NotFoundError } from '@shared/errors.js'
import { newId } from '@shared/id.js'
import type { ProductRepository } from '@modules/product/domain/repositories/ProductRepository.js'
import type { Cart } from '../../domain/entities/Cart.js'
import type { CartRepository } from '../../domain/repositories/CartRepository.js'

export const AddToCartInput = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(999),
  userId: z.string().uuid().nullable(),
  guestToken: z.string().min(8).max(64).nullable(),
})
export type AddToCartInput = z.infer<typeof AddToCartInput>

export interface AddToCartOutput {
  cart: Cart
}

export class AddToCart {
  constructor(
    private readonly carts: CartRepository,
    private readonly products: ProductRepository,
  ) {}

  async execute(input: AddToCartInput): Promise<AddToCartOutput> {
    if (input.userId === null && input.guestToken === null) {
      throw new ConflictError('Cart owner is required (userId or guestToken)')
    }

    const [variant] = await this.products.findVariantsByIds([input.variantId])
    if (!variant || !variant.isActive) throw new NotFoundError('Variant')

    let cart = input.userId
      ? await this.carts.findActiveByUser(input.userId)
      : await this.carts.findActiveByGuestToken(input.guestToken!)

    if (!cart) {
      cart = await this.carts.create({
        id: newId(),
        userId: input.userId,
        guestToken: input.guestToken,
        currency: variant.currency,
      })
    } else if (cart.currency !== variant.currency) {
      throw new ConflictError('Cart currency mismatch')
    }

    await this.carts.upsertItem({
      cartId: cart.id,
      variantId: variant.id,
      quantity: input.quantity,
      unitPriceMinor: variant.priceMinor,
    })

    const refreshed = await this.carts.findById(cart.id)
    if (!refreshed) throw new NotFoundError('Cart')
    return { cart: refreshed }
  }
}
