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
  res.status(500).json({ error: 'Internal server error.', requestId: req.requestId ?? null })
}
