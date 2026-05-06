import { z } from 'zod'
import { NotFoundError, UnauthenticatedError } from '@shared/errors'
import { newId } from '@shared/id'
import type { UserRepository } from '@modules/user/index.js'
import type { RefreshTokenRepository } from '../../domain/repositories/RefreshTokenRepository.js'
import type { OtpTokenRepository } from '../../domain/repositories/OtpTokenRepository.js'
import type { TokenService } from '../../domain/services/TokenService.js'
import { OtpService } from '../../domain/services/OtpService.js'
import type { LoginUserOutput } from './LoginUser.js'

export const CompleteLoginWithOtpInput = z.object({
  userId: z.string().uuid(),
  code: z.string().min(4).max(10),
})
export type CompleteLoginWithOtpInput = z.infer<typeof CompleteLoginWithOtpInput>

export class CompleteLoginWithOtp {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly otpTokens: OtpTokenRepository,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: CompleteLoginWithOtpInput): Promise<LoginUserOutput> {
    const user = await this.users.findById(input.userId)
    if (!user || !user.isActive) throw new NotFoundError('User')

    const codeHash = OtpService.hash(input.code)
    const token = await this.otpTokens.findActiveByHash(codeHash, input.userId, 'login')
    if (!token || token.expiresAt < new Date())
      throw new UnauthenticatedError('Invalid or expired OTP')

    await this.otpTokens.markUsed(token.id)

    const accessToken = this.tokens.signAccess(user.id, user.role)
    const refresh = this.tokens.generateRefreshToken()
    await this.refreshTokens.create({
      id: newId(),
      userId: user.id,
      tokenHash: refresh.hash,
      familyId: newId(),
      expiresAt: refresh.expiresAt,
    })
    return { accessToken, refreshToken: refresh.raw, refreshExpiresAt: refresh.expiresAt }
  }
}
