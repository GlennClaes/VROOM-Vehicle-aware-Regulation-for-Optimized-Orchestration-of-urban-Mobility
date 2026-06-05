<template>
  <div class="card shadow-sm border-0 rounded-3 overflow-hidden">

    <div class="card-header bg-light border-bottom py-3">
      <div class="d-flex align-items-center gap-3">
        <div class="bg-primary bg-opacity-10 text-primary rounded-3 d-flex align-items-center justify-content-center"
             style="width:44px;height:44px;">
          <UserIcon :size="20"/>
        </div>
        <div>
          <h2 class="fw-semibold mb-0 text-dark" style="font-size:1rem;">Profiel Instellingen</h2>
          <p class="text-body-secondary mb-0" style="font-size:0.85rem;">
            Beheer uw persoonlijke informatie
          </p>
        </div>
      </div>
    </div>

    <div class="card-body p-4">
      <form @submit.prevent="handleUpdateProfile" class="d-flex flex-column gap-3">

        <!-- Name -->
        <div>
          <label for="name" class="form-label fw-medium text-dark mb-1" style="font-size:0.9rem;">Naam</label>
          <div class="position-relative">
            <UserIcon
              class="position-absolute text-body-secondary"
              :size="16"
              style="left:11px;top:50%;transform:translateY(-50%);"
            />
            <input
              id="name"
              type="text"
              v-model="profileName"
              class="form-control ps-5"
              style="height:42px;font-size:0.9rem;"
              required
            />
          </div>
        </div>

        <!-- Email -->
        <div>
          <label for="email" class="form-label fw-medium text-dark mb-1" style="font-size:0.9rem;">
            E-mailadres
          </label>
          <div class="position-relative">
            <MailIcon
              class="position-absolute text-body-secondary"
              :size="16"
              style="left:11px;top:50%;transform:translateY(-50%);"
            />
            <input
              id="email"
              type="email"
              v-model="profileEmail"
              class="form-control ps-5"
              style="height:42px;font-size:0.9rem;"
              required
            />
          </div>
        </div>

        <!-- Error -->
        <div v-if="accountStore.error" class="alert alert-danger py-2" style="font-size:0.85rem;">
          {{ accountStore.error }}
        </div>

        <!-- Success -->
        <div v-if="successMessage" class="alert alert-success py-2" style="font-size:0.85rem;">
          {{ successMessage }}
        </div>

        <!-- Button -->
        <button
          type="submit"
          :disabled="accountStore.loading"
          class="btn btn-primary d-flex align-items-center justify-content-center gap-2 fw-medium"
          style="height:42px;font-size:0.9rem;"
        >
          <SaveIcon :size="15"/>
          {{ accountStore.loading ? 'Bezig met opslaan...' : 'Profiel Opslaan' }}
        </button>

      </form>
    </div>
  </div>
</template>

<script>
import { User as UserIcon, Mail as MailIcon, Save as SaveIcon } from 'lucide-vue-next';
import { useAccountStore } from '@/stores/AccountStore';

export default {
  components: { UserIcon, MailIcon, SaveIcon },

  emits: ['profile-updated'],

  data() {
    return {
      profileName: '',
      profileEmail: '',
      successMessage: '',
    };
  },

  setup() {
    return { accountStore: useAccountStore() };
  },

  async mounted() {
    await this.accountStore.fetchUser();
    this.profileName = this.accountStore.user?.username || '';
    this.profileEmail = this.accountStore.user?.email || '';
  },

  methods: {
    async handleUpdateProfile() {
      this.successMessage = '';
      const success = await this.accountStore.updateUser({
        username: this.profileName,
        email: this.profileEmail,
      });

      if (success) {
        // Formulier bijwerken met nieuwe waarden
        this.profileName = this.accountStore.user?.username || this.profileName;
        this.profileEmail = this.accountStore.user?.email || this.profileEmail;

        // Header bijwerken via emit
        this.$emit('profile-updated', {
          name: this.profileName,
          email: this.profileEmail,
        });

        this.successMessage = '✅ Profiel succesvol bijgewerkt!';
        setTimeout(() => { this.successMessage = ''; }, 3000);
      }
    },
  }
};
</script>
