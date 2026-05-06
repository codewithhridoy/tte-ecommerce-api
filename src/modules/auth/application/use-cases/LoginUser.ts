import { z } from "zod";
import { UnauthenticatedError } from "@shared/errors";
import { newId } from "@shared/id";
import type { UserRepository } from "@modules/user/domain/repositories/UserRepository";
import type { PasswordHasher } from "../../domain/services/PasswordHasher";
import type { TokenService } from "../../domain/services/TokenService";
import type { RefreshTokenRepository } from "../../domain/repositories/RefreshTokenRepository";

export const LoginUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginUserInput = z.infer<typeof LoginUserInput>;

export interface LoginUserOutput {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export class LoginUser {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserOutput> {
    const user = await this.users.findByEmail(input.email);
    if (!user || !user.isActive)
      throw new UnauthenticatedError("Invalid credentials");

    const ok = await this.hasher.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthenticatedError("Invalid credentials");

    const accessToken = this.tokens.signAccess(user.id, user.role);
    const refresh = this.tokens.generateRefreshToken();
    await this.refreshTokens.create({
      id: newId(),
      userId: user.id,
      tokenHash: refresh.hash,
      familyId: newId(),
      expiresAt: refresh.expiresAt,
    });
    return {
      accessToken,
      refreshToken: refresh.raw,
      refreshExpiresAt: refresh.expiresAt,
    };
  }
}
