import { computed, type Ref, type MaybeRef, unref } from 'vue'

/**
 * 列表项动画配置接口
 */
export interface StaggeredAnimationOptions {
  /** 每个项目之间的延迟时间（毫秒），默认 50ms */
  delay?: number
  /** 最大延迟数量，超过后循环使用，默认 8 */
  maxStagger?: number
}

/**
 * 带有动画样式的列表项
 */
export interface AnimatedListItem<T> {
  /** 原始数据 */
  data: T
  /** 动画延迟样式 */
  style: Record<string, string>
  /** 交错索引类名 */
  staggerClass: string
}

/**
 * 列表交错动画组合式函数
 * 
 * 为列表项提供交错进入动画效果，支持动态添加/删除项
 * 
 * @param list - 响应式列表数据
 * @param options - 动画配置选项
 * @returns 带有动画延迟样式的列表项数组
 * 
 * @example
 * ```ts
 * const items = ref(['a', 'b', 'c'])
 * const animatedItems = useStaggeredAnimation(items, { delay: 50 })
 * // animatedItems.value = [
 * //   { data: 'a', style: { '--stagger-delay': '0ms' }, staggerClass: 'stagger-1' },
 * //   { data: 'b', style: { '--stagger-delay': '50ms' }, staggerClass: 'stagger-2' },
 * //   { data: 'c', style: { '--stagger-delay': '100ms' }, staggerClass: 'stagger-3' }
 * // ]
 * ```
 */
export function useStaggeredAnimation<T>(
  list: MaybeRef<T[]>,
  options: StaggeredAnimationOptions = {}
): Ref<AnimatedListItem<T>[]> {
  const { delay = 50, maxStagger = 8 } = options

  return computed(() => {
    const items = unref(list)
    
    return items.map((item, index) => {
      // 计算延迟时间
      const staggerDelay = index * delay
      // 计算交错类名索引（循环使用 1-8）
      const staggerIndex = (index % maxStagger) + 1
      
      return {
        data: item,
        style: {
          '--stagger-delay': `${staggerDelay}ms`
        },
        staggerClass: `stagger-${staggerIndex}`
      }
    })
  })
}

/**
 * 为 TransitionGroup 提供的 CSS 动画钩子
 * 可用于自定义进入/离开动画
 */
export const staggeredTransitionProps = {
  enterActiveClass: 'stagger-enter-active',
  leaveActiveClass: 'stagger-leave-active',
  moveClass: 'stagger-move'
}
