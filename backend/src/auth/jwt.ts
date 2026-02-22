import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required.')
}

const EXPIRY = '7d'

export function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET!, { expiresIn: EXPIRY })
}

export function verifyToken(token: string): { userId: number } {
  const payload = jwt.verify(token, JWT_SECRET!) as { userId: number }
  return { userId: payload.userId }
}
