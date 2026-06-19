<script setup lang="ts">
import DebugToolsPanel from '@/admin/components/DebugToolsPanel.vue'
import { Wrench } from 'lucide-vue-next'
</script>

<template>
  <div class="debug-page">
    <h1 class="page-title">
      <Wrench :size="22" />
      调试工具
    </h1>
    <DebugToolsPanel />
  </div>
</template>

<style scoped>
.debug-page {
  max-width: 1200px;
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
