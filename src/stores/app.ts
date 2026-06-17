import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getItem, setItem } from '@/utils/storage'

const ADMIN_THEME_KEY = 'admin_theme'
const CLIENT_THEME_KEY = 'client_theme'

type ThemePreference = 'light' | 'dark' | 'system'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useAppStore = defineStore('app', () => {
  const theme = ref<ThemePreference>('system')
  const isAdminMode = ref(false)
  const systemTheme = ref<'light' | 'dark'>(getSystemTheme())

  // 实际生效的主题（解析 system 后的结果）
  const resolvedTheme = computed<'light' | 'dark'>(() => {
    return theme.value === 'system' ? systemTheme.value : theme.value
  })

  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (e: MediaQueryListEvent) => {
    systemTheme.value = e.matches ? 'dark' : 'light'
    if (theme.value === 'system') {
      document.documentElement.setAttribute('data-theme', systemTheme.value)
    }
  })

  async function loadTheme(adminMode: boolean = false) {
    isAdminMode.value = adminMode
    const key = adminMode ? ADMIN_THEME_KEY : CLIENT_THEME_KEY
    const savedTheme = await getItem<ThemePreference>(key)
    if (savedTheme) {
      theme.value = savedTheme
    }
    const effective = theme.value === 'system' ? systemTheme.value : theme.value
    const currentTheme = document.documentElement.getAttribute('data-theme')
    if (currentTheme !== effective) {
      document.documentElement.setAttribute('data-theme', effective)
    }
  }

  async function setTheme(newTheme: ThemePreference) {
    theme.value = newTheme
    const key = isAdminMode.value ? ADMIN_THEME_KEY : CLIENT_THEME_KEY
    await setItem(key, newTheme)
    const effective = newTheme === 'system' ? systemTheme.value : newTheme
    document.documentElement.setAttribute('data-theme', effective)
  }

  const isLoading = ref(false)

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  const toast = ref<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'info'
  }>({
    show: false,
    message: '',
    type: 'info',
  })

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    toast.value = { show: true, message, type }
    setTimeout(() => {
      toast.value.show = false
    }, 3000)
  }

  return {
    theme,
    resolvedTheme,
    loadTheme,
    setTheme,
    isLoading,
    setLoading,
    toast,
    showToast,
  }
})
