export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string
  aggregateType: string
  aggregateId: string
  type: string
  payload: TPayload
  correlationId?: string
  occurredAt: Date
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>
}

export type EventHandler<T = Record<string, unknown>> = (event: DomainEvent<T>) => Promise<void>

export interface EventSubscriber {
  subscribe(eventType: string, handler: EventHandler): void
}
