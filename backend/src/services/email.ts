import jwt from 'jsonwebtoken'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://langquiz.onrender.com'
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required.')
}
const JWT_SECRET_VALUE = JWT_SECRET

interface EmailPayload {
  to: string
  subject: string
  html: string
  text: string
}

interface UnsubscribePayload {
  type: 'unsubscribe'
  userId: number
  email: string
}

export function createUnsubscribeToken(userId: number, email: string): string {
  return jwt.sign({ type: 'unsubscribe', userId, email } satisfies UnsubscribePayload, JWT_SECRET_VALUE, {
    expiresIn: '30d',
  })
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload {
  const payload = jwt.verify(token, JWT_SECRET_VALUE) as Partial<UnsubscribePayload>
  if (payload.type !== 'unsubscribe' || typeof payload.userId !== 'number' || typeof payload.email !== 'string') {
    throw new Error('Invalid unsubscribe token.')
  }
  return payload as UnsubscribePayload
}

export function buildUnsubscribeUrl(userId: number, email: string): string {
  const token = createUnsubscribeToken(userId, email)
  return `${APP_BASE_URL}/api/retention/unsubscribe?token=${encodeURIComponent(token)}`
}

export async function sendEmail(payload: EmailPayload): Promise<{ delivered: boolean; mode: 'resend' | 'log' }> {
  if (RESEND_API_KEY && EMAIL_FROM) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Resend send failed: ${res.status} ${body.slice(0, 300)}`)
    }

    return { delivered: true, mode: 'resend' }
  }

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      kind: 'email_preview',
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    })
  )
  return { delivered: true, mode: 'log' }
}
