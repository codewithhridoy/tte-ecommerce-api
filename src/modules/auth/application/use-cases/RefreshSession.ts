import { z } from 'zod'
import { UnauthenticatedError } from '@shared/errors.js'
import { newId } from '@shared/id.js'
import type { UserRepository } from '@modules/user/domain/repositories/UserRepository.js'
import type { RefreshTokenRepository } from '../../domain/repositories/RefreshTokenRepository.js'
import { TokenService } from '../../domain/services/TokenService.js'

export const RefreshSessionInput = z.object({ refreshToken: z.string().min(10) })
export type RefreshSessionInput = z.infer<typeof RefreshSessionInput>

export interface RefreshSessionOutput {
  accessToken: string
  refreshToken: string
  refreshExpiresAt: Date
}

export class RefreshSession {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: RefreshSessionInput): Promise<RefreshSessionOutput> {
    const presented = TokenService.hash(input.refreshToken)
    const stored = await this.refreshTokens.findByHash(presented)
    if (!stored) throw new UnauthenticatedError('Invalid refresh token')

    if (stored.revokedAt) {
      // Reuse detected: revoke the entire family.
      await this.refreshTokens.revokeFamily(stored.familyId)
      throw new UnauthenticatedError('Refresh token reuse detected; session terminated')
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthenticatedError('Refresh token expired')
    }

    const user = await this.users.findById(stored.userId)
    if (!user || !user.isActive) throw new UnauthenticatedError('User unavailable')

    // Rotate: revoke old, issue new in same family.
    await this.refreshTokens.revokeById(stored.id)
    const next = this.tokens.generateRefreshToken()
    await this.refreshTokens.create({
      id: newId(),
      userId: user.id,
      tokenHash: next.hash,
      familyId: stored.familyId,
      expiresAt: next.expiresAt,
    })

    return {
      accessToken: this.tokens.signAccess(user.id, user.role),
      refreshToken: next.raw,
      refreshExpiresAt: next.expiresAt,
    }
  }
}
