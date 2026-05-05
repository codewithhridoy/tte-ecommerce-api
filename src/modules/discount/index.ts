import { db } from '@infra/db/client.js'
import { DrizzleCouponRepository } from './infrastructure/repositories/DrizzleCouponRepository.js'
import { ValidateCoupon } from './application/use-cases/ValidateCoupon.js'
import type { CouponRepository } from './domain/repositories/CouponRepository.js'

export interface DiscountModule {
  validateCoupon: ValidateCoupon
  couponRepository: CouponRepository
}

export const buildDiscountModule = (): DiscountModule => {
  const couponRepository = new DrizzleCouponRepository(db)
  return {
    couponRepository,
    validateCoupon: new ValidateCoupon(couponRepository),
  }
}

export { ValidateCoupon } from './application/use-cases/ValidateCoupon.js'
export type { Coupon, DiscountCalculation } from './domain/entities/Coupon.js'
export type { CouponRepository } from './domain/repositories/CouponRepository.js'
