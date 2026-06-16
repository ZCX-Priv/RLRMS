<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { Home, User, ClipboardList } from 'lucide-vue-next'

const route = useRoute()
const appStore = useAppStore()

const menuItems = [
  { icon: Home, label: '首页', path: '/' },
  { icon: ClipboardList, label: '订单', path: '/orders' },
  { icon: User, label: '我的', path: '/settings' },
]

onMounted(async () => {
  await appStore.loadTheme(false)
})

// 追踪当前激活的导航项，用于触发动画
const activePath = ref(route.path)
const bouncingItems = ref<Set<string>>(new Set())

// 监听路由变化，触发弹跳动画
watch(
  () => route.path,
  (newPath, oldPath) => {
    if (newPath !== oldPath) {
      activePath.value = newPath
      // 为新激活的项添加弹跳动画
      bouncingItems.value.add(newPath)
      // 动画结束后移除
      setTimeout(() => {
        bouncingItems.value.delete(newPath)
      }, 400)
    }
  }
)
</script>

<template>
  <div class="client-layout">
    <main class="client-main">
      <slot />
    </main>
    <nav class="client-nav">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ 'nav-item-active': $route.path === item.path }"
      >
        <Transition
          name="icon-bounce"
          mode="out-in"
        >
          <div
            :key="$route.path === item.path ? 'active' : 'inactive'"
            class="nav-icon-wrapper"
            :class="{ 'is-bouncing': bouncingItems.has(item.path) }"
          >
            <component :is="item.icon" :size="20" />
          </div>
        </Transition>
        <span class="nav-label">{{ item.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.client-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--color-bg-primary);
}

.client-main {
  flex: 1;
  padding-bottom: 60px;
}

.client-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  background-color: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-light);
  padding: var(--spacing-sm) 0;
  z-index: var(--z-fixed);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

/* 文字颜色平滑过渡 */
.nav-label {
  transition: color var(--duration-normal) var(--ease-out);
  color: var(--color-text-muted);
}

.nav-item:hover .nav-label {
  color: var(--color-text-secondary);
}

.nav-item-active .nav-label {
  color: var(--color-primary);
}

/* 图标包装器 */
.nav-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  transition: transform var(--duration-fast) var(--ease-out),
              color var(--duration-normal) var(--ease-out);
  color: var(--color-text-muted);
}

.nav-item:hover .nav-icon-wrapper {
  color: var(--color-text-secondary);
}

.nav-item-active .nav-icon-wrapper {
  color: var(--color-primary);
}

/* 弹跳动画 */
.nav-icon-wrapper.is-bouncing {
  -webkit-animation: navIconBounce var(--duration-normal) var(--ease-bounce);
  animation: navIconBounce var(--duration-normal) var(--ease-bounce);
}

@-webkit-keyframes navIconBounce {
  0% {
    -webkit-transform: scale(1) translateY(0);
    transform: scale(1) translateY(0);
  }
  30% {
    -webkit-transform: scale(1.2) translateY(-4px);
    transform: scale(1.2) translateY(-4px);
  }
  50% {
    -webkit-transform: scale(0.95) translateY(0);
    transform: scale(0.95) translateY(0);
  }
  70% {
    -webkit-transform: scale(1.05) translateY(-2px);
    transform: scale(1.05) translateY(-2px);
  }
  100% {
    -webkit-transform: scale(1) translateY(0);
    transform: scale(1) translateY(0);
  }
}

@keyframes navIconBounce {
  0% {
    transform: scale(1) translateY(0);
  }
  30% {
    transform: scale(1.2) translateY(-4px);
  }
  50% {
    transform: scale(0.95) translateY(0);
  }
  70% {
    transform: scale(1.05) translateY(-2px);
  }
  100% {
    transform: scale(1) translateY(0);
  }
}

/* Vue Transition 图标切换动画 */
.icon-bounce-enter-active {
  -webkit-animation: iconPopIn var(--duration-fast) var(--ease-spring);
  animation: iconPopIn var(--duration-fast) var(--ease-spring);
}

.icon-bounce-leave-active {
  -webkit-animation: iconPopOut var(--duration-fast) var(--ease-out);
  animation: iconPopOut var(--duration-fast) var(--ease-out);
}

@-webkit-keyframes iconPopIn {
  0% {
    opacity: 0;
    -webkit-transform: scale(0.5);
    transform: scale(0.5);
  }
  100% {
    opacity: 1;
    -webkit-transform: scale(1);
    transform: scale(1);
  }
}

@keyframes iconPopIn {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@-webkit-keyframes iconPopOut {
  0% {
    opacity: 1;
    -webkit-transform: scale(1);
    transform: scale(1);
  }
  100% {
    opacity: 0;
    -webkit-transform: scale(0.5);
    transform: scale(0.5);
  }
}

@keyframes iconPopOut {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.5);
  }
}

/* 点击反馈 */
.nav-item:active .nav-icon-wrapper {
  -webkit-transform: scale(0.9);
  transform: scale(0.9);
}
</style>
