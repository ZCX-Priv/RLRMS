<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api'
import {
  Table2, Play, Send, Trash2, Hash, ChevronRight, Copy, AlertCircle, CheckCircle2,
  Database, RefreshCw, LayoutDashboard, Armchair, UtensilsCrossed, FolderOpen,
  ClipboardList, Package, UserCircle, Settings
} from 'lucide-vue-next'

// ===== Tab 切换（由路由驱动） =====
const route = useRoute()
const activeTab = computed<'sql' | 'api'>(() => {
  return route.path === '/admin/debug/api' ? 'api' : 'sql'
})

// ===== SQL Tab 状态 =====
const sqlInput = ref('SELECT * FROM sqlite_master WHERE type="table"')
const sqlLoading = ref(false)
const sqlResult = ref<{ columns: string[]; rows: Record<string, unknown>[]; changes: number } | null>(null)
const sqlError = ref('')

// Schema 浏览器
const schemaLoading = ref(false)
const schemaTables = ref<{ name: string; sql: string; columns: { cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number }[]; foreignKeys: { id: number; seq: number; table: string; from: string; to: string }[] }[]>([])
const selectedTable = ref('')
const tableDataLoading = ref(false)
const tableData = ref<Record<string, unknown>[]>([])
const tableDataColumns = ref<string[]>([])
const tableDataPage = ref(0)
const TABLE_PAGE_SIZE = 50

// ===== API Tab 状态 =====
interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  params?: { name: string; type: 'path' | 'query' | 'body'; default?: string }[]
  defaultBody?: string
}

interface ApiGroup {
  name: string
  icon: Component
  endpoints: ApiEndpoint[]
}

const apiGroups: ApiGroup[] = [
  {
    name: '仪表板',
    icon: LayoutDashboard,
    endpoints: [
      { method: 'GET', path: '/admin/dashboard', description: '获取仪表板统计数据' }
    ]
  },
  {
    name: '桌位管理',
    icon: Armchair,
    endpoints: [
      { method: 'GET', path: '/admin/tables', description: '获取所有桌位列表' },
      { method: 'POST', path: '/admin/tables', description: '创建新桌位', defaultBody: '{\n  "table_no": "A1",\n  "name": "大厅1号桌",\n  "capacity": 4\n}' },
      { method: 'PUT', path: '/admin/tables/:id', description: '更新桌位信息', params: [{ name: 'id', type: 'path' }], defaultBody: '{\n  "name": "新名称",\n  "capacity": 6\n}' },
      { method: 'DELETE', path: '/admin/tables/:id', description: '删除桌位', params: [{ name: 'id', type: 'path' }] }
    ]
  },
  {
    name: '菜品管理',
    icon: UtensilsCrossed,
    endpoints: [
      { method: 'GET', path: '/admin/dishes', description: '获取所有菜品列表' },
      { method: 'POST', path: '/admin/dishes', description: '创建新菜品', defaultBody: '{\n  "name": "新菜品",\n  "price": 28.0,\n  "category_id": "",\n  "description": "菜品描述",\n  "tags": ["推荐"],\n  "specs": []\n}' },
      { method: 'PUT', path: '/admin/dishes/:id', description: '更新菜品信息', params: [{ name: 'id', type: 'path' }], defaultBody: '{\n  "name": "更新名称",\n  "price": 38.0\n}' },
      { method: 'DELETE', path: '/admin/dishes/:id', description: '删除菜品', params: [{ name: 'id', type: 'path' }] }
    ]
  },
  {
    name: '分类管理',
    icon: FolderOpen,
    endpoints: [
      { method: 'GET', path: '/admin/categories', description: '获取所有分类列表' },
      { method: 'POST', path: '/admin/categories', description: '创建新分类', defaultBody: '{\n  "name": "新分类",\n  "sort_order": 0\n}' },
      { method: 'DELETE', path: '/admin/categories/:id', description: '删除分类', params: [{ name: 'id', type: 'path' }] }
    ]
  },
  {
    name: '订单管理',
    icon: ClipboardList,
    endpoints: [
      { method: 'GET', path: '/admin/orders', description: '获取所有订单列表', params: [{ name: 'status', type: 'query' }, { name: 'startDate', type: 'query' }, { name: 'endDate', type: 'query' }] },
      { method: 'GET', path: '/admin/orders/search', description: '按订单号搜索订单', params: [{ name: 'order_no', type: 'query' }] },
      { method: 'PUT', path: '/admin/orders/:id/status', description: '更新订单状态', params: [{ name: 'id', type: 'path' }], defaultBody: '{\n  "status": "confirmed"\n}' },
      { method: 'DELETE', path: '/admin/orders/:id', description: '删除单条订单', params: [{ name: 'id', type: 'path' }] },
      { method: 'POST', path: '/admin/clear-orders', description: '清空已完成/已取消订单' }
    ]
  },
  {
    name: '库存管理',
    icon: Package,
    endpoints: [
      { method: 'GET', path: '/admin/inventory', description: '获取库存列表' },
      { method: 'POST', path: '/admin/inventory', description: '创建库存项', defaultBody: '{\n  "material_name": "物料名",\n  "quantity": 100,\n  "unit": "kg",\n  "warning_threshold": 10\n}' },
      { method: 'PUT', path: '/admin/inventory/:id', description: '更新库存项', params: [{ name: 'id', type: 'path' }], defaultBody: '{\n  "quantity": 50,\n  "warning_threshold": 10\n}' },
      { method: 'DELETE', path: '/admin/inventory/:id', description: '删除库存项', params: [{ name: 'id', type: 'path' }] }
    ]
  },
  {
    name: '用户管理',
    icon: UserCircle,
    endpoints: [
      { method: 'GET', path: '/admin/users', description: '获取用户列表' },
      { method: 'POST', path: '/admin/users', description: '创建新用户', defaultBody: '{\n  "username": "newuser",\n  "password": "123456",\n  "role": "customer",\n  "name": "新用户",\n  "phone": "13800138000"\n}' },
      { method: 'PUT', path: '/admin/users/:id', description: '更新用户信息', params: [{ name: 'id', type: 'path' }], defaultBody: '{\n  "name": "新名称",\n  "phone": "13800138000"\n}' },
      { method: 'DELETE', path: '/admin/users/:id', description: '删除用户', params: [{ name: 'id', type: 'path' }] }
    ]
  },
  {
    name: '系统设置',
    icon: Settings,
    endpoints: [
      { method: 'GET', path: '/admin/settings', description: '获取系统设置' },
      { method: 'PUT', path: '/admin/settings', description: '更新系统设置', defaultBody: '{\n  "restaurant_name": "红灯笼食府",\n  "business_hours": "11:00-21:00"\n}' },
      { method: 'POST', path: '/admin/reset-database', description: '重置数据库（危险）', defaultBody: '{\n  "confirm": "RESET"\n}' }
    ]
  }
]

// API 调试器状态
const expandedEndpoint = ref<string | null>(null)
const apiParams = ref<Record<string, string>>({})
const apiBody = ref('')
const apiLoading = ref(false)
const apiResponse = ref<{ status: number; data: unknown; duration: number } | null>(null)
const apiError = ref('')

// ===== SQL 执行 =====
async function executeSQL() {
  const sql = sqlInput.value.trim()
  if (!sql) return

  sqlLoading.value = true
  sqlError.value = ''
  sqlResult.value = null

  try {
    const res = await api.debugQuery(sql)
    sqlResult.value = res.data
  } catch (e: unknown) {
    sqlError.value = e instanceof Error ? e.message : '执行失败'
  } finally {
    sqlLoading.value = false
  }
}

// ===== Schema 浏览器 =====
async function loadSchema() {
  schemaLoading.value = true
  try {
    const res = await api.getSchema()
    schemaTables.value = res.data.tables
  } catch (e: unknown) {
    console.error('Failed to load schema:', e)
  } finally {
    schemaLoading.value = false
  }
}

async function selectTable(tableName: string) {
  selectedTable.value = tableName
  tableDataPage.value = 0
  await loadTableData()
}

async function loadTableData() {
  if (!selectedTable.value) return
  tableDataLoading.value = true
  try {
    const offset = tableDataPage.value * TABLE_PAGE_SIZE
    const res = await api.debugQuery(`SELECT * FROM "${selectedTable.value}" LIMIT ${TABLE_PAGE_SIZE} OFFSET ${offset}`)
    tableDataColumns.value = res.data.columns
    tableData.value = res.data.rows
  } catch (e: unknown) {
    console.error('Failed to load table data:', e)
    tableData.value = []
    tableDataColumns.value = []
  } finally {
    tableDataLoading.value = false
  }
}

async function getTableRowCount(tableName: string) {
  try {
    const res = await api.debugQuery(`SELECT COUNT(*) as count FROM "${tableName}"`)
    if (res.data.rows.length > 0) {
      const count = (res.data.rows[0] as Record<string, unknown>).count
      alert(`表 "${tableName}" 共有 ${count} 行数据`)
    }
  } catch (e: unknown) {
    console.error('Failed to count rows:', e)
  }
}

async function clearTableData(tableName: string) {
  if (!confirm(`确定要清空表 "${tableName}" 的所有数据吗？此操作不可撤销！`)) return
  try {
    const res = await api.debugQuery(`DELETE FROM "${tableName}"`)
    alert(`已删除 ${res.data.changes} 行数据`)
    if (selectedTable.value === tableName) {
      await loadTableData()
    }
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : '清空失败')
  }
}

// ===== API 调试器 =====
function toggleEndpoint(key: string) {
  if (expandedEndpoint.value === key) {
    expandedEndpoint.value = null
  } else {
    expandedEndpoint.value = key
    apiParams.value = {}
    apiBody.value = ''
    apiResponse.value = null
    apiError.value = ''

    // 查找 endpoint 并设置默认值
    for (const group of apiGroups) {
      for (const ep of group.endpoints) {
        const epKey = `${ep.method} ${ep.path}`
        if (epKey === key) {
          if (ep.defaultBody) apiBody.value = ep.defaultBody
          if (ep.params) {
            for (const p of ep.params) {
              if (p.default) apiParams.value[p.name] = p.default
              else apiParams.value[p.name] = ''
            }
          }
          return
        }
      }
    }
  }
}

function findEndpoint(key: string): ApiEndpoint | undefined {
  for (const group of apiGroups) {
    for (const ep of group.endpoints) {
      if (`${ep.method} ${ep.path}` === key) return ep
    }
  }
  return undefined
}

async function sendApiRequest(key: string) {
  const ep = findEndpoint(key)
  if (!ep) return

  apiLoading.value = true
  apiResponse.value = null
  apiError.value = ''

  const startTime = performance.now()

  try {
    // 构建实际的 URL 和参数
    let url = ep.path
    // 替换路径参数
    if (ep.params) {
      for (const p of ep.params) {
        if (p.type === 'path') {
          const val = apiParams.value[p.name] || ''
          url = url.replace(`:${p.name}`, encodeURIComponent(val))
        }
      }
    }

    // 添加查询参数
    const queryParams = new URLSearchParams()
    if (ep.params) {
      for (const p of ep.params) {
        if (p.type === 'query' && apiParams.value[p.name]) {
          queryParams.set(p.name, apiParams.value[p.name]!)
        }
      }
    }
    const qs = queryParams.toString()
    if (qs) url += `?${qs}`

    // 构建请求
    const fetchOptions: RequestInit = {
      method: ep.method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    }

    if ((ep.method === 'POST' || ep.method === 'PUT') && apiBody.value.trim()) {
      fetchOptions.body = apiBody.value
    }

    const response = await fetch(`/api${url}`, fetchOptions)
    const duration = Math.round(performance.now() - startTime)

    let data: unknown
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      data = await response.json()
    } else if (contentType.includes('application/zip')) {
      data = '[Binary ZIP data]'
    } else {
      data = await response.text()
    }

    apiResponse.value = { status: response.status, data, duration }
  } catch (e: unknown) {
    const duration = Math.round(performance.now() - startTime)
    apiError.value = e instanceof Error ? e.message : '请求失败'
    apiResponse.value = { status: 0, data: null, duration }
  } finally {
    apiLoading.value = false
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function formatJson(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

function getMethodColor(method: string): string {
  switch (method) {
    case 'GET': return '#22c55e'
    case 'POST': return '#3b82f6'
    case 'PUT': return '#f59e0b'
    case 'DELETE': return '#ef4444'
    default: return '#6b7280'
  }
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return '#22c55e'
  if (status >= 400 && status < 500) return '#f59e0b'
  if (status >= 500) return '#ef4444'
  return '#6b7280'
}

// 初始化加载 schema
loadSchema()
</script>

<script lang="ts">
import { defineComponent, h, ref as defineRef, watch, type PropType } from 'vue'

const MIN_COL_WIDTH = 60
const DEFAULT_COL_WIDTH = 120

const ResizableResultTable = defineComponent({
  name: 'ResizableResultTable',
  props: {
    columns: { type: Array as PropType<string[]>, required: true },
    rows: { type: Array as PropType<Record<string, unknown>[]>, required: true }
  },
  setup(props) {
    const columnWidths = defineRef<number[]>([])

    watch(() => props.columns, (cols) => {
      columnWidths.value = cols.map(() => DEFAULT_COL_WIDTH)
    }, { immediate: true })

    let resizingIndex = -1
    let startX = 0
    let startWidth = 0

    function startResize(e: MouseEvent, index: number) {
      resizingIndex = index
      startX = e.clientX
      startWidth = columnWidths.value[index] ?? DEFAULT_COL_WIDTH
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    function handleMouseMove(e: MouseEvent) {
      if (resizingIndex === -1) return
      const delta = e.clientX - startX
      columnWidths.value[resizingIndex] = Math.max(MIN_COL_WIDTH, startWidth + delta)
    }

    function handleMouseUp() {
      resizingIndex = -1
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    return () => h('div', { class: 'result-table-wrap' }, [
      h('table', { class: 'result-table' }, [
        h('colgroup', {}, props.columns.map((_, i) =>
          h('col', { key: i, style: { width: columnWidths.value[i] + 'px' } })
        )),
        h('thead', {}, [
          h('tr', {}, props.columns.map((col, i) =>
            h('th', { key: col, style: { width: columnWidths.value[i] + 'px' } }, [
              h('span', { class: 'th-text' }, col),
              h('div', {
                class: 'col-resize-handle',
                onMousedown: (e: MouseEvent) => startResize(e, i)
              })
            ])
          ))
        ]),
        h('tbody', {}, props.rows.map((row, rowIndex) =>
          h('tr', { key: rowIndex }, props.columns.map(col =>
            h('td', { key: col }, String(row[col] ?? ''))
          ))
        ))
      ])
    ])
  }
})
</script>

<template>
  <div class="debug-panel">
    <!-- SQL Tab -->
    <div v-if="activeTab === 'sql'" class="tab-content">
      <div class="sql-layout">
        <!-- 左侧：表结构浏览器 -->
        <div class="schema-sidebar">
          <div class="sidebar-header">
            <Database :size="14" />
            <span>数据表</span>
            <button class="icon-btn" @click="loadSchema" :disabled="schemaLoading" title="刷新">
              <RefreshCw :size="12" :class="{ spinning: schemaLoading }" />
            </button>
          </div>
          <div class="table-list">
            <div
              v-for="table in schemaTables"
              :key="table.name"
              class="table-item"
              :class="{ selected: selectedTable === table.name }"
              @click="selectTable(table.name)"
            >
              <Table2 :size="12" />
              <span class="table-name">{{ table.name }}</span>
              <div class="table-actions" @click.stop>
                <button class="icon-btn tiny" @click="getTableRowCount(table.name)" title="行数">
                  <Hash :size="10" />
                </button>
                <button class="icon-btn tiny danger" @click="clearTableData(table.name)" title="清空">
                  <Trash2 :size="10" />
                </button>
              </div>
            </div>
          </div>

          <!-- 选中表的列信息 -->
          <div v-if="selectedTable" class="column-info">
            <div class="column-info-header">
              <span>{{ selectedTable }} 列信息</span>
            </div>
            <div class="column-list">
              <div
                v-for="col in schemaTables.find(t => t.name === selectedTable)?.columns || []"
                :key="col.cid"
                class="column-item"
              >
                <span class="col-name">{{ col.name }}</span>
                <span class="col-type">{{ col.type || 'ANY' }}</span>
                <span v-if="col.pk" class="col-badge pk">PK</span>
                <span v-if="col.notnull" class="col-badge nn">NN</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：SQL 执行器 + 结果 -->
        <div class="sql-main">
          <div class="sql-input-area">
            <textarea
              v-model="sqlInput"
              class="sql-textarea"
              placeholder="输入 SQL 语句..."
              rows="4"
              @keydown.ctrl.enter="executeSQL"
              @keydown.meta.enter="executeSQL"
            ></textarea>
            <button
              class="execute-btn"
              @click="executeSQL"
              :disabled="sqlLoading"
            >
              <Play :size="14" />
              {{ sqlLoading ? '执行中...' : '执行' }}
              <span class="shortcut-hint">Ctrl+Enter</span>
            </button>
          </div>

          <!-- 错误信息 -->
          <div v-if="sqlError" class="sql-error">
            <AlertCircle :size="14" />
            <span>{{ sqlError }}</span>
          </div>

          <!-- 结果区域 -->
          <div v-if="sqlResult" class="sql-result">
            <div class="result-header">
              <span v-if="sqlResult.columns.length > 0">
                <CheckCircle2 :size="12" class="success-icon" />
                查询结果：{{ sqlResult.rows.length }} 行
              </span>
              <span v-else>
                <CheckCircle2 :size="12" class="success-icon" />
                执行成功：影响 {{ sqlResult.changes }} 行
              </span>
            </div>

            <!-- 结果表格 -->
            <ResizableResultTable
              v-if="sqlResult.columns.length > 0"
              :columns="sqlResult.columns"
              :rows="sqlResult.rows"
            />
          </div>

          <!-- 表数据浏览 -->
          <div v-if="selectedTable && tableDataColumns.length > 0" class="table-data-section">
            <div class="table-data-header">
              <span>{{ selectedTable }} 数据预览</span>
              <div class="page-controls">
                <button
                  class="icon-btn"
                  :disabled="tableDataPage === 0"
                  @click="tableDataPage--; loadTableData()"
                >‹</button>
                <span class="page-info">第 {{ tableDataPage + 1 }} 页</span>
                <button
                  class="icon-btn"
                  :disabled="tableData.length < TABLE_PAGE_SIZE"
                  @click="tableDataPage++; loadTableData()"
                >›</button>
              </div>
            </div>
            <ResizableResultTable :columns="tableDataColumns" :rows="tableData" />
          </div>
        </div>
      </div>
    </div>

    <!-- API Tab -->
    <div v-if="activeTab === 'api'" class="tab-content">
      <div class="api-groups">
        <div v-for="group in apiGroups" :key="group.name" class="api-group">
          <div class="group-header">
            <component :is="group.icon" :size="16" class="group-icon" />
            <span class="group-name">{{ group.name }}</span>
            <span class="group-count">{{ group.endpoints.length }}</span>
          </div>

          <div class="endpoint-list">
            <div v-for="ep in group.endpoints" :key="`${ep.method} ${ep.path}`" class="endpoint-item">
              <div
                class="endpoint-header"
                @click="toggleEndpoint(`${ep.method} ${ep.path}`)"
              >
                <span class="method-badge" :style="{ background: getMethodColor(ep.method) }">
                  {{ ep.method }}
                </span>
                <span class="endpoint-path">{{ ep.path }}</span>
                <span class="endpoint-desc">{{ ep.description }}</span>
                <ChevronRight
                  :size="14"
                  class="expand-arrow"
                  :class="{ expanded: expandedEndpoint === `${ep.method} ${ep.path}` }"
                />
              </div>

              <!-- 展开的参数面板 -->
              <div v-if="expandedEndpoint === `${ep.method} ${ep.path}`" class="param-panel">
                <!-- 路径参数 -->
                <template v-if="ep.params?.some(p => p.type === 'path')">
                  <div class="param-section">
                    <label class="param-label">路径参数</label>
                    <div
                      v-for="p in ep.params.filter(p => p.type === 'path')"
                      :key="p.name"
                      class="param-row"
                    >
                      <span class="param-name">:{{ p.name }}</span>
                      <input
                        v-model="apiParams[p.name]"
                        class="param-input"
                        :placeholder="`${p.name}`"
                      />
                    </div>
                  </div>
                </template>

                <!-- 查询参数 -->
                <template v-if="ep.params?.some(p => p.type === 'query')">
                  <div class="param-section">
                    <label class="param-label">查询参数</label>
                    <div
                      v-for="p in ep.params.filter(p => p.type === 'query')"
                      :key="p.name"
                      class="param-row"
                    >
                      <span class="param-name">{{ p.name }}</span>
                      <input
                        v-model="apiParams[p.name]"
                        class="param-input"
                        :placeholder="p.name"
                      />
                    </div>
                  </div>
                </template>

                <!-- 请求体 -->
                <template v-if="ep.method === 'POST' || ep.method === 'PUT'">
                  <div class="param-section">
                    <label class="param-label">请求体 (JSON)</label>
                    <textarea
                      v-model="apiBody"
                      class="body-textarea"
                      rows="6"
                      placeholder='{"key": "value"}'
                    ></textarea>
                  </div>
                </template>

                <!-- 发送按钮 -->
                <div class="send-row">
                  <button
                    class="send-btn"
                    @click="sendApiRequest(`${ep.method} ${ep.path}`)"
                    :disabled="apiLoading"
                  >
                    <Send :size="13" />
                    {{ apiLoading ? '发送中...' : '发送请求' }}
                  </button>
                </div>

                <!-- 响应结果 -->
                <div v-if="apiError" class="api-error">
                  <AlertCircle :size="13" />
                  {{ apiError }}
                </div>
                <div v-if="apiResponse" class="api-response">
                  <div class="response-header">
                    <span class="response-status" :style="{ color: getStatusColor(apiResponse.status) }">
                      {{ apiResponse.status }} {{ apiResponse.status >= 200 && apiResponse.status < 300 ? 'OK' : apiResponse.status >= 400 ? 'Error' : '' }}
                    </span>
                    <span class="response-time">{{ apiResponse.duration }}ms</span>
                    <button class="icon-btn tiny" @click="copyToClipboard(formatJson(apiResponse.data))" title="复制">
                      <Copy :size="11" />
                    </button>
                  </div>
                  <pre class="response-body">{{ formatJson(apiResponse.data) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debug-panel {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 7rem);
  max-height: calc(100vh - 7rem);
  height: calc(100dvh - 7rem);
  max-height: calc(100dvh - 7rem);
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

/* SQL Layout */
.sql-layout {
  display: flex;
  min-height: 0;
  flex: 1;
  height: 100%;
}

.schema-sidebar {
  width: 200px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border-light);
}

.sidebar-header span {
  flex: 1;
}

.table-list {
  overflow-y: auto;
  flex: 1;
}

.table-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
}

.table-item:hover {
  background: var(--color-bg-tertiary);
}

.table-item.selected {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}

.table-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.table-item:hover .table-actions {
  opacity: 1;
}

.column-info {
  border-top: 1px solid var(--color-border);
  max-height: 200px;
  overflow-y: auto;
}

.column-info-header {
  padding: 6px 10px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border-light);
}

.column-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-size: 0.6875rem;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.col-name {
  color: var(--color-text-primary);
}

.col-type {
  color: var(--color-text-muted);
  font-size: 0.625rem;
}

.col-badge {
  font-size: 0.5625rem;
  padding: 0 3px;
  border-radius: 2px;
  font-weight: 600;
}

.col-badge.pk {
  background: #fbbf24;
  color: #000;
}

.col-badge.nn {
  background: var(--color-bg-tertiary);
  color: var(--color-text-muted);
}

/* SQL Main */
.sql-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.sql-input-area {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sql-textarea {
  width: 100%;
  padding: 8px 10px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  resize: vertical;
  box-sizing: border-box;
}

.sql-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.execute-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 500;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  align-self: flex-start;
  transition: opacity 0.15s;
}

.execute-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.execute-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shortcut-hint {
  font-size: 0.6875rem;
  opacity: 0.6;
  margin-left: 4px;
}

/* Results */
.sql-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin: 0 10px;
  font-size: 0.8125rem;
  color: var(--color-error);
  background: color-mix(in srgb, var(--color-error) 8%, transparent);
  border-radius: var(--radius-md);
}

.sql-result {
  padding: 0 10px 10px;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.success-icon {
  color: #22c55e;
}

:deep(.result-table-wrap) {
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 240px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  flex: 1;
}

:deep(.result-table) {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  table-layout: fixed;
}

:deep(.result-table th) {
  position: relative;
  background: var(--color-bg-secondary);
  padding: 6px 10px;
  text-align: left;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;
}

:deep(.result-table th .th-text) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.result-table td) {
  padding: 4px 10px;
  border-bottom: 1px solid var(--color-border-light);
  border-right: 1px solid var(--color-border-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;
}

:deep(.result-table tr:last-child td) {
  border-bottom: none;
}

:deep(.result-table th:last-child),
:deep(.result-table td:last-child) {
  border-right: none;
}

:deep(.result-table tr:hover td) {
  background: var(--color-bg-tertiary);
}

:deep(.col-resize-handle) {
  position: absolute;
  right: 0;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 2;
  background: transparent;
  transition: background 0.15s;
}

:deep(.col-resize-handle:hover),
:deep(.col-resize-handle:active) {
  background: var(--color-primary);
}

/* Table data preview */
.table-data-section {
  padding: 0 10px 10px;
  border-top: 1px solid var(--color-border-light);
  margin-top: 4px;
  padding-top: 8px;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.table-data-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 6px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.page-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-info {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

/* Icon buttons */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.icon-btn.tiny {
  width: 18px;
  height: 18px;
}

.icon-btn.danger:hover {
  color: var(--color-error);
}

.icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* API Tab */
.api-groups {
  padding: 8px;
  max-height: calc(100% - 1rem);
  overflow-y: auto;
}

.api-group {
  margin-bottom: 8px;
  min-height: 0;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.group-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.group-name {
  flex: 1;
}

.group-count {
  font-size: 0.6875rem;
  background: var(--color-bg-tertiary);
  padding: 0 6px;
  border-radius: 8px;
  color: var(--color-text-muted);
}

.endpoint-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.endpoint-item {
  border-radius: var(--radius-md);
  overflow: hidden;
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
  transition: background 0.15s;
  border-radius: var(--radius-md);
}

.endpoint-header:hover {
  background: var(--color-bg-tertiary);
}

.method-badge {
  font-size: 0.625rem;
  font-weight: 700;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  min-width: 44px;
  text-align: center;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.endpoint-path {
  font-size: 0.75rem;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.endpoint-desc {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  flex: 1;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.expand-arrow {
  color: var(--color-text-muted);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.expand-arrow.expanded {
  transform: rotate(90deg);
}

/* Param Panel */
.param-panel {
  padding: 8px 10px 10px;
  margin: 0 4px 4px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-light);
}

.param-section {
  margin-bottom: 8px;
}

.param-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.param-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.param-name {
  font-size: 0.75rem;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  color: var(--color-primary);
  min-width: 80px;
}

.param-input {
  flex: 1;
  padding: 4px 8px;
  font-size: 0.8125rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.param-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.body-textarea {
  width: 100%;
  padding: 8px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  resize: vertical;
  box-sizing: border-box;
}

.body-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.send-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}

.send-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  font-size: 0.8125rem;
  font-weight: 500;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.api-error {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  padding: 6px 8px;
  font-size: 0.75rem;
  color: var(--color-error);
  background: color-mix(in srgb, var(--color-error) 8%, transparent);
  border-radius: var(--radius-sm);
}

.api-response {
  margin-top: 8px;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.response-status {
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
}

.response-time {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.response-body {
  padding: 8px 10px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre;
  margin: 0;
  color: var(--color-text-primary);
}

@media (max-width: 767px) {
  .debug-panel {
    height: calc(100vh - 8.5rem);
    max-height: calc(100vh - 8.5rem);
    height: calc(100dvh - 8.5rem);
    max-height: calc(100dvh - 8.5rem);
  }
}
</style>
