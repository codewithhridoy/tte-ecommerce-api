import { createHash, randomInt } from 'node:crypto'

export interface OtpServiceConfig {
  /** Length of the numeric OTP code. Default 6. */
  codeLength: number
  /** How long an OTP is valid, in seconds. Default 600 (10 min). */
  ttlSeconds: number
  /** Minimum gap before a new OTP can be issued for the same user+purpose, in seconds. Default 60. */
  resendCooldownSeconds: number
}

export class OtpService {
  constructor(private readonly cfg: OtpServiceConfig) {}

  generate(): { code: string; hash: string; expiresAt: Date } {
    const max = 10 ** this.cfg.codeLength
    const code = String(randomInt(0, max)).padStart(this.cfg.codeLength, '0')
    const hash = OtpService.hash(code)
    const expiresAt = new Date(Date.now() + this.cfg.ttlSeconds * 1000)
    return { code, hash, expiresAt }
  }

  verify(code: string, storedHash: string): boolean {
    return OtpService.hash(code) === storedHash
  }

  resendAllowedAt(lastCreatedAt: Date): Date {
    return new Date(lastCreatedAt.getTime() + this.cfg.resendCooldownSeconds * 1000)
  }

  static hash(code: string): string {
    return createHash('sha256').update(code).digest('hex')
  }
}
