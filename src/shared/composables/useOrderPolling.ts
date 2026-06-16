import { ref, onMounted, onUnmounted } from 'vue'

interface OrderPollingOptions {
  interval?: number
  onNewOrder?: (count: number) => void
  /** 返回 false 时跳过本次轮询（例如 SSE 已连接时） */
  shouldPoll?: () => boolean
}

export function useOrderPolling(
  fetchFunction: () => Promise<void>,
  options: OrderPollingOptions = {}
) {
  const { interval = 5000, onNewOrder, shouldPoll } = options
  const isPolling = ref(false)
  const lastOrderCount = ref(0)
  let pollingTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (pollingTimer) return
    isPolling.value = true
    pollingTimer = setInterval(async () => {
      // 如果提供了 shouldPoll 且返回 false，则跳过本次轮询
      if (shouldPoll && !shouldPoll()) return
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
