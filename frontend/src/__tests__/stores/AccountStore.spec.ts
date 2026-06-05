import { describe, it, beforeEach, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAccountStore } from '@/stores/AccountStore'
import { useAuthStore } from '@/stores/AuthStore'
import axios from 'axios'
import router from '@/router/index'

// axios mock
vi.mock('axios')

// router mock (GEEN top-level variabele)
vi.mock('@/router/index', () => ({
  default: {
    push: vi.fn()
  }
}))

describe('Account Store', () => {
  let accountStore
  let authStore

  beforeEach(() => {
    setActivePinia(createPinia())
    accountStore = useAccountStore()
    authStore = useAuthStore()

    vi.clearAllMocks()
    authStore.session = null
    localStorage.clear()
    accountStore.user = null
  })

  it('fetchUser sets user from session if present', async () => {
    authStore.session = {
      access_token: 'abc123',
      user: { id: 1, username: 'John Doe', email: 'john@test.com' }
    }

    axios.get.mockResolvedValueOnce({
      data: {
        id: 1,
        username: 'John Doe',
        email: 'john@test.com',
        created_at: null,
        last_sign_in_at: null
      }
    })

    await accountStore.fetchUser()

    expect(accountStore.user).toEqual({
      id: 1,
      username: 'John Doe',
      email: 'john@test.com',
      created_at: null,
      last_sign_in_at: null
    })

    expect(accountStore.loading).toBe(false)
    expect(accountStore.error).toBe('')
  })

  it('fetchUser handles 401 by logging out', async () => {
    authStore.session = { access_token: 'abc123', user: {} }

    axios.get.mockRejectedValueOnce({
      response: { status: 401 }
    })

    await accountStore.fetchUser()

    expect(authStore.session).toBe(null)
    expect(router.push).toHaveBeenCalledWith('/login')
  })

  it('fetchUser handles other errors', async () => {
    authStore.session = { access_token: 'abc123', user: {} }

    axios.get.mockRejectedValueOnce({
      response: { data: { detail: 'Error message' } }
    })

    await accountStore.fetchUser()

    expect(accountStore.error).toBe('Error message')
  })

  it('updateUser sends request and updates store', async () => {
    accountStore.user = { id: 1, username: 'John Doe', email: 'john@test.com' }

    authStore.session = {
      access_token: 'abc123',
      user: { id: 1, username: 'John Doe', email: 'john@test.com' }
    }

    axios.put.mockResolvedValueOnce({
      data: { access_token: 'newtoken' }
    })

    const result = await accountStore.updateUser({
      username: 'Jane Doe',
      email: 'jane@test.com'
    })

    expect(result).toBe(true)

    expect(accountStore.user.username).toBe('Jane Doe')
    expect(accountStore.user.email).toBe('jane@test.com')

    expect(authStore.session.access_token).toBe('newtoken')
    expect(authStore.session.user.username).toBe('Jane Doe')

    expect(localStorage.getItem('session')).toBe(JSON.stringify(authStore.session))
  })

  it('updateUser handles 401 by logging out', async () => {
    accountStore.user = { username: 'John', email: 'john@test.com' }

    authStore.session = { access_token: 'abc123', user: {} }

    axios.put.mockRejectedValueOnce({
      response: { status: 401 }
    })

    const result = await accountStore.updateUser({
      username: 'Jane',
      email: 'jane@test.com'
    })

    expect(result).toBe(false)
    expect(authStore.session).toBe(null)
    expect(router.push).toHaveBeenCalledWith('/login')
  })

  it('updateUser handles other errors', async () => {
    accountStore.user = { username: 'John', email: 'john@test.com' }

    authStore.session = { access_token: 'abc123', user: {} }

    axios.put.mockRejectedValueOnce({
      response: { data: { detail: 'Some error' } }
    })

    const result = await accountStore.updateUser({
      username: 'Jane',
      email: 'jane@test.com'
    })

    expect(result).toBe(false)
    expect(accountStore.error).toBe('Some error')
  })

  it('fetchUser handles missing token', async () => {
    authStore.session = null
    localStorage.clear()
    await accountStore.fetchUser()
    expect(router.push).toHaveBeenCalledWith('/login')
  })

  it('updateUser handles missing token', async () => {
    authStore.session = null
    const result = await accountStore.updateUser({ username: 'Jane' })
    expect(result).toBe(false)
    expect(router.push).toHaveBeenCalledWith('/login')
  })

  it('changePassword sends request and updates session', async () => {
    authStore.session = { access_token: 'oldtoken' }
    axios.put.mockResolvedValueOnce({
      data: { access_token: 'newtoken' }
    })
    const result = await accountStore.changePassword('oldpass', 'newpass')
    expect(result).toBe(true)
    expect(authStore.session.access_token).toBe('newtoken')
  })

  it('changePassword handles errors', async () => {
    authStore.session = { access_token: 'valid' }
    axios.put.mockRejectedValueOnce({
      response: { data: { detail: 'Wrong password' } }
    })
    const result = await accountStore.changePassword('oldpass', 'newpass')
    expect(result).toBe(false)
    expect(accountStore.error).toContain('Wrong password')
  })

  it('changePassword handles missing token', async () => {
    authStore.session = null
    const result = await accountStore.changePassword('a', 'b')
    expect(result).toBe(false)
    expect(router.push).toHaveBeenCalledWith('/login')
  })

  it('updateUser succeeds even when authStore.session is null', async () => {
    accountStore.user = { id: 1, username: 'Old', email: 'old@test.com' }
    localStorage.setItem('session', JSON.stringify({ access_token: 'tok123' }))
    authStore.session = null

    axios.put.mockResolvedValueOnce({
      data: { access_token: 'newtoken' }
    })

    const result = await accountStore.updateUser({ username: 'New', email: 'new@test.com' })
    expect(result).toBe(true)
    expect(accountStore.user.username).toBe('New')
  })

  it('updateUser shows fallback error when detail is missing', async () => {
    authStore.session = { access_token: 'abc123', user: {} }

    axios.put.mockRejectedValueOnce({
      response: { status: 500, data: {} }
    })

    const result = await accountStore.updateUser({ username: 'X', email: 'x@test.com' })
    expect(result).toBe(false)
    expect(accountStore.error).toBe('Er is een fout opgetreden bij het opslaan.')
  })

  it('changePassword succeeds when authStore.session is null (token from localStorage)', async () => {
    localStorage.setItem('session', JSON.stringify({ access_token: 'localtok' }))
    authStore.session = null

    axios.put.mockResolvedValueOnce({
      data: { access_token: 'newtoken' }
    })

    const result = await accountStore.changePassword('old', 'new')
    expect(result).toBe(true)
  })

  it('changePassword shows fallback error when detail is missing', async () => {
    authStore.session = { access_token: 'valid' }

    axios.put.mockRejectedValueOnce({
      response: { status: 500, data: {} }
    })

    const result = await accountStore.changePassword('old', 'new')
    expect(result).toBe(false)
    expect(accountStore.error).toBe('Er is een fout opgetreden bij het wijzigen van het wachtwoord.')
  })
})
