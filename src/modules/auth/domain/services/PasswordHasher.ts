import argon2 from 'argon2'

export interface PasswordHasher {
  hash(plain: string): Promise<string>
  verify(hash: string, plain: string): Promise<boolean>
}

export const argon2Hasher: PasswordHasher = {
  hash: (plain) => argon2.hash(plain, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }),
  verify: (hash, plain) => argon2.verify(hash, plain),
}
