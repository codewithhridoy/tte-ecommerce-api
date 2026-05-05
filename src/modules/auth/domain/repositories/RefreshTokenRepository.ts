import type { RefreshToken } from '../entities/RefreshToken.js'

export interface CreateRefreshTokenDto {
  id: string
  userId: string
  tokenHash: string
  familyId: string
  expiresAt: Date
}

export interface RefreshTokenRepository {
  create(dto: CreateRefreshTokenDto): Promise<RefreshToken>
  findByHash(tokenHash: string): Promise<RefreshToken | null>
  revokeById(id: string): Promise<void>
  revokeFamily(familyId: string): Promise<void>
}
