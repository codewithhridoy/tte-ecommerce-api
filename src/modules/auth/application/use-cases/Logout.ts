import { z } from "zod";
import type { RefreshTokenRepository } from "../../domain/repositories/RefreshTokenRepository";
import { TokenService } from "../../domain/services/TokenService";

export const LogoutInput = z.object({ refreshToken: z.string().min(10) });
export type LogoutInput = z.infer<typeof LogoutInput>;

export class Logout {
  constructor(private readonly refreshTokens: RefreshTokenRepository) {}

  async execute(input: LogoutInput): Promise<void> {
    const stored = await this.refreshTokens.findByHash(
      TokenService.hash(input.refreshToken),
    );
    if (stored && !stored.revokedAt) {
      await this.refreshTokens.revokeFamily(stored.familyId);
    }
  }
}
