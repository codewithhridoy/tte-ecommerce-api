import { z } from 'zod'
import type { CachePort } from '@infra/cache/redis.js'
import { decodeCursor, encodeCursor } from '@shared/types.js'
import type { ProductWithVariants } from '../../domain/entities/Product.js'
import type { ProductRepository } from '../../domain/repositories/ProductRepository.js'

export const ListProductsInput = z.object({
  status: z.enum(['draft', 'active', 'archived']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListProductsInput = z.infer<typeof ListProductsInput>

export interface ListProductsOutput {
  items: ProductWithVariants[]
  nextCursor?: string
  hasMore: boolean
  limit: number
}

const CACHE_TTL = 60
const CACHE_PREFIX = 'product:list:'

export class ListProducts {
  constructor(
    private readonly products: ProductRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(input: ListProductsInput): Promise<ListProductsOutput> {
    const cacheKey = `${CACHE_PREFIX}${input.status ?? 'any'}:${input.limit}:${input.cursor ?? 'start'}`
    const cached = await this.cache.get<ListProductsOutput>(cacheKey)
    if (cached) return cached

    const decoded = input.cursor ? decodeCursor(input.cursor) : null
    const cursorObj = decoded ? { id: decoded.id, createdAt: new Date(decoded.createdAt) } : undefined

    const page = await this.products.list({
      ...(input.status !== undefined ? { status: input.status } : {}),
      cursor: cursorObj,
      limit: input.limit,
    })

    const result: ListProductsOutput = {
      items: page.items,
      hasMore: !!page.nextCursor,
      limit: input.limit,
      ...(page.nextCursor
        ? { nextCursor: encodeCursor({ id: page.nextCursor.id, createdAt: page.nextCursor.createdAt.toISOString() }) }
        : {}),
    }
    await this.cache.set(cacheKey, result, CACHE_TTL)
    return result
  }
}
