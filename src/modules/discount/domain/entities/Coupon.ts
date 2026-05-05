export type CouponType = 'percent' | 'fixed'

export interface Coupon {
  id: string
  code: string
  type: CouponType
  value: number
  minSubtotalMinor: number
  maxRedemptions: number | null
  redeemedCount: number
  startsAt: Date
  expiresAt: Date | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface DiscountCalculation {
  code: string
  discountMinor: number
}

export const calculateDiscount = (coupon: Coupon, subtotalMinor: number): number => {
  if (coupon.type === 'percent') {
    const pct = Math.max(0, Math.min(100, coupon.value))
    return Math.floor((subtotalMinor * pct) / 100)
  }
  return Math.min(subtotalMinor, Math.max(0, coupon.value))
}
