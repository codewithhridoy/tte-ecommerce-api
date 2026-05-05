import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { UserRole } from '@modules/user/domain/entities/User.js'

export interface AccessTokenClaims {
  sub: string
  role: UserRole
  iat: number
  exp: number
}

export interface TokenServiceConfig {
  accessSecret: string
  refreshSecret: string
  accessTtlSeconds: number
  refreshTtlSeconds: number
}

export class TokenService {
  constructor(private readonly cfg: TokenServiceConfig) {}

  signAccess(userId: string, role: UserRole): string {
    return jwt.sign({ sub: userId, role }, this.cfg.accessSecret, {
      expiresIn: this.cfg.accessTtlSeconds,
    })
  }

  verifyAccess(token: string): AccessTokenClaims {
    return jwt.verify(token, this.cfg.accessSecret) as AccessTokenClaims
  }

  generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
    const raw = randomBytes(48).toString('base64url')
    const hash = TokenService.hash(raw)
    const expiresAt = new Date(Date.now() + this.cfg.refreshTtlSeconds * 1000)
    return { raw, hash, expiresAt }
  }

  static hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex')
  }
}
