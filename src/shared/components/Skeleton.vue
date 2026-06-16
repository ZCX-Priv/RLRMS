<script setup lang="ts">
/**
 * Skeleton 骨架屏组件
 * 用于在数据加载时显示占位内容，提升用户体验
 */
import { computed } from 'vue'

type SkeletonVariant = 'text' | 'circle' | 'rect' | 'card'

interface Props {
  /** 骨架屏类型 */
  variant?: SkeletonVariant
  /** 宽度 */
  width?: string | number
  /** 高度 */
  height?: string | number
  /** 是否显示动画 */
  animated?: boolean
  /** 圆角 */
  radius?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'rect',
  animated: true
})

const skeletonStyle = computed(() => {
  const style: Record<string, string> = {}

  // 处理宽度
  if (props.width !== undefined) {
    style.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }

  // 处理高度
  if (props.height !== undefined) {
    style.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }

  // 处理圆角
  if (props.radius !== undefined) {
    style.borderRadius = typeof props.radius === 'number' ? `${props.radius}px` : props.radius
  }

  return style
})

const skeletonClass = computed(() => {
  const classes = ['skeleton']

  if (props.animated) {
    classes.push('skeleton-animated')
  }

  // 根据 variant 添加类名
  classes.push(`skeleton-${props.variant}`)

  return classes
})
</script>

<template>
  <div :class="skeletonClass" :style="skeletonStyle"></div>
</template>

<style scoped>
.skeleton {
  background-color: var(--color-bg-tertiary);
  position: relative;
  overflow: hidden;
}

.skeleton-animated {
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary) 25%,
    rgba(0, 0, 0, 0.05) 50%,
    var(--color-bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* Variant 样式 */
.skeleton-text {
  height: 1em;
  border-radius: var(--radius-sm);
}

.skeleton-circle {
  border-radius: 50%;
}

.skeleton-rect {
  border-radius: var(--radius-md);
}

.skeleton-card {
  border-radius: var(--radius-lg);
}

/* 默认尺寸 */
.skeleton-text:not([style*="height"]) {
  height: 14px;
}

.skeleton-circle:not([style*="width"]) {
  width: 40px;
}

.skeleton-circle:not([style*="height"]) {
  height: 40px;
}

.skeleton-rect:not([style*="width"]) {
  width: 100%;
}

.skeleton-rect:not([style*="height"]) {
  height: 100px;
}

.skeleton-card:not([style*="width"]) {
  width: 100%;
}

.skeleton-card:not([style*="height"]) {
  height: 120px;
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .skeleton-animated {
    animation: none;
  }
}
</style>
