export interface RefreshToken {
  id: string
  userId: string
  tokenHash: string
  familyId: string
  revokedAt: Date | null
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}
