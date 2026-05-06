import { Router, type RequestHandler } from "express";
import { asyncHandler } from "@shared/http/async-handler";
import type { CartController } from "./CartController";

export const cartRoutes = (
  controller: CartController,
  optionalAuth: RequestHandler,
): Router => {
  const r = Router();
  r.post("/items", optionalAuth, asyncHandler(controller.add));
  r.post(
    "/:cartId/coupon",
    optionalAuth,
    asyncHandler(controller.applyCouponHandler),
  );
  return r;
};
