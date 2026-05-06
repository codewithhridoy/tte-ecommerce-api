import { Router } from "express";
import { asyncHandler } from "@shared/http/async-handler";
import { authRateLimiter } from "@shared/http/middleware/rate-limit";
import type { TokenService } from "../../domain/services/TokenService";
import { authenticate } from "./middleware/authenticate";
import type { AuthController } from "./AuthController";

export const authRoutes = (
  controller: AuthController,
  tokenService: TokenService,
): Router => {
  const r = Router();
  const requireAuth = authenticate(tokenService);

  r.post("/register", authRateLimiter, asyncHandler(controller.register));
  r.post("/login", authRateLimiter, asyncHandler(controller.login));
  r.post("/refresh", asyncHandler(controller.refreshSession));
  r.post("/logout", asyncHandler(controller.logoutSession));

  // OTP — send requires a session (userId comes from req.auth).
  // Verify and complete-login are public: user may not have a session yet.
  r.post("/otp/send", authRateLimiter, requireAuth, asyncHandler(controller.sendOtp));
  r.post("/otp/verify", authRateLimiter, asyncHandler(controller.verifyOtp));
  r.post("/otp/complete-login", authRateLimiter, asyncHandler(controller.completeLoginWithOtp));

  return r;
};
