import { ref, onMounted, onUnmounted } from 'vue'

interface OrderPollingOptions {
  interval?: number
  onNewOrder?: (count: number) => void
}

export function useOrderPolling(
  fetchFunction: () => Promise<void>,
  options: OrderPollingOptions = {}
) {
  const { interval = 5000, onNewOrder } = options
  const isPolling = ref(false)
  const lastOrderCount = ref(0)
  let pollingTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (pollingTimer) return
    isPolling.value = true
    pollingTimer = setInterval(async () => {
      try {
        await fetchFunction()
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, interval)
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
    isPolling.value = false
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      stopPolling()
    } else {
      startPolling()
    }
  }

  function checkForNewOrders(currentCount: number) {
    if (lastOrderCount.value > 0 && currentCount > lastOrderCount.value) {
      const newCount = currentCount - lastOrderCount.value
      onNewOrder?.(newCount)
    }
    lastOrderCount.value = currentCount
  }

  onMounted(() => {
    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    stopPolling()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })

  return {
    isPolling,
    startPolling,
    stopPolling,
    checkForNewOrders,
  }
}
