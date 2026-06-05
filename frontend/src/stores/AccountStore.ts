import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/AuthStore'
import router from '@/router/index'

const API = '/api'

export const useAccountStore = defineStore('account', () => {
  const user = ref(null)
  const loading = ref(false)
  const error = ref('')

  function getToken() {
    const authStore = useAuthStore()
    return authStore.session?.access_token
      || JSON.parse(localStorage.getItem('session') || 'null')?.access_token
  }

  function handleUnauthorized() {
    const authStore = useAuthStore()
    authStore.session = null
    localStorage.removeItem('session')
    router.push('/login')
  }

  async function fetchUser() {
    loading.value = true
    error.value = ''

    const token = getToken()
    if (!token) {
      handleUnauthorized()
      return
    }

    // Laad eerst wat we al hebben uit de session (snelle weergave)
    const authStore = useAuthStore()
    if (authStore.session?.user) {
      user.value = {
        id: authStore.session.user.id,
        username: authStore.session.user.username,
        email: authStore.session.user.email,
        created_at: authStore.session.user.created_at || null,
        last_sign_in_at: authStore.session.user.last_sign_in_at || null,
      }
    }

    // Haal dan verse data op van de backend (incl. created_at, last_sign_in_at)
    try {
      const response = await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      user.value = response.data

      // Session ook bijwerken met verse data
      if (authStore.session) {
        authStore.session.user = {
          ...authStore.session.user,
          ...response.data,
          name: response.data.username
        }
        localStorage.setItem('session', JSON.stringify(authStore.session))
      }
    } catch (err) {
      if (err.response?.status === 401) {
        handleUnauthorized()
      } else {
        error.value = err.response?.data?.detail || 'Kon gebruikersgegevens niet ophalen.'
      }
    } finally {
      loading.value = false
    }
  }

  async function updateUser({ username, email }) {
    loading.value = true
    error.value = ''
    try {
      const token = getToken()
      if (!token) { handleUnauthorized(); return false }

      const response = await axios.put(
        `${API}/users/update`,
        { username, email },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (user.value) {
        user.value.username = username
        user.value.email = email
      }

      const authStore = useAuthStore()
      if (authStore.session) {
        authStore.session.access_token = response.data.access_token
        authStore.session.user = {
          ...authStore.session.user,
          username,
          email,
          name: username
        }
        localStorage.setItem('session', JSON.stringify(authStore.session))
      }

      return true
    } catch (err) {
      if (err.response?.status === 401) {
        handleUnauthorized()
      } else {
        error.value = err.response?.data?.detail || 'Er is een fout opgetreden bij het opslaan.'
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function changePassword(currentPassword, newPassword) {
    loading.value = true
    error.value = ''
    try {
      const token = getToken()
      if (!token) { handleUnauthorized(); return false }

      const response = await axios.put(
        `${API}/users/update`,
        { current_password: currentPassword, password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Update session with new token
      const authStore = useAuthStore()
      if (authStore.session) {
        authStore.session.access_token = response.data.access_token
        localStorage.setItem('session', JSON.stringify(authStore.session))
      }

      return true
    } catch (err) {
      error.value = err.response?.data?.detail || 'Er is een fout opgetreden bij het wijzigen van het wachtwoord.'
      return false
    } finally {
      loading.value = false
    }
  }

  return { user, loading, error, fetchUser, updateUser, changePassword }
})
