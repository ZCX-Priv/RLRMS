import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router, { preloadCriticalRoutes } from './router'
import './style.css'
// 引入 vue-virtual-scroller 样式，用于长列表虚拟滚动
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Dispatch event to remove loading splash
window.dispatchEvent(new Event('app-mounted'))

// 预加载关键路由组件（首页、管理首页）
preloadCriticalRoutes()