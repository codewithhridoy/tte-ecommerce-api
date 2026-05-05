import type { Coupon } from '../entities/Coupon.js'

export interface CouponRepository {
  findActiveByCode(code: string): Promise<Coupon | null>
  incrementRedemptions(couponId: string): Promise<void>
}
