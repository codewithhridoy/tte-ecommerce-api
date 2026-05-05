import { z } from 'zod'
import { NotFoundError, PreconditionFailedError } from '@shared/errors.js'
import {
  calculateDiscount,
  type Coupon,
  type DiscountCalculation,
} from '../../domain/entities/Coupon.js'
import type { CouponRepository } from '../../domain/repositories/CouponRepository.js'

export const ValidateCouponInput = z.object({
  code: z.string().min(1).max(64),
  subtotalMinor: z.number().int().nonnegative(),
})
export type ValidateCouponInput = z.infer<typeof ValidateCouponInput>

export interface ValidateCouponOutput {
  coupon: Coupon
  discount: DiscountCalculation
}

export class ValidateCoupon {
  constructor(private readonly coupons: CouponRepository) {}

  async execute(input: ValidateCouponInput): Promise<ValidateCouponOutput> {
    const coupon = await this.coupons.findActiveByCode(input.code)
    if (!coupon) throw new NotFoundError('Coupon')

    if (input.subtotalMinor < coupon.minSubtotalMinor) {
      throw new PreconditionFailedError(
        `Coupon requires minimum subtotal of ${coupon.minSubtotalMinor}`,
      )
    }
    if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
      throw new PreconditionFailedError('Coupon redemption limit reached')
    }

    const discountMinor = calculateDiscount(coupon, input.subtotalMinor)
    return { coupon, discount: { code: coupon.code, discountMinor } }
  }
}
