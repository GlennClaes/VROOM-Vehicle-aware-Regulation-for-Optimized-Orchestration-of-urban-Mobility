<template>
  <div class="card shadow-sm border-0 rounded-3 overflow-hidden mt-4">

    <div class="card-header bg-light border-bottom py-3">
      <div class="d-flex align-items-center gap-3">
        <div class="bg-primary bg-opacity-10 text-primary rounded-3 d-flex align-items-center justify-content-center"
             style="width:44px;height:44px;">
          <LockIcon :size="20"/>
        </div>
        <div>
          <h2 class="fw-semibold mb-0 text-dark" style="font-size:1rem;">Wachtwoord Wijzigen</h2>
          <p class="text-body-secondary mb-0" style="font-size:0.85rem;">
            Wijzig uw wachtwoord voor extra beveiliging
          </p>
        </div>
      </div>
    </div>

    <div class="card-body p-4">
      <form @submit.prevent="handleChangePassword" class="d-flex flex-column gap-3">

        <!-- Current Password -->
        <div>
          <label for="currentPassword" class="form-label fw-medium text-dark mb-1" style="font-size:0.9rem;">Huidig wachtwoord</label>
          <div class="position-relative">
            <LockIcon
              class="position-absolute text-body-secondary"
              :size="16"
              style="left:11px;top:50%;transform:translateY(-50%);"
            />
            <input
              id="currentPassword"
              :type="showCurrentPassword ? 'text' : 'password'"
              v-model="currentPassword"
              class="form-control ps-5 pe-5"
              style="height:42px;font-size:0.9rem;"
              required
            />
            <button
              type="button"
              class="btn btn-link position-absolute text-body-secondary p-0 border-0"
              style="right:11px;top:50%;transform:translateY(-50%);"
              @click="showCurrentPassword = !showCurrentPassword"
              tabindex="-1"
            >
              <EyeOffIcon v-if="showCurrentPassword" :size="16"/>
              <EyeIcon v-else :size="16"/>
            </button>
          </div>
        </div>

        <!-- New Password -->
        <div>
          <label for="newPassword" class="form-label fw-medium text-dark mb-1" style="font-size:0.9rem;">Nieuw wachtwoord</label>
          <div class="position-relative">
            <LockIcon
              class="position-absolute text-body-secondary"
              :size="16"
              style="left:11px;top:50%;transform:translateY(-50%);"
            />
            <input
              id="newPassword"
              :type="showNewPassword ? 'text' : 'password'"
              v-model="newPassword"
              class="form-control ps-5 pe-5"
              style="height:42px;font-size:0.9rem;"
              required
            />
            <button
              type="button"
              class="btn btn-link position-absolute text-body-secondary p-0 border-0"
              style="right:11px;top:50%;transform:translateY(-50%);"
              @click="showNewPassword = !showNewPassword"
              tabindex="-1"
            >
              <EyeOffIcon v-if="showNewPassword" :size="16"/>
              <EyeIcon v-else :size="16"/>
            </button>
          </div>
        </div>

        <!-- Confirm Password -->
        <div>
          <label for="confirmPassword" class="form-label fw-medium text-dark mb-1" style="font-size:0.9rem;">Bevestig nieuw wachtwoord</label>
          <div class="position-relative">
            <LockIcon
              class="position-absolute text-body-secondary"
              :size="16"
              style="left:11px;top:50%;transform:translateY(-50%);"
            />
            <input
              id="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              v-model="confirmPassword"
              class="form-control ps-5 pe-5"
              style="height:42px;font-size:0.9rem;"
              required
            />
            <button
              type="button"
              class="btn btn-link position-absolute text-body-secondary p-0 border-0"
              style="right:11px;top:50%;transform:translateY(-50%);"
              @click="showConfirmPassword = !showConfirmPassword"
              tabindex="-1"
            >
              <EyeOffIcon v-if="showConfirmPassword" :size="16"/>
              <EyeIcon v-else :size="16"/>
            </button>
          </div>
        </div>

        <!-- Password Error -->
        <div v-if="passwordError" class="alert alert-danger py-2" style="font-size:0.85rem;">
          {{ passwordError }}
        </div>

        <!-- Password Success -->
        <div v-if="passwordSuccess" class="alert alert-success py-2" style="font-size:0.85rem;">
          {{ passwordSuccess }}
        </div>

        <!-- Button -->
        <button
          type="submit"
          :disabled="passwordLoading"
          class="btn btn-primary d-flex align-items-center justify-content-center gap-2 fw-medium"
          style="height:42px;font-size:0.9rem;"
        >
          <LockIcon :size="15"/>
          {{ passwordLoading ? 'Bezig met opslaan...' : 'Wachtwoord Wijzigen' }}
        </button>

      </form>
    </div>
  </div>
</template>

<script>
import { Lock as LockIcon, Eye as EyeIcon, EyeOff as EyeOffIcon } from 'lucide-vue-next';
import { useAccountStore } from '@/stores/AccountStore';

export default {
  components: { LockIcon, EyeIcon, EyeOffIcon },

  data() {
    return {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      passwordError: '',
      passwordSuccess: '',
      passwordLoading: false,
      showCurrentPassword: false,
      showNewPassword: false,
      showConfirmPassword: false,
    };
  },

  setup() {
    return { accountStore: useAccountStore() };
  },

  methods: {
    async handleChangePassword() {
      this.passwordError = '';
      this.passwordSuccess = '';
      this.accountStore.error = ''; // ← voorkomt dat de error onder email verschijnt

      if (this.newPassword.length < 6) {
        this.passwordError = 'Wachtwoord moet minimaal 6 tekens bevatten.';
        return;
      }

      if (this.newPassword !== this.confirmPassword) {
        this.passwordError = 'Wachtwoorden komen niet overeen.';
        return;
      }

      this.passwordLoading = true;

      const success = await this.accountStore.changePassword(
        this.currentPassword,
        this.newPassword
      );

      if (success) {
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.showCurrentPassword = false;
        this.showNewPassword = false;
        this.showConfirmPassword = false;
        this.passwordSuccess = '✅ Wachtwoord succesvol gewijzigd!';
        setTimeout(() => { this.passwordSuccess = ''; }, 5000);
      } else {
        this.passwordError = this.accountStore.error || 'Er is een fout opgetreden.';
        this.accountStore.error = ''; // ← leeg maken zodat het niet onder email blijft staan
      }

      this.passwordLoading = false;
    },
  }
};
</script>
