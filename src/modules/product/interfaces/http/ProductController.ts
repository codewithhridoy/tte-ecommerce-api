import type { Request, Response } from "express";
import { ok } from "@shared/http/response";
import {
  GetProductInput,
  type GetProduct,
} from "../../application/use-cases/GetProduct";
import {
  ListProductsInput,
  type ListProducts,
} from "../../application/use-cases/ListProducts";

export class ProductController {
  constructor(
    private readonly listProducts: ListProducts,
    private readonly getProduct: GetProduct,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const input = ListProductsInput.parse(req.query);
    const result = await this.listProducts.execute(input);
    res.status(200).json(
      ok(result.items, {
        hasMore: result.hasMore,
        limit: result.limit,
        ...(result.nextCursor !== undefined
          ? { nextCursor: result.nextCursor }
          : {}),
      }),
    );
  };

  detail = async (req: Request, res: Response): Promise<void> => {
    const input = GetProductInput.parse({ idOrSlug: req.params.idOrSlug });
    const product = await this.getProduct.execute(input);
    res.status(200).json(ok(product));
  };
}
