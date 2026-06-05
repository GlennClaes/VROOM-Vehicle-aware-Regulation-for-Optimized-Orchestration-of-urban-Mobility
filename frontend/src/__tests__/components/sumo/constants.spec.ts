import { describe, it, expect } from 'vitest'
import { SUPPORTED_VEHICLE_CLASSES } from '../../../components/sumo/constants'

describe('SUPPORTED_VEHICLE_CLASSES', () => {
  it('contains passenger class with label car', () => {
    expect(SUPPORTED_VEHICLE_CLASSES.passenger).toBeDefined()
    expect(SUPPORTED_VEHICLE_CLASSES.passenger.label).toBe('car')
  })

  it('contains bicycle class with label bike', () => {
    expect(SUPPORTED_VEHICLE_CLASSES.bicycle).toBeDefined()
    expect(SUPPORTED_VEHICLE_CLASSES.bicycle.label).toBe('bike')
  })

  it('contains rail class with label train', () => {
    expect(SUPPORTED_VEHICLE_CLASSES.rail).toBeDefined()
    expect(SUPPORTED_VEHICLE_CLASSES.rail.label).toBe('train')
  })

  it('contains pedestrian class with label person', () => {
    expect(SUPPORTED_VEHICLE_CLASSES.pedestrian).toBeDefined()
    expect(SUPPORTED_VEHICLE_CLASSES.pedestrian.label).toBe('person')
  })

  it('contains bus class with label bus', () => {
    expect(SUPPORTED_VEHICLE_CLASSES.bus).toBeDefined()
    expect(SUPPORTED_VEHICLE_CLASSES.bus.label).toBe('bus')
  })

  it('each class has a models array', () => {
    for (const key of Object.keys(SUPPORTED_VEHICLE_CLASSES)) {
      expect(Array.isArray(SUPPORTED_VEHICLE_CLASSES[key].models)).toBe(true)
      expect(SUPPORTED_VEHICLE_CLASSES[key].models.length).toBeGreaterThan(0)
    }
  })

  it('passenger has multiple models (all OGA color/type combos)', () => {
    expect(SUPPORTED_VEHICLE_CLASSES.passenger.models.length).toBe(7 * 4) // 7 colors * 4 types
  })

  it('each passenger model has objectUrl and materialUrl', () => {
    for (const model of SUPPORTED_VEHICLE_CLASSES.passenger.models) {
      expect(model.objectUrl).toMatch(/\.obj$/)
      expect(model.materialUrl).toMatch(/\.mtl$/)
    }
  })
})
