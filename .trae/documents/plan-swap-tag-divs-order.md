# 计划：将 `tag-add-row` div 移到 `tag-pills` div 上方

## 摘要 (Summary)

用户希望将「特色标签」表单组中的「添加标签输入行」(`tag-add-row`) 放到「已有标签展示区」(`tag-pills`) 的上方。当前顺序是先显示已有标签、再显示添加输入框；调整后应先显示添加输入框、再显示已有标签。

## 当前状态分析 (Current State Analysis)

相关文件：[src/admin/views/SettingsView.vue](file:///c:/Users/LX/Desktop/RLRMS/src/admin/views/SettingsView.vue)

当前结构（第 344–364 行）：

```html
<div class="form-group">
  <label>特色标签</label>
  <div class="tag-pills">          <!-- 已有标签展示，当前在上方 -->
    <span v-for="(tag, i) in featuresList" :key="i" class="tag-pill">
      {{ tag }}
      <button type="button" @click="removeFeature(i)"><X :size="12" /></button>
    </span>
  </div>
  <div class="tag-add-row">         <!-- 添加输入行，当前在下方 -->
    <input v-model="newFeature" type="text" placeholder="输入标签名称" @keydown.enter="addFeature" />
    <button type="button" class="btn btn-secondary tag-add-btn" @click="addFeature">
      <Plus :size="14" /> 添加
    </button>
  </div>
</div>
```

样式定义（第 832–872 行附近）：
- `.tag-pills`：`display: flex; flex-wrap: wrap; ...`
- `.tag-add-row`：`display: flex; gap: var(--spacing-xs); ...`

两个 div 均为普通块级流，DOM 顺序即视觉顺序，因此只需交换两个 div 的先后顺序即可，无需修改 CSS。

## 拟定修改 (Proposed Changes)

**文件**：[src/admin/views/SettingsView.vue](file:///c:/Users/LX/Desktop/RLRMS/src/admin/views/SettingsView.vue)

**修改内容**：在「特色标签」`form-group` 内，将 `tag-add-row` div 整体移动到 `tag-pills` div 之前。

**修改后结构**：

```html
<div class="form-group">
  <label>特色标签</label>
  <div class="tag-add-row">         <!-- 现在在上方 -->
    <input v-model="newFeature" type="text" placeholder="输入标签名称" @keydown.enter="addFeature" />
    <button type="button" class="btn btn-secondary tag-add-btn" @click="addFeature">
      <Plus :size="14" /> 添加
    </button>
  </div>
  <div class="tag-pills">          <!-- 现在在下方 -->
    <span v-for="(tag, i) in featuresList" :key="i" class="tag-pill">
      {{ tag }}
      <button type="button" @click="removeFeature(i)"><X :size="12" /></button>
    </span>
  </div>
</div>
```

**为什么**：用户明确要求 `tag-add-row` div 放在 `tag-pills` div 的上面。
**如何做**：使用 Edit 工具，将原 `tag-pills` 整块与 `tag-add-row` 整块互换位置。保持每个 div 内部内容、属性、绑定事件完全不变。CSS 无需改动。

## 假设与决策 (Assumptions & Decisions)

- 仅调整 DOM 顺序，不修改任何逻辑、样式或类名。
- 不改动 `tag-pills` 与 `tag-add-row` 之间的间距 CSS（当前靠默认块级间距即可，与原视觉一致）。
- 标签 `<label>特色标签</label>` 保持在最顶部不动。

## 验证步骤 (Verification)

1. 修改后运行项目的 lint/typecheck（若存在脚本），确保无语法错误。
2. 在浏览器中打开设置页面，确认「特色标签」区域：
   - 顶部为「输入标签名称」输入框 + 「添加」按钮
   - 下方为已有标签 pills 列表
3. 验证添加标签、删除标签功能仍正常工作。
