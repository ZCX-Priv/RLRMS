import { Router, type Request, type Response } from 'express'
import { get, run } from '../db/index.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

/**
 * JWT Payload 类型定义
 * 用于类型安全的 token 解码
 */
interface JwtPayload {
  userId: string
  username: string
  role: string
}

// IP-based login rate limiter
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const attempts = loginAttempts.get(ip)
  
  if (!attempts) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now })
    return true
  }
  
  if (now - attempts.lastAttempt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now })
    return true
  }
  
  if (attempts.count >= MAX_ATTEMPTS) {
    return false
  }
  
  attempts.count++
  attempts.lastAttempt = now
  return true
}

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.warn('Warning: JWT_SECRET not set, using default key. Please set JWT_SECRET in production!')
}
const SECRET_KEY = JWT_SECRET || 'dev-secret-key-change-in-production'

const isProduction = process.env.NODE_ENV === 'production'
const COOKIE_NAME = 'admin_token'
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000 // 1 day in milliseconds

export const authRouter = Router()

// Admin login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    
    // Check rate limit
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ 
        success: false, 
        error: '登录尝试次数过多，请15分钟后再试' 
      })
    }
    
    const { username, password } = req.body
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: '请输入用户名和密码' 
      })
    }
    
    const user = get<{
      id: string
      username: string
      password: string
      role: string
      name: string | null
    }>('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'admin'])
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: '用户名或密码错误' 
      })
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password)
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: '用户名或密码错误' 
      })
    }
    
    // Clear login attempts on successful login
    loginAttempts.delete(ip)
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      SECRET_KEY,
      { expiresIn: '1d' }
    )
    
    // Set httpOnly cookie
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name
        }
      }
    })
  } catch (error) {
    console.error('Error during login:', error)
    res.status(500).json({ success: false, error: 'Login failed' })
  }
})

// Logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  })
  res.json({ success: true, message: 'Logged out successfully' })
})

// Verify token (from cookie)
authRouter.get('/verify', (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[COOKIE_NAME]
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' })
    }
    
    const decoded = jwt.verify(token, SECRET_KEY) as JwtPayload
    
    res.json({
      success: true,
      data: {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role
      }
    })
  } catch (error) {
    console.error('Error verifying token:', error)
    res.status(401).json({ success: false, error: 'Invalid token' })
  }
})

// Change password
authRouter.put('/password', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[COOKIE_NAME]
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' })
    }
    
    const decoded = jwt.verify(token, SECRET_KEY) as JwtPayload
    
    const { oldPassword, newPassword } = req.body
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: '请输入旧密码和新密码' 
      })
    }
    
    const user = get<{ id: string; password: string }>('SELECT * FROM users WHERE id = ?', [decoded.userId])
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    
    const isValidPassword = await bcrypt.compare(oldPassword, user.password)
    
    if (!isValidPassword) {
      return res.status(400).json({ 
        success: false, 
        error: '旧密码错误' 
      })
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, decoded.userId])
    
    res.json({ success: true, message: '密码修改成功' })
  } catch (error) {
    console.error('Error changing password:', error)
    res.status(500).json({ success: false, error: 'Failed to change password' })
  }
})