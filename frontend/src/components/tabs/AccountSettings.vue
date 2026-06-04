<template>
  <div class="account-settings">
    <ProfileCard @profile-updated="$emit('profile-updated', $event)" />
    <PasswordCard />
    <AccountInfoCard />
  </div>
</template>

<script>
import ProfileCard from './AccountSettings/ProfileCard.vue';
import PasswordCard from './AccountSettings/PasswordCard.vue';
import AccountInfoCard from './AccountSettings/AccountInfoCard.vue';

export default {
  components: { ProfileCard, PasswordCard, AccountInfoCard },
  emits: ['profile-updated'],
};
</script>
