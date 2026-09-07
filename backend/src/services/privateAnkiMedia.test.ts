import { describe, expect, test } from 'vitest'
import { contentTypeForPrivateAnkiMedia, isPrivateAnkiMediaHash, resolvePrivateAnkiMedia, signedPrivateAnkiMediaUrl, verifyPrivateAnkiMediaSignature } from './privateAnkiMedia'
const hash = 'a'.repeat(64)
describe('private Anki media', () => {
  it('accepts only hash-named supported image bytes', () => {
    expect(isPrivateAnkiMediaHash('a'.repeat(64))).toBe(true)
    expect(isPrivateAnkiMediaHash('not-a-hash')).toBe(false)
    expect(contentTypeForPrivateAnkiMedia(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg')
    expect(contentTypeForPrivateAnkiMedia(Buffer.from('not an image'))).toBeNull()
  })

  test('binds signatures to owner, bytes hash and expiry', () => {
    const url = new URL(signedPrivateAnkiMediaUrl(42, hash, 'https://api.example.com', 1000))
    const expiry = url.searchParams.get('expires')!
    const signature = url.searchParams.get('signature')!
    expect(verifyPrivateAnkiMediaSignature('42', hash, expiry, signature, 1001)).toBe(true)
    expect(verifyPrivateAnkiMediaSignature('43', hash, expiry, signature, 1001)).toBe(false)
    expect(verifyPrivateAnkiMediaSignature('42', 'b'.repeat(64), expiry, signature, 1001)).toBe(false)
    expect(verifyPrivateAnkiMediaSignature('42', hash, expiry, signature, Number(expiry))).toBe(false)
    expect(verifyPrivateAnkiMediaSignature('42', hash, expiry, 'a', 1001)).toBe(false)
  })
  test('copies and resolves all image slots while preserving ordinary media', () => {
    const media = { kind: 'image', url: `anki-media:${hash}`, alt: 'private' }
    const payload = { media, mediaGallery: [media], explanationMedia: [media], optionImages: [null, media] }
    const [resolved] = resolvePrivateAnkiMedia([payload], 42, 'https://api.example.com')
    expect(resolved.media.url).toMatch(/^https:\/\/api.example.com\/api\/private-anki-media\/42\//)
    expect(resolved.mediaGallery[0].url).toBe(resolved.media.url)
    expect(resolved.explanationMedia[0].url).toBe(resolved.media.url)
    expect(resolved.optionImages[1]!.url).toBe(resolved.media.url)
    expect(payload.media.url).toBe(`anki-media:${hash}`)
    expect(resolvePrivateAnkiMedia([{ media: { url: 'https://example.com/a.png' } }], 42, 'https://api.example.com')[0].media.url).toBe('https://example.com/a.png')
  })
})
