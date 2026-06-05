import { describe, it, expect } from 'vitest'
import { Signals } from '@/components/sumo/types/api'

describe('api.ts types', () => {
  it('defines Signals enum correctly', () => {
    expect(Signals.LEFT).toBe(1)
    expect(Signals.RIGHT).toBe(2)
    expect(Signals.BRAKE).toBe(8)
  })
})
