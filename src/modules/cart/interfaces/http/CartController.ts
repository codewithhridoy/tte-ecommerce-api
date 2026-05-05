import type { Request, Response } from 'express'
import { ok } from '@shared/http/response.js'
import { AddToCartInput, type AddToCart } from '../../application/use-cases/AddToCart.js'
import { ApplyCouponInput, type ApplyCoupon } from '../../application/use-cases/ApplyCoupon.js'

export class CartController {
  constructor(
    private readonly addToCart: AddToCart,
    private readonly applyCoupon: ApplyCoupon,
  ) {}

  // POST /api/v1/cart/items
  add = async (req: Request, res: Response): Promise<void> => {
    const userId = req.auth?.userId ?? null
    const guestToken =
      typeof req.body.guestToken === 'string' ? req.body.guestToken : (req.header('x-guest-token') ?? null)

    const input = AddToCartInput.parse({
      variantId: req.body.variantId,
      quantity: req.body.quantity,
      userId,
      guestToken,
    })
    const result = await this.addToCart.execute(input)
    res.status(201).json(ok(result.cart))
  }

  // POST /api/v1/cart/:cartId/coupon
  applyCouponHandler = async (req: Request, res: Response): Promise<void> => {
    const input = ApplyCouponInput.parse({ cartId: req.params.cartId, code: req.body.code })
    const result = await this.applyCoupon.execute(input)
    res.status(200).json(ok({ cart: result.cart, discountMinor: result.discountMinor }))
  }
}
