import type { Request, Response } from "express";
import { UnauthenticatedError } from "@shared/errors";
import { ok } from "@shared/http/response";
import {
  ValidateCredentialsInput,
  type ValidateCredentials,
} from "../../application/use-cases/ValidateCredentials";
import {
  CompleteLoginWithOtpInput,
  type CompleteLoginWithOtp,
} from "../../application/use-cases/CompleteLoginWithOtp";
import type { LoginUser } from "../../application/use-cases/LoginUser";
import {
  RegisterUserInput,
  type RegisterUser,
} from "../../application/use-cases/RegisterUser";
import type { RefreshSession } from "../../application/use-cases/RefreshSession";
import type { Logout } from "../../application/use-cases/Logout";
import {
  SendOtpInput,
  type SendOtp,
} from "../../application/use-cases/SendOtp";
import {
  VerifyOtpInput,
  type VerifyOtp,
} from "../../application/use-cases/VerifyOtp";
import {
  COOKIE_REFRESH,
  clearAuthCookies,
  setAuthCookies,
} from "./helpers/cookies";

export class AuthController {
  constructor(
    private readonly registerUser: RegisterUser,
    private readonly loginUser: LoginUser,
    private readonly refresh: RefreshSession,
    private readonly logout: Logout,
    private readonly sendOtpUseCase: SendOtp,
    private readonly verifyOtpUseCase: VerifyOtp,
    private readonly validateCredentials: ValidateCredentials,
    private readonly completeLoginWithOtpUseCase: CompleteLoginWithOtp,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const input = RegisterUserInput.parse(req.body);
    const { user } = await this.registerUser.execute(input);
    const tokens = await this.loginUser.execute({
      email: input.email,
      password: input.password,
    });
    setAuthCookies(res, tokens);
    res.status(201).json(
      ok({
        user,
        accessToken: tokens.accessToken,
        refreshExpiresAt: tokens.refreshExpiresAt.toISOString(),
      }),
    );
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const input = ValidateCredentialsInput.parse(req.body);
    const { userId } = await this.validateCredentials.execute(input);
    const { resendAllowedAt } = await this.sendOtpUseCase.execute({ userId, purpose: "login" });
    res.status(200).json(ok({ requiresOtp: true, userId, resendAllowedAt: resendAllowedAt.toISOString() }));
  };

  completeLoginWithOtp = async (req: Request, res: Response): Promise<void> => {
    const input = CompleteLoginWithOtpInput.parse(req.body);
    const tokens = await this.completeLoginWithOtpUseCase.execute(input);
    setAuthCookies(res, tokens);
    res.status(200).json(
      ok({
        accessToken: tokens.accessToken,
        refreshExpiresAt: tokens.refreshExpiresAt.toISOString(),
      }),
    );
  };

  refreshSession = async (req: Request, res: Response): Promise<void> => {
    const cookieToken = req.cookies?.[COOKIE_REFRESH] as string | undefined;
    const bodyToken = req.body?.refreshToken as string | undefined;
    const refreshToken = cookieToken ?? bodyToken;
    if (!refreshToken) throw new UnauthenticatedError("Refresh token required");

    const result = await this.refresh.execute({ refreshToken });
    setAuthCookies(res, result);
    res.status(200).json(
      ok({
        accessToken: result.accessToken,
        refreshExpiresAt: result.refreshExpiresAt.toISOString(),
      }),
    );
  };

  logoutSession = async (req: Request, res: Response): Promise<void> => {
    const cookieToken = req.cookies?.[COOKIE_REFRESH] as string | undefined;
    const bodyToken = req.body?.refreshToken as string | undefined;
    const refreshToken = cookieToken ?? bodyToken;
    if (refreshToken) {
      await this.logout.execute({ refreshToken });
    }
    clearAuthCookies(res);
    res.status(204).send();
  };

  sendOtp = async (req: Request, res: Response): Promise<void> => {
    const input = SendOtpInput.parse({
      userId: req.auth!.userId,
      purpose: req.body.purpose,
    });
    const result = await this.sendOtpUseCase.execute(input);
    res.status(200).json(
      ok({
        expiresAt: result.expiresAt.toISOString(),
        resendAllowedAt: result.resendAllowedAt.toISOString(),
      }),
    );
  };

  verifyOtp = async (req: Request, res: Response): Promise<void> => {
    const input = VerifyOtpInput.parse(req.body);
    await this.verifyOtpUseCase.execute(input);
    res.status(200).json(ok({ verified: true }));
  };
}
