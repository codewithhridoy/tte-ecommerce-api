import { z } from "zod";
import { NotFoundError } from "@shared/errors";
import type { CachePort } from "@infra/cache/redis";
import type { ProductWithVariants } from "../../domain/entities/Product";
import type { ProductRepository } from "../../domain/repositories/ProductRepository";

export const GetProductInput = z.object({
  idOrSlug: z.string().min(1),
});
export type GetProductInput = z.infer<typeof GetProductInput>;

const CACHE_TTL = 120;
const CACHE_PREFIX = "product:detail:";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class GetProduct {
  constructor(
    private readonly products: ProductRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(input: GetProductInput): Promise<ProductWithVariants> {
    const key = `${CACHE_PREFIX}${input.idOrSlug}`;
    const cached = await this.cache.get<ProductWithVariants>(key);
    if (cached) return cached;

    const isId = UUID_RE.test(input.idOrSlug);
    const found = isId
      ? await this.products.findById(input.idOrSlug)
      : await this.products.findBySlug(input.idOrSlug);
    if (!found) throw new NotFoundError("Product");

    await this.cache.set(key, found, CACHE_TTL);
    return found;
  }
}
