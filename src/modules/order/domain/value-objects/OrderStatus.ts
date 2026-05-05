export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'fulfilling'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['fulfilling', 'refunded'],
  fulfilling: ['shipped', 'cancelled'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
}

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  TRANSITIONS[from].includes(to)

export class OrderStateMachine {
  constructor(private readonly current: OrderStatus) {}

  transitionTo(next: OrderStatus): OrderStatus {
    if (!canTransition(this.current, next)) {
      throw new Error(`Illegal order transition: ${this.current} -> ${next}`)
    }
    return next
  }
}
