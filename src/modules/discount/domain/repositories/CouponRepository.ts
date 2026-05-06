import type { Coupon } from "../entities/Coupon";

export interface CouponRepository {
  findActiveByCode(code: string): Promise<Coupon | null>;
  incrementRedemptions(couponId: string): Promise<void>;
}
