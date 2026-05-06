import { eq, inArray, sql } from "drizzle-orm";
import { db, type DbClient, type DbExecutor } from "@infra/db/client";
import { inventory, inventoryLedger } from "@infra/db/schema/index";
import { ConflictError, PreconditionFailedError } from "@shared/errors";
import { newId } from "@shared/id";
import type { InventoryRecord } from "../../domain/entities/Inventory";
import type {
  InventoryRepository,
  ReservationLine,
} from "../../domain/repositories/InventoryRepository";

const toRecord = (row: typeof inventory.$inferSelect): InventoryRecord => ({
  id: row.id,
  variantId: row.variantId,
  onHand: row.onHand,
  reserved: row.reserved,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class DrizzleInventoryRepository implements InventoryRepository {
  constructor(private readonly client: DbClient = db) {}

  async upsertOnHand(
    variantId: string,
    onHand: number,
  ): Promise<InventoryRecord> {
    const [row] = await this.client
      .insert(inventory)
      .values({ id: newId(), variantId, onHand })
      .onConflictDoUpdate({
        target: inventory.variantId,
        set: {
          onHand,
          updatedAt: new Date(),
          version: sql`${inventory.version} + 1`,
        },
      })
      .returning();
    if (!row) throw new Error("Inventory upsert returned no row");
    return toRecord(row);
  }

  async findByVariantIds(variantIds: string[]): Promise<InventoryRecord[]> {
    if (variantIds.length === 0) return [];
    const rows = await this.client
      .select()
      .from(inventory)
      .where(inArray(inventory.variantId, variantIds));
    return rows.map(toRecord);
  }

  async lockAndDeduct(
    tx: DbExecutor,
    lines: ReservationLine[],
    reason: string,
    reasonRef?: string,
  ): Promise<void> {
    if (lines.length === 0) return;
    const variantIds = lines.map((l) => l.variantId);

    // SELECT ... FOR UPDATE — acquires row-level locks in a deterministic order
    // (we sort by variantId) to avoid deadlocks across concurrent transactions.
    const sortedIds = [...variantIds].sort();
    const locked = await tx.execute<{
      id: string;
      variant_id: string;
      on_hand: number;
      reserved: number;
      version: number;
    }>(sql`
      SELECT id, variant_id, on_hand, reserved, version
      FROM ${inventory}
      WHERE ${inventory.variantId} IN (${sql.join(
        sortedIds.map((id) => sql`${id}`),
        sql`, `,
      )})
      ORDER BY ${inventory.variantId}
      FOR UPDATE
    `);

    const lockedRows = (
      Array.isArray(locked)
        ? locked
        : ((locked as { rows?: unknown[] }).rows ?? [])
    ) as Array<{
      id: string;
      variant_id: string;
      on_hand: number;
      reserved: number;
    }>;

    if (lockedRows.length !== variantIds.length) {
      const present = new Set(lockedRows.map((r) => r.variant_id));
      const missing = variantIds.filter((id) => !present.has(id));
      throw new ConflictError("Inventory record missing for variants", {
        missing,
      });
    }

    const byVariant = new Map(lockedRows.map((r) => [r.variant_id, r]));
    for (const line of lines) {
      const row = byVariant.get(line.variantId)!;
      const available = row.on_hand - row.reserved;
      if (line.quantity > available) {
        throw new PreconditionFailedError(
          `Insufficient stock for variant ${line.variantId}: requested ${line.quantity}, available ${available}`,
        );
      }
    }

    for (const line of lines) {
      await tx
        .update(inventory)
        .set({
          onHand: sql`${inventory.onHand} - ${line.quantity}`,
          version: sql`${inventory.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(inventory.variantId, line.variantId));

      await tx.insert(inventoryLedger).values({
        id: newId(),
        variantId: line.variantId,
        delta: -line.quantity,
        reason,
        reasonRef: reasonRef ?? null,
      });
    }
  }
}
