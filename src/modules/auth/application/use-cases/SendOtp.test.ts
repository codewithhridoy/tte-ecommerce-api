import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError, PreconditionFailedError } from '@shared/errors'
import { SendOtp } from './SendOtp.js'
import { OtpService } from '../../domain/services/OtpService.js'
import type { OtpToken, OtpPurpose } from '../../domain/entities/OtpToken.js'
import type { OtpTokenRepository, CreateOtpTokenDto } from '../../domain/repositories/OtpTokenRepository.js'
import type { User } from '@modules/user/index.js'
import type { UserRepository, CreateUserDto } from '@modules/user/index.js'
import type { UserWithSecret } from '@modules/user/index.js'
import type { OtpNotifier, OtpNotifyPayload } from '../../domain/services/OtpNotifier.js'

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'test@example.com',
  fullName: null,
  role: 'customer',
  isActive: true,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
})

class FakeUserRepo implements UserRepository {
  private readonly store: Map<string, User>

  constructor(users: User[] = []) {
    this.store = new Map(users.map((u) => [u.id, u]))
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null
  }

  async findByEmail(): Promise<UserWithSecret | null> {
    return null
  }

  async create(dto: CreateUserDto): Promise<User> {
    const user: User = { ...dto, role: dto.role ?? 'customer', fullName: dto.fullName ?? null, isActive: true, createdAt: new Date(), updatedAt: new Date() }
    this.store.set(user.id, user)
    return user
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const u = this.store.get(id)
    if (u) this.store.set(id, { ...u, isActive: active })
  }
}

const makeOtpToken = (overrides: Partial<OtpToken> = {}): OtpToken => ({
  id: 'otp-1',
  userId: 'user-1',
  codeHash: 'hash',
  purpose: 'email_verification',
  expiresAt: new Date(Date.now() + 600_000),
  usedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

class FakeOtpTokenRepo implements OtpTokenRepository {
  private readonly store: Map<string, OtpToken> = new Map()
  private latestActive: OtpToken | null = null

  setLatestActive(token: OtpToken | null): void {
    this.latestActive = token
  }

  async create(dto: CreateOtpTokenDto): Promise<OtpToken> {
    const token: OtpToken = {
      ...dto,
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.store.set(token.id, token)
    this.latestActive = token
    return token
  }

  async findLatestActive(_userId: string, _purpose: OtpPurpose): Promise<OtpToken | null> {
    return this.latestActive
  }

  async findActiveByHash(codeHash: string, userId: string, purpose: OtpPurpose): Promise<OtpToken | null> {
    for (const t of this.store.values()) {
      if (t.codeHash === codeHash && t.userId === userId && t.purpose === purpose && !t.usedAt) {
        return t
      }
    }
    return null
  }

  async markUsed(id: string): Promise<void> {
    const t = this.store.get(id)
    if (t) this.store.set(id, { ...t, usedAt: new Date() })
  }

  async revokeAllForUser(): Promise<void> {
    this.latestActive = null
  }
}

class FakeOtpNotifier implements OtpNotifier {
  readonly sent: OtpNotifyPayload[] = []
  async send(payload: OtpNotifyPayload): Promise<void> {
    this.sent.push(payload)
  }
}

// ---------------------------------------------------------------------------
// OtpService instance shared across tests
// ---------------------------------------------------------------------------

const otpService = new OtpService({
  codeLength: 6,
  ttlSeconds: 600,
  resendCooldownSeconds: 60,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SendOtp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('generates a 6-digit code and returns expiresAt + resendAllowedAt', async () => {
    const users = new FakeUserRepo([makeUser()])
    const otpTokens = new FakeOtpTokenRepo()
    const uc = new SendOtp(users, otpTokens, otpService, new FakeOtpNotifier())

    const result = await uc.execute({ userId: 'user-1', purpose: 'email_verification' })

    expect(result.code).toMatch(/^\d{6}$/)
    expect(result.expiresAt.getTime()).toBe(new Date('2024-06-01T12:10:00Z').getTime())
    expect(result.resendAllowedAt.getTime()).toBe(new Date('2024-06-01T12:01:00Z').getTime())
  })

  it('throws NotFoundError for unknown user', async () => {
    const uc = new SendOtp(new FakeUserRepo([]), new FakeOtpTokenRepo(), otpService, new FakeOtpNotifier())
    await expect(
      uc.execute({ userId: 'user-1', purpose: 'login' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws NotFoundError for inactive user', async () => {
    const uc = new SendOtp(
      new FakeUserRepo([makeUser({ isActive: false })]),
      new FakeOtpTokenRepo(),
      otpService,
      new FakeOtpNotifier(),
    )
    await expect(
      uc.execute({ userId: 'user-1', purpose: 'login' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws PreconditionFailedError when resend cooldown is active', async () => {
    const users = new FakeUserRepo([makeUser()])
    const otpTokens = new FakeOtpTokenRepo()
    // Existing OTP created 30 s ago — still within 60 s cooldown
    otpTokens.setLatestActive(
      makeOtpToken({ createdAt: new Date('2024-06-01T11:59:30Z') }),
    )
    const uc = new SendOtp(users, otpTokens, otpService, new FakeOtpNotifier())

    await expect(
      uc.execute({ userId: 'user-1', purpose: 'email_verification' }),
    ).rejects.toBeInstanceOf(PreconditionFailedError)
  })

  it('issues a new OTP when cooldown has elapsed', async () => {
    const users = new FakeUserRepo([makeUser()])
    const otpTokens = new FakeOtpTokenRepo()
    // Existing OTP created 90 s ago — cooldown expired
    otpTokens.setLatestActive(
      makeOtpToken({ createdAt: new Date('2024-06-01T11:58:30Z') }),
    )
    const uc = new SendOtp(users, otpTokens, otpService, new FakeOtpNotifier())

    const result = await uc.execute({ userId: 'user-1', purpose: 'email_verification' })
    expect(result.code).toMatch(/^\d{6}$/)
  })

  it('works for all supported purposes', async () => {
    const purposes = ['email_verification', 'login', 'password_reset'] as const
    for (const purpose of purposes) {
      const uc = new SendOtp(new FakeUserRepo([makeUser()]), new FakeOtpTokenRepo(), otpService, new FakeOtpNotifier())
      const result = await uc.execute({ userId: 'user-1', purpose })
      expect(result.code).toMatch(/^\d{6}$/)
    }
  })
})
