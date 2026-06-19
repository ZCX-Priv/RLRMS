import { randomBytes, createHash } from 'crypto'
import { hostname, userInfo } from 'os'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * 开发模式：基于机器特征派生固定密钥
 * - 不写死在代码里（安全）
 * - 机器不变则密钥不变，tsx watch 重启时 token 不失效
 */
function getDevSecret(): string {
  const fingerprint = `red-lantern-dev:${hostname()}:${userInfo().username}`
  return createHash('sha256').update(fingerprint).digest('hex')
}

/**
 * 生产模式：保留动态密钥安全设计（每次启动不同，黑客无从下手）
 * 也可通过 JWT_SECRET 环境变量显式指定
 */
export const JWT_SECRET = isProduction
  ? (process.env.JWT_SECRET || randomBytes(48).toString('hex'))
  : getDevSecret()

if (isProduction && !process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET not set in production, using dynamic key. Tokens will not survive restarts.')
}
