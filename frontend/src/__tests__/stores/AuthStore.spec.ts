import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '../../stores/AuthStore'
import axios from 'axios'

vi.mock('axios', () => {
  const mockInterceptors = {
    response: { use: vi.fn() }
  }
  return {
    default: {
      post: vi.fn(),
      get: vi.fn(),
      interceptors: mockInterceptors
    },
    post: vi.fn(),
    get: vi.fn(),
    interceptors: mockInterceptors
  }
})

describe('AuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    
    delete window.location
    window.location = { href: '' }
  })

  it('initialiseert met sessie uit localStorage', () => {
    const mockSession = { access_token: '123', user: { name: 'Test' } }
    localStorage.setItem('session', JSON.stringify(mockSession))
    const store = useAuthStore()
    expect(store.session).toEqual(mockSession)
  })

  describe('register', () => {
    it('valideert invoer', async () => {
      const store = useAuthStore()
      expect(await store.register({ name: '', email: '', password: '' })).toBe(false)
      expect(store.error).toBe('Vul je volledige naam in.')
      
      expect(await store.register({ name: 'Short', email: '', password: '' })).toBe(false)
      expect(store.error).toBe('De naam moet minimaal 6 tekens bevatten.')

      expect(await store.register({ name: 'Valid Name', email: 'invalid', password: '' })).toBe(false)
      expect(store.error).toBe('Vul een geldig e-mailadres in.')

      expect(await store.register({ name: 'Valid Name', email: 'test@test.com', password: '' })).toBe(false)
      expect(store.error).toBe('Vul een wachtwoord in.')

      expect(await store.register({ name: 'Valid Name', email: 'test@test.com', password: '123' })).toBe(false)
      expect(store.error).toBe('Het wachtwoord moet minimaal 6 tekens bevatten.')
    })

    it('handelt succesvolle registratie af', async () => {
      axios.post.mockResolvedValue({ data: {} })
      const store = useAuthStore()
      const result = await store.register({ name: 'Valid Name', email: 'test@test.com', password: 'password' })
      expect(result).toBe(true)
    })

    it('handelt API fouten af', async () => {
      axios.post.mockRejectedValue({ response: { data: { detail: 'Error' } } })
      const store = useAuthStore()
      await store.register({ name: 'Valid Name', email: 'test@test.com', password: 'password' })
      expect(store.error).toBe('Error')
      
      axios.post.mockRejectedValue({})
      await store.register({ name: 'Valid Name', email: 'test@test.com', password: 'password' })
      expect(store.error).toBe('Registratie mislukt. Probeer opnieuw.')
    })
  })

  describe('login', () => {
    it('valideert invoer', async () => {
      const store = useAuthStore()
      expect(await store.login({ email: '', password: '' })).toBe(false)
      expect(store.error).toBe('Vul een geldig e-mailadres in.')
      
      expect(await store.login({ email: 'test@test.com', password: '' })).toBe(false)
      expect(store.error).toBe('Vul een wachtwoord in.')
    })

    it('handelt succesvolle login af', async () => {
      axios.post.mockResolvedValue({ data: { access_token: 'tk', token_type: 'bearer' } })
      axios.get.mockResolvedValue({ data: { username: 'User', email: 'u@t.com' } })
      const store = useAuthStore()
      const result = await store.login({ email: 'u@t.com', password: 'pw' })
      expect(result).toBe(true)
      expect(store.session.access_token).toBe('tk')
    })

    it('handelt fouten af', async () => {
      axios.post.mockRejectedValue({ response: { status: 400 } })
      const store = useAuthStore()
      await store.login({ email: 'u@t.com', password: 'pw' })
      expect(store.error).toBe('E-mailadres of wachtwoord is incorrect.')

      axios.post.mockRejectedValue({ response: { status: 500 } })
      await store.login({ email: 'u@t.com', password: 'pw' })
      expect(store.error).toBe('Login mislukt. Probeer opnieuw.')
    })
  })

  describe('logout', () => {
    it('roept API aan en ruimt op', async () => {
      const store = useAuthStore()
      store.session = { access_token: 'tk' }
      axios.post.mockResolvedValue({})
      await store.logout()
      expect(store.session).toBeNull()
      expect(window.location.href).toBe('/login')
    })

    it('ruimt ook op als API faalt', async () => {
      const store = useAuthStore()
      store.session = { access_token: 'tk' }
      axios.post.mockRejectedValue(new Error())
      await store.logout()
      expect(store.session).toBeNull()
    })

    it('skips API call when session has no access_token', async () => {
      const store = useAuthStore()
      store.session = {}
      await store.logout()
      expect(store.session).toBeNull()
      expect(axios.post).not.toHaveBeenCalled()
    })
  })

  describe('Axios Interceptor', () => {
    it('handelt 401 Unauthorized af', async () => {
      useAuthStore()
      const interceptorError = axios.interceptors.response.use.mock.calls[0][1]
      const store = useAuthStore()
      store.session = { access_token: 'valid' }
      
      try { await interceptorError({ response: { status: 401 } }) } catch (e) {}
      
      expect(store.session).toBeNull()
      expect(window.location.href).toBe('/login')
    })

    it('rejects non-401 errors without clearing session', async () => {
      useAuthStore()
      const interceptorError = axios.interceptors.response.use.mock.calls[0][1]
      const store = useAuthStore()
      store.session = { access_token: 'valid' }
      
      const error = { response: { status: 500 } }
      await expect(interceptorError(error)).rejects.toEqual(error)
      
      expect(store.session).not.toBeNull()
    })

    it('geeft andere responses door', () => {
      useAuthStore()
      const interceptorResponse = axios.interceptors.response.use.mock.calls[0][0]
      const res = { data: 'ok' }
      expect(interceptorResponse(res)).toBe(res)
    })
  })

  describe('verifySession', () => {
    it('werkt correct', async () => {
      const store = useAuthStore()
      store.session = null
      expect(await store.verifySession()).toBe(false)
      
      store.session = { access_token: 'tk' }
      axios.get.mockResolvedValue({})
      expect(await store.verifySession()).toBe(true)
      
      axios.get.mockRejectedValue(new Error())
      expect(await store.verifySession()).toBe(false)
    })
  })

  it('isAuthenticated status check', () => {
    const store = useAuthStore()
    store.session = { access_token: 'tk' }
    expect(store.isAuthenticated()).toBe(true)
    store.session = null
    expect(store.isAuthenticated()).toBe(false)
  })
})
