import { get } from '../db/index.js'

/** 起始会员号 */
const MEMBER_NO_START = 10001

/**
 * 生成下一个数字会员号
 * - 查询现有 5-6 位纯数字 username 的最大值 +1
 * - 用 LENGTH(username)<=6 排除 phone（11位），避免 MAX 把 phone 算进去
 * - 并发场景靠 users.username UNIQUE 约束 + 调用方重试兜底
 */
export function generateMemberNo(): string {
  const row = get<{ maxNo: number }>(
    "SELECT MAX(CAST(username AS INTEGER)) as maxNo FROM users WHERE LENGTH(username) <= 6 AND username GLOB '[0-9]*'"
  )
  const next = (row?.maxNo || MEMBER_NO_START - 1) + 1
  return String(next)
}
