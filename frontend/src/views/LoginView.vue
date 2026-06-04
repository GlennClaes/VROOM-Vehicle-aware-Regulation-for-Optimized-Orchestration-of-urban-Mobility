<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center bg-light p-4">
    <div class="w-100" style="max-width: 400px">
      <div class="card border-0 rounded-4 shadow-lg p-4">
        <div class="text-center mb-4">
          <div
            class="d-inline-flex align-items-center justify-content-center bg-primary bg-gradient rounded-4 mb-3 shadow"
            style="width: 64px; height: 64px"
          >
            <Navigation :size="32" class="text-white"/>
          </div>
          <h1 class="h3 fw-bold text-dark mb-0">VROOM</h1>
          <p class="text-muted small">Intelligente Verkeerssimulatie</p>
        </div>

        <form @submit.prevent="handleLogin">
          <div class="mb-3 relative">
            <Label for="email" class="text-secondary">E-mailadres</Label>
            <div class="position-relative">
              <Mail
                :size="20"
                class="position-absolute start-0 ms-2 top-50 translate-middle-y text-muted"
              />
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="naam@gemeente.be"
                class="border-start-1 ps-5 bg-secondary bg-opacity-10"
                required
              />
            </div>
          </div>

          <div class="mb-4 relative">
            <Label for="password" class="text-secondary">Wachtwoord</Label>
            <div class="position-relative">
              <Lock
                :size="20"
                class="position-absolute start-0 ms-2 top-50 translate-middle-y text-muted"
              />
              <Input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                class="border-start-1 ps-5 bg-secondary bg-opacity-10"
                required
              />
              <span
                class="position-absolute end-0 me-2 top-50 translate-middle-y text-muted"
                style="cursor: pointer"
                @click="showPassword = !showPassword"
              >
                <component :is="showPassword ? EyeOff : Eye" :size="20"/>
              </span>
            </div>
          </div>

          <div v-if="error" class="alert alert-danger py-2 px-3 small rounded-3 mb-3" role="alert">
            {{ error }}
          </div>

          <Button type="submit" :disabled="loading" variant="default" class="w-100 py-2 fw-bold">
            {{ loading ? 'Bezig met inloggen...' : 'Inloggen' }}
          </Button>
        </form>

        <div class="mt-4 text-center">
          <p class="text-muted small">
            Nog geen account?
            <router-link to="/register" class="text-primary text-decoration-none fw-medium">
              Registreer hier
            </router-link>
          </p>
        </div>
      </div>
      <Footer/>
    </div>
  </div>
</template>

<script setup>
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {Navigation, Lock, Mail, EyeOff, Eye} from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import {useAuthStore} from '@/stores/AuthStore.js'
import Footer from "@/components/ui/Footer.vue";

const router = useRouter()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

const auth = useAuthStore()

const handleLogin = async () => {
  error.value = ''
  loading.value = true

  const success = await auth.login({
    email: email.value,
    password: password.value,
  })

  if (success) {
    router.push('/dashboard')
  } else {
    error.value = auth.error
  }

  loading.value = false
}
</script>
