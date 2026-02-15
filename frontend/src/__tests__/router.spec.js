import { describe, it, expect } from 'vitest'
import router from '../router/index'

describe('Router', () => {
  it('should have Home and About routes', () => {
    const routeNames = router.getRoutes().map((r) => r.name)
    expect(routeNames).toContain('Home')
    expect(routeNames).toContain('About')
  })
})
