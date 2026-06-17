<script setup lang="ts">
import { ref, onMounted, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import { getItem, setItem, removeItem } from '@/utils/storage'
import type { Dish } from '@/types'
import ClientLayout from '@/client/components/ClientLayout.vue'
import DishCard from '@/client/components/DishCard.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { ArrowLeft, Search, X, Trash2 } from 'lucide-vue-next'

const router = useRouter()
const appStore = useAppStore()

const searchQuery = ref('')
const searchResults = ref<Dish[]>([])
const searchHistory = ref<string[]>([])
const searching = ref(false)
const hasSearched = ref(false)
const showClearConfirm = ref(false)

const SEARCH_HISTORY_KEY = 'searchHistory'

async function loadHistory() {
  const history = await getItem<string[]>(SEARCH_HISTORY_KEY)
  if (history) {
    searchHistory.value = history
  }
}

async function saveHistory(query: string) {
  const history = searchHistory.value.filter(h => h !== query)
  history.unshift(query)
  searchHistory.value = history.slice(0, 10)
  await setItem(SEARCH_HISTORY_KEY, toRaw(searchHistory.value))
}

function clearHistory() {
  showClearConfirm.value = true
}

async function confirmClearHistory() {
  searchHistory.value = []
  await removeItem(SEARCH_HISTORY_KEY)
  showClearConfirm.value = false
}

async function removeHistoryItem(index: number) {
  searchHistory.value.splice(index, 1)
  await setItem(SEARCH_HISTORY_KEY, toRaw(searchHistory.value))
}

async function handleSearch() {
  if (!searchQuery.value.trim()) return
  
  try {
    searching.value = true
    hasSearched.value = true
    const res = await api.searchDishes(searchQuery.value.trim())
    searchResults.value = res.data
    await saveHistory(searchQuery.value.trim())
  } catch (error) {
    console.error('Search failed:', error)
    appStore.showToast('搜索失败', 'error')
  } finally {
    searching.value = false
  }
}

function useHistoryItem(query: string) {
  searchQuery.value = query
  handleSearch()
}

function handleDishClick(dish: Dish) {
  router.push(`/dish/${dish.id}`)
}

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <ClientLayout>
    <div class="search-page">
      <!-- Search Header -->
      <header class="search-header">
        <button class="back-btn" @click="router.back()">
          <ArrowLeft :size="20" />
        </button>
        <div class="search-input-wrapper">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索点什么..."
            class="search-input"
            @keyup.enter="handleSearch"
          />
          <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
            <X :size="16" />
          </button>
        </div>
        <button class="search-btn" @click="handleSearch">
          <Search :size="20" />
        </button>
      </header>

      <!-- Content -->
      <div class="search-content">
        <!-- Search Results -->
        <template v-if="hasSearched">
          <div v-if="searching" class="loading-container">
            <div class="loading-spinner"></div>
          </div>
          
          <div v-else-if="searchResults.length === 0" class="empty-state">
            未找到相关菜品
          </div>
          
          <div v-else class="results-grid">
            <DishCard
              v-for="dish in searchResults"
              :key="dish.id"
              :dish="dish"
              @click="handleDishClick(dish)"
            />
          </div>
        </template>

        <!-- Search History -->
        <template v-else>
          <div class="history-section" v-if="searchHistory.length > 0">
            <div class="history-header">
              <h3>搜索历史</h3>
              <button class="clear-history-btn" @click="clearHistory">
                <Trash2 :size="16" />
                清空
              </button>
            </div>
            <div class="history-tags">
              <button
                v-for="(item, index) in searchHistory"
                :key="index"
                class="history-tag"
                @click="useHistoryItem(item)"
              >
                {{ item }}
                <span class="remove-tag" @click.stop="removeHistoryItem(index)">
                  <X :size="12" />
                </span>
              </button>
            </div>
          </div>
          
          <div v-else class="empty-state">
            输入关键词搜索菜品
          </div>
        </template>
      </div>
    </div>

    <!-- Clear History Confirmation Dialog -->
    <ConfirmDialog
      v-model:show="showClearConfirm"
      title="清空搜索历史"
      message="确定要清空搜索历史吗？"
      @confirm="confirmClearHistory"
    />
  </ClientLayout>
</template>

<style scoped>
.search-page {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
}

.search-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-bg-secondary);
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--color-text-primary);
  transition: background-color var(--transition-fast);
}

.back-btn:hover {
  background-color: var(--color-bg-tertiary);
}

.search-input-wrapper {
  flex: 1;
  position: relative;
}

.search-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-lg);
  padding-right: 32px;
  border-radius: var(--radius-full);
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-light);
  font-size: 0.875rem;
}

.search-input:focus {
  border-color: var(--color-primary);
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--color-text-muted);
}

.clear-btn:hover {
  background-color: var(--color-border-light);
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--color-primary);
  color: white;
  transition: background-color var(--transition-fast);
}

.search-btn:hover {
  background-color: var(--color-primary-dark);
}

.search-content {
  padding: var(--spacing-md);
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: var(--spacing-2xl);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--color-text-muted);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.history-section {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
}

.history-header h3 {
  font-size: 0.875rem;
  font-weight: 500;
}

.clear-history-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.clear-history-btn:hover {
  color: var(--color-error);
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.history-tag {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.history-tag:hover {
  background-color: var(--color-border-light);
}

.remove-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.remove-tag:hover {
  background-color: var(--color-text-muted);
  color: white;
}
</style>
