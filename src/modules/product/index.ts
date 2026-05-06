import type { Router } from "express";
import { db } from "@infra/db/client";
import { redisCache } from "@infra/cache/redis";
import { DrizzleProductRepository } from "./infrastructure/repositories/DrizzleProductRepository";
import { ListProducts } from "./application/use-cases/ListProducts";
import { GetProduct } from "./application/use-cases/GetProduct";
import { ProductController } from "./interfaces/http/ProductController";
import { productRoutes } from "./interfaces/http/routes";
import type { ProductRepository } from "./domain/repositories/ProductRepository";

export interface ProductModule {
  routes: Router;
  productRepository: ProductRepository;
}

export const buildProductModule = (): ProductModule => {
  const productRepository = new DrizzleProductRepository(db);
  const controller = new ProductController(
    new ListProducts(productRepository, redisCache),
    new GetProduct(productRepository, redisCache),
  );
  return { routes: productRoutes(controller), productRepository };
};

export type { ProductRepository } from "./domain/repositories/ProductRepository";
export type {
  Product,
  ProductVariant,
  ProductWithVariants,
} from "./domain/entities/Product";
