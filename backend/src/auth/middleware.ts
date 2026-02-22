import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from './jwt'

declare global {
  namespace Express {
    interface Request {
      userId?: number
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
    const { userId } = verifyToken(token)
    req.userId = userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
