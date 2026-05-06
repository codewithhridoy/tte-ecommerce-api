import { describe, expect, it } from "vitest";
import { NotFoundError, PreconditionFailedError } from "@shared/errors";
import { ValidateCoupon } from "./ValidateCoupon";
import type { Coupon } from "../../domain/entities/Coupon";
import type { CouponRepository } from "../../domain/repositories/CouponRepository";

const makeCoupon = (overrides: Partial<Coupon> = {}): Coupon => ({
  id: "c1",
  code: "SAVE10",
  type: "percent",
  value: 10,
  minSubtotalMinor: 0,
  maxRedemptions: null,
  redeemedCount: 0,
  startsAt: new Date(0),
  expiresAt: null,
  isActive: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

class FakeCouponRepo implements CouponRepository {
  constructor(private readonly coupon: Coupon | null) {}
  async findActiveByCode(): Promise<Coupon | null> {
    return this.coupon;
  }
  async incrementRedemptions(): Promise<void> {}
}

describe("ValidateCoupon", () => {
  it("returns percent discount for valid coupon", async () => {
    const uc = new ValidateCoupon(new FakeCouponRepo(makeCoupon()));
    const result = await uc.execute({ code: "SAVE10", subtotalMinor: 10_000 });
    expect(result.discount.discountMinor).toBe(1_000);
    expect(result.coupon.code).toBe("SAVE10");
  });

  it("caps fixed discount at subtotal", async () => {
    const uc = new ValidateCoupon(
      new FakeCouponRepo(makeCoupon({ type: "fixed", value: 50_000 })),
    );
    const result = await uc.execute({ code: "X", subtotalMinor: 5_000 });
    expect(result.discount.discountMinor).toBe(5_000);
  });

  it("throws NotFound when coupon missing", async () => {
    const uc = new ValidateCoupon(new FakeCouponRepo(null));
    await expect(
      uc.execute({ code: "NOPE", subtotalMinor: 100 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects when subtotal below minimum", async () => {
    const uc = new ValidateCoupon(
      new FakeCouponRepo(makeCoupon({ minSubtotalMinor: 5_000 })),
    );
    await expect(
      uc.execute({ code: "SAVE10", subtotalMinor: 1_000 }),
    ).rejects.toBeInstanceOf(PreconditionFailedError);
  });

  it("rejects when redemption limit reached", async () => {
    const uc = new ValidateCoupon(
      new FakeCouponRepo(makeCoupon({ maxRedemptions: 5, redeemedCount: 5 })),
    );
    await expect(
      uc.execute({ code: "SAVE10", subtotalMinor: 10_000 }),
    ).rejects.toBeInstanceOf(PreconditionFailedError);
  });
});
