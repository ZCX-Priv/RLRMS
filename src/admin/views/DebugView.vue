<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DebugToolsPanel from '@/admin/components/DebugToolsPanel.vue'

const route = useRoute()
const pageTitle = computed(() => (route.meta.title as string) || '调试工具')
</script>

<template>
  <div class="debug-page">
    <h1 class="page-title">
      {{ pageTitle }}
    </h1>
    <DebugToolsPanel />
  </div>
</template>

<style scoped>
.debug-page {
  max-width: 1200px;
  overflow: hidden;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: var(--spacing-xl);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
</style>
