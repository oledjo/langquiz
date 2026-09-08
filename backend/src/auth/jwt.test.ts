import jwt from 'jsonwebtoken'
import { describe, expect, test } from 'vitest'
import { verifyToken } from './jwt'

describe('verifyToken', () => {
  test('normalizes a string PostgreSQL BIGINT userId to a number', () => {
    const token = jwt.sign({ userId: '1', role: 'user' }, process.env.JWT_SECRET!, { expiresIn: '1h' })

    expect(verifyToken(token)).toEqual({ userId: 1, role: 'user' })
  })
})
