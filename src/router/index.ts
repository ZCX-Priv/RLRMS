import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useClientAuthStore } from '@/stores/clientAuth'

const isEdgeBrowser = navigator.userAgent.includes('Edg/')
const originalReplaceState = window.history.replaceState.bind(window.history)

if (isEdgeBrowser) {
  window.history.replaceState = function (state, _title, url) {
    if (document.visibilityState === 'hidden') {
      return
    }
    return originalReplaceState(state ?? history.state, '', url || '')
  }
}

/**
 * 预加载关键路由组件
 * 在应用初始化后空闲时预加载首页和管理首页组件
 */
export function preloadCriticalRoutes(): void {
  // 使用 requestIdleCallback 在浏览器空闲时预加载
  const preload = () => {
    // 预加载客户端首页
    import('@/client/views/HomeView.vue')
    // 预加载管理后台首页
    import('@/admin/views/DashboardView.vue')
    // 预加载管理后台布局
    import('@/admin/views/LayoutView.vue')
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(preload, { timeout: 2000 })
  } else {
    // 降级处理：延迟 1 秒后预加载
    setTimeout(preload, 1000)
  }
}

// Client routes (customer facing)
const clientRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/client/views/HomeView.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/dish/:id',
    name: 'DishDetail',
    component: () => import('@/client/views/DishDetailView.vue'),
    meta: { title: '菜品详情' }
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('@/client/views/SearchView.vue'),
    meta: { title: '搜索' }
  },
  {
    path: '/order/confirm',
    name: 'OrderConfirm',
    component: () => import('@/client/views/OrderConfirmView.vue'),
    meta: { title: '确认订单', requiresClientAuth: true }
  },
  {
    path: '/order/:id',
    name: 'OrderDetail',
    component: () => import('@/client/views/OrderDetailView.vue'),
    meta: { title: '订单详情' }
  },
  {
    path: '/order/:id/qrcode',
    name: 'OrderQRCode',
    component: () => import('@/client/views/OrderQRCodeView.vue'),
    meta: { title: '订单码' }
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('@/client/views/OrdersView.vue'),
    meta: { title: '全部订单', requiresClientAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/client/views/SettingsView.vue'),
    meta: { title: '设置', requiresClientAuth: true }
  }
]

// Admin routes (management panel)
const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('@/admin/views/LoginView.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/admin',
    name: 'AdminLayout',
    component: () => import('@/admin/views/LayoutView.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'AdminDashboard',
        component: () => import('@/admin/views/DashboardView.vue'),
        meta: { title: '管理首页' }
      },
      {
        path: 'tables',
        name: 'AdminTables',
        component: () => import('@/admin/views/TablesView.vue'),
        meta: { title: '桌位管理' }
      },
      {
        path: 'dishes',
        name: 'AdminDishes',
        component: () => import('@/admin/views/DishesView.vue'),
        meta: { title: '菜单管理' }
      },
      {
        path: 'orders',
        name: 'AdminOrders',
        component: () => import('@/admin/views/OrdersView.vue'),
        meta: { title: '订单管理' }
      },
      {
        path: 'inventory',
        name: 'AdminInventory',
        component: () => import('@/admin/views/InventoryView.vue'),
        meta: { title: '库存管理' }
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/admin/views/UsersView.vue'),
        meta: { title: '用户管理' }
      },
      {
        path: 'settings',
        name: 'AdminSettings',
        component: () => import('@/admin/views/SettingsView.vue'),
        meta: { title: '系统设置' }
      },
      {
        path: 'debug',
        name: 'AdminDebug',
        component: () => import('@/admin/views/DebugView.vue'),
        meta: { title: '调试工具' }
      },
      {
        path: ':pathMatch(.*)*',
        name: 'AdminNotFound',
        component: () => import('@/admin/views/NotFoundView.vue'),
        meta: { title: '页面未找到' }
      }
    ]
  }
]

const routes: RouteRecordRaw[] = [
  ...clientRoutes,
  ...adminRoutes,
  {
    path: '/:pathMatch(.*)*',
    name: 'ClientNotFound',
    component: () => import('@/client/views/NotFoundView.vue'),
    meta: { title: '页面未找到' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// Navigation guard for admin routes
router.beforeEach(async (to, _from, next) => {
  // Update document title
  const title = to.meta.title as string
  document.title = title ? `${title} - 红灯笼食府` : '红灯笼食府'
  
  // Check client auth for protected client routes
  if (to.meta.requiresClientAuth) {
    const clientAuthStore = useClientAuthStore()
    
    // If already authenticated, allow access
    if (clientAuthStore.isAuthenticated) {
      next()
      return
    }
    
    // Try to restore from cookie
    const restored = await clientAuthStore.tryRestore()
    if (restored) {
      next()
      return
    }
    
    // Need to login - trigger the login modal
    const loginSuccess = await new Promise<boolean>((resolve) => {
      function onSuccess() {
        window.removeEventListener('client:login-cancel', onCancel)
        resolve(true)
      }
      function onCancel() {
        window.removeEventListener('client:login-success', onSuccess)
        resolve(false)
      }
      window.addEventListener('client:login-success', onSuccess, { once: true })
      window.addEventListener('client:login-cancel', onCancel, { once: true })
      // Show login modal
      window.dispatchEvent(new CustomEvent('client:require-login'))
    })
    
    if (loginSuccess) {
      next()
    } else {
      // User cancelled login, go to home
      next({ name: 'Home' })
    }
    return
  }
  
  // Check auth for admin routes
  if (to.meta.requiresAuth) {
    const authStore = useAuthStore()
    
    // If already authenticated, allow access
    if (authStore.isAuthenticated) {
      next()
      return
    }
    
    // Try to verify token from cookie
    try {
      const res = await api.verifyToken()
      authStore.setUser({
        id: res.data.userId,
        username: res.data.username,
        role: res.data.role,
        name: null,
        phone: null,
      })
      next()
    } catch {
      next({ name: 'AdminLogin', query: { redirect: to.fullPath } })
    }
    return
  }
  
  next()
})

/**
 * 路由预取策略：导航完成后预加载相关页面
 * 根据当前路由预测用户可能访问的下一个页面
 */
router.afterEach((to) => {
  // 使用 requestIdleCallback 在空闲时预取
  const prefetchRelated = () => {
    const routeName = to.name as string

    // 首页 -> 预加载菜品详情、搜索页
    if (routeName === 'Home') {
      import('@/client/views/DishDetailView.vue')
      import('@/client/views/SearchView.vue')
    }
    // 管理首页 -> 预加载订单管理、桌位管理
    else if (routeName === 'AdminDashboard') {
      import('@/admin/views/OrdersView.vue')
      import('@/admin/views/TablesView.vue')
    }
    // 订单管理 -> 预加载桌位管理
    else if (routeName === 'AdminOrders') {
      import('@/admin/views/TablesView.vue')
    }
    // 登录页 -> 预加载管理后台布局和首页
    else if (routeName === 'AdminLogin') {
      import('@/admin/views/LayoutView.vue')
      import('@/admin/views/DashboardView.vue')
    }
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetchRelated, { timeout: 1000 })
  } else {
    setTimeout(prefetchRelated, 500)
  }
})

export default router
