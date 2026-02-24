import type { Request, Response, NextFunction } from 'express'
import { verifyToken, type UserRole } from './jwt'

declare global {
  namespace Express {
    interface Request {
      userId?: number
      userRole?: UserRole
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const token = authHeader.slice(7)
  try {
    const { userId, role } = verifyToken(token)
    req.userId = userId
    req.userRole = role
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}
