<script setup>
import { ref, computed } from 'vue'
import { Navigation, Lock, Mail, User, Eye, EyeOff } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Footer from "@/components/ui/Footer.vue"
import { useAuthStore } from '@/stores/AuthStore'

const auth = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const registered = ref(false)

// Form-validatie
const nameValid = computed(() => name.value.trim().length >= 6)
const passwordValid = computed(() => password.value.length >= 6)
const formValid = computed(
  () => nameValid.value && passwordValid.value && email.value.trim().length > 0
)

// Registratie via store
async function handleRegister() {
  const success = await auth.register({
    name: name.value,
    email: email.value,
    password: password.value
  })

  if (success) {
    registered.value = true
  }
}
</script>

<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center bg-light p-4">
    <div class="w-100" style="max-width: 400px">
      <div class="card border-0 rounded-4 shadow-lg p-4">
        <div class="text-center mb-4">
          <div
            class="d-inline-flex align-items-center justify-content-center bg-primary bg-gradient rounded-4 mb-3 shadow"
            style="width: 64px; height: 64px"
          >
            <Navigation :size="32" class="text-white" />
          </div>
          <h1 class="h3 fw-bold text-dark mb-0">VROOM</h1>
          <p class="text-muted small">Intelligente Verkeerssimulatie</p>
        </div>

        <form v-if="!registered" @submit.prevent="handleRegister">
          <!-- Naam -->
          <div class="mb-3 relative">
            <Label htmlFor="name" class="text-secondary">Volledige naam</Label>
            <div class="position-relative">
              <User :size="20" class="position-absolute start-0 ms-2 top-50 translate-middle-y text-muted" />
              <Input
                id="name"
                v-model="name"
                type="text"
                placeholder="Jan Janssens"
                class="border-start-1 ps-5 bg-secondary bg-opacity-10"
                required
              />
            </div>
          </div>

          <!-- Email -->
          <div class="mb-3 relative">
            <Label htmlFor="email" class="text-secondary">E-mailadres</Label>
            <div class="position-relative">
              <Mail :size="20" class="position-absolute start-0 ms-2 top-50 translate-middle-y text-muted" />
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

          <!-- Wachtwoord -->
          <div class="mb-4 relative">
            <Label htmlFor="password" class="text-secondary">Wachtwoord</Label>
            <div class="position-relative">
              <Lock :size="20" class="position-absolute start-0 ms-2 top-50 translate-middle-y text-muted" />
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
                <component :is="showPassword ? EyeOff : Eye" :size="20" />
              </span>
            </div>
            <small class="text-muted">Minimaal 6 tekens</small>
          </div>

          <!-- Error bericht vanuit store -->
          <div v-if="auth.error" class="alert alert-danger py-2 px-3 small rounded-3 mb-3" role="alert">
            {{ auth.error }}
          </div>

          <Button type="submit" :disabled="!formValid || auth.loading" class="w-100 py-2 fw-bold">
            {{ auth.loading ? 'Bezig met registreren...' : 'Registreer' }}
          </Button>
        </form>
        <div v-else class="confirmation text-center p-3">
          <div class="h2 text-success">✓</div>
          <h4>Account succesvol aangemaakt</h4>
          <p>Je kunt nu inloggen met je gegevens.</p>
          <router-link to="/login" class="btn btn-link">Ga naar Inloggen</router-link>
        </div>

        <div class="mt-4 text-center">
          <p class="text-muted small">
            Al een account?
            <router-link to="/login" class="text-primary text-decoration-none fw-medium">
              Inloggen
            </router-link>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  </div>
</template>
