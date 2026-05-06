import { z } from "zod";
import { ConflictError } from "@shared/errors";
import { newId } from "@shared/id";
import type { User } from "@modules/user/domain/entities/User";
import type { UserRepository } from "@modules/user/domain/repositories/UserRepository";
import type { PasswordHasher } from "../../domain/services/PasswordHasher";

export const RegisterUserInput = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(200),
  fullName: z.string().min(1).max(200).optional(),
});
export type RegisterUserInput = z.infer<typeof RegisterUserInput>;

export interface RegisterUserOutput {
  user: User;
}

export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictError("Email already registered");

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      id: newId(),
      email: input.email,
      passwordHash,
      fullName: input.fullName ?? null,
    });
    return { user };
  }
}
