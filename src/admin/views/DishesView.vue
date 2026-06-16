<script setup lang="ts">
import { ref, onMounted, computed, defineAsyncComponent } from 'vue'
import { api } from '@/api'
import { useAppStore } from '@/stores/app'
import type { Dish, Category } from '@/types'
import draggable from 'vuedraggable'

const Modal = defineAsyncComponent(() => import('@/shared/components/Modal.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/shared/components/ConfirmDialog.vue'))
import { Plus, Edit, Trash2, Image, ChefHat, Upload, X, GripVertical } from 'lucide-vue-next'

const appStore = useAppStore()

const dishes = ref<Dish[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const initialized = ref(false)
const showAddModal = ref(false)
const showCategoryModal = ref(false)
const editingDish = ref<Dish | null>(null)
const uploading = ref(false)
const selectedCategory = ref<string>('')
const formData = ref({
  name: '',
  price: 0,
  category_id: null as string | null,
  description: '',
  tags: [] as string[],
  specs: [] as string[],
  image_url: null as string | null,
  status: 'on_sale' as 'on_sale' | 'off_sale',
})

const defaultTags = ['推荐', '招牌', '新品', '火爆']
const customTags = ref<string[]>([])
const newCategoryName = ref('')
const newTagName = ref('')
const showDeleteConfirm = ref(false)
const showCategoryDeleteConfirm = ref(false)
const dishToDelete = ref<Dish | null>(null)
const categoryToDelete = ref<string>('')

const allTags = computed(() => [...defaultTags, ...customTags.value])

const filteredDishes = computed({
  get: () => {
    if (!selectedCategory.value) {
      return dishes.value
    }
    return dishes.value.filter(dish => dish.category_id === selectedCategory.value)
  },
  set: (value) => {
    if (!selectedCategory.value) {
      dishes.value = value
      return
    }
    
    const otherDishes = dishes.value.filter(dish => dish.category_id !== selectedCategory.value)
    dishes.value = [...otherDishes, ...value]
  }
})

async function onDishesDragEnd(event: { oldIndex: number; newIndex: number }) {
  if (event.oldIndex === event.newIndex) return
  
  const orders = dishes.value.map((item, index) => ({
    id: item.id,
    sort_order: index
  }))
  
  try {
    await api.reorderDishes(orders)
  } catch (error) {
    console.error('Failed to save order:', error)
    appStore.showToast('排序保存失败', 'error')
    fetchData(false)
  }
}

async function onCategoriesDragEnd(event: { oldIndex: number; newIndex: number }) {
  if (event.oldIndex === event.newIndex) return
  
  const orders = categories.value.map((item, index) => ({
    id: item.id,
    sort_order: index
  }))
  
  try {
    await api.reorderCategories(orders)
  } catch (error) {
    console.error('Failed to save order:', error)
    appStore.showToast('排序保存失败', 'error')
    fetchData(false)
  }
}

async function fetchData(showLoading = true) {
  try {
    if (showLoading && !initialized.value) {
      loading.value = true
    }
    const [dishesRes, categoriesRes] = await Promise.all([
      api.getAdminDishes(),
      api.getAdminCategories(),
    ])
    dishes.value = dishesRes.data
    categories.value = categoriesRes.data
    initialized.value = true
  } catch (error) {
    console.error('Failed to fetch data:', error)
    appStore.showToast('获取数据失败', 'error')
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  editingDish.value = null
  formData.value = {
    name: '',
    price: 0,
    category_id: null,
    description: '',
    tags: [],
    specs: [],
    image_url: null,
    status: 'on_sale',
  }
  showAddModal.value = true
}

function openEditModal(dish: Dish) {
  editingDish.value = dish
  formData.value = {
    name: dish.name,
    price: dish.price,
    category_id: dish.category_id || null,
    description: dish.description || '',
    tags: dish.tags || [],
    specs: dish.specs || [],
    image_url: dish.image_url || null,
    status: dish.status as 'on_sale' | 'off_sale',
  }
  showAddModal.value = true
}

function toggleTag(tag: string) {
  const index = formData.value.tags.indexOf(tag)
  if (index >= 0) {
    formData.value.tags.splice(index, 1)
  } else {
    formData.value.tags.push(tag)
  }
}

async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  
  try {
    uploading.value = true
    const res = await api.uploadImage(file)
    formData.value.image_url = res.data.url
    appStore.showToast('图片上传成功', 'success')
  } catch (error) {
    console.error('Failed to upload image:', error)
    appStore.showToast('图片上传失败', 'error')
  } finally {
    uploading.value = false
    target.value = ''
  }
}

function removeImage() {
  formData.value.image_url = ''
}

async function handleSave() {
  try {
    if (editingDish.value) {
      const res = await api.updateDish(editingDish.value.id, formData.value)
      const index = dishes.value.findIndex(d => d.id === editingDish.value!.id)
      if (index !== -1 && res.data) {
        dishes.value[index] = res.data
      }
      appStore.showToast('菜品已更新', 'success')
    } else {
      const res = await api.createDish(formData.value)
      if (res.data) {
        dishes.value.unshift(res.data)
      }
      appStore.showToast('菜品已创建', 'success')
    }
    showAddModal.value = false
  } catch (error) {
    console.error('Failed to save dish:', error)
    const errorMessage = error instanceof Error ? error.message : '操作失败'
    appStore.showToast(errorMessage, 'error')
  }
}

async function handleDelete(dish: Dish) {
  dishToDelete.value = dish
  showDeleteConfirm.value = true
}

async function confirmDeleteDish() {
  if (!dishToDelete.value) return
  const dishId = dishToDelete.value.id
  const index = dishes.value.findIndex(d => d.id === dishId)
  const deletedDish = index !== -1 ? dishes.value[index] : null
  
  if (index !== -1) {
    dishes.value.splice(index, 1)
  }
  
  try {
    await api.deleteDish(dishId)
    appStore.showToast('菜品已删除', 'success')
  } catch (error) {
    console.error('Failed to delete dish:', error)
    if (deletedDish && index !== -1) {
      dishes.value.splice(index, 0, deletedDish)
    }
    appStore.showToast('删除失败', 'error')
  } finally {
    showDeleteConfirm.value = false
    dishToDelete.value = null
  }
}

async function handleCreateCategory() {
  const name = newCategoryName.value.trim()
  if (!name) return
  
  if (name === '其他') {
    appStore.showToast('"其他"为系统保留名称，无法使用', 'error')
    return
  }
  
  if (categories.value.some(cat => cat.name === name)) {
    appStore.showToast('该分类名称已存在', 'error')
    return
  }
  
  try {
    const res = await api.createCategory(name)
    if (res.data) {
      categories.value.push(res.data)
    }
    appStore.showToast('分类已创建', 'success')
    newCategoryName.value = ''
    showCategoryModal.value = false
  } catch (error) {
    console.error('Failed to create category:', error)
    const errorMessage = error instanceof Error ? error.message : '创建分类失败'
    appStore.showToast(errorMessage, 'error')
  }
}

async function handleDeleteCategory(categoryId: string) {
  categoryToDelete.value = categoryId
  showCategoryDeleteConfirm.value = true
}

async function confirmDeleteCategory() {
  if (!categoryToDelete.value) return
  const categoryId = categoryToDelete.value
  const index = categories.value.findIndex(c => c.id === categoryId)
  const deletedCategory = index !== -1 ? categories.value[index] : null
  
  if (index !== -1) {
    categories.value.splice(index, 1)
  }
  
  dishes.value.forEach(dish => {
    if (dish.category_id === categoryId) {
      dish.category_id = null
      dish.category_name = null
    }
  })
  
  if (selectedCategory.value === categoryId) {
    selectedCategory.value = ''
  }
  
  try {
    await api.deleteCategory(categoryId)
    appStore.showToast('分类已删除', 'success')
  } catch (error) {
    console.error('Failed to delete category:', error)
    if (deletedCategory && index !== -1) {
      categories.value.splice(index, 0, deletedCategory)
    }
    const errorMessage = error instanceof Error ? error.message : '删除分类失败'
    appStore.showToast(errorMessage, 'error')
  } finally {
    showCategoryDeleteConfirm.value = false
    categoryToDelete.value = ''
  }
}

function addCustomTag() {
  const tag = newTagName.value.trim()
  if (tag && !allTags.value.includes(tag)) {
    customTags.value.push(tag)
    newTagName.value = ''
  }
}

function removeCustomTag(tag: string) {
  const index = customTags.value.indexOf(tag)
  if (index >= 0) {
    customTags.value.splice(index, 1)
    const formTagIndex = formData.value.tags.indexOf(tag)
    if (formTagIndex >= 0) {
      formData.value.tags.splice(formTagIndex, 1)
    }
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="dishes-page">
    <div class="page-header">
      <h1 class="page-title">菜单管理</h1>
      <div class="header-actions">
        <button class="btn btn-primary" @click="openAddModal">
          <Plus :size="18" />
          添加菜品
        </button>
      </div>
    </div>

    <div class="category-tabs">
      <button
        class="category-tab"
        :class="{ 'category-tab-active': !selectedCategory }"
        @click="selectedCategory = ''"
      >
        全部
      </button>
      <draggable
        v-model="categories"
        item-key="id"
        class="category-tabs-draggable"
        :animation="200"
        ghost-class="ghost-category"
        @end="onCategoriesDragEnd"
      >
        <template #item="{ element: cat }">
          <button
            class="category-tab"
            :class="{ 'category-tab-active': selectedCategory === cat.id }"
            @click="selectedCategory = cat.id"
          >
            <GripVertical :size="12" class="drag-handle" />
            {{ cat.name }}
            <span class="category-count">{{ dishes.filter(d => d.category_id === cat.id).length }}</span>
            <span class="category-delete" @click.stop="handleDeleteCategory(cat.id)">
              <X :size="12" />
            </span>
          </button>
        </template>
      </draggable>
      <button class="category-tab category-tab-add" @click="showCategoryModal = true">
        <Plus :size="16" />
        添加分类
      </button>
    </div>

    <div v-if="loading && !initialized" class="loading-state">
      <div class="loading-spinner"></div>
    </div>

    <div v-else-if="initialized && filteredDishes.length === 0" class="empty-state">
      <div class="empty-icon">
        <ChefHat :size="64" />
      </div>
      <h3 class="empty-title">暂无菜品</h3>
      <p class="empty-description">点击上方按钮添加第一道菜品</p>
    </div>

    <draggable
      v-else
      v-model="filteredDishes"
      item-key="id"
      class="dishes-list"
      :animation="200"
      ghost-class="ghost-dish"
      handle=".drag-handle-dish"
      @end="onDishesDragEnd"
    >
      <template #item="{ element: dish }">
        <div class="dish-item">
          <div class="drag-handle-dish">
            <GripVertical :size="16" />
          </div>
          <div class="dish-image">
            <img v-if="dish.image_url" :src="dish.image_url" :alt="dish.name" />
            <div v-else class="image-placeholder">
              <Image :size="24" />
            </div>
          </div>
          
          <div class="dish-info">
            <h3 class="dish-name">{{ dish.name }}</h3>
            <p class="dish-category">{{ dish.category_name || '其他' }}</p>
            <div class="dish-tags">
              <span v-for="tag in dish.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>

          <div class="dish-price">{{ dish.price }}元</div>

          <div class="dish-status" :class="dish.status === 'on_sale' ? 'status-on' : 'status-off'">
            {{ dish.status === 'on_sale' ? '上架' : '下架' }}
          </div>

          <div class="dish-actions">
            <button class="action-btn" @click="openEditModal(dish)">
              <Edit :size="16" />
            </button>
            <button class="action-btn action-btn-danger" @click="handleDelete(dish)">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </template>
    </draggable>

    <!-- Add/Edit Modal -->
    <Modal
      :show="showAddModal"
      :title="editingDish ? '编辑菜品' : '添加菜品'"
      size="lg"
      @close="showAddModal = false"
    >
      <div class="form-grid">
        <div class="form-group full-width">
          <label>菜品图片</label>
          <div class="image-upload">
            <div v-if="formData.image_url" class="image-preview">
              <img :src="formData.image_url" alt="菜品图片" />
              <button type="button" class="remove-image-btn" @click="removeImage">
                <X :size="16" />
              </button>
            </div>
            <label v-else class="upload-area" :class="{ 'uploading': uploading }">
              <input
                type="file"
                accept="image/*"
                hidden
                :disabled="uploading"
                @change="handleImageUpload"
              />
              <Upload v-if="!uploading" :size="32" />
              <div v-else class="loading-spinner-small"></div>
              <span>{{ uploading ? '上传中...' : '点击上传图片' }}</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>菜品名称</label>
          <input v-model="formData.name" type="text" placeholder="请输入菜品名称" />
        </div>

        <div class="form-group">
          <label>价格(元)</label>
          <input v-model="formData.price" type="number" min="0" step="0.01" />
        </div>

        <div class="form-group">
          <label>分类</label>
          <select v-model="formData.category_id">
            <option :value="null">其他</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>状态</label>
          <select v-model="formData.status">
            <option value="on_sale">上架</option>
            <option value="off_sale">下架</option>
          </select>
        </div>

        <div class="form-group full-width">
          <label>描述</label>
          <textarea v-model="formData.description" rows="3" placeholder="菜品描述"></textarea>
        </div>

        <div class="form-group full-width">
          <label>标签</label>
          <div class="tags-input">
            <button
              v-for="tag in defaultTags"
              :key="tag"
              class="tag-btn"
              :class="{ 'tag-btn-active': formData.tags.includes(tag) }"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </button>
            <button
              v-for="tag in customTags"
              :key="tag"
              class="tag-btn tag-btn-custom"
              :class="{ 'tag-btn-active': formData.tags.includes(tag) }"
              @click="toggleTag(tag)"
            >
              {{ tag }}
              <span class="remove-tag" @click.stop="removeCustomTag(tag)">
                <X :size="12" />
              </span>
            </button>
          </div>
          <div class="add-tag-row">
            <input
              v-model="newTagName"
              type="text"
              placeholder="添加自定义标签"
              class="add-tag-input"
              @keyup.enter="addCustomTag"
            />
            <button type="button" class="btn btn-sm btn-secondary" @click="addCustomTag">
              添加
            </button>
          </div>
        </div>

        <div class="form-group full-width">
          <label>规格 (用逗号分隔)</label>
          <input
            v-model="formData.specs"
            type="text"
            placeholder="大份,中份,小份"
            @input="formData.specs = ($event.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean)"
          />
        </div>
      </div>

      <template #footer>
        <button class="btn btn-secondary" @click="showAddModal = false">取消</button>
        <button class="btn btn-primary" @click="handleSave">保存</button>
      </template>
    </Modal>

    <!-- Category Modal -->
    <Modal
      :show="showCategoryModal"
      title="添加分类"
      size="sm"
      @close="showCategoryModal = false"
    >
      <div class="form-group">
        <label>分类名称</label>
        <input
          v-model="newCategoryName"
          type="text"
          placeholder="请输入分类名称"
          @keyup.enter="handleCreateCategory"
        />
      </div>
      <template #footer>
        <button class="btn btn-secondary" @click="showCategoryModal = false">取消</button>
        <button class="btn btn-primary" @click="handleCreateCategory">创建</button>
      </template>
    </Modal>

    <!-- Delete Dish Confirm Dialog -->
    <ConfirmDialog
      :show="showDeleteConfirm"
      message="确定要删除该菜品吗？"
      @confirm="confirmDeleteDish"
      @cancel="showDeleteConfirm = false"
    />

    <!-- Delete Category Confirm Dialog -->
    <ConfirmDialog
      :show="showCategoryDeleteConfirm"
      message="确定要删除该分类吗？"
      @confirm="confirmDeleteCategory"
      @cancel="showCategoryDeleteConfirm = false"
    />
  </div>
</template>

<style scoped>
.dishes-page {
  max-width: 1200px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
}

.category-tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);
  flex-wrap: wrap;
  align-items: center;
}

.category-tabs-draggable {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background-color: var(--color-bg-secondary);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  cursor: grab;
}

.category-tab:active {
  cursor: grabbing;
}

.ghost-category {
  opacity: 0.5;
  background: var(--color-primary-light, rgba(220, 38, 38, 0.1));
}

.drag-handle {
  opacity: 0.4;
  cursor: grab;
  flex-shrink: 0;
}

.drag-handle:hover {
  opacity: 1;
}

.category-tab:hover:not(.category-tab-active) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.category-tab-active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.category-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 0.75rem;
  border-radius: var(--radius-full);
  background-color: rgba(255, 255, 255, 0.2);
}

.category-tab:not(.category-tab-active) .category-count {
  background-color: var(--color-bg-tertiary);
}

.category-tab-add {
  border-style: dashed;
  color: var(--color-text-muted);
}

.category-tab-add:hover {
  border-style: solid;
  color: var(--color-primary);
}

.category-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 0;
  height: 16px;
  margin-left: 0;
  border-radius: var(--radius-full);
  background-color: rgba(255, 255, 255, 0.2);
  transition: all 0.25s ease;
  overflow: hidden;
  opacity: 0;
}

.category-tab:hover .category-delete {
  width: 16px;
  margin-left: var(--spacing-xs);
  opacity: 1;
}

.category-delete:hover {
  background-color: rgba(255, 255, 255, 0.4);
}

.loading-state {
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl) var(--spacing-xl);
  text-align: center;
}

.empty-icon {
  width: 100px;
  height: 100px;
  border-radius: var(--radius-xl);
  background: linear-gradient(135deg, var(--color-primary-light, rgba(220, 38, 38, 0.1)) 0%, var(--color-bg-tertiary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-xl);
  color: var(--color-primary);
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-sm);
}

.empty-description {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  max-width: 280px;
}

.dishes-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.dish-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  cursor: grab;
  transition: all var(--transition-fast);
}

.dish-item:active {
  cursor: grabbing;
}

.ghost-dish {
  opacity: 0.5;
  background: var(--color-primary-light, rgba(220, 38, 38, 0.1));
  border-radius: var(--radius-lg);
}

.drag-handle-dish {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  opacity: 0.4;
  cursor: grab;
  flex-shrink: 0;
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.drag-handle-dish:hover {
  opacity: 1;
  background-color: var(--color-bg-tertiary);
}

.dish-image {
  width: 60px;
  height: 60px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
}

.dish-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-muted);
}

.dish-info {
  flex: 1;
  min-width: 0;
}

.dish-name {
  font-weight: 500;
  margin-bottom: var(--spacing-xs);
}

.dish-category {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-bottom: var(--spacing-xs);
}

.dish-tags {
  display: flex;
  gap: var(--spacing-xs);
}

.tag {
  padding: 2px var(--spacing-xs);
  font-size: 0.625rem;
  background-color: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
}

.dish-price {
  font-weight: 600;
  color: var(--color-primary);
  min-width: 60px;
  text-align: right;
}

.dish-status {
  padding: 2px var(--spacing-sm);
  font-size: 0.75rem;
  border-radius: var(--radius-full);
}

.status-on {
  background-color: rgba(22, 163, 74, 0.1);
  color: var(--color-success);
}

.status-off {
  background-color: rgba(220, 38, 38, 0.1);
  color: var(--color-error);
}

.dish-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
}

.action-btn:hover {
  background-color: var(--color-bg-tertiary);
}

.action-btn-danger:hover {
  background-color: var(--color-error);
  color: white;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.form-group.full-width {
  grid-column: span 2;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg-primary);
}

.form-group textarea {
  resize: vertical;
}

.tags-input {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.tag-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.tag-btn:hover {
  border-color: var(--color-primary);
}

.tag-btn-active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.tag-btn-custom {
  position: relative;
  padding-right: var(--spacing-lg);
}

.remove-tag {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  background-color: rgba(255, 255, 255, 0.2);
}

.remove-tag:hover {
  background-color: rgba(255, 255, 255, 0.4);
}

.add-tag-row {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.add-tag-input {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.image-upload {
  width: 100%;
}

.image-preview {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
}

.remove-image-btn:hover {
  background-color: var(--color-error);
}

.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  width: 120px;
  height: 120px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.upload-area:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.upload-area.uploading {
  cursor: not-allowed;
  opacity: 0.6;
}

.loading-spinner-small {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group.full-width {
    grid-column: span 1;
  }

  .dish-item {
    flex-wrap: wrap;
  }

  .dish-price,
  .dish-status,
  .dish-actions {
    margin-top: var(--spacing-sm);
  }
}
</style>
