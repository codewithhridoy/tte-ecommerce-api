import type { Request, Response } from "express";
import { ok } from "@shared/http/response";
import {
  LoginUserInput,
  type LoginUser,
} from "../../application/use-cases/LoginUser";
import {
  RegisterUserInput,
  type RegisterUser,
} from "../../application/use-cases/RegisterUser";
import {
  RefreshSessionInput,
  type RefreshSession,
} from "../../application/use-cases/RefreshSession";
import { LogoutInput, type Logout } from "../../application/use-cases/Logout";

export class AuthController {
  constructor(
    private readonly registerUser: RegisterUser,
    private readonly loginUser: LoginUser,
    private readonly refresh: RefreshSession,
    private readonly logout: Logout,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const input = RegisterUserInput.parse(req.body);
    const result = await this.registerUser.execute(input);
    res.status(201).json(ok({ user: result.user }));
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const input = LoginUserInput.parse(req.body);
    const result = await this.loginUser.execute(input);
    res.status(200).json(
      ok({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        refreshExpiresAt: result.refreshExpiresAt.toISOString(),
      }),
    );
  };

  refreshSession = async (req: Request, res: Response): Promise<void> => {
    const input = RefreshSessionInput.parse(req.body);
    const result = await this.refresh.execute(input);
    res.status(200).json(
      ok({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        refreshExpiresAt: result.refreshExpiresAt.toISOString(),
      }),
    );
  };

  logoutSession = async (req: Request, res: Response): Promise<void> => {
    const input = LogoutInput.parse(req.body);
    await this.logout.execute(input);
    res.status(204).send();
  };
}
