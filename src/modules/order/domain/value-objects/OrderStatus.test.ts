import { describe, expect, it } from 'vitest'
import { OrderStateMachine, canTransition } from './OrderStatus.js'

describe('OrderStateMachine', () => {
  it('allows pending_payment -> paid', () => {
    expect(canTransition('pending_payment', 'paid')).toBe(true)
  })
  it('rejects pending_payment -> shipped', () => {
    expect(canTransition('pending_payment', 'shipped')).toBe(false)
  })
  it('throws on illegal transition', () => {
    const sm = new OrderStateMachine('delivered')
    expect(() => sm.transitionTo('pending_payment')).toThrow()
  })
  it('cancelled is terminal', () => {
    const sm = new OrderStateMachine('cancelled')
    expect(() => sm.transitionTo('paid')).toThrow()
  })
})
