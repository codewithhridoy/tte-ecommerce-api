import { ENV } from "@shared/env";
import { logger } from "@shared/logger";
import { pool } from "@infra/db/client";
import { redis } from "@infra/cache/redis";
import { startOutboxRelay } from "@infra/events/outbox-relay";
import { buildApp } from "./app";

const { app, outboxPublisher, shutdown } = buildApp();

const server = app.listen(ENV.PORT, () => {
  logger.info({ port: ENV.PORT, env: ENV.NODE_ENV }, "server listening");
});

const relay = startOutboxRelay(outboxPublisher);

const close = async (): Promise<void> => {
  logger.info("received shutdown signal");
  relay.stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await shutdown();
  await pool.end();
  await redis.quit();
  process.exit(0);
};

process.on("SIGTERM", close);
process.on("SIGINT", close);
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "unhandled rejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  process.exit(1);
});
