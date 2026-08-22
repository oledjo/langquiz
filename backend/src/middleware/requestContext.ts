import { randomUUID } from 'crypto'
import type { NextFunction, Request, Response } from 'express'

function nowIso(): string {
  return new Date().toISOString()
}

export function attachRequestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.header('x-request-id') ?? '').trim() || randomUUID()
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)

  const started = Date.now()
  res.on('finish', () => {
    const durationMs = Date.now() - started
    const payload = {
      ts: nowIso(),
      level: 'info',
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      userId: req.userId ?? null,
      ip: req.ip,
    }
    console.log(JSON.stringify(payload))
  })

  next()
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const message = err instanceof Error ? err.message : 'Unknown server error'
  console.error(
    JSON.stringify({
      ts: nowIso(),
      level: 'error',
      requestId: req.requestId ?? null,
      method: req.method,
      path: req.originalUrl,
      userId: req.userId ?? null,
      message,
    })
  )

  if (res.headersSent) return

  // Body parsers reject a request before any route sees it — an oversized image upload is the
  // one that happens in practice. Those errors carry their own 4xx status and a message worth
  // showing ("request entity too large"); anything else stays an opaque 500.
  const status = (err as { status?: unknown; statusCode?: unknown } | null)?.status ?? (err as { statusCode?: unknown } | null)?.statusCode
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: message, requestId: req.requestId ?? null })
    return
  }

  res.status(500).json({ error: 'Internal server error.', requestId: req.requestId ?? null })
}
