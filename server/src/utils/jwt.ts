import { randomBytes } from 'crypto'

/** 应用级 JWT 密钥，启动时生成一次，所有模块共享 */
export const JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('hex')

if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET not set, using dynamic key. Tokens will not survive restarts.')
}
