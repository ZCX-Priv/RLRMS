import { Router, type Request, type Response } from 'express'
import { get, run } from '../db/index.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import { JWT_SECRET } from '../utils/jwt.js'
import { generateMemberNo } from '../utils/memberNo.js'

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

// 定期清理过期的 IP 记录，防止内存泄漏
setInterval(() => {
  const now = Date.now()
  for (const [ip, attempts] of loginAttempts) {
    if (now - attempts.lastAttempt > WINDOW_MS) {
      loginAttempts.delete(ip)
    }
  }
}, 30 * 60 * 1000).unref() // 每 30 分钟清理一次，unref 防止阻止进程退出

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

const isProduction = process.env.NODE_ENV === 'production'
const COOKIE_NAME = 'admin_token'
const CLIENT_COOKIE_NAME = 'client_token'
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
      JWT_SECRET,
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
    
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    
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

// Client login / auto-register
authRouter.post('/client/login', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    
    // Check rate limit
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ 
        success: false, 
        error: '登录尝试次数过多，请15分钟后再试' 
      })
    }
    
    const { phone, password } = req.body
    
    if (!phone || !password) {
      return res.status(400).json({ 
        success: false, 
        error: '请输入手机号和密码' 
      })
    }
    
    // Validate phone format (11 digits)
    if (!/^1\d{10}$/.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        error: '请输入正确的手机号' 
      })
    }
    
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度不能少于6位'
      })
    }
    
    // Check if customer exists
    let user = get<{
      id: string
      username: string
      password: string
      role: string
      phone: string | null
      name: string | null
    }>('SELECT * FROM users WHERE phone = ? AND role = ?', [phone, 'customer'])
    
    if (!user) {
      // Auto-register
      const hashedPassword = await bcrypt.hash(password, 10)
      let created: typeof user | undefined
      // 重试：并发注册可能生成相同会员号，靠 users.username UNIQUE 约束兜底
      for (let attempt = 0; attempt < 3 && !created; attempt++) {
        const id = randomBytes(16).toString('hex')
        const memberNo = generateMemberNo()
        try {
          run(
            'INSERT INTO users (id, username, password, role, phone, name) VALUES (?, ?, ?, ?, ?, ?)',
            [id, memberNo, hashedPassword, 'customer', phone, `用户${phone.slice(-4)}`]
          )
          created = get<typeof user>('SELECT * FROM users WHERE id = ?', [id])
        } catch (e) {
          if (attempt === 2) throw e
        }
      }
      user = created
      if (!user) {
        return res.status(500).json({ success: false, error: '注册失败' })
      }
    } else {
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        return res.status(401).json({ 
          success: false, 
          error: '手机号或密码错误' 
        })
      }
    }
    
    // Clear login attempts on successful login
    loginAttempts.delete(ip)
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: 'customer', phone: user.phone },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    
    // Set httpOnly cookie
    res.cookie(CLIENT_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * COOKIE_MAX_AGE,
      path: '/',
    })
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          role: 'customer'
        }
      }
    })
  } catch (error) {
    console.error('Error during client login:', error)
    res.status(500).json({ success: false, error: '登录失败' })
  }
})

// Client logout
authRouter.post('/client/logout', (_req: Request, res: Response) => {
  res.clearCookie(CLIENT_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  })
  res.json({ success: true, message: '已退出登录' })
})

// Client verify token
authRouter.get('/client/verify', (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[CLIENT_COOKIE_NAME]
    if (!token) {
      return res.status(401).json({ success: false, error: '未登录' })
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & { phone?: string }
    
    // 校验用户是否仍存在于数据库中（防止被删除的用户继续使用）
    const user = get<{ id: string; phone: string | null }>(
      'SELECT id, phone FROM users WHERE id = ? AND role = ?',
      [decoded.userId, 'customer']
    )
    if (!user) {
      res.clearCookie(CLIENT_COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
      })
      return res.status(401).json({ success: false, error: '用户不存在或已被删除' })
    }
    
    res.json({
      success: true,
      data: {
        userId: decoded.userId,
        phone: user.phone || decoded.phone || decoded.username,
        role: decoded.role
      }
    })
  } catch (error) {
    console.error('Error verifying client token:', error)
    res.status(401).json({ success: false, error: '登录已过期' })
  }
})

// Change password
authRouter.put('/password', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[COOKIE_NAME]
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' })
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    
    const { oldPassword, newPassword } = req.body
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: '请输入旧密码和新密码' 
      })
    }
    
    // 新密码最小长度 6 位
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: '新密码长度不能少于6位'
      })
    }
    
    // 新密码最大长度限制
    if (newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        error: '新密码长度不能超过128位'
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