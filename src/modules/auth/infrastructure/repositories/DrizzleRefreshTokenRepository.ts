import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "@infra/db/client";
import { refreshTokens } from "@infra/db/schema/index";
import type { RefreshToken } from "../../domain/entities/RefreshToken";
import type {
  CreateRefreshTokenDto,
  RefreshTokenRepository,
} from "../../domain/repositories/RefreshTokenRepository";

const toEntity = (row: typeof refreshTokens.$inferSelect): RefreshToken => ({
  id: row.id,
  userId: row.userId,
  tokenHash: row.tokenHash,
  familyId: row.familyId,
  revokedAt: row.revokedAt,
  expiresAt: row.expiresAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: DbClient) {}

  async create(dto: CreateRefreshTokenDto): Promise<RefreshToken> {
    const [row] = await this.db
      .insert(refreshTokens)
      .values({
        id: dto.id,
        userId: dto.userId,
        tokenHash: dto.tokenHash,
        familyId: dto.familyId,
        expiresAt: dto.expiresAt,
      })
      .returning();
    if (!row) throw new Error("Refresh token insert returned no row");
    return toEntity(row);
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return row ? toEntity(row) : null;
  }

  async revokeById(id: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  }
}
