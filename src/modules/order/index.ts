import type { RequestHandler, Router } from "express";
import { db } from "@infra/db/client";
import { DrizzleOrderRepository } from "./infrastructure/repositories/DrizzleOrderRepository";
import { DrizzleIdempotencyRepository } from "./infrastructure/repositories/DrizzleIdempotencyRepository";
import { CreateOrder } from "./application/use-cases/CreateOrder";
import { OrderController } from "./interfaces/http/OrderController";
import { orderRoutes } from "./interfaces/http/routes";
import type { CartRepository } from "@modules/cart/index";
import type { ProductRepository } from "@modules/product/index";
import type { InventoryRepository } from "@modules/inventory/index";
import type { ValidateCoupon } from "@modules/discount/index";

export interface OrderModuleDeps {
  cartRepository: CartRepository;
  productRepository: ProductRepository;
  inventoryRepository: InventoryRepository;
  validateCoupon: ValidateCoupon;
  requireAuth: RequestHandler;
}

export interface OrderModule {
  routes: Router;
  createOrder: CreateOrder;
}

export const buildOrderModule = (deps: OrderModuleDeps): OrderModule => {
  const orderRepo = new DrizzleOrderRepository(db);
  const idemRepo = new DrizzleIdempotencyRepository(db);
  const createOrder = new CreateOrder(
    orderRepo,
    deps.cartRepository,
    deps.productRepository,
    deps.inventoryRepository,
    idemRepo,
    deps.validateCoupon,
  );
  const controller = new OrderController(createOrder);
  return { routes: orderRoutes(controller, deps.requireAuth), createOrder };
};

export type { Order, OrderItem } from "./domain/entities/Order";
export type { OrderStatus } from "./domain/value-objects/OrderStatus";
export type { OrderRepository } from "./domain/repositories/OrderRepository";
