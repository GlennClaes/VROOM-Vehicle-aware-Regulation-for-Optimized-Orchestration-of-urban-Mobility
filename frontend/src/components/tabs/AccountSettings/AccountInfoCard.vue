<template>
  <div class="card shadow-sm border-0 rounded-3 overflow-hidden mt-4">

    <div class="card-header bg-light border-bottom py-3">
      <div class="d-flex align-items-center gap-3">
        <div class="bg-primary bg-opacity-10 text-primary rounded-3 d-flex align-items-center justify-content-center"
             style="width:44px;height:44px;">
          <InfoIcon :size="20"/>
        </div>
        <div>
          <h2 class="fw-semibold mb-0 text-dark" style="font-size:1rem;">Account Informatie</h2>
          <p class="text-body-secondary mb-0" style="font-size:0.85rem;">
            Uw account details en activiteit
          </p>
        </div>
      </div>
    </div>

    <div class="card-body p-4">
      <div style="font-size:0.9rem;">

        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <span class="text-body-secondary">Account ID</span>
          <span class="font-monospace text-dark">
            {{ accountStore.user?.id || '-' }}
          </span>
        </div>

        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
          <span class="text-body-secondary">Aangemaakt op</span>
          <span class="text-dark">
            {{ formatBrusselsTime(accountStore.user?.created_at, false) }}
          </span>
        </div>

        <div class="d-flex justify-content-between align-items-center py-2">
          <span class="text-body-secondary">Laatst ingelogd</span>
          <span class="text-dark">
            {{ formatBrusselsTime(accountStore.user?.last_sign_in_at, true) }}
          </span>
        </div>

      </div>
    </div>
  </div>
</template>

<script>
import { Info as InfoIcon } from 'lucide-vue-next';
import { useAccountStore } from '@/stores/AccountStore.js';

export default {
  components: { InfoIcon },

  setup() {
    const accountStore = useAccountStore();

    const formatBrusselsTime = (dateString, includeTime = false) => {
      if (!dateString) return '-';
      const date = new Date(dateString);
      const options = {
        timeZone: 'Europe/Brussels',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      };

      if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
      }

      return new Intl.DateTimeFormat('nl-BE', options).format(date);
    };

    return { accountStore, formatBrusselsTime };
  },
};
</script>
