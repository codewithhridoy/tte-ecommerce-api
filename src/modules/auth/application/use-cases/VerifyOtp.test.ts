import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError, UnauthenticatedError } from '@shared/errors'
import { VerifyOtp } from './VerifyOtp.js'
import { OtpService } from '../../domain/services/OtpService.js'
import type { OtpToken, OtpPurpose } from '../../domain/entities/OtpToken.js'
import type { OtpTokenRepository, CreateOtpTokenDto } from '../../domain/repositories/OtpTokenRepository.js'
import type { User, UserRepository, CreateUserDto, UserWithSecret } from '@modules/user/index.js'

// ---------------------------------------------------------------------------
// Fakes (same shape as SendOtp.test.ts — each test file owns its own copies)
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
  codeHash: OtpService.hash('123456'),
  purpose: 'email_verification',
  expiresAt: new Date(Date.now() + 600_000),
  usedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

class FakeOtpTokenRepo implements OtpTokenRepository {
  private readonly store: Map<string, OtpToken> = new Map()
  readonly markedUsed: string[] = []

  seed(token: OtpToken): void {
    this.store.set(token.id, token)
  }

  async create(dto: CreateOtpTokenDto): Promise<OtpToken> {
    const token: OtpToken = { ...dto, usedAt: null, createdAt: new Date(), updatedAt: new Date() }
    this.store.set(token.id, token)
    return token
  }

  async findLatestActive(): Promise<OtpToken | null> {
    return null
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
    this.markedUsed.push(id)
  }

  async revokeAllForUser(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VerifyOtp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks the token used and returns verified:true for a valid code', async () => {
    const repo = new FakeOtpTokenRepo()
    repo.seed(makeOtpToken())
    const uc = new VerifyOtp(new FakeUserRepo([makeUser()]), repo)

    const result = await uc.execute({ userId: 'user-1', purpose: 'email_verification', code: '123456' })

    expect(result.verified).toBe(true)
    expect(repo.markedUsed).toContain('otp-1')
  })

  it('throws UnauthenticatedError for a wrong code', async () => {
    const repo = new FakeOtpTokenRepo()
    repo.seed(makeOtpToken())
    const uc = new VerifyOtp(new FakeUserRepo([makeUser()]), repo)

    await expect(
      uc.execute({ userId: 'user-1', purpose: 'email_verification', code: '000000' }),
    ).rejects.toBeInstanceOf(UnauthenticatedError)
  })

  it('throws UnauthenticatedError for an expired token', async () => {
    const repo = new FakeOtpTokenRepo()
    repo.seed(makeOtpToken({ expiresAt: new Date('2024-06-01T11:50:00Z') }))
    const uc = new VerifyOtp(new FakeUserRepo([makeUser()]), repo)

    // Token exists in store but expiresAt is in the past
    // findActiveByHash will still return it (fake doesn't filter by time),
    // so the use case itself must reject it.
    await expect(
      uc.execute({ userId: 'user-1', purpose: 'email_verification', code: '123456' }),
    ).rejects.toBeInstanceOf(UnauthenticatedError)
  })

  it('throws UnauthenticatedError for an already-used token', async () => {
    const repo = new FakeOtpTokenRepo()
    repo.seed(makeOtpToken({ usedAt: new Date('2024-06-01T11:55:00Z') }))
    const uc = new VerifyOtp(new FakeUserRepo([makeUser()]), repo)

    await expect(
      uc.execute({ userId: 'user-1', purpose: 'email_verification', code: '123456' }),
    ).rejects.toBeInstanceOf(UnauthenticatedError)
  })

  it('throws NotFoundError for unknown user', async () => {
    const uc = new VerifyOtp(new FakeUserRepo([]), new FakeOtpTokenRepo())
    await expect(
      uc.execute({ userId: 'user-1', purpose: 'login', code: '123456' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws NotFoundError for inactive user', async () => {
    const uc = new VerifyOtp(
      new FakeUserRepo([makeUser({ isActive: false })]),
      new FakeOtpTokenRepo(),
    )
    await expect(
      uc.execute({ userId: 'user-1', purpose: 'login', code: '123456' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('rejects a valid code submitted for the wrong purpose', async () => {
    const repo = new FakeOtpTokenRepo()
    repo.seed(makeOtpToken({ purpose: 'email_verification' }))
    const uc = new VerifyOtp(new FakeUserRepo([makeUser()]), repo)

    await expect(
      uc.execute({ userId: 'user-1', purpose: 'login', code: '123456' }),
    ).rejects.toBeInstanceOf(UnauthenticatedError)
  })
})
