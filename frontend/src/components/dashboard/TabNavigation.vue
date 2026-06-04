<template>
  <div class="tabs-nav shadow-sm">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ active: activeTab === tab.id }"
      @click="$emit('update:activeTab', tab.id)"
    >
      <component :is="tab.icon" :size="20" />
      {{ tab.label }}
    </button>
  </div>
</template>

<script>
export default { props: ['tabs', 'activeTab'] }
</script>

<style scoped>
.tabs-nav {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 3px;
  display: inline-flex;
  gap: 4px;
  margin-bottom: 1.25rem;
}

.tab-item {
  border: none;
  background: transparent;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
  line-height: 1.2;
}

.tab-item.active {
  background: #f1f5f9;
  color: #0f172a;
}
</style>
