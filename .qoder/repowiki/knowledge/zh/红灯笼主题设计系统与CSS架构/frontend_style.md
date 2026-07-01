## 1. 核心样式系统
本项目采用 **原生 CSS 变量 (CSS Custom Properties)** 结合 **Vue Scoped Styles** 的方式构建前端视觉体系。未引入 Tailwind CSS、Bootstrap 或 Sass/Less 等预处理器，而是通过 `src/style.css` 定义了一套完整的 Design Tokens（设计令牌）。

### 设计令牌 (Design Tokens)
在 `:root` 中定义了全局变量，涵盖：
- **色彩体系**：以“红灯笼”为主题，主色为 `#DC2626` (Red-600)，辅以浅红背景 `#FEF2F2` 和深红文字 `#450A0A`。同时定义了状态色（成功、警告、错误）及桌位状态色。
- **排版**：优先使用中文优化字体栈（PingFang SC, Microsoft YaHei）。
- **间距与圆角**：标准化的 `--spacing-*` (0.25rem - 3rem) 和 `--radius-*` (0.25rem - 1rem)。
- **动效参数**：统一定义了 `--duration-*` (50ms - 600ms) 和多种贝塞尔曲线（如 `--ease-bounce`, `--ease-spring`）。

## 2. 主题切换机制 (Theming)
系统支持 **浅色/深色/跟随系统** 三种模式，通过 `data-theme` 属性驱动：
- **实现方式**：在 `index.html` 的 `<head>` 中通过内联脚本读取 `localStorage` 并设置 `document.documentElement` 的 `data-theme` 属性，防止页面闪烁 (FOUC)。
- **深色模式**：通过 `[data-theme="dark"]` 选择器覆盖背景、文字及边框颜色变量，实现一键换肤。
- **状态管理**：使用 Pinia (`src/stores/app.ts`) 管理主题偏好，并监听 `prefers-color-scheme` 媒体查询变化以响应系统级主题切换。

## 3. 动画与交互规范
项目内置了丰富的 CSS 关键帧动画，并针对 Edge 浏览器进行了 `-webkit-` 前缀兼容处理：
- **基础动画**：包括 `fadeIn`, `slideUp`, `scaleIn`, `bounce`, `shake` 等。
- **工具类**：提供了 `.animate-fade-in`, `.stagger-1` 等实用类，方便在 Vue 模板中直接调用。
- **性能优化**：对涉及变换的元素（如卡片、按钮、模态框）开启了 `backface-visibility: hidden` 以触发 GPU 加速；对特定动画元素使用 `will-change: transform`。
- **无障碍支持**：通过 `@media (prefers-reduced-motion: reduce)` 禁用或简化动画，照顾对运动敏感的用户。

## 4. 组件化样式约定
- **基础组件**：在 `style.css` 中定义了 `.btn`, `.card`, `.badge`, `.switch` 等通用 UI 组件的样式，确保跨模块视觉一致性。
- **Scoped Styles**：Vue 单文件组件 (SFC) 广泛使用 `<style scoped>`，通过局部样式隔离避免命名冲突，同时利用 `:deep()` 或 `:global()` 穿透修改第三方库或子组件样式。

## 5. 开发者指南
- **新增样式**：优先复用 `style.css` 中的 CSS 变量，避免硬编码颜色值或间距。
- **主题适配**：若需支持深色模式，请在 `[data-theme="dark"]` 块中补充对应的变量覆盖。
- **动画使用**：优先使用预定义的 `.animate-*` 类，保持交互动效的统一性和流畅度。