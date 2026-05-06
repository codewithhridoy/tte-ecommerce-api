import { and, eq, isNull, gt, lte, sql, or } from "drizzle-orm";
import type { DbClient } from "@infra/db/client";
import { coupons } from "@infra/db/schema/index";
import type { Coupon } from "../../domain/entities/Coupon";
import type { CouponRepository } from "../../domain/repositories/CouponRepository";

const toCoupon = (row: typeof coupons.$inferSelect): Coupon => ({
  id: row.id,
  code: row.code,
  type: row.type,
  value: row.value,
  minSubtotalMinor: row.minSubtotalMinor,
  maxRedemptions: row.maxRedemptions,
  redeemedCount: row.redeemedCount,
  startsAt: row.startsAt,
  expiresAt: row.expiresAt,
  isActive: row.isActive,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class DrizzleCouponRepository implements CouponRepository {
  constructor(private readonly db: DbClient) {}

  async findActiveByCode(code: string): Promise<Coupon | null> {
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.code, code.toUpperCase()),
          eq(coupons.isActive, true),
          lte(coupons.startsAt, now),
          or(isNull(coupons.expiresAt), gt(coupons.expiresAt, now))!,
        ),
      )
      .limit(1);
    return row ? toCoupon(row) : null;
  }

  async incrementRedemptions(couponId: string): Promise<void> {
    await this.db
      .update(coupons)
      .set({
        redeemedCount: sql`${coupons.redeemedCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, couponId));
  }
}
