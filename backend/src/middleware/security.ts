import type { NextFunction, Request, Response } from 'express'

interface RateLimitOptions {
  keyPrefix: string
  windowMs: number
  max: number
}

interface Entry {
  count: number
  resetAt: number
}

const buckets = new Map<string, Entry>()
const BOT_UA_PATTERN = /(bot|spider|crawler|curl|wget|python-requests|headless|phantom)/i

function getClientKey(req: Request, keyPrefix: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  return `${keyPrefix}:${ip}`
}

export function rateLimit(opts: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now()
    const key = getClientKey(req, opts.keyPrefix)
    const existing = buckets.get(key)

    const entry =
      existing && existing.resetAt > now
        ? existing
        : {
            count: 0,
            resetAt: now + opts.windowMs,
          }

    entry.count += 1
    buckets.set(key, entry)

    const remaining = Math.max(0, opts.max - entry.count)
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))

    res.setHeader('x-ratelimit-limit', String(opts.max))
    res.setHeader('x-ratelimit-remaining', String(remaining))
    res.setHeader('x-ratelimit-reset', String(resetSeconds))

    if (entry.count > opts.max) {
      res.setHeader('retry-after', String(resetSeconds))
      res.status(429).json({ error: 'Too many requests. Please try again soon.' })
      return
    }

    next()
  }
}

export function basicBotGuard(req: Request, res: Response, next: NextFunction): void {
  const ua = (req.header('user-agent') ?? '').trim()
  if (!ua || BOT_UA_PATTERN.test(ua)) {
    res.status(403).json({ error: 'Request blocked by bot protection.' })
    return
  }
  next()
}
