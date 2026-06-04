import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

const API = '/api'

export const useAuthStore = defineStore('auth', () => {
  const session = ref(JSON.parse(localStorage.getItem('session') || 'null'))
  const loading = ref(false)
  const error = ref('')

  async function register({ name, email, password }) {
    error.value = ''
    if (!name.trim()) { error.value = 'Vul je volledige naam in.'; return false }
    if (name.trim().length < 6) { error.value = 'De naam moet minimaal 6 tekens bevatten.'; return false }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) { error.value = 'Vul een geldig e-mailadres in.'; return false }
    if (!password) { error.value = 'Vul een wachtwoord in.'; return false }
    if (password.length < 6) { error.value = 'Het wachtwoord moet minimaal 6 tekens bevatten.'; return false }

    loading.value = true
    try {
      await axios.post(`${API}/register`, {
        username: name.trim(),
        email: email.trim(),
        password,
      })
      return true
    } catch (err) {
      error.value = err.response?.data?.detail || 'Registratie mislukt. Probeer opnieuw.'
      return false
    } finally {
      loading.value = false
    }
  }

  async function login({ email, password }) {
    error.value = ''
    if (!email.trim()) { error.value = 'Vul een geldig e-mailadres in.'; return false }
    if (!password) { error.value = 'Vul een wachtwoord in.'; return false }

    loading.value = true
    try {
      const response = await axios.post(`${API}/login`, {
        email: email.trim(),
        password,
      })

      const token = response.data.access_token

      const meResponse = await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const sessionData = {
        access_token: token,
        token_type: response.data.token_type,
        user: {
          ...meResponse.data,
          name: meResponse.data.username  // zorg dat name altijd gezet is
        }
      }

      session.value = sessionData
      localStorage.setItem('session', JSON.stringify(sessionData))

      return true
    } catch (err) {
      if (err.response?.status === 400) {
        error.value = 'E-mailadres of wachtwoord is incorrect.'
      } else {
        error.value = 'Login mislukt. Probeer opnieuw.'
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    if (session.value?.access_token) {
      try {
        await axios.post(`${API}/logout`, {}, {
          headers: { Authorization: `Bearer ${session.value.access_token}` }
        })
      } catch (_) {
        // Ignore errors during logout
      }
    }
    session.value = null
    localStorage.removeItem('session')
    window.location.href = '/login'
  }

  // Global Axios Interceptor for 401
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        session.value = null
        localStorage.removeItem('session')
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }
  )

  async function verifySession() {
    if (!session.value?.access_token) return false
    try {
      await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${session.value.access_token}` }
      })
      return true
    } catch (err) {
      // 401 wordt afgehandeld door interceptor
      return false
    }
  }

  function isAuthenticated() {
    return !!session.value?.access_token
  }

  return { session, loading, error, register, login, logout, isAuthenticated, verifySession }
})
