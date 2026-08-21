import type { Request, Response, NextFunction } from 'express'
import { verifyToken, type UserRole } from './jwt'

declare global {
  namespace Express {
    interface Request {
      userId?: number
      userRole?: UserRole
      requestId?: string
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

/**
 * Attaches the caller's identity when the request carries a token, and lets the request through
 * anonymously when it carries none. Use it on endpoints that serve public content — official
 * decks and their questions — but return more to a signed-in caller: community decks, the
 * caller's own imported questions, vote state.
 *
 * A token that is present but malformed or expired is still rejected with 401 rather than
 * quietly downgraded to anonymous. The client treats 401 as "your session ended" and signs the
 * user out; silently serving the signed-out view to someone the UI still shows as signed in
 * would hide that, and their answers would stop being recorded with no visible cause.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers.authorization) {
    next()
    return
  }
  requireAuth(req, res, next)
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}
