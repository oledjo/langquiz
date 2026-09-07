import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'

export const PRIVATE_ANKI_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const TTL_SECONDS = 24 * 60 * 60
const HASH = /^[a-f0-9]{64}$/

export function isPrivateAnkiMediaHash(value: string): boolean {
  return HASH.test(value)
}

export function contentTypeForPrivateAnkiMedia(bytes: Buffer): string | null {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg'
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif'
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}

function signature(userId: string, sha256: string, expires: string): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required.')
  return createHmac('sha256', secret).update(`private-anki-media\n${userId}\n${sha256}\n${expires}`).digest('hex')
}

export function signedPrivateAnkiMediaUrl(userId: number, sha256: string, baseUrl: string, now = Math.floor(Date.now() / 1000)): string {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !HASH.test(sha256)) throw new Error('Invalid media reference.')
  const expires = String(now + TTL_SECONDS)
  return `${baseUrl.replace(/\/$/, '')}/api/private-anki-media/${userId}/${sha256}?expires=${expires}&signature=${signature(String(userId), sha256, expires)}`
}

export function verifyPrivateAnkiMediaSignature(userId: string, sha256: string, expires: string, supplied: string, now = Math.floor(Date.now() / 1000)): boolean {
  if (!/^[1-9][0-9]*$/.test(userId) || !HASH.test(sha256) || !/^[0-9]+$/.test(expires) || !HASH.test(supplied)) return false
  const expiry = Number(expires)
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + TTL_SECONDS) return false
  return timingSafeEqual(Buffer.from(signature(userId, sha256, expires), 'hex'), Buffer.from(supplied, 'hex'))
}

export function privateAnkiMediaBaseUrl(req: Request): string {
  const configured = process.env.API_PUBLIC_URL
  const url = new URL(configured || `${req.protocol}://${req.get('host')}`)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid API public URL.')
  return url.origin
}

/** Only media URLs are rewritten, never arbitrary content or source fields. */
export function resolvePrivateAnkiMedia<T extends Record<string, unknown>>(payloads: T[], userId: number, baseUrl: string): T[] {
  const now = Math.floor(Date.now() / 1000)
  function resolve(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(resolve)
    if (!value || typeof value !== 'object') return value
    const media = value as Record<string, unknown>
    if (typeof media.url !== 'string' || !media.url.startsWith('anki-media:')) return value
    const hash = media.url.slice('anki-media:'.length)
    return { ...media, url: HASH.test(hash) ? signedPrivateAnkiMediaUrl(userId, hash, baseUrl, now) : null }
  }
  return payloads.map(payload => {
    const result: Record<string, unknown> = { ...payload }
    for (const field of ['media', 'mediaGallery', 'explanationMedia', 'optionImages']) {
      if (field in result) result[field] = resolve(result[field])
    }
    return result as T
  })
}
