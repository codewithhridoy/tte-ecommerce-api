import { logger } from "@shared/logger";
import type { OutboxPublisher } from "./outbox-publisher";

export const startOutboxRelay = (
  publisher: OutboxPublisher,
  intervalMs = 1000,
): { stop: () => void } => {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const count = await publisher.drain(100);
      if (count > 0) logger.debug({ count }, "outbox drained");
    } catch (err) {
      logger.error({ err }, "outbox relay error");
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };

  timer = setTimeout(tick, intervalMs);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
};
