// tests/counterStore.spec.js
import { setActivePinia, createPinia } from 'pinia'
import { useCounterStore } from '../stores/counter'
import { describe, it, expect, beforeEach } from 'vitest'

describe('Counter Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should start with count 0', () => {
    const store = useCounterStore()
    expect(store.count).toBe(0)
  })

  it('should increment count', () => {
    const store = useCounterStore()
    store.increment()
    expect(store.count).toBe(1)
  })

  it('should compute doubleCount correctly', () => {
    const store = useCounterStore()
    store.increment()
    expect(store.doubleCount).toBe(2)
  })
})
