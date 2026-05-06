import { z } from "zod";
import { registry } from "@shared/http/openapi/registry";

const TAG = "Auth";

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

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

// Body is optional for cookie clients; included for legacy Bearer-token clients.
const RefreshBody = z
  .object({
    refreshToken: z
      .string()
      .min(10)
      .optional()
      .openapi({ example: "<opaque-refresh-token>" }),
  })
  .openapi("RefreshBody");

const LogoutBody = z
  .object({
    refreshToken: z
      .string()
      .min(10)
      .optional()
      .openapi({ example: "<opaque-refresh-token>" }),
  })
  .openapi("LogoutBody");

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const UserObject = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: z.enum(["customer", "staff", "admin"]),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Returned by login and refresh. refreshToken is NOT in the body — it is set
// as an httpOnly Set-Cookie header and must not be read by JavaScript.
const SessionResponse = z
  .object({
    success: z.literal(true),
    data: z.object({
      accessToken: z.string().openapi({
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        description:
          "Short-lived JWT (default 15 min). Also delivered via the access_token httpOnly cookie.",
      }),
      refreshExpiresAt: z
        .string()
        .datetime()
        .openapi({ example: "2026-06-06T12:00:00.000Z" }),
    }),
  })
  .openapi("SessionResponse");

// Register also returns the created user alongside session data.
const RegisterResponse = z
  .object({
    success: z.literal(true),
    data: z.object({
      user: UserObject,
      accessToken: z.string().openapi({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
      refreshExpiresAt: z
        .string()
        .datetime()
        .openapi({ example: "2026-06-06T12:00:00.000Z" }),
    }),
  })
  .openapi("RegisterResponse");

// ---------------------------------------------------------------------------
// Shared cookie documentation
// ---------------------------------------------------------------------------

// Describes the two Set-Cookie headers emitted by session-creating endpoints.
const setCookieHeaders = {
  "Set-Cookie": {
    description:
      "Two httpOnly cookies are set: `access_token` (path /, maxAge = JWT_ACCESS_TTL) " +
      "and `refresh_token` (path /api/v1/auth, expires = refreshExpiresAt). " +
      "Both are Secure in production and SameSite=Lax.",
    schema: { type: "string" as const },
  },
};

// Cookie parameter accepted by refresh and logout in place of a request body.
const refreshTokenCookieParam = {
  name: "refresh_token",
  in: "cookie" as const,
  required: false,
  description:
    "httpOnly refresh_token cookie set at login. When present, the request body is not needed.",
  schema: { type: "string" },
};

// ---------------------------------------------------------------------------
// Route registrations
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: [TAG],
  summary: "Register a new account",
  description:
    "Creates a new customer account and immediately opens a session. " +
    "The response body includes `accessToken`; both tokens are also delivered " +
    "as httpOnly cookies so that browser clients need not handle them manually.",
  request: {
    body: { content: { "application/json": { schema: RegisterBody } }, required: true },
  },
  responses: {
    201: {
      description: "Account created and session opened",
      headers: setCookieHeaders,
      content: { "application/json": { schema: RegisterResponse } },
    },
    400: { description: "Validation error" },
    409: { description: "Email already registered" },
  },
});

const LoginPendingResponse = z
  .object({
    success: z.literal(true),
    data: z.object({
      requiresOtp: z.literal(true).openapi({
        description: "Always true. A 6-digit OTP has been sent to the user's registered contact.",
      }),
    }),
  })
  .openapi("LoginPendingResponse");

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: [TAG],
  summary: "Validate credentials and trigger OTP",
  description:
    "Verifies email and password. On success, a 6-digit OTP is sent to the user's registered " +
    "contact (email/SMS) with `purpose: login`. **No session is opened yet.** " +
    "The client must complete the flow via `POST /auth/otp/complete-login`.",
  request: {
    body: { content: { "application/json": { schema: LoginBody } }, required: true },
  },
  responses: {
    200: {
      description: "Credentials valid — OTP dispatched",
      content: { "application/json": { schema: LoginPendingResponse } },
    },
    400: { description: "Validation error" },
    401: { description: "Invalid credentials" },
    412: { description: "OTP resend cooldown active" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: [TAG],
  summary: "Rotate refresh token and obtain a new access token",
  description:
    "Accepts the refresh token either from the `refresh_token` httpOnly cookie (browser clients) " +
    "or from the request body (API / mobile clients). " +
    "On success, new tokens are issued and the previous refresh token is revoked. " +
    "Reuse of a revoked token terminates the entire token family.",
  request: {
    params: undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: undefined as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headers: undefined as any,
    // Cookie param documented manually below via the raw spec extension
    body: {
      content: { "application/json": { schema: RefreshBody } },
      required: false,
      description: "Omit when using the refresh_token cookie.",
    },
  },
  responses: {
    200: {
      description: "Tokens rotated",
      headers: setCookieHeaders,
      content: { "application/json": { schema: SessionResponse } },
    },
    401: { description: "Refresh token missing, invalid, or expired" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: [TAG],
  summary: "Revoke refresh token family and clear session cookies",
  description:
    "Revokes the entire refresh token family to prevent reuse. " +
    "Cookies are cleared regardless of whether a token was found. " +
    "Accepts the refresh token from the `refresh_token` cookie or the request body.",
  request: {
    body: {
      content: { "application/json": { schema: LogoutBody } },
      required: false,
      description: "Omit when using the refresh_token cookie.",
    },
  },
  responses: {
    204: {
      description: "Logged out — cookies cleared",
      headers: {
        "Set-Cookie": {
          description: "access_token and refresh_token cookies are cleared (Max-Age=0).",
          schema: { type: "string" as const },
        },
      },
    },
  },
});

// ---------------------------------------------------------------------------
// OTP endpoints
// ---------------------------------------------------------------------------

const OtpPurposeEnum = z.enum(["email_verification", "login", "password_reset"]);

const SendOtpBody = z
  .object({
    purpose: OtpPurposeEnum.openapi({
      description:
        "`email_verification` — confirm account email after registration. " +
        "`login` — passwordless login flow. " +
        "`password_reset` — step in the forgot-password flow.",
      example: "email_verification",
    }),
  })
  .openapi("SendOtpBody");

const SendOtpResponse = z
  .object({
    success: z.literal(true),
    data: z.object({
      expiresAt: z.string().datetime().openapi({
        example: "2026-05-07T12:10:00.000Z",
        description: "When the OTP expires (10 minutes from generation).",
      }),
      resendAllowedAt: z.string().datetime().openapi({
        example: "2026-05-07T12:01:00.000Z",
        description: "Earliest time a new OTP may be requested (60-second cooldown).",
      }),
    }),
  })
  .openapi("SendOtpResponse");

const VerifyOtpBody = z
  .object({
    userId: z.string().uuid().openapi({ example: "01910000-0000-7000-0000-000000000001" }),
    purpose: OtpPurposeEnum.openapi({ example: "email_verification" }),
    code: z.string().min(4).max(10).openapi({ example: "482916" }),
  })
  .openapi("VerifyOtpBody");

const VerifyOtpResponse = z
  .object({
    success: z.literal(true),
    data: z.object({ verified: z.literal(true) }),
  })
  .openapi("VerifyOtpResponse");

registry.registerPath({
  method: "post",
  path: "/auth/otp/send",
  tags: [TAG],
  summary: "Request an OTP code",
  description:
    "Generates a one-time password for the authenticated user and the requested purpose. " +
    "The code is delivered out-of-band (email or SMS) — it is **never** returned in the response. " +
    "Requests within the 60-second cooldown window return 412.",
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: SendOtpBody } }, required: true },
  },
  responses: {
    200: {
      description: "OTP sent",
      content: { "application/json": { schema: SendOtpResponse } },
    },
    400: { description: "Validation error" },
    401: { description: "Authentication required" },
    404: { description: "User not found or inactive" },
    412: { description: "Resend cooldown active — try again after resendAllowedAt" },
  },
});

const CompleteLoginBody = z
  .object({
    userId: z.string().uuid().openapi({ example: "01910000-0000-7000-0000-000000000001" }),
    code: z.string().min(4).max(10).openapi({ example: "482916" }),
  })
  .openapi("CompleteLoginBody");

registry.registerPath({
  method: "post",
  path: "/auth/otp/complete-login",
  tags: [TAG],
  summary: "Complete login by verifying the OTP",
  description:
    "Second step of the login flow. Verifies the `login`-purpose OTP issued by " +
    "`POST /auth/login`, marks it used, and opens a session. " +
    "On success, access and refresh tokens are issued and set as httpOnly cookies.",
  request: {
    body: { content: { "application/json": { schema: CompleteLoginBody } }, required: true },
  },
  responses: {
    200: {
      description: "OTP verified — session opened",
      headers: setCookieHeaders,
      content: { "application/json": { schema: SessionResponse } },
    },
    400: { description: "Validation error" },
    401: { description: "Invalid or expired OTP" },
    404: { description: "User not found or inactive" },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/otp/verify",
  tags: [TAG],
  summary: "Verify an OTP code",
  description:
    "Validates a one-time password. On success returns `{ verified: true }`. " +
    "The OTP is immediately marked as used and cannot be replayed. " +
    "This endpoint is public so it can be used during the password-reset flow " +
    "before a session exists.",
  request: {
    body: { content: { "application/json": { schema: VerifyOtpBody } }, required: true },
  },
  responses: {
    200: {
      description: "OTP verified",
      content: { "application/json": { schema: VerifyOtpResponse } },
    },
    400: { description: "Validation error" },
    401: { description: "Invalid or expired OTP" },
    404: { description: "User not found or inactive" },
  },
});

// ---------------------------------------------------------------------------
// Attach cookie parameter to refresh + logout (raw spec extension)
// ---------------------------------------------------------------------------
// zod-to-openapi does not expose a cookie parameter API on registerPath, so we
// patch the definitions after registration.
const defs = registry.definitions;
for (const def of defs) {
  if (def.type !== "route") continue;
  if (def.route.path === "/auth/refresh" || def.route.path === "/auth/logout") {
    const existing: unknown[] = (def.route as Record<string, unknown>).parameters as unknown[] ?? [];
    (def.route as Record<string, unknown>).parameters = [...existing, refreshTokenCookieParam];
  }
}
