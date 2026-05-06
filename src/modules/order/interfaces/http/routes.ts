import { Router, type RequestHandler } from "express";
import { asyncHandler } from "@shared/http/async-handler";
import type { OrderController } from "./OrderController";

export const orderRoutes = (
  controller: OrderController,
  requireAuth: RequestHandler,
): Router => {
  const r = Router();
  r.post("/", requireAuth, asyncHandler(controller.create));
  return r;
};
