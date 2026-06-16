import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getItem, setItem } from '@/utils/storage'

const ADMIN_THEME_KEY = 'admin_theme'
const CLIENT_THEME_KEY = 'client_theme'

export const useAppStore = defineStore('app', () => {
  const theme = ref<'light' | 'dark'>('light')
  const isAdminMode = ref(false)

  async function loadTheme(adminMode: boolean = false) {
    isAdminMode.value = adminMode
    const key = adminMode ? ADMIN_THEME_KEY : CLIENT_THEME_KEY
    const savedTheme = await getItem<'light' | 'dark'>(key)
    if (savedTheme) {
      theme.value = savedTheme
    }
    const currentTheme = document.documentElement.getAttribute('data-theme')
    if (currentTheme !== savedTheme) {
      document.documentElement.setAttribute('data-theme', theme.value)
    }
  }

  async function setTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme
    const key = isAdminMode.value ? ADMIN_THEME_KEY : CLIENT_THEME_KEY
    await setItem(key, newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
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
    loadTheme,
    setTheme,
    isLoading,
    setLoading,
    toast,
    showToast,
  }
})
