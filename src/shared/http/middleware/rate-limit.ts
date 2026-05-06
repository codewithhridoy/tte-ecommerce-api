import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "@infra/cache/redis";
import { ENV } from "@shared/env";
import { fail } from "@shared/http/response";

export const apiRateLimiter = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  limit: ENV.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) =>
      redis.call(...(args as [string, ...string[]])) as unknown as Promise<import("rate-limit-redis").RedisReply>,
    prefix: "rl:api:",
  }),
  handler: (_req, res) => {
    res.status(429).json(fail("RATE_LIMITED", "Too many requests"));
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 5 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) =>
      redis.call(...(args as [string, ...string[]])) as unknown as Promise<import("rate-limit-redis").RedisReply>,
    prefix: "rl:auth:",
  }),
  handler: (_req, res) => {
    res
      .status(429)
      .json(fail("RATE_LIMITED", "Too many authentication attempts"));
  },
});
