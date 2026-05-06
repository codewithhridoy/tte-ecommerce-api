import { z } from "zod";
import { registry } from "@shared/http/openapi/registry";

const TAG = "Auth";

const RegisterBody = z
  .object({
    email: z.string().email().max(320).openapi({ example: "user@example.com" }),
    password: z.string().min(10).max(200).openapi({ example: "s3cur3p@ssw0rd" }),
    fullName: z.string().min(1).max(200).optional().openapi({ example: "Jane Doe" }),
  })
  .openapi("RegisterBody");

const LoginBody = z
  .object({
    email: z.string().email().openapi({ example: "user@example.com" }),
    password: z.string().min(1).openapi({ example: "s3cur3p@ssw0rd" }),
  })
  .openapi("LoginBody");

const RefreshBody = z
  .object({
    refreshToken: z.string().min(10).openapi({ example: "<refresh-token>" }),
  })
  .openapi("RefreshBody");

const LogoutBody = z
  .object({
    refreshToken: z.string().min(10).openapi({ example: "<refresh-token>" }),
  })
  .openapi("LogoutBody");

const TokenResponse = z
  .object({
    success: z.literal(true),
    data: z.object({
      accessToken: z.string().openapi({ example: "eyJ..." }),
      refreshToken: z.string().openapi({ example: "<opaque-token>" }),
      refreshExpiresAt: z.string().datetime().openapi({ example: "2026-05-08T12:00:00.000Z" }),
    }),
  })
  .openapi("TokenResponse");

const UserResponse = z
  .object({
    success: z.literal(true),
    data: z.object({
      user: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        fullName: z.string().nullable(),
        role: z.enum(["customer", "staff", "admin"]),
        isActive: z.boolean(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      }),
    }),
  })
  .openapi("UserResponse");

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: [TAG],
  summary: "Register a new account",
  request: {
    body: { content: { "application/json": { schema: RegisterBody } }, required: true },
  },
  responses: {
    201: {
      description: "Account created",
      content: { "application/json": { schema: UserResponse } },
    },
    400: { description: "Validation error" },
    409: { description: "Email already registered" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: [TAG],
  summary: "Authenticate and obtain tokens",
  request: {
    body: { content: { "application/json": { schema: LoginBody } }, required: true },
  },
  responses: {
    200: {
      description: "Tokens issued",
      content: { "application/json": { schema: TokenResponse } },
    },
    400: { description: "Validation error" },
    401: { description: "Invalid credentials" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: [TAG],
  summary: "Rotate refresh token and obtain new access token",
  request: {
    body: { content: { "application/json": { schema: RefreshBody } }, required: true },
  },
  responses: {
    200: {
      description: "Tokens rotated",
      content: { "application/json": { schema: TokenResponse } },
    },
    401: { description: "Invalid or expired refresh token" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: [TAG],
  summary: "Revoke refresh token family (logout)",
  request: {
    body: { content: { "application/json": { schema: LogoutBody } }, required: true },
  },
  responses: {
    204: { description: "Logged out" },
  },
});
