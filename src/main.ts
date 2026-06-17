import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router, { preloadCriticalRoutes } from './router'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// 全局禁用所有 input/textarea 的拼写检查
function disableSpellcheck(el: Element) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.setAttribute('spellcheck', 'false')
    el.setAttribute('autocorrect', 'off')
  }
}
document.querySelectorAll('input, textarea').forEach(disableSpellcheck)
new MutationObserver((mutations) => {
  mutations.forEach((m) => {
    m.addedNodes.forEach((node) => {
      if (node instanceof Element) {
        disableSpellcheck(node)
        node.querySelectorAll('input, textarea').forEach(disableSpellcheck)
      }
    })
  })
}).observe(document.body, { childList: true, subtree: true })

// Dispatch event to remove loading splash
window.dispatchEvent(new Event('app-mounted'))

// 预加载关键路由组件（首页、管理首页）
preloadCriticalRoutes()