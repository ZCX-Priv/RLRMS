# 全站懒加载优化 Spec

## Why
当前项目路由级别已实现懒加载，但组件级别仍使用静态导入，导致首屏加载包含不必要的组件代码，影响首屏加载性能和用户体验。

## What Changes
- 将大型模态框组件改为异步组件懒加载
- 将条件渲染的组件改为异步组件懒加载
- 优化共享组件的加载策略
- 添加组件加载状态处理

## Impact
- Affected specs: 性能优化
- Affected code: 
  - `src/client/views/*.vue` - 客户端视图组件
  - `src/admin/views/*.vue` - 管理端视图组件
  - `src/client/components/*.vue` - 客户端组件
  - `src/shared/components/*.vue` - 共享组件

## ADDED Requirements

### Requirement: 模态框组件懒加载
系统 SHALL 对模态框组件使用 `defineAsyncComponent` 进行懒加载，仅在需要时才加载组件代码。

#### Scenario: TableSelectModal 懒加载
- **WHEN** 用户首次访问首页或订单确认页
- **THEN** TableSelectModal 组件代码不会包含在初始包中
- **AND** 仅在用户点击选择桌位时才加载该组件

#### Scenario: ConfirmDialog 懒加载
- **WHEN** 用户访问任何页面
- **THEN** ConfirmDialog 组件代码不会包含在初始包中
- **AND** 仅在需要显示确认对话框时才加载该组件

### Requirement: 条件渲染组件懒加载
系统 SHALL 对条件渲染的组件使用懒加载策略。

#### Scenario: Modal 组件懒加载
- **WHEN** 页面包含 Modal 组件但未显示
- **THEN** Modal 组件代码不会立即加载
- **AND** 仅在 Modal 显示条件为 true 时才加载

### Requirement: 共享组件按需加载
系统 SHALL 对大型共享组件实现按需加载。

#### Scenario: Skeleton 组件加载
- **WHEN** 页面需要显示加载状态
- **THEN** Skeleton 组件被加载并显示

### Requirement: 组件加载状态处理
系统 SHALL 为异步组件提供加载状态处理。

#### Scenario: 异步组件加载中
- **WHEN** 异步组件正在加载
- **THEN** 显示适当的加载指示器或骨架屏
- **AND** 不阻塞用户交互

## MODIFIED Requirements

### Requirement: 保持路由懒加载
系统 SHALL 继续保持现有的路由级别懒加载实现。

#### Scenario: 路由导航
- **WHEN** 用户导航到新路由
- **THEN** 该路由对应的组件代码被懒加载
- **AND** 显示页面过渡动画

## REMOVED Requirements
无
