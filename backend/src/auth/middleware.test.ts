import type { NextFunction, Request, Response } from 'express'
import { describe, expect, test, vi } from 'vitest'
import { optionalAuth } from './middleware'
import { signToken } from './jwt'

function fakeResponse() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(payload: unknown) {
      res.body = payload
      return res
    },
  }
  return res as unknown as Response & { statusCode: number }
}

function run(headers: Record<string, string>) {
  const req = { headers } as unknown as Request
  const res = fakeResponse()
  const next = vi.fn() as unknown as NextFunction
  optionalAuth(req, res, next)
  return { req, res, next: next as unknown as ReturnType<typeof vi.fn> }
}

describe('optionalAuth', () => {
  test('lets a request with no Authorization header through anonymously', () => {
    const { req, next } = run({})

    expect(next).toHaveBeenCalled()
    expect(req.userId).toBeUndefined()
  })

  test('attaches the identity when a valid token is present', () => {
    const { req, next } = run({ authorization: `Bearer ${signToken(7, 'admin')}` })

    expect(next).toHaveBeenCalled()
    expect(req.userId).toBe(7)
    expect(req.userRole).toBe('admin')
  })

  test('rejects an expired or malformed token instead of downgrading it to anonymous', () => {
    const { res, next } = run({ authorization: 'Bearer nonsense' })

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
  })

  test('rejects an Authorization header that is not a Bearer token', () => {
    const { res, next } = run({ authorization: 'Basic dXNlcjpwYXNz' })

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
  })
})
