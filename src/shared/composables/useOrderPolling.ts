import { ref } from 'vue'

interface OrderPollingOptions {
  interval?: number
  /** 返回 false 时跳过本次轮询（例如 SSE 已连接时） */
  shouldPoll?: () => boolean
}

export function useOrderPolling(
  fetchFunction: () => Promise<void>,
  options: OrderPollingOptions = {}
) {
  const { interval = 5000, shouldPoll } = options
  const isPolling = ref(false)
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

  return {
    isPolling,
    startPolling,
    stopPolling,
  }
}
