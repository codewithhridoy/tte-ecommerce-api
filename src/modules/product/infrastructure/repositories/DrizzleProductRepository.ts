import { and, desc, eq, inArray, lt, or } from 'drizzle-orm'
import type { DbClient } from '@infra/db/client.js'
import { products, productVariants } from '@infra/db/schema/index.js'
import type {
  Product,
  ProductVariant,
  ProductWithVariants,
} from '../../domain/entities/Product.js'
import type {
  CreateProductDto,
  CreateProductVariantDto,
  ListProductsFilter,
  ListProductsPage,
  ProductRepository,
} from '../../domain/repositories/ProductRepository.js'

const toProduct = (row: typeof products.$inferSelect): Product => ({
  id: row.id,
  sku: row.sku,
  slug: row.slug,
  title: row.title,
  description: row.description,
  status: row.status,
  attributes: row.attributes,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const toVariant = (row: typeof productVariants.$inferSelect): ProductVariant => ({
  id: row.id,
  productId: row.productId,
  sku: row.sku,
  name: row.name,
  priceMinor: row.priceMinor,
  currency: row.currency,
  options: row.options,
  isActive: row.isActive,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly db: DbClient) {}

  async list(filter: ListProductsFilter): Promise<ListProductsPage> {
    const conditions = []
    if (filter.status) conditions.push(eq(products.status, filter.status))
    if (filter.cursor) {
      // (createdAt, id) < (cursor.createdAt, cursor.id) — keyset pagination
      conditions.push(
        or(
          lt(products.createdAt, filter.cursor.createdAt),
          and(eq(products.createdAt, filter.cursor.createdAt), lt(products.id, filter.cursor.id)),
        )!,
      )
    }

    const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions)

    const limit = filter.limit + 1
    const rows = await this.db
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(limit)

    const hasMore = rows.length > filter.limit
    const page = hasMore ? rows.slice(0, filter.limit) : rows
    if (page.length === 0) return { items: [] }

    const ids = page.map((p) => p.id)
    const variantRows = await this.db.select().from(productVariants).where(inArray(productVariants.productId, ids))

    const grouped = new Map<string, ProductVariant[]>()
    for (const v of variantRows) {
      const list = grouped.get(v.productId) ?? []
      list.push(toVariant(v))
      grouped.set(v.productId, list)
    }

    const items: ProductWithVariants[] = page.map((p) => ({
      ...toProduct(p),
      variants: grouped.get(p.id) ?? [],
    }))

    const last = page.at(-1)
    const nextCursor = hasMore && last ? { id: last.id, createdAt: last.createdAt } : undefined
    return nextCursor ? { items, nextCursor } : { items }
  }

  async findById(id: string): Promise<ProductWithVariants | null> {
    const [row] = await this.db.select().from(products).where(eq(products.id, id)).limit(1)
    if (!row) return null
    const variants = await this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, id))
    return { ...toProduct(row), variants: variants.map(toVariant) }
  }

  async findBySlug(slug: string): Promise<ProductWithVariants | null> {
    const [row] = await this.db.select().from(products).where(eq(products.slug, slug)).limit(1)
    if (!row) return null
    const variants = await this.db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, row.id))
    return { ...toProduct(row), variants: variants.map(toVariant) }
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const [row] = await this.db
      .insert(products)
      .values({
        id: dto.id,
        sku: dto.sku,
        slug: dto.slug,
        title: dto.title,
        description: dto.description ?? null,
        status: dto.status ?? 'draft',
        attributes: dto.attributes ?? {},
      })
      .returning()
    if (!row) throw new Error('Product insert returned no row')
    return toProduct(row)
  }

  async addVariant(dto: CreateProductVariantDto): Promise<ProductVariant> {
    const [row] = await this.db
      .insert(productVariants)
      .values({
        id: dto.id,
        productId: dto.productId,
        sku: dto.sku,
        name: dto.name,
        priceMinor: dto.priceMinor,
        currency: dto.currency ?? 'USD',
        options: dto.options ?? {},
      })
      .returning()
    if (!row) throw new Error('Variant insert returned no row')
    return toVariant(row)
  }

  async findVariantsByIds(ids: string[]): Promise<ProductVariant[]> {
    if (ids.length === 0) return []
    const rows = await this.db.select().from(productVariants).where(inArray(productVariants.id, ids))
    return rows.map(toVariant)
  }
}

