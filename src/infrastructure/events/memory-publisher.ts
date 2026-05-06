import { logger } from "@shared/logger";
import type {
  DomainEvent,
  EventHandler,
  EventPublisher,
  EventSubscriber,
} from "./types";

export class InMemoryEventBus implements EventPublisher, EventSubscriber {
  private readonly handlers = new Map<string, EventHandler[]>();

  subscribe(eventType: string, handler: EventHandler): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  async publish(event: DomainEvent): Promise<void> {
    const list = this.handlers.get(event.type) ?? [];
    await Promise.all(
      list.map((h) =>
        h(event).catch((err: unknown) =>
          logger.error({ err, eventId: event.id }, "event handler failed"),
        ),
      ),
    );
  }
}
