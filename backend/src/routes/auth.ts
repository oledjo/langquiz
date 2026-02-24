import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db/database'
import { signToken, type UserRole } from '../auth/jwt'
import { requireAuth } from '../auth/middleware'

export const authRouter = Router()

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const BCRYPT_COST = 12
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
)

function resolveRoleByEmail(email: string): UserRole {
  return ADMIN_EMAILS.has(email) ? 'admin' : 'user'
}

authRouter.post('/register', async (req, res) => {
  const { email, password } = req.body as { email?: unknown; password?: unknown }

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'A valid email address is required.' })
    return
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` })
    return
  }

  const normalizedEmail = email.toLowerCase().trim()

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({ error: 'An account with this email already exists.' })
      return
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
    const role = resolveRoleByEmail(normalizedEmail)
    const result = await db.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [normalizedEmail, passwordHash, role]
    )

    const user = result.rows[0] as { id: number; email: string; role: UserRole }
    const token = signToken(user.id, user.role)
    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
})

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: unknown; password?: unknown }

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required.' })
    return
  }

  const normalizedEmail = email.toLowerCase().trim()

  try {
    const result = await db.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [normalizedEmail]
    )

    if (!result.rowCount || result.rowCount === 0) {
      res.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    const user = result.rows[0] as { id: number; email: string; password_hash: string; role: UserRole }
    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password.' })
      return
    }

    const effectiveRole = resolveRoleByEmail(normalizedEmail)
    if (effectiveRole !== user.role) {
      await db.query('UPDATE users SET role = $1 WHERE id = $2', [effectiveRole, user.id])
      user.role = effectiveRole
    }

    const token = signToken(user.id, user.role)
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT id, email, role FROM users WHERE id = $1', [req.userId])
    if (!result.rowCount || result.rowCount === 0) {
      res.status(401).json({ error: 'User not found.' })
      return
    }
    const user = result.rows[0] as { id: number; email: string; role: UserRole }
    res.json({ id: user.id, email: user.email, role: user.role })
  } catch (error) {
    console.error('Me error:', error)
    res.status(500).json({ error: 'Failed to fetch user.' })
  }
})
