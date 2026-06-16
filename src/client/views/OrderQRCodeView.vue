<script setup lang="ts">
// Placeholder for Order QR Code View - redirects to order detail
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

onMounted(() => {
  const orderId = route.params.id
  router.replace(`/order/${orderId}`)
})
</script>

<template>
  <div></div>
</template>
