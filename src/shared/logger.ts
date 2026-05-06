import pino from "pino";
import { ENV } from "./env";

export const logger = pino({
  level: ENV.LOG_LEVEL,
  base: { service: "tte-ecommerce-api", env: ENV.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.refreshToken",
    ],
    censor: "[REDACTED]",
  },
});

export type Logger = typeof logger;
