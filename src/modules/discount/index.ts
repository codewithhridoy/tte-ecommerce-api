import { db } from "@infra/db/client";
import { DrizzleCouponRepository } from "./infrastructure/repositories/DrizzleCouponRepository";
import { ValidateCoupon } from "./application/use-cases/ValidateCoupon";
import type { CouponRepository } from "./domain/repositories/CouponRepository";

export interface DiscountModule {
  validateCoupon: ValidateCoupon;
  couponRepository: CouponRepository;
}

export const buildDiscountModule = (): DiscountModule => {
  const couponRepository = new DrizzleCouponRepository(db);
  return {
    couponRepository,
    validateCoupon: new ValidateCoupon(couponRepository),
  };
};

export { ValidateCoupon } from "./application/use-cases/ValidateCoupon";
export type { Coupon, DiscountCalculation } from "./domain/entities/Coupon";
export type { CouponRepository } from "./domain/repositories/CouponRepository";
