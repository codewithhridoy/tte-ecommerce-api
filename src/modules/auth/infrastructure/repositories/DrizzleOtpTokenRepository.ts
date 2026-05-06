import { and, eq, gt, isNull } from 'drizzle-orm'
import type { DbClient } from '@infra/db/client'
import { otpTokens } from '@infra/db/schema/index'
import type { OtpToken, OtpPurpose } from '../../domain/entities/OtpToken.js'
import type {
  CreateOtpTokenDto,
  OtpTokenRepository,
} from '../../domain/repositories/OtpTokenRepository.js'

const toEntity = (row: typeof otpTokens.$inferSelect): OtpToken => ({
  id: row.id,
  userId: row.userId,
  codeHash: row.codeHash,
  purpose: row.purpose as OtpPurpose,
  expiresAt: row.expiresAt,
  usedAt: row.usedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export class DrizzleOtpTokenRepository implements OtpTokenRepository {
  constructor(private readonly db: DbClient) {}

  async create(dto: CreateOtpTokenDto): Promise<OtpToken> {
    const [row] = await this.db
      .insert(otpTokens)
      .values({
        id: dto.id,
        userId: dto.userId,
        codeHash: dto.codeHash,
        purpose: dto.purpose,
        expiresAt: dto.expiresAt,
      })
      .returning()
    if (!row) throw new Error('OTP token insert returned no row')
    return toEntity(row)
  }

  async findLatestActive(userId: string, purpose: OtpPurpose): Promise<OtpToken | null> {
    const [row] = await this.db
      .select()
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.userId, userId),
          eq(otpTokens.purpose, purpose),
          isNull(otpTokens.usedAt),
          gt(otpTokens.expiresAt, new Date()),
        ),
      )
      .orderBy(otpTokens.createdAt)
      .limit(1)
    return row ? toEntity(row) : null
  }

  async findActiveByHash(codeHash: string, userId: string, purpose: OtpPurpose): Promise<OtpToken | null> {
    const [row] = await this.db
      .select()
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.codeHash, codeHash),
          eq(otpTokens.userId, userId),
          eq(otpTokens.purpose, purpose),
          isNull(otpTokens.usedAt),
        ),
      )
      .limit(1)
    return row ? toEntity(row) : null
  }

  async markUsed(id: string): Promise<void> {
    await this.db
      .update(otpTokens)
      .set({ usedAt: new Date() })
      .where(eq(otpTokens.id, id))
  }

  async revokeAllForUser(userId: string, purpose: OtpPurpose): Promise<void> {
    await this.db
      .update(otpTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(otpTokens.userId, userId),
          eq(otpTokens.purpose, purpose),
          isNull(otpTokens.usedAt),
        ),
      )
  }
}
