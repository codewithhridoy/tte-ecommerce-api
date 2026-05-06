import type { OtpToken, OtpPurpose } from '../entities/OtpToken.js'

export interface CreateOtpTokenDto {
  id: string
  userId: string
  codeHash: string
  purpose: OtpPurpose
  expiresAt: Date
}

export interface OtpTokenRepository {
  create(dto: CreateOtpTokenDto): Promise<OtpToken>
  findLatestActive(userId: string, purpose: OtpPurpose): Promise<OtpToken | null>
  findActiveByHash(codeHash: string, userId: string, purpose: OtpPurpose): Promise<OtpToken | null>
  markUsed(id: string): Promise<void>
  revokeAllForUser(userId: string, purpose: OtpPurpose): Promise<void>
}
