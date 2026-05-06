import { z } from "zod";
import { NotFoundError } from "@shared/errors";
import type { ValidateCoupon } from "@modules/discount/index";
import type { Cart } from "../../domain/entities/Cart";
import { subtotalMinor } from "../../domain/entities/Cart";
import type { CartRepository } from "../../domain/repositories/CartRepository";

export const ApplyCouponInput = z.object({
  cartId: z.string().uuid(),
  code: z.string().min(1).max(64),
});
export type ApplyCouponInput = z.infer<typeof ApplyCouponInput>;

export interface ApplyCouponOutput {
  cart: Cart;
  discountMinor: number;
}

export class ApplyCoupon {
  constructor(
    private readonly carts: CartRepository,
    private readonly validateCoupon: ValidateCoupon,
  ) {}

  async execute(input: ApplyCouponInput): Promise<ApplyCouponOutput> {
    const cart = await this.carts.findById(input.cartId);
    if (!cart) throw new NotFoundError("Cart");

    const result = await this.validateCoupon.execute({
      code: input.code,
      subtotalMinor: subtotalMinor(cart),
    });

    await this.carts.setCoupon(cart.id, result.coupon.code);
    const refreshed = await this.carts.findById(cart.id);
    if (!refreshed) throw new NotFoundError("Cart");
    return { cart: refreshed, discountMinor: result.discount.discountMinor };
  }
}
