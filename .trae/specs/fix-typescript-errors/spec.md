# TypeScript 语法错误修复 Spec

## Why
项目构建时有 185 个 TypeScript 错误，主要包括路径别名无法解析、未使用的变量、隐式 any 类型等问题，导致构建失败。

## What Changes
- 修复 `tsconfig.app.json` 添加 `baseUrl` 和 `paths` 配置以支持 `@/` 路径别名
- 移除所有未使用的变量和导入
- 为所有隐式 any 类型的参数添加正确的类型注解
- 修复可能为 undefined 的对象访问

## Impact
- Affected specs: 构建系统、类型安全
- Affected code: 
  - `tsconfig.app.json` - 添加路径别名配置
  - `src/router/index.ts` - 移除未使用变量
  - `src/stores/*.ts` - 添加类型注解
  - `src/client/**/*.vue` - 移除未使用导入、添加类型注解
  - `src/shared/components/*.vue` - 移除未使用导入
  - `src/admin/**/*.vue` - 移除未使用导入

## ADDED Requirements

### Requirement: TypeScript 路径别名解析
TypeScript 编译器 SHALL 能够正确解析 `@/` 路径别名。

#### Scenario: 路径别名配置
- **WHEN** TypeScript 编译器解析 `@/types` 等路径时
- **THEN** 应正确映射到 `src/types` 目录

### Requirement: 无未使用变量
代码中 SHALL 不存在未使用的变量和导入。

#### Scenario: 清理未使用导入
- **WHEN** 某个导入的变量未被使用
- **THEN** 应移除该导入或使用下划线前缀标记

### Requirement: 显式类型注解
所有函数参数 SHALL 具有显式类型注解。

#### Scenario: 回调函数类型
- **WHEN** 使用 reduce、map、filter 等回调函数
- **THEN** 参数应有明确的类型定义

## Error Categories

### Category 1: 路径别名无法解析 (TS2307)
- `Cannot find module '@/types'`
- `Cannot find module '@/stores/app'`
- `Cannot find module '@/api'`
- `Cannot find module '@/client/views/*.vue'`
- `Cannot find module '@/shared/components/*.vue'`

**修复方案**: 在 `tsconfig.app.json` 添加:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### Category 2: 未使用的变量 (TS6133)
- `src/router/index.ts`: `state`, `title`, `to`, `from`
- `src/client/components/ClientLayout.vue`: `Search`, `Settings`, `router`
- `src/shared/components/Toast.vue`: `X`
- 其他文件中的未使用导入

**修复方案**: 移除未使用的变量或使用 `_` 前缀

### Category 3: 隐式 any 类型 (TS7006)
- `src/stores/cart.ts`: reduce/map/filter 回调参数
- `src/client/components/DishCard.vue`: 回调参数
- 其他 Vue 组件中的回调参数

**修复方案**: 添加显式类型注解

### Category 4: 可能为 undefined (TS2532)
- `src/client/views/HomeView.vue`: 对象可能为 undefined
- `src/client/views/OrderConfirmView.vue`: 对象可能为 undefined

**修复方案**: 添加可选链或空值检查
