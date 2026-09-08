import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required.')
}

const EXPIRY = '7d'
export type UserRole = 'user' | 'admin'

function normalizeUserId(value: unknown): number {
  const userId = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('Invalid token user identifier.')
  }
  return userId
}

export function signToken(userId: number, role: UserRole): string {
  return jwt.sign({ userId: normalizeUserId(userId), role }, JWT_SECRET!, { expiresIn: EXPIRY })
}

export function verifyToken(token: string): { userId: number; role: UserRole } {
  const payload = jwt.verify(token, JWT_SECRET!) as { userId: unknown; role?: string }
  const role: UserRole = payload.role === 'admin' ? 'admin' : 'user'
  return { userId: normalizeUserId(payload.userId), role }
}
